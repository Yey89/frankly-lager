-- ============================================================
-- 0–100 FRANKLY · Update 4: Owner-Bereich, 3 Monate, Anfragen
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–05).
--
-- Neu:
--   • Jedes Teil hat eine Stufe:
--       Stange (Monat 1) → Reduziert oder Upcycling (Monat 2) → Lager (Monat 3)
--   • Status "Gespendet"
--   • Jede Owner bekommt einen persönlichen Link (ohne Passwort).
--     Damit sieht sie nur IHRE Teile und kann nach jeder Runde entscheiden.
--   • Teile im Lager zeigt der Shop "Auf Anfrage". Kundinnen können sie anfragen.
-- ============================================================

-- ---------- TEILE: Stufe, wer entschieden hat, Gespendet ----------
alter table public.items
  add column if not exists stufe          text not null default 'Stange',
  add column if not exists entscheid_von  text;

alter table public.items drop constraint if exists items_stufe_check;
alter table public.items add constraint items_stufe_check
  check (stufe in ('Stange', 'Reduziert', 'Upcycling', 'Lager'));

alter table public.items drop constraint if exists items_status_check;
alter table public.items add constraint items_status_check
  check (status in ('Entwurf', 'Verfügbar', 'Reserviert', 'Verkauft', 'Vermietet', 'Zurückgegeben', 'Gespendet'));

alter table public.items drop constraint if exists items_entscheid_check;
alter table public.items add constraint items_entscheid_check
  check (entscheid is null or entscheid in ('Preis senken', 'Upcycling', 'Zurücknehmen', 'Spenden'));

-- Der Shop darf die Stufe sehen (für "Reduziert" und "Auf Anfrage")
grant select (stufe) on public.items to anon;

-- ---------- OWNER: persönlicher Link ----------
alter table public.owners
  add column if not exists zugang_token uuid not null default gen_random_uuid();
create unique index if not exists owners_zugang_token_key on public.owners (zugang_token);

-- ---------- ANFRAGEN für Teile im Lager ----------
create table if not exists public.anfragen (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  item_id     uuid not null references public.items(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  kontakt     text not null check (char_length(kontakt) between 3 and 160),
  nachricht   text check (nachricht is null or char_length(nachricht) <= 1000),
  erledigt    boolean not null default false
);
alter table public.anfragen enable row level security;

revoke all on public.anfragen from anon;
grant insert (item_id, name, kontakt, nachricht) on public.anfragen to anon;
grant select, insert, update, delete on public.anfragen to authenticated;

drop policy if exists "anfrage senden" on public.anfragen;
create policy "anfrage senden" on public.anfragen for insert to anon
  with check (
    erledigt = false
    and item_id in (select id from public.items where stufe = 'Lager' and status = 'Verfügbar')
  );
drop policy if exists "team anfragen" on public.anfragen;
create policy "team anfragen" on public.anfragen for all to authenticated using (true) with check (true);

-- ---------- HILFSFUNKTIONEN: Samstage und Runden ----------
-- Letzter Samstag des Monats, in dem m liegt
create or replace function public.frankly_last_sat(m date) returns date
language sql immutable set search_path = '' as $$
  select d - ((extract(dow from d)::int + 1) % 7)
  from (select (date_trunc('month', m) + interval '1 month' - interval '1 day')::date as d) x;
$$;

-- Heutiges Datum in Zürich
create or replace function public.frankly_heute() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Europe/Zurich')::date;
$$;

-- Nächste Runde nach der Runde p (1. Tag des Monats)
create or replace function public.frankly_next_phase(p date) returns date
language plpgsql stable set search_path = '' as $$
declare d date;
begin
  d := greatest((date_trunc('month', coalesce(p, public.frankly_heute())) + interval '1 month')::date,
                date_trunc('month', public.frankly_heute())::date);
  if public.frankly_heute() > public.frankly_last_sat(d) then
    d := (d + interval '1 month')::date;
  end if;
  return d;
end; $$;

-- ---------- OWNER-BEREICH: lesen ----------
create or replace function public.owner_portal(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare o public.owners;
begin
  select * into o from public.owners where zugang_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'heute', public.frankly_heute(),
    'owner', jsonb_build_object('id', o.id, 'profilname', o.profilname, 'provision', o.provision_prozent),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'nr', i.nr, 'titel', i.titel, 'foto_pfad', i.foto_pfad, 'groesse', i.groesse,
        'preis', i.preis, 'status', i.status, 'stufe', i.stufe, 'phase_monat', i.phase_monat,
        'phase_ende', public.frankly_last_sat(i.phase_monat),
        'naechste_runde', public.frankly_next_phase(i.phase_monat),
        'entscheid', i.entscheid, 'entscheid_datum', i.entscheid_datum, 'entscheid_notiz', i.entscheid_notiz,
        'verkauf_preis', i.verkauf_preis, 'verkauf_datum', i.verkauf_datum,
        'verkauf_provision', i.verkauf_provision, 'ausbezahlt_am', i.ausbezahlt_am
      ) order by i.nr_num)
      from public.items i where i.owner_id = o.id), '[]'::jsonb),
    'mieten', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', v.item_id, 'betrag', v.betrag, 'von', v.von, 'bis', v.bis, 'zurueck_am', v.zurueck_am,
        'provision', v.provision_prozent, 'ausbezahlt_am', v.ausbezahlt_am
      ) order by v.von)
      from public.vermietungen v join public.items i on i.id = v.item_id where i.owner_id = o.id), '[]'::jsonb)
  );
end; $$;

-- ---------- OWNER-BEREICH: entscheiden ----------
-- Erlaubt nur nach dem Ende einer Runde und nur, was zur Stufe passt:
--   Stange:              Preis senken · Upcycling · Zurücknehmen
--   Reduziert/Upcycling: Lager · Zurücknehmen · Spenden
--   Lager:               Zurücknehmen · Spenden
create or replace function public.owner_entscheid(
  p_token uuid, p_item uuid, p_wahl text,
  p_preis numeric default null, p_datum date default null, p_notiz text default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.owners;
  it public.items;
  heute date := public.frankly_heute();
  erlaubt text[];
begin
  select * into o from public.owners where zugang_token = p_token;
  if not found then raise exception 'Dieser Link ist nicht mehr gültig.'; end if;

  select * into it from public.items where id = p_item and owner_id = o.id for update;
  if not found then raise exception 'Dieses Teil wurde nicht gefunden.'; end if;
  if it.status <> 'Verfügbar' then raise exception 'Für dieses Teil ist gerade kein Entscheid möglich.'; end if;
  if it.entscheid is not null then raise exception 'Für dieses Teil ist schon entschieden. Melde dich bei Frankly, wenn du es ändern möchtest.'; end if;
  if it.phase_monat is null or heute <= public.frankly_last_sat(it.phase_monat) then
    raise exception 'Du kannst ab dem Ende der Runde entscheiden.';
  end if;

  erlaubt := case it.stufe
    when 'Stange' then array['Preis senken', 'Upcycling', 'Zurücknehmen']
    when 'Lager'  then array['Zurücknehmen', 'Spenden']
    else array['Lager', 'Zurücknehmen', 'Spenden'] end;
  if not (p_wahl = any(erlaubt)) then raise exception 'Diese Wahl ist für dieses Teil nicht möglich.'; end if;

  if p_wahl = 'Preis senken' then
    if p_preis is null or p_preis < 0 then raise exception 'Bitte einen neuen Preis eingeben.'; end if;
    if it.preis is not null and p_preis >= it.preis then raise exception 'Der neue Preis muss tiefer sein als der bisherige.'; end if;
    update public.items set preis = round(p_preis, 2), stufe = 'Reduziert', phase_monat = public.frankly_next_phase(it.phase_monat),
      entscheid = null, entscheid_datum = null, entscheid_notiz = null, entscheid_von = 'Owner'
    where id = it.id;
  elsif p_wahl = 'Lager' then
    update public.items set stufe = 'Lager', phase_monat = public.frankly_next_phase(it.phase_monat),
      entscheid = null, entscheid_datum = null, entscheid_notiz = null, entscheid_von = 'Owner'
    where id = it.id;
  elsif p_wahl = 'Upcycling' then
    if p_notiz is null or p_notiz not in ('Selbst upcyceln', 'Upcycling-Team im Josy') then raise exception 'Bitte wählen, wer upcycelt.'; end if;
    if p_notiz = 'Selbst upcyceln' and (p_datum is null or p_datum < heute or extract(dow from p_datum) <> 6) then
      raise exception 'Bitte einen Samstag für deinen Upcycling-Termin wählen.';
    end if;
    update public.items set entscheid = 'Upcycling', entscheid_datum = case when p_notiz = 'Selbst upcyceln' then p_datum end,
      entscheid_notiz = p_notiz, entscheid_von = 'Owner'
    where id = it.id;
  elsif p_wahl = 'Zurücknehmen' then
    if p_datum is null or p_datum < heute or extract(dow from p_datum) <> 6 then raise exception 'Bitte einen Samstag für die Abholung wählen.'; end if;
    update public.items set entscheid = 'Zurücknehmen', entscheid_datum = p_datum, entscheid_notiz = null, entscheid_von = 'Owner'
    where id = it.id;
  elsif p_wahl = 'Spenden' then
    update public.items set entscheid = 'Spenden', entscheid_datum = null, entscheid_notiz = null, entscheid_von = 'Owner'
    where id = it.id;
  end if;

  return public.owner_portal(p_token);
end; $$;

revoke all on function public.owner_portal(uuid) from public;
revoke all on function public.owner_entscheid(uuid, uuid, text, numeric, date, text) from public;
grant execute on function public.owner_portal(uuid) to anon, authenticated;
grant execute on function public.owner_entscheid(uuid, uuid, text, numeric, date, text) to anon, authenticated;
grant execute on function public.frankly_last_sat(date), public.frankly_heute(), public.frankly_next_phase(date) to anon, authenticated;

select 'Fertig: Owner-Bereich ist eingerichtet. ' ||
       (select count(*) from public.owners) || ' Owner haben jetzt einen persönlichen Link.' as ergebnis;
