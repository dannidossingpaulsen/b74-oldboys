const CONFIG = window.B74_SUPABASE;
let data = structuredClone(window.B74_DATA);
let players = data.players;
let goalkeepers = data.goalkeepers || ["Danni","Ugle"];
const TEAM = "B74 Silkeborg";
const sb = window.supabase.createClient(CONFIG.url, CONFIG.key);

const matchSelect = document.getElementById("matchSelect");
const participants = document.getElementById("participants");
const loginStatus = document.getElementById("loginStatus");
const saveStatus = document.getElementById("saveStatus");

function matchName(m){ return `${m.hjemmehold} - ${m.udehold}`; }
function fmtDate(iso){ return new Date(iso).toLocaleDateString("da-DK", {day:"2-digit", month:"short"}); }

function setAdminVisible(isVisible) {
  document.querySelectorAll(".admin-panel").forEach(el => {
    el.style.display = isVisible ? "" : "none";
  });
}

async function loadRemoteData() {
  const { data: row, error } = await sb.from(CONFIG.table).select("data").eq("id", CONFIG.rowId).single();
  if (!error && row && row.data && row.data.matches) {
    data = structuredClone(row.data);
    players = data.players;
    goalkeepers = data.goalkeepers || ["Danni","Ugle"];
  }
}

async function checkSession() {
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;
  const ok = user && user.email === CONFIG.adminEmail;
  document.getElementById("logoutButton").style.display = user ? "" : "none";
  if (ok) {
    loginStatus.textContent = `Logget ind som ${user.email}`;
    setAdminVisible(true);
    await loadRemoteData();
    buildMatchOptions();
    loadMatch();
  } else {
    setAdminVisible(false);
    loginStatus.textContent = user ? `Du er logget ind som ${user.email}, men den mail har ikke admin-adgang.` : "Ikke logget ind.";
  }
}

async function sendLoginLink() {
  const email = document.getElementById("emailInput").value.trim();
  loginStatus.textContent = "Sender login-link...";
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split("#")[0] }
  });
  loginStatus.textContent = error ? "Fejl: " + error.message : "Login-link sendt. Tjek din mail.";
}

async function logout() {
  await sb.auth.signOut();
  await checkSession();
}

function options(list, selected=""){
  return list.map(p => `<option value="${p}" ${p===selected ? "selected":""}>${p}</option>`).join("");
}
function playerOptions(selected=""){ return options(players, selected); }
function goalkeeperOptions(selected=""){ return options(goalkeepers, selected); }

function addSelectRow(containerId, value="", note="", withNote=false){
  const wrap = document.createElement("div");
  wrap.className = "event-row";
  wrap.innerHTML = withNote
    ? `<div><select>${playerOptions(value)}</select><textarea placeholder="Kort forklaring">${note || ""}</textarea></div><button class="button ghost" type="button">Fjern</button>`
    : `<select>${playerOptions(value)}</select><button class="button ghost" type="button">Fjern</button>`;
  wrap.querySelector("button").addEventListener("click", ()=>wrap.remove());
  document.getElementById(containerId).appendChild(wrap);
}

function addGoalkeeperRow(value="", goalsAgainst="", cleanSheet=false){
  const wrap = document.createElement("div");
  wrap.className = "event-row goalkeeper-row";
  wrap.innerHTML = `
    <select>${goalkeeperOptions(value)}</select>
    <input type="number" min="0" placeholder="Mål imod" value="${goalsAgainst ?? ""}">
    <label class="check" style="margin:0;color:var(--text);font-weight:700"><input type="checkbox" ${cleanSheet ? "checked":""}> Clean sheet</label>
    <button class="button ghost" type="button">Fjern</button>
  `;
  wrap.querySelector("button").addEventListener("click", ()=>wrap.remove());
  document.getElementById("goalkeeperRows").appendChild(wrap);
}

function getSelectValues(containerId){
  return [...document.querySelectorAll(`#${containerId} select`)].map(s=>s.value).filter(Boolean);
}
function getBoehValues(){
  return [...document.querySelectorAll("#boehRows .event-row")].map(row => ({
    navn: row.querySelector("select").value,
    note: row.querySelector("textarea").value.trim()
  })).filter(x=>x.navn);
}
function getGoalkeeperValues(){
  return [...document.querySelectorAll("#goalkeeperRows .goalkeeper-row")].map(row => ({
    navn: row.querySelector("select").value,
    maalImod: Number(row.querySelector('input[type="number"]').value || 0),
    cleanSheet: row.querySelector('input[type="checkbox"]').checked
  })).filter(x=>x.navn);
}

function buildMatchOptions() {
  matchSelect.innerHTML = "";
  data.matches.forEach(m=>{
    const opt = document.createElement("option");
    opt.value = m.kampnr;
    opt.textContent = `${fmtDate(m.datoTid)} · ${matchName(m)}${m.spillet ? " · " + m.resultat : ""}`;
    matchSelect.appendChild(opt);
  });
}

function loadMatch(){
  if (!matchSelect.value) return;
  const m = data.matches.find(x => String(x.kampnr) === matchSelect.value);
  document.getElementById("scoreFor").value = m.maalFor ?? "";
  document.getElementById("scoreAgainst").value = m.maalImod ?? "";
  participants.innerHTML = players.map(p => `
    <label class="check"><input type="checkbox" value="${p}" ${(m.deltagere||[]).includes(p) ? "checked":""}> ${p}</label>
  `).join("");
  document.getElementById("goalkeeperRows").innerHTML = "";
  document.getElementById("goalsRows").innerHTML = "";
  document.getElementById("assistRows").innerHTML = "";
  document.getElementById("boehRows").innerHTML = "";
  document.getElementById("beerRows").innerHTML = "";
  (m.maalmaend||[]).forEach(v=>addGoalkeeperRow(v.navn, v.maalImod, v.cleanSheet));
  (m.maal||[]).forEach(v=>addSelectRow("goalsRows", v));
  (m.assists||[]).forEach(v=>addSelectRow("assistRows", v));
  (m.boehmaend||[]).forEach(v=>addSelectRow("boehRows", v.navn, v.note, true));
  (m.oel||[]).forEach(v=>addSelectRow("beerRows", v));
}

function updateLocalDataFromForm() {
  const m = data.matches.find(x => String(x.kampnr) === matchSelect.value);
  const scoreFor = document.getElementById("scoreFor").value;
  const scoreAgainst = document.getElementById("scoreAgainst").value;
  m.maalFor = scoreFor === "" ? null : Number(scoreFor);
  m.maalImod = scoreAgainst === "" ? null : Number(scoreAgainst);
  const isHome = m.hjemmehold.includes(TEAM);
  m.resultat = (scoreFor !== "" && scoreAgainst !== "") ? (isHome ? `${scoreFor} - ${scoreAgainst}` : `${scoreAgainst} - ${scoreFor}`) : "";
  m.spillet = scoreFor !== "" && scoreAgainst !== "";
  m.deltagere = [...document.querySelectorAll("#participants input:checked")].map(cb=>cb.value);
  m.maalmaend = getGoalkeeperValues();
  m.maal = getSelectValues("goalsRows");
  m.assists = getSelectValues("assistRows");
  m.boehmaend = getBoehValues();
  m.oel = getSelectValues("beerRows");
}

async function saveOnline() {
  saveStatus.textContent = "Gemmer...";
  updateLocalDataFromForm();

  const { error } = await sb
    .from(CONFIG.table)
    .update({ data, updated_at: new Date().toISOString() })
    .eq("id", CONFIG.rowId);

  if (error) {
    saveStatus.textContent = "Fejl: " + error.message;
  } else {
    saveStatus.textContent = "Gemt! Forsiden er opdateret.";
    buildMatchOptions();
  }
}

matchSelect.addEventListener("change", loadMatch);
document.getElementById("loginButton").addEventListener("click", sendLoginLink);
document.getElementById("logoutButton").addEventListener("click", logout);
document.getElementById("addGoalkeeper").addEventListener("click", ()=>addGoalkeeperRow());
document.getElementById("addGoal").addEventListener("click", ()=>addSelectRow("goalsRows"));
document.getElementById("addAssist").addEventListener("click", ()=>addSelectRow("assistRows"));
document.getElementById("addBoeh").addEventListener("click", ()=>addSelectRow("boehRows", "", "", true));
document.getElementById("addBeer").addEventListener("click", ()=>addSelectRow("beerRows"));
document.getElementById("saveOnline").addEventListener("click", saveOnline);

setAdminVisible(false);
checkSession();
