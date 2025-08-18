import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 학교 검색
app.get('/api/searchSchool', async (req, res) => {
  const name = req.query.name;
  try {
    const response = await axios.get(`https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`);
    res.json(response.data.schoolInfo[1].row);
  } catch (error) {
    console.error(error);
    res.status(500).send('학교 검색 오류');
  }
});

// 일간 시간표
app.get('/api/dailyTimetable', async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, date } = req.query;
  try {
    const response = await axios.get(`https://open.neis.go.kr/hub/Timetable?KEY=${API_KEY}&Type=json&SCHUL_CODE=${schoolCode}&ATPT_OFCDC_SC_CODE=${officeCode}&GRADE=${grade}&CLASS_NM=${classNo}&TI_FROM_YMD=${date}&TI_TO_YMD=${date}`);
    res.json(response.data.Timetable[1]?.row || []);
  } catch (error) {
    console.error(error);
    res.status(500).send('일간 시간표 조회 오류');
  }
});

// 주간 시간표
app.get('/api/weeklyTimetable', async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  try {
    const response = await axios.get(`https://open.neis.go.kr/hub/Timetable?KEY=${API_KEY}&Type=json&SCHUL_CODE=${schoolCode}&ATPT_OFCDC_SC_CODE=${officeCode}&GRADE=${grade}&CLASS_NM=${classNo}&TI_FROM_YMD=${startDate}&TI_TO_YMD=${startDate}`);
    res.json(response.data.Timetable[1]?.row || []);
  } catch (error) {
    console.error(error);
    res.status(500).send('주간 시간표 조회 오류');
  }
});

// 일간 급식
app.get('/api/dailyMeal', async (req, res) => {
  const { schoolCode, officeCode, date } = req.query;
  try {
    const response = await axios.get(`https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&SCHUL_CODE=${schoolCode}&ATPT_OFCDC_SC_CODE=${officeCode}&MLSV_YMD=${date}`);
    res.json(response.data.mealServiceDietInfo[1]?.row?.[0] || { menu: "급식 없음" });
  } catch (error) {
    console.error(error);
    res.status(500).send('일간 급식 조회 오류');
  }
});

// 월간 급식
app.get('/api/monthlyMeal', async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;
  try {
    const response = await axios.get(`https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&SCHUL_CODE=${schoolCode}&ATPT_OFCDC_SC_CODE=${officeCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`);
    res.json(response.data.mealServiceDietInfo[1]?.row || []);
  } catch (error) {
    console.error(error);
    res.status(500).send('월간 급식 조회 오류');
  }
});

app.listen(port, () => {
  console.log(`ES 모듈 서버 실행 중: http://localhost:${port}`);
});
