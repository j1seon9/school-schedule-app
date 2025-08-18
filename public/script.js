const qs = id => document.getElementById(id);

// 모달
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");

function openModal(items) {
  modalList.innerHTML = "";
  items.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name} (${s.type}, ${s.gender})`;
    li.addEventListener("click", () => {
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("selectedSchool").textContent = `${s.name} (${s.type})`;
      modal.setAttribute("aria-hidden", "true");
    });
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden", "false");
}
closeModalBtn.addEventListener("click", () => modal.setAttribute("aria-hidden","true"));

// 학교 검색
qs("searchSchoolBtn").addEventListener("click", async () => {
  const name = qs("schoolName").value.trim();
  if (!name) return alert("학교명을 입력하세요.");
  try {
    const res = await fetch(`/api/searchSchool?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!data.length) return alert("검색 결과 없음");
    openModal(data);
  } catch (err) {
    console.error(err);
    alert("학교 검색 오류");
  }
});

// 오늘 일정 (시간표 + 급식)
qs("loadTodayBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");

  // 오늘 시간표
  try {
    const r = await fetch(`/api/dailyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}`);
    const data = await r.json();
    const ul = qs("dailyTimetable");
    ul.innerHTML = "";
    if (!data.length) return ul.textContent = "오늘 시간표 없음";
    data.forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${item.period}교시</strong><br/>${item.subject}<br/><span class="teacher">${item.teacher}</span>`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }

  // 오늘 급식
  try {
    const r = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await r.json();
    qs("dailyMeal").textContent = data.menu || "오늘 급식 없음";
  } catch (err) {
    console.error(err);
  }
});

// 주간 시간표
qs("loadWeeklyBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교 선택 필요");

  // 이번 주 월요일 기준 계산
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1); // 월요일
  const startDate = monday.toISOString().slice(0,10).replace(/-/g,"");

  try {
    const r = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}`);
    const data = await r.json();
    const grid = qs("weeklyGrid");
    grid.innerHTML = "";
    if (!data.length) return grid.textContent = "이번 주 시간표 없음";

    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    Object.keys(grouped).forEach(date => {
      const div = document.createElement("div");
      div.className = "week-day";
      const d = new Date(date.slice(0,4)+"-"+date.slice(4,6)+"-"+date.slice(6,8));
      const weekdays = ["일","월","화","수","목","금","토"];
      div.innerHTML = `<h4>${d.getMonth()+1}/${d.getDate()} (${weekdays[d.getDay()]})</h4>`;
      grouped[date].forEach(item => {
        const p = document.createElement("p");
        p.innerHTML = `<strong>${item.period}교시</strong> ${item.subject}<br/><span class="teacher">${item.teacher}</span>`;
        div.appendChild(p);
      });
      grid.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
});

// 월간 급식
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교 선택 필요");

  const today = new Date();
  const base = today.toISOString().slice(0,10);
  const start = base.slice(0,7).replace("-","")+"01";
  const end = base.slice(0,7).replace("-","")+"31";

  try {
    const r = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${start}&endDate=${end}`);
    const data = await r.json();
    const grid = qs("monthlyMealGrid");
    grid.innerHTML = "";

    const meals = {};
    data.forEach(item => meals[item.date] = item.menu);

    const firstDay = new Date(base.slice(0,7)+"-01");
    const startWeekday = firstDay.getDay();
    const lastDate = new Date(firstDay.getFullYear(), firstDay.getMonth()+1,0).getDate();

    for (let i=0;i<startWeekday;i++){
      const empty = document.createElement("div");
      grid.appendChild(empty);
    }

    for (let d=1; d<=lastDate; d++){
      const dateStr = base.slice(0,7).replace("-","")+String(d).padStart(2,"0");
      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.innerHTML = `<strong>${d}</strong><div>${meals[dateStr] ? meals[dateStr].replace(/<br\/?>/g,", ") : ""}</div>`;
      grid.appendChild(cell);
    }
  } catch (err) {
    console.error(err);
  }
});
