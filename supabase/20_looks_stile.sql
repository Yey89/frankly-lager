-- ============================================================
-- 0–100 FRANKLY · Update 20: Nur noch 4 Stil-Looks
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–19).
--
-- Danach gibt es genau 4 Looks: FIERCE, EDGY, DREAMY, AGILE.
-- Alle Teile aus den bisherigen Looks kommen in den Look mit dem
-- gleichen Stil. Teile aus Looks OHNE Stil sind danach in keinem
-- Look mehr (sie stehen unten in der Liste). Die Teile selbst
-- bleiben natürlich alle erhalten.
-- ============================================================

-- 1. Für jeden Stil einen Ziel-Look (den ältesten mit diesem Stil, sonst neu)
create temp table ziel as
select s.style, coalesce(
  (select id from public.looks l where l.style = s.style order by nr_num limit 1),
  gen_random_uuid()) as id
from unnest(array['FIERCE','EDGY','DREAMY','AGILE']) as s(style);

insert into public.looks (id, name, style, status)
select z.id, z.style, z.style, 'Aktiv' from ziel z
where not exists (select 1 from public.looks l where l.id = z.id);

update public.looks l set name = z.style, status = coalesce(nullif(l.status, 'Idee'), 'Aktiv')
from ziel z where l.id = z.id;

-- 2. Teile aus den anderen Looks mit Stil in den Ziel-Look verschieben
insert into public.look_items (look_id, item_id, position)
select z.id, li.item_id,
  1000 + row_number() over (partition by z.id order by l.nr_num, li.position)
from public.look_items li
join public.looks l on l.id = li.look_id
join ziel z on z.style = l.style
where l.id <> z.id
on conflict do nothing;

-- Merken, welche Teile in Looks ohne Stil waren
create temp table ohne as
select distinct i.nr
from public.look_items li
join public.looks l on l.id = li.look_id
join public.items i on i.id = li.item_id
where l.style is null
  and not exists (select 1 from public.look_items x join ziel z on z.id = x.look_id where x.item_id = li.item_id);

-- 3. Alle anderen Looks löschen (Teile bleiben erhalten)
delete from public.looks where id not in (select id from ziel);

-- 4. Positionen aufräumen und Nummern 1–4
update public.look_items li set position = r.n
from (select look_id, item_id, row_number() over (partition by look_id order by position) as n from public.look_items) r
where r.look_id = li.look_id and r.item_id = li.item_id;

update public.looks set nr_num = nr_num + 1000000;
update public.looks l set nr_num = array_position(array['FIERCE','EDGY','DREAMY','AGILE'], l.style);
select setval('public.look_nr_seq', 4, true);

-- Pro Stil nur ein Look
create unique index if not exists looks_style_einmal on public.looks (style);

select l.style as look, count(li.item_id) as teile
from public.looks l left join public.look_items li on li.look_id = l.id
group by l.style, l.nr_num
union all
select 'Ohne Stil, jetzt in keinem Look: ' || coalesce(string_agg(nr, ', '), 'keine'), null from ohne;
