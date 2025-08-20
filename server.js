import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error("❌ ERROR: .env에 API_KEY가 필요합니다.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --------- 간단 캐시 ---------
const cache = new Map();
const TTL = 5 * 60 * 1000; // 5분

async function fetchWithRetry(url, retries = 3, baseDelay = 500) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, baseDelay * (2 ** i)));
      }
    }
  }
  throw lastErr;
}
async function getCached(url) {
  const now = Date.now();
  const entry = cache.get(url);
  if (entry && entry.expiry > now) return entry.data;
  const data = await fetchWithRetry(url);
  cache.set(url, { data, expiry: now + TTL });
  return data;
}

// ===== KST 날짜 유틸 =====
function getTodayKST() {
  const now = new Date();
  now.setHours(now.getHours() + 9); // UTC+9
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatDateKST(date) {
  const d = new Date(date);
  d.setHours(d.getHours() + 9);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// --------- 유틸: 학교종류 판별 ---------
function mapKindToDataset(kindName = "") {
  if (kindName.includes("초")) return "elsTimetable";
  if (kindName.includes("중")) return "mlsTimetable";
  if (kindName.includes("고")) return "hisTimetable";
  return "hisTimetable"; // 기본값
}

async function resolveDatasetBySchoolCode(schoolCode) {
  const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`;
  const j = await getCached(url);
  const kind = j?.schoolInfo?.[1]?.row?.[0]?.SCHUL_KND_SC_NM || "";
  return mapKindToDataset(kind);
}

// --------- Health ---------
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --------- 학교 검색 ---------
app.get("/api/searchSchool", async (req, res) => {
  try {
    const name = (req.query.name || "").trim();
    if (!name) return res.status(400).json([]);

    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const j = await getCached(url);
    const rows = j?.schoolInfo?.[1]?.row;
    if (!Array.isArray(rows)) return res.json([]);

    const result = rows.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      type: s.SCHUL_KND_SC_NM || "",
      gender: s.COEDU_SC_NM || ""
    }));
    res.json(result);
  } catch (err) {
    console.error("searchSchool error:", err.message || err);
    res.status(500).json([]);
  }
});

// --------- 일간 시간표 ---------
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, level, date } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);

    const today = date ? String(date).replace(/-/g, "") : getTodayKST();
    const dataset = level || await resolveDatasetBySchoolCode(schoolCode);

    const url = `https://open.neis.go.kr/hub/${dataset}?KEY=${API_KEY}&Type=json`
      + `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}`
      + `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`
      + `&ALL_TI_YMD=${today}`
      + `&GRADE=${encodeURIComponent(grade)}`
      + `&CLASS_NM=${encodeURIComponent(classNo)}`;

    const j = await getCached(url);
    const rows = j?.[dataset]?.[1]?.row;
    if (!Array.isArray(rows)) return res.json([]);

    const result = rows.map(t => ({
      date: t.ALL_TI_YMD || t.TI_YMD || "",
      period: t.PERIO || t.PERIOD || "",
      subject: t.ITRT_CNTNT || ""
    }));
    res.json(result);
  } catch (err) {
    console.error("dailyTimetable error:", err.message || err);
    res.status(500).json([]);
  }
});

// --------- 주간 시간표 (5일) ---------
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate, level } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);

    const sd = startDate ? String(startDate).replace(/-/g, "") : getTodayKST();
    const sdIso = `${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`;
    const endObj = new Date(sdIso);
    endObj.setDate(endObj.getDate() + 4);
    const ed = formatDateKST(endObj);

    const dataset = level || await resolveDatasetBySchoolCode(schoolCode);
    const url = `https://open.neis.go.kr/hub/${dataset}?KEY=${API_KEY}&Type=json`
      + `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}`
      + `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`
      + `&GRADE=${encodeURIComponent(grade)}`
      + `&CLASS_NM=${encodeURIComponent(classNo)}`
      + `&TI_FROM_YMD=${sd}&TI_TO_YMD=${ed}`;

    const j = await getCached(url);
    const rows = j?.[dataset]?.[1]?.row;
    if (!Array.isArray(rows)) return res.json([]);

    const result = rows.map(t => ({
      date: t.ALL_TI_YMD || t.TI_YMD || "",
      period: t.PERIO || "",
      subject: t.ITRT_CNTNT || ""
    }));
    res.json(result);
  } catch (err) {
    console.error("weeklyTimetable error:", err.message || err);
    res.status(500).json([]);
  }
});

// --------- 오늘 급식 ---------
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, date } = req.query;
    if (!schoolCode || !officeCode) return res.status(400).json({ menu: "" });
    const d = date ? String(date).replace(/-/g, "") : getTodayKST();

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json`
      + `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}`
      + `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`
      + `&MLSV_YMD=${d}`;

    const j = await getCached(url);
    const row = j?.mealServiceDietInfo?.[1]?.row?.[0];
    const menu = row?.DDISH_NM || "방학 중 급식 없음";
    res.json({ menu });
  } catch (err) {
    console.error("dailyMeal error:", err.message || err);
    res.status(500).json({ menu: "" });
  }
});

// ===== 월간 급식 조회 함수 =====
async function loadMonthlyMeal() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  let base = qs("mealMonthDate").value;
  const grid = qs("monthlyMealGrid");
  grid.innerHTML = "";

  if (!schoolCode || !officeCode) {
    grid.textContent = "학교를 선택하세요.";
    return;
  }

  // ✅ 조회일 기준 달 자동 설정 (KST 기준)
  const today = new Date();
  const kstToday = new Date(today.getTime() + (9 * 60 * 60 * 1000));
  if (!base) {
    base = `${kstToday.getFullYear()}-${String(kstToday.getMonth() + 1).padStart(2, "0")}-${String(kstToday.getDate()).padStart(2, "0")}`;
    qs("mealMonthDate").value = base;
  }

  const year = Number(base.slice(0, 4));
  const month = Number(base.slice(5, 7));

  const start = `${year}${String(month).padStart(2, "0")}01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}${String(month).padStart(2, "0")}${String(last).padStart(2, "0")}`;

  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${start}&endDate=${end}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      grid.textContent = "방학 중 급식 없음";
      return;
    }

    const map = {};
    data.forEach(it => { map[it.date] = it.menu; });

    const firstDay = new Date(year, month - 1, 1).getDay();
    for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement("div"));

    for (let d = 1; d <= last; d++) {
      const key = `${year}${String(month).padStart(2, "0")}${String(d).padStart(2, "0")}`;
      const cell = document.createElement("div");
      cell.innerHTML = `<strong>${d}</strong>${(map[key] || "").replace(/<br\s*\/?>/g, ", ")}`;
      grid.appendChild(cell);
    }
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
}

// ===== 버튼 클릭 시 수동 조회도 가능 =====
qs("loadMonthlyMealBtn").addEventListener("click", loadMonthlyMeal);

// ===== 페이지 로드 시 자동 조회 =====
document.addEventListener("DOMContentLoaded", loadMonthlyMeal);


// --------- SPA fallback ---------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------- start ---------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

