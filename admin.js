const data = structuredClone(window.B74_DATA);
const players = data.players;
const goalkeepers = data.goalkeepers || ["Danni","Ugle"];
const TEAM = "B74 Silkeborg";
let generatedText = "";

const matchSelect = document.getElementById("matchSelect");
const participants = document.getElementById("participants");

function matchName(m){ return `${m.hjemmehold} - ${m.udehold}`; }
function fmtDate(iso){ return new Date(iso).toLocaleDateString("da-DK", {day:"2-digit", month:"short"}); }

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

function loadMatch(){
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

data.matches.forEach(m=>{
  const opt = document.createElement("option");
  opt.value = m.kampnr;
  opt.textContent = `${fmtDate(m.datoTid)} · ${matchName(m)}${m.spillet ? " · " + m.resultat : ""}`;
  matchSelect.appendChild(opt);
});
matchSelect.addEventListener("change", loadMatch);

document.getElementById("addGoalkeeper").addEventListener("click", ()=>addGoalkeeperRow());
document.getElementById("addGoal").addEventListener("click", ()=>addSelectRow("goalsRows"));
document.getElementById("addAssist").addEventListener("click", ()=>addSelectRow("assistRows"));
document.getElementById("addBoeh").addEventListener("click", ()=>addSelectRow("boehRows", "", "", true));
document.getElementById("addBeer").addEventListener("click", ()=>addSelectRow("beerRows"));

document.getElementById("generate").addEventListener("click", ()=>{
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
  generatedText = "window.B74_DATA = " + JSON.stringify(data, null, 2) + ";\n";
  document.getElementById("output").textContent = generatedText;
  document.getElementById("download").disabled = false;
});

document.getElementById("download").addEventListener("click", ()=>{
  const blob = new Blob([generatedText], {type:"text/javascript"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.js";
  a.click();
  URL.revokeObjectURL(url);
});

loadMatch();
