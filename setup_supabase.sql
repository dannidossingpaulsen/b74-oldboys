-- B74 Old Boys Supabase setup
-- Kør hele denne fil i Supabase SQL Editor.

create table if not exists public.b74_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamp with time zone default now()
);

insert into public.b74_data (id, data, updated_at)
values ('main', '{"team": "B74 Silkeborg Oldboys", "season": "2026", "players": ["Danni", "Hjalti", "Østergaard", "Mike", "Kaagaard", "Overby", "Toft", "Troelsen", "Jesper", "Valbjørn", "Marius", "Gøttler", "Ugle", "André", "Aske", "Svendsen", "Arne", "Smed", "Le Fevre", "Møllering"], "goalkeepers": ["Danni", "Ugle"], "matches": [{"kampnr": 321609, "dag": "Mandag", "datoTid": "2026-04-13T19:30", "hjemmehold": "GFG Voel, disp", "udehold": "B74 Silkeborg", "sted": "Voel-Hallen", "adresse": "", "resultat": "4-1", "maalFor": 1, "maalImod": 4, "spillet": true, "deltagere": ["Hjalti", "Østergaard", "Mike", "Kaagaard", "Overby", "Toft", "Troelsen", "Jesper", "Valbjørn", "Danni"], "maal": ["Kaagaard"], "assists": ["Overby"], "boehmaend": [{"navn": "Jesper", "note": "Straffe og fejlaflevering"}, {"navn": "Troelsen", "note": "Indkast"}], "oel": [], "maalmaend": [{"navn": "Danni", "maalImod": 4, "cleanSheet": false}]}, {"kampnr": 321611, "dag": "Mandag", "datoTid": "2026-04-20T19:00", "hjemmehold": "B74 Silkeborg", "udehold": "Mariehøj KS", "sted": "Marienlund Kunstgræsbaner", "adresse": "", "resultat": "3-7", "maalFor": 3, "maalImod": 7, "spillet": true, "deltagere": ["Hjalti", "Østergaard", "Mike", "Kaagaard", "Overby", "Toft", "Jesper", "Valbjørn", "Marius", "Gøttler", "Ugle"], "maal": ["Mike", "Gøttler", "Østergaard"], "assists": ["Toft", "Hjalti", "Valbjørn"], "boehmaend": [{"navn": "Ugle", "note": "Samler tilbagelægning op, laver selvmål"}], "oel": ["Ugle"], "maalmaend": [{"navn": "Ugle", "maalImod": 7, "cleanSheet": false}]}, {"kampnr": 321615, "dag": "Mandag", "datoTid": "2026-04-27T19:00", "hjemmehold": "Stjær BK", "udehold": "B74 Silkeborg", "sted": "Vesterbro Stadion", "adresse": "", "resultat": "", "maalFor": null, "maalImod": null, "spillet": false, "deltagere": [], "maal": [], "assists": [], "boehmaend": [], "oel": [], "maalmaend": []}, {"kampnr": 321617, "dag": "Mandag", "datoTid": "2026-05-04T19:00", "hjemmehold": "B74 Silkeborg", "udehold": "Dover GF, disp.", "sted": "Marienlund Kunstgræsbaner", "adresse": "", "resultat": "", "maalFor": null, "maalImod": null, "spillet": false, "deltagere": [], "maal": [], "assists": [], "boehmaend": [], "oel": [], "maalmaend": []}, {"kampnr": 321619, "dag": "Mandag", "datoTid": "2026-05-11T19:00", "hjemmehold": "Silkeborg B78, disp", "udehold": "B74 Silkeborg", "sted": "Sølystskolen, Silkeborg", "adresse": "", "resultat": "", "maalFor": null, "maalImod": null, "spillet": false, "deltagere": [], "maal": [], "assists": [], "boehmaend": [], "oel": [], "maalmaend": []}, {"kampnr": 321624, "dag": "Mandag", "datoTid": "2026-05-18T19:00", "hjemmehold": "B74 Silkeborg", "udehold": "GFG Voel, disp", "sted": "Marienlund Kunstgræsbaner", "adresse": "", "resultat": "", "maalFor": null, "maalImod": null, "spillet": false, "deltagere": [], "maal": [], "assists": [], "boehmaend": [], "oel": [], "maalmaend": []}, {"kampnr": 321626, "dag": "Mandag", "datoTid": "2026-06-01T19:00", "hjemmehold": "Mariehøj KS", "udehold": "B74 Silkeborg", "sted": "MKS - Almindsøvej", "adresse": "", "resultat": "", "maalFor": null, "maalImod": null, "spillet": false, "deltagere": [], "maal": [], "assists": [], "boehmaend": [], "oel": [], "maalmaend": []}, {"kampnr": 321630, "dag": "Mandag", "datoTid": "2026-06-08T19:00", "hjemmehold": "B74 Silkeborg", "udehold": "Stjær BK", "sted": "Marienlund Kunstgræsbaner", "adresse": "", "resultat": "", "maalFor": null, "maalImod": null, "spillet": false, "deltagere": [], "maal": [], "assists": [], "boehmaend": [], "oel": [], "maalmaend": []}, {"kampnr": 321632, "dag": "Mandag", "datoTid": "2026-06-15T19:00", "hjemmehold": "Dover GF, disp.", "udehold": "B74 Silkeborg", "sted": "Bjedstrup Skole", "adresse": "", "resultat": "", "maalFor": null, "maalImod": null, "spillet": false, "deltagere": [], "maal": [], "assists": [], "boehmaend": [], "oel": [], "maalmaend": []}, {"kampnr": 321634, "dag": "Mandag", "datoTid": "2026-06-22T19:00", "hjemmehold": "B74 Silkeborg", "udehold": "Silkeborg B78, disp", "sted": "Marienlund Kunstgræsbaner", "adresse": "", "resultat": "", "maalFor": null, "maalImod": null, "spillet": false, "deltagere": [], "maal": [], "assists": [], "boehmaend": [], "oel": [], "maalmaend": []}]}'::jsonb, now())
on conflict (id)
do update set data = excluded.data, updated_at = now();

alter table public.b74_data enable row level security;

drop policy if exists "Public read B74 data" on public.b74_data;
drop policy if exists "Only Danni can update B74 data" on public.b74_data;
drop policy if exists "Only Danni can insert B74 data" on public.b74_data;

create policy "Public read B74 data"
on public.b74_data
for select
to anon, authenticated
using (true);

create policy "Only Danni can update B74 data"
on public.b74_data
for update
to authenticated
using ((auth.jwt() ->> 'email') = 'dannipaulsen@gmail.com')
with check ((auth.jwt() ->> 'email') = 'dannipaulsen@gmail.com');

create policy "Only Danni can insert B74 data"
on public.b74_data
for insert
to authenticated
with check ((auth.jwt() ->> 'email') = 'dannipaulsen@gmail.com');
