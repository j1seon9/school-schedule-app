import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

// 환경변수 체크
if (!API_KEY) {
  console.error("[ERROR] API_KEY is required in environment variables.");
  //process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // 프론트엔드 정적 파일

// 학교 검색 API
app.get("/api/searchSchool", async (req, res) => {
  const name = req.query.name;
  if (!name) {
    return res.status(400).json({ error: "학교 이름(name) 파라미터가 필요합니다." });
  }

  try {
    const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${API_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(name)}`;
    console.log(`[INFO] 학교 검색 요청: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    console.log("[DEBUG] NEIS API 응답:", JSON.stringify(data, null, 2));

    if (!data.schoolInfo || !data.schoolInfo[1] || !Array.isArray(data.schoolInfo[1].row)) {
      return res.json([]);
    }

    const schools = data.schoolInfo[1].row.map((s) => ({
      name: s.SCHUL_NM,
      code: s.SD_SCHUL_CODE,
      region: s.ATPT_OFCDC_SC_CODE
    }));

    res.json(schools);
  } catch (error) {
    console.error("[ERROR] searchSchool error:", error);
    res.status(500).json({ error: "학교 검색 실패" });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

