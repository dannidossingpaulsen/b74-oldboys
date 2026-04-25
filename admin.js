const CONFIG = window.B74_SUPABASE;
let data = structuredClone(window.B74_DATA);
let players = data.players;
let goalkeepers = data.goalkeepers || ["Danni", "Ugle"];
const TEAM = "B74 Silkeborg";
const sb = window.supabase.createClient(CONFIG.url, CONFIG.key);

const matchSelect = document.getElementById("matchSelect");
const participants = document.getElementById("participants");
const loginStatus = document.getElementById("loginStatus");
const saveStatus = document.getElementById("saveStatus");

function matchName(m) {
  return `${m.hjemmehold} - ${m.udehold}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("da-DK", {
    day: "2-digit",
    month: "short",
  });
}

// 🔥 VIGTIG: både style OG body class
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

    if (el.classList.contains("grid")) {
      el.style.display = "grid";
    } else {
      el.style.display = "block";
    }
  });
}

async function loadRemoteData() {
  const { data: row, error } = await sb
    .from(CONFIG.table)
    .select("data")
    .eq("id", CONFIG.rowId)
    .single();

  if (!error && row && row.data && row.data.matches) {
    data = structuredClone(row.data);
    players = data.players;
    goalkeepers = data.goalkeepers || ["Danni", "Ugle"];
  }
}

// 🔥 VIGTIG: robust session-check
async function checkSession() {
  const { data } = await sb.auth.getSession();
  const session = data.session;
  const user = session?.user;

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

    if (user) {
      loginStatus.textContent = `Du er logget ind som ${user.email}, men mangler admin-adgang.`;
    } else {
      loginStatus.textContent = "Ikke logget ind.";
    }
  }
}

// 🔥 VIGTIG: håndter login redirect
sb.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN") {
    checkSession();
  }
});

async function sendLoginLink() {
  const email = document.getElementById("emailInput").value.trim();

  loginStatus.textContent = "Sender login-link...";

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
    },
  });

  loginStatus.textContent = error
    ? "Fejl: " + error.message
    : "Login-link sendt. Tjek din mail.";
}

async function logout() {
  await sb.auth.signOut();
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

function addSelectRow(containerId, value = "", note = "", withNote = false) {
  const wrap = document.createElement("div");
  wrap.className = "event-row";

  wrap.innerHTML = withNote
    ? `<div><select>${playerOptions(
        value
      )}</select><textarea placeholder="Kort forklaring">${
        note || ""
      }</textarea></div><button class="button ghost" type="button">Fjern</button>`
    : `<select>${playerOptions(
        value
      )}</select><button class="button ghost" type="button">Fjern</button>`;

  wrap.querySelector("button").addEventListener("click", () => wrap.remove());
  document.getElementById(containerId).appendChild(wrap);
}

function addGoalkeeperRow(value = "", goalsAgainst = "", cleanSheet = false) {
  const wrap = document.createElement("div");
  wrap.className = "event-row goalkeeper-row";

  wrap.innerHTML = `
    <select>${goalkeeperOptions(value)}</select>
    <input type="number" min="0" placeholder="Mål imod" value="${
      goalsAgainst ?? ""
    }">
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

  data.matches.forEach((m) => {
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
}

async function saveOnline() {
  saveStatus.textContent = "Gemmer...";

  const { error } = await sb
    .from(CONFIG.table)
    .update({
      data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", CONFIG.rowId);

  saveStatus.textContent = error
    ? "Fejl: " + error.message
    : "Gemt! 🔥";
}

matchSelect.addEventListener("change", loadMatch);
document.getElementById("loginButton").addEventListener("click", sendLoginLink);
document.getElementById("logoutButton").addEventListener("click", logout);
document.getElementById("saveOnline").addEventListener("click", saveOnline);

setAdminVisible(false);
checkSession();
