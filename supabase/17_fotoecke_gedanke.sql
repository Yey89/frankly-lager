-- ============================================================
-- 0–100 FRANKLY · Update 15: Gedanke zum Look (Fotoecke)
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–16).
--
-- Beim Hochladen kann man freiwillig einen Gedanken zum Outfit
-- schreiben (max. 280 Zeichen). Er erscheint im Shop unter
-- «Aus der Fotoecke», aber nur bei freigegebenen und öffentlichen Fotos.
-- ============================================================

alter table public.fotoecke
  add column if not exists gedanke text check (gedanke is null or char_length(gedanke) <= 280);

grant insert (gedanke) on public.fotoecke to anon;
grant select (gedanke) on public.fotoecke to anon;

select 'Fertig: Gedanken zum Look sind eingerichtet.' as ergebnis;
