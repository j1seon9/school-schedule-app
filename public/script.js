// public/script.js

// ===== helpers =====
const qs = (id) => document.getElementById(id);
const formatYMD = (ymd) => {
  const s = String(ymd || "");
  if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  return s;
};
const ymd = (date) => date.toISOString().slice(0,10).replace(/-/g,'');

// LocalStorage Keys
const LS_LAST = "ss:lastSelection";
const LS_FAVORITES = "ss:favorites";

// ===== Modal =====
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");
function openModal(items){
  modalList.innerHTML = "";
  items.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${s.name}</strong> <small>(${s.kindName || ""} · ${s.coeduName || ""})</small><br><small>${s.address || ""}</small>`;
    li.addEventListener("click", ()=>{
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("kindName").value = s.kindName || "";
      // 자동 입력 보조
      tryAutoLoadClass();
      modal.setAttribute("aria-hidden","true");
      modal.style.display="none";
    });
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden","false");
  modal.style.display="flex";
}
function closeModal(){
  modal.setAttribute("aria-hidden","true");
  modal.style.display="none";
}
closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e)=>{ if(e.target===modal) closeModal(); });
document.addEventListener("keydown", (e)=>{ if (e.key==="Escape") closeModal(); });

// ===== 즐겨찾기 =====
function loadFavoritesIntoSelect(){
  const sel = qs("favorites");
  sel.innerHTML = "";
  const favorites = JSON.parse(localStorage.getItem(LS_FAVORITES) || "[]");
  if (favorites.length === 0) {
    const opt = document.createElement("option");
    opt.value = ""; opt.textContent = "즐겨찾기 없음";
    sel.appendChild(opt);
    return;
  }
  favorites.forEach((f, idx)=>{
    const opt = document.createElement("option");
    opt.value = String(idx);
    opt.textContent = `${f.name} (${f.kindName || ""}) / ${f.grade || "-"}-${f.classNo || "-"}`;
    sel.appendChild(opt);
  });
}
function saveFavorite(){
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const kindName = qs("kindName").value;
  const name = (qs("schoolName").value || "").trim();
  const grade = qs("grade").value || qs("weekGrade").value;
  const classNo = qs("classNo").value || qs("weekClassNo").value;
  if (!schoolCode || !officeCode || !name) return alert("학교 선택 후 저장하세요.");

  const favorites = JSON.parse(localStorage.getItem(LS_FAVORITES) || "[]");
  favorites.push({ name, schoolCode, officeCode, kindName, grade, classNo, savedAt: Date.now() });
  localStorage.setItem(LS_FAVORITES, JSON.stringify(favorites));
  loadFavoritesIntoSelect();
  alert("즐겨찾기에 저장했습니다.");
}
function loadFavorite(){
  const sel = qs("favorites");
  const idx = sel.value;
  const favorites = JSON.parse(localStorage.getItem(LS_FAVORITES) || "[]");
  const f = favorites[Number(idx)];
  if (!f) return;
  qs("schoolName").value = f.name;
  qs("schoolCode").value = f.schoolCode;
  qs("officeCode").value = f.officeCode;
  qs("kindName").value = f.kindName || "";
  qs("grade").value = f.grade || "";
  qs("classNo").value = f.classNo || "";
  qs("weekGrade").value = f.grade || "";
  qs("weekClassNo").value = f.classNo || "";
  // 자동 로딩
  runDaily();
  runWeekly();
  runMonthly();
}
function clearFavorite(){
  localStorage.removeItem(LS_FAVORITES);
  loadFavoritesIntoSelect();
  alert("즐겨찾기를 모두 삭제했습니다.");
}
loadFavoritesIntoSelect();

qs("saveFavoriteBtn").addEventListener("click", saveFavorite);
qs("loadFavoriteBtn").addEventListener("click", loadFavorite);
qs("clearFavoriteBtn").addEventListener("click", clearFavorite);

// ===== 마지막 선택 자동 불러오기 =====
function saveLastSelection(){
  const data = {
    schoolName: qs("schoolName").value,
    schoolCode: qs("schoolCode").value,
    officeCode: qs("officeCode").value,
    kindName: qs("kindName").value,
    grade: qs("grade").value,
    classNo: qs("classNo").value
  };
  localStorage.setItem(LS_LAST, JSON.stringify(data));
}
function tryAutoLoadLast(){
  const raw = localStorage.getItem(LS_LAST);
  if (!raw) return;
  const d = JSON.parse(raw);
  qs("schoolName").value = d.schoolName || "";
  qs("schoolCode").value = d.schoolCode || "";
  qs("officeCode").value = d.officeCode || "";
  qs("kindName").value = d.kindName || "";
  qs("grade").value = d.grade || "";
  qs("classNo").value = d.classNo || "";
  qs("weekGrade").value = d.grade || "";
  qs("weekClassNo").value = d.classNo || "";
}
function tryAutoLoadClass(){
  // 초/중/고에 따라 학년 기본값 안내 (선택적)
}

// ===== 학교 검색 =====
qs("searchSchoolBtn").addEventListener("click", async ()=>{
  const name = (qs("schoolName").value || "").trim();
  const kind = qs("filterKind").value;
  const coedu = qs("filterCoedu").value;
  const spec = (qs("filterSpec").value || "").trim();
  if (!name) return alert("학교명을 입력하세요.");

  try {
    const url = `/api/searchSchool?name=${encodeURIComponent(name)}`
      + (kind ? `&kind=${encodeURIComponent(kind)}` : "")
      + (coedu ? `&coedu=${encodeURIComponent(coedu)}` : "")
      + (spec ? `&spec=${encodeURIComponent(spec)}` : "");
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return alert("검색 결과가 없습니다.");
    openModal(data);
  } catch (err) {
    console.error(err);
    alert("학교 검색 중 오류가 발생했습니다.");
  }
});

// ===== 오늘 시간표 =====
qs("loadTimetableBtn").addEventListener("click", runDaily);
async function runDaily(){
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  const kindName = qs("kindName").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo) return alert("학년/반을 입력하세요.");

  try {
    const url = `/api/dailyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&kindName=${encodeURIComponent(kindName)}`;
    const res = await fetch(url);
    const data = await res.json();
    const ul = qs("timetable");
    ul.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      ul.textContent = "시간표 정보가 없습니다.";
      return;
    }
    data.sort((a,b)=>Number(a.period)-Number(b.period));
    data.forEach(item=>{
      const li = document.createElement("li");
      const teacher = item.teacher ? ` (${item.teacher})` : "";
      li.textContent = `${item.period}교시: ${item.subject}${teacher}`;
      ul.appendChild(li);
    });
    saveLastSelection();
  } catch (err) {
    console.error(err);
    alert("시간표 조회 중 오류가 발생했습니다.");
  }
}

// ===== 주간 시간표 (요일 카드로 묶어 표시) =====
qs("loadWeeklyTimetableBtn").addEventListener("click", runWeekly);
async function runWeekly(){
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("weekGrade").value || qs("grade").value;
  const classNo = qs("weekClassNo").value || qs("classNo").value;
  const startDateEl = qs("weekStartDate");
  const kindName = qs("kindName").value;

  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo || !startDateEl.value) return alert("학년/반/시작일을 입력하세요.");

  const startDate = startDateEl.value.replace(/-/g,"");
  try {
    const url = `/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}&kindName=${encodeURIComponent(kindName)}`;
    const res = await fetch(url);
    const data = await res.json();
    const wrap = qs("weeklyWrap");
    wrap.innerHTML = "";

    const days = data?.days || {};
    const dates = Object.keys(days).sort();
    if (dates.length === 0) {
      wrap.innerHTML = `<div class="note">주간 시간표 정보가 없습니다.</div>`;
      return;
    }

    dates.forEach(d=>{
      const list = days[d] || [];
      const card = document.createElement("div");
      card.className = "day-card";
      const title = document.createElement("h4");
      title.textContent = formatYMD(d);
      card.appendChild(title);

      const ul = document.createElement("ul");
      if (list.length === 0) {
        const li = document.createElement("li");
        li.textContent = "수업 없음";
        ul.appendChild(li);
      } else {
        list.forEach(item=>{
          const li = document.createElement("li");
          const teacher = item.teacher ? ` (${item.teacher})` : "";
          li.textContent = `${item.period}교시: ${item.subject}${teacher}`;
          ul.appendChild(li);
        });
      }
      card.appendChild(ul);
      wrap.appendChild(card);
    });

    saveLastSelection();
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 중 오류가 발생했습니다.");
  }
}

// ===== 오늘 급식 =====
qs("loadDailyMealBtn").addEventListener("click", async ()=>{
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await res.json();
    const el = qs("dailyMeal");
    if (!data || !data.menu) { el.textContent = "급식 정보 없음 (방학/휴무일)"; return; }
    el.textContent = String(data.menu).replace(/<br\s*\/?>/gi, "\n");
  } catch (err) {
    console.error(err);
    alert("오늘 급식 조회 중 오류가 발생했습니다.");
  }
});

// ===== 월간 급식 (달력 Grid, 주단위 행) =====
qs("loadMonthlyMealBtn").addEventListener("click", runMonthly);
async function runMonthly(){
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const base = qs("mealBaseDate").value || new Date().toISOString().slice(0,10);
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&baseDate=${base}`);
    const list = await res.json(); // [{date, menu}]
    const map = {};
    list.forEach(r => { map[r.date] = (r.menu || "").replace(/<br\s*\/?>/gi, "\n"); });

    const cal = qs("mealCalendar");
    cal.innerHTML = "";

    // 머리 (일~토)
    const heads = ["일","월","화","수","목","금","토"];
    heads.forEach(h => {
      const hd = document.createElement("div");
      hd.className = "cal-head";
      hd.textContent = h;
      cal.appendChild(hd);
    });

    // 이번 달 범위 만들기
    const d = new Date(base);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-based
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    // 시작 공백 채우기
    for (let i = 0; i < first.getDay(); i++) {
      cal.appendChild(document.createElement("div"));
    }

    // 날짜 칸
    for (let day = 1; day <= last.getDate(); day++) {
      const cell = document.createElement("div");
      cell.className = "cal-cell";
      const thisDate = new Date(year, month, day);
      const ymdKey = ymd(thisDate);

      const dateEl = document.createElement("div");
      dateEl.className = "cal-date";
      dateEl.textContent = String(day);
      cell.appendChild(dateEl);

      const menu = map[ymdKey];
      const menuEl = document.createElement("div");
      menuEl.className = "cal-menu";
      if (menu && menu.trim()) {
        menuEl.textContent = menu;
      } else {
        menuEl.textContent = "급식 정보 없음";
        menuEl.classList.add("cal-muted");
      }
      cell.appendChild(menuEl);

      cal.appendChild(cell);
    }

    saveLastSelection();
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
}

// 초기화: 마지막 선택 불러오기 & 오늘 날짜 넣기
(function init(){
  tryAutoLoadLast();
  const today = new Date().toISOString().slice(0,10);
  const mealBase = qs("mealBaseDate"); if (mealBase) mealBase.value = today;
  const weekStart = qs("weekStartDate"); if (weekStart) weekStart.value = today;
})();
