// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

app.use(cors());
app.use(express.static("public"));

// ✅ 공통 NICE API 호출 함수
async function fetchNice(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("NICE API 호출 실패");
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("❌ NICE 호출 오류:", err.message);
    return null;
  }
}

// ✅ 학교 검색
app.get("/api/searchSchool", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "학교명을 입력하세요" });

  const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(
    name
  )}`;

  const data = await fetchNice(url);
  if (!data || !data.schoolInfo) return res.json([]);

  const rows = data.schoolInfo[1].row.map((s) => ({
    name: s.SCHUL_NM,
    schoolCode: s.SD_SCHUL_CODE,
    officeCode: s.ATPT_OFCDC_SC_CODE,
    kind: s.SCHUL_KND_SC_NM, // 초/중/고/특수/특성화
    gender: s.COEDU_SC_NM, // 남/여/남여공학
  }));
  res.json(rows);
});

// ✅ 오늘 시간표
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo)
    return res.status(400).json({ error: "필수 값 누락" });

  const today = new Date();
  const date = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

  const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&ALL_TI_YMD=${date}&GRADE=${grade}&CLASS_NM=${classNo}`;

  const data = await fetchNice(url);
  if (!data || !data.hisTimetable) return res.json([]);

  const rows = data.hisTimetable[1].row.map((r) => ({
    date: r.ALL_TI_YMD,
    period: r.PERIO,
    subject: r.ITRT_CNTNT,
    teacher: r.TEACHER_NM || "", // ✅ 교사 이름 추가
  }));
  res.json(rows);
});

// ✅ 주간 시간표
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo || !startDate)
    return res.status(400).json({ error: "필수 값 누락" });

  // 시작일 기준으로 5일(월~금) 계산
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);

  const startStr = start.toISOString().slice(0, 10).replace(/-/g, "");
  const endStr = end.toISOString().slice(0, 10).replace(/-/g, "");

  const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&TI_FROM_YMD=${startStr}&TI_TO_YMD=${endStr}`;

  const data = await fetchNice(url);
  if (!data || !data.hisTimetable) return res.json([]);

  const rows = data.hisTimetable[1].row.map((r) => ({
    date: r.ALL_TI_YMD,
    period: r.PERIO,
    subject: r.ITRT_CNTNT,
    teacher: r.TEACHER_NM || "",
  }));

  res.json(rows);
});

// ✅ 오늘 급식
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode } = req.query;
  if (!schoolCode || !officeCode)
    return res.status(400).json({ error: "필수 값 누락" });

  const today = new Date();
  const date = today.toISOString().slice(0, 10).replace(/-/g, "");

  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${date}`;

  const data = await fetchNice(url);
  if (!data || !data.mealServiceDietInfo) {
    return res.json({ menu: "방학 중 급식 없음" }); // ✅ 방학 처리
  }

  const meal = data.mealServiceDietInfo[1].row[0].DDISH_NM;
  res.json({ menu: meal });
});

// ✅ 월간 급식 (조회일 기준 그 달 전체)
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, startDate } = req.query;
  if (!schoolCode || !officeCode || !startDate)
    return res.status(400).json({ error: "필수 값 누락" });

  const start = new Date(startDate);
  const year = start.getFullYear();
  const month = start.getMonth();

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const startStr = first.toISOString().slice(0, 10).replace(/-/g, "");
  const endStr = last.toISOString().slice(0, 10).replace(/-/g, "");

  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startStr}&MLSV_TO_YMD=${endStr}`;

  const data = await fetchNice(url);
  if (!data || !data.mealServiceDietInfo) return res.json([]);

  const rows = data.mealServiceDietInfo[1].row.map((r) => ({
    date: r.MLSV_YMD,
    menu: r.DDISH_NM,
  }));

  res.json(rows);
});

// ✅ 헬스체크
app.get("/health", (req, res) => {
  res.send("OK - Server is running 🚀");
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
