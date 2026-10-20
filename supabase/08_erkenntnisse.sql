-- ============================================================
-- 0–100 FRANKLY · Update 6: Erkenntnisse für die spätere Kollektion
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–07).
--
-- Neu:
--   • Pro Teil: Wie oft wurde es getragen? Warum gibt die Owner es ab?
--     (Was NICHT im Kleiderschrank bleibt)
--   • Lieblingsteile: Karten von Kundinnen zu Kleidern, die sie seit Jahren tragen,
--     und warum. (Was im Kleiderschrank BLEIBT)
--   Beides sieht nur das Team. Der Shop sieht nichts davon.
-- ============================================================

alter table public.items
  add column if not exists getragen      text,
  add column if not exists abgabe_grund  text;

alter table public.items drop constraint if exists items_getragen_check;
alter table public.items add constraint items_getragen_check
  check (getragen is null or getragen in ('Nie', 'Selten', 'Oft', 'Jahrelang'));

alter table public.items drop constraint if exists items_abgabe_grund_check;
alter table public.items add constraint items_abgabe_grund_check
  check (abgabe_grund is null or abgabe_grund in ('Passt nicht mehr', 'Passform stimmte nie', 'Stil passt nicht mehr',
    'Nie getragen', 'Zu viele ähnliche', 'Abgenutzt', 'Anderes'));

create table if not exists public.lieblingsteile (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kategorie   text,
  farbe       text,
  material    text,
  stil        text check (stil is null or stil in ('EDGY', 'FIERCE', 'DREAMY', 'AGILE')),
  jahre       int check (jahre is null or jahre between 0 and 80),
  gruende     text[] not null default '{}',
  notiz       text
);
alter table public.lieblingsteile enable row level security;
revoke all on public.lieblingsteile from anon;
grant select, insert, update, delete on public.lieblingsteile to authenticated;
drop policy if exists "team lieblingsteile" on public.lieblingsteile;
create policy "team lieblingsteile" on public.lieblingsteile for all to authenticated using (true) with check (true);

select 'Fertig: Erkenntnisse sind eingerichtet.' as ergebnis;
