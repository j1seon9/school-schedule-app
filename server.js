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

// --------- 유틸: 학교종류 판별 ---------
function mapKindToDataset(kindName = "") {
  // NEIS 반환 예: '초등학교','중학교','고등학교','특수학교', '각종학교' 등
  if (kindName.includes("초")) return "elsTimetable";
  if (kindName.includes("중")) return "mlsTimetable";
  if (kindName.includes("고")) return "hisTimetable";
  // 특수/각종은 주로 his/mls 중 하나로 운영되나, 우선 his로 시도 후 실패시 mls/els로 폴백 가능
  return "hisTimetable";
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
      type: s.SCHUL_KND_SC_NM || "", // 초/중/고/특수/각종...
      gender: s.COEDU_SC_NM || ""    // 남/여/남여공학
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
    const { schoolCode, officeCode, grade, classNo, level } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);

    const today = new Date().toISOString().slice(0,10).replace(/-/g,"");
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
      subject: t.ITRT_CNTNT || "",
      teacher: t.TEACHER_NM || ""
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
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.status(400).json([]);

    const sd = String(startDate).replace(/-/g,"");
    const sdIso = `${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`;
    const endObj = new Date(sdIso);
    endObj.setDate(endObj.getDate() + 4); // 5일 범위
    const ed = endObj.toISOString().slice(0,10).replace(/-/g,"");

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
      subject: t.ITRT_CNTNT || "",
      teacher: t.TEACHER_NM || ""
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
    const d = date ? String(date).replace(/-/g,"") : new Date().toISOString().slice(0,10).replace(/-/g,"");
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json`
      + `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}`
      + `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`
      + `&MLSV_YMD=${d}`;

    const j = await getCached(url);
    const row = j?.mealServiceDietInfo?.[1]?.row?.[0];
    const menu = row?.DDISH_NM || "";
    res.json({ menu });
  } catch (err) {
    console.error("dailyMeal error:", err.message || err);
    res.status(500).json({ menu: "" });
  }
});

// --------- 월간 급식 ---------
app.get("/api/monthlyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, startDate, endDate } = req.query;
    if (!schoolCode || !officeCode || !startDate || !endDate) return res.status(400).json([]);

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json`
      + `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}`
      + `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`
      + `&MLSV_FROM_YMD=${encodeURIComponent(startDate)}&MLSV_TO_YMD=${encodeURIComponent(endDate)}`;

    const j = await getCached(url);
    const rows = j?.mealServiceDietInfo?.[1]?.row;
    if (!Array.isArray(rows)) return res.json([]);

    const result = rows.map(m => ({
      date: m.MLSV_YMD,
      menu: m.DDISH_NM || ""
    }));
    res.json(result);
  } catch (err) {
    console.error("monthlyMeal error:", err.message || err);
    res.status(500).json([]);
  }
});

// --------- SPA fallback ---------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------- start ---------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
