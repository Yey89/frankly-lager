-- ============================================================
-- 0–100 FRANKLY · Starterdaten: 8 Teile, 4 Looks (aus Frankly_Artikeldatenbank.xlsx)
-- Erst NACH 01_schema.sql ausführen. Nur einmal ausführen.
-- ============================================================

insert into public.items (id, nr_num, titel, kategorie, unterkategorie, schnitt, farben, muster, groesse, marke, material, zustand, preis, owner_id, status, standort, notiz, foto_pfad) values
  ('98d0828d-926b-49b0-af83-f29aafc02f23', 1, 'Blue Flared Jeans', 'Hosen', 'Jeans', 'Flared / Bootcut', 'Dunkelblau', 'Uni / Denim-Waschung', '28? (prüfen)', 'Unbekannt', 'Unbekannt', 'Nicht geprüft', null, 'OWN-001', 'Entwurf', null, 'Dunkelblaue Flared Jeans; im EDGY-Look mit transparenter schwarzer Bluse kombiniert', 'originale/FR-000001_front.jpg'),
  ('ba9a859e-652e-4812-9a87-f99fa254a525', 2, 'Floral Mini Skirt', 'Röcke', 'Minirock', 'Ausgestellt / Bindebund', 'Blau; Grün; Violett; Schwarz', 'Floral', 'Unbekannt', 'Unbekannt', 'Unbekannt', 'Nicht geprüft', null, 'OWN-001', 'Entwurf', null, 'Floraler Minirock mit Bindebund', 'originale/FR-000002_front.jpg'),
  ('282fd613-959d-4a2b-84a8-3ac6f2979898', 3, 'Grey Zip Hoodie', 'Oberteile', 'Hoodie / Sweatjacke', 'Locker, Reissverschluss, Kapuze', 'Grau', 'Uni', 'Noch prüfen', 'Polo Ralph Lauren? (Logo; prüfen)', 'Noch prüfen', 'Nicht geprüft', null, 'OWN-001', 'Entwurf', null, 'Graues Zip-Hoodie mit Kängurutaschen und kleinem Polospieler-Logo; Marke am Etikett prüfen', 'originale/FR-000003_front.jpg'),
  ('ac81257b-bc1a-4917-ba3b-a12aede076aa', 4, 'Grey Joggers', 'Hosen', 'Jogginghose', 'Schmal zulaufend / Bündchen', 'Grau', 'Uni', 'Noch prüfen', 'Polo Ralph Lauren? (Logo; prüfen)', 'Noch prüfen', 'Nicht geprüft', null, 'OWN-001', 'Entwurf', null, 'Graue Jogginghose mit Kordelzug, Taschen und kleinem Logo; mögliche Kombination mit Hoodie', 'originale/FR-000004_front.jpg'),
  ('4eb2ce5e-619b-463b-b4b0-89df48880a2b', 5, 'Black Ribbed Shorts', 'Hosen', 'Shorts', 'Kurz, breiter elastischer Bund', 'Schwarz', 'Rippstruktur', 'Noch prüfen', 'Unbekannt', 'Noch prüfen', 'Nicht geprüft', null, 'OWN-001', 'Entwurf', null, 'Schwarze gerippte Shorts mit breitem Bund', 'originale/FR-000005_front.jpg'),
  ('4d4fc4e3-47d2-4f65-8f1e-ac34c4f54ce4', 6, 'White Long Shirt Dress', 'Kleider', 'Hemdblusenkleid / Longshirt', 'Lang, gerade, Hemdkragen', 'Weiss', 'Uni', 'Noch prüfen', 'Unbekannt', 'Noch prüfen', 'Nicht geprüft', null, 'OWN-001', 'Entwurf', null, 'Weisses langes Hemdblusenkleid mit Knopfleiste und langen Ärmeln', 'originale/FR-000006_front.jpg'),
  ('0875a1cd-515c-413c-b3fc-b6d07365d98a', 7, 'Blue Denim Belted Jacket', 'Jacken', 'Jeansjacke', 'Taillierbar mit Bindegürtel', 'Dunkelblau', 'Denim', 'Noch prüfen', 'Levi’s (Etikett sichtbar)', 'Noch prüfen', 'Nicht geprüft', null, 'OWN-001', 'Entwurf', null, 'Dunkelblaue Jeansjacke mit Bindegürtel und markanten Nähten', 'originale/FR-000007_front.jpg'),
  ('dd8e2f79-6d50-4dc9-944d-6a912f7f9b4c', 8, 'Black Sheer Textured Shirt', 'Oberteile', 'Transparente Bluse', 'Langarm, Kragen, Knopfleiste', 'Schwarz', 'Struktur / transparent', 'Noch prüfen', 'IPEKYOL (Etikett sichtbar)', 'Noch prüfen', 'Nicht geprüft', null, 'OWN-001', 'Entwurf', null, 'Schwarze transparente strukturierte Bluse mit blickdichtem Kragen und Manschetten', 'originale/FR-000008_front.jpg');

insert into public.looks (id, nr_num, name, style, status, konzept, bemerkung, foto_pfad) values
  ('fd23cdb2-d38e-5ada-b8cf-d37da8521993', 1, 'Denim × Sheer', 'EDGY', 'Fotografiert', 'Dunkelblaue Flared Jeans + transparente schwarze IPEKYOL-Bluse', 'Stil gilt für Kombination, nicht für Einzelteile', 'looks/LOOK-0001.jpg'),
  ('6d6be6b5-d503-579b-af8e-4874ac4d59e7', 2, 'Grey on Grey', 'AGILE', 'Fotografiert', 'Graues Zip-Hoodie + graue Jogginghose', 'Passform und Set-Zugehörigkeit noch prüfen', 'looks/LOOK-0002.jpg'),
  ('d6a05ad9-87f5-55f3-93b6-1382b83370c1', 3, 'Clean Contrast', 'AGILE', 'Fotografiert', 'Schwarze gerippte Shorts + weisses langes Hemdblusenkleid', 'Style-Vorschlag, noch zu bestätigen', 'looks/LOOK-0003.jpg'),
  ('04111264-80fe-507b-ba66-d9df15334dc9', 4, 'Floral Denim', 'DREAMY', 'Fotografiert', 'Floraler Minirock + dunkelblaue Levi''s-Jeansjacke mit Gürtel', 'Style-Vorschlag, noch zu bestätigen', 'looks/LOOK-0004.jpg');

insert into public.look_items (look_id, item_id, position) values
  ('fd23cdb2-d38e-5ada-b8cf-d37da8521993', '98d0828d-926b-49b0-af83-f29aafc02f23', 1),
  ('fd23cdb2-d38e-5ada-b8cf-d37da8521993', 'dd8e2f79-6d50-4dc9-944d-6a912f7f9b4c', 2),
  ('6d6be6b5-d503-579b-af8e-4874ac4d59e7', '282fd613-959d-4a2b-84a8-3ac6f2979898', 1),
  ('6d6be6b5-d503-579b-af8e-4874ac4d59e7', 'ac81257b-bc1a-4917-ba3b-a12aede076aa', 2),
  ('d6a05ad9-87f5-55f3-93b6-1382b83370c1', '4eb2ce5e-619b-463b-b4b0-89df48880a2b', 1),
  ('d6a05ad9-87f5-55f3-93b6-1382b83370c1', '4d4fc4e3-47d2-4f65-8f1e-ac34c4f54ce4', 2),
  ('04111264-80fe-507b-ba66-d9df15334dc9', 'ba9a859e-652e-4812-9a87-f99fa254a525', 1),
  ('04111264-80fe-507b-ba66-d9df15334dc9', '0875a1cd-515c-413c-b3fc-b6d07365d98a', 2);

-- Nächste automatische Nummern: FR-000009 und LOOK-0005
select setval('public.item_nr_seq', (select max(nr_num) from public.items));
select setval('public.look_nr_seq', (select max(nr_num) from public.looks));

select 'Fertig: ' || (select count(*) from public.items) || ' Teile und ' || (select count(*) from public.looks) || ' Looks importiert.' as ergebnis;
