// script.js - safe API calls and UI updates

function qs(id) { return document.getElementById(id); }
function formatYMD(ymd) {
  const s = String(ymd);
  if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  return s;
}

// 학교 검색
qs("searchSchoolBtn").addEventListener("click", async () => {
  const name = (qs("schoolName").value || "").trim();
  if (!name) return alert("학교명을 입력하세요.");
  try {
    const res = await fetch(`/api/searchSchool?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    const select = qs("schoolList");
    select.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "검색 결과 없음";
      select.appendChild(opt);
      return;
    }
    data.forEach(s => {
      const opt = document.createElement("option");
      opt.value = `${s.officeCode}|${s.schoolCode}`;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    alert("학교 검색 중 오류가 발생했습니다.");
  }
});

// 오늘 시간표
qs("loadTimetableBtn").addEventListener("click", async () => {
  const sel = qs("schoolList").value;
  if (!sel) return alert("학교를 선택하세요.");
  const [officeCode, schoolCode] = sel.split("|");
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!grade || !classNo) return alert("학년/반을 입력하세요.");
  try {
    const res = await fetch(`/api/dailyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}`);
    const data = await res.json();
    const ul = qs("timetable");
    ul.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      ul.textContent = "시간표 정보가 없습니다.";
      return;
    }
    data.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.period}교시: ${item.subject}`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    alert("시간표 조회 중 오류가 발생했습니다.");
  }
});

// 주간 시간표
qs("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const sel = qs("schoolList").value;
  if (!sel) return alert("학교를 선택하세요.");
  const [officeCode, schoolCode] = sel.split("|");
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDateEl = qs("weekStartDate");
  if (!grade || !classNo || !startDateEl.value) return alert("학년/반/시작일을 입력하세요.");

  const startDate = startDateEl.value.replace(/-/g, "");
  try {
    const res = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}`);
    const data = await res.json();
    const tbody = qs("weeklyTimetable");
    tbody.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="3">주간 시간표 정보가 없습니다.</td>`;
      tbody.appendChild(tr);
      return;
    }
    data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatYMD(item.date)}</td><td>${item.period}</td><td>${item.subject}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 중 오류가 발생했습니다.");
  }
});

// 오늘 급식
qs("loadDailyMealBtn").addEventListener("click", async () => {
  const sel = qs("schoolList").value;
  if (!sel) return alert("학교를 선택하세요.");
  const [officeCode, schoolCode] = sel.split("|");
  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await res.json();
    const el = qs("dailyMeal");
    if (!data || !data.menu) {
      el.textContent = "급식 정보 없음";
      return;
    }
    el.textContent = String(data.menu).replace(/<br\s*\/?>/gi, "\n");
  } catch (err) {
    console.error(err);
    alert("오늘 급식 조회 중 오류가 발생했습니다.");
  }
});

// 월간 급식
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const sel = qs("schoolList").value;
  if (!sel) return alert("학교를 선택하세요.");
  const [officeCode, schoolCode] = sel.split("|");
  const sd = qs("startDate").value;
  const ed = qs("endDate").value;
  if (!sd || !ed) return alert("기간을 입력하세요.");
  const startDate = sd.replace(/-/g, "");
  const endDate = ed.replace(/-/g, "");
  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${startDate}&endDate=${endDate}`);
    const data = await res.json();
    const tbody = qs("monthlyMeal");
    tbody.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2">월간 급식 정보가 없습니다.</td>`;
      tbody.appendChild(tr);
      return;
    }
    data.forEach(item => {
      const d = item.date ? item.date.toString() : "";
      const formatted = d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : d;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatted}</td><td>${(item.menu || "").replace(/<br\s*\/?>/g, ", ")}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
});
