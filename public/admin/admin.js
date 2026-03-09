const STORAGE_KEY = "admin.credentials.v1";
const REFRESH_INTERVAL_MS = 5000;
const MAX_POINTS = 30;
const LOGIN_PATH = "/admin/login.html";

const totalRequestsEl = document.getElementById("totalRequests");
const todayRequestsEl = document.getElementById("todayRequests");
const cpuLoadEl = document.getElementById("cpuLoad");
const memoryUsageEl = document.getElementById("memoryUsage");
const noticeCountEl = document.getElementById("noticeCount");
const ddosMetaEl = document.getElementById("ddosMeta");
const ddosListEl = document.getElementById("ddosList");
const noticeListEl = document.getElementById("noticeList");

const logoutBtnEl = document.getElementById("logoutBtn");
const authMessageEl = document.getElementById("authMessage");

const addNoticeBtnEl = document.getElementById("addNoticeBtn");
const noticeInputEl = document.getElementById("noticeInput");
const noticeMessageEl = document.getElementById("noticeMessage");

const requestsChartEl = document.getElementById("requestsChart");
const chartLabels = [];
const chartValues = [];

let refreshTimer;
let requestsChart;

function setMessage(el, message, type = "") {
  if (!el) return;
  el.textContent = message;
  el.classList.remove("error", "ok");
  if (type) el.classList.add(type);
}

function redirectToLogin(reason = "") {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  window.location.replace(`${LOGIN_PATH}${query}`);
}

function getSavedCredentials() {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.password) return null;
    return {
      id: String(parsed.id).trim(),
      password: String(parsed.password),
      key: String(parsed.key || "").trim()
    };
  } catch {
    return null;
  }
}

function clearCredentials() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function buildAuthHeaders(creds) {
  const headers = {
    "x-admin-id": creds.id,
    "x-admin-password": creds.password
  };
  if (creds.key) headers["x-admin-key"] = creds.key;
  return headers;
}

function updateAuthUi(loggedIn) {
  if (logoutBtnEl) logoutBtnEl.disabled = !loggedIn;
  if (addNoticeBtnEl) addNoticeBtnEl.disabled = !loggedIn;
  if (noticeInputEl) noticeInputEl.disabled = !loggedIn;
}

async function adminFetch(url, options = {}) {
  const creds = getSavedCredentials();
  if (!creds) {
    redirectToLogin("required");
    const err = new Error("NO_CREDENTIALS");
    err.status = 401;
    throw err;
  }

  const headers = new Headers(options.headers || {});
  for (const [name, value] of Object.entries(buildAuthHeaders(creds))) {
    headers.set(name, value);
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    clearCredentials();
    redirectToLogin("expired");
    const err = new Error("UNAUTHORIZED");
    err.status = 401;
    throw err;
  }

  return response;
}

function initChart() {
  if (typeof Chart === "undefined" || !requestsChartEl) return;

  requestsChart = new Chart(requestsChartEl, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: "총 요청",
          data: chartValues,
          borderColor: "#60a5fa",
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function pushChartPoint(totalRequests) {
  if (!requestsChart) return;

  chartLabels.push(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
  chartValues.push(Number(totalRequests) || 0);

  if (chartLabels.length > MAX_POINTS) {
    chartLabels.shift();
    chartValues.shift();
  }

  requestsChart.update();
}

function renderDdos(data) {
  if (!ddosListEl) return;

  const suspicious = Array.isArray(data?.suspicious) ? data.suspicious : [];
  const rateLimit = Number(data?.rateLimit || 0);
  const threshold = Number(data?.alertThreshold || 0);
  const windowSec = Math.round(Number(data?.windowMs || 0) / 1000);

  if (ddosMetaEl) {
    ddosMetaEl.textContent = `창 ${windowSec}s | 제한 ${rateLimit}/IP | 경고 ${threshold}/IP`;
  }

  if (suspicious.length === 0) {
    ddosListEl.innerHTML = "<li>감지된 이상 요청 없음</li>";
    return;
  }

  ddosListEl.innerHTML = "";
  suspicious.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.ip}: ${item.count} requests`;
    ddosListEl.appendChild(li);
  });
}

async function loadMonitor() {
  const response = await adminFetch("/admin/monitor");
  if (!response.ok) throw new Error("MONITOR_REQUEST_FAILED");

  const data = await response.json();
  const total = Number(data?.traffic?.total || 0);
  const today = Number(data?.traffic?.today || 0);
  const cpuLoad = Number(data?.system?.cpuLoad || 0);
  const memoryMb = Number(data?.system?.memoryMb || 0);
  const notices = Number(data?.notices?.total || 0);

  if (totalRequestsEl) totalRequestsEl.textContent = String(total);
  if (todayRequestsEl) todayRequestsEl.textContent = String(today);
  if (cpuLoadEl) cpuLoadEl.textContent = cpuLoad.toFixed(2);
  if (memoryUsageEl) memoryUsageEl.textContent = memoryMb.toFixed(2);
  if (noticeCountEl) noticeCountEl.textContent = String(notices);

  pushChartPoint(total);
}

async function loadDdos() {
  const response = await adminFetch("/admin/ddos");
  if (!response.ok) throw new Error("DDOS_REQUEST_FAILED");
  const data = await response.json();
  renderDdos(data);
}

async function deleteNotice(id) {
  const response = await adminFetch(`/admin/notices/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("NOTICE_DELETE_FAILED");
}

async function updateNotice(id, text) {
  const response = await adminFetch(`/admin/notices/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!response.ok) throw new Error("NOTICE_UPDATE_FAILED");
}

function renderNoticeList(notices) {
  if (!noticeListEl) return;

  if (!Array.isArray(notices) || notices.length === 0) {
    noticeListEl.innerHTML = "<li>등록된 공지사항이 없습니다.</li>";
    return;
  }

  noticeListEl.innerHTML = "";
  notices.forEach((notice) => {
    const li = document.createElement("li");
    li.className = "notice-item";

    const main = document.createElement("div");
    main.className = "notice-main";

    const date = document.createElement("div");
    date.className = "notice-date";
    date.textContent = notice.date || "-";

    const text = document.createElement("div");
    text.className = "notice-text";
    text.textContent = notice.text || "";

    main.appendChild(date);
    main.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "notice-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "notice-edit";
    edit.textContent = "수정";
    edit.addEventListener("click", async () => {
      const next = prompt("공지사항 수정", notice.text || "");
      if (next === null) return;

      const textValue = next.trim();
      if (!textValue) {
        setMessage(noticeMessageEl, "수정할 내용을 입력하세요.", "error");
        return;
      }

      try {
        await updateNotice(notice.id, textValue);
        setMessage(noticeMessageEl, "공지사항을 수정했습니다.", "ok");
        await loadNotices();
      } catch (error) {
        if (error?.status === 401) return;
        setMessage(noticeMessageEl, "공지사항 수정에 실패했습니다.", "error");
      }
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "notice-delete";
    del.textContent = "삭제";
    del.addEventListener("click", async () => {
      if (!confirm("이 공지사항을 삭제할까요?")) return;
      try {
        await deleteNotice(notice.id);
        setMessage(noticeMessageEl, "공지사항을 삭제했습니다.", "ok");
        await loadNotices();
      } catch (error) {
        if (error?.status === 401) return;
        setMessage(noticeMessageEl, "공지사항 삭제에 실패했습니다.", "error");
      }
    });

    actions.appendChild(edit);
    actions.appendChild(del);

    li.appendChild(main);
    li.appendChild(actions);
    noticeListEl.appendChild(li);
  });
}

async function loadNotices() {
  const response = await adminFetch("/admin/notices");
  if (!response.ok) throw new Error("NOTICE_LIST_FAILED");
  const notices = await response.json();
  renderNoticeList(notices);
}

async function addNotice() {
  const text = String(noticeInputEl?.value || "").trim();
  if (!text) {
    setMessage(noticeMessageEl, "공지 내용을 입력하세요.", "error");
    return;
  }

  try {
    const response = await adminFetch("/admin/notices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!response.ok) throw new Error("NOTICE_CREATE_FAILED");

    if (noticeInputEl) noticeInputEl.value = "";
    setMessage(noticeMessageEl, "공지사항을 등록했습니다.", "ok");
    await loadNotices();
    await loadMonitor();
  } catch (error) {
    if (error?.status === 401) return;
    setMessage(noticeMessageEl, "공지사항 등록에 실패했습니다.", "error");
  }
}

async function refreshDashboard() {
  const results = await Promise.allSettled([loadMonitor(), loadDdos(), loadNotices()]);
  const hasError = results.some((result) => result.status === "rejected" && result.reason?.status !== 401);
  if (hasError) {
    setMessage(noticeMessageEl, "일부 데이터를 불러오지 못했습니다.", "error");
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refreshDashboard();
  }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = undefined;
}

function applyLogout() {
  clearCredentials();
  stopAutoRefresh();
  redirectToLogin("logout");
}

function initEvents() {
  logoutBtnEl?.addEventListener("click", applyLogout);
  addNoticeBtnEl?.addEventListener("click", addNotice);
}

async function init() {
  initChart();
  initEvents();

  const creds = getSavedCredentials();
  if (!creds) {
    redirectToLogin("required");
    return;
  }

  updateAuthUi(true);
  setMessage(authMessageEl, `${creds.id} 계정 인증 완료`, "ok");
  setMessage(noticeMessageEl, "공지 목록을 불러오는 중...");

  try {
    await refreshDashboard();
    startAutoRefresh();
  } catch (error) {
    if (error?.status === 401) return;
    setMessage(authMessageEl, "대시보드 로딩에 실패했습니다.", "error");
  }
}

window.addEventListener("beforeunload", stopAutoRefresh);
init();
