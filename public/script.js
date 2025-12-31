// ===== helpers =====
const qs = id => document.getElementById(id);
const formatYMD = ymd =>
  String(ymd || "").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

const loadingEl = qs("loading");

function showLoading() {
  if (loadingEl) loadingEl.classList.remove("hidden");
}

function hideLoading() {
  if (loadingEl) loadingEl.classList.add("hidden");
}

// ===== KST =====
function nowKST() {
  const utc = Date.now();
  return new Date(utc + 9 * 60 * 60 * 1000);
}

// ===== modal =====
const modal = qs("schoolModal");
const modalList = qs("schoolList");
const closeModalBtn = qs("closeModalBtn");

function openModal(items) {
  modalList.innerHTML = "";

  items.forEach(s => {
    const regionText = s.officeName ? `, ${s.officeName}` : "";
    const li = document.createElement("li");

    li.textContent = `${s.name} (${s.type}${s.gender ? ", " + s.gender : ""}${regionText})`;

    li.addEventListener("click", () => {
      qs("schoolCode").value = s.schoolCode;
      qs("officeCode").value = s.officeCode;
      qs("schoolType").value = s.type || "";
      qs("schoolName").value = s.name || "";
      qs("selectedSchool").textContent =
        `${s.name} (${s.type || "학교"}${regionText})`;

      localStorage.setItem("favoriteSchool", JSON.stringify(s));
      closeModal();
      autoQuery();
    });

    modalList.appendChild(li);
  });

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
}

closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", e => {
  if (e.target === modal) closeModal();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

// ===== 즐겨찾기 =====
qs("favoriteBtn").addEventListener("click", () => {
  const schoolCode = qs("schoolCode").value;
  const officeCode = qs("officeCode").value;
  if (!schoolCode || !officeCode) {
    alert("먼저 학교를 선택하세요.");
    return;
  }

  const school = {
    name: qs("schoolName").value,
    schoolCode,
    officeCode,
    type: qs("schoolType").value || ""
  };

  localStorage.setItem("favoriteSchool", JSON.stringify(school));

  const grade = qs("grade").value;
  const classNo = qs("classNo").value;
  if (grade && classNo) {
    localStorage.setItem("favoriteClass", JSON.stringify({ grade, classNo }));
  }

  alert("즐겨찾기에 저장했습니다.");
});

function loadFavorite() {
  try {
    const s = JSON.parse(localStorage.getItem("favoriteSchool") || "null");
    if (s) {
      qs("schoolCode").value = s.schoolCode || "";
      qs("officeCode").value = s.officeCode || "";
      qs("schoolType").value = s.type || "";
      qs("schoolName").value = s.name || "";
      qs("selectedSchool").textContent =
        s.name ? `${s.name} (${s.type || "학교"})` : "";
    }

    const c = JSON.parse(localStorage.getItem("favoriteClass") || "null");
    if (c) {
      qs("grade").value = c.grade || "";
      qs("classNo").value = c.classNo || "";
    }
  } catch {}
}

// ===== 학교 검색 =====
qs("searchSchoolBtn").addEventListener("click", async () => {
  const name = qs("schoolName").value.trim();
  if (!name) {
    alert("학교명을 입력하세요.");
    return;
  }

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
    alert("학교 검색 중 오류");
  }
});

// ===== 오늘 =====
async function loadToday() {
  showLoading();
  try {
    const schoolCode = qs("schoolCode").value;
    const officeCode = qs("officeCode").value;
    const grade = qs("grade").value;
    const classNo = qs("classNo").value;
    if (!schoolCode || !officeCode || !grade || !classNo) return;

    localStorage.setItem("favoriteClass", JSON.stringify({ grade, classNo }));

    // 시간표
    const tRes = await fetch(
      `/api/dailyTimetable?schoolCode=${schoolCode}&officeCode=${officeCode}&grade=${grade}&classNo=${classNo}`
    );
    const tData = await tRes.json();
    const ul = qs("dailyTimetable");
    ul.innerHTML = "";

    if (!Array.isArray(tData) || tData.length === 0) {
      ul.textContent = "시간표 정보 없음";
    } else {
      tData.sort((a, b) => a.period - b.period).forEach(i => {
        const li = document.createElement("li");
        li.textContent = `${i.period}교시: ${i.subject}`;
        ul.appendChild(li);
      });
    }

    // 급식
    const mRes = await fetch(
      `/api/dailyMeal?schoolCode=${schoolCode}&officeCode=${officeCode}`
    );
    const mData = await mRes.json();
    qs("dailyMeal").textContent =
      mData?.menu ? mData.menu.replace(/<br\s*\/?>/gi, "\n") : "방학 중 급식 없음";

  } catch (err) {
    console.error(err);
    alert("오늘 정보 조회 오류");
  } finally {
    hideLoading();
  }
}

// ===== 주간 / 월간 로직은 기존 구조 유지 (정상) =====

async function autoQuery() {
  showLoading();
  try {
    await Promise.all([
      loadToday(),
      loadWeekly(),
      loadMonthlyMeal()
    ]);
  } finally {
    hideLoading();
  }
}

// ===== 초기화 =====
document.addEventListener("DOMContentLoaded", () => {
  loadFavorite();
  setDefaultDates();

  if (qs("schoolCode").value && qs("officeCode").value) {
    autoQuery();
  }
});
