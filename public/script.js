// helper
const qs = id => document.getElementById(id);
const formatYMD = ymd => {
  const s = String(ymd || "");
  if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  return s;
};

// modal elements
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");

// open modal with list
function openModal(items) {
  modalList.innerHTML = "";
  items.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s.name;
    li.tabIndex = 0;
    li.addEventListener("click", () => {
      qs("schoolCode").value = s.code;       // 서버에서 보낸 키명(code)
      qs("officeCode").value = s.region;    // 서버에서 보낸 키명(region)
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
    modal.setAttribute("aria-hidden","true");
    modal.style.display="none";
  }
});

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
      li.textContent = `${item.period}교시:  ${item.subject}`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    alert("시간표 조회 중 오류가 발생했습니다.");
  }
});

// 주간 시간표
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
    const tbody = qs("weeklyTimetable");
    tbody.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="3">주간 시간표 정보가 없습니다.</td>`;
      tbody.appendChild(tr);
      return;
    }
    data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatYMD(item.date)}</td> <td>${item.period}</td> <td>${item.subject}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 중 오류가 발생했습니다.");
  }
});

// 오늘 급식
qs("loadDailyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`);
    const data = await res.json();
    const dailyMealDiv = qs("dailyMeal");
    if (!data.menu) {
      dailyMealDiv.textContent = "오늘 급식 정보가 없습니다.";
    } else {
      dailyMealDiv.textContent = data.menu.replace(/<br\/?>/gi, "\n");
    }
  } catch (err) {
    console.error(err);
    alert("급식 조회 중 오류가 발생했습니다.");
  }
});

// 월간 급식
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const startDate = qs("startDate").value;
  const endDate = qs("endDate").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!startDate || !endDate) return alert("시작일과 종료일을 모두 입력하세요.");

  const sDate = startDate.replace(/-/g, "");
  const eDate = endDate.replace(/-/g, "");

  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${sDate}&endDate=${eDate}`);
    const data = await res.json();
    const tbody = qs("monthlyMeal");
    tbody.innerHTML = "";
    if (!Array.isArray(data) || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2">월간 급식 정보가 없습니다.</td>`;
      tbody.appendChild(tr);
      return;
    }
    data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatYMD(item.date)}</td><td>${item.menu.replace(/<br\/?>/gi, "\n")}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
});

