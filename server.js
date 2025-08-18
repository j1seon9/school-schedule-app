// ====== server.js ======
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

// ===== 헬스체크 =====
app.get("/health", (req, res) => {
  res.json({ status: "서버 정상 작동중", timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) });
});

// ===== 학교 검색 =====
app.get("/api/searchSchool", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "학교명을 입력하세요." });

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.schoolInfo) return res.json([]);
    const rows = j.schoolInfo[1].row;

    const result = rows.map((s) => ({
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

// ===== 오늘 시간표 =====
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo)
    return res.status(400).json({ error: "파라미터 누락" });

  const today = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const date = today.split(" ")[0].replace(/\./g, "");

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

// ===== 주간 시간표 (해당 주 월요일 기준) =====
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo)
    return res.status(400).json({ error: "파라미터 누락" });

  const today = new Date(new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }));
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1); // 월요일 기준
  const startDate = monday.toISOString().slice(0, 10).replace(/-/g, "");

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

  const today = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }).split(" ")[0].replace(/\./g, "");

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${today}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.mealServiceDietInfo) return res.json({ menu: null });
    const rows = j.mealServiceDietInfo[1].row;

    const menu = rows.map((m) => m.DDISH_NM.replace(/<br\/?>/g, ", ")).join("\n");
    res.json({ menu });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "급식 조회 실패" });
  }
});

// ===== 월간 급식 (조회일 기준 해당 달) =====
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode } = req.query;
  if (!schoolCode || !officeCode)
    return res.status(400).json({ error: "파라미터 누락" });

  const today = new Date(new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }));
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");

  const startDate = `${yyyy}${mm}01`;
  const endDate = `${yyyy}${mm}31`;

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.mealServiceDietInfo) return res.json([]);
    const rows = j.mealServiceDietInfo[1].row;

    const result = rows.map((r) => ({
      date: r.MLSV_YMD,
      menu: r.DDISH_NM.replace(/<br\/?>/g, ", "),
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "월간 급식 조회 실패" });
  }
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
