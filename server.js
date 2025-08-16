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
  console.error("ERROR: API_KEY is required in .env");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BASE = "https://open.neis.go.kr/hub";

/** Helper: normalize school kind text to priority list of timetable endpoints */
function endpointsForKind(kindText = "") {
  const k = String(kindText || "").toLowerCase();
  if (k.includes("특성")) return ["hisTimetable", "misTimetable", "elsTimetable"];
  if (k.includes("특수")) return ["misTimetable", "elsTimetable", "hisTimetable"];
  if (k.includes("고")) return ["hisTimetable", "misTimetable", "elsTimetable"];
  if (k.includes("중")) return ["misTimetable", "elsTimetable", "hisTimetable"];
  if (k.includes("초")) return ["elsTimetable", "misTimetable", "hisTimetable"];
  return ["elsTimetable", "misTimetable", "hisTimetable"]; // fallback
}

function ymdFromDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Fetch NEIS data with retries */
async function fetchJson(url, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return j;
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ------------------ Endpoints ------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 1) Search School
app.get("/api/searchSchool", async (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) return res.status(400).json([]);
  try {
    const url = `${BASE}/schoolInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=50&SCHUL_NM=${encodeURIComponent(name)}`;
    const j = await fetchJson(url);
    const rows = j?.schoolInfo?.[1]?.row || [];
    const list = rows.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      address: s.ORG_RDNMA || "",
      typeName: s.SCHUL_KND_SC_NM || ""
    }));
    res.json(list);
  } catch (e) {
    console.error("searchSchool error:", e);
    res.status(500).json([]);
  }
});

async function tryTimetableEndpoints(endpoints, params) {
  for (const ep of endpoints) {
    const url =
      `${BASE}/${ep}?KEY=${API_KEY}&Type=json&pIndex=1&pSize=500` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(params.officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(params.schoolCode)}` +
      (params.fromYmd ? `&TI_FROM_YMD=${params.fromYmd}` : "") +
      (params.toYmd ? `&TI_TO_YMD=${params.toYmd}` : "") +
      (params.dateYmd ? `&ALL_TI_YMD=${params.dateYmd}` : "") +
      (params.grade ? `&GRADE=${encodeURIComponent(params.grade)}` : "") +
      (params.classNo ? `&CLASS_NM=${encodeURIComponent(params.classNo)}` : "");
    try {
      const j = await fetchJson(url);
      const rows = j?.[ep]?.[1]?.row || [];
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(r => ({
          date: r.ALL_TI_YMD || r.TI_YMD || params.dateYmd || "",
          period: r.PERIO || r.PERIOD || "",
          subject: r.ITRT_CNTNT || r.SUBJECT || "",
          teacher: r.TEACHER_NM || r.DUTY_TM || ""
        }));
      }
    } catch (err) {
      console.warn(`tryTimetableEndpoints: ${ep} failed`, err.message || err);
      continue;
    }
  }
  return [];
}

// 2) Daily timetable
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, typeName } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);
    const endpoints = endpointsForKind(typeName || "");
    const dateYmd = ymdFromDate(new Date());
    const rows = await tryTimetableEndpoints(endpoints, { officeCode, schoolCode, grade, classNo, dateYmd });
    rows.sort((a,b) => (Number(a.period) || 0) - (Number(b.period) || 0));
    res.json(rows);
  } catch (e) {
    console.error("dailyTimetable error:", e);
    res.status(500).json([]);
  }
});

// 3) Weekly timetable
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate, typeName } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.status(400).json([]);
    const sd = new Date(startDate);
    const from = sd;
    const to = new Date(sd);
    to.setDate(to.getDate() + 4);
    const fromYmd = ymdFromDate(from);
    const toYmd = ymdFromDate(to);
    const endpoints = endpointsForKind(typeName || "");
    const rows = await tryTimetableEndpoints(endpoints, { officeCode, schoolCode, grade, classNo, fromYmd, toYmd });
    rows.sort((a,b) => (a.date === b.date ? (Number(a.period)||0)-(Number(b.period)||0) : a.date.localeCompare(b.date)));
    res.json(rows);
  } catch (e) {
    console.error("weeklyTimetable error:", e);
    res.status(500).json([]);
  }
});

// 4) Daily meal
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode } = req.query;
    if (!schoolCode || !officeCode) return res.status(400).json({ menu: "" });
    const date = ymdFromDate(new Date());
    const url = `${BASE}/mealServiceDietInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=10&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_YMD=${date}`;
    const j = await fetchJson(url);
    const row = j?.mealServiceDietInfo?.[1]?.row?.[0] || null;
    const menuRaw = row?.DDISH_NM || "";
    res.json({ date, menu: menuRaw });
  } catch (e) {
    console.error("dailyMeal error:", e);
    res.status(500).json({ menu: "" });
  }
});

// 5) Monthly meal
app.get("/api/monthlyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, month } = req.query;
    if (!schoolCode || !officeCode || !month) return res.status(400).json([]);
    const [yStr, mStr] = (month || "").split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!y || !m) return res.status(400).json([]);
    const first = `${y}${String(m).padStart(2,"0")}01`;
    const lastDay = new Date(y, m, 0).getDate();
    const last = `${y}${String(m).padStart(2,"0")}${String(lastDay).padStart(2,"0")}`;
    const url = `${BASE}/mealServiceDietInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=500&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_FROM_YMD=${first}&MLSV_TO_YMD=${last}`;
    const j = await fetchJson(url);
    const rows = j?.mealServiceDietInfo?.[1]?.row || [];
    const list = rows.map(r => ({ date: r.MLSV_YMD, menu: r.DDISH_NM || "" }));
    res.json(list);
  } catch (e) {
    console.error("monthlyMeal error:", e);
    res.status(500).json([]);
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
