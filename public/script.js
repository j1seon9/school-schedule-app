const qs = (id) => document.getElementById(id);

// 모달 관련
const modal = qs("schoolModal");
const modalList = qs("schoolList");
qs("closeModalBtn").addEventListener("click", () => {
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
});

// 학교 검색
qs("searchSchoolBtn").addEventListener("click", async () => {
  const name = qs("schoolName").value.trim();
  if (!name) return alert("학교명을 입력하세요.");

  const res = await fetch(`/api/searchSchool?name=${encodeURIComponent(name)}`);
  const data = await res.json();

  modalList.innerHTML = "";
  if (!data.length) {
    modalList.innerHTML = "<li>검색 결과 없음</li>";
  } else {
    data.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.name} (${s.kind})`;
      li.addEventListener("click", () => {
        qs("schoolCode").value = s.schoolCode;
        qs("officeCode").value = s.officeCode;
        modal.style.display = "none";
      });
      modalList.appendChild(li);
    });
  }
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
});

// 오늘 시간표
qs("loadTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (!schoolCode || !officeCode || !grade || !classNo)
    return alert("학교/학년/반을 입력하세요.");

  const res = await fetch(
    `/api/dailyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}`
  );
  const data = await res.json();
  const ul = qs("timetable");
  ul.innerHTML = "";

  if (!data.length) {
    ul.innerHTML = "<li>시간표 정보 없음</li>";
  } else {
    data.forEach((x) => {
      const li = document.createElement("li");
      li.textContent = `${x.period}교시: ${x.subject} (${x.teacher})`;
      ul.appendChild(li);
    });
  }
});

// 주간 시간표
qs("loadWeeklyTimetableBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  const grade = qs("weekGrade").value;
  const classNo = qs("weekClassNo").value;
  const startDate = qs("weekStartDate").value.replace(/-/g, "");
  if (!schoolCode || !officeCode || !grade || !classNo || !startDate)
    return alert("모든 정보를 입력하세요.");

  const res = await fetch(
    `/api/weeklyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}&startDate=${startDate}`
  );
  const data = await res.json();
  const container = qs("weeklyTimetable");
  container.innerHTML = "";

  if (!data.length) {
    container.innerHTML = "<p>주간 시간표 없음</p>";
  } else {
    const grouped = {};
    data.forEach((x) => {
      if (!grouped[x.date]) grouped[x.date] = [];
      grouped[x.date].push(x);
    });

    for (const d in grouped) {
      const div = document.createElement("div");
      div.className = "day-block";
      const title = document.createElement("h4");
      title.textContent = d;
      div.appendChild(title);

      grouped[d].forEach((x) => {
        const p = document.createElement("p");
        p.textContent = `${x.period}교시: ${x.subject} (${x.teacher})`;
        div.appendChild(p);
      });

      container.appendChild(div);
    }
  }
});

// 오늘 급식
qs("loadDailyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  const res = await fetch(
    `/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`
  );
  const data = await res.json();
  qs("dailyMeal").textContent = data.menu
    ? data.menu.replace(/<br\s*\/?>/gi, ", ")
    : "급식 정보 없음";
});

// 월간 급식
qs("loadMonthlyMealBtn").addEventListener("click", async () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) return alert("학교를 선택하세요.");

  const res = await fetch(
    `/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`
  );
  const data = await res.json();
  const container = qs("monthlyMeal");
  container.innerHTML = "";

  if (!data.length) {
    container.innerHTML = "<p>급식 정보 없음</p>";
  } else {
    // 달력 구조 (7칸씩 한 주)
    const table = document.createElement("table");
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    days.forEach((d) => {
      const th = document.createElement("th");
      th.textContent = d;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const mealsByDate = {};
    data.forEach((x) => (mealsByDate[x.date] = x.menu));

    const refDate = new Date();
    const year = refDate.getFullYear();
    const month = refDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();

    let tr2 = document.createElement("tr");
    for (let i = 0; i < firstDay; i++) {
      tr2.appendChild(document.createElement("td"));
    }

    for (let d = 1; d <= lastDate; d++) {
      const td = document.createElement("td");
      const dateStr = `${year}${String(month + 1).padStart(2, "0")}${String(d).padStart(2, "0")}`;
      td.innerHTML = `<strong>${d}</strong><br>${mealsByDate[dateStr] ? mealsByDate[dateStr].replace(/<br\s*\/?>/gi, ", ") : ""}`;
      tr2.appendChild(td);
      if ((firstDay + d) % 7 ===
