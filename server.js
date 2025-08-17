// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;
const NEIS_BASE = "https://open.neis.go.kr/hub";

if (!API_KEY) {
  console.error("ERROR: API_KEY is required in environment variables.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// -------- 공통 유틸 --------
async function fetchJson(url, retries = 3, baseDelay = 400) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { timeout: 15000 });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** i));
      }
    }
  }
  throw lastErr;
}
const pad = (n) => String(n).padStart(2, "0");
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};

// -------- 헬스체크 --------
app.get("/healthz", (req, res) => res.status(200).json({ ok: true, t: Date.now() }));
app.get("/health", (req, res) => {
  res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>Health</title></head>
<body style="font-family:system-ui;padding:20px">
  <h1>✅ Server OK</h1>
  <p>Time: ${new Date().toISOString()}</p>
  <ul>
    <li><a href="/healthz">/healthz (JSON)</a></li>
    <li><a href="/">/ (App)</a></li>
  </ul>
</body></html>`);
});

// -------- 학교 검색 --------
app.get("/api/searchSchool", async (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) return res.json([]);

  try {
    const url = `${NEIS_BASE}/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(
      name
    )}`;
    const j = await fetchJson(url);
    const rows = j.schoolInfo?.[1]?.row || [];

    const result = rows.map((r) => ({
      name: r.SCHUL_NM,
      schoolCode: r.SD_SCHUL_CODE,
      officeCode: r.ATPT_OFCDC_SC_CODE,
      typeName: r.SCHUL_KND_SC_NM || "", // 초/중/고/각종(특수/특성화 포함)
      gender: r.COEDU_SC_NM || "", // 남/여/남여공학
      address: r.ORG_RDNMA || "",
    }));
    res.json(result);
  } catch (err) {
    console.error("searchSchool error:", err);
    res.status(500).json([]);
  }
});

// 학교종류→타임테이블 엔드포인트 후보
function endpointsForKind(kindName = "") {
  const k = (kindName || "").trim(); // “초등학교”, “중학교”, “고등학교”, “각종학교(…)” 등
  if (k.includes("초")) return ["elsTimetable", "misTimetable", "hisTimetable", "spsTimetable"];
  if (k.includes("중")) return ["misTimetable", "hisTimetable", "elsTimetable", "spsTimetable"];
  if (k.includes("고")) return ["hisTimetable", "misTimetable", "elsTimetable", "spsTimetable"];
  // 특수/특성화/각종 등은 모두 시도
  return ["hisTimetable", "misTimetable", "elsTimetable", "spsTimetable"];
}

// 실제로 가능한 필드에서 교사명 추출
function pickTeacher(row) {
  return (
    row.TEACHER ||
    row.TCH_NM ||
    row.TM_TN ||
    row.INST_NM ||
    row.TCR_NM ||
    row.TN ||
    ""
  );
}
// 교시/과목 추출
function pickPeriod(row) {
  return row.PERIO || row.PERIOD || row.PER || row.ORD || "";
}
function pickSubject(row) {
  return row.ITRT_CNTNT || row.SUBJECT || row.SJ_NM || row.SJ || "";
}

// 엔드포인트 시도
async function tryTimetableEndpoints({ officeCode, schoolCode, grade, classNo, date, typeName }) {
  const tries = endpointsForKind(typeName);
  for (const ep of tries) {
    const url = `${NEIS_BASE}/${ep}?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(
      officeCode
    )}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(
      grade
    )}&CLASS_NM=${encodeURIComponent(classNo)}&ALL_TI_YMD=${encodeURIComponent(date)}`;
    try {
      const data = await fetchJson(url);
      const arr = data[ep]?.[1]?.row;
      if (Array.isArray(arr) && arr.length) {
        return arr.map((t) => ({
          date: t.ALL_TI_YMD || t.TI_YMD || date,
          period: String(pickPeriod(t)),
          subject: pickSubject(t),
          teacher: pickTeacher(t),
        }));
      }
    } catch (_) {
      // ignore and try next
    }
  }
  return [];
}

// -------- 일간 시간표 --------
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, typeName = "" } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.json([]);

    const d = todayYMD();
    const rows = await tryTimetableEndpoints({
      officeCode,
      schoolCode,
      grade,
      classNo,
      date: d,
      typeName,
    });

    // 교시순 정렬
    rows.sort((a, b) => Number(a.period) - Number(b.period));
    res.json(rows);
  } catch (err) {
    console.error("dailyTimetable error:", err);
    res.status(500).json([]);
  }
});

// -------- 주간 시간표 (월~금) --------
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate, typeName = "" } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.json([]);

    const sd = String(startDate).replace(/-/g, "");
    const base = new Date(`${sd.slice(0, 4)}-${sd.slice(4, 6)}-${sd.slice(6, 8)}`);
    const results = [];

    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const rows = await tryTimetableEndpoints({
        officeCode,
        schoolCode,
        grade,
        classNo,
        date: ymd,
        typeName,
      });
      rows.sort((a, b) => Number(a.period) - Number(b.period));
      results.push(...rows);
    }
    res.json(results);
  } catch (err) {
    console.error("weeklyTimetable error:", err);
    res.status(500).json([]);
  }
});

// -------- 급식 (일간/월간) --------
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, date } = req.query;
    if (!schoolCode || !officeCode) return res.json({ menu: "" });
    const d = (date ? String(date) : todayYMD()).replace(/-/g, "");
    const url = `${NEIS_BASE}/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(
      officeCode
    )}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_YMD=${d}`;
    const j = await fetchJson(url);
    const row = j.mealServiceDietInfo?.[1]?.row?.[0];
    const menu = (row?.DDISH_NM || "").trim();
    res.json({ menu });
  } catch (err) {
    console.error("dailyMeal error:", err);
    res.status(500).json({ menu: "" });
  }
});

app.get("/api/monthlyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, month } = req.query; // "YYYY-MM"
    if (!schoolCode || !officeCode || !month) return res.json([]);

    const [y, m] = month.split("-");
    const first = `${y}${pad(m)}01`;
    const lastDate = new Date(Number(y), Number(m), 0).getDate();
    const last = `${y}${pad(m)}${pad(lastDate)}`;

    const url = `${NEIS_BASE}/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(
      officeCode
    )}&SD_SCHUL_CODE=${encodeURIComponent(
      schoolCode
    )}&MLSV_FROM_YMD=${first}&MLSV_TO_YMD=${last}`;

    const j = await fetchJson(url);
    const arr = j.mealServiceDietInfo?.[1]?.row || [];
    const rows = arr.map((r) => ({
      date: r.MLSV_YMD,
      menu: r.DDISH_NM || "",
    }));
    res.json(rows);
  } catch (err) {
    console.error("monthlyMeal error:", err);
    res.status(500).json([]);
  }
});

// -------- SPA fallback --------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
