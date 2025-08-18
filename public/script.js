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

// 일간 시간표
async function loadDailyTimetable() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");

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
}

// 일간 급식
async function loadDailyMeal() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");

  try {
    const r = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await r.json();
    qs("dailyMeal").textContent = data.menu || "급식 없음";
  } catch (err) {
    console.error(err);
  }
}

// 일간 조회 버튼
qs("loadTodayBtn").addEventListener("click", () => {
  loadDailyTimetable();
  loadDailyMeal();
});

// 주간 시간표
qs("loadWeeklyBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");
  if (!grade || !classNo) return alert("학년/반 입력 필요");

  // 조회 기준 주 월요일~금요일
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1); // 월요일
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4); // 금요일

  const startDate = monday.toISOString().slice(0,10).replace(/-/g,"");
  const endDate = friday.toISOString().slice(0,10).replace(/-/g,"");

  try {
    const r = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}&endDate=${endDate}`);
    const data = await r.json();
    const grid = qs("weeklyGrid");
    grid.innerHTML = "";

    if (!data.length) return grid.textContent = "주간 시간표 없음";

    // 날짜별 그룹
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    Object.keys(grouped).sort().forEach(date => {
      const dayName = ['일','월','화','수','목','금','토'][new Date(date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8)).getDay()];
      const div = document.createElement("div");
      div.className = "week-day";
      div.innerHTML = `<h4>${dayName}요일</h4>`;
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
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");

  const base = new Date();
  const year = base.getFullYear();
  const month = base.getMonth(); // 0~11
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month+1, 0).getDate();
  const startDate = `${year}${String(month+1).padStart(2,'0')}01`;
  const endDate = `${year}${String(month+1).padStart(2,'0')}${lastDate}`;

  try {
    const r = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${startDate}&endDate=${endDate}`);
    const data = await r.json();
    const grid = qs("monthlyMealGrid");
    grid.innerHTML = "";

    const meals = {};
    data.forEach(item => meals[item.date] = item.menu);

    const startWeekday = firstDay.getDay();

    // 빈칸 채우기
    for (let i=0; i<startWeekday; i++) {
      const empty = document.createElement("div");
      grid.appendChild(empty);
    }

    for (let d=1; d<=lastDate; d++) {
      const dateStr = `${year}${String(month+1).padStart(2,"0")}${String(d).padStart(2,"0")}`;
      const cell = document.createElement("div");
      cell.className = "day-cell";
      cell.innerHTML = `<strong>${d}</strong><div>${meals[dateStr] ? meals[dateStr].replace(/<br\/?>/g,", ") : ""}</div>`;
      grid.appendChild(cell);
    }

    // 마지막 빈칸 채우기
    const totalCells = startWeekday + lastDate;
    const remain = 7 - (totalCells % 7);
    if (remain < 7) {
      for (let i=0; i<remain; i++) {
        grid.appendChild(document.createElement("div"));
      }
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
