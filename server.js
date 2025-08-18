import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static('public'));

const API_KEY = process.env.API_KEY;

// 학교 검색
app.get('/api/searchSchool', async (req,res)=>{
  const name = req.query.name;
  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const r = await fetch(url);
    const json = await r.json();
    const schools = json.schoolInfo?.[1]?.row || [];
    res.json(schools.map(s=>({
      name: s.SCHUL_NM,
      type: s.SCHUL_KND_SC_NM,
      gender: s.FOND_SC_NM,
      schoolCode: s.SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE
    })));
  } catch(e){
    console.error(e);
    res.json([]);
  }
});

// 일간 시간표
app.get('/api/dailyTimetable', async(req,res)=>{
  const {schoolCode, officeCode, grade, classNo, date} = req.query;
  try{
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${date}`;
    const r = await fetch(url);
    const json = await r.json();
    const meals = json.mealServiceDietInfo?.[1]?.row || [];
    res.json(meals);
  }catch(e){
    console.error(e);
    res.json([]);
  }
});

// 주간 시간표
app.get('/api/weeklyTimetable', async(req,res)=>{
  const {schoolCode, officeCode, grade, classNo, startDate} = req.query;
  try{
    const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&GRADE=${grade}&CLASS_NM=${classNo}&TI_FROM_YMD=${startDate}`;
    const r = await fetch(url);
    const json = await r.json();
    const data = json.hisTimetable?.[1]?.row || [];
    res.json(data);
  }catch(e){
    console.error(e);
    res.json([]);
  }
});

// 일간 급식
app.get('/api/dailyMeal', async(req,res)=>{
  const {schoolCode, officeCode, date} = req.query;
  try{
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${date}`;
    const r = await fetch(url);
    const json = await r.json();
    const menu = json.mealServiceDietInfo?.[1]?.row?.[0]?.DDISH_NM || "급식 없음";
    res.json({menu});
  }catch(e){
    console.error(e);
    res.json({menu:"급식 없음"});
  }
});

// 월간 급식
app.get('/api/monthlyMeal', async(req,res)=>{
  const {schoolCode, officeCode, startDate, endDate} = req.query;
  try{
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${officeCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_FROM_YMD=${startDate}&MLSV_TO_YMD=${endDate}`;
    const r = await fetch(url);
    const json = await r.json();
    const meals = json.mealServiceDietInfo?.[1]?.row || [];
    res.json(meals);
  }catch(e){
    console.error(e);
    res.json([]);
  }
});

app.listen(3000, ()=>console.log("Server running on port 3000"));
