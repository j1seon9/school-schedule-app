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
  schoolSearchBtn.disabled = true; // 중복 클릭 방지
  try {
    const res = await fetch(`/api/schoolSearch?name=${encodeURIComponent(name)}`);
    const schools = await res.json();
    if (!schools.length) {
      alert('검색된 학교가 없습니다.');
      return;
    }

    // 첫 학교 선택 (추후 여러 학교 선택 UI 개선 가능)
    selectedSchool = schools[0];
    alert(`선택된 학교: ${selectedSchool.SCHUL_NM}`);

    gradeSelect.disabled = false;
    classSelect.disabled = false;

  } catch (e) {
    alert('학교 검색 중 오류가 발생했습니다.');
    console.error(e);
  } finally {
    schoolSearchBtn.disabled = false;
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

    if (!ttRes.ok) throw new Error(`시간표 API 오류: ${ttRes.statusText}`);
    if (!mealRes.ok) throw new Error(`급식 API 오류: ${mealRes.statusText}`);

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

  const tbody = table.createTBody();
  timetable.forEach(item => {
    const row = tbody.insertRow();

    // NEIS API 기본 키, 없으면 빈 문자열로 대체
    const dow = item.DOW || item.DAY_NM || ''; // API별 요일 키 다름에 대비
    const perio = item.PERIO || item.PERIOD || '';
    const subject = item.ITRT_CNTNT || '';
    const teacher = item.PROF_NM || '';

    [dow, perio, subject, teacher].forEach(text => {
      const cell = row.insertCell();
      cell.textContent = text;
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

  // 개행 보존 위해 <pre> 사용, br 태그 전부 \n 으로 변환
  const mealInfo = meal[0].DDISH_NM.replace(/<br\s*\/?>/gi, '\n');
  const pre = document.createElement('pre');
  pre.textContent = mealInfo;
  mealDiv.appendChild(pre);
}
