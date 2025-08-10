import express from 'express';
import fetch from 'node-fetch';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('API_KEY 환경변수가 설정되어 있지 않습니다!');
  process.exit(1);
}

// 정적 파일 서비스
app.use(express.static(path.join(process.cwd(), 'public')));

// 학교 검색 API 프록시
app.get('/api/schoolSearch', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: '학교명 필요' });

  const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const schools = data.schoolInfo ? data.schoolInfo[1].row : [];
    res.json(schools);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 시간표 API 프록시
app.get('/api/timetable', async (req, res) => {
  const { schoolCode, atptOfcdcScCode, grade, classNum } = req.query;
  if (!schoolCode || !atptOfcdcScCode || !grade || !classNum)
    return res.status(400).json({ error: '파라미터 부족' });

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(atptOfcdcScCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&ALL_TI_YMD=${today}&GRADE=${encodeURIComponent(grade)}&CLASS_NM=${encodeURIComponent(classNum)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const timetable = data.hisTimetable ? data.hisTimetable[1].row : [];
    res.json(timetable);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 급식 API 프록시
app.get('/api/meal', async (req, res) => {
  const { schoolCode, atptOfcdcScCode } = req.query;
  if (!schoolCode || !atptOfcdcScCode)
    return res.status(400).json({ error: '파라미터 부족' });

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(atptOfcdcScCode)}&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}&MLSV_YMD=${today}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const meal = data.mealServiceDietInfo ? data.mealServiceDietInfo[1].row : [];
    res.json(meal);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 모든 그 외 요청은 index.html 제공 (SPA 지원)
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
