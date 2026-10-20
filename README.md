# 0–100 Frankly · Lager

Web-App zum Erfassen und Verwalten der Frankly-Teile, Fotos und Looks.
Läuft im Browser auf Handy und PC, kann auf dem Homescreen abgelegt werden.

## Aufbau

| Teil | Wo | Wozu |
|---|---|---|
| Shop (öffentlich) | `index.html`, `shop.js`, `shop.css` | Stöbern, Looks, Owner-Profile, QR-Link `?teil=FR-000123`, Owner-werden-Formular |
| Lager (Team) | `lager.html`, `app.js`, `style.css` | Login; erfassen, Owner, Abrechnung, Anmeldungen, Anfragen |
| Fotoecke (öffentlich) | `foto.html`, `foto.js` | QR-Code am Stativ: Foto hochladen, Zustimmung, Gutschein-Code |
| Mein Frankly (Owner) | `owner.html`, `owner.js`, `owner.css` | Persönlicher Link `owner.html?k=<code>`: eigene Teile, Guthaben, Entscheid nach jeder Runde |
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

## Owner-Bereich und 3 Monate (`06_owner_bereich.sql`)

- `items.stufe`: Stange (Monat 1) → Reduziert oder Upcycling (Monat 2) → Lager (Monat 3, im Shop «Auf Anfrage»).
- Nach Ende einer Runde entscheidet die Owner online (oder das Team im Lager):
  Stange: Preis senken · Upcycling · Zurücknehmen; Monat 2: Lager · Zurücknehmen · Spenden; Lager: Zurücknehmen · Spenden.
- Zugang ohne Passwort über `owners.zugang_token` (zufälliger Code). Die Seite ruft nur die Funktionen
  `owner_portal` und `owner_entscheid` auf; diese prüfen den Code und geben nur die eigenen Teile heraus.
  Neuer Link im Lager: «Neuen Link erstellen», der alte gilt dann nicht mehr.
- `anfragen`: Kundinnen fragen Teile im Lager an (nur einfügen). Das Team sieht sie im Teil und im Filter «Anfrage offen».

## Grössen (`sizes.js`) und Vorschaubilder (`07_vorschaubilder_miete.sql`)

- `sizes.js` rechnet die Etikett-Grösse in eine Shop-Grösse um (XXS–3XL, Schuhe als Zahl):
  Buchstaben im Feld gelten immer; sonst EU (38 = M) bzw. Jeans-Weite (W28 = M). Taschen/Accessoires passen immer.
- Der Shop fragt zuerst nach der Grösse (gespeichert im Browser) und zeigt nur passende Teile.
- Jedes Foto bekommt ein Vorschaubild `thumbs/<Pfad>` (600 px). Karten laden nur Vorschaubilder,
  die Detailansicht das Original. Für alte Fotos im Lager unten «Vorschaubilder erstellen» tippen.
- Vermietung: Owner 70 %, Frankly 30 % (`RENT_PROV` in `app.js`).

## Erkenntnisse (`insights.js`, `08_erkenntnisse.sql`)

- Tab «Erkenntnisse» im Lager: Kurzfazit, Verkaufsquote und Tage bis Verkauf nach Kategorie, Grösse, Preis,
  Farbe, Material, Marke; Abgabegründe der Owner; Lieblingsteile-Karten; Studien; CSV-Export.
- Neue Felder pro Teil: `getragen`, `abgabe_grund`. Neue Tabelle `lieblingsteile` (nur Team).

## Kombis und Online-Stange (`09_kombis_online.sql`)

- `kombis`: Paare von Teilen (beidseitig), im Lager unter «Passt zu» verknüpft, im Shop als «Kombiniere mit».
- Stufe `Online`: Owner holt ab, Teil bleibt im Shop mit «Versand durch Owner». Anfragen gehen an Frankly.
  Owner wählt das in «Mein Frankly» ab Monat 2 und meldet dort «Nicht mehr verfügbar» (`owner_online_ende`).

## Zusatzfotos und Fotoecke (`10_fotos_fotoecke.sql`)

- `items.fotos_extra`: bis 5 weitere Fotos pro Teil (Hinten, Etikett, Detail, Mangel), im Shop als Galerie.
- `fotoecke` + privater Bucket `fotoecke`: anon darf nur hochladen und einfügen. Gutschein-Code `FOTO-XXXXX`
  (CHF 5, nur eigene Teile/Services). Lager-Tab «Fotoecke»: freigeben, ablehnen, Gutschein einlösen.

## Sicherheit

- `config.js` enthält nur die Projekt-URL und den **publishable** Key. Beides ist für den Browser gedacht.
- Alle Tabellen haben Row Level Security: nur `authenticated` darf lesen/schreiben, `anon` nichts.
- Der **secret/service_role** Key und das Datenbank-Passwort gehören **nie** in dieses Repository.

## Nächste Ausbaustufen (Ideen)

1. Hintergrund entfernen (zweites Foto `foto_frei_pfad`, Original bleibt)
2. QR-Code / Hangtag-Druck pro Teil, Adresse z. B. `/i/FR-000157`
5. RFID-Tags zuordnen

## Update 11: Looks aus verknüpften Teilen
- Im Lager: Teil öffnen → «Zu Look hinzufügen» (neuer Look oder bestehende Nummer). Ein Teil kann in mehreren Looks sein.
- Im Look: Name und Stil ändern, Teile hinzufügen oder entfernen.
- Shop «Looks»: oben «Looks von Frankly» (ab 2 Teilen), unten «Aus der Fotoecke».
- SQL: supabase/13_looks_neu.sql (löscht die alten Start-Looks, macht aus alten Verknüpfungen Looks, nummeriert ab LOOK-0001).

## Update 12: Outfit-Bild für Looks
- Looks zeigen ein Outfit-Bild aus den Teilen (outfit.js, outfit.css): Jacke, Oberteil, Hose/Rock oder Kleid, Schuhe, Tasche.
- «Neu kombinieren» würfelt eine andere Kombi aus den Teilen des Looks. Im Lager: «Diese Kombi als neuen Look speichern».
- «Teile freistellen» entfernt den Hintergrund im Browser (gratis, @imgly/background-removal, AGPL). Gespeichert unter cut/<id>.webp.
- SQL: supabase/14_outfit.sql
