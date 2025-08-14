// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error("ERROR: API_KEY is required in environment variables.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// -----------------------------
// KST 날짜 유틸
// -----------------------------
function nowKST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 3600000);
}
function ymd(dateObj) {
  return dateObj.toISOString().slice(0, 10).replace(/-/g, "");
}
function iso(dateObj) {
  return dateObj.toISOString().slice(0, 10);
}

// -----------------------------
// In-memory cache + retry
// -----------------------------
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

async function fetchWithRetry(url, retries = 3, baseDelay = 500) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = await res.json();
      return json;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        const delay = baseDelay * (2 ** i);
        await new Promise(r => setTimeout(r, delay));
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
  cache.set(url, { data, expiry: now + CACHE_TTL });
  return data;
}

// -----------------------------
// Helper: 학교급 엔드포인트 매핑
// -----------------------------
function getTimetableEndpointBySchoolType(typeText = "") {
  const clean = String(typeText).replace(/\s+/g, "");
  if (clean.includes("중")) return "misTimetable";
  if (clean.includes("고")) return "hisTimetable";
  // 기본을 초등으로
  return "elsTimetable";
}

// -----------------------------
// Health
// -----------------------------
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});
app.get("/healthz", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!doctype html>
    <html lang="ko"><head><meta charset="utf-8" />
    <title>Health Check</title>
    <style>
      body{font-family:system-ui,Segoe UI,Roboto,Apple SD Gothic Neo,Noto Sans KR,Arial;padding:24px}
      .ok{color:#0a7a0a}
      .card{padding:16px;border:1px solid #eee;border-radius:10px;max-width:600px}
      code{background:#f7f7f7;padding:2px 6px;border-radius:6px}
    </style></head>
    <body>
      <h1>서버 상태: <span class="ok">OK</span></h1>
      <div class="card">
        <p>현재시간(UTC): <code>${new Date().toISOString()}</code></p>
        <p>API_KEY 설정: <code>${API_KEY ? "YES" : "NO"}</code></p>
        <p>정적파일 경로: <code>/public</code></p>
      </div>
    </body></html>
  `);
});

// -----------------------------
// 학교 검색
// -----------------------------
app.get("/api/searchSchool", async (req, res) => {
  try {
    const name = (req.query.name || "").trim();
    if (!name) return res.status(400).json({ error: "name query required" });

    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const j = await getCached(url);

    if (!j.schoolInfo || !j.schoolInfo[1] || !Array.isArray(j.schoolInfo[1].row)) {
      return res.json([]);
    }

    const rows = j.schoolInfo[1].row.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      schoolType: s.SCHUL_KND_SC_NM || "" // 초등학교/중학교/고등학교
    }));

    res.json(rows);
  } catch (err) {
    console.error("searchSchool error:", err.message || err);
    res.status(500).json({ error: "school search failed" });
  }
});

// -----------------------------
// 일간 시간표 (하루 묶음)
// -----------------------------
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, schoolType, date } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !schoolType) {
      return res.status(400).json([]);
    }
    const classParam = String(classNo).padStart(2, "0");
    const timetableType = getTimetableEndpointBySchoolType(schoolType);

    const base = date ? new Date(date) : nowKST();
    const day = ymd(base);

    const url =
      `https://open.neis.go.kr/hub/${timetableType}` +
      `?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}` +
      `&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classParam}` +
      `&TI_FROM_YMD=${day}&TI_TO_YMD=${day}`;

    const j = await getCached(url);
    if (!j[timetableType] || !j[timetableType][1]) return res.json([]);

    const row = j[timetableType][1].row
      .map(t => ({
        period: t.PERIO || "",
        subject: t.ITRT_CNTNT || "",
        teacher: t.TEACHER_NM || ""
      }))
      .sort((a, b) => Number(a.period) - Number(b.period));

    const result = row.length
      ? [{ date: day, lessons: row }]
      : [];

    res.json(result);
  } catch (err) {
    console.error("dailyTimetable error:", err.message || err);
    res.status(500).json([]);
  }
});

// -----------------------------
// 주간 시간표 (하루 단위 그룹)
// -----------------------------
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate, schoolType } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate || !schoolType) {
      return res.status(400).json([]);
    }
    const classParam = String(classNo).padStart(2, "0");
    const timetableType = getTimetableEndpointBySchoolType(schoolType);

    // 시작일을 기준 주의 월요일로 보정
    const s = new Date(startDate);
    const day = s.getDay();
    const diff = day === 0 ? -6 : 1 - day; // 일요일=0 → -6, 월=1 → 0
    s.setDate(s.getDate() + diff);
    const from = ymd(s);
    const e = new Date(s);
    e.setDate(e.getDate() + 4);
    const to = ymd(e);

    const url =
      `https://open.neis.go.kr/hub/${timetableType}` +
      `?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}` +
      `&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classParam}` +
      `&TI_FROM_YMD=${from}&TI_TO_YMD=${to}`;

    const j = await getCached(url);
    if (!j[timetableType] || !j[timetableType][1]) return res.json([]);

    // 날짜별 그룹화
    const grouped = {};
    j[timetableType][1].row.forEach(t => {
      const d = t.ALL_TI_YMD || t.TI_YMD || "";
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push({
        period: t.PERIO || "",
        subject: t.ITRT_CNTNT || "",
        teacher: t.TEACHER_NM || ""
      });
    });

    // 날짜 오름차순 + 교시 오름차순
    const result = Object.keys(grouped).sort().map(date => ({
      date,
      lessons: grouped[date]
        .sort((a, b) => Number(a.period) - Number(b.period))
    }));

    res.json(result);
  } catch (err) {
    console.error("weeklyTimetable error:", err.message || err);
    res.status(500).json([]);
  }
});

// -----------------------------
// 오늘 급식(옵션: date=YYYY-MM-DD) / 월간 급식(ref=YYYY-MM-DD)
// -----------------------------
function cleanMenu(text = "") {
  // DDISH_NM은 <br/> 로 줄바꿈. 보기 좋게 \n 로 치환
  return String(text).replace(/<br\s*\/?>/gi, "\n");
}

// 오늘 급식
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, date } = req.query;
    if (!schoolCode || !officeCode) return res.status(400).json({ menu: "" });

    const base = date ? new Date(date) : nowKST();
    const d = ymd(base);

    const url =
      `https://open.neis.go.kr/hub/mealServiceDietInfo` +
      `?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}` +
      `&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${d}`;

    const j = await getCached(url);
    if (!j.mealServiceDietInfo || !j.mealServiceDietInfo[1]) {
      return res.json({ menu: "" });
    }
    const m = j.mealServiceDietInfo[1].row?.[0]?.DDISH_NM || "";
    res.json({ menu: cleanMenu(m) });
  } catch (err) {
    console.error("dailyMeal error:", err.message || err);
    res.status(500).json({ menu: "" });
  }
});

// 월간 급식 (조회일 기준 ref=YYYY-MM-DD, 없으면 오늘 기준)
app.get("/api/monthlyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, ref } = req.query;
    if (!schoolCode || !officeCode) return res.status(400).json([]);

    const base = ref ? new Date(ref) : nowKST();
    const year = base.getFullYear();
    const month = base.getMonth(); // 0-based
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    const from = ymd(first);
    const to = ymd(last);

    const url =
      `https://open.neis.go.kr/hub/mealServiceDietInfo` +
      `?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}` +
      `&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${from}&MLSV_TO_YMD=${to}`;

    const j = await getCached(url);
    if (!j.mealServiceDietInfo || !j.mealServiceDietInfo[1]) return res.json([]);

    const rows = j.mealServiceDietInfo[1].row.map(m => ({
      date: m.MLSV_YMD,
      menu: cleanMenu(m.DDISH_NM || "")
    }));

    res.json(rows);
  } catch (err) {
    console.error("monthlyMeal error:", err.message || err);
    res.status(500).json([]);
  }
});

// -----------------------------
// SPA fallback
// -----------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
