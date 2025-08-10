// app.js

let selectedSchool = null;
let selectedOffice = null;

// 학교 검색 버튼
document.getElementById("schoolSearchBtn").addEventListener("click", async () => {
  const schoolName = document.getElementById("schoolInput").value.trim();
  if (!schoolName) {
    alert("학교명을 입력하세요.");
    return;
  }

  try {
    const res = await fetch(`/api/searchSchool?name=${encodeURIComponent(schoolName)}`);
    const data = await res.json();

    if (data.length > 0) {
      selectedSchool = data[0].SD_SCHUL_CODE;
      selectedOffice = data[0].ATPT_OFCDC_SC_CODE;
      document.getElementById("gradeSelect").disabled = false;
      document.getElementById("classSelect").disabled = false;
      alert(`"${data[0].SCHUL_NM}" 학교가 선택되었습니다.`);
    } else {
      alert("학교를 찾을 수 없습니다.");
    }
  } catch (error) {
    console.error(error);
    alert("학교 검색 중 오류가 발생했습니다.");
  }
});

// 학년/반 선택 시 데이터 불러오기
document.getElementById("classSelect").addEventListener("change", () => {
  const grade = document.getElementById("gradeSelect").value;
  const classNo = document.getElementById("classSelect").value;

  if (grade && classNo && selectedSchool && selectedOffice) {
    fetchTimetable(selectedSchool, selectedOffice, grade, classNo);
    fetchDailyMeal(selectedSchool, selectedOffice);
    const today = new Date();
    fetchMonthlyMeal(selectedSchool, selectedOffice, today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'));
  }
});

// 시간표 불러오기
async function fetchTimetable(schoolCode, officeCode, grade, classNo) {
  try {
    const res = await fetch(`/api/timetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}`);
    const data = await res.json();

    if (data.length > 0) {
      document.getElementById("timetable").innerHTML = data.map(d => `<div>${d.PERIO}교시: ${d.ITRT_CNTNT}</div>`).join("");
    } else {
      document.getElementById("timetable").innerHTML = "조회된 시간표가 없습니다.";
    }
  } catch (error) {
    console.error(error);
    document.getElementById("timetable").innerHTML = "시간표를 불러오지 못했습니다.";
  }
}

// 오늘 급식 불러오기
async function fetchDailyMeal(schoolCode, officeCode) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  try {
    const res = await fetch(`/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&date=${dateStr}`);
    const data = await res.json();

    if (data && data.menu) {
      document.getElementById("meal").innerHTML = data.menu.replace(/<br\s*\/?>/gi, ', ');
    } else {
      document.getElementById("meal").innerHTML = "조회된 급식표가 없습니다.";
    }
  } catch (error) {
    console.error(error);
    document.getElementById("meal").innerHTML = "급식표를 불러오지 못했습니다.";
  }
}

// 월간 급식 불러오기
async function fetchMonthlyMeal(schoolCode, officeCode, year, month) {
  const startDate = `${year}${month}01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}${month}${String(lastDay).padStart(2, '0')}`;

  try {
    const res = await fetch(`/api/monthlyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}&startDate=${startDate}&endDate=${endDate}`);
    const data = await res.json();

    if (data && data.length > 0) {
      const mealHTML = data.map(day =>
        `<div class="meal-day">
          <strong>${day.date}</strong><br>${day.menu.replace(/<br\s*\/?>/gi, ', ')}
        </div>`
      ).join('');
      document.getElementById("monthlyMeal").innerHTML = mealHTML;
    } else {
      document.getElementById("monthlyMeal").innerHTML = "월간 급식 정보가 없습니다.";
    }
  } catch (error) {
    console.error(error);
    document.getElementById("monthlyMeal").innerHTML = "월간 급식 정보를 불러오지 못했습니다.";
  }
}
