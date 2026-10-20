-- ============================================================
-- 0–100 FRANKLY · Update 14: Online reservieren
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–15).
--
-- Kundinnen können im Shop ein Teil reservieren, das im Laden hängt
-- (Stange, Reduziert, Upcycling). Die Reservation gilt bis Ladenschluss
-- des 2. Öffnungstags (Mi–Fr 19 Uhr, Sa 17 Uhr).
--   Beispiel: reserviert am Montag → gilt bis Donnerstag 19 Uhr.
-- Danach ist das Teil automatisch wieder verfügbar.
-- Name und Kontakt landen als Anfrage beim Teil (nur das Team sieht sie).
-- Höchstens 3 offene Reservationen pro Kontakt.
-- Reservierst du im Lager von Hand, läuft die Reservation nicht ab.
-- ============================================================

alter table public.items add column if not exists reserviert_bis timestamptz;
grant select (reserviert_bis) on public.items to anon;

-- Ändert das Team den Status (z.B. Verkauft), fällt die Frist weg
create or replace function public.items_res_frist_weg() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from 'Reserviert' then new.reserviert_bis := null; end if;
  return new;
end $$;
drop trigger if exists items_res_frist on public.items;
create trigger items_res_frist before update of status on public.items
  for each row execute function public.items_res_frist_weg();

-- Frist: Ladenschluss des 2. Öffnungstags ab jetzt (heute zählt, wenn noch offen)
create or replace function public.frankly_res_frist(p_jetzt timestamptz default now()) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare
  lok timestamp := p_jetzt at time zone 'Europe/Zurich';
  d date := lok::date;
  n int := 0;
  wt int;
  zu time;
begin
  loop
    wt := extract(isodow from d);              -- 1 = Montag … 7 = Sonntag
    if wt between 3 and 6 then                 -- Mittwoch bis Samstag offen
      zu := case when wt = 6 then time '17:00' else time '19:00' end;
      if d > lok::date or lok::time < zu then
        n := n + 1;
        if n = 2 then return (d + zu) at time zone 'Europe/Zurich'; end if;
      end if;
    end if;
    d := d + 1;
  end loop;
end $$;

-- Abgelaufene Online-Reservationen wieder freigeben
create or replace function public.frankly_res_aufraeumen() returns void
language sql volatile security definer set search_path = '' as $$
  update public.items set status = 'Verfügbar'
  where status = 'Reserviert' and reserviert_bis is not null and reserviert_bis < now();
$$;

create or replace function public.frankly_reservieren(p_item uuid, p_name text, p_kontakt text)
returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  frist timestamptz := public.frankly_res_frist(now());
  offen int;
begin
  perform public.frankly_res_aufraeumen();
  p_name := btrim(coalesce(p_name, '')); p_kontakt := btrim(coalesce(p_kontakt, ''));
  if char_length(p_name) < 1 or char_length(p_name) > 120 then raise exception 'Bitte deinen Namen angeben.'; end if;
  if char_length(p_kontakt) < 3 or char_length(p_kontakt) > 160 then raise exception 'Bitte E-Mail oder Telefon angeben.'; end if;

  select count(*) into offen
  from public.anfragen a join public.items i on i.id = a.item_id
  where lower(a.kontakt) = lower(p_kontakt) and a.nachricht like 'Online reserviert%'
    and i.status = 'Reserviert' and i.reserviert_bis > now();
  if offen >= 3 then raise exception 'Du hast schon 3 Teile reserviert. Mehr geht gleichzeitig leider nicht.'; end if;

  update public.items set status = 'Reserviert', reserviert_bis = frist
  where id = p_item and status = 'Verfügbar' and stufe in ('Stange', 'Reduziert', 'Upcycling');
  if not found then raise exception 'Dieses Teil kann gerade nicht reserviert werden. Vielleicht war jemand schneller.'; end if;

  insert into public.anfragen (item_id, name, kontakt, nachricht)
  values (p_item, p_name, p_kontakt,
    'Online reserviert bis ' || to_char(frist at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI') || ' Uhr');
  return frist;
end $$;

revoke all on function public.frankly_reservieren(uuid, text, text) from public;
grant execute on function public.frankly_reservieren(uuid, text, text) to anon, authenticated;
grant execute on function public.frankly_res_aufraeumen() to anon, authenticated;
grant execute on function public.frankly_res_frist(timestamptz) to anon, authenticated;

select 'Fertig: Online reservieren ist eingerichtet. Frist ab jetzt: '
  || to_char(public.frankly_res_frist() at time zone 'Europe/Zurich', 'Dy DD.MM. HH24:MI') as ergebnis;
