// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
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

// utils
function endpointByType(type) {
  // 'ELS' | 'MIS' | 'HIS'
  switch (type) {
    case "ELS": return "elsTimetable";
    case "MIS": return "misTimetable";
    case "HIS": return "hisTimetable";
    default: return "hisTimetable";
  }
}
function mapSchoolType(knd) {
  // SCHUL_KND_SC_NM: '초등학교', '중학교', '고등학교'
  if (/초/.test(knd)) return "ELS";
  if (/중/.test(knd)) return "MIS";
  if (/고/.test(knd)) return "HIS";
  return "HIS";
}
function ymd(d) {
  return d.toISOString().slice(0,10).replace(/-/g, "");
}

// Health check (JSON)
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Health check (HTML)
app.get("/healthz", (req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<html><body><h1>OK</h1><p>${new Date().toISOString()}</p></body></html>`);
});

// 1) 학교 검색
// GET /api/searchSchool?name=서울고
app.get("/api/searchSchool", async (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) return res.json([]);
  try {
    const url = `${BASE}/schoolInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=50&SCHUL_NM=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.schoolInfo?.[1]?.row || [];
    const list = rows.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      address: s.ORG_RDNMA || "",
      typeName: s.SCHUL_KND_SC_NM || "",
      schoolType: mapSchoolType(s.SCHUL_KND_SC_NM || "")
    }));
    res.json(list);
  } catch (e) {
    console.error("searchSchool error:", e);
    res.status(500).json([]);
  }
});

// 2) 일간 시간표 (상단)
// GET /api/dailyTimetable?schoolCode=&officeCode=&schoolType=ELS|MIS|HIS&grade=&classNo=
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, schoolType } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.json([]);
    const ep = endpointByType(schoolType);
    const today = ymd(new Date());
    const url = `${BASE}/${ep}?KEY=${API_KEY}&Type=json&pIndex=1&pSize=100` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&ALL_TI_YMD=${today}` +
      `&GRADE=${encodeURIComponent(grade)}` +
      `&CLASS_NM=${encodeURIComponent(classNo)}`;
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.[ep]?.[1]?.row || [];
    const list = rows.map(x => ({
      date: x.ALL_TI_YMD || x.TI_YMD || "",
      period: x.PERIO || x.PERIOD || "",
      subject: x.ITRT_CNTNT || "",
      teacher: x.TEACHER_NM || ""
    }));
    // 교시 정렬
    list.sort((a,b) => Number(a.period) - Number(b.period));
    res.json(list);
  } catch (e) {
    console.error("dailyTimetable error:", e);
    res.status(500).json([]);
  }
});

// 3) 주간 시간표 (grid로 요일별 묶음)
// GET /api/weeklyTimetable?schoolCode=&officeCode=&schoolType=&grade=&classNo=&startDate=YYYY-MM-DD
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate, schoolType } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.json([]);
    const ep = endpointByType(schoolType);

    const sd = new Date(startDate);
    const ed = new Date(sd);
    ed.setDate(ed.getDate() + 4); // 월~금 5일
    const fromYmd = ymd(sd);
    const toYmd = ymd(ed);

    const url = `${BASE}/${ep}?KEY=${API_KEY}&Type=json&pIndex=1&pSize=500` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&GRADE=${encodeURIComponent(grade)}` +
      `&CLASS_NM=${encodeURIComponent(classNo)}` +
      `&TI_FROM_YMD=${fromYmd}&TI_TO_YMD=${toYmd}`;
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.[ep]?.[1]?.row || [];
    const list = rows.map(x => ({
      date: x.ALL_TI_YMD || x.TI_YMD || "",
      period: x.PERIO || "",
      subject: x.ITRT_CNTNT || "",
      teacher: x.TEACHER_NM || ""
    }));
    // 날짜 → 교시 정렬
    list.sort((a,b) => (a.date === b.date ? Number(a.period) - Number(b.period) : a.date.localeCompare(b.date)));
    res.json(list);
  } catch (e) {
    console.error("weeklyTimetable error:", e);
    res.status(500).json([]);
  }
});

// 4) 일간 급식 (상단)
// GET /api/dailyMeal?schoolCode=&officeCode=
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode } = req.query;
    if (!schoolCode || !officeCode) return res.json({ menu: "" });
    const d = ymd(new Date());
    const url = `${BASE}/mealServiceDietInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=5` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&MLSV_YMD=${d}`;
    const r = await fetch(url);
    const j = await r.json();
    const menu = j?.mealServiceDietInfo?.[1]?.row?.[0]?.DDISH_NM || "";
    res.json({ date: d, menu });
  } catch (e) {
    console.error("dailyMeal error:", e);
    res.status(500).json({ menu: "" });
  }
});

// 5) 월간 급식 (캘린더)
// GET /api/monthlyMeal?schoolCode=&officeCode=&month=YYYY-MM
app.get("/api/monthlyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, month } = req.query;
    if (!schoolCode || !officeCode || !month) return res.json([]);
    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const fromYmd = `${y}${String(m).padStart(2,"0")}01`;
    const toYmd = `${y}${String(m).padStart(2,"0")}${String(end.getDate()).padStart(2,"0")}`;

    const url = `${BASE}/mealServiceDietInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=100` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&MLSV_FROM_YMD=${fromYmd}&MLSV_TO_YMD=${toYmd}`;
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.mealServiceDietInfo?.[1]?.row || [];
    const list = rows.map(x => ({
      date: x.MLSV_YMD,
      menu: x.DDISH_NM || ""
    }));
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

app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
