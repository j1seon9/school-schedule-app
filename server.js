import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Node18 이상은 global fetch 가능

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

// 학교 검색
app.get("/api/searchSchool", async (req,res) => {
  const name = req.query.name;
  if(!name) return res.json([]);
  try {
    const response = await fetch(`https://open.neis.go.kr/hub/schoolInfo?KEY=${process.env.API_KEY}&Type=json&pIndex=1&pSize=10&SCHUL_NM=${encodeURIComponent(name)}`);
    const json = await response.json();
    const data = json.schoolInfo?.[1]?.row?.map(s => ({
      name: s.SCHUL_NM,
      type: s.SCHUL_KND_SC_NM,
      gender: s.GENDER,
      schoolCode: s.SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE
    })) || [];
    res.json(data);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

// 일간 시간표
app.get("/api/dailyTimetable", async (req,res) => {
  const {schoolCode, officeCode, grade, classNo, date} = req.query;
  try {
    const response = await fetch(`https://open.neis.go.kr/hub/hisTimetable?KEY=${process.env.API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&ALL_TI_YMD=${date}`);
    const json = await response.json();
    const data = json.hisTimetable?.[1]?.row?.map(item => ({
      date: item.ALL_TI_YMD,
      period: item.ITRT_CNTNT.split(" ")[0],
      subject: item.SUBJECT,
      teacher: item.TEACHER_NM
    })) || [];
    res.json(data);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

// 주간 시간표
app.get("/api/weeklyTimetable", async (req,res) => {
  const {schoolCode, officeCode, grade, classNo, startDate} = req.query;
  try {
    const response = await fetch(`https://open.neis.go.kr/hub/hisTimetable?KEY=${process.env.API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}`);
    const json = await response.json();
    const data = json.hisTimetable?.[1]?.row?.map(item => ({
      date: item.ALL_TI_YMD,
      period: item.ITRT_CNTNT.split(" ")[0],
      subject: item.SUBJECT,
      teacher: item.TEACHER_NM
    })) || [];
    res.json(data);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

// 일간 급식
app.get("/api/dailyMeal", async (req,res) => {
  const {schoolCode, officeCode, date} = req.query;
  try {
    const response = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${process.env.API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${date}`);
    const json = await response.json();
    const menu = json.mealServiceDietInfo?.[1]?.row?.[0]?.DDISH_NM?.replace(/<br\/>/g,"\n") || "";
    res.json({menu});
  } catch (err) {
    console.error(err);
    res.json({menu: ""});
  }
});

// 월간 급식
app.get("/api/monthlyMeal", async (req,res) => {
  const {schoolCode, officeCode, startDate, endDate} = req.query;
  try {
    const response = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${process.env.API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`);
    const json = await response.json();
    const data = json.mealServiceDietInfo?.[1]?.row?.map(item => ({
      date: item.MLSV_YMD,
      menu: item.DDISH_NM.replace(/<br\/>/g,"\n")
    })) || [];
    res.json(data);
  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
