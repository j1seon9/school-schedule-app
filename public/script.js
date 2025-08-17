// helper
const qs = id => document.getElementById(id);
const formatYMD = ymd => {
  const s = String(ymd || "");
  return s.length === 8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : s;
};

// modal elements
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");

// ===== Modal =====
function openModal(items) {
  modalList.innerHTML = "";
  items.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name} (${s.type})`;
    li.addEventListener("click", () => {
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("schoolType").value = s.type;
      modal.setAttribute("aria-hidden", "true");
      modal.style.display = "none";
      saveFavorite(s); // 자동 즐겨찾기 저장
    });
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}

closeModalBtn.addEventListener("click", () => {
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
  }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    modal.setAttribute("aria-hidden","true");
    modal.style.display="none";
  }
});

// ===== 즐겨찾기 저장 =====
function saveFavorite(school) {
  localStorage.setItem("favoriteSchool", JSON.stringify(school));
}
function loadFavorite() {
  const saved = localStorage.getItem("favoriteSchool");
  if (saved) {
    const s = JSON.parse(saved);
    qs("schoolCode").value = s.schoolCode;
    qs("officeCode").value = s.officeCode;
    qs("schoolType").value = s.type;
    qs("schoolName").value = s.name;
  }
}
qs("favoriteBtn").addEventListener("click", () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("먼저 학교를 선택하세요.");
  const school = {
    name: qs("schoolName").value,
    schoolCode,
    officeCode,
    type: qs("schoolType").value
  };
  saveFavorite(school);
  alert("즐겨찾기에 저장되었습니다.");
});
loadFavorite();

// ===== 학교 검색 =====
qs("searchSchoolBtn").addEventListener("click", async () => {
  const name = (qs("schoolName").value || "").trim();
  if (!name) return alert("학교명을 입력하세요.");
  try {
    const res = await fetch(`/api/searchSchool?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      alert("검색 결과가 없습니다.");
      return;
    }
    openModal(data);
  } catch (err) {
    console.error(err);
    alert("학교 검색 오류");
  }
});

// ===== 오늘 시간표 =====
qs("loadTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
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
      li.textContent = `${item.period}교시: ${item.subject} (${item.teacher || "미정"})`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    alert("시간표 조회 오류");
  }
});

// ===== 주간 시간표 =====
qs("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDateEl = qs("weekStartDate");
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo || !startDateEl.value) return alert("학년/반/시작일을 입력하세요.");

  const startDate = startDateEl.value.replace(/-/g,"");
  try {
    const res = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}`);
    const data = await res.json();
    const grid = qs("weeklyGrid");
    grid.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      grid.textContent = "주간 시간표 정보 없음";
      return;
    }

    // 요일별 묶음
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    Object.keys(grouped).sort().forEach(date => {
      const div = document.createElement("div");
      div.innerHTML = `<strong>${formatYMD(date)}</strong><br>`;
      grouped[date].forEach(it => {
        div.innerHTML += `${it.period}교시: ${it.subject} (${it.teacher || "미정"})<br>`;
      });
      grid.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 오류");
  }
});

// ===== 오늘 급식 =====
qs("loadDailyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await res.json();
    const el = qs("dailyMeal");
    if (!data || !data.menu) { 
      el.textContent = "방학 중 급식 없음"; 
      return; 
    }
    el.textContent = String(data.menu).replace(/<br\s*\/?>/gi, "\n");
  } catch (err) {
    console.error(err);
    alert("오늘 급식 조회 오류");
  }
});

// ===== 월간 급식 (조회일 기준 달) =====
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const startDate = `${year}${String(month).padStart(2,"0")}01`;
  const endDate = `${year}${String(month).padStart(2,"0")}31`;

  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${startDate}&endDate=${endDate}`);
    const data = await res.json();
    const grid = qs("monthlyMealGrid");
    grid.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      grid.textContent = "방학 중 급식 없음";
      return;
    }

    // 날짜별 배치
    const map = {};
    data.forEach(it => { map[it.date] = it.menu; });

    const firstDay = new Date(year, month-1, 1).getDay();
    const lastDate = new Date(year, month, 0).getDate();

    for (let i=0; i<firstDay; i++) {
      grid.appendChild(document.createElement("div"));
    }
    for (let d=1; d<=lastDate; d++) {
      const key = `${year}${String(month).padStart(2,"0")}${String(d).padStart(2,"0")}`;
      const cell = document.createElement("div");
      cell.innerHTML = `<strong>${d}</strong><br>${(map[key]||"").replace(/<br\s*\/?>/g,", ")}`;
      grid.appendChild(cell);
    }
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 오류");
  }
});
