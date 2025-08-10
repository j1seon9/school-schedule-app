// script.js

// 학교 검색
document.getElementById("searchSchoolBtn").addEventListener("click", async () => {
  const name = document.getElementById("schoolName").value.trim();
  if (!name) return alert("학교명을 입력하세요.");

  try {
    const res = await fetch(`/api/searchSchool?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    const select = document.getElementById("schoolList");
    select.innerHTML = "";
    if (!data || data.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "검색 결과 없음";
      opt.value = "";
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
document.getElementById("loadTimetableBtn").addEventListener("click", async () => {
  const selected = document.getElementById("schoolList").value;
  if (!selected) return alert("학교를 선택하세요.");
  const [officeCode, schoolCode] = selected.split("|");
  const grade = document.getElementById("grade").value;
  const classNo = document.getElementById("classNo").value;
  if (!grade || !classNo) return alert("학년/반을 입력하세요.");

  try {
    const res = await fetch(`/api/dailyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}`);
    const data = await res.json();
    const ul = document.getElementById("timetable");
    ul.innerHTML = "";
    if (!data || data.length === 0) {
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
document.getElementById("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const selected = document.getElementById("schoolList").value;
  if (!selected) return alert("학교를 선택하세요.");
  const [officeCode, schoolCode] = selected.split("|");
  const grade = document.getElementById("weekGrade").value;
  const classNo = document.getElementById("weekClassNo").value;
  const startDateEl = document.getElementById("weekStartDate");
  if (!grade || !classNo || !startDateEl.value) return alert("학년/반/시작일을 입력하세요.");

  const startDate = startDateEl.value.replace(/-/g, "");
  try {
    const res = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}`);
    const data = await res.json();
    const tbody = document.getElementById("weeklyTimetable");
    tbody.innerHTML = "";
    if (!data || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="3">주간 시간표 정보가 없습니다.</td>`;
      tbody.appendChild(tr);
      return;
    }
    data.forEach(item => {
      const tr = document.createElement("tr");
      // 날짜 포맷: YYYYMMDD -> YYYY-MM-DD
      const d = item.date ? item.date.toString() : "";
      const dateFormatted = d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : d;
      tr.innerHTML = `<td>${dateFormatted}</td><td>${item.period}</td><td>${item.subject}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 중 오류가 발생했습니다.");
  }
});

// 오늘 급식
document.getElementById("loadDailyMealBtn").addEventListener("click", async () => {
  const selected = document.getElementById("schoolList").value;
  if (!selected) return alert("학교를 선택하세요.");
  const [officeCode, schoolCode] = selected.split("|");

  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await res.json();
    const el = document.getElementById("dailyMeal");
    if (!data || !data.menu) {
      el.textContent = "급식 정보 없음";
      return;
    }
    el.textContent = data.menu.replace(/<br\s*\/?>/gi, "\n");
  } catch (err) {
    console.error(err);
    alert("오늘 급식 조회 중 오류가 발생했습니다.");
  }
});

// 월간 급식
document.getElementById("loadMonthlyMealBtn").addEventListener("click", async () => {
  const selected = document.getElementById("schoolList").value;
  if (!selected) return alert("학교를 선택하세요.");
  const [officeCode, schoolCode] = selected.split("|");
  const sd = document.getElementById("startDate").value;
  const ed = document.getElementById("endDate").value;
  if (!sd || !ed) return alert("기간을 입력하세요.");
  const startDate = sd.replace(/-/g, "");
  const endDate = ed.replace(/-/g, "");

  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${startDate}&endDate=${endDate}`);
    const data = await res.json();
    const tbody = document.getElementById("monthlyMeal");
    tbody.innerHTML = "";
    if (!data || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2">월간 급식 정보가 없습니다.</td>`;
      tbody.appendChild(tr);
      return;
    }
    data.forEach(item => {
      const tr = document.createElement("tr");
      const d = item.date ? item.date.toString() : "";
      const dateFormatted = d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : d;
      tr.innerHTML = `<td>${dateFormatted}</td><td>${(item.menu || "").replace(/<br\s*\/?>/gi, ", ")}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
});
