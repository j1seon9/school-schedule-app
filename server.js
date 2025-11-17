// server.js
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

// --------- simple in-memory cache & utils ---------
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

// KST helpers
function todayKSTString() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000));
  return kst.toISOString().slice(0, 10).replace(/-/g, "");
}
function isoDateToYYYYMMDD(date) {
  return String(date).slice(0,10).replace(/-/g,"");
}

// Map school kind to timetable endpoint name used by NEIS
function mapKindToDataset(kindName = "") {
  // NEIS docs: 초등: elsTimetable, 중: misTimetable, 고: hisTimetable
  const k = (kindName || "").toLowerCase();
  if (k.includes("초")) return "elsTimetable";
  if (k.includes("중")) return "misTimetable";
  if (k.includes("고")) return "hisTimetable";
  // fallback to els
  return "elsTimetable";
}

async function resolveDatasetBySchoolCode(schoolCode) {
  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=100&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`;
    const j = await getCached(url);
    const kind = j?.schoolInfo?.[1]?.row?.[0]?.SCHUL_KND_SC_NM || "";
    return mapKindToDataset(kind);
  } catch (e) {
    console.warn("resolveDatasetBySchoolCode failed, defaulting to elsTimetable", e?.message || e);
    return "elsTimetable";
  }
}

// --------- health ---------
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// --------- 학교 검색 (NEIS schoolInfo) ---------
// /api/searchSchool?name=학교명
app.get("/api/searchSchool", async (req, res) => {
  try {
    const name = (req.query.name || "").trim();
    if (!name) return res.status(400).json([]);
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=100&SCHUL_NM=${encodeURIComponent(name)}`;
    const j = await getCached(url);
    const rows = j?.schoolInfo?.[1]?.row;
    if (!Array.isArray(rows)) return res.json([]);
    const result = rows.map(s => ({
      name: s.SCHUL_NM || "",
      schoolCode: s.SD_SCHUL_CODE || "",
      officeCode: s.ATPT_OFCDC_SC_CODE || "",
      type: s.SCHUL_KND_SC_NM || "",
      gender: s.COEDU_SC_NM || ""
    }));
    res.json(result);
  } catch (err) {
    console.error("searchSchool error:", err?.message || err);
    res.status(500).json([]);
  }
});

// --------- 일간 시간표 ---------
// /api/dailyTimetable?schoolCode=&officeCode=&grade=&classNo=&date=YYYYMMDD
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, level, date } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);

    const target = date ? String(date).replace(/-/g,"") : todayKSTString();
    const dataset = level || await resolveDatasetBySchoolCode(schoolCode);

    // build url with pSize
    const url = `https://open.neis.go.kr/hub/${dataset}?KEY=${API_KEY}&Type=json&pIndex=1&pSize=100`
      + `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}`
      + `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`
      + `&ALL_TI_YMD=${encodeURIComponent(target)}`
      + `&GRADE=${encodeURIComponent(grade)}`
      + `&CLASS_NM=${encodeURIComponent(classNo)}`;

    const j = await getCached(url);
    const rows = j?.[dataset]?.[1]?.row;
    if (!Array.isArray(rows)) return res.json([]);

    // map fields defensively
    const result = rows.map(t => ({
      date: t.ALL_TI_YMD || t.TI_YMD || target,
      period: t.PERIO || t.PERIOD || t.PERIOD_NO || "",
      subject: t.ITRT_CNTNT || t.SUBJECT || "",
      teacher: t.TCHR_NM || t.TEACHER_NM || t.TEACHER || ""
    }));
    res.json(result);
  } catch (err) {
    console.error("dailyTimetable error:", err?.message || err);
    res.status(500).json([]);
  }
});

// --------- 주간 시간표 (TI_FROM_YMD ~ TI_TO_YMD, returns rows across days) ---------
// /api/weeklyTimetable?schoolCode=&officeCode=&grade=&classNo=&startDate=YYYYMMDD
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate, level } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.status(400).json([]);

    // startDate expected as YYYYMMDD; we'll compute end date (start + 4 days)
    const sd = String(startDate).replace(/-/g,"");
    const sdIso = `${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`;
    const startObj = new Date(sdIso);
    const endObj = new Date(startObj);
    endObj.setDate(endObj.getDate() + 4); // 5-day window
    const ed = isoDateToYYYYMMDD(endObj.toISOString());

    const dataset = level || await resolveDatasetBySchoolCode(schoolCode);

    const url = `https://open.neis.go.kr/hub/${dataset}?KEY=${API_KEY}&Type=json&pIndex=1&pSize=200`
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
      period: t.PERIO || t.PERIOD || "",
      subject: t.ITRT_CNTNT || t.SUBJECT || "",
      teacher: t.TCHR_NM || t.TEACHER_NM || ""
    }));
    res.json(result);
  } catch (err) {
    console.error("weeklyTimetable error:", err?.message || err);
    res.status(500).json([]);
  }
});

// --------- 오늘 급식(또는 특정일) ---------
// /api/dailyMeal?schoolCode=&officeCode=&date=YYYYMMDD
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, date } = req.query;
    if (!schoolCode || !officeCode) return res.status(400).json({ menu: "" });
    const d = date ? String(date).replace(/-/g,"") : todayKSTString();

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=100`
      + `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}`
      + `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`
      + `&MLSV_YMD=${encodeURIComponent(d)}`;

    const j = await getCached(url);
    const row = j?.mealServiceDietInfo?.[1]?.row?.[0];
    if (!row) return res.json({ menu: "" });
    const menu = row.DDISH_NM || "";
    res.json({ menu, date: row.MLSV_YMD || d });
  } catch (err) {
    console.error("dailyMeal error:", err?.message || err);
    res.status(500).json({ menu: "" });
  }
});

// --------- 월간 급식 (startDate, endDate are YYYYMMDD) ---------
// /api/monthlyMeal?schoolCode=&officeCode=&startDate=YYYYMMDD&endDate=YYYYMMDD
app.get("/api/monthlyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, startDate, endDate } = req.query;
    if (!schoolCode || !officeCode || !startDate || !endDate) return res.status(400).json([]);

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=500`
      + `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}`
      + `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}`
      + `&MLSV_FROM_YMD=${encodeURIComponent(startDate)}&MLSV_TO_YMD=${encodeURIComponent(endDate)}`;

    const j = await getCached(url);
    const rows = j?.mealServiceDietInfo?.[1]?.row;
    if (!Array.isArray(rows)) return res.json([]);
    const result = rows.map(r => ({
      date: r.MLSV_YMD,
      menu: r.DDISH_NM || "",
      mealCode: r.MMEAL_SC_CODE || "",
      kcal: r.CAL_INFO || ""
    }));
    res.json(result);
  } catch (err) {
    console.error("monthlyMeal error:", err?.message || err);
    res.status(500).json([]);
  }
});

// --------- SPA fallback ---------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --------- start server ---------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
