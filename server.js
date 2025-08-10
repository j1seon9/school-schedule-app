import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SCHOOL_API_KEY;

// 학교 검색
app.get("/api/searchSchool", async (req, res) => {
  const name = req.query.name;
  const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!json.schoolInfo) return res.json([]);

  const list = json.schoolInfo[1].row.map(s => ({
    name: s.SCHUL_NM,
    schoolCode: s.SD_SCHUL_CODE,
    officeCode: s.ATPT_OFCDC_SC_CODE
  }));
  res.json(list);
});

// 오늘 시간표
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const url = `https://open.neis.go.kr/hub/elsTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&ALL_TI_YMD=${today}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!json.elsTimetable) return res.json([]);
  const list = json.elsTimetable[1].row.map(t => ({
    period: t.PERIO,
    subject: t.ITRT_CNTNT
  }));
  res.json(list);
});

// 주간 시간표
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  const endDate = new Date(new Date(startDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")).getTime() + 4 * 86400000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const url = `https://open.neis.go.kr/hub/elsTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&TI_FROM_YMD=${startDate}&TI_TO_YMD=${endDate}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!json.elsTimetable) return res.json([]);
  const list = json.elsTimetable[1].row.map(t => ({
    date: t.ALL_TI_YMD,
    period: t.PERIO,
    subject: t.ITRT_CNTNT
  }));
  res.json(list);
});

// 오늘 급식
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode } = req.query;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${today}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!json.mealServiceDietInfo) return res.json({ menu: "" });
  const menu = json.mealServiceDietInfo[1].row[0].DDISH_NM;
  res.json({ menu });
});

// 월간 급식
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;

  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!json.mealServiceDietInfo) return res.json([]);
  const list = json.mealServiceDietInfo[1].row.map(m => ({
    date: m.MLSV_YMD,
    menu: m.DDISH_NM
  }));
  res.json(list);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
