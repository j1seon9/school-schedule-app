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

// __dirname 대체 코드 (ESM 환경)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// public 폴더 정적 파일 제공
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------
// 학교 검색 API
// ------------------------------
app.get("/api/searchSchool", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "학교명을 입력하세요." });

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.schoolInfo && json.schoolInfo[1]) {
      res.json(json.schoolInfo[1].row);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "학교 검색 중 오류 발생" });
  }
});

// ------------------------------
// 시간표 API
// ------------------------------
app.get("/api/timetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;

  if (!schoolCode || !officeCode || !grade || !classNo) {
    return res.status(400).json({ error: "필수 파라미터 누락" });
  }

  try {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&ALL_TI_YMD=${date}`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.hisTimetable && json.hisTimetable[1]) {
      res.json(json.hisTimetable[1].row);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "시간표 조회 중 오류 발생" });
  }
});

// ------------------------------
// 오늘 급식 API
// ------------------------------
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode, date } = req.query;

  if (!schoolCode || !officeCode || !date) {
    return res.status(400).json({ error: "필수 파라미터 누락" });
  }

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${date}`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.mealServiceDietInfo && json.mealServiceDietInfo[1]) {
      res.json({
        menu: json.mealServiceDietInfo[1].row[0].DDISH_NM
      });
    } else {
      res.json({ menu: "" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "급식 조회 중 오류 발생" });
  }
});

// ------------------------------
// 월간 급식 API
// ------------------------------
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;

  if (!schoolCode || !officeCode || !startDate || !endDate) {
    return res.status(400).json({ error: "필수 파라미터 누락" });
  }

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.mealServiceDietInfo && json.mealServiceDietInfo[1]) {
      const rows = json.mealServiceDietInfo[1].row.map(item => ({
        date: item.MLSV_YMD,
        menu: item.DDISH_NM
      }));
      res.json(rows);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "월간 급식 조회 중 오류 발생" });
  }
});

// ------------------------------
// 기본 라우팅
// ------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
