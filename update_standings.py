import os
import urllib3
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup
from requests.exceptions import SSLError

DGI_URL = "https://minidraet.dgi.dk/forening/0663200/hold/312539"
SUPABASE_URL = "https://kiopzgeuofmeakxosbzq.supabase.co"
SUPABASE_SECRET_KEY = os.environ["SUPABASE_SECRET_KEY"]

headers = {
    "User-Agent": "Mozilla/5.0"
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
            verify=False
        )
        res.raise_for_status()
        return res.text

html = fetch_dgi_page()

soup = BeautifulSoup(html, "html.parser")
tables = soup.find_all("table", class_="footable")

standings = []

for table in tables:
    headers_text = [th.get_text(" ", strip=True) for th in table.find_all("th")]

    if not ("Hold" in headers_text and "Kampe" in headers_text and "Point" in headers_text):
        continue

    tbody = table.find("tbody")
    if not tbody:
        continue

    rows = tbody.find_all("tr")

    for row in rows:
        cols = [td.get_text(" ", strip=True) for td in row.find_all("td")]

        if len(cols) < 8:
            continue

        standings.append({
            "placering": int(cols[0].replace(".", "")),
            "hold": cols[1],
            "kampe": int(cols[2]),
            "v": int(cols[3]),
            "u": int(cols[4]),
            "t": int(cols[5]),
            "score": cols[6],
            "point": int(cols[7].split()[0]),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

if not standings:
    raise RuntimeError("Ingen stilling fundet på DGI-siden")

api_headers = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

table_url = f"{SUPABASE_URL}/rest/v1/b74_standings"

delete_res = requests.delete(
    table_url,
    headers=api_headers,
    params={"id": "gte.0"},
    timeout=30,
)
delete_res.raise_for_status()

insert_res = requests.post(
    table_url,
    headers=api_headers,
    json=standings,
    timeout=30,
)
insert_res.raise_for_status()

print(f"✅ Opdaterede stilling med {len(standings)} hold")
