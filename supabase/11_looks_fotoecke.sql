-- ============================================================
-- 0–100 FRANKLY · Update 9: Fotoecke-Fotos als Looks im Shop
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–10).
--
-- Der Shop darf Fotos aus der Fotoecke zeigen, aber NUR wenn
--   • du sie freigegeben hast UND
--   • die Person «auf Instagram und Website zeigen» angekreuzt hat.
-- Sichtbar sind nur Foto, Vorname, Instagram-Name und Teile-Nummern.
-- Gutschein-Codes und alles andere bleiben privat.
-- ============================================================

grant select (id, created_at, pfad, teile, name, instagram) on public.fotoecke to anon;
drop policy if exists "shop fotoecke looks" on public.fotoecke;
create policy "shop fotoecke looks" on public.fotoecke for select to anon
  using (status = 'Freigegeben' and ok_oeffentlich = true);

drop policy if exists "shop fotoecke fotos lesen" on storage.objects;
create policy "shop fotoecke fotos lesen" on storage.objects for select to anon
  using (bucket_id = 'fotoecke' and name in (select pfad from public.fotoecke));

select 'Fertig: Freigegebene Fotos erscheinen im Shop unter Looks.' as ergebnis;
