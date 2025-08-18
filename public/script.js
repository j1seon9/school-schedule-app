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
      loadMonthlyMeal();
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

// 오늘 일정
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
    if (!data.length) ul.textContent = "시간표 없음";
    else data.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.period}교시: ${item.subject} (${item.teacher})`;
      ul.appendChild(li);
    });
  } catch (err) { console.error(err); }

  // 오늘 급식
  try {
    const r = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await r.json();
    qs("dailyMeal").textContent = data.menu ? data.menu.replace(/<br\s*\/?>/g, ", ") : "급식 없음";
  } catch (err) { console.error(err); }
});

// 주간 시간표
qs("loadWeeklyBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");

  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1);
  const startDate = monday.toISOString().slice(0,10).replace(/-/g,"");

  try {
    const r = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}`);
    const data = await r.json();
    const grid = qs("weeklyGrid");
    grid.innerHTML = "";
    if (!data.length) return grid.textContent = "주간 시간표 없음";

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
  } catch (err) { console.error(err); }
});

// 월간 급식 자동 로드
async function loadMonthlyMeal() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return;

  const today = new Date();
  const yearMonth = today.toISOString().slice(0,7).replace("-","");
  const start = yearMonth + "01";
  const end = yearMonth + "31";

  try {
    const r = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${start}&endDate=${end}`);
    const data = await r.json();
    const grid = qs("monthlyMealGrid");
    grid.innerHTML = "";

    const meals = {};
    data.forEach(item => meals[item.date] = item.menu ? item.menu.replace(/<br\s*\/?>/g,", ") : "");

    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const startWeekday = firstDay.getDay();
    const lastDate = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();

    for(let i=0; i<startWeekday; i++) grid.appendChild(document.createElement("div"));
    for(let d=1; d<=lastDate; d++){
      const dateStr = yearMonth + String(d).padStart(2,"0");
      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.innerHTML = `<strong>${d}</strong><div>${meals[dateStr] || ""}</div>`;
      grid.appendChild(cell);
    }
  } catch (err) { console.error(err); }
}

// 즐겨찾기
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
  loadMonthlyMeal();
  alert("불러오기 완료");
});
