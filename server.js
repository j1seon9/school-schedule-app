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

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// ===== KST 기준 날짜 함수 =====
function getTodayKST() {
  const now = new Date();
  const kstTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kstTime.toISOString().slice(0, 10).replace(/-/g, "");
}

// HTML과 알레르기 숫자 제거
function cleanMenu(menu) {
  return menu.replace(/<[^>]+>/g, "").replace(/\([0-9.,]+\)/g, "");
}

// ===== 헬스체크 =====
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) });
});

// ===== 학교 검색 + 학년/반 선택 =====
app.get("/api/searchSchool", async (req, res) => {
  const { name, grade, classNo } = req.query;
  if (!name) return res.status(400).json({ error: "학교명을 입력하세요." });

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.schoolInfo) return res.json([]);
    const rows = j.schoolInfo[1].row;

    let result = rows.map((s) => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      type: s.SCHUL_KND_SC_NM,
      gender: s.COEDU_SC_NM,
    }));

    // 학년/반 필터링
    if (grade) result = result.filter((r) => r.grade == grade);
    if (classNo) result = result.filter((r) => r.classNo == classNo);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "학교 검색 실패" });
  }
});

// ===== 오늘 시간표 =====
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo)
    return res.status(400).json({ error: "파라미터 누락" });

  const date = getTodayKST();

  try {
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&ALL_TI_YMD=${date}&GRADE=${grade}&CLASS_NM=${classNo}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.hisTimetable) return res.json([]);
    const rows = j.hisTimetable[1].row;

    const result = rows.map((r) => ({
      date: r.ALL_TI_YMD,
      period: r.PERIO,
      subject: r.ITRT_CNTNT,
      teacher: r.TEACHER_NM || "미정",
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "시간표 조회 실패" });
  }
});

// ===== 주간 시간표 =====
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo || !startDate)
    return res.status(400).json({ error: "파라미터 누락" });

  try {
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&TI_FROM_YMD=${startDate}&TI_TO_YMD=${startDate}&GRADE=${grade}&CLASS_NM=${classNo}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.hisTimetable) return res.json([]);
    const rows = j.hisTimetable[1].row;

    const result = rows.map((r) => ({
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

// ===== 오늘 급식 =====
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode } = req.query;
  if (!schoolCode || !officeCode)
    return res.status(400).json({ error: "파라미터 누락" });

  const today = getTodayKST();

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${today}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.mealServiceDietInfo) return res.json({ menu: null });
    const rows = j.mealServiceDietInfo[1].row;

    const menu = rows.map((m) => cleanMenu(m.DDISH_NM)).join("\n");
    res.json({ menu });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "급식 조회 실패" });
  }
});

// ===== 월간 급식 =====
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

    const result = rows.map((r) => ({
      date: r.MLSV_YMD,
      menu: cleanMenu(r.DDISH_NM),
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "월간 급식 조회 실패" });
  }
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
