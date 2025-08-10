const schoolInput = document.getElementById('schoolInput');
const schoolSearchBtn = document.getElementById('schoolSearchBtn');
const gradeSelect = document.getElementById('gradeSelect');
const classSelect = document.getElementById('classSelect');
const timetableDiv = document.getElementById('timetable');
const mealDiv = document.getElementById('meal');

let selectedSchool = null;

schoolSearchBtn.addEventListener('click', async () => {
  const name = schoolInput.value.trim();
  if (!name) {
    alert('학교명을 입력하세요.');
    return;
  }
  try {
    const res = await fetch(`/api/schoolSearch?name=${encodeURIComponent(name)}`);
    const schools = await res.json();
    if (!schools.length) {
      alert('검색된 학교가 없습니다.');
      return;
    }
    selectedSchool = schools[0]; // 첫 학교 선택
    alert(`선택된 학교: ${selectedSchool.SCHUL_NM}`);

    // 학년/반 선택 활성화
    gradeSelect.disabled = false;
    classSelect.disabled = false;

  } catch (e) {
    alert('학교 검색 중 오류가 발생했습니다.');
    console.error(e);
  }
});

async function fetchTimetableAndMeal() {
  if (!selectedSchool) {
    alert('학교를 먼저 선택하세요.');
    return;
  }
  const grade = gradeSelect.value;
  const classNum = classSelect.value;
  if (!grade || !classNum) {
    alert('학년과 반을 모두 선택하세요.');
    return;
  }

  try {
    const [ttRes, mealRes] = await Promise.all([
      fetch(`/api/timetable?schoolCode=${encodeURIComponent(selectedSchool.SD_SCHUL_CODE)}&atptOfcdcScCode=${encodeURIComponent(selectedSchool.ATPT_OFCDC_SC_CODE)}&grade=${encodeURIComponent(grade)}&classNum=${encodeURIComponent(classNum)}`),
      fetch(`/api/meal?schoolCode=${encodeURIComponent(selectedSchool.SD_SCHUL_CODE)}&atptOfcdcScCode=${encodeURIComponent(selectedSchool.ATPT_OFCDC_SC_CODE)}`)
    ]);

    const timetable = await ttRes.json();
    const meal = await mealRes.json();

    displayTimetable(timetable);
    displayMeal(meal);

  } catch (e) {
    alert('시간표 또는 급식 정보를 불러오는 중 오류가 발생했습니다.');
    console.error(e);
  }
}

gradeSelect.addEventListener('change', fetchTimetableAndMeal);
classSelect.addEventListener('change', fetchTimetableAndMeal);

function displayTimetable(timetable) {
  timetableDiv.innerHTML = '';
  if (!timetable.length) {
    timetableDiv.textContent = '시간표 정보가 없습니다.';
    return;
  }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  // 헤더 만들기 (예시)
  const header = table.createTHead();
  const headerRow = header.insertRow();
  ['요일', '교시', '과목', '선생님'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.border = '1px solid #ccc';
    th.style.padding = '0.5em';
    th.style.backgroundColor = '#f5deb3';
    headerRow.appendChild(th);
  });

  // 바디 채우기
  const tbody = table.createTBody();
  timetable.forEach(item => {
    const row = tbody.insertRow();
    ['ITRT_CNTNT', 'PERIO', 'GRADE', 'PROF_NM'].forEach(key => {
      const cell = row.insertCell();
      if (key === 'PERIO') cell.textContent = item[key]; // 교시
      else if (key === 'ITRT_CNTNT') cell.textContent = item[key]; // 과목명
      else if (key === 'PROF_NM') cell.textContent = item[key]; // 선생님
      else if (key === 'GRADE') cell.textContent = item[key] + '학년'; // 학년
      else cell.textContent = item[key] || '';
      cell.style.border = '1px solid #ccc';
      cell.style.padding = '0.4em';
    });
  });

  timetableDiv.appendChild(table);
}

function displayMeal(meal) {
  mealDiv.innerHTML = '';
  if (!meal.length) {
    mealDiv.textContent = '급식 정보가 없습니다.';
    return;
  }
  const mealInfo = meal[0].DDISH_NM.replace(/<br\/>/g, '\n');
  mealDiv.textContent = mealInfo;
}
