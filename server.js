import dotenv from "dotenv";
dotenv.config();
import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ status: "서버 정상 작동중", timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) });
});

// 학교 검색
app.get("/api/searchSchool", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "학교명을 입력하세요." });
  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.schoolInfo) return res.json([]);
    const rows = j.schoolInfo[1].row;
    const result = rows.map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      type: s.SCHUL_KND_SC_NM,
      gender: s.COEDU_SC_NM,
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "학교 검색 실패" });
  }
});

// 일간 시간표
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo)
    return res.status(400).json({ error: "파라미터 누락" });

  const today = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }).split(" ")[0].replace(/\./g, "");

  try {
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&ALL_TI_YMD=${today}&GRADE=${grade}&CLASS_NM=${classNo}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.hisTimetable) return res.json([]);
    const rows = j.hisTimetable[1].row;
    const result = rows.map(r => ({
      date: r.ALL_TI_YMD,
      period: r.PERIO,
      subject: r.ITRT_CNTNT,
      teacher: r.TEACHER_NM || "미정",
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "일간 시간표 조회 실패" });
  }
});

// 주간 시간표 (1주 기준)
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo || !startDate)
    return res.status(400).json({ error: "파라미터 누락" });

  const start = new Date(startDate.slice(0,4), parseInt(startDate.slice(4,6))-1, parseInt(startDate.slice(6,8)));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const endDate = end.toISOString().slice(0,10).replace(/-/g,"");

  try {
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&ALL_TI_FROM_YMD=${startDate}&ALL_TI_TO_YMD=${endDate}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.hisTimetable) return res.json([]);
    const rows = j.hisTimetable[1].row;
    const result = rows.map(r => ({
      date: r.ALL_TI_YMD,
      period: r.PERIO,
      subject: r.ITRT_CNTNT,
      teacher: r.TEACHER_NM || "미정",
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "주간 시간표 조회 실패" });
  }
});

// 일간 급식
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode } = req.query;
  if (!schoolCode || !officeCode) return res.status(400).json({ error: "파라미터 누락" });

  const today = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }).split(" ")[0].replace(/\./g, "");

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${today}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.mealServiceDietInfo) return res.json({ menu: "급식 없음" });
    const rows = j.mealServiceDietInfo[1].row;
    const menu = rows.map(r => r.DDISH_NM.replace(/<br\/>/g, "\n")).join("\n");
    res.json({ menu });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "일간 급식 조회 실패" });
  }
});

// 월간 급식
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;
  if (!schoolCode || !officeCode || !startDate || !endDate)
    return res.status(400).json({ error: "파라미터 누락" });

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.mealServiceDietInfo) return res.json([]);
    const rows = j.mealServiceDietInfo[1].row;
    const result = rows.map(r => ({
      date: r.MLSV_YMD,
      menu: r.DDISH_NM.replace(/<br\/>/g, "\n"),
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "월간 급식 조회 실패" });
  }
});

app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));import dotenv from 'dotenv';
import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 환경 변수 로드
dotenv.config();

// ES 모듈 환경에서 __dirname 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express 앱 설정
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: '서버 정상 작동중',
    timestamp: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
  });
});

// 학교 검색 API
app.get('/api/searchSchool', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: '학교명을 입력하세요.' });

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.schoolInfo) return res.json([]);
    const rows = data.schoolInfo[1].row;

    const result = rows.map((school) => ({
      name: school.SCHUL_NM,
      schoolCode: school.SD_SCHUL_CODE,
      officeCode: school.ATPT_OFCDC_SC_CODE,
      type: school.SCHUL_KND_SC_NM,
      gender: school.COEDU_SC_NM,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '학교 검색 실패' });
  }
});

// 일간 시간표 API
app.get('/api/dailyTimetable', async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo)
    return res.status(400).json({ error: '파라미터 누락' });

  const today = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const date = today.split(' ')[0].replace(/\./g, '');

  try {
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&ALL_TI_YMD=${date}&GRADE=${grade}&CLASS_NM=${classNo}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.hisTimetable) return res.json([]);
    const rows = data.hisTimetable[1].row;

    const result = rows.map((item) => ({
      date: item.ALL_TI_YMD,
      period: item.PERIO,
      subject: item.ITRT_CNTNT,
      teacher: item.TEACHER_NM || '미정',
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '일간 시간표 조회 실패' });
  }
});

// 주간 시간표 API
app.get('/api/weeklyTimetable', async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo || !startDate)
    return res.status(400).json({ error: '파라미터 누락' });

  const endDate = new Date(startDate.slice(0, 4), parseInt(startDate.slice(4, 6)) - 1, parseInt(startDate.slice(6, 8)) + 6)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

  try {
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&ALL_TI_FROM_YMD=${startDate}&ALL_TI_TO_YMD=${endDate}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.hisTimetable) return res.json([]);
    const rows = data.hisTimetable[1].row;

    const result = rows.map((item) => ({
      date: item.ALL_TI_YMD,
      period: item.PERIO,
      subject: item.ITRT_CNTNT,
      teacher: item.TEACHER_NM || '미정',
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '주간 시간표 조회 실패' });
  }
});

// 일간 급식 API
app.get('/api/dailyMeal', async (req, res) => {
  const { schoolCode, officeCode } = req.query;
  if (!schoolCode || !officeCode) return res.status(400).json({ error: '파라미터 누락' });

  const today = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const date = today.split(' ')[0].replace(/\./g, '');

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${date}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.mealServiceDietInfo) return res.json({ menu: '급식 없음' });
    const rows = data.mealServiceDietInfo[1].row;
    const menu = rows.map((item) => item.DDISH_NM.replace(/<br\/>/g, '\n')).join('\n');

    res.json({ menu });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '일간 급식 조회 실패' });
  }
});

// 월간 급식 API
app.get('/api/monthlyMeal', async (req, res) => {
  const { schoolCode, officeCode, startDate, endDate } = req.query;
  if (!schoolCode || !officeCode || !startDate || !endDate)
    return res.status(400).json({ error: '파라미터 누락' });

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.mealServiceDietInfo) return res.json([]);
    const rows = data.mealServiceDietInfo[1].row;

    const result = rows.map((item) => ({
      date: item.MLSV_YMD,
      menu: item.DDISH_NM.replace(/<br\/>/g, '\n'),
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '월간 급식 조회 실패' });
  }
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

