-- ============================================================
-- 0–100 FRANKLY · Update 13: neuer Abgabegrund
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–14).
--
-- Neu bei «Warum abgegeben»: «Wusste nicht, wie kombinieren».
-- (Die neuen Kategorien Tuniken und Kimonos brauchen kein SQL.)
-- ============================================================

alter table public.items drop constraint if exists items_abgabe_grund_check;
alter table public.items add constraint items_abgabe_grund_check
  check (abgabe_grund is null or abgabe_grund in ('Passt nicht mehr', 'Passform stimmte nie', 'Stil passt nicht mehr',
    'Nie getragen', 'Zu viele ähnliche', 'Wusste nicht, wie kombinieren', 'Abgenutzt', 'Anderes'));

select 'Fertig: Neuer Abgabegrund ist eingerichtet.' as ergebnis;
