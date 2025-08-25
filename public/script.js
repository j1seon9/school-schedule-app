// ===== helpers =====
const qs = id => document.getElementById(id);
const formatYMD = ymd => String(ymd||"").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

// KST 보정
function nowKST() {
  const utc = Date.now();
  return new Date(utc + 9 * 60 * 60 * 1000);
}

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
      // 선택시 값 세팅 + 즐겨찾기 저장
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("schoolType").value = s.type || "";
      qs("selectedSchool").textContent = `${s.name} (${s.type || "학교"})`;
      qs("schoolName").value = s.name || "";
      localStorage.setItem("favoriteSchool", JSON.stringify(s));
      closeModal();
      // 선택 즉시 자동조회
      autoQuery();
    });
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal.setAttribute("aria-hidden", "true");
}
closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// ===== 즐겨찾기 저장/불러오기 =====
qs("favoriteBtn").addEventListener("click", () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("먼저 학교를 선택하세요.");
  const school = {
    name: qs("schoolName").value || qs("selectedSchool").textContent,
    schoolCode,
    officeCode,
    type: qs("schoolType").value || "",
  };
  localStorage.setItem("favoriteSchool", JSON.stringify(school));

  // 학급도 함께 저장
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (grade && classNo) {
    localStorage.setItem("favoriteClass", JSON.stringify({ grade, classNo }));
  }
  alert("즐겨찾기에 저장했습니다.");
});

function loadFavorite() {
  const savedSchool = localStorage.getItem("favoriteSchool");
  if (savedSchool) {
    try {
      const s = JSON.parse(savedSchool);
      qs("schoolCode").value  = s.schoolCode || "";
      qs("officeCode").value  = s.officeCode || "";
      qs("schoolType").value  = s.type || "";
      qs("schoolName").value  = s.name || "";
      qs("selectedSchool").textContent = s.name ? `${s.name} (${s.type || "학교"})` : "";
    } catch (_) {}
  }
  const savedClass = localStorage.getItem("favoriteClass");
  if (savedClass) {
    try {
      const c = JSON.parse(savedClass);
      qs("grade").value   = c.grade || "";
      qs("classNo").value = c.classNo || "";
    } catch (_) {}
  }
}

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
async function loadToday() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode || !grade || !classNo) return;

  // 학급 자동 저장
  localStorage.setItem("favoriteClass", JSON.stringify({ grade, classNo }));

  // 시간표
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

  // 급식
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
}
qs("loadTodayBtn").addEventListener("click", loadToday);

// ===== 주간 시간표 (조회일 → 월요일로 보정) =====
async function loadWeekly() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("weekGrade") ? qs("weekGrade").value : qs("grade").value;
  const classNo = qs("weekClassNo") ? qs("weekClassNo").value : qs("classNo").value;
  const startDateEl = qs("weekStartDate");
  if (!schoolCode || !officeCode || !grade || !classNo || !startDateEl.value) return;

  // 🟢 조회 날짜를 항상 월요일로 보정 + input 값도 수정
  const selDate = new Date(startDateEl.value);
  const day = selDate.getDay(); // 0=일, 1=월 ...
  const diff = day === 0 ? -6 : 1 - day;
  selDate.setDate(selDate.getDate() + diff);
  const mondayStr = selDate.toISOString().slice(0,10);
  startDateEl.value = mondayStr; // input 값 보정
  const startDate = mondayStr.replace(/-/g,"");

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
}
qs("loadWeeklyBtn").addEventListener("click", loadWeekly);

// ===== 월간 급식 =====
async function loadMonthlyMeal() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  let base = qs("mealMonthDate").value;
  const grid = qs("monthlyMealGrid");
  grid.innerHTML = "";

  if (!schoolCode || !officeCode) return;

  if (!base) {
    const k = nowKST();
    base = `${k.getFullYear()}-${String(k.getMonth()+1).padStart(2,"0")}-01`;
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

    const map = {};
    data.forEach(it => { map[it.date] = it.menu; });

    // 그리드 생성
    const firstDay = new Date(year, month-1, 1).getDay();
    for (let i=0; i<firstDay; i++) grid.appendChild(document.createElement("div"));
    for (let d=1; d<=last; d++) {
      const key = `${year}${String(month).padStart(2,"0")}${String(d).padStart(2,"0")}`;
      const cell = document.createElement("div");
      const menu = (map[key]||"").replace(/<br\s*\/?>/gi, ", ");
      cell.innerHTML = `<strong>${d}</strong>${menu}`;
      grid.appendChild(cell);
    }
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
}
qs("loadMonthlyMealBtn").addEventListener("click", loadMonthlyMeal);

// ===== 날짜 기본값(KST) + 자동조회 =====
function setDefaultDates() {
  const k = nowKST();

  // 월간: 이번 달 1일
  const monthEl = qs("mealMonthDate");
  if (monthEl && !monthEl.value) {
    monthEl.value = `${k.getFullYear()}-${String(k.getMonth()+1).padStart(2,"0")}-01`;
  }

  // 주간: 이번 주 월요일
  const weekEl = qs("weekStartDate");
  if (weekEl && !weekEl.value) {
    const day = k.getDay(); // 0=일, 1=월 ...
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(k);
    monday.setDate(k.getDate() + diff);
    weekEl.value = monday.toISOString().slice(0,10);
  }
}

async function autoQuery() {
  // 즐겨찾기/입력값 기준으로 자동 조회
  await Promise.all([
    loadToday(),
    loadWeekly(),
    loadMonthlyMeal()
  ]);
}

// ===== 초기화 =====
document.addEventListener("DOMContentLoaded", async () => {
  loadFavorite();
  setDefaultDates();
  // 즐겨찾기만 있어도 자동조회, 학급까지 있으면 시간표까지 바로 뜸
  const hasSchool = qs("schoolCode").value && qs("officeCode").value;
  if (hasSchool) {
    autoQuery();
  }
});
