-- ============================================================
-- 0–100 FRANKLY · Update 8: Zusatzfotos und Fotoecke
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–09).
--
-- Neu:
--   • Pro Teil weitere Fotos: Hinten, Etikett, Detail, Mangel.
--     Der Shop zeigt sie unter dem Hauptfoto.
--   • Fotoecke: Besucherinnen laden über den QR-Code (foto.html) ihr Foto hoch,
--     mit Zustimmung, wofür es genutzt werden darf. Sie bekommen einen Gutschein-Code.
--     Nur das Team sieht die Fotos und gibt sie frei.
-- ============================================================

-- ---------- Zusatzfotos pro Teil ----------
-- Liste von {"pfad": "...", "art": "Hinten" | "Etikett" | "Detail" | "Mangel"}
alter table public.items add column if not exists fotos_extra jsonb not null default '[]'::jsonb;
grant select (fotos_extra) on public.items to anon;

drop policy if exists "shop fotos lesen" on storage.objects;
create policy "shop fotos lesen" on storage.objects for select to anon
  using (
    bucket_id = 'fotos' and (
      name in (select foto_pfad from public.items where foto_pfad is not null)
      or name in (select 'thumbs/' || foto_pfad from public.items where foto_pfad is not null)
      or name in (select f->>'pfad' from public.items, jsonb_array_elements(fotos_extra) f)
      or name in (select 'thumbs/' || (f->>'pfad') from public.items, jsonb_array_elements(fotos_extra) f)
      or name in (select foto_pfad from public.looks where foto_pfad is not null)
      or name in (select 'thumbs/' || foto_pfad from public.looks where foto_pfad is not null)
    )
  );

-- ---------- Fotoecke ----------
create table if not exists public.fotoecke (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  pfad                    text not null,
  teile                   text check (teile is null or char_length(teile) <= 200),
  name                    text check (name is null or char_length(name) <= 80),
  instagram               text check (instagram is null or char_length(instagram) <= 60),
  ok_intern               boolean not null default true,
  ok_oeffentlich          boolean not null default false,
  gutschein               text unique check (gutschein ~ '^FOTO-[A-Z0-9]{5}$'),
  -- intern (nur Frankly):
  status                  text not null default 'Neu' check (status in ('Neu', 'Freigegeben', 'Abgelehnt')),
  eingeloest_am           timestamptz
);
alter table public.fotoecke enable row level security;

revoke all on public.fotoecke from anon;
grant insert (pfad, teile, name, instagram, ok_intern, ok_oeffentlich, gutschein) on public.fotoecke to anon;
grant select, insert, update, delete on public.fotoecke to authenticated;

drop policy if exists "fotoecke senden" on public.fotoecke;
create policy "fotoecke senden" on public.fotoecke for insert to anon
  with check (status = 'Neu' and eingeloest_am is null and pfad like 'upload/%');
drop policy if exists "team fotoecke" on public.fotoecke;
create policy "team fotoecke" on public.fotoecke for all to authenticated using (true) with check (true);

-- Privater Speicher für die Fotos (max. 10 MB, nur Bilder)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotoecke', 'fotoecke', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "fotoecke hochladen" on storage.objects;
create policy "fotoecke hochladen" on storage.objects for insert to anon
  with check (bucket_id = 'fotoecke' and name like 'upload/%');
drop policy if exists "team fotoecke fotos" on storage.objects;
create policy "team fotoecke fotos" on storage.objects for all to authenticated
  using (bucket_id = 'fotoecke') with check (bucket_id = 'fotoecke');

select 'Fertig: Zusatzfotos und Fotoecke sind eingerichtet.' as ergebnis;
