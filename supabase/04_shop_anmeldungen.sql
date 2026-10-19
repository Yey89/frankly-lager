-- ============================================================
-- 0–100 FRANKLY · Update 2: Öffentlicher Shop + Owner-Anmeldungen
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–03).
--
-- Was die Öffentlichkeit (ohne Login = "anon") darf:
--   • Teile LESEN, aber nur mit Status Verfügbar / Reserviert / Vermietet
--     und nur ausgewählte Spalten (keine Notizen, keine Verkaufsdaten)
--   • Owner-Profile LESEN, aber nur wenn "oeffentlich" angehakt ist
--     und nur Profilname, Stil, Instagram
--   • Looks LESEN
--   • Sich als Owner ANMELDEN (nur einfügen, nichts lesen)
--   • Fotos fürs Vermieten HOCHLADEN (nur hochladen, nichts lesen)
-- ============================================================

-- ---------- TEILE: öffentlich lesbar (nur bestimmte Spalten) ----------
revoke all on public.items from anon;
grant select (id, nr, nr_num, titel, kategorie, unterkategorie, schnitt, farben, muster,
              groesse, marke, material, zustand, preis, status, owner_id, foto_pfad)
  on public.items to anon;
drop policy if exists "shop items" on public.items;
create policy "shop items" on public.items for select to anon
  using (status in ('Verfügbar', 'Reserviert', 'Vermietet'));

-- ---------- OWNER: nur öffentliche Profile ----------
revoke all on public.owners from anon;
grant select (id, profilname, stil, instagram, oeffentlich) on public.owners to anon;
drop policy if exists "shop owners" on public.owners;
create policy "shop owners" on public.owners for select to anon using (oeffentlich = true);

-- ---------- LOOKS ----------
revoke all on public.looks, public.look_items from anon;
grant select (id, nr, nr_num, name, style, konzept, foto_pfad) on public.looks to anon;
grant select on public.look_items to anon;
drop policy if exists "shop looks" on public.looks;
create policy "shop looks" on public.looks for select to anon using (true);
drop policy if exists "shop look_items" on public.look_items;
create policy "shop look_items" on public.look_items for select to anon using (true);

-- ---------- FOTOS: öffentlich nur die Fotos sichtbarer Teile und Looks ----------
drop policy if exists "shop fotos lesen" on storage.objects;
create policy "shop fotos lesen" on storage.objects for select to anon
  using (
    bucket_id = 'fotos' and (
      name in (select foto_pfad from public.items where foto_pfad is not null)
      or name in (select foto_pfad from public.looks where foto_pfad is not null)
    )
  );

-- ---------- ANMELDUNGEN (Owner werden) ----------
create table if not exists public.anmeldungen (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  vorname          text not null,
  nachname         text,
  email            text not null,
  telefon          text,
  instagram        text,
  groesse_oben     text,
  groesse_unten    text,
  schuhgroesse     text,
  kategorien       text[] not null default '{}',
  stile            text[] not null default '{}' check (cardinality(stile) <= 2),
  anzahl_teile     int check (anzahl_teile between 1 and 10),
  wunsch_monat     date,
  vermieten        boolean not null default false,
  vermieten_text   text,
  vermieten_fotos  text[] not null default '{}',
  nachricht        text,
  zustimmung       boolean not null check (zustimmung = true),
  -- intern (nur Frankly):
  status           text not null default 'Neu' check (status in ('Neu', 'Angenommen', 'Warteliste', 'Absage')),
  status_monat     date,
  status_grund     text,
  stil_frankly     text,
  vermieten_ok     boolean,
  owner_id         text references public.owners(id) on delete set null,
  bearbeitet_am    timestamptz
);
alter table public.anmeldungen enable row level security;

revoke all on public.anmeldungen from anon;
grant insert (vorname, nachname, email, telefon, instagram, groesse_oben, groesse_unten, schuhgroesse,
              kategorien, stile, anzahl_teile, wunsch_monat, vermieten, vermieten_text, vermieten_fotos,
              nachricht, zustimmung)
  on public.anmeldungen to anon;
grant select, insert, update, delete on public.anmeldungen to authenticated;

drop policy if exists "anmelden" on public.anmeldungen;
create policy "anmelden" on public.anmeldungen for insert to anon
  with check (status = 'Neu' and zustimmung = true);
drop policy if exists "team anmeldungen" on public.anmeldungen;
create policy "team anmeldungen" on public.anmeldungen for all to authenticated using (true) with check (true);

-- ---------- FOTO-SPEICHER für Vermiet-Fotos (privat, max. 10 MB, nur Bilder) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anmeldungen', 'anmeldungen', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "anmeldung fotos hochladen" on storage.objects;
create policy "anmeldung fotos hochladen" on storage.objects for insert to anon
  with check (bucket_id = 'anmeldungen');
drop policy if exists "team anmeldung fotos" on storage.objects;
create policy "team anmeldung fotos" on storage.objects for all to authenticated
  using (bucket_id = 'anmeldungen') with check (bucket_id = 'anmeldungen');

select 'Fertig: Shop ist öffentlich lesbar, Anmeldungen sind eingerichtet. Sichtbare Teile im Shop: ' ||
       (select count(*) from public.items where status in ('Verfügbar', 'Reserviert', 'Vermietet')) as ergebnis;
