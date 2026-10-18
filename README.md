# 0–100 Frankly · Lager

Web-App zum Erfassen und Verwalten der Frankly-Teile, Fotos und Looks.
Läuft im Browser auf Handy und PC, kann auf dem Homescreen abgelegt werden.

## Aufbau

| Teil | Wo | Wozu |
|---|---|---|
| Web-App | dieses Repository, veröffentlicht über GitHub Pages | Oberfläche: erfassen, suchen, Looks bilden |
| Datenbank | Supabase (PostgreSQL), Projekt `frankly-lager` | Teile, Looks, Verknüpfungen |
| Fotos | Supabase Storage, privater Bucket `fotos` | Originalfotos; Zugriff nur angemeldet |
| Login | Supabase Auth (E-Mail + Passwort) | Nur eingeladene Personen; Registrierung ist ausgeschaltet |

Kein Build-Schritt, kein Framework: `index.html`, `style.css`, `app.js`, `config.js`.
Bibliothek: `@supabase/supabase-js` 2.110.1 über jsDelivr.

## Datenmodell (`supabase/01_schema.sql`)

- **items**: ein Kleidungsstück. `id` (UUID) ändert sich nie. `nr` (FR-000001) ist die sichtbare
  Anzeigenummer und wird aus `nr_num` automatisch erzeugt (Sequenz `item_nr_seq`).
- **looks**: Kombination mehrerer Teile. Der Style (EDGY/FIERCE/DREAMY/AGILE) gehört zum Look.
- **look_items**: Verknüpfung Look ↔ Teil (ein Teil kann in vielen Looks sein).
- **tags**: vorbereitet für RFID (EPC ↔ item_id). Noch nicht in der App.
- Besitzerin (`owner_id`) und Standort (`standort`) sind vorerst Textfelder, später eigene Tabellen.

Fotopfade im Bucket `fotos`:
- `originale/FR-00000X_front.jpg`, `looks/LOOK-000X.jpg`: Starterpaket
- `items/<uuid>.jpg`, `looks-neu/<uuid>.jpg`: in der App hochgeladen (max. 1600 px, JPEG)

## Sicherheit

- `config.js` enthält nur die Projekt-URL und den **publishable** Key. Beides ist für den Browser gedacht.
- Alle Tabellen haben Row Level Security: nur `authenticated` darf lesen/schreiben, `anon` nichts.
- Der **secret/service_role** Key und das Datenbank-Passwort gehören **nie** in dieses Repository.

## Nächste Ausbaustufen (Ideen)

1. Hintergrund entfernen (zweites Foto `foto_frei_pfad`, Original bleibt)
2. QR-Code / Hangtag-Druck pro Teil, Adresse z. B. `/i/FR-000157`
3. Besitzerinnen und Standorte als eigene Tabellen
4. RFID-Tags zuordnen, Verkauf und Vermietung
