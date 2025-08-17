// ===== Helpers =====
const qs = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const weekday = (d) => ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];

// storage keys
const LS_FAVORITES = "ssapp:favorites";
const LS_CLASS_FOR_SCHOOL = (schoolCode) => `ssapp:class:${schoolCode}`;

// ===== Modal =====
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");

function openModal(items) {
  modalList.innerHTML = "";
  items.forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${s.name}</strong>
      <small> (${s.typeName || "미상"}, ${s.gender || "미상"})</small><br/>
      <small>${s.address || ""}</small>
    `;
    li.addEventListener("click", () => selectSchool(s));
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}
function closeModal() {
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
}
closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ===== Favorites =====
function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem(LS_FAVORITES) || "[]");
  } catch { return []; }
}
function saveFavorites(list) {
  localStorage.setItem(LS_FAVORITES, JSON.stringify(list));
}
function refreshFavoriteSelect() {
  const sel = qs("favoriteSelect");
  const prev = sel.value;
  sel.innerHTML = `<option value="">⭐ 즐겨찾기</option>`;
  loadFavorites().forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.schoolCode;
    opt.textContent = `${s.name} (${s.typeName || ""})`;
    opt.dataset.payload = JSON.stringify(s);
    sel.appendChild(opt);
  });
  sel.value = prev || "";
}
qs("favoriteSelect").addEventListener("change", (e) => {
  const code = e.target.value;
  if (!code) return;
  const opt = e.target.selectedOptions[0];
  try {
    const s = JSON.parse(opt.dataset.payload);
    selectSchool(s, { autoLoad: true });
  } catch {}
});
qs("addFavoriteBtn").addEventListener("click", () => {
  const s = currentSchool();
  if (!s) return alert("먼저 학교를 선택하세요.");
  const list = loadFavorites();
  if (list.some((x) => x.schoolCode === s.schoolCode)) return alert("이미 즐겨찾기에 있습니다.");
  list.push(s);
  saveFavorites(list);
  refreshFavoriteSelect();
  alert("즐겨찾기에 추가되었습니다.");
});
qs("removeFavoriteBtn").addEventListener("click", () => {
  const sel = qs("favoriteSelect");
  const code = sel.value;
  if (!code) return alert("삭제할 즐겨찾기를 선택하세요.");
  const list = loadFavorites().filter((x) => x.schoolCode !== code);
  saveFavorites(list);
  refreshFavoriteSelect();
  sel.value = "";
  alert("즐겨찾기에서 제거했습니다.");
});

// ===== School state =====
function setSchoolState(s) {
  qs("schoolCode").value = s.schoolCode;
  qs("officeCode").value = s.officeCode;
  qs("typeName").value = s.typeName || "";
  qs("gender").value = s.gender || "";
  qs("address").value = s.address || "";
  qs("infoName").textContent = s.name;
  qs("infoType").textContent = s.typeName || "-";
  qs("infoGender").textContent = s.gender || "-";
  qs("infoAddr").textContent = s.address || "-";
  qs("schoolInfo").hidden = false;
}
function currentSchool() {
  const schoolCode = qs("schoolCode").value;
  if (!schoolCode) return null;
  return {
    name: qs("infoName").textContent,
    schoolCode,
    officeCode: qs("officeCode").value,
    typeName: qs("typeName").value,
    gender: qs("gender").value,
    address: qs("address").value,
  };
}

// 학급 저장/복원
function saveClassForSchool(schoolCode, { grade, classNo }) {
  if (!schoolCode) return;
  localStorage.setItem(LS_CLASS_FOR_SCHOOL(schoolCode), JSON.stringify({ grade, classNo }));
}
function loadClassForSchool(schoolCode) {
  try {
    const raw = localStorage.getItem(LS_CLASS_FOR_SCHOOL(schoolCode));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// 학교 선택 처리 (옵션: autoLoad)
function selectSchool(s, { autoLoad = true } = {}) {
  setSchoolState(s);

  // 기본 입력값
  const now = new Date();
  if (!qs("monthDate").value) qs("monthDate").value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  if (!qs("weekStartDate").value) {
    const d = new Date();
    const dow = d.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diffToMon);
    qs("weekStartDate").value = d.toISOString().slice(0, 10);
  }

  // 학교별 학급 복원
  const saved = loadClassForSchool(s.schoolCode);
  if (saved) {
    qs("grade").value = saved.grade;
    qs("classNo").value = saved.classNo;
    qs("weekGrade").value = saved.grade;
    qs("weekClassNo").value = saved.classNo;
  } else {
    if (!qs("grade").value) qs("grade").value = 1;
    if (!qs("classNo").value) qs("classNo").value = 1;
    qs("weekGrade").value = qs("grade").value;
    qs("weekClassNo").value = qs("classNo").value;
  }

  closeModal();
  refreshFavoriteSelect();

  // 자동 조회
  if (autoLoad) {
    loadDailyTimetable();
    loadDailyMeal();
    loadWeeklyTimetable();
    loadMonthlyMeal();
  }
}

// ===== Search =====
qs("searchSchoolBtn").addEventListener("click", async () => {
  const name = (qs("schoolName").value || "").trim();
  if (!name) return alert("학교명을 입력하세요.");
  try {
    const res = await fetch(`/api/searchSchool?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return alert("검색 결과가 없습니다.");
    openModal(data);
  } catch (err) {
    console.error(err);
    alert("학교 검색 중 오류가 발생했습니다.");
  }
});

// ===== Daily Timetable/Meal =====
async function loadDailyTimetable() {
  const s = currentSchool();
  if (!s) return alert("학교를 먼저 선택하세요.");
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!grade || !classNo) return alert("학년/반을 입력하세요.");

  try {
    const url = `/api/dailyTimetable?schoolCode=${encodeURIComponent(s.schoolCode)}&officeCode=${encodeURIComponent(s.officeCode)}&grade=${encodeURIComponent(grade)}&classNo=${encodeURIComponent(classNo)}&typeName=${encodeURIComponent(s.typeName)}`;
    const res = await fetch(url);
    const data = await res.json();

    // 학급 저장
    saveClassForSchool(s.schoolCode, { grade, classNo });

    const box = qs("dailyTimetable");
    box.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      box.innerHTML = `<div class="timetable-cell"><div class="subject">오늘 시간표 정보가 없습니다.</div></div>`;
      return;
    }
    data.forEach((x) => {
      const cell = document.createElement("div");
      cell.className = "timetable-cell";
      cell.innerHTML = `
        <div class="period">${x.period || "-"}교시</div>
        <div class="subject">${x.subject || "-"}</div>
        <div class="teacher">${x.teacher || ""}</div>
      `;
      box.appendChild(cell);
    });
  } catch (err) {
    console.error(err);
    alert("시간표 조회 중 오류가 발생했습니다.");
  }
}
async function loadDailyMeal() {
  const s = currentSchool();
  if (!s) return alert("학교를 먼저 선택하세요.");
  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${encodeURIComponent(s.schoolCode)}&officeCode=${encodeURIComponent(s.officeCode)}`);
    const data = await res.json();
    const el = qs("dailyMeal");
    const txt = (data?.menu || "").replace(/<br\s*\/?>/gi, "\n").trim();
    el.textContent = txt || "급식 정보 없음";
  } catch (err) {
    console.error(err);
    alert("오늘 급식 조회 중 오류가 발생했습니다.");
  }
}
qs("loadDailyTimetableBtn").addEventListener("click", loadDailyTimetable);
qs("loadDailyMealBtn").addEventListener("click", loadDailyMeal);

// ===== Weekly Timetable =====
async function loadWeeklyTimetable() {
  const s = currentSchool();
  if (!s) return alert("학교를 먼저 선택하세요.");
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDate = qs("weekStartDate").value;
  if (!grade || !classNo || !startDate) return alert("학년/반/시작일을 입력하세요.");

  // 학급 저장(주간에서도 저장)
  saveClassForSchool(s.schoolCode, { grade, classNo });

  try {
    const url = `/api/weeklyTimetable?schoolCode=${encodeURIComponent(s.schoolCode)}&officeCode=${encodeURIComponent(s.officeCode)}&grade=${encodeURIComponent(grade)}&classNo=${encodeURIComponent(classNo)}&startDate=${encodeURIComponent(startDate)}&typeName=${encodeURIComponent(s.typeName)}`;
    const res = await fetch(url);
    const data = await res.json();

    const weekGrid = qs("weekGrid");
    weekGrid.innerHTML = "";

    // 날짜별 그룹
    const byDate = {};
    data.forEach((x) => { (byDate[x.date] ||= []).push(x); });

    // 월~금 5일 컬럼
    const base = new Date(startDate);
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      const list = (byDate[ymd] || []).sort((a, b) => Number(a.period) - Number(b.period));

      const col = document.createElement("div");
      col.className = "week-col";
      col.innerHTML = `<h4>${d.getMonth() + 1}/${d.getDate()} (${weekday(d)})</h4>`;
      const body = document.createElement("div");
      body.className = "col-body";

      if (list.length === 0) {
        body.innerHTML = `<div class="timetable-cell"><div class="subject">수업 정보 없음</div></div>`;
      } else {
        list.forEach((x) => {
          const cell = document.createElement("div");
          cell.className = "timetable-cell";
          cell.innerHTML = `
            <div class="period">${x.period || "-"}교시</div>
            <div class="subject">${x.subject || "-"}</div>
            <div class="teacher">${x.teacher || ""}</div>
          `;
          body.appendChild(cell);
        });
      }
      col.appendChild(body);
      weekGrid.appendChild(col);
    }
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 중 오류가 발생했습니다.");
  }
}
qs("loadWeeklyTimetableBtn").addEventListener("click", loadWeeklyTimetable);

// ===== Monthly Meal =====
async function loadMonthlyMeal() {
  const s = currentSchool();
  if (!s) return alert("학교를 먼저 선택하세요.");
  const month = qs("monthDate").value;
  if (!month) return alert("조회월을 입력하세요.");
  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${encodeURIComponent(s.schoolCode)}&officeCode=${encodeURIComponent(s.officeCode)}&month=${encodeURIComponent(month)}`);
    const data = await res.json();
    renderCalendar(month, data);
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
}
qs("loadMonthlyMealBtn").addEventListener("click", loadMonthlyMeal);

function renderCalendar(month, meals) {
  const calendar = qs("calendar");
  calendar.innerHTML = "";

  const [y, m] = month.split("-");
  const year = Number(y);
  const mon = Number(m) - 1;
  const first = new Date(year, mon, 1);
  const last = new Date(year, mon + 1, 0);
  const startWeekDay = first.getDay();

  const mealMap = {};
  (Array.isArray(meals) ? meals : []).forEach((x) => {
    mealMap[x.date] = (x.menu || "").replace(/<br\s*\/?>/gi, "\n").trim();
  });

  // 앞 빈칸
  for (let i = 0; i < startWeekDay; i++) {
    const div = document.createElement("div");
    div.className = "calendar-day empty";
    calendar.appendChild(div);
  }

  // 날짜 셀
  for (let d = 1; d <= last.getDate(); d++) {
    const dateStr = `${year}${pad(mon + 1)}${pad(d)}`;
    const div = document.createElement("div");
    div.className = "calendar-day";
    const text = mealMap[dateStr] || "";
    div.innerHTML = `<header>${d}</header><div class="meal">${text || ""}</div>`;
    // 탭으로 펼치기/접기
    div.addEventListener("click", () => {
      if (!text) return; // 빈칸은 무시
      div.classList.toggle("expanded");
    });
    calendar.appendChild(div);
  }

  // 방학/휴무일 안내
  const infoEl = document.querySelector(".calendar-info");
  if (infoEl) infoEl.remove();
  if (!Object.keys(mealMap).length) {
    const info = document.createElement("div");
    info.className = "calendar-info";
    info.style.marginTop = "8px";
    info.textContent = "급식 정보 없음 (방학/휴무일 가능)";
    calendar.parentElement.appendChild(info);
  }
}

// ===== Init =====
(function init() {
  refreshFavoriteSelect();
  // 기본 월 설정
  const md = qs("monthDate");
  if (!md.value) {
    const now = new Date();
    md.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }
})();
