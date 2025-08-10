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

// --- simple in-memory cache ---
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
      // exponential backoff (500ms, 1000ms, 2000ms, ...)
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

// Health check
app.get("/health", (req, res) => res.status(200).send("OK"));

// -----------------
// 학교 검색
// -----------------
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
      officeCode: s.ATPT_OFCDC_SC_CODE
    }));
    res.json(rows);
  } catch (err) {
    console.error("searchSchool error:", err.message || err);
    res.status(500).json({ error: "school search failed" });
  }
});

// -----------------
// 일간 시간표 (ELS)
// /api/dailyTimetable?schoolCode=&officeCode=&grade=&classNo=
// -----------------
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const url = `https://open.neis.go.kr/hub/elsTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(grade)}&CLASS_NM=${encodeURIComponent(classNo)}&ALL_TI_YMD=${today}`;
    const j = await getCached(url);
    if (!j.elsTimetable || !j.elsTimetable[1]) return res.json([]);
    const rows = j.elsTimetable[1].row.map(t => ({
      period: t.PERIO || t.PERIOD || "",
      subject: t.ITRT_CNTNT || ""
    }));
    res.json(rows);
  } catch (err) {
    console.error("dailyTimetable error:", err.message || err);
    res.status(500).json([]);
  }
});

// -----------------
// 주간 시간표 (startDate YYYYMMDD, returns up to 5 days)
// /api/weeklyTimetable?schoolCode=&officeCode=&grade=&classNo=&startDate=YYYYMMDD
// -----------------
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.status(400).json([]);

    const sd = String(startDate).replace(/-/g, "");
    const sdIso = `${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`;
    const endObj = new Date(sdIso);
    endObj.setDate(endObj.getDate() + 4);
    const ed = endObj.toISOString().slice(0,10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/elsTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(grade)}&CLASS_NM=${encodeURIComponent(classNo)}&TI_FROM_YMD=${sd}&TI_TO_YMD=${ed}`;
    const j = await getCached(url);
    if (!j.elsTimetable || !j.elsTimetable[1]) return res.json([]);
    const rows = j.elsTimetable[1].row.map(t => ({
      date: t.ALL_TI_YMD || t.TI_YMD || "",
      period: t.PERIO || "",
      subject: t.ITRT_CNTNT || ""
    }));
    res.json(rows);
  } catch (err) {
    console.error("weeklyTimetable error:", err.message || err);
    res.status(500).json([]);
  }
});

// -----------------
// 오늘 급식 (optional date YYYYMMDD)
// /api/dailyMeal?schoolCode=&officeCode=&date=YYYYMMDD
// -----------------
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, date } = req.query;
    if (!schoolCode || !officeCode) return res.status(400).json({ menu: "" });
    const d = date ? String(date).replace(/-/g, "") : new Date().toISOString().slice(0,10).replace(/-/g, "");
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_YMD=${d}`;
    const j = await getCached(url);
    if (!j.mealServiceDietInfo || !j.mealServiceDietInfo[1]) return res.json({ menu: "" });
    const m = j.mealServiceDietInfo[1].row[0].DDISH_NM || "";
    res.json({ menu: m });
  } catch (err) {
    console.error("dailyMeal error:", err.message || err);
    res.status(500).json({ menu: "" });
  }
});

// -----------------
// 월간 급식
// /api/monthlyMeal?schoolCode=&officeCode=&startDate=YYYYMMDD&endDate=YYYYMMDD
// -----------------
app.get("/api/monthlyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, startDate, endDate } = req.query;
    if (!schoolCode || !officeCode || !startDate || !endDate) return res.status(400).json([]);
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const j = await getCached(url);
    if (!j.mealServiceDietInfo || !j.mealServiceDietInfo[1]) return res.json([]);
    const rows = j.mealServiceDietInfo[1].row.map(m => ({
      date: m.MLSV_YMD,
      menu: m.DDISH_NM || ""
    }));
    res.json(rows);
  } catch (err) {
    console.error("monthlyMeal error:", err.message || err);
    res.status(500).json([]);
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
