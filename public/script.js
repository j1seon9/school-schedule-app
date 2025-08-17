// helper
const qs = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const weekday = (d) => ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];

// modal
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
    li.addEventListener("click", () => {
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("typeName").value = s.typeName || "";
      qs("gender").value = s.gender || "";
      qs("address").value = s.address || "";

      // 상단 학교정보 표시
      qs("infoName").textContent = s.name;
      qs("infoType").textContent = s.typeName || "-";
      qs("infoGender").textContent = s.gender || "-";
      qs("infoAddr").textContent = s.address || "-";
      qs("schoolInfo").hidden = false;

      // 기본값 자동 설정
      const now = new Date();
      if (!qs("grade").value) qs("grade").value = 1;
      if (!qs("classNo").value) qs("classNo").value = 1;
      if (!qs("weekGrade").value) qs("weekGrade").value = qs("grade").value;
      if (!qs("weekClassNo").value) qs("weekClassNo").value = qs("classNo").value;

      if (!qs("monthDate").value) {
        qs("monthDate").value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
      }
      if (!qs("weekStartDate").value) {
        const d = new Date();
        const dow = d.getDay();
        const diffToMon = dow === 0 ? -6 : 1 - dow;
        d.setDate(d.getDate() + diffToMon);
        qs("weekStartDate").value = d.toISOString().slice(0, 10);
      }

      modal.setAttribute("aria-hidden", "true");
      modal.style.display = "none";
    });
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}
closeModalBtn.addEventListener("click", () => { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; });
modal.addEventListener("click", (e) => { if (e.target === modal) { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { modal.setAttribute("aria-hidden","true"); modal.style.display="none"; } });

// 학교 검색
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

// 오늘 시간표
qs("loadDailyTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const typeName = qs("typeName").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");
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
});

// 주간 시간표 (월~금)
qs("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const typeName = qs("typeName").value;
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDate = qs("weekStartDate").value;
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");
  if (!grade || !classNo || !startDate) return alert("학년/반/시작일을 입력하세요.");

  try {
    const url = `/api/weeklyTimetable?schoolCode=${encodeURIComponent(schoolCode)}&officeCode=${encodeURIComponent(officeCode)}&grade=${encodeURIComponent(grade)}&classNo=${encodeURIComponent(classNo)}&startDate=${encodeURIComponent(startDate)}&typeName=${encodeURIComponent(typeName)}`;
    const res = await fetch(url);
    const data = await res.json();

    const weekGrid = qs("weekGrid");
    weekGrid.innerHTML = "";

    // 날짜별 그룹
    const byDate = {};
    data.forEach((x) => {
      (byDate[x.date] ||= []).push(x);
    });

    // 월~금 5일 컬럼 생성
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
});

// 월간 급식 (달력)
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const month = qs("monthDate").value; // YYYY-MM
  if (!schoolCode || !officeCode) return alert("학교를 먼저 선택하세요.");
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

  const [y, m] = month.split("-");
  const year = Number(y);
  const mon = Number(m) - 1;
  const first = new Date(year, mon, 1);
  const last = new Date(year, mon + 1, 0);
  const startWeekDay = first.getDay();

  const mealMap = {};
  (Array.isArray(meals) ? meals : []).forEach((x) => {
    mealMap[x.date] = (x.menu || "").replace(/<br\s*\/?>/gi, "\n");
  });

  // 앞쪽 빈칸
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

    div.innerHTML = `<header>${d}</header><div class="meal">${text}</div>`;
    calendar.appendChild(div);
  }

  // 방학/휴무일 안내
  if (!Object.keys(mealMap).length) {
    const info = document.createElement("div");
    info.style.marginTop = "8px";
    info.textContent = "급식 정보 없음 (방학/휴무일 가능)";
    calendar.parentElement.appendChild(info);
  }
}
