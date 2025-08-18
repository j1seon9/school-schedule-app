import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.API_KEY;

// 루트 라우트 (health check)
app.get("/", (req, res) => res.send("School Schedule App running"));

function formatDate(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

// --- 학교 검색 ---
app.get("/api/searchSchool", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.json([]);
  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const data = await r.json();
    const schools = data.schoolInfo?.[1]?.row?.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      type: s.SCHUL_KND_SC_NM,
      gender: s.GRD_DEGREE_NM
    })) || [];
    res.json(schools);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "학교 검색 실패" });
  }
});

// --- 일간 급식 ---
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode, date } = req.query;
  if (!schoolCode || !officeCode) return res.json({ menu: "급식 없음" });
  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${date}&MLSV_TO_YMD=${date}`;
    const r = await fetch(url);
    const data = await r.json();
    const menu = data.mealServiceDietInfo?.[1]?.row?.[0]?.DDISH_NM || "급식 없음";
    res.json({ menu });
  } catch (err) {
    console.error(err);
    res.status(500).json({ menu: "급식 조회 실패" });
  }
});

// --- 주간 시간표 (급식) ---
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, startDate } = req.query;
  if (!schoolCode || !officeCode) return res.json([]);
  try {
    const endDate = new Date(
      parseInt(startDate.slice(0, 4)),
      parseInt(startDate.slice(4, 6)) - 1,
      parseInt(startDate.slice(6, 8))
    );
    endDate.setDate(endDate.getDate() + 6);
    const endStr = formatDate(endDate);

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endStr}`;
    const r = await fetch(url);
    const data = await r.json();
    const weekly = data.mealServiceDietInfo?.[1]?.row?.map(item => ({
      date: item.MLSV_YMD,
      menu: item.DDISH_NM
    })) || [];
    res.json(weekly);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "주간 시간표 조회 실패" });
  }
});

// --- 월간 급식 ---
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;
  if (!schoolCode || !officeCode) return res.json([]);
  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const r = await fetch(url);
    const data = await r.json();
    const monthly = data.mealServiceDietInfo?.[1]?.row?.map(item => ({
      date: item.MLSV_YMD,
      menu: item.DDISH_NM
    })) || [];
    res.json(monthly);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "월간 급식 조회 실패" });
  }
});

// --- 서버 시작 ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
