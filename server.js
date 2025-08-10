// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("ERROR: API_KEY 환경변수가 설정되어 있지 않습니다.");
  process.exit(1);
}

// __dirname 대체 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 정적 파일 제공
app.use(express.static(path.join(__dirname, "public")));

// --------- 헬스체크(선택) ----------
app.get("/health", (req, res) => res.send("OK"));

// --------------------
// 학교 검색
// --------------------
app.get("/api/searchSchool", async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json([]);

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.schoolInfo || !j.schoolInfo[1]) return res.json([]);

    const rows = j.schoolInfo[1].row.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// --------------------
// 오늘 시간표 (일간)
// --------------------
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);

  try {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    // elsTimetable (초/중/고에 따라 다른 API가 있으나 elsTimetable 범용)
    const url = `https://open.neis.go.kr/hub/elsTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(grade)}&CLASS_NM=${encodeURIComponent(classNo)}&ALL_TI_YMD=${ymd}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.elsTimetable || !j.elsTimetable[1]) return res.json([]);

    const rows = j.elsTimetable[1].row.map(t => ({
      period: t.PERIO || t.PERIOD || "",
      subject: t.ITRT_CNTNT || ""
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// --------------------
// 주간 시간표 (시작일 기준 5일간)
// --------------------
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.status(400).json([]);

  try {
    // startDate: YYYYMMDD
    const sd = startDate.replace(/-/g, "");
    // endDate = start + 4 days (주간)
    const startIso = `${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`;
    const endDateObj = new Date(startIso);
    endDateObj.setDate(endDateObj.getDate() + 4);
    const ed = endDateObj.toISOString().slice(0,10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/elsTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(grade)}&CLASS_NM=${encodeURIComponent(classNo)}&TI_FROM_YMD=${sd}&TI_TO_YMD=${ed}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.elsTimetable || !j.elsTimetable[1]) return res.json([]);

    const rows = j.elsTimetable[1].row.map(t => ({
      date: t.ALL_TI_YMD || t.TI_YMD || "",
      period: t.PERIO || "",
      subject: t.ITRT_CNTNT || ""
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// --------------------
// 오늘 급식 (MLSV_YMD 이용)
// --------------------
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode, date } = req.query;
  // date optional (YYYYMMDD). 없으면 오늘
  const d = date ? date.replace(/-/g, "") : new Date().toISOString().slice(0,10).replace(/-/g, "");
  if (!schoolCode || !officeCode) return res.status(400).json({ menu: "" });

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_YMD=${d}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.mealServiceDietInfo || !j.mealServiceDietInfo[1]) return res.json({ menu: "" });

    const m = j.mealServiceDietInfo[1].row[0].DDISH_NM || "";
    res.json({ menu: m });
  } catch (err) {
    console.error(err);
    res.status(500).json({ menu: "" });
  }
});

// --------------------
// 월간 급식 (기간: startDate - endDate, YYYYMMDD)
// --------------------
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;
  if (!schoolCode || !officeCode || !startDate || !endDate) return res.status(400).json([]);

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.mealServiceDietInfo || !j.mealServiceDietInfo[1]) return res.json([]);

    const rows = j.mealServiceDietInfo[1].row.map(m => ({
      date: m.MLSV_YMD,
      menu: m.DDISH_NM || ""
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// SPA fallback (public/index.html)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
