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
    if (!data.length) return ul.textContent = "시간표 없음";
    data.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.period}교시: ${item.subject} (${item.teacher})`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }

  // 오늘 급식
  try {
    const r = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await r.json();
    qs("dailyMeal").textContent = data.menu || "급식 없음";
  } catch (err) {
    console.error(err);
  }
});

// 주간 시간표
qs("loadWeeklyBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDate = qs("weekStartDate").value.replace(/-/g,"");
  if (!startDate) return alert("시작일 선택");

  try {
    const r = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}`);
    const data = await r.json();
    const grid = qs("weeklyGrid");
    grid.innerHTML = "";

    if (!data.length) return grid.textContent = "주간 시간표 없음";

    // 요일별 묶기
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    Object.keys(grouped).forEach(date => {
      const div = document.createElement("div");
      div.className = "week-day";
      div.innerHTML = `<h4>${date}</h4>`;
      grouped[date].forEach(item => {
        const p = document.createElement("p");
        p.textContent = `${item.period}교시: ${item.subject} (${item.teacher})`;
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
  const base = qs("mealMonthDate").value;
  if (!base) return alert("기준일 선택");

  const start = base.slice(0,7).replace("-","")+"01";
  const end = base.slice(0,7).replace("-","")+"31";

  try {
    const r = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${start}&endDate=${end}`);
    const data = await r.json();
    const grid = qs("monthlyMealGrid");
    grid.innerHTML = "";

    // 날짜별 매핑
    const meals = {};
    data.forEach(item => meals[item.date] = item.menu);

    const firstDay = new Date(base.slice(0,7)+"-01");
    const startWeekday = firstDay.getDay();
    const lastDate = new Date(firstDay.getFullYear(), firstDay.getMonth()+1, 0).getDate();

    // 빈칸
    for (let i=0; i<startWeekday; i++) {
      grid.appendChild(document.createElement("div"));
    }

    for (let d=1; d<=lastDate; d++) {
      const dateStr = base.slice(0,7).replace("-","") + String(d).padStart(2,"0");
      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.innerHTML = `<strong>${d}</strong><div>${meals[dateStr] ? meals[dateStr].replace(/<br\/?>/g,", ") : ""}</div>`;
      grid.appendChild(cell);
    }
  } catch (err) {
    console.error(err);
  }
});

// 즐겨찾기 저장/불러오기
qs("saveFavorite").addEventListener("click", () => {
  localStorage.setItem("favorite", JSON.stringify({
    schoolCode: qs("schoolCode").value,
    officeCode: qs("officeCode").value,
    grade: qs("grade").value,
    classNo: qs("classNo").value
  }));
  alert("저장 완료");
});
qs("loadFavorite").addEventListener("click", () => {
  const fav = JSON.parse(localStorage.getItem("favorite")||"{}");
  if (!fav.schoolCode) return alert("저장된 즐겨찾기 없음");
  qs("schoolCode").value = fav.schoolCode;
  qs("officeCode").value = fav.officeCode;
  qs("grade").value = fav.grade;
  qs("classNo").value = fav.classNo;
  alert("불러오기 완료");
});
