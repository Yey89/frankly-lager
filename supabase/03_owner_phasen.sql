-- ============================================================
-- 0–100 FRANKLY · LAGER · Update 1: Owner, Phasen, Verkauf, Miete
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01 und 02).
-- Bestehende Teile und Fotos bleiben erhalten.
-- ============================================================

-- ---------- OWNER ----------
create sequence if not exists public.owner_nr_seq start 1;

create table if not exists public.owners (
  id                  text primary key default ('OWN-' || lpad(nextval('public.owner_nr_seq')::text, 3, '0')),
  profilname          text not null,             -- später evtl. öffentlich sichtbar
  stil                text,                       -- später evtl. öffentlich sichtbar
  instagram           text,                       -- später evtl. öffentlich sichtbar
  oeffentlich         boolean not null default false,  -- Zustimmung: Profil darf öffentlich gezeigt werden
  voller_name         text,                       -- intern
  email               text,                       -- intern
  telefon             text,                       -- intern
  provision_prozent   numeric(5,2) not null default 10 check (provision_prozent between 0 and 100),
  vereinbarung_datum  date,
  notiz               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

insert into public.owners (id, profilname, provision_prozent, notiz)
values ('OWN-001', 'Yesim · Frankly', 0, 'Eigene Teile, keine Provision')
on conflict (id) do nothing;
select setval('public.owner_nr_seq', greatest(1, (select coalesce(max(substring(id from 5)::int), 1) from public.owners)));

drop trigger if exists owners_updated on public.owners;
create trigger owners_updated before update on public.owners
  for each row execute function public.set_updated_at();

-- Teile mit Owner verknüpfen
update public.items set owner_id = 'OWN-001'
where owner_id is null or owner_id not in (select id from public.owners);
alter table public.items alter column owner_id set default 'OWN-001';
alter table public.items alter column owner_id set not null;
alter table public.items drop constraint if exists items_owner_fk;
alter table public.items add constraint items_owner_fk
  foreign key (owner_id) references public.owners(id) on update cascade;

-- ---------- NEUE FELDER AM TEIL ----------
alter table public.items
  add column if not exists phase_monat        date,          -- Monat der Verkaufsphase (1. Tag des Monats)
  add column if not exists verkauf_preis      numeric(10,2) check (verkauf_preis is null or verkauf_preis >= 0),
  add column if not exists verkauf_datum      date,
  add column if not exists verkauf_provision  numeric(5,2),  -- Provision zum Zeitpunkt des Verkaufs
  add column if not exists ausbezahlt_am      date,
  add column if not exists entscheid          text,
  add column if not exists entscheid_datum    date,          -- Upcycling-Termin oder Abhol-Samstag
  add column if not exists entscheid_notiz    text;

alter table public.items drop constraint if exists items_entscheid_check;
alter table public.items add constraint items_entscheid_check
  check (entscheid is null or entscheid in ('Preis senken','Upcycling','Zurücknehmen'));

alter table public.items drop constraint if exists items_status_check;
alter table public.items add constraint items_status_check
  check (status in ('Entwurf','Verfügbar','Reserviert','Verkauft','Vermietet','Zurückgegeben'));

-- ---------- VERMIETUNGEN ----------
create table if not exists public.vermietungen (
  id                 uuid primary key default gen_random_uuid(),
  item_id            uuid not null references public.items(id) on delete cascade,
  betrag             numeric(10,2) not null check (betrag >= 0),
  von                date not null default current_date,
  bis                date,
  zurueck_am         date,
  provision_prozent  numeric(5,2) not null default 10,
  ausbezahlt_am      date,
  notiz              text,
  created_at         timestamptz not null default now()
);

-- ---------- PREISVERLAUF (automatisch bei jeder Preisänderung) ----------
create table if not exists public.preis_verlauf (
  id             bigint generated always as identity primary key,
  item_id        uuid not null references public.items(id) on delete cascade,
  preis_alt      numeric(10,2),
  preis_neu      numeric(10,2),
  geaendert_am   timestamptz not null default now(),
  geaendert_von  uuid default auth.uid()
);

create or replace function public.log_preis() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.preis is distinct from old.preis then
    insert into public.preis_verlauf (item_id, preis_alt, preis_neu) values (new.id, old.preis, new.preis);
  end if;
  return new;
end; $$;

drop trigger if exists items_preis_log on public.items;
create trigger items_preis_log after update of preis on public.items
  for each row execute function public.log_preis();

-- ---------- NÄCHSTE ANZEIGENUMMER (nur Vorschau) ----------
create or replace function public.naechste_item_nr() returns text
language sql stable set search_path = '' as $$
  select 'FR-' || lpad((case when is_called then last_value + 1 else last_value end)::text, 6, '0')
  from public.item_nr_seq;
$$;
revoke all on function public.naechste_item_nr() from public, anon;
grant execute on function public.naechste_item_nr() to authenticated;

-- ---------- ZUGRIFF ----------
alter table public.owners        enable row level security;
alter table public.vermietungen  enable row level security;
alter table public.preis_verlauf enable row level security;

revoke all on public.owners, public.vermietungen, public.preis_verlauf from anon;
grant select, insert, update, delete on public.owners, public.vermietungen, public.preis_verlauf to authenticated;
grant usage, select on sequence public.owner_nr_seq to authenticated;

drop policy if exists "team owners" on public.owners;
create policy "team owners" on public.owners for all to authenticated using (true) with check (true);
drop policy if exists "team vermietungen" on public.vermietungen;
create policy "team vermietungen" on public.vermietungen for all to authenticated using (true) with check (true);
drop policy if exists "team preis_verlauf" on public.preis_verlauf;
create policy "team preis_verlauf" on public.preis_verlauf for all to authenticated using (true) with check (true);

select 'Fertig: Owner, Phasen, Verkauf und Miete sind eingerichtet. ' ||
       (select count(*) from public.owners) || ' Owner, ' ||
       (select count(*) from public.items where owner_id = 'OWN-001') || ' Teile bei OWN-001.' as ergebnis;
