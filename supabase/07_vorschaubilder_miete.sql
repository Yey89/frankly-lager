-- ============================================================
-- 0–100 FRANKLY · Update 5: Vorschaubilder und Mietanteil
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–06).
--
-- Neu:
--   • Der Shop darf die kleinen Vorschaubilder (thumbs/…) der sichtbaren Teile laden.
--     Das macht die Seite deutlich schneller.
--   • Neue Vermietungen: Standard-Anteil Frankly 30 % (Owner 70 %).
-- ============================================================

drop policy if exists "shop fotos lesen" on storage.objects;
create policy "shop fotos lesen" on storage.objects for select to anon
  using (
    bucket_id = 'fotos' and (
      name in (select foto_pfad from public.items where foto_pfad is not null)
      or name in (select 'thumbs/' || foto_pfad from public.items where foto_pfad is not null)
      or name in (select foto_pfad from public.looks where foto_pfad is not null)
      or name in (select 'thumbs/' || foto_pfad from public.looks where foto_pfad is not null)
    )
  );

alter table public.vermietungen alter column provision_prozent set default 30;

select 'Fertig: Vorschaubilder sind für den Shop freigegeben, Mietanteil Frankly 30 %.' as ergebnis;
