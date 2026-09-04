import os
import re
from datetime import datetime, timezone

import requests
import urllib3
from bs4 import BeautifulSoup
from requests.exceptions import SSLError

DGI_URL = "https://minidraet.dgi.dk/turnering/48629/raekke/149966/pulje/85021"
SUPABASE_URL = "https://kiopzgeuofmeakxosbzq.supabase.co"
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]

DATA_TABLE = "b74_data"
DATA_ROW_ID = "main"
STANDINGS_TABLE = "b74_standings"

TEAM = "B74 Silkeborg"
PHASE = "Efterår"

headers = {
    "User-Agent": "Mozilla/5.0 (compatible; B74Oldboys/1.0)"
}


def fetch_dgi_page():
    try:
        res = requests.get(DGI_URL, headers=headers, timeout=30)
        res.raise_for_status()
        return res.text
    except SSLError:
        print("⚠️ SSL-fejl hos DGI. Prøver igen uden certifikat-verificering.")
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        res = requests.get(
            DGI_URL,
            headers=headers,
            timeout=30,
            verify=False,
        )
        res.raise_for_status()
        return res.text


def clean_text(value):
    return re.sub(r"\s+", " ", value or "").strip()


def api_headers():
    return {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def parse_standings(soup):
    standings = []

    for table in soup.find_all("table", class_="footable"):
        headers_text = [clean_text(th.get_text(" ", strip=True)) for th in table.find_all("th")]

        if not ("Hold" in headers_text and "Kampe" in headers_text and "Point" in headers_text):
            continue

        tbody = table.find("tbody")
        if not tbody:
            continue

        for row in tbody.find_all("tr"):
            tds = row.find_all("td")
            if len(tds) < 8:
                continue

            cols = [clean_text(td.get_text(" ", strip=True)) for td in tds]

            # VIGTIGT: DGI lægger ekstra metadata ind i holdcellen.
            # Vi tager derfor selve holdlinkets tekst, ikke hele cellens tekst.
            team_link = tds[1].find("a")
            team_name = clean_text(team_link.get_text(" ", strip=True)) if team_link else cols[1]

            try:
                standings.append({
                    "placering": int(cols[0].replace(".", "")),
                    "hold": team_name,
                    "kampe": int(cols[2]),
                    "v": int(cols[3]),
                    "u": int(cols[4]),
                    "t": int(cols[5]),
                    "score": cols[6],
                    "point": int(cols[7].split()[0]),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
            except (ValueError, IndexError):
                print(f"⚠️ Springer ukendt stillingsrække over: {cols}")

    if not standings:
        raise RuntimeError("Ingen stilling fundet på DGI-siden")

    return standings


def parse_dgi_datetime(value):
    return datetime.strptime(clean_text(value), "%d-%m-%y %H:%M").strftime("%Y-%m-%dT%H:%M")


def parse_b74_fixtures(soup):
    fixtures = []

    for table in soup.find_all("table", class_="footable"):
        headers_text = [clean_text(th.get_text(" ", strip=True)) for th in table.find_all("th")]

        is_program = (
            any("Kampnr" in h for h in headers_text)
            and any("Dato/tid" in h for h in headers_text)
            and any("Hjemme/Ude" in h for h in headers_text)
        )

        if not is_program:
            continue

        tbody = table.find("tbody")
        if not tbody:
            continue

        for row in tbody.find_all("tr"):
            tds = row.find_all("td")
            if len(tds) < 6:
                continue

            # Kampnummer: brug kun selve linkteksten, så DGI-statusnoter ikke kommer med.
            kamp_link = tds[0].find("a")
            kamp_text = clean_text(kamp_link.get_text(" ", strip=True)) if kamp_link else clean_text(tds[0].get_text(" ", strip=True))
            match_number = re.search(r"\d{5,}", kamp_text)
            if not match_number:
                continue
            kampnr = int(match_number.group(0))

            day = clean_text(tds[1].get_text(" ", strip=True))
            dt_text = clean_text(tds[2].get_text(" ", strip=True))

            team_links = [clean_text(a.get_text(" ", strip=True)) for a in tds[3].find_all("a")]
            team_links = [x for x in team_links if x]

            if len(team_links) < 2:
                # Fallback hvis DGI ændrer markup.
                raw = clean_text(tds[3].get_text(" ", strip=True))
                parts = [clean_text(x) for x in raw.split(" - ", 1)]
                if len(parts) != 2:
                    continue
                home, away = parts
            else:
                home, away = team_links[0], team_links[1]

            if TEAM not in (home, away):
                continue

            venue_links = [clean_text(a.get_text(" ", strip=True)) for a in tds[4].find_all("a")]
            venue_links = [x for x in venue_links if x]
            venue = venue_links[-1] if venue_links else clean_text(tds[4].get_text(" ", strip=True)).replace("Spillested ", "", 1)

            fixtures.append({
                "kampnr": kampnr,
                "dag": day,
                "datoTid": parse_dgi_datetime(dt_text),
                "hjemmehold": home,
                "udehold": away,
                "sted": venue,
                "adresse": "",
                "phase": PHASE,
            })

    fixtures.sort(key=lambda m: m["datoTid"])

    if not fixtures:
        raise RuntimeError("Ingen B74-kampe fundet i DGI-programmet")

    return fixtures


def update_standings(standings):
    table_url = f"{SUPABASE_URL}/rest/v1/{STANDINGS_TABLE}"

    delete_res = requests.delete(
        table_url,
        headers=api_headers(),
        params={"id": "gte.0"},
        timeout=30,
    )
    delete_res.raise_for_status()

    insert_res = requests.post(
        table_url,
        headers=api_headers(),
        json=standings,
        timeout=30,
    )
    insert_res.raise_for_status()

    print(f"✅ Opdaterede stilling med {len(standings)} hold")


def load_site_data():
    url = f"{SUPABASE_URL}/rest/v1/{DATA_TABLE}"

    res = requests.get(
        url,
        headers=api_headers(),
        params={
            "id": f"eq.{DATA_ROW_ID}",
            "select": "data",
        },
        timeout=30,
    )
    res.raise_for_status()

    rows = res.json()
    if not rows or not isinstance(rows[0].get("data"), dict):
        raise RuntimeError("Kunne ikke hente B74-data fra Supabase")

    return rows[0]["data"]


def has_local_match_data(match):
    """Beskyt en kamp mod automatisk sletning, hvis vi selv har registreret noget."""
    return bool(
        match.get("spillet")
        or match.get("resultat")
        or match.get("deltagere")
        or match.get("maal")
        or match.get("assists")
        or match.get("boehmaend")
        or match.get("oel")
        or match.get("maalmaend")
    )


def default_match(dgi_match):
    match = dict(dgi_match)
    match.update({
        "resultat": "",
        "maalFor": 0,
        "maalImod": 0,
        "spillet": False,
        "deltagere": [],
        "maal": [],
        "assists": [],
        "boehmaend": [],
        "oel": [],
        "maalmaend": [],
    })
    return match


def merge_fixtures(site_data, dgi_fixtures):
    matches = site_data.get("matches", [])

    spring_or_other = [
        m for m in matches
        if (m.get("phase") or "Forår") != PHASE
    ]
    current_autumn = [
        m for m in matches
        if (m.get("phase") or "Forår") == PHASE
    ]

    by_kampnr = {
        int(m["kampnr"]): m
        for m in current_autumn
        if str(m.get("kampnr", "")).isdigit()
    }

    official_numbers = {int(m["kampnr"]) for m in dgi_fixtures}
    merged_autumn = []
    added = 0
    updated = 0

    for dgi_match in dgi_fixtures:
        kampnr = int(dgi_match["kampnr"])
        old = by_kampnr.get(kampnr)

        if old:
            merged = dict(old)

            # DGI er facit for de officielle kampoplysninger.
            # ALT vores eget statistikindhold bevares.
            for field in (
                "kampnr",
                "dag",
                "datoTid",
                "hjemmehold",
                "udehold",
                "sted",
                "adresse",
                "phase",
            ):
                merged[field] = dgi_match[field]

            merged_autumn.append(merged)
            updated += 1
        else:
            merged_autumn.append(default_match(dgi_match))
            added += 1

    removed = 0
    protected = 0

    # Kampe som DGI har fjernet, fx et udtrukket hold:
    for old in current_autumn:
        kampnr_raw = old.get("kampnr")
        kampnr = int(kampnr_raw) if str(kampnr_raw).isdigit() else None

        if kampnr in official_numbers:
            continue

        if has_local_match_data(old):
            # Sikkerhedsregel: slet ALDRIG en kamp med egne registreringer.
            merged_autumn.append(old)
            protected += 1
            print(
                "⚠️ Bevarer kamp, som ikke længere findes hos DGI, "
                f"fordi den har lokale data: {old.get('kampnr')} "
                f"{old.get('hjemmehold')} - {old.get('udehold')}"
            )
        else:
            removed += 1
            print(
                "🗑️ Fjerner udgået, tom kamp: "
                f"{old.get('kampnr')} {old.get('hjemmehold')} - {old.get('udehold')}"
            )

    all_matches = spring_or_other + merged_autumn
    all_matches.sort(key=lambda m: m.get("datoTid", ""))

    site_data["matches"] = all_matches

    print(
        f"✅ DGI-program synkroniseret: "
        f"{updated} eksisterende opdateret, {added} nye, "
        f"{removed} tomme udgåede fjernet, {protected} beskyttet."
    )

    return site_data


def save_site_data(site_data):
    url = f"{SUPABASE_URL}/rest/v1/{DATA_TABLE}"

    res = requests.patch(
        url,
        headers=api_headers(),
        params={"id": f"eq.{DATA_ROW_ID}"},
        json={"data": site_data},
        timeout=30,
    )
    res.raise_for_status()

    print("✅ B74-kampprogram gemt i Supabase")


def main():
    html = fetch_dgi_page()
    soup = BeautifulSoup(html, "html.parser")

    standings = parse_standings(soup)
    fixtures = parse_b74_fixtures(soup)

    print("B74-kampe fundet hos DGI:")
    for m in fixtures:
        print(
            f"  {m['kampnr']} · {m['datoTid']} · "
            f"{m['hjemmehold']} - {m['udehold']} · {m['sted']}"
        )

    # Først når begge parsere har fundet gyldige data, skriver vi noget.
    update_standings(standings)

    site_data = load_site_data()
    site_data = merge_fixtures(site_data, fixtures)
    save_site_data(site_data)


if __name__ == "__main__":
    main()
