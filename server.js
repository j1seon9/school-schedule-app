// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;
if (!API_KEY) {
  console.error("ERROR: API_KEY is required in environment variables.");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// --- simple in-memory cache ---
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchWithRetry(url, retries = 3, baseDelay = 500) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = await res.json();
      return json;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) {
        const delay = baseDelay * (2 ** i);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

async function getCached(url) {
  const now = Date.now();
  const entry = cache.get(url);
  if (entry && entry.expiry > now) return entry.data;
  const data = await fetchWithRetry(url);
  cache.set(url, { data, expiry: now + CACHE_TTL });
  return data;
}

// ===== 공통 헬퍼 =====
function pickTimetableEndpoint(kindName /* '초등학교'|'중학교'|'고등학교' */) {
  if (!kindName) return "elsTimetable"; // 안전 기본값
  if (kindName.includes("중")) return "misTimetable";
  if (kindName.includes("고")) return "hisTimetable";
  return "elsTimetable";
}
function extractTeacher(row) {
  // 안전하게 여러 후보 필드 체크 (NEIS 스키마 차이 대비)
  return row.TCR_NM || row.TEACHER || row.TM_NM || row.TCH_NM || "";
}
function extractSubject(row) {
  return row.ITRT_CNTNT || row.SUBJECT_NM || row.CHG_STT_CNTNT || "";
}
function extractPeriod(row) {
  return row.PERIO || row.PERIOD || row.PERIOD_NM || "";
}
function extractDate(row) {
  return row.ALL_TI_YMD || row.TI_YMD || row.YMD || "";
}

// =========== Health ===========
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/healthz", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=UTF-8");
  res.status(200).send(`
    <!doctype html><html lang="ko"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Health Check</title>
    <style>
      body{font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding:24px}
      .ok{color:#0a7a0a;font-weight:700}
      code{background:#f7f7f7;padding:2px 6px;border-radius:4px}
    </style>
    </head><body>
    <h1>서버 상태: <span class="ok">OK</span></h1>
    <ul>
      <li>환경변수: API_KEY <code>${API_KEY ? "configured" : "missing"}</code></li>
      <li>캐시TTL: <code>${CACHE_TTL / 1000}s</code></li>
      <li>시간: <code>${new Date().toISOString()}</code></li>
    </ul>
    </body></html>
  `);
});

// =========== 학교 검색 (성별/특성화 필터 옵션) ===========
app.get("/api/searchSchool", async (req, res) => {
  try {
    const name = (req.query.name || "").trim();
    // optional filters
    const coedu = (req.query.coedu || "").trim(); // "남", "여", "남녀공학" 등
    const kind = (req.query.kind || "").trim();   // "초등학교|중학교|고등학교"
    const spec = (req.query.spec || "").trim();   // "특성화", "특수", "자사고" 등 문자열 포함 검색

    if (!name) return res.status(400).json({ error: "name query required" });

    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    const j = await getCached(url);
    const rows = (j?.schoolInfo?.[1]?.row || []).map(s => ({
      name: s.SCHUL_NM,
      schoolCode: s.SD_SCHUL_CODE,
      officeCode: s.ATPT_OFCDC_SC_CODE,
      address: s.ORG_RDNMA || "",
      tel: s.ORG_TELNO || "",
      kindName: s.SCHUL_KND_SC_NM || "",        // 초/중/고
      coeduName: s.COEDU_SC_NM || "",           // 남여공학/남/여
      fondName: s.FOND_SC_NM || "",             // 설립구분(사립/국공립)
      highType: s.HS_SC_NM || ""                // 고등학교 구분(일반/특성화/자율 등)
    }));

    // 서버단 간단 필터 (파라미터 제공 시)
    const filtered = rows.filter(r => {
      const byCoedu = coedu ? (r.coeduName && r.coeduName.includes(coedu)) : true;
      const byKind = kind ? (r.kindName && r.kindName.includes(kind)) : true;
      const bySpec = spec ? ((r.highType && r.highType.includes(spec)) || r.name.includes(spec)) : true;
      return byCoedu && byKind && bySpec;
    });

    res.json(filtered);
  } catch (err) {
    console.error("searchSchool error:", err.message || err);
    res.status(500).json({ error: "school search failed" });
  }
});

// =========== 일간 시간표 ===========
app.get("/api/dailyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, kindName } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo) return res.status(400).json([]);

    const endpoint = pickTimetableEndpoint(kindName);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/${endpoint}?KEY=${API_KEY}&Type=json` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&GRADE=${encodeURIComponent(grade)}` +
      `&CLASS_NM=${encodeURIComponent(classNo)}` +
      `&ALL_TI_YMD=${today}`;

    const j = await getCached(url);
    const rows = (j?.[endpoint]?.[1]?.row || []).map(t => ({
      date: extractDate(t),
      period: extractPeriod(t),
      subject: extractSubject(t),
      teacher: extractTeacher(t)
    }));

    res.json(rows);
  } catch (err) {
    console.error("dailyTimetable error:", err.message || err);
    res.status(500).json([]);
  }
});

// =========== 주간 시간표 (일자별로 묶어서 반환) ===========
app.get("/api/weeklyTimetable", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate, kindName } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !startDate) return res.status(400).json({ days: [] });

    const endpoint = pickTimetableEndpoint(kindName);
    const sd = String(startDate).replace(/-/g, "");
    const sdIso = `${sd.slice(0,4)}-${sd.slice(4,6)}-${sd.slice(6,8)}`;
    const endObj = new Date(sdIso);
    endObj.setDate(endObj.getDate() + 4);
    const ed = endObj.toISOString().slice(0,10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/${endpoint}?KEY=${API_KEY}&Type=json` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&GRADE=${encodeURIComponent(grade)}` +
      `&CLASS_NM=${encodeURIComponent(classNo)}` +
      `&TI_FROM_YMD=${sd}&TI_TO_YMD=${ed}`;

    const j = await getCached(url);
    const flat = (j?.[endpoint]?.[1]?.row || []).map(t => ({
      date: extractDate(t),
      period: extractPeriod(t),
      subject: extractSubject(t),
      teacher: extractTeacher(t)
    }));

    // 날짜별 그룹핑 + 교시순 정렬
    const group = {};
    for (const r of flat) {
      if (!group[r.date]) group[r.date] = [];
      group[r.date].push(r);
    }
    Object.keys(group).forEach(d => {
      group[d].sort((a, b) => Number(a.period) - Number(b.period));
    });

    res.json({ days: group });
  } catch (err) {
    console.error("weeklyTimetable error:", err.message || err);
    res.status(500).json({ days: {} });
  }
});

// =========== 오늘 급식 ===========
app.get("/api/dailyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, date } = req.query;
    if (!schoolCode || !officeCode) return res.status(400).json({ menu: "" });
    const d = date ? String(date).replace(/-/g, "") : new Date().toISOString().slice(0,10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&MLSV_YMD=${d}`;

    const j = await getCached(url);
    const row = j?.mealServiceDietInfo?.[1]?.row?.[0];
    const m = row?.DDISH_NM || "";

    res.json({ menu: m, ymd: d });
  } catch (err) {
    console.error("dailyMeal error:", err.message || err);
    res.status(500).json({ menu: "" });
  }
});

// =========== 월간 급식 (달력용: 조회일 기준 월 전체) ===========
app.get("/api/monthlyMeal", async (req, res) => {
  try {
    const { schoolCode, officeCode, baseDate } = req.query; // YYYYMMDD or YYYY-MM-DD
    if (!schoolCode || !officeCode) return res.status(400).json([]);

    const bd = (baseDate ? String(baseDate) : new Date().toISOString().slice(0,10)).replace(/-/g, "");
    const y = Number(bd.slice(0,4));
    const m = Number(bd.slice(4,6)) - 1;
    const first = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(y, m + 1, 0));
    const from = first.toISOString().slice(0,10).replace(/-/g, "");
    const to = last.toISOString().slice(0,10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${API_KEY}&Type=json` +
      `&ATPT_OFCDC_SC_CODE=${encodeURIComponent(officeCode)}` +
      `&SD_SCHUL_CODE=${encodeURIComponent(schoolCode)}` +
      `&MLSV_FROM_YMD=${from}&MLSV_TO_YMD=${to}`;

    const j = await getCached(url);
    const rows = (j?.mealServiceDietInfo?.[1]?.row || []).map(m => ({
      date: m.MLSV_YMD,
      menu: m.DDISH_NM || ""
    }));

    res.json(rows);
  } catch (err) {
    console.error("monthlyMeal error:", err.message || err);
    res.status(500).json([]);
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
