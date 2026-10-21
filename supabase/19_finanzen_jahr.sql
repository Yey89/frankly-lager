-- ============================================================
-- 0–100 FRANKLY · Update 17: Finanzplan fürs ganze erste Jahr
-- Einmal komplett im Supabase SQL Editor ausführen (nach 18_finanzen.sql).
--
-- • Ziele pro Quartal (Monat 1–3, 4–6, 7–9, 10–12)
-- • Mitgliedschaft und Zuschlag für Nichtmitglieder ab Monat 1
-- • Startmonat (änderbar im Lager unter Finanzen → Ziele anpassen)
-- ============================================================

alter table public.einnahmen drop constraint if exists einnahmen_art_check;
alter table public.einnahmen add constraint einnahmen_art_check
  check (art in ('Servicepauschale','Workshop','Create Together','Basteltisch','Anpassung','Mitgliedschaft','Zuschlag Nichtmitglieder','Anderes'));

-- alte Ziele ohne Quartal entfernen
delete from public.finanz_ziele where quelle not like 'Q_|%' and quelle <> 'Start';

insert into public.finanz_ziele (quelle, anzahl, preis) values
  ('Q1|Verkauf Owner-Teile', 30, 35), ('Q2|Verkauf Owner-Teile', 40, 35), ('Q3|Verkauf Owner-Teile', 50, 35), ('Q4|Verkauf Owner-Teile', 60, 35),
  ('Q1|Servicepauschale', 6, 20),     ('Q2|Servicepauschale', 8, 20),     ('Q3|Servicepauschale', 10, 20),    ('Q4|Servicepauschale', 12, 20),
  ('Q1|Frankly-Teile', 15, 35),       ('Q2|Frankly-Teile', 20, 35),       ('Q3|Frankly-Teile', 20, 35),       ('Q4|Frankly-Teile', 25, 35),
  ('Q1|Mitgliedschaft', 15, 5),       ('Q2|Mitgliedschaft', 35, 5),       ('Q3|Mitgliedschaft', 50, 7),       ('Q4|Mitgliedschaft', 80, 8),
  ('Q1|Zuschlag Nichtmitglieder', 38, 2), ('Q2|Zuschlag Nichtmitglieder', 45, 3), ('Q3|Zuschlag Nichtmitglieder', 49, 4), ('Q4|Zuschlag Nichtmitglieder', 51, 5),
  ('Q1|Vermietung', 3, 60),           ('Q2|Vermietung', 5, 60),           ('Q3|Vermietung', 6, 60),           ('Q4|Vermietung', 8, 60),
  ('Q1|Workshop', 5, 45),             ('Q2|Workshop', 6, 45),             ('Q3|Workshop', 7, 45),             ('Q4|Workshop', 8, 45),
  ('Q1|Create Together', 6, 50),      ('Q2|Create Together', 10, 50),     ('Q3|Create Together', 12, 50),     ('Q4|Create Together', 15, 50),
  ('Q1|Basteltisch', 40, 10),         ('Q2|Basteltisch', 60, 11),         ('Q3|Basteltisch', 70, 11),         ('Q4|Basteltisch', 80, 12),
  ('Q1|Anpassung', 10, 25),           ('Q2|Anpassung', 15, 25),           ('Q3|Anpassung', 18, 25),           ('Q4|Anpassung', 22, 25),
  ('Q1|Kosten', 1, 575),              ('Q2|Kosten', 1, 710),              ('Q3|Kosten', 1, 780),              ('Q4|Kosten', 1, 890)
on conflict (quelle) do nothing;

select 'Fertig: Finanzplan fürs erste Jahr ist eingerichtet.' as ergebnis;
