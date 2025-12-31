const qs=id=>document.getElementById(id);
const loading=qs("loading");

function showLoading(){loading.classList.remove("hidden")}
function hideLoading(){loading.classList.add("hidden")}

function nowKST(){
  return new Date(Date.now()+9*60*60*1000);
}
function getMonday(d){
  d=new Date(d);const day=d.getDay()||7;
  d.setDate(d.getDate()-day+1);
  return d.toISOString().slice(0,10);
}
function getMonthFirst(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

/* 다크모드 */
const toggle=qs("darkModeToggle");
function applyTheme(t){
  document.documentElement.dataset.theme=t;
  toggle.textContent=t==="dark"?"☀️":"🌙";
}
toggle.onclick=()=>{
  const t=document.documentElement.dataset.theme==="dark"?"light":"dark";
  localStorage.setItem("theme",t);
  applyTheme(t);
};
applyTheme(localStorage.getItem("theme")||"light");

/* 오늘 */
async function loadToday(){
  showLoading();
  try{
    const sc=qs("schoolCode").value, oc=qs("officeCode").value;
    const g=qs("grade").value, c=qs("classNo").value;
    if(!sc||!oc||!g||!c)return;
    const t=await fetch(`/api/dailyTimetable?schoolCode=${sc}&officeCode=${oc}&grade=${g}&classNo=${c}`).then(r=>r.json());
    qs("dailyTimetable").innerHTML=t.map(i=>`<li>${i.period}교시 ${i.subject}</li>`).join("");
    const m=await fetch(`/api/dailyMeal?schoolCode=${sc}&officeCode=${oc}`).then(r=>r.json());
    qs("dailyMeal").textContent=m.menu||"급식 없음";
  }finally{hideLoading()}
}

/* 주간 */
async function loadWeekly(){
  const sc=qs("schoolCode").value, oc=qs("officeCode").value;
  const g=qs("grade").value, c=qs("classNo").value;
  const base=qs("weekStartDate").value||getMonday(nowKST());
  const r=await fetch(`/api/weeklyTimetable?schoolCode=${sc}&officeCode=${oc}&grade=${g}&classNo=${c}&startDate=${base}`);
  const d=await r.json();
  qs("weeklyGrid").innerHTML=d.map(i=>`<div>${i.date}<br>${i.period}교시 ${i.subject}</div>`).join("");
}

/* 월간 */
async function loadMonthlyMeal(){
  const sc=qs("schoolCode").value, oc=qs("officeCode").value;
  const base=qs("mealMonthDate").value||getMonthFirst(nowKST());
  const y=base.slice(0,4), m=base.slice(5,7);
  const start=`${y}${m}01`;
  const end=`${y}${m}${new Date(y,m,0).getDate()}`;
  const r=await fetch(`/api/monthlyMeal?schoolCode=${sc}&officeCode=${oc}&startDate=${start}&endDate=${end}`);
  const d=await r.json();
  const map={};d.forEach(i=>map[i.date]=i.menu);
  const grid=qs("monthlyMealGrid");grid.innerHTML="";
  const fd=new Date(y,m-1,1).getDay();
  for(let i=0;i<fd;i++)grid.appendChild(document.createElement("div"));
  for(let i=1;i<=new Date(y,m,0).getDate();i++){
    const k=`${y}${m}${String(i).padStart(2,"0")}`;
    grid.innerHTML+=`<div><strong>${i}</strong>${map[k]||""}</div>`;
  }
}
