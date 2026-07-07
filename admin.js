const CONFIG = window.B74_SUPABASE;
let data = structuredClone(window.B74_DATA);
let players = data.players;
let goalkeepers = data.goalkeepers || ["Danni", "Ugle"];
let selectedPhase = "Efterår";

const TEAM = "B74 Silkeborg";
const sb = window.supabase.createClient(CONFIG.url, CONFIG.key);

const matchSelect = document.getElementById("matchSelect");
const participants = document.getElementById("participants");
const loginStatus = document.getElementById("loginStatus");
const saveStatus = document.getElementById("saveStatus");
const playerStatus = document.getElementById("playerStatus");
const playerList = document.getElementById("playerList");

function matchName(m) {
  return `${m.hjemmehold} - ${m.udehold}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("da-DK", {
    day: "2-digit",
    month: "short",
  });
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function sortPlayers() {
  players = [...new Set(players.map(normalizeName).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "da")
  );
  data.players = players;
}

function setAdminVisible(isVisible) {
  if (isVisible) {
    document.body.classList.add("admin-logged-in");
  } else {
    document.body.classList.remove("admin-logged-in");
  }

  document.querySelectorAll(".admin-panel").forEach((el) => {
    if (!isVisible) {
      el.style.display = "none";
      return;
    }

    el.style.display = el.classList.contains("grid") ? "grid" : "block";
  });
}

async function loadRemoteData() {
  const { data: row, error } = await sb
    .from(CONFIG.table)
    .select("data")
    .eq("id", CONFIG.rowId)
    .single();

  if (error) {
    console.error("Kunne ikke hente data:", error.message);
    loginStatus.textContent = "Logget ind, men kunne ikke hente kampdata.";
    return;
  }

  if (row && row.data && row.data.matches) {
    data = structuredClone(row.data);
    players = data.players || [];
    goalkeepers = data.goalkeepers || ["Danni", "Ugle"];
    sortPlayers();
  }
}

async function checkSession() {
  const { data: sessionData } = await sb.auth.getSession();
  const session = sessionData.session;
  const user = session?.user;

  const ok = user && user.email === CONFIG.adminEmail;

  document.getElementById("logoutButton").style.display = user ? "" : "none";

  if (ok) {
    loginStatus.textContent = `Logget ind som ${user.email}`;
    setAdminVisible(true);

    await loadRemoteData();
    ensurePhaseFilter();
    renderPlayerList();
    buildMatchOptions();
    loadMatch();
  } else {
    setAdminVisible(false);

    if (user) {
      loginStatus.textContent = `Du er logget ind som ${user.email}, men mangler admin-adgang.`;
    } else {
      loginStatus.textContent = "Ikke logget ind.";
    }
  }
}

sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
    checkSession();
  }
});

async function sendLoginLink() {
  const email = document.getElementById("emailInput").value.trim();

  loginStatus.textContent = "Sender login-link...";

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin + "/admin.html",
    },
  });

  loginStatus.textContent = error
    ? "Fejl: " + error.message
    : "Login-link sendt. Tjek din mail.";
}

async function logout() {
  await sb.auth.signOut();
  saveStatus.textContent = "";
  await checkSession();
}

function options(list, selected = "") {
  return list
    .map(
      (p) =>
        `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`
    )
    .join("");
}

function playerOptions(selected = "") {
  return options(players, selected);
}

function goalkeeperOptions(selected = "") {
  return options(goalkeepers, selected);
}

function renderPlayerList() {
  if (!playerList) return;
  playerList.innerHTML = players.map((p) => `<span class="pill">${p}</span>`).join("");
}

async function saveAllData(statusEl = saveStatus, successText = "Gemt! Forsiden er opdateret.") {
  const { error } = await sb
    .from(CONFIG.table)
    .update({
      data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", CONFIG.rowId);

  if (error) {
    statusEl.textContent = "Fejl: " + error.message;
    return false;
  }

  statusEl.textContent = successText;
  return true;
}

async function addPlayer() {
  const input = document.getElementById("newPlayerInput");
  const name = normalizeName(input.value);

  if (!name) {
    playerStatus.textContent = "Skriv et navn først.";
    return;
  }

  const exists = players.some((p) => p.toLowerCase() === name.toLowerCase());
  if (exists) {
    playerStatus.textContent = `${name} findes allerede.`;
    return;
  }

  players.push(name);
  sortPlayers();

  playerStatus.textContent = "Gemmer spiller...";

  const ok = await saveAllData(playerStatus, `${name} er tilføjet.`);
  if (!ok) return;

  input.value = "";
  renderPlayerList();
  buildMatchOptions();
  loadMatch();
}

function ensurePhaseFilter() {
  if (document.getElementById("phaseSelect")) return;

  const label = document.createElement("label");
  label.setAttribute("for", "phaseSelect");
  label.textContent = "Sæsonafsnit";

  const select = document.createElement("select");
  select.id = "phaseSelect";
  select.innerHTML = `
    <option value="Forår">Forår</option>
    <option value="Efterår" selected>Efterår</option>
  `;

  select.addEventListener("change", () => {
    selectedPhase = select.value;
    buildMatchOptions();
    loadMatch();
  });

  matchSelect.parentNode.insertBefore(select, matchSelect);
  matchSelect.parentNode.insertBefore(label, select);
}

function addSelectRow(containerId, value = "", note = "", withNote = false) {
  const wrap = document.createElement("div");
  wrap.className = "event-row";

  wrap.innerHTML = withNote
    ? `
      <div>
        <select>${playerOptions(value)}</select>
        <textarea placeholder="Kort forklaring">${note || ""}</textarea>
      </div>
      <button class="button ghost" type="button">Fjern</button>
    `
    : `
      <select>${playerOptions(value)}</select>
      <button class="button ghost" type="button">Fjern</button>
    `;

  wrap.querySelector("button").addEventListener("click", () => wrap.remove());
  document.getElementById(containerId).appendChild(wrap);
}

function addGoalkeeperRow(value = "", goalsAgainst = "", cleanSheet = false) {
  const wrap = document.createElement("div");
  wrap.className = "event-row goalkeeper-row";

  wrap.innerHTML = `
    <select>${goalkeeperOptions(value)}</select>
    <input type="number" min="0" placeholder="Mål imod" value="${goalsAgainst ?? ""}">
    <label class="check">
      <input type="checkbox" ${cleanSheet ? "checked" : ""}> Clean sheet
    </label>
    <button class="button ghost" type="button">Fjern</button>
  `;

  wrap.querySelector("button").addEventListener("click", () => wrap.remove());
  document.getElementById("goalkeeperRows").appendChild(wrap);
}

function getSelectValues(containerId) {
  return [...document.querySelectorAll(`#${containerId} select`)]
    .map((s) => s.value)
    .filter(Boolean);
}

function getBoehValues() {
  return [...document.querySelectorAll("#boehRows .event-row")]
    .map((row) => ({
      navn: row.querySelector("select").value,
      note: row.querySelector("textarea").value.trim(),
    }))
    .filter((x) => x.navn);
}

function getGoalkeeperValues() {
  return [...document.querySelectorAll("#goalkeeperRows .goalkeeper-row")]
    .map((row) => ({
      navn: row.querySelector("select").value,
      maalImod: Number(row.querySelector('input[type="number"]').value || 0),
      cleanSheet: row.querySelector('input[type="checkbox"]').checked,
    }))
    .filter((x) => x.navn);
}

function buildMatchOptions() {
  matchSelect.innerHTML = "";

  const matches = data.matches.filter((m) => (m.phase || "Forår") === selectedPhase);

  matches.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.kampnr;
    opt.textContent = `${fmtDate(m.datoTid)} · ${matchName(m)}${
      m.spillet ? " · " + m.resultat : ""
    }`;
    matchSelect.appendChild(opt);
  });
}

function loadMatch() {
  if (!matchSelect.value) return;

  const m = data.matches.find((x) => String(x.kampnr) === matchSelect.value);
  if (!m) return;

  document.getElementById("scoreFor").value = m.maalFor ?? "";
  document.getElementById("scoreAgainst").value = m.maalImod ?? "";

  participants.innerHTML = players
    .map(
      (p) => `
        <label class="check">
          <input type="checkbox" value="${p}" ${
        (m.deltagere || []).includes(p) ? "checked" : ""
      }> ${p}
        </label>
      `
    )
    .join("");

  document.getElementById("goalkeeperRows").innerHTML = "";
  document.getElementById("goalsRows").innerHTML = "";
  document.getElementById("assistRows").innerHTML = "";
  document.getElementById("boehRows").innerHTML = "";
  document.getElementById("beerRows").innerHTML = "";

  (m.maalmaend || []).forEach((v) =>
    addGoalkeeperRow(v.navn, v.maalImod, v.cleanSheet)
  );

  (m.maal || []).forEach((v) => addSelectRow("goalsRows", v));
  (m.assists || []).forEach((v) => addSelectRow("assistRows", v));

  (m.boehmaend || []).forEach((v) =>
    addSelectRow("boehRows", v.navn, v.note, true)
  );

  (m.oel || []).forEach((v) => addSelectRow("beerRows", v));

  saveStatus.textContent = "";
}

function updateLocalDataFromForm() {
  const m = data.matches.find((x) => String(x.kampnr) === matchSelect.value);
  if (!m) return;

  const scoreFor = document.getElementById("scoreFor").value;
  const scoreAgainst = document.getElementById("scoreAgainst").value;

  m.phase = m.phase || selectedPhase;
  m.maalFor = scoreFor === "" ? null : Number(scoreFor);
  m.maalImod = scoreAgainst === "" ? null : Number(scoreAgainst);

  const isHome = m.hjemmehold.includes(TEAM);

  m.resultat =
    scoreFor !== "" && scoreAgainst !== ""
      ? isHome
        ? `${scoreFor} - ${scoreAgainst}`
        : `${scoreAgainst} - ${scoreFor}`
      : "";

  m.spillet = scoreFor !== "" && scoreAgainst !== "";

  m.deltagere = [...document.querySelectorAll("#participants input:checked")].map(
    (cb) => cb.value
  );

  m.maalmaend = getGoalkeeperValues();
  m.maal = getSelectValues("goalsRows");
  m.assists = getSelectValues("assistRows");
  m.boehmaend = getBoehValues();
  m.oel = getSelectValues("beerRows");
}

async function saveOnline() {
  saveStatus.textContent = "Gemmer...";

  updateLocalDataFromForm();

  const ok = await saveAllData(saveStatus, "Gemt! Forsiden er opdateret.");
  if (!ok) return;

  buildMatchOptions();
}

matchSelect.addEventListener("change", loadMatch);

document.getElementById("loginButton").addEventListener("click", sendLoginLink);
document.getElementById("logoutButton").addEventListener("click", logout);
document.getElementById("addPlayerButton").addEventListener("click", addPlayer);

document.getElementById("newPlayerInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") addPlayer();
});

document
  .getElementById("addGoalkeeper")
  .addEventListener("click", () => addGoalkeeperRow());

document
  .getElementById("addGoal")
  .addEventListener("click", () => addSelectRow("goalsRows"));

document
  .getElementById("addAssist")
  .addEventListener("click", () => addSelectRow("assistRows"));

document
  .getElementById("addBoeh")
  .addEventListener("click", () => addSelectRow("boehRows", "", "", true));

document
  .getElementById("addBeer")
  .addEventListener("click", () => addSelectRow("beerRows"));

document.getElementById("saveOnline").addEventListener("click", saveOnline);

setAdminVisible(false);
checkSession();