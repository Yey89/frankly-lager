-- ============================================================
-- 0–100 FRANKLY · Update 3: Mietdauer im Shop anzeigen
-- Der Shop darf von laufenden Vermietungen nur sehen: welches Teil, von wann bis wann.
-- Beträge und alles andere bleiben privat.
-- ============================================================

revoke all on public.vermietungen from anon;
grant select (item_id, von, bis, zurueck_am) on public.vermietungen to anon;

drop policy if exists "shop mietdauer" on public.vermietungen;
create policy "shop mietdauer" on public.vermietungen for select to anon
  using (
    zurueck_am is null
    and item_id in (select id from public.items where status = 'Vermietet')
  );

select 'Fertig: Der Shop zeigt bei vermieteten Teilen jetzt die Mietdauer.' as ergebnis;
