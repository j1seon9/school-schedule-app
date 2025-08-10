// 학교 검색
document.getElementById("searchSchoolBtn").addEventListener("click", async () => {
  const name = document.getElementById("schoolName").value.trim();
  if (!name) return alert("학교명을 입력하세요.");

  const res = await fetch(`/api/searchSchool?name=${encodeURIComponent(name)}`);
  const data = await res.json();

  const select = document.getElementById("schoolList");
  select.innerHTML = "";
  data.forEach(school => {
    const option = document.createElement("option");
    option.value = `${school.officeCode}|${school.schoolCode}`;
    option.textContent = school.name;
    select.appendChild(option);
  });
});

// 오늘 시간표 조회
document.getElementById("loadTimetableBtn").addEventListener("click", async () => {
  const selectedSchool = document.getElementById("schoolList").value;
  if (!selectedSchool) return alert("학교를 선택하세요.");

  const [officeCode, schoolCode] = selectedSchool.split("|");
  const grade = document.getElementById("grade").value;
  const classNo = document.getElementById("classNo").value;

  const res = await fetch(`/api/dailyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}`);
  const data = await res.json();

  const ul = document.getElementById("timetable");
  ul.innerHTML = "";
  data.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.period}교시: ${item.subject}`;
    ul.appendChild(li);
  });
});

// 주간 시간표 조회
document.getElementById("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const selectedSchool = document.getElementById("schoolList").value;
  if (!selectedSchool) return alert("학교를 선택하세요.");

  const [officeCode, schoolCode] = selectedSchool.split("|");
  const grade = document.getElementById("weekGrade").value;
  const classNo = document.getElementById("weekClassNo").value;
  const startDate = document.getElementById("weekStartDate").value.replace(/-/g, "");

  if (!grade || !classNo || !startDate) return alert("모든 값을 입력하세요.");

  const res = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}`);
  const data = await res.json();

  const tbody = document.getElementById("weeklyTimetable");
  tbody.innerHTML = "";
  data.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${item.date}</td><td>${item.period}</td><td>${item.subject}</td>`;
    tbody.appendChild(tr);
  });
});

// 오늘 급식
document.getElementById("loadDailyMealBtn").addEventListener("click", async () => {
  const selectedSchool = document.getElementById("schoolList").value;
  if (!selectedSchool) return alert("학교를 선택하세요.");

  const [officeCode, schoolCode] = selectedSchool.split("|");

  const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
  const data = await res.json();

  document.getElementById("dailyMeal").innerHTML = data.menu || "급식 정보 없음";
});

// 월간 급식 조회
document.getElementById("loadMonthlyMealBtn").addEventListener("click", async () => {
  const selectedSchool = document.getElementById("schoolList").value;
  if (!selectedSchool) return alert("학교를 선택하세요.");

  const [officeCode, schoolCode] = selectedSchool.split("|");
  const startDate = document.getElementById("startDate").value.replace(/-/g, "");
  const endDate = document.getElementById("endDate").value.replace(/-/g, "");

  if (!startDate || !endDate) return alert("기간을 입력하세요.");

  const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${startDate}&endDate=${endDate}`);
  const data = await res.json();

  const tbody = document.getElementById("monthlyMeal");
  tbody.innerHTML = "";
  data.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${item.date}</td><td>${item.menu.replace(/<br\s*\/?>/g, ", ")}</td>`;
    tbody.appendChild(tr);
  });
});
