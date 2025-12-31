import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(express.static("public"));

const API_KEY = process.env.API_KEY;
const BASE = "https://open.neis.go.kr/hub";

// ===== 학교 검색 =====
app.get("/api/searchSchool", async (req, res) => {
  const { name } = req.query;
  try {
    const url = `${BASE}/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.schoolInfo?.[1]?.row || [];

    res.json(rows.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      type: s.SCHUL_KND_SC_NM,
      officeName: s.ATPT_OFCDC_SC_NM
    })));
  } catch {
    res.status(500).json([]);
  }
});

// ===== 오늘 시간표 =====
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  const today = new Date().toISOString().slice(0,10).replace(/-/g,"");

  const url = `${BASE}/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&ALL_TI_YMD=${today}`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.hisTimetable?.[1]?.row || [];
    res.json(rows.map(i => ({
      period: i.PERIO,
      subject: i.ITRT_CNTNT
    })));
  } catch {
    res.json([]);
  }
});

// ===== 주간 시간표 =====
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;

  const url = `${BASE}/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&TI_FROM_YMD=${startDate}&TI_TO_YMD=${startDate}`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.hisTimetable?.[1]?.row || [];
    res.json(rows.map(i => ({
      date: i.ALL_TI_YMD,
      period: i.PERIO,
      subject: i.ITRT_CNTNT
    })));
  } catch {
    res.json([]);
  }
});

// ===== 일간 급식 =====
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode } = req.query;
  const today = new Date().toISOString().slice(0,10).replace(/-/g,"");

  const url = `${BASE}/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${today}`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    const row = j?.mealServiceDietInfo?.[1]?.row?.[0];
    res.json({ menu: row?.DDISH_NM || null });
  } catch {
    res.json({ menu: null });
  }
});

// ===== 월간 급식 =====
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;

  const url = `${BASE}/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.mealServiceDietInfo?.[1]?.row || [];
    res.json(rows.map(i => ({
      date: i.MLSV_YMD,
      menu: i.DDISH_NM
    })));
  } catch {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
