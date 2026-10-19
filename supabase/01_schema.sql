-- ============================================================
-- 0–100 FRANKLY · LAGER · Datenbank-Grundgerüst
-- Einmal komplett im Supabase SQL Editor ausführen.
-- ============================================================

-- ---------- TEILE (ITEMS) ----------
-- id      = feste technische Kennung, ändert sich nie
-- nr      = sichtbare Anzeigenummer (FR-000001), wird automatisch vergeben
create sequence if not exists public.item_nr_seq start 1;

create table if not exists public.items (
  id              uuid primary key default gen_random_uuid(),
  nr_num          bigint not null unique default nextval('public.item_nr_seq'),
  nr              text generated always as ('FR-' || lpad(nr_num::text, 6, '0')) stored,
  titel           text not null,
  kategorie       text,
  unterkategorie  text,
  schnitt         text,
  farben          text,
  muster          text,
  groesse         text,
  marke           text,
  material        text,
  zustand         text default 'Nicht geprüft',
  preis           numeric(10,2) check (preis is null or preis >= 0),
  owner_id        text default 'OWN-001',
  status          text not null default 'Entwurf'
                  check (status in ('Entwurf','Verfügbar','Reserviert','Verkauft','Vermietet')),
  standort        text,
  notiz           text,
  foto_pfad       text,                 -- Pfad im Speicher "fotos"
  foto_frei_pfad  text,                 -- später: freigestelltes Foto
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter sequence public.item_nr_seq owned by public.items.nr_num;

-- ---------- LOOKS ----------
create sequence if not exists public.look_nr_seq start 1;

create table if not exists public.looks (
  id          uuid primary key default gen_random_uuid(),
  nr_num      bigint not null unique default nextval('public.look_nr_seq'),
  nr          text generated always as ('LOOK-' || lpad(nr_num::text, 4, '0')) stored,
  name        text not null,
  style       text check (style in ('EDGY','FIERCE','DREAMY','AGILE')),
  status      text default 'Idee',
  konzept     text,
  bemerkung   text,
  foto_pfad   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter sequence public.look_nr_seq owned by public.looks.nr_num;

-- Ein Teil kann in vielen Looks sein, ein Look hat viele Teile
create table if not exists public.look_items (
  look_id   uuid not null references public.looks(id) on delete cascade,
  item_id   uuid not null references public.items(id) on delete cascade,
  position  int  not null default 1,
  primary key (look_id, item_id)
);

-- ---------- RFID (für später) ----------
create table if not exists public.tags (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid references public.items(id) on delete set null,
  technologie  text default 'RFID',
  epc          text unique,
  status       text default 'aktiv',
  created_at   timestamptz not null default now()
);

-- ---------- "zuletzt geändert" automatisch setzen ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists items_updated on public.items;
create trigger items_updated before update on public.items
  for each row execute function public.set_updated_at();
drop trigger if exists looks_updated on public.looks;
create trigger looks_updated before update on public.looks
  for each row execute function public.set_updated_at();

-- ---------- ZUGRIFF: nur angemeldete Personen ----------
alter table public.items      enable row level security;
alter table public.looks      enable row level security;
alter table public.look_items enable row level security;
alter table public.tags       enable row level security;

revoke all on public.items, public.looks, public.look_items, public.tags from anon;
grant select, insert, update, delete on public.items, public.looks, public.look_items, public.tags to authenticated;
grant usage, select on sequence public.item_nr_seq, public.look_nr_seq to authenticated;

drop policy if exists "team items" on public.items;
create policy "team items" on public.items for all to authenticated using (true) with check (true);
drop policy if exists "team looks" on public.looks;
create policy "team looks" on public.looks for all to authenticated using (true) with check (true);
drop policy if exists "team look_items" on public.look_items;
create policy "team look_items" on public.look_items for all to authenticated using (true) with check (true);
drop policy if exists "team tags" on public.tags;
create policy "team tags" on public.tags for all to authenticated using (true) with check (true);

-- ---------- FOTO-SPEICHER (privat) ----------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists "team fotos lesen" on storage.objects;
create policy "team fotos lesen" on storage.objects for select to authenticated using (bucket_id = 'fotos');
drop policy if exists "team fotos hochladen" on storage.objects;
create policy "team fotos hochladen" on storage.objects for insert to authenticated with check (bucket_id = 'fotos');
drop policy if exists "team fotos ändern" on storage.objects;
create policy "team fotos ändern" on storage.objects for update to authenticated using (bucket_id = 'fotos');
drop policy if exists "team fotos löschen" on storage.objects;
create policy "team fotos löschen" on storage.objects for delete to authenticated using (bucket_id = 'fotos');

select 'Fertig: Tabellen, Zugriffsregeln und Foto-Speicher sind eingerichtet.' as ergebnis;
