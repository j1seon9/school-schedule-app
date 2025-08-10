// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";

dotenv.config();

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;

if (!API_KEY) {
  console.error("ERROR: `API_KEY` environment variable is required. Set it in .env or your platform env.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS (필요시 도메인 제한 가능)
app.use(cors());

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// 헬스체크
app.get("/health", (req, res) => res.status(200).send("OK"));

// 유틸: safe fetch JSON
async function fetchJson(url) {
  const r = await fetch(url, { timeout: 15000 });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

// --------------------
// 학교 검색
// /api/searchSchool?name=학교명
// --------------------
app.get("/api/searchSchool", async (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) return res.status(400).json({ error: "학교명(name) 파라미터 필요" });

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const j = await fetchJson(url);

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
    res.status(500).json({ error: "학교 검색 실패" });
  }
});

// --------------------
// 일간 시간표
// /api/dailyTimetable?schoolCode=...&officeCode=...&grade=...&classNo=...
// --------------------
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);

  try {
    const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const url = `https://open.neis.go.kr/hub/elsTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(grade)}&CLASS_NM=${encodeURIComponent(classNo)}&ALL_TI_YMD=${ymd}`;
    const j = await fetchJson(url);

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

// --------------------
// 주간 시간표 (startDate YYYYMMDD, 5일치)
// /api/weeklyTimetable?schoolCode=...&officeCode=...&grade=...&classNo=...&startDate=YYYYMMDD
// --------------------
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.status(400).json([]);

  try {
    const sd = String(startDate).replace(/-/g, "");
    // end = start + 4 days
    const sdIso = `${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`;
    const endObj = new Date(sdIso);
    endObj.setDate(endObj.getDate() + 4);
    const ed = endObj.toISOString().slice(0,10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/elsTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&GRADE=${encodeURIComponent(grade)}&CLASS_NM=${encodeURIComponent(classNo)}&TI_FROM_YMD=${sd}&TI_TO_YMD=${ed}`;
    const j = await fetchJson(url);

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

// --------------------
// 오늘 급식 (optional date YYYYMMDD)
// /api/dailyMeal?schoolCode=...&officeCode=...&date=YYYYMMDD
// --------------------
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode, date } = req.query;
  if (!schoolCode || !officeCode) return res.status(400).json({ menu: "" });

  try {
    const d = date ? String(date).replace(/-/g, "") : new Date().toISOString().slice(0,10).replace(/-/g, "");
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_YMD=${d}`;
    const j = await fetchJson(url);
    if (!j.mealServiceDietInfo || !j.mealServiceDietInfo[1]) return res.json({ menu: "" });

    const m = j.mealServiceDietInfo[1].row[0].DDISH_NM || "";
    res.json({ menu: m });
  } catch (err) {
    console.error("dailyMeal error:", err.message || err);
    res.status(500).json({ menu: "" });
  }
});

// --------------------
// 월간 급식
// /api/monthlyMeal?schoolCode=...&officeCode=...&startDate=YYYYMMDD&endDate=YYYYMMDD
// --------------------
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;
  if (!schoolCode || !officeCode || !startDate || !endDate) return res.status(400).json([]);

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const j = await fetchJson(url);
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
