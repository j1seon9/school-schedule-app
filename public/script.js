// ===== helpers =====
const qs = id => document.getElementById(id);
const formatYMD = ymd => String(ymd||"").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

// ===== modal =====
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");

function openModal(items) {
  modalList.innerHTML = "";
  items.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name} (${s.type}${s.gender ? ", " + s.gender : ""})`;
    li.addEventListener("click", () => {
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("schoolType").value = s.type || "";
      qs("selectedSchool").textContent = `${s.name} (${s.type || "학교"})`;
      // 자동 즐겨찾기 저장
      localStorage.setItem("favoriteSchool", JSON.stringify(s));
      modal.setAttribute("aria-hidden", "true");
      modal.style.display = "none";
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
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
  }
});

// ===== favorite button =====
qs("favoriteBtn").addEventListener("click", () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("먼저 학교를 선택하세요.");
  const school = {
    name: qs("selectedSchool").textContent || qs("schoolName").value,
    schoolCode, officeCode, type: qs("schoolType").value
  };
  localStorage.setItem("favoriteSchool", JSON.stringify(school));
  alert("즐겨찾기에 저장했습니다.");
});

// 초기 즐겨찾기 불러오기
(function loadFavorite() {
  const saved = localStorage.getItem("favoriteSchool");
  if (!saved) return;
  try {
    const s = JSON.parse(saved);
    qs("schoolCode").value = s.schoolCode || "";
    qs("officeCode").value = s.officeCode || "";
    qs("schoolType").value = s.type || "";
    qs("schoolName").value = s.name || "";
    qs("selectedSchool").textContent = s.name ? `${s.name} (${s.type || "학교"})` : "";
  } catch (_) {}
})();

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
    alert("학교 검색 중 오류가 발생했습니다.");
  }
});

// ===== 오늘 일정 (시간표 + 급식) =====
qs("loadTodayBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo) return alert("학년/반을 입력하세요.");

  // 오늘 시간표
  try {
    const res = await fetch(`/api/dailyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}`);
    const data = await res.json();
    const ul = qs("dailyTimetable");
    ul.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      ul.textContent = "시간표 정보가 없습니다.";
    } else {
      data.sort((a,b)=>Number(a.period)-Number(b.period)).forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.period}교시: ${item.subject}`;
        ul.appendChild(li);
      });
    }
  } catch (err) {
    console.error(err);
    alert("시간표 조회 중 오류가 발생했습니다.");
  }

  // 오늘 급식
  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await res.json();
    const el = qs("dailyMeal");
    if (!data || !data.menu) {
      el.textContent = "방학 중 급식 없음";
    } else {
      el.textContent = String(data.menu).replace(/<br\s*\/?>/gi, "\n");
    }
  } catch (err) {
    console.error(err);
    alert("오늘 급식 조회 중 오류가 발생했습니다.");
  }
});

// ===== 주간 시간표 (5일) =====
qs("loadWeeklyBtn").addEventListener("click", async () => {
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

    // 날짜별 묶음
    const grouped = {};
    data.forEach(item => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });

    Object.keys(grouped).sort().forEach(date => {
      const div = document.createElement("div");
      div.innerHTML = `<strong>${formatYMD(date)}</strong>`;
      grouped[date]
        .sort((a,b)=>Number(a.period)-Number(b.period))
        .forEach(it => {
          const p = document.createElement("div");
          p.textContent = `${it.period}교시: ${it.subject}`;
          div.appendChild(p);
        });
      grid.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 중 오류가 발생했습니다.");
  }
});

// ===== 월간 급식 (기준일 달 자동) =====
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  let base = qs("mealMonthDate").value;
  const grid = qs("monthlyMealGrid");
  grid.innerHTML = "";

  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  // 기준일 미입력 시 오늘 날짜
  if (!base) {
    const d = new Date();
    base = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
    qs("mealMonthDate").value = base;
  }

  const year = Number(base.slice(0,4));
  const month = Number(base.slice(5,7));
  const start = `${year}${String(month).padStart(2,"0")}01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year}${String(month).padStart(2,"0")}${String(last).padStart(2,"0")}`;

  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${start}&endDate=${end}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      grid.textContent = "방학 중 급식 없음";
      return;
    }

    // 날짜→메뉴 맵
    const map = {};
    data.forEach(it => { map[it.date] = it.menu; });

    // 달력 배치
    const firstDay = new Date(year, month-1, 1).getDay();
    for (let i=0; i<firstDay; i++) grid.appendChild(document.createElement("div"));
    for (let d=1; d<=last; d++) {
      const key = `${year}${String(month).padStart(2,"0")}${String(d).padStart(2,"0")}`;
      const cell = document.createElement("div");
      cell.innerHTML = `<strong>${d}</strong>${(map[key]||"").replace(/<br\s*\/?>/g, ", ")}`;
      grid.appendChild(cell);
    }
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
});

