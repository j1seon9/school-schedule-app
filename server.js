import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

// NEIS 기본 API 키
const API_KEY = process.env.NEIS_KEY;

// 헬스체크
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 학교 검색
app.get("/api/searchSchool", async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "학교명을 입력하세요." });

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(
      name
    )}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.schoolInfo) return res.json([]);

    const list = j.schoolInfo[1].row.map((s) => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      kind: s.SCHUL_KND_SC_NM,
    }));

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "학교 검색 실패" });
  }
});

// 오늘 시간표
app.get("/api/dailyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo)
    return res.status(400).json({ error: "필수값 누락" });

  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, "");

  try {
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&ALL_TI_YMD=${ymd}&GRADE=${grade}&CLASS_NM=${classNo}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.hisTimetable) return res.json([]);

    const list = j.hisTimetable[1].row.map((x) => ({
      date: x.ALL_TI_YMD,
      period: x.PERIO,
      subject: x.ITRT_CNTNT,
      teacher: x.TEACHER_NM || "",
    }));

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "시간표 조회 실패" });
  }
});

// 주간 시간표
app.get("/api/weeklyTimetable", async (req, res) => {
  const { schoolCode, officeCode, grade, classNo, startDate } = req.query;
  if (!schoolCode || !officeCode || !grade || !classNo || !startDate)
    return res.status(400).json({ error: "필수값 누락" });

  const start = new Date(
    startDate.slice(0, 4),
    parseInt(startDate.slice(4, 6)) - 1,
    startDate.slice(6, 8)
  );
  const end = new Date(start);
  end.setDate(start.getDate() + 4);

  const startStr = start.toISOString().slice(0, 10).replace(/-/g, "");
  const endStr = end.toISOString().slice(0, 10).replace(/-/g, "");

  try {
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&TI_FROM_YMD=${startStr}&TI_TO_YMD=${endStr}&GRADE=${grade}&CLASS_NM=${classNo}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.hisTimetable) return res.json([]);

    const list = j.hisTimetable[1].row.map((x) => ({
      date: x.ALL_TI_YMD,
      period: x.PERIO,
      subject: x.ITRT_CNTNT,
      teacher: x.TEACHER_NM || "",
    }));

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "주간 시간표 조회 실패" });
  }
});

// 오늘 급식
app.get("/api/dailyMeal", async (req, res) => {
  const { schoolCode, officeCode } = req.query;
  if (!schoolCode || !officeCode)
    return res.status(400).json({ error: "필수값 누락" });

  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, "");

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${ymd}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.mealServiceDietInfo) return res.json({ menu: "" });

    const row = j.mealServiceDietInfo[1].row[0];
    res.json({ date: row.MLSV_YMD, menu: row.DDISH_NM });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "급식 조회 실패" });
  }
});

// 월간 급식
app.get("/api/monthlyMeal", async (req, res) => {
  const { schoolCode, officeCode, ref } = req.query;
  if (!schoolCode || !officeCode)
    return res.status(400).json({ error: "필수값 누락" });

  const refDate = ref ? new Date(ref) : new Date();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const startStr = start.toISOString().slice(0, 10).replace(/-/g, "");
  const endStr = end.toISOString().slice(0, 10).replace(/-/g, "");

  try {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startStr}&MLSV_TO_YMD=${endStr}`;
    const r = await fetch(url);
    const j = await r.json();

    if (!j.mealServiceDietInfo) return res.json([]);

    const list = j.mealServiceDietInfo[1].row.map((x) => ({
      date: x.MLSV_YMD,
      menu: x.DDISH_NM,
    }));

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "월간 급식 조회 실패" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
