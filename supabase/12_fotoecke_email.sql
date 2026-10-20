-- ============================================================
-- 0–100 FRANKLY · Update 10: Gutschein per E-Mail (Fotoecke)
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–11).
--
-- Die Kundin kann beim Foto freiwillig ihre E-Mail angeben.
-- Nur das Team sieht sie (nie öffentlich). Im Lager: «Gutschein-Mail senden».
-- ============================================================

alter table public.fotoecke
  add column if not exists email           text check (email is null or (char_length(email) <= 160 and email like '%@%')),
  add column if not exists mail_gesendet_am timestamptz;

grant insert (email) on public.fotoecke to anon;

select 'Fertig: E-Mail für Gutscheine ist eingerichtet.' as ergebnis;
