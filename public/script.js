const qs = id => document.getElementById(id);

// --- 모달 요소 ---
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");

// --- 모달 열기 ---
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

// --- 모달 닫기 ---
closeModalBtn.addEventListener("click", () => modal.setAttribute("aria-hidden","true"));

// --- 학교 검색 버튼 ---
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

// --- 오늘 날짜 ---
function getToday() {
  const today = new Date();
  return today.toISOString().slice(0,10).replace(/-/g,"");
}

// --- 일간 급식 조회 ---
async function loadDailyMeal() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");
  try {
    const date = getToday();
    const r = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&date=${date}`);
    const data = await r.json();
    qs("dailyMeal").textContent = data.menu || "급식 없음";
  } catch (err) {
    console.error(err);
  }
}

// --- 주간 급식 조회 ---
async function loadWeeklyMeal() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");

  // 이번 주 월요일 계산
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  const startDate = monday.toISOString().slice(0,10).replace(/-/g,"");

  try {
    const r = await fetch(`/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${startDate}`);
    const data = await r.json();
    const grid = qs("weeklyGrid");
    grid.innerHTML = "";
    if (!data.length) return grid.textContent = "주간 급식 없음";

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
        p.textContent = item.menu;
        div.appendChild(p);
      });
      grid.appendChild(div);
    });
  } catch (err) {
    console.error(err);
  }
}

// --- 초기 로딩 ---
window.addEventListener("DOMContentLoaded", () => {
  loadDailyMeal();
  loadWeeklyMeal();
});
