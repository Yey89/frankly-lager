# 0–100 Frankly · Lager

Web-App zum Erfassen und Verwalten der Frankly-Teile, Fotos und Looks.
Läuft im Browser auf Handy und PC, kann auf dem Homescreen abgelegt werden.

## Aufbau

| Teil | Wo | Wozu |
|---|---|---|
| Shop (öffentlich) | `index.html`, `shop.js`, `shop.css` | Stöbern, Looks, Owner-Profile, QR-Link `?teil=FR-000123`, Owner-werden-Formular |
| Lager (Team) | `lager.html`, `app.js`, `style.css` | Login; erfassen, Owner, Abrechnung, Anmeldungen |
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
- **owners** (`03_owner_phasen.sql`): Besitzerinnen, `OWN-001` = Frankly/eigene Teile (0 %). Profilfelder
  (profilname, stil, instagram, oeffentlich) vs. interne Felder (voller_name, email, telefon, provision_prozent).
- **vermietungen**: Mieten pro Teil, mit Provision zum Zeitpunkt der Miete und `ausbezahlt_am`.
- **preis_verlauf**: wird per Trigger bei jeder Preisänderung geschrieben.

## Geschäftslogik (Kommission)

- Phase = erster bis letzter Samstag eines Monats (`items.phase_monat` = 1. Tag des Monats).
- Verkauf/Miete: Owner erhält Betrag minus Provision (Standard 10 %), Auszahlung am letzten Samstag
  des Monats, in dem verkauft/vermietet wurde. Provision wird beim Verkauf in `verkauf_provision` eingefroren.
- Nach Phasenende entscheidet die Owner: Preis senken (nur tiefer, nächste Phase), Upcycling (Termin)
  oder Zurücknehmen (Abholung samstags). Status danach `Zurückgegeben`.

Fotopfade im Bucket `fotos`:
- `originale/FR-00000X_front.jpg`, `looks/LOOK-000X.jpg`: Starterpaket
- `items/<uuid>.jpg`, `looks-neu/<uuid>.jpg`: in der App hochgeladen (max. 1600 px, JPEG)

## Öffentlicher Zugriff (`04_shop_anmeldungen.sql`)

- anon liest Teile nur mit Status Verfügbar/Reserviert/Vermietet und nur freigegebene Spalten (Column Grants + RLS).
- anon liest Owner nur mit `oeffentlich = true` (Profilname, Stil, Instagram).
- anon darf in `anmeldungen` nur einfügen; Vermiet-Fotos landen im privaten Bucket `anmeldungen`.
- Ladeninfos (Adresse, Öffnungszeiten) und Stil-Kacheln stehen oben in `shop.js`; Kachel-Fotos im Ordner `stile/`.

## Sicherheit

- `config.js` enthält nur die Projekt-URL und den **publishable** Key. Beides ist für den Browser gedacht.
- Alle Tabellen haben Row Level Security: nur `authenticated` darf lesen/schreiben, `anon` nichts.
- Der **secret/service_role** Key und das Datenbank-Passwort gehören **nie** in dieses Repository.

## Nächste Ausbaustufen (Ideen)

1. Hintergrund entfernen (zweites Foto `foto_frei_pfad`, Original bleibt)
2. QR-Code / Hangtag-Druck pro Teil, Adresse z. B. `/i/FR-000157`
4. Owner-Bereich mit eigenem Login (nur eigene Teile, Preis senken, Termine)
5. RFID-Tags zuordnen
