-- ============================================================
-- 0–100 FRANKLY · Update 12: Outfit-Bild für Looks
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–13).
--
-- Neu: freigestellte Fotos (ohne Hintergrund) für das Outfit-Bild.
-- Gespeichert unter cut/… im Bucket «fotos». Der Shop darf sie laden.
-- ============================================================

alter table public.items add column if not exists cut_pfad text;
grant select (cut_pfad) on public.items to anon;

drop policy if exists "shop fotos lesen" on storage.objects;
create policy "shop fotos lesen" on storage.objects for select to anon
  using (
    bucket_id = 'fotos' and (
      name in (select foto_pfad from public.items where foto_pfad is not null)
      or name in (select 'thumbs/' || foto_pfad from public.items where foto_pfad is not null)
      or name in (select cut_pfad from public.items where cut_pfad is not null)
      or name in (select f->>'pfad' from public.items, jsonb_array_elements(fotos_extra) f)
      or name in (select 'thumbs/' || (f->>'pfad') from public.items, jsonb_array_elements(fotos_extra) f)
      or name in (select foto_pfad from public.looks where foto_pfad is not null)
      or name in (select 'thumbs/' || foto_pfad from public.looks where foto_pfad is not null)
    )
  );

select 'Fertig: Outfit-Bilder sind eingerichtet.' as ergebnis;
