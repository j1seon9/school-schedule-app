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

function closeModal() {
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
}
function openModal(items) {
  modalList.innerHTML = "";
  items.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name} (${s.schoolType || "학교"})`;
    li.addEventListener("click", () => {
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("schoolType").value = s.schoolType || "";
      closeModal();
      // 사용자 편의: 타입에 따라 기본 학년 범위 힌트(표시는 하지 않음)
    });
    modalList.appendChild(li);
  });
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}

closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// -----------------------------
// 학교 검색
// -----------------------------
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

// -----------------------------
// 오늘 시간표 (하루 묶음)
// -----------------------------
qs("loadTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const schoolType = qs("schoolType").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo) return alert("학년/반을 입력하세요.");

  try {
    const url =
      `/api/dailyTimetable?schoolCode=${encodeURIComponent(schoolCode)}` +
      `&officeCode=${encodeURIComponent(officeCode)}` +
      `&grade=${encodeURIComponent(grade)}` +
      `&classNo=${encodeURIComponent(classNo)}` +
      `&schoolType=${encodeURIComponent(schoolType)}`;

    const res = await fetch(url);
    const data = await res.json();
    const ul = qs("timetable");
    ul.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      ul.textContent = "수업이 없어요(주말/방학 가능).";
      return;
    }

    // data는 [{date, lessons:[...]}]
    const day = data[0];
    const header = document.createElement("li");
    header.style.listStyle = "none";
    header.style.margin = "4px 0 8px";
    header.innerHTML = `<strong>${formatYMD(day.date)}</strong>`;
    ul.appendChild(header);

    day.lessons.forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.period}교시: ${item.subject}${item.teacher ? ` (${item.teacher})` : ""}`;
      ul.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    alert("시간표 조회 중 오류가 발생했습니다.");
  }
});

// -----------------------------
// 주간 시간표 (하루 묶음)
// -----------------------------
qs("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const schoolType = qs("schoolType").value;
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDateEl = qs("weekStartDate");
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");
  if (!grade || !classNo || !startDateEl.value) return alert("학년/반/시작일을 입력하세요.");

  try {
    const url =
      `/api/weeklyTimetable?schoolCode=${encodeURIComponent(schoolCode)}` +
      `&officeCode=${encodeURIComponent(officeCode)}` +
      `&grade=${encodeURIComponent(grade)}` +
      `&classNo=${encodeURIComponent(classNo)}` +
      `&startDate=${encodeURIComponent(startDateEl.value)}` +
      `&schoolType=${encodeURIComponent(schoolType)}`;

    const res = await fetch(url);
    const data = await res.json();
    const tbody = qs("weeklyTimetable");
    tbody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="3">주간 시간표 정보가 없습니다.</td>`;
      tbody.appendChild(tr);
      return;
    }

    data.forEach(day => {
      // 날짜 헤더 행
      const dateRow = document.createElement("tr");
      dateRow.innerHTML = `<td><strong>${formatYMD(day.date)}</strong></td><td></td><td></td>`;
      dateRow.className = "day-header";
      tbody.appendChild(dateRow);

      day.lessons.forEach(lesson => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td></td><td>${lesson.period}교시</td><td>${lesson.subject}${lesson.teacher ? ` (${lesson.teacher})` : ""}</td>`;
        tbody.appendChild(tr);
      });
    });
  } catch (err) {
    console.error(err);
    alert("주간 시간표 조회 중 오류가 발생했습니다.");
  }
});

// -----------------------------
// 오늘 급식
// -----------------------------
qs("loadDailyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${encodeURIComponent(schoolCode)}&officeCode=${encodeURIComponent(officeCode)}`);
    const data = await res.json();
    const el = qs("dailyMeal");
    if (!data || !data.menu) {
      el.textContent = "급식 정보 없음(방학/휴일 가능).";
      return;
    }
    el.textContent = data.menu;
  } catch (err) {
    console.error(err);
    alert("오늘 급식 조회 중 오류가 발생했습니다.");
  }
});

// -----------------------------
// 월간 급식 (조회일 기준)
// -----------------------------
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const ref = qs("mealRefDate").value; // 없으면 서버가 오늘 기준으로 계산
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  try {
    const url =
      `/api/monthlyMeal?schoolCode=${encodeURIComponent(schoolCode)}` +
      `&officeCode=${encodeURIComponent(officeCode)}` +
      (ref ? `&ref=${encodeURIComponent(ref)}` : "");

    const res = await fetch(url);
    const data = await res.json();
    const tbody = qs("monthlyMeal");
    tbody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2">월간 급식 정보가 없습니다.</td>`;
      tbody.appendChild(tr);
      return;
    }

    data.sort((a, b) => a.date.localeCompare(b.date)).forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${formatYMD(item.date)}</td><td class="pre">${item.menu || ""}</td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    alert("월간 급식 조회 중 오류가 발생했습니다.");
  }
});
