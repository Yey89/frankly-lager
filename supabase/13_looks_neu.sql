-- ============================================================
-- 0–100 FRANKLY · Update 11: Looks aus verknüpften Teilen
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–12).
--
-- 1. Löscht die alten Start-Looks mit Foto (z.B. «Denim × Sheer»).
--    Deine Teile bleiben alle erhalten.
-- 2. Macht aus deinen bisherigen Verknüpfungen («Passt zu») Looks.
-- 3. Nummeriert die Looks neu ab LOOK-0001.
-- ============================================================

delete from public.looks where foto_pfad like 'looks/%';

do $$
declare k record; la uuid; lb uuid; lid uuid; pos int;
begin
  for k in select * from public.kombis order by created_at loop
    select look_id into la from public.look_items where item_id = k.item_a limit 1;
    select look_id into lb from public.look_items where item_id = k.item_b limit 1;
    lid := coalesce(la, lb);
    if lid is null then
      insert into public.looks (name, status)
      select coalesce(a.titel, 'Look') || ' + ' || coalesce(b.titel, ''), 'Aktiv'
      from public.items a, public.items b where a.id = k.item_a and b.id = k.item_b
      returning id into lid;
    end if;
    select coalesce(max(position), 0) into pos from public.look_items where look_id = lid;
    insert into public.look_items (look_id, item_id, position) values (lid, k.item_a, pos + 1) on conflict do nothing;
    insert into public.look_items (look_id, item_id, position) values (lid, k.item_b, pos + 2) on conflict do nothing;
  end loop;
  delete from public.kombis;
end $$;

update public.looks set nr_num = nr_num + 1000000;
update public.looks l set nr_num = r.n
  from (select id, row_number() over (order by created_at, id) as n from public.looks) r
  where r.id = l.id;
select setval('public.look_nr_seq', greatest(1, (select coalesce(max(nr_num), 0) from public.looks)), (select count(*) > 0 from public.looks));

select nr, name from public.looks order by nr_num;
