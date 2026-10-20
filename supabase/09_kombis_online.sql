-- ============================================================
-- 0–100 FRANKLY · Update 7: Kombis und Online-Stange
-- Einmal komplett im Supabase SQL Editor ausführen (nach 01–08).
--
-- Neu:
--   • Kombis: Du verknüpfst im Lager Teile, die zusammenpassen. Der Shop zeigt
--     beim Teil «Kombiniere mit».
--   • Online-Stange: Nach Monat 2 oder 3 kann die Owner ihr Teil abholen und es
--     trotzdem online weiterverkaufen. Im Shop steht dann «Versand durch Owner».
--     Anfragen kommen zu Frankly.
-- ============================================================

-- ---------- Stufe «Online» ----------
alter table public.items drop constraint if exists items_stufe_check;
alter table public.items add constraint items_stufe_check
  check (stufe in ('Stange', 'Reduziert', 'Upcycling', 'Lager', 'Online'));

-- Anfragen auch für Teile auf der Online-Stange
drop policy if exists "anfrage senden" on public.anfragen;
create policy "anfrage senden" on public.anfragen for insert to anon
  with check (
    erledigt = false
    and item_id in (select id from public.items where stufe in ('Lager', 'Online') and status = 'Verfügbar')
  );

-- ---------- Kombis ----------
create table if not exists public.kombis (
  item_a      uuid not null references public.items(id) on delete cascade,
  item_b      uuid not null references public.items(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (item_a, item_b),
  check (item_a < item_b)
);
alter table public.kombis enable row level security;
revoke all on public.kombis from anon;
grant select on public.kombis to anon;
grant select, insert, delete on public.kombis to authenticated;
drop policy if exists "team kombis" on public.kombis;
create policy "team kombis" on public.kombis for all to authenticated using (true) with check (true);
drop policy if exists "shop kombis" on public.kombis;
create policy "shop kombis" on public.kombis for select to anon
  using (item_a in (select id from public.items) and item_b in (select id from public.items));

-- ---------- Owner-Bereich: Entscheid mit «Online» ----------
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
    when 'Online' then array[]::text[]
    else array['Lager', 'Zurücknehmen', 'Spenden'] end;
  if it.stufe in ('Reduziert', 'Upcycling', 'Lager') then erlaubt := erlaubt || array['Online']; end if;
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
  elsif p_wahl = 'Online' then
    if p_datum is null or p_datum < heute or extract(dow from p_datum) <> 6 then raise exception 'Bitte einen Samstag für die Abholung wählen.'; end if;
    update public.items set entscheid = 'Zurücknehmen', entscheid_datum = p_datum, entscheid_notiz = 'Online weiterverkaufen', entscheid_von = 'Owner'
    where id = it.id;
  elsif p_wahl = 'Spenden' then
    update public.items set entscheid = 'Spenden', entscheid_datum = null, entscheid_notiz = null, entscheid_von = 'Owner'
    where id = it.id;
  end if;

  return public.owner_portal(p_token);
end; $$;


-- Owner meldet: Teil von der Online-Stange ist nicht mehr verfügbar
create or replace function public.owner_online_ende(p_token uuid, p_item uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare o public.owners;
begin
  select * into o from public.owners where zugang_token = p_token;
  if not found then raise exception 'Dieser Link ist nicht mehr gültig.'; end if;
  update public.items set status = 'Zurückgegeben'
  where id = p_item and owner_id = o.id and stufe = 'Online' and status = 'Verfügbar';
  if not found then raise exception 'Dieses Teil ist nicht auf der Online-Stange.'; end if;
  return public.owner_portal(p_token);
end; $$;

revoke all on function public.owner_entscheid(uuid, uuid, text, numeric, date, text) from public;
revoke all on function public.owner_online_ende(uuid, uuid) from public;
grant execute on function public.owner_entscheid(uuid, uuid, text, numeric, date, text) to anon, authenticated;
grant execute on function public.owner_online_ende(uuid, uuid) to anon, authenticated;

select 'Fertig: Kombis und Online-Stange sind eingerichtet.' as ergebnis;
