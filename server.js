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
  console.error("ERROR: API_KEY is required in .env");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- cache + retry helpers ----
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

async function fetchWithRetry(url, retries = 3, baseDelay = 400) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
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
  const e = cache.get(url);
  if (e && e.expiry > now) return e.data;
  const data = await fetchWithRetry(url);
  cache.set(url, { data, expiry: now + CACHE_TTL });
  return data;
}

// ---- helpers for timetable endpoints ----
function timetableEndpointBySchoolType(typeText = "") {
  const t = String(typeText || "").toLowerCase();
  if (t.includes("중")) return "misTimetable";
  if (t.includes("고")) return "hisTimetable";
  return "elsTimetable"; // default 초등
}

function toYMD(d = new Date()) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function padClassNo(classNo) {
  const s = String(classNo || "");
  // If already 2-digit, leave; else pad to 2
  return s.padStart(2, "0");
}

// ---- health ----
app.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
app.get("/healthcheck", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<h1>Server OK</h1><p>${new Date().toLocaleString()}</p>`);
});

// ---- /api/searchSchool ----
app.get("/api/searchSchool", async (req, res) => {
  try {
    const name = (req.query.name || "").trim();
    if (!name) return res.status(400).json({ error: "name query required" });
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const j = await getCached(url);
    const rows = j?.schoolInfo?.[1]?.row || [];
    const mapped = rows.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      schoolType: s.SCHUL_KND_SC_NM || "" // e.g. "초등학교", "중학교", "고등학교"
    }));
    res.json(mapped);
  } catch (err) {
    console.error("searchSchool error:", err);
    res.status(500).json({ error: "school search failed" });
  }
});

// ---- /api/dailyTimetable ----
// returns { list: [{date, period, subject, teacher}], count, maxPeriod, message? }
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, schoolType } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !schoolType) {
      return res.status(400).json({ list: [], count: 0, maxPeriod: 0, message: "missing params" });
    }

    const endpoint = timetableEndpointBySchoolType(schoolType);
    const today = toYMD(new Date());
    const classParam = padClassNo(classNo);

    const url = `https://open.neis.go.kr/hub/${endpoint}?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(String(grade))}&CLASS_NM=${encodeURIComponent(classParam)}&TI_FROM_YMD=${today}&TI_TO_YMD=${today}`;
    const j = await getCached(url);
    const rows = j?.[endpoint]?.[1]?.row || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ list: [], count: 0, maxPeriod: 0, message: "오늘 시간표 정보가 없습니다 (주말/방학/휴무일 등)" });
    }

    const list = rows.map(r => ({
      date: r.ALL_TI_YMD || r.TI_YMD || today,
      period: r.PERIO || r.PERIOD || "",
      subject: r.ITRT_CNTNT || "",
      teacher: r.TEACHER_NM || ""
    }));

    const numericPeriods = list.map(x => parseInt(String(x.period).replace(/\D/g, ""), 10)).filter(n => !Number.isNaN(n));
    const maxPeriod = numericPeriods.length ? Math.max(...numericPeriods) : list.length;
    res.json({ list, count: list.length, maxPeriod });
  } catch (err) {
    console.error("dailyTimetable error:", err);
    res.status(500).json({ list: [], count: 0, maxPeriod: 0, message: "server error" });
  }
});

// ---- /api/weeklyTimetable ----
// params: schoolCode, officeCode, grade, classNo, startDate(YYYY-MM-DD), schoolType
// returns array of { date, period, subject, teacher } (up to 5 days)
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    let { schoolCode, officeCode, grade, classNo, startDate, schoolType } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate || !schoolType) {
      return res.status(400).json({ error: "missing params" });
    }

    const endpoint = timetableEndpointBySchoolType(schoolType);
    const classParam = padClassNo(classNo);

    // normalize startDate (YYYY-MM-DD or YYYYMMDD)
    const sd = String(startDate).includes("-") ? String(startDate).replace(/-/g, "") : String(startDate);
    const startIso = `${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`;
    // move to Monday of that week
    const startObj = new Date(startIso);
    const day = startObj.getDay(); // 0 Sun .. 6 Sat
    const diff = (day === 0) ? -6 : (1 - day); // if Sunday go to previous Monday, else shift to Monday
    startObj.setDate(startObj.getDate() + diff);
    const fromYMD = toYMD(startObj);

    // to Friday
    const endObj = new Date(startObj);
    endObj.setDate(endObj.getDate() + 4);
    const toYMD = toYMD(endObj);

    const url = `https://open.neis.go.kr/hub/${endpoint}?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(String(grade))}&CLASS_NM=${encodeURIComponent(classParam)}&TI_FROM_YMD=${fromYMD}&TI_TO_YMD=${toYMD}`;
    const j = await getCached(url);
    const rows = j?.[endpoint]?.[1]?.row || [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.json({ message: "주간 시간표 정보가 없습니다 (방학/휴일 가능성)", data: [] });
    }

    const data = rows.map(r => ({
      date: r.ALL_TI_YMD || r.TI_YMD || "",
      period: r.PERIO || "",
      subject: r.ITRT_CNTNT || "",
      teacher: r.TEACHER_NM || ""
    }));

    // sort by date then period numeric
    data.sort((a,b) => (a.date === b.date ? (Number(a.period) - Number(b.period)) : a.date.localeCompare(b.date)));

    res.json({ data });
  } catch (err) {
    console.error("weeklyTimetable error:", err);
    res.status(500).json({ error: "server error" });
  }
});

// ---- /api/dailyMeal (today + 1 month list) ----
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode } = req.query;
    if (!schoolCode || !officeCode) return res.status(400).json({ today: { menu: "급식 정보 없음" }, month: [] });

    const today = new Date();
    const from = toYMD(today);
    const next = new Date(today);
    next.setMonth(next.getMonth() + 1);
    const to = toYMD(next);

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_FROM_YMD=${from}&MLSV_TO_YMD=${to}`;
    const j = await getCached(url);
    const rows = j?.mealServiceDietInfo?.[1]?.row || [];

    const month = rows.map(r => ({
      date: r.MLSV_YMD,
      menu: String(r.DDISH_NM || "").replace(/<br\s*\/?>/gi, ", ")
    }));

    const todayMeal = month.find(m => m.date === from) || { date: from, menu: "급식 정보 없음" };
    res.json({ today: todayMeal, month });
  } catch (err) {
    console.error("dailyMeal error:", err);
    res.status(500).json({ today: { menu: "급식 정보 없음" }, month: [] });
  }
});

// ---- SPA fallback ----
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
