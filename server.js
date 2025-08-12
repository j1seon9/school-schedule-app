// -----------------
// 학급 구분 자동 감지 후 일간 시간표
// schoolLevel: "els" | "mis" | "his" 자동 선택
// /api/dailyTimetableUnified?schoolCode=&officeCode=&grade=&classNo=&schoolLevel=his
// -----------------
app.get("/api/dailyTimetableUnified", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, schoolLevel } = req.query;
    if (!schoolCode || !officeCode || !grade || !classNo || !schoolLevel)
      return res.status(400).json([]);

    // API 엔드포인트 결정
    const timetableType =
      schoolLevel === "his"
        ? "hisTimetable"
        : schoolLevel === "mis"
        ? "misTimetable"
        : "elsTimetable";

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/${timetableType}?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(
      officeCode
    )}&SD_SCHUL_CODE=${encodeURIComponent(
      schoolCode
    )}&GRADE=${encodeURIComponent(
      grade
    )}&CLASS_NM=${encodeURIComponent(classNo)}&ALL_TI_YMD=${today}`;

    const j = await getCached(url);
    if (!j[timetableType] || !j[timetableType][1]) return res.json([]);
    const rows = j[timetableType][1].row.map((t) => ({
      period: t.PERIO || "",
      subject: t.ITRT_CNTNT || ""
    }));
    res.json(rows);
  } catch (err) {
    console.error("dailyTimetableUnified error:", err.message || err);
    res.status(500).json([]);
  }
});

// -----------------
// 학급 구분 자동 감지 후 주간 시간표
// /api/weeklyTimetableUnified?schoolCode=&officeCode=&grade=&classNo=&startDate=YYYYMMDD&schoolLevel=his
// -----------------
app.get("/api/weeklyTimetableUnified", async (req, res) => {
  try {
    const { schoolCode, officeCode, grade, classNo, startDate, schoolLevel } =
      req.query;
    if (
      !schoolCode ||
      !officeCode ||
      !grade ||
      !classNo ||
      !startDate ||
      !schoolLevel
    )
      return res.status(400).json([]);

    const timetableType =
      schoolLevel === "his"
        ? "hisTimetable"
        : schoolLevel === "mis"
        ? "misTimetable"
        : "elsTimetable";

    const sd = String(startDate).replace(/-/g, "");
    const sdIso = `${sd.slice(0, 4)}-${sd.slice(4, 6)}-${sd.slice(6, 8)}`;
    const endObj = new Date(sdIso);
    endObj.setDate(endObj.getDate() + 4);
    const ed = endObj.toISOString().slice(0, 10).replace(/-/g, "");

    const url = `https://open.neis.go.kr/hub/${timetableType}?KEY=${API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${encodeURIComponent(
      officeCode
    )}&SD_SCHUL_CODE=${encodeURIComponent(
      schoolCode
    )}&GRADE=${encodeURIComponent(
      grade
    )}&CLASS_NM=${encodeURIComponent(
      classNo
    )}&TI_FROM_YMD=${sd}&TI_TO_YMD=${ed}`;

    const j = await getCached(url);
    if (!j[timetableType] || !j[timetableType][1]) return res.json([]);
    const rows = j[timetableType][1].row.map((t) => ({
      date: t.ALL_TI_YMD || "",
      period: t.PERIO || "",
      subject: t.ITRT_CNTNT || ""
    }));
    res.json(rows);
  } catch (err) {
    console.error("weeklyTimetableUnified error:", err.message || err);
    res.status(500).json([]);
  }
});
