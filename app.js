const CONFIG = window.B74_SUPABASE;
let DATA = window.B74_DATA;
const TEAM = "B74 Silkeborg";

function fmtDate(iso) {
  return new Date(iso).toLocaleString("da-DK", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function matchName(m) {
  return `${m.hjemmehold} - ${m.udehold}`;
}

function isHome(m) {
  return m.hjemmehold.includes(TEAM);
}

function opponent(m) {
  return isHome(m) ? m.udehold : m.hjemmehold;
}

function locationQuery(m) {
  return encodeURIComponent(
    m.adresse && m.adresse.trim()
      ? m.adresse
      : `${m.sted} ${opponent(m)} Danmark`
  );
}

function mapsUrl(m) {
  return `https://www.google.com/maps/search/?api=1&query=${locationQuery(m)}`;
}

function mapsEmbedUrl(m) {
  return `https://maps.google.com/maps?q=${locationQuery(m)}&output=embed`;
}

function countList(items) {
  const map = {};

  items.forEach((name) => {
    if (name) map[name] = (map[name] || 0) + 1;
  });

  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "da"));
}

function renderRanking(el, rows, empty = "Ingen data endnu") {
  if (!rows.length) {
    el.innerHTML = `<p class="small">${empty}</p>`;
    return;
  }

  el.innerHTML = `
    <table>
      <tbody>
        ${rows
          .map(
            (r, i) => `
              <tr>
                <td>${i + 1}.</td>
                <td><strong>${r.name}</strong></td>
                <td>${r.count}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function resultType(m) {
  if (!m.spillet) return "pending";
  if (m.maalFor > m.maalImod) return "win";
  if (m.maalFor < m.maalImod) return "loss";
  return "draw";
}

const sb =
  window.supabase && CONFIG
    ? window.supabase.createClient(CONFIG.url, CONFIG.key)
    : null;

async function loadData() {
  if (!sb) return DATA;

  const { data, error } = await sb
    .from(CONFIG.table)
    .select("data")
    .eq("id", CONFIG.rowId)
    .single();

  if (error) {
    console.warn("Bruger fallback-data.js:", error.message);
    return DATA;
  }

  if (data && data.data && data.data.matches && data.data.matches.length) {
    return data.data;
  }

  return DATA;
}

async function renderStandings() {
  const table = document.getElementById("standingsTable");
  if (!table) return;

  if (!sb) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td>Stillingen kunne ikke hentes.</td>
        </tr>
      </tbody>
    `;
    return;
  }

  const { data, error } = await sb
    .from("b74_standings")
    .select("*")
    .order("placering", { ascending: true });

  if (error) {
    console.error("Kunne ikke hente stilling:", error.message);
    table.innerHTML = `
      <tbody>
        <tr>
          <td>Stillingen kunne ikke hentes lige nu.</td>
        </tr>
      </tbody>
    `;
    return;
  }

  if (!data || !data.length) {
    table.innerHTML = `
      <tbody>
        <tr>
          <td>Ingen stilling fundet endnu.</td>
        </tr>
      </tbody>
    `;
    return;
  }

  table.innerHTML = `
    <thead>
      <tr>
        <th>#</th>
        <th>Hold</th>
        <th>K</th>
        <th>V</th>
        <th>U</th>
        <th>T</th>
        <th>Mål</th>
        <th>P</th>
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (row) => `
            <tr ${
              row.hold.includes("B74")
                ? 'style="font-weight:900;color:var(--gold)"'
                : ""
            }>
              <td>${row.placering}</td>
              <td>${row.hold}</td>
              <td>${row.kampe}</td>
              <td>${row.v}</td>
              <td>${row.u}</td>
              <td>${row.t}</td>
              <td>${row.score}</td>
              <td><strong>${row.point}</strong></td>
            </tr>
          `
        )
        .join("")}
    </tbody>
  `;
}

function renderSite() {
  const played = DATA.matches.filter((m) => m.spillet);
  const upcoming = DATA.matches
    .filter((m) => !m.spillet)
    .sort((a, b) => new Date(a.datoTid) - new Date(b.datoTid));

  const allGoals = played.flatMap((m) => m.maal || []);
  const allAssists = played.flatMap((m) => m.assists || []);
  const allApps = played.flatMap((m) => m.deltagere || []);
  const allBeer = played.flatMap((m) => m.oel || []);
  const allBoeh = played.flatMap((m) =>
    (m.boehmaend || []).map((b) => b.navn)
  );

  const latest = played[played.length - 1];

  document.getElementById("latestMatch").innerHTML = latest
    ? `
      <h3>Seneste kamp</h3>
      <div class="small">${fmtDate(latest.datoTid)} · ${latest.sted}</div>
      <h2 style="margin:.5rem 0">${matchName(latest)}</h2>
      <p><strong class="${
        latest.maalFor > latest.maalImod ? "win" : "loss"
      }">${latest.resultat}</strong></p>
      <p class="small">Mål: ${
        (latest.maal || []).map((n) => `<span class="pill">${n}</span>`).join("") ||
        "Ingen"
      }</p>
      <p class="small">Assists: ${
        (latest.assists || [])
          .map((n) => `<span class="pill">${n}</span>`)
          .join("") || "Ingen"
      }</p>
    `
    : `<h3>Seneste kamp</h3><p class="small">Ingen spillede kampe endnu.</p>`;

  const next = upcoming[0];

  document.getElementById("nextMatch").innerHTML = next
    ? `
      <h3>Næste kamp</h3>
      <div class="small">${fmtDate(next.datoTid)}</div>
      <h2 style="margin:.5rem 0">${matchName(next)}</h2>
      <p><strong>${next.sted}</strong>${
        next.adresse ? `<br><span class="small">${next.adresse}</span>` : ""
      }</p>
      <a class="map-link" href="${mapsUrl(
        next
      )}" target="_blank" rel="noopener">Åbn i Google Maps →</a>
      <iframe class="map-embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${mapsEmbedUrl(
        next
      )}"></iframe>
    `
    : `<h3>Næste kamp</h3><p class="small">Programmet er spillet færdigt.</p>`;

  renderRanking(document.getElementById("goalsTable"), countList(allGoals));
  renderRanking(document.getElementById("assistsTable"), countList(allAssists));
  renderRanking(
    document.getElementById("appearancesTable"),
    countList(allApps)
  );
  renderRanking(document.getElementById("boehmandTable"), countList(allBoeh));
  renderRanking(
    document.getElementById("beerTable"),
    countList(allBeer),
    "Ingen har givet øl endnu. Skandale."
  );

  const gkStats = {};
  (DATA.goalkeepers || ["Danni", "Ugle"]).forEach((g) => {
    gkStats[g] = {
      name: g,
      games: 0,
      goalsAgainst: 0,
      cleanSheets: 0,
    };
  });

  played.forEach((m) =>
    (m.maalmaend || []).forEach((g) => {
      if (!gkStats[g.navn]) {
        gkStats[g.navn] = {
          name: g.navn,
          games: 0,
          goalsAgainst: 0,
          cleanSheets: 0,
        };
      }

      gkStats[g.navn].games += 1;
      gkStats[g.navn].goalsAgainst += Number(g.maalImod || 0);
      if (g.cleanSheet) gkStats[g.navn].cleanSheets += 1;
    })
  );

  const gkRows = Object.values(gkStats).sort(
    (a, b) => b.games - a.games || a.name.localeCompare(b.name, "da")
  );

  document.getElementById("goalkeeperTable").innerHTML = `
    <h3>🧤 Målmænd</h3>
    <table>
      <thead>
        <tr>
          <th>Navn</th>
          <th>Kampe</th>
          <th>Mål imod</th>
          <th>Snit</th>
          <th>Clean sheets</th>
        </tr>
      </thead>
      <tbody>
        ${gkRows
          .map(
            (g) => `
              <tr>
                <td><strong>${g.name}</strong></td>
                <td>${g.games}</td>
                <td>${g.goalsAgainst}</td>
                <td>${
                  g.games
                    ? (g.goalsAgainst / g.games).toLocaleString("da-DK", {
                        maximumFractionDigits: 2,
                      })
                    : "0"
                }</td>
                <td>${g.cleanSheets}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;

  document.getElementById("fixturesTable").innerHTML = `
    <thead>
      <tr>
        <th>Dato</th>
        <th>Kamp</th>
        <th>Sted</th>
        <th>Resultat</th>
      </tr>
    </thead>
    <tbody>
      ${DATA.matches
        .map((m) => {
          const cls =
            resultType(m) === "win"
              ? "win"
              : resultType(m) === "loss"
              ? "loss"
              : "pending";

          const playersLine =
            m.deltagere && m.deltagere.length
              ? `<div class="players-line">Deltagere: ${m.deltagere.join(
                  ", "
                )}</div>`
              : "";

          const place = `${m.sted}${
            m.adresse ? `<div class="players-line">${m.adresse}</div>` : ""
          }<div><a class="map-link" href="${mapsUrl(
            m
          )}" target="_blank" rel="noopener">Kort →</a></div>`;

          return `
            <tr>
              <td>${fmtDate(m.datoTid)}</td>
              <td><strong>${matchName(m)}</strong>${playersLine}</td>
              <td>${place}</td>
              <td class="${cls}">${m.resultat || "Ikke spillet"}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;

  const log = played.flatMap((m) =>
    (m.boehmaend || []).map((b) => ({
      ...b,
      match: m,
    }))
  );

  document.getElementById("boehmandLog").innerHTML = log.length
    ? log
        .map(
          (b) => `
            <div class="log-item">
              <strong>${b.navn}</strong> · ${matchName(b.match)}<br>
              <span class="small">${b.note}</span>
            </div>
          `
        )
        .join("")
    : `<p class="small">Ingen bøhmænd. Endnu.</p>`;
}

loadData().then((loaded) => {
  DATA = loaded;
  renderSite();
  renderStandings();
});
