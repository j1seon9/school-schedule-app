// public/script.js
const qs = id => document.getElementById(id);
const formatYMD = ymd => {
  const s = String(ymd || "");
  if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  return s;
};
const todayStr = () => new Date().toISOString().slice(0,10);

// modal
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");
function openModal(items) {
  modalList.innerHTML = "";
  items.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${s.name}</strong> <small>(${s.schoolType})</small>`;
    li.addEventListener("click", async () => {
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("schoolType").value = s.schoolType || "";

      modal.setAttribute("aria-hidden", "true");
      modal.style.display = "none";

      // 저장 및 자동 조회
      localStorage.setItem("schoolInfo", JSON.stringify(s));
      // 자동: 오늘 급식 + 1개월 급식
      await loadDailyMeal();
      // 기본 주간 시작일: 오늘 (서버가 월요일로 보정하여 조회)
      qs("weekStartDate").value = todayStr();
    });
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}

closeModalBtn.addEventListener("click", () => { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; });
modal.addEventListener("click", e => { if (e.target === modal) { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; }});
document.addEventListener("keydown", e => { if (e.key === "Escape") { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; }});

// search
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

// daily timetable
qs("loadTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const schoolType = qs("schoolType").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo) return alert("학년/반을 입력하세요.");

  try {
    const params = new URLSearchParams({ schoolCode, officeCode, grade: String(grade), classNo: String(classNo), schoolType }).toString();
    const res = await fetch(`/api/dailyTimetable?${params}`);
    const j = await res.json();

    const meta = qs("timetableMeta");
    const ul = qs("timetable");
    ul.innerHTML = "";

    if (!Array.isArray(j.list) || j.list.length === 0) {
      meta.textContent = j.message || "오늘 시간표 정보가 없습니다.";
      return;
    }

    meta.textContent = `오늘 총 ${j.count}교시 (최대 ${j.maxPeriod}교시)`;
    j.list.sort((a,b) => Number(a.period) - Number(b.period)).forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.period}교시: ${item.subject} ${item.teacher ? `(${item.teacher})` : ""}`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    alert("시간표 조회 중 오류가 발생했습니다.");
  }
});

// weekly timetable
qs("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const schoolType = qs("schoolType").value;
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDate = qs("weekStartDate").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo || !startDate) return alert("학년/반/시작일을 입력하세요.");

  try {
    const params = new URLSearchParams({ schoolCode, officeCode, grade: String(grade), classNo: String(classNo), startDate, schoolType }).toString();
    const res = await fetch(`/api/weeklyTimetable?${params}`);
    const j = await res.json();
    const tbody = qs("weeklyTimetable");
    tbody.innerHTML = "";

    if (!Array.isArray(j.data) || j.data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4">${j.message || j.error || "주간 시간표 정보가 없습니다."}</td>`;
      tbody.appendChild(tr);
      return;
    }

    j.data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatYMD(item.date)}</td><td>${item.period}</td><td>${item.subject}</td><td>${item.teacher || ""}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 중 오류가 발생했습니다.");
  }
});

// daily meal + month
qs("loadDailyMealBtn").addEventListener("click", loadDailyMeal);
async function loadDailyMeal() {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return;

  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const j = await res.json();

    qs("dailyMeal").textContent = j?.today?.menu || "급식 정보 없음";

    const tbody = qs("monthlyMeal");
    tbody.innerHTML = "";
    const month = j.month || [];
    if (!month.length) {
      tbody.innerHTML = `<tr><td colspan="2">급식 정보 없음</td></tr>`;
      return;
    }
    month.sort((a,b) => a.date.localeCompare(b.date)).forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatYMD(row.date)}</td><td>${row.menu}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("급식 조회 중 오류가 발생했습니다.");
  }
}

// init: load saved school and auto load meal
(function init() {
  try {
    const saved = JSON.parse(localStorage.getItem("schoolInfo") || "null");
    if (saved) {
      qs("schoolCode").value = saved.schoolCode;
      qs("officeCode").value = saved.officeCode;
      qs("schoolType").value = saved.schoolType || "";
      qs("weekStartDate").value = todayStr();
      loadDailyMeal();
    }
  } catch (e) {}
})();
