-- ============================================================
-- 0–100 FRANKLY · Update 16: Finanzen im Lager
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–17).
--
-- • einnahmen: alles, was die App nicht selbst weiss
--   (Servicepauschale, Workshop, Create Together, Basteltisch, Anpassungen …)
-- • finanz_ziele: dein Monatsziel pro Einnahmequelle (Menge × Ø Preis)
-- Verkäufe und Vermietungen rechnet die App automatisch.
-- Nur du (angemeldet) siehst diese Daten, nie der Shop.
-- ============================================================

create table if not exists public.einnahmen (
  id          uuid primary key default gen_random_uuid(),
  datum       date not null default current_date,
  art         text not null check (art in ('Servicepauschale','Workshop','Create Together','Basteltisch','Anpassung','Mitgliedschaft','Anderes')),
  anzahl      int  not null default 1 check (anzahl >= 0),
  betrag      numeric(10,2) not null check (betrag >= 0),
  notiz       text check (notiz is null or char_length(notiz) <= 300),
  created_at  timestamptz not null default now()
);
alter table public.einnahmen enable row level security;
revoke all on public.einnahmen from anon;
grant select, insert, update, delete on public.einnahmen to authenticated;
drop policy if exists "team einnahmen" on public.einnahmen;
create policy "team einnahmen" on public.einnahmen for all to authenticated using (true) with check (true);

create table if not exists public.finanz_ziele (
  quelle  text primary key,
  anzahl  numeric(10,2) not null default 0,
  preis   numeric(10,2) not null default 0
);
alter table public.finanz_ziele enable row level security;
revoke all on public.finanz_ziele from anon;
grant select, insert, update, delete on public.finanz_ziele to authenticated;
drop policy if exists "team ziele" on public.finanz_ziele;
create policy "team ziele" on public.finanz_ziele for all to authenticated using (true) with check (true);

-- Startwerte = Variante C (Fair + Services). Bestehende Ziele bleiben.
insert into public.finanz_ziele (quelle, anzahl, preis) values
  ('Verkauf Owner-Teile', 60, 35),
  ('Servicepauschale', 12, 20),
  ('Frankly-Teile', 30, 35),
  ('Vermietung', 10, 60),
  ('Workshop', 8, 45),
  ('Create Together', 20, 50),
  ('Basteltisch', 100, 12),
  ('Anpassung', 30, 25),
  ('Kosten', 1, 1000)
on conflict (quelle) do nothing;

select 'Fertig: Finanzen sind eingerichtet.' as ergebnis;
