/* =========================================================
   0–100 FRANKLY · Sprache DE / EN für Shop, Mein Frankly und Fotoecke
   (das Lager bleibt Deutsch).
   • Sprachknopf oben rechts. Die Wahl wird gemerkt.
   • Link mit ?lang=en öffnet direkt Englisch (z.B. QR-Codes auf
     englischen Flyern und Etiketten).
   • Übersetzt wird Text auf der Seite: feste Texte über das
     Wörterbuch EN, Texte mit Zahlen über die Regeln RX.
     Neue Texte: unten im Wörterbuch ergänzen (Deutsch → Englisch).
   • Daten wie Titel oder Beschreibungen der Teile bleiben, wie sie
     im Lager erfasst sind.
   Muss VOR den anderen Skripten geladen werden.
   ========================================================= */
(function () {
  "use strict";
  let L = null;
  try { const p = new URLSearchParams(location.search).get("lang"); if (p === "en" || p === "de") { L = p; localStorage.setItem("frankly-lang", p); } } catch (e) {}
  if (!L) { try { L = localStorage.getItem("frankly-lang"); } catch (e) {} }
  if (L !== "en") L = "de";
  window.FRANKLY_LANG = L;
  document.documentElement.lang = L;

  /* ---------- Wörterbuch: Deutsch → Englisch ---------- */
  const EN = {
    /* Navigation, allgemein */
    "Stöbern": "Browse", "Owner werden": "Become an owner", "Besuch": "Visit", "Hauptnavigation": "Main navigation",
    "Schliessen ✕": "Close ✕", "Zum Shop": "To the shop", "Fotoecke": "Photo corner", "Mein Frankly": "My Frankly",
    "Teil": "Piece", "Teile": "Pieces", "Nummer": "Number", "Danke!": "Thank you!", "Website": "Website",
    "Kleider aus echten Kleiderschränken, 0 bis 100 Franken. Ehrlich gesagt: nicht mehr und nicht weniger.": "Clothes from real closets, 0 to 100 francs. Frankly: nothing more, nothing less.",
    "Suchen: Jacke, Levi's, schwarz …": "Search: jacket, Levi's, black …", "Teile durchsuchen": "Search pieces",
    "Teile werden geladen …": "Loading pieces …", "Foto lädt …": "Photo loading …", "Foto folgt": "Photo coming soon",
    "Preis im Laden": "Price in the shop", "Gerade vermietet": "Currently rented", "Frankly-Teil": "Frankly piece",
    "Reserviert": "Reserved", "Auf Anfrage": "On request", "Versand durch Owner": "Shipped by owner", "Reduziert": "Reduced",
    "Im Laden:": "In the shop:", "Adresse": "Address", "In Karten öffnen": "Open in maps", "Öffnungszeiten": "Opening hours",
    "Josy · Zentrum für Kreislaufwirtschaft": "Josy · Centre for the circular economy",
    "Mi – Fr": "Wed – Fri", "Sa": "Sat", "So – Di": "Sun – Tue", "13.00 – 19.00 Uhr": "1 – 7 pm", "9.30 – 17.00 Uhr": "9.30 am – 5 pm", "geschlossen": "closed",
    "· Mi – Fr 13.00 – 19.00 Uhr · Sa 9.30 – 17.00 Uhr": "· Wed – Fri 1 – 7 pm · Sat 9.30 am – 5 pm",
    "Mi – Fr 13.00 – 19.00 Uhr": "Wed – Fri 1 – 7 pm", "Sa 9.30 – 17.00 Uhr": "Sat 9.30 am – 5 pm",
    "Gerade ist nichts online. Komm im Laden vorbei, wir hängen laufend neue Teile auf.": "Nothing is online right now. Come by the shop, we keep hanging up new pieces.",
    "In deiner Grösse ist gerade nichts dabei. Ändere die Grösse oben oder schau bald wieder vorbei.": "Nothing in your size right now. Change the size above or check back soon.",
    "Die Teile können gerade nicht geladen werden. Bitte versuch es später nochmals.": "The pieces cannot be loaded right now. Please try again later.",
    "Die Seite konnte nicht geladen werden. Bitte neu laden.": "The page could not be loaded. Please reload.",
    /* Kategorien und Fotoarten */
    "Alle": "All", "Oberteile": "Tops", "Tuniken": "Tunics", "Hosen": "Trousers", "Röcke": "Skirts", "Kleider": "Dresses", "Jacken": "Jackets",
    "Kimonos": "Kimonos", "Schuhe": "Shoes", "Taschen": "Bags", "Accessoires": "Accessories",
    "Weitere Fotos": "More photos", "Vorne": "Front", "Hinten": "Back", "Etikett": "Label", "Grösse": "Size", "Material & Pflege": "Material & care",
    "Mangel": "Flaw", "Vorher": "Before",
    /* Häufige Angaben bei Teilen */
    "Marke": "Brand", "Material": "Material", "Farben": "Colours", "Muster": "Pattern", "Schnitt": "Cut", "Zustand": "Condition", "Kategorie": "Category",
    "Sehr gut": "Very good", "Gut": "Good", "Neuwertig": "Like new", "Wie neu": "Like new", "Neu": "New", "Neu mit Etikett": "New with tags", "Getragen": "Worn",
    "Leichte Gebrauchsspuren": "Light signs of wear", "Gebrauchsspuren": "Signs of wear",
    "schwarz": "black", "weiss": "white", "grau": "grey", "blau": "blue", "rot": "red", "grün": "green", "gelb": "yellow", "braun": "brown", "beige": "beige", "rosa": "pink", "orange": "orange", "lila": "purple",
    "Schwarz": "Black", "Weiss": "White", "Grau": "Grey", "Blau": "Blue", "Rot": "Red", "Grün": "Green", "Gelb": "Yellow", "Braun": "Brown", "Rosa": "Pink", "Lila": "Purple",
    "Baumwolle": "Cotton", "Wolle": "Wool", "Seide": "Silk", "Leinen": "Linen", "Leder": "Leather", "Kunstleder": "Faux leather", "Viskose": "Viscose", "Polyester": "Polyester",
    "Uni": "Plain", "gestreift": "striped", "kariert": "checked", "geblümt": "floral", "Streifen": "Stripes", "Karo": "Check", "Blumen": "Floral",
    "Minirock": "Mini skirt", "Jogginghose": "Joggers", "Jeansjacke": "Denim jacket", "Anzugshosen": "Suit trousers", "Hoodie / Sweatjacke": "Hoodie / sweat jacket",
    "Hemdblusenkleid / Longshirt": "Shirt dress / long shirt", "Bluse": "Blouse", "Pullover": "Jumper", "Strickjacke": "Cardigan", "Mantel": "Coat", "Rock": "Skirt", "Kleid": "Dress",
    /* Grösse wählen */
    "Deine Grösse": "Your size", "Oberteile, Kleider, Jacken": "Tops, dresses, jackets", "Hosen & Röcke": "Trousers & skirts",
    "Wähl, was dir passt, gern auch zwei Grössen. Leer lassen heisst: alle Grössen. Unter jeder Grösse steht die passende EU-Grösse und Jeans-Weite.": "Choose what fits you, two sizes are fine too. Leave it empty for all sizes. Under each size you see the matching EU size and jeans waist.",
    "Teile zeigen": "Show pieces", "Alle Teile ansehen": "See all pieces", "Nur meine Grösse": "Only my size", "Alle Grössen zeigen": "Show all sizes", "Grösse ändern": "Change size",
    "Teile · alle Grössen": "pieces · all sizes", "Teil · alle Grössen": "piece · all sizes", "Teile · Oben": "pieces · Tops", "Teil · Oben": "piece · Tops",
    "· Unten": "· Bottoms", "· Schuhe": "· Shoes", "alle": "all",
    /* Looks und Fotoecke im Shop */
    "Vier Stile, viele Kombis. Tipp auf «Neu kombinieren» und lass dich überraschen, oder schau dir die Fotos aus der Fotoecke an.": "Four styles, many combinations. Tap “New combination” and let yourself be surprised, or look at the photos from the photo corner.",
    "↻ Neu kombinieren": "↻ New combination", "Looks von Frankly": "Looks by Frankly", "Aus der Fotoecke": "From the photo corner",
    "Bald zeigen wir hier, wie du unsere Teile kombinieren kannst.": "Soon we will show you here how to combine our pieces.",
    "Hier erscheinen bald Fotos von euch. Probier im Laden, mach dein Foto in der Fotoecke und teile es mit uns: Dafür gibt es einen Gutschein.": "Your photos will appear here soon. Try things on in the shop, take your photo in the photo corner and share it with us: you get a voucher for it.",
    "Look aus der Fotoecke": "Look from the photo corner", "Diese Teile trägt sie": "The pieces she is wearing", "Die Teile sind schon weg": "These pieces are already gone",
    "Stöbere nach ähnlichen Teilen in deiner Grösse.": "Browse similar pieces in your size.",
    "Probier im Laden, mach dein Foto und teile es mit uns. Dafür gibt es einen Gutschein.": "Try things on in the shop, take your photo and share it with us. You get a voucher for it.",
    "Zeigt eine Kombi aus diesen Teilen": "Shows a combination of these pieces", "Teile in diesem Look": "Pieces in this look",
    /* Teil-Ansicht */
    "Dieses Teil ist gerade nicht mehr im Laden. Vielleicht wurde es schon verkauft.": "This piece is no longer in the shop. Maybe it has already been sold.",
    "Weiter stöbern": "Keep browsing", "Frankly-Teil: Hier gilt dein Fotoecke-Gutschein.": "Frankly piece: your photo corner voucher applies here.",
    "Dieses Teil ist gerade vermietet und bald wieder im Laden.": "This piece is currently rented and will be back in the shop soon.",
    "Dieses Teil ist für jemanden reserviert.": "This piece is reserved for someone.",
    "Aus dem Kleiderschrank von": "From the closet of", "So kannst du es kombinieren": "How to style it", "Kombiniere mit": "Combine with",
    "So wurde es getragen": "How it was worn", "Anprobieren im Laden": "Try it on in the shop", "Link kopieren": "Copy link", "Link kopiert": "Link copied", "Kleiderschrank": "Closet",
    "Reservieren": "Reserve", "Jetzt reservieren": "Reserve now", "Wird reserviert …": "Reserving …", "Dein Name *": "Your name *", "E-Mail oder Telefon *": "Email or phone *",
    "Gefällt dir das Teil? Reserviere es und probier es im Laden an. Die Reservation gilt bis Ladenschluss des zweiten Öffnungstags.": "Like this piece? Reserve it and try it on in the shop. The reservation is valid until closing time on the second opening day.",
    "Bitte Name und E-Mail oder Telefon angeben.": "Please enter your name and email or phone.", "Keine Verbindung. Bitte nochmals versuchen.": "No connection. Please try again.",
    "Das hat nicht geklappt.": "That did not work.", "Das hat nicht geklappt. Bitte komm direkt im Laden vorbei.": "That did not work. Please come straight to the shop.",
    "Bitte deinen Namen angeben.": "Please enter your name.", "Bitte E-Mail oder Telefon angeben.": "Please enter your email or phone.",
    "Du hast schon 3 Teile reserviert. Mehr geht gleichzeitig leider nicht.": "You have already reserved 3 pieces. Unfortunately, that is the maximum at one time.",
    "Dieses Teil kann gerade nicht reserviert werden. Vielleicht war jemand schneller.": "This piece cannot be reserved right now. Maybe someone was faster.",
    "Dieses Teil ist nicht mehr bei uns im Laden, sondern zurück bei der Owner. Schick uns eine Anfrage: Wir prüfen, ob es noch erhältlich ist, und melden uns mit dem Preis inklusive Versand.": "This piece is no longer in our shop but back with its owner. Send us a request: we check whether it is still available and get back to you with the price including shipping.",
    "Dieses Teil hängt gerade nicht im Laden, sondern im Lager. Schreib uns, dann legen wir es für deinen Besuch bereit.": "This piece is not in the shop right now but in storage. Write to us and we will have it ready for your visit.",
    "Nachricht (freiwillig)": "Message (optional)", "Wann kommst du vorbei? (freiwillig)": "When will you come by? (optional)",
    "z.B. Lieferadresse in Zürich": "e.g. delivery address in Zurich", "z.B. Samstag Vormittag": "e.g. Saturday morning",
    "Verfügbarkeit anfragen": "Ask about availability", "Anprobe anfragen": "Request a fitting", "Wird gesendet …": "Sending …", "Danke! Wir melden uns bei dir.": "Thank you! We will get back to you.",
    /* Owner werden */
    "Dein Kleiderschrank ist zu voll? Bring bis zu 10 Teile zu uns. Wir kümmern uns zwei Monate im Laden darum, danach online oder als Upcycling. Du bekommst 90 % vom Verkaufspreis.": "Is your closet too full? Bring up to 10 pieces to us. We look after them for two months in the shop, then online or as upcycling. You get 90 % of the sale price.",
    "Anmelden.": "Sign up.", "Mit dem Formular unten. Wir schauen, welche Stile und Grössen in welchem Monat zusammenpassen, und melden uns per E-Mail.": "With the form below. We check which styles and sizes fit together in which month and reply by email.",
    "Bringen.": "Bring.", "Maximal 10 Teile, sauber und in gutem Zustand. Den Termin für die Abgabe bekommst du mit der Zusage.": "Up to 10 pieces, clean and in good condition. You get the drop-off date with your confirmation.",
    "Monat 1 an der Stange.": "Month 1 on the rail.", "Eine Runde läuft vom ersten bis zum letzten Samstag im Monat. Von jedem Verkauf gehen": "A round runs from the first to the last Saturday of the month. Of every sale,",
    "90 % an dich": "90 % goes to you", "und 10 % an Frankly. Ausbezahlt wird am Ende der Runde.": "and 10 % to Frankly. Payout is at the end of the round.",
    "Monat 2: Du entscheidest.": "Month 2: you decide.", "Preis senken (Reduziert-Stange), Frankly upcycelt es, oder du nimmst es zurück.": "Lower the price (reduced rail), Frankly upcycles it, or you take it back.",
    "Nach Monat 2.": "After month 2.", "Du holst dein Teil ab und verkaufst es online weiter (du verschickst es, wenn jemand es kauft). Oder Frankly upcycelt es.": "You pick up your piece and keep selling it online (you ship it when someone buys it). Or Frankly upcycles it.",
    "Upcycling durch Frankly.": "Upcycling by Frankly.", "Aus deinem Teil entsteht etwas Neues: ein neues Stück oder ein neuer Schnitt. Ideen von dir sind willkommen. Wird es verkauft, bekommst du": "Your piece becomes something new: a new piece or a new cut. Your ideas are welcome. If it sells, you get",
    ", 80 % gehen an Frankly für Arbeit und Material.": ", 80 % goes to Frankly for work and materials.",
    "Alles online.": "Everything online.", "Mit deinem persönlichen Link «Mein Frankly» siehst du jederzeit, wie es deinen Teilen geht, und entscheidest selbst.": "With your personal link “My Frankly” you can always see how your pieces are doing, and you decide yourself.",
    "Testlauf:": "Trial run:", "Die ersten drei Monate sind ein Probelauf. Reduziert-Stange, Upcycling und Online-Stange können sich danach noch ändern. Wer dabei ist, wird rechtzeitig informiert.": "The first three months are a trial run. The reduced rail, upcycling and the online rail may still change afterwards. Everyone taking part will be informed in good time.",
    "Auch zum Vermieten": "Also for renting out", "Abendkleider und Statement Pieces kannst du bei uns auch": "Evening dresses and statement pieces can also be",
    "vermieten": "rented out", ". Dafür brauchen wir Fotos. Wir prüfen jedes Teil und sagen dir": " through us. We need photos for this. We check every piece and give you a yes or no",
    "innerhalb von 24 Stunden": "within 24 hours.", "zu oder ab. Bei Mieten gehen": "For rentals,", "70 % an dich": "70 % goes to you",
    "und 30 % an Frankly, weil wir Prüfung, Übergabe und Kaution übernehmen. Die Mieterin lässt das Teil vor der Rückgabe reinigen und bringt die Quittung mit.": "and 30 % to Frankly, because we handle checking, handover and the deposit. The renter has the piece cleaned before returning it and brings the receipt.",
    "Über dich": "About you", "Vorname *": "First name *", "Nachname": "Last name", "E-Mail *": "Email *", "Telefon": "Phone", "Instagram (freiwillig)": "Instagram (optional)",
    "Was bringst du?": "What are you bringing?", "Wunschmonat": "Preferred month", "Anzahl Teile (max. 10)": "Number of pieces (max. 10)",
    "Was ist dabei?": "What is included?", "Mehrere möglich": "Several possible", "Grössen": "Sizes",
    "Gib die Grösse an, die für die": "Give the size that fits", "meisten": "most", "deiner Teile gilt. Wenn du zwischen zwei Grössen liegst, wähl beide, zum Beispiel S und M.": "of your pieces. If you are between two sizes, choose both, for example S and M.",
    "Schuhgrösse": "Shoe size", "nur wenn du Schuhe bringst": "only if you bring shoes", "Keine Schuhe": "No shoes", "Egal, sobald es passt": "Any month, whenever it fits",
    "Stil": "Style", "Welche Bilder passen am ehesten zu dem, was du bringst? Wähl höchstens zwei.": "Which pictures fit best with what you are bringing? Choose up to two.",
    "dunkel, kantig, Leder, Transparenz": "dark, edgy, leather, sheer", "laut, Muster, Farbe, Statement": "loud, patterns, colour, statement",
    "weich, floral, verspielt, fliessend": "soft, floral, playful, flowing", "sportlich, bequem, clean, Basics": "sporty, comfortable, clean, basics",
    "Vermieten": "Renting out", "Ich möchte auch Abendkleider oder Statement Pieces vermieten.": "I would also like to rent out evening dresses or statement pieces.",
    "Fotos *": "Photos *", "eines pro Teil, mehrere möglich": "one per piece, several possible", "Fotos wählen": "Choose photos", "Foto entfernen": "Remove photo",
    "Kurz beschreiben (freiwillig)": "Short description (optional)", "z.B. schwarzes Abendkleid, Grösse 36, einmal getragen": "e.g. black evening dress, size 36, worn once",
    "Wir prüfen deine Teile und melden uns innerhalb von 24 Stunden mit einer Zu- oder Absage.": "We check your pieces and give you a yes or no within 24 hours.",
    "Noch etwas?": "Anything else?",
    "Ich habe die Bedingungen oben gelesen und bin einverstanden. Meine Angaben werden nur für die Organisation von 0–100 Frankly verwendet. *": "I have read and agree to the terms above. My details are only used to organise 0–100 Frankly. *",
    "Anmeldung senden": "Send sign-up", "Deine Anmeldung ist bei uns. Wir melden uns per E-Mail.": "We have received your sign-up. We will reply by email.",
    "Deine Anmeldung ist bei uns. Deine Vermiet-Teile prüfen wir und melden uns innerhalb von 24 Stunden per E-Mail.": "We have received your sign-up. We will check your rental pieces and reply by email within 24 hours.",
    "Deine Anmeldung ist bei uns. Wir melden uns per E-Mail, sobald wir den Monat planen.": "We have received your sign-up. We will reply by email as soon as we plan the month.",
    "Vorname": "first name", "gültige E-Mail": "valid email", "mindestens ein Stil-Bild": "at least one style picture",
    "Fotos der Teile zum Vermieten": "photos of the pieces to rent out", "Zustimmung zu den Bedingungen": "agreement to the terms",
    "Keine Verbindung. Prüfe das Internet und versuch es nochmals.": "No connection. Check your internet and try again.",
    "Höchstens zwei Grössen, z.B. S und M.": "Two sizes at most, e.g. S and M.", "Höchstens zwei Stile.": "Two styles at most.",
    "Ein Foto konnte nicht verarbeitet werden.": "A photo could not be processed.", "Ein Foto konnte nicht gelesen werden. Bitte JPG oder PNG wählen.": "A photo could not be read. Please choose JPG or PNG.",
    /* Fotoecke (foto.html) */
    "Teile deinen Look · 0–100 Frankly": "Share your look · 0–100 Frankly", "Teile deinen Look": "Share your look",
    "Lade dein Foto aus der Fotoecke hoch. Als Dankeschön bekommst du einen": "Upload your photo from the photo corner. As a thank-you you get a",
    "Gutschein über CHF 5": "CHF 5 voucher", "Foto wählen oder aufnehmen": "Choose or take a photo", "Dein Foto": "Your photo",
    "Dein Vorname (freiwillig)": "Your first name (optional)", "Welche Teile von Frankly trägst du?": "Which Frankly pieces are you wearing?", "Antippen, freiwillig": "Tap, optional",
    "Suchen: Jacke, schwarz, FR-000123 …": "Search: jacket, black, FR-000123 …", "Teile suchen": "Search pieces", "Nichts gefunden.": "Nothing found.",
    "Dein Gedanke zu diesem Look (freiwillig)": "Your thought on this look (optional)",
    "z.B. Heute fühle ich mich mutig. Diese Farbe hätte ich früher nie getragen.": "e.g. Today I feel bold. I would never have worn this colour before.",
    "Deine E-Mail für den Gutschein (freiwillig)": "Your email for the voucher (optional)", "Wir schicken dir den Code auch per E-Mail": "We will also send you the code by email",
    "Frankly darf das Foto intern anschauen und auswerten (welche Teile zusammen getragen werden). *": "Frankly may look at and analyse the photo internally (which pieces are worn together). *",
    "Frankly darf das Foto auch auf Instagram und der Website zeigen, mit meinem Vornamen oder Instagram-Namen und meinem Gedanken, falls angegeben.": "Frankly may also show the photo on Instagram and the website, with my first name or Instagram name and my thought, if given.",
    "Sind andere Personen auf dem Foto, frag sie bitte vorher. Du kannst deine Zustimmung jederzeit im Laden zurückziehen.": "If other people are in the photo, please ask them first. You can withdraw your consent in the shop at any time.",
    "Foto senden": "Send photo", "Dein Foto ist bei uns. Zeig diesen Code an der Kasse:": "We have your photo. Show this code at the checkout:",
    "CHF 5 auf alle Teile mit dem Etikett «Frankly-Teil». Ein Gutschein pro Besuch, nicht bar auszahlbar. Mach am besten einen Screenshot.": "CHF 5 on all pieces with the “Frankly piece” label. One voucher per visit, not redeemable for cash. Best take a screenshot.",
    "Noch ein Foto senden": "Send another photo", "Bitte zuerst ein Foto wählen.": "Please choose a photo first.",
    "Bitte bestätige, dass Frankly das Foto intern anschauen darf.": "Please confirm that Frankly may look at the photo internally.",
    "Das Foto konnte nicht verarbeitet werden.": "The photo could not be processed.", "Das Foto konnte nicht gelesen werden. Bitte JPG oder PNG wählen.": "The photo could not be read. Please choose JPG or PNG.",
    "Teile konnten nicht geladen werden.": "Pieces could not be loaded.",
    /* Mein Frankly (owner.html) */
    "Mein Frankly · 0–100 Frankly": "My Frankly · 0–100 Frankly", "Deine Teile werden geladen …": "Loading your pieces …",
    "Verdient bisher": "Earned so far", "Ausbezahlt": "Paid out", "Kommt noch": "Still to come", "Jetzt entscheiden": "Decide now",
    "Deine Teile im Laden": "Your pieces in the shop", "Gerade sind keine Teile von dir im Laden.": "None of your pieces are in the shop right now.", "Abgeschlossen": "Completed",
    "So läuft es": "How it works", "Monat 1:": "Month 1:", "Dein Teil hängt zu deinem Preis an der Stange. Eine Runde geht vom ersten bis zum letzten Samstag im Monat.": "Your piece hangs on the rail at your price. A round runs from the first to the last Saturday of the month.",
    "Monat 2:": "Month 2:", "Ist es nicht verkauft, wählst du: Preis senken (Reduziert-Stange), Frankly upcycelt es, oder du nimmst es zurück.": "If it has not sold, you choose: lower the price (reduced rail), Frankly upcycles it, or you take it back.",
    "Nach Monat 2:": "After month 2:", "Du holst es ab und verkaufst es auf der": "You pick it up and keep selling it on the", "Online-Stange": "online rail",
    "weiter (du verschickst es, wenn jemand es kauft), oder Frankly upcycelt es. Zurücknehmen oder spenden geht auch.": "(you ship it when someone buys it), or Frankly upcycles it. Taking it back or donating is also possible.",
    "Upcycling:": "Upcycling:", "Frankly macht aus deinem Teil etwas Neues. Wird es verkauft, bekommst du 20 %.": "Frankly turns your piece into something new. If it sells, you get 20 %.",
    "Die ersten drei Monate sind ein Probelauf. Reduziert-Stange, Upcycling und Online-Stange können sich danach noch ändern. Wir informieren dich rechtzeitig.": "The first three months are a trial run. The reduced rail, upcycling and the online rail may still change afterwards. We will let you know in good time.",
    "Wie geht es weiter?": "What happens next?", "Preis senken": "Lower the price", "Frankly upcycelt es (du bekommst 20 %)": "Frankly upcycles it (you get 20 %)",
    "Zurücknehmen": "Take it back", "Abholen und online weiterverkaufen": "Pick up and keep selling online", "Spenden": "Donate", "Ins Lager": "Into storage",
    "Neuer Preis CHF": "New price CHF", "Hast du eine Idee? (freiwillig)": "Do you have an idea? (optional)", "z.B. als Crop-Top, Ärmel ab, als Tasche …": "e.g. as a crop top, sleeves off, as a bag …",
    "Du holst dein Teil an einem Samstag im Laden ab.": "You pick up your piece in the shop on a Saturday.", "Abholung am": "Pick-up on",
    "Wir geben dein Teil an eine gemeinnützige Stelle in Zürich weiter. Das kannst du danach nicht mehr ändern.": "We pass your piece on to a charity in Zurich. You cannot change this afterwards.",
    "Ja, spenden": "Yes, donate", "Entscheid speichern": "Save decision", "Wird gespeichert …": "Saving …", "Bitte einen neuen Preis eingeben.": "Please enter a new price.",
    "Bitte bestätige, dass du das Teil separat aufbewahrst und verschickst.": "Please confirm that you will keep the piece separately and ship it.",
    "Neuer Preis gespeichert": "New price saved", "Entscheid gespeichert. Danke!": "Decision saved. Thank you!", "Nicht mehr verfügbar": "No longer available",
    "Sicher? Nochmals tippen": "Sure? Tap again", "Danke, das Teil ist jetzt nicht mehr online.": "Thank you, the piece is no longer online.", "kein Foto": "no photo",
    "Wird gerade erfasst": "Being added right now", "Zurück bei dir": "Back with you", "Gespendet. Danke!": "Donated. Thank you!", "Wird gespendet": "Will be donated",
    "An der Stange": "On the rail", "An der Reduziert-Stange": "On the reduced rail", "Im Laden": "In the shop", "Im Lager · online auf Anfrage": "In storage · online on request",
    "Online-Stange · bei dir zu Hause": "Online rail · at your home",
    "Von Frankly upgecycelt, an der Upcycling-Stange. Wird es verkauft, bekommst du 20 %": "Upcycled by Frankly, on the upcycling rail. If it sells, you get 20 %",
    "Runde vorbei: Bitte entscheide, wie es weitergeht.": "Round over: please decide what happens next.",
    "Öffne diese Seite mit deinem persönlichen Link.": "Open this page with your personal link.", "Dieser Link ist nicht mehr gültig.": "This link is no longer valid.", "Dieser Link ist nicht gültig.": "This link is not valid.",
    "Den persönlichen Link bekommst du von Frankly per E-Mail. Hast du ihn verloren? Frag im Laden nach einem neuen.": "You get your personal link from Frankly by email. Lost it? Ask for a new one in the shop.",
    "Du kannst ab dem Ende der Runde entscheiden.": "You can decide once the round has ended.", "Diese Wahl ist für dieses Teil nicht möglich.": "This choice is not possible for this piece.",
    "Bitte einen Samstag für die Abholung wählen.": "Please choose a Saturday for the pick-up.", "Für dieses Teil ist gerade kein Entscheid möglich.": "No decision is possible for this piece right now.",
    "Für dieses Teil ist schon entschieden. Melde dich bei Frankly, wenn du es ändern möchtest.": "A decision has already been made for this piece. Contact Frankly if you would like to change it.",
    "Der neue Preis muss tiefer sein als der bisherige.": "The new price must be lower than the old one.",
    "Bitte einen neuen Preis eingeben": "Please enter a new price",
    "· Josy, Neue Hard 10, 8005 Zürich · Mi–Fr 13–19, Sa 9.30–17 Uhr": "· Josy, Neue Hard 10, 8005 Zurich · Wed–Fri 1–7 pm, Sat 9.30 am–5 pm",
    "Josy, Neue Hard 10, 8005 Zürich · Mi–Fr 13–19, Sa 9.30–17 Uhr": "Josy, Neue Hard 10, 8005 Zurich · Wed–Fri 1–7 pm, Sat 9.30 am–5 pm"
  };
  /* Texte mit Platzhaltern (für t() in den Skripten) */
  Object.assign(EN, {
    "Vermietet bis {d}": "Rented until {d}",
    "Dieses Teil ist bis {d} vermietet und danach wieder im Laden.": "This piece is rented until {d} and back in the shop afterwards.",
    "Dieses Teil ist bis {d} reserviert. Danach ist es vielleicht wieder frei.": "This piece is reserved until {d}. After that it may be available again.",
    "Reserviert bis <b>{d}</b>. Komm vorbei: {a}. Sag an der Kasse deinen Namen und die Nummer <b>{nr}</b>.": "Reserved until <b>{d}</b>. Come by: {a}. Give your name and the number <b>{nr}</b> at the checkout.",
    "Upcycled by Frankly: Aus einem Secondhand-Teil neu gemacht, ein Einzelstück.": "Upcycled by Frankly: made new from a second-hand piece, a one-off.",
    "Unter «Vorher» siehst du das Original.": "Under “Before” you can see the original.", "Die ursprüngliche Owner bekommt einen Teil vom Preis.": "The original owner gets part of the price.",
    "Bitte noch ergänzen: {x}.": "Please add: {x}.", "Foto {i} von {n} wird hochgeladen …": "Uploading photo {i} of {n} …", "Das hat nicht geklappt: {m}": "That did not work: {m}",
    "Ausgewählt: {x}": "Selected: {x}", "Hallo {name}": "Hello {name}",
    "Hier siehst du jederzeit, wie es deinen Teilen geht. Von jedem Verkauf bekommst du {s} %, von jeder Miete 70 %, von deinen upgecycelten Teilen 20 %.": "Here you can always see how your pieces are doing. You get {s} % of every sale, 70 % of every rental and 20 % of your upcycled pieces.",
    "Auszahlung am {d}": "Payout on {d}", "ausbezahlt am {d}": "paid out on {d}", "{s} ab {d}": "{s} from {d}", "{s} bis {d}": "{s} until {d}",
    "<b>Verkauft</b>{am} für {b} · dein Anteil <b>{a}</b> · {pay}": "<b>Sold</b>{am} for {b} · your share <b>{a}</b> · {pay}", " am {d}": " on {d}",
    "<b>Vermietet</b>{bis}": "<b>Rented</b>{bis}", " bis {d}": " until {d}", "<b>Reserviert</b> für eine Kundin": "<b>Reserved</b> for a customer",
    "<b>Abholung</b> am {d}, danach auf der Online-Stange": "<b>Pick-up</b> on {d}, then on the online rail", "<b>Abholung</b> am {d} im Laden": "<b>Pick-up</b> on {d} in the shop",
    "<b>Online-Stange:</b> Das Teil ist bei dir. Bitte bewahre es separat auf. Wird es gekauft, melden wir uns, und du verschickst es innert 3 Tagen.": "<b>Online rail:</b> the piece is with you. Please keep it separately. If it is bought, we will contact you and you ship it within 3 days.",
    "<b>Bei Frankly zum Upcyceln.</b> Daraus entsteht etwas Neues. Wird es verkauft, bekommst du 20 %.": "<b>With Frankly for upcycling.</b> It will become something new. If it sells, you get 20 %.",
    " Deine Idee: «{i}»": " Your idea: “{i}”",
    "Dein Teil hängt in {r} an der Reduziert-Stange. Bisher {p}.": "Your piece hangs on the reduced rail in {r}. Previously {p}.",
    "Du gibst dein Teil an Frankly. Yesim macht daraus etwas Neues: ein ganz neues Stück, oder sie verändert es, z.B. kürzen oder einen anderen Schnitt. Das neue Teil hängt dann an der Upcycling-Stange. Wird es verkauft, bekommst du 20 % vom Preis, 80 % gehen an Frankly für Arbeit und Material.": "You give your piece to Frankly. Yesim turns it into something new: a completely new piece, or she changes it, e.g. shortening it or a different cut. The new piece then hangs on the upcycling rail. If it sells, you get 20 % of the price, 80 % goes to Frankly for work and materials.",
    "Du holst dein Teil an einem Samstag ab. Es bleibt aber im Online-Shop mit dem Hinweis «Versand durch Owner». Kaufanfragen kommen zu Frankly. Wir melden uns bei dir, du verschickst das Teil, und du bekommst 90 % wie bisher.": "You pick up your piece on a Saturday. But it stays in the online shop marked “Shipped by owner”. Purchase requests come to Frankly. We contact you, you ship the piece, and you get 90 % as before.",
    "Ich bewahre das Teil separat auf (nicht im eigenen Kleiderschrank), verschicke es innert 3 Tagen, wenn es gekauft wird, und melde hier, wenn ich es nicht mehr habe.": "I will keep the piece separately (not in my own closet), ship it within 3 days if it is bought, and report here if I no longer have it.",
    "Dein Teil kommt für {r} ins Lager. Im Online-Shop bleibt es sichtbar mit «Auf Anfrage». Wer es anprobieren möchte, meldet sich bei uns.": "Your piece goes into storage for {r}. It stays visible in the online shop marked “On request”. Anyone who wants to try it on contacts us.",
    "Der neue Preis muss tiefer sein als {p}.": "The new price must be lower than {p}.", "{n} Teile": "{n} pieces", "{n} Teil": "{n} piece", "die nächste Runde": "the next round",
    "z.B. {p}": "e.g. {p}", "Gr.": "Size"
  });

  /* ---------- Regeln für Texte mit Zahlen, Daten, Monaten ---------- */
  const MON = { Januar: "January", Februar: "February", "März": "March", April: "April", Mai: "May", Juni: "June", Juli: "July", August: "August", September: "September", Oktober: "October", November: "November", Dezember: "December" };
  const WDE = { So: "Sun", Mo: "Mon", Di: "Tue", Mi: "Wed", Do: "Thu", Fr: "Fri", Sa: "Sat" };
  const hour = (h, m) => { h = Number(h); const ap = h >= 12 ? "pm" : "am", hh = h % 12 || 12; return hh + (m ? "." + m : "") + " " + ap; };
  const RX = [
    [/^Vermietet bis (\d\d\.\d\d\.)$/, (m, d) => "Rented until " + d],
    [/^(So|Mo|Di|Mi|Do|Fr|Sa) (\d\d\.\d\d\.)(\d{4})?, (\d{1,2})(?:\.(\d\d))? Uhr$/, (m, w, d, y, h, mi) => `${WDE[w]} ${d}${y || ""}, ${hour(h, mi)}`],
    [/^(So|Mo|Di|Mi|Do|Fr|Sa) (\d\d\.\d\d\.)(\d{4})?$/, (m, w, d, y) => `${WDE[w]} ${d}${y || ""}`],
    [/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)( \d{4})?( \(.*\))?$/, (m, mo, y, rest) => MON[mo] + (y || "") + (rest || "").replace(/ bis /, " to ").replace(/\b(So|Mo|Di|Mi|Do|Fr|Sa)\b/g, w => WDE[w])],
    [/^Gr\. (.+)$/, (m, s) => "Size " + s],
    [/^· Gr\. (.+)$/, (m, s) => "· Size " + s],
    [/^\+ (\d+) weitere$/, (m, n) => `+ ${n} more`],
    [/^(\d+) (Teile?) im Laden$/, (m, n, w) => `${n} ${w === "Teil" ? "piece" : "pieces"} in the shop`],
    [/^@(\S+) auf Instagram$/, (m, ig) => `@${ig} on Instagram`],
    [/^(\d+) (Teile?)$/, (m, n, w) => `${n} ${w === "Teil" ? "piece" : "pieces"}`],
    [/^(.+) (Teile?) gewählt\.$/, null]
  ].filter(r => r[1]);

  function fill(s, v) { return v ? s.replace(/\{(\w+)\}/g, (m, k) => (v[k] == null ? "" : v[k])) : s; }
  function trCore(core) {
    if (Object.prototype.hasOwnProperty.call(EN, core)) return EN[core];
    for (const [re, f] of RX) { const m = core.match(re); if (m) return f(...m); }
    return null;
  }
  function tr(s) {
    if (s == null) return s;
    const str = String(s), core = str.trim(); if (!core) return str;
    const out = trCore(core); if (out == null) return str;
    return str.slice(0, str.indexOf(core)) + out + str.slice(str.indexOf(core) + core.length);
  }
  /* t("Text mit {x}", {x: wert}): übersetzt Satz und Werte (z.B. Daten) */
  window.t = function (s, v) {
    if (L !== "en") return fill(s, v);
    const vv = v ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "string" ? tr(x) : x])) : v;
    const base = Object.prototype.hasOwnProperty.call(EN, s) ? EN[s] : s;
    return fill(base, vv);
  };

  /* ---------- Seite übersetzen (auch was Skripte später einfügen) ---------- */
  const ATTRS = ["placeholder", "aria-label", "alt", "title"];
  function skip(el) { return el.closest && el.closest("script,style,[data-notr]"); }
  function walk(n) {
    if (n.nodeType === 3) { if (n.parentNode && skip(n.parentNode)) return; const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; return; }
    if (n.nodeType !== 1 || skip(n)) return;
    ATTRS.forEach(a => { if (n.hasAttribute(a)) { const o = n.getAttribute(a), v = tr(o); if (v !== o) n.setAttribute(a, v); } });
    for (let c = n.firstChild; c; c = c.nextSibling) walk(c);
  }
  function addButton() {
    const css = document.createElement("style");
    css.textContent = ".langbtn{font:600 12px/1 var(--mono,monospace);letter-spacing:.06em;border:1.5px solid currentColor;background:transparent;color:inherit;padding:6px 8px;cursor:pointer;margin-left:12px;white-space:nowrap}.langbtn b{color:var(--red,#E10600)}.stop-in{align-items:center}";
    document.head.appendChild(css);
    const host = document.querySelector(".stop-in"); if (!host) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "langbtn"; b.setAttribute("data-notr", "");
    b.setAttribute("aria-label", L === "en" ? "Auf Deutsch wechseln" : "Switch to English");
    b.innerHTML = L === "en" ? "DE | <b>EN</b>" : "<b>DE</b> | EN";
    b.addEventListener("click", () => {
      const nl = L === "en" ? "de" : "en";
      try { localStorage.setItem("frankly-lang", nl); } catch (e) {}
      const u = new URL(location.href); u.searchParams.set("lang", nl); location.href = u.toString();
    });
    host.appendChild(b);
  }
  function start() {
    addButton();
    if (L !== "en") return;
    document.title = tr(document.title);
    walk(document.body);
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === "characterData") { if (!skip(m.target.parentNode || document.body)) { const v = tr(m.target.nodeValue); if (v !== m.target.nodeValue) m.target.nodeValue = v; } }
      else if (m.type === "attributes") { const o = m.target.getAttribute(m.attributeName), v = tr(o); if (o != null && v !== o && !skip(m.target)) m.target.setAttribute(m.attributeName, v); }
      else m.addedNodes.forEach(walk);
    })).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
