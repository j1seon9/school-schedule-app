// helper
const qs = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const ymdToDisplay = ymd => `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`;

// modal
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");
function openModal(items) {
  modalList.innerHTML = "";
  items.forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${s.name}</strong> <small>(${s.typeName || ''})</small><br/><small>${s.address || ''}</small>`;
    li.addEventListener("click", () => {
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("typeName").value = s.typeName || "";
      modal.setAttribute("aria-hidden", "true");
      modal.style.display = "none";
      // fill defaults
      if (!qs("grade").value) qs("grade").value = 1;
      if (!qs("classNo").value) qs("classNo").value = 1;
      if (!qs("weekGrade").value) qs("weekGrade").value = qs("grade").value;
      if (!qs("weekClassNo").value) qs("weekClassNo").value = qs("classNo").value;
      if (!qs("monthDate").value) {
        const now = new Date();
        qs("monthDate").value = `${now.getFullYear()}-${pad(now.getMonth()+1)}`;
      }
      if (!qs("weekStartDate").value) {
        const d = new Date();
        const day = d.getDay();
        const diffToMon = (day === 0 ? -6 : 1 - day);
        d.setDate(d.getDate() + diffToMon);
        qs("weekStartDate").value = d.toISOString().slice(0,10);
      }
    });
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}
closeModalBtn.addEventListener("click", () => { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; });
modal.addEventListener("click", e => { if (e.target === modal) { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; } });
document.addEventListener("keydown", e => { if (e.key === "Escape") { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; } });

// search school
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

// daily timetable
qs("loadDailyTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const typeName = qs("typeName").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo) return alert("학년/반을 입력하세요.");

  try {
    const url = `/api/dailyTimetable?schoolCode=${encodeURIComponent(schoolCode)}&officeCode=${encodeURIComponent(officeCode)}&grade=${encodeURIComponent(grade)}&classNo=${encodeURIComponent(classNo)}&typeName=${encodeURIComponent(typeName)}`;
    const res = await fetch(url);
    const data = await res.json();
    const box = qs("dailyTimetable");
    box.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      box.innerHTML = `<div class="timetable-cell"><div class="subject">오늘 시간표 정보가 없습니다.</div></div>`;
      return;
    }
    data.forEach(x => {
      const cell = document.createElement("div");
      cell.className = "timetable-cell";
      cell.innerHTML = `<div class="period">${x.period}교시</div><div class="subject">${x.subject || "-"}</div><div class="teacher">${x.teacher || ""}</div>`;
      box.appendChild(cell);
    });
  } catch (err) {
    console.error(err);
    alert("시간표 조회 중 오류가 발생했습니다.");
  }
});

// daily meal
qs("loadDailyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${encodeURIComponent(schoolCode)}&officeCode=${encodeURIComponent(officeCode)}`);
    const data = await res.json();
    const el = qs("dailyMeal");
    let text = String(data.menu || "").replace(/<br\s*\/?>/gi, "\n").trim();
    if (!text) text = "급식 정보 없음 (방학/휴무일 가능)";
    el.textContent = text;
  } catch (err) {
    console.error(err);
    alert("오늘 급식 조회 중 오류가 발생했습니다.");
  }
});

// weekly timetable
qs("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const typeName = qs("typeName").value;
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDate = qs("weekStartDate").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo || !startDate) return alert("학년/반/시작일을 입력하세요.");

  try {
    const url = `/api/weeklyTimetable?schoolCode=${encodeURIComponent(schoolCode)}&officeCode=${encodeURIComponent(officeCode)}&grade=${encodeURIComponent(grade)}&classNo=${encodeURIComponent(classNo)}&startDate=${encodeURIComponent(startDate)}&typeName=${encodeURIComponent(typeName)}`;
    const res = await fetch(url);
    const data = await res.json();
    const weekGrid = qs("weekGrid");
    weekGrid.innerHTML = "";

    // group by date
    const byDate = {};
    data.forEach(x => { (byDate[x.date] ||= []).push(x); });

    // create 5 columns (Mon-Fri) starting from startDate
    const base = new Date(startDate);
    for (let i = 0; i < 5; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      const ymd = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
      const list = (byDate[ymd] || []).sort((a,b) => (Number(a.period)||0)-(Number(b.period)||0));

      const col = document.createElement("div");
      col.className = "week-col";
      col.innerHTML = `<h4>${d.getMonth()+1}/${d.getDate()} (${["일","월","화","수","목","금","토"][d.getDay()]})</h4>`;
      const body = document.createElement("div"); body.className = "col-body";

      if (list.length === 0) {
        body.innerHTML = `<div class="timetable-cell"><div class="subject">수업 정보 없음</div></div>`;
      } else {
        list.forEach(x => {
          const cell = document.createElement("div");
          cell.className = "timetable-cell";
          cell.innerHTML = `<div class="period">${x.period}교시</div><div class="subject">${x.subject || "-"}</div><div class="teacher">${x.teacher || ""}</div>`;
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
});

// monthly meal calendar
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const month = qs("monthDate").value; // "YYYY-MM"
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!month) return alert("조회월을 입력하세요.");

  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${encodeURIComponent(schoolCode)}&officeCode=${encodeURIComponent(officeCode)}&month=${encodeURIComponent(month)}`);
    const data = await res.json();
    renderCalendar(month, data);
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
});

function renderCalendar(month, meals) {
  const calendar = qs("calendar");
  calendar.innerHTML = "";

  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr), mon = Number(monthStr)-1;
  const first = new Date(year, mon, 1);
  const last = new Date(year, mon+1, 0);
  const startWeekDay = first.getDay();

  const mealMap = {};
  (Array.isArray(meals) ? meals : []).forEach(m => { mealMap[m.date] = (m.menu || "").replace(/<br\s*\/?>/gi, "\n"); });

  // leading blanks
  for (let i=0;i<startWeekDay;i++){
    const div = document.createElement("div"); div.className="calendar-day empty"; calendar.appendChild(div);
  }
  for (let d=1; d<=last.getDate(); d++){
    const dateStr = `${year}${pad(mon+1)}${pad(d)}`;
    const div = document.createElement("div"); div.className="calendar-day";
    const mealText = mealMap[dateStr] || "";
    div.innerHTML = `<header>${d}</header><div class="meal">${mealText}</div>`;
    calendar.appendChild(div);
  }

  // if no meals at all, show message
  if (!Object.keys(mealMap).length) {
    const info = document.createElement("div"); info.style.marginTop="8px"; info.textContent="급식 정보 없음 (방학/휴무일 가능)"; calendar.parentElement.appendChild(info);
  }
}
