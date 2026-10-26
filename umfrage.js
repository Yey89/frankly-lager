/* =========================================================
   0–100 FRANKLY · UMFRAGE
   Ablauf: Intro → 10 Fragen → leerer Kleiderschrank (Swipe)
           → Was fehlt dir? → Kaufwunsch (Anfrage) → Gutschein
   Ohne Login. Liest Stücke über umfrage_liste(), schickt die
   Antwort über umfrage_senden() (supabase/22_umfrage.sql).
   ========================================================= */
"use strict";

/* ---------- Einstellungen: hier anpassen ---------- */
const KAUF_AKTIV = true;          // false = keine Kaufanfragen am Schluss (z.B. bis die Owner zugestimmt haben)
const MIN_SWIPES = 10;            // ab so vielen Teilen darf man vorzeitig aufhören
const GUTSCHEIN_CHF = 5;          // Gutschein für alle, nur auf Frankly-Teile
const PREISE = ["0–20", "20–40", "40–60", "60–80", "80–100"];

const CFG = window.FRANKLY_CONFIG;
const LANG = window.FRANKLY_LANG === "en" ? "en" : "de";
const $ = id => document.getElementById(id);
const app = $("app");
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------- Texte DE / EN ---------- */
const T = {
  de: {
    tag: "Umfrage",
    kick: "Wir ziehen um",
    h1: "Dein Kleiderschrank.<br><span>Von 0 auf.</span>",
    lead: "Drei Wochen lang hatten wir unseren Secondhand-Pop-up. Jetzt ziehen wir um und machen weiter. Damit wir das Sortiment genau für dich vorbereiten können und du am meisten davon hast, machen wir diese kleine Umfrage.",
    winH: "Dein Win",
    win: [`<b>CHF ${GUTSCHEIN_CHF} Gutschein</b> auf alle Frankly-Teile, direkt am Schluss.`, "<b>Verlosung:</b> 1 Jahr Mitgliedschaft «Frankly Friends» (Wert CHF 120).", "Ein Sortiment, das zu dir passt."],
    how: [["1", "10 kurze Fragen zu dir und deinem Stil."], ["2", "Swipe dich durch unsere Teile: rechts = will ich, links = nein danke."], ["3", "Rework: Wie sollen alte Teile neu aussehen?"], ["4", "Am Schluss: Was fehlt dir noch?"]],
    dauer: "Dauer: ca. 6 Minuten. Du kannst jederzeit aufhören.",
    rwKick: "Frankly Rework",
    rwH: "Aus alt wird <span>neu.</span>",
    rwP: "Teile, die keiner mehr will, gestalten wir neu: kürzen, färben, kombinieren, verzieren. Jedes Stück bleibt ein Unikat. Was würdest du davon tragen?",
    rwSwipe: "Zuerst ein paar Ideen zum Swipen, danach 3 kurze Fragen.",
    rwGo: "Rework-Ideen ansehen", rwFragenGo: "Weiter",
    rwPopH: "Gefällt dir!",
    rwPopTragen: "Wie würdest du es tragen?",
    rwTragen: { Alltag: "Im Alltag", Twist: "Mit Twist, aber tragbar", Statement: "Als Statement-Teil" },
    rwPopPreis: "Was würdest du dafür zahlen? (CHF)",
    rwQ: [
      ["rework_mut", "single", "Wie mutig darf ein umgestaltetes Teil sein?"],
      ["rework_art", "multi", "Welche Umgestaltung würdest du tragen?"],
      ["rework_mehr", "single", "Wie viel mehr würdest du für ein umgestaltetes Teil bezahlen als für das Original?"]
    ],
    rwFragenH: "3 Fragen zu Rework",
    rwMehrfach: "Mehrere Antworten möglich.",
    start: "Los geht's", weiter: "Weiter", zurueck: "Zurück", skip: "Überspringen",
    frage: "Frage {n} von {m}", anderes: "Anderes (optional)", oben: "Oben", unten: "Unten", waehlen: "wählen",
    bis2: "Wähle bis zu 2.",
    swH: "Stell dir vor: <span>Dein Kleiderschrank ist leer.</span>",
    swP: "Alle deine Kleider sind weg. Du füllst deinen Schrank von 0 auf neu. Was nimmst du von unseren Teilen?",
    swHow: "Rechts wischen = will ich. Links wischen = nein danke. Oder die Knöpfe nutzen.",
    swNote: "Basics und alles, was hier fehlt, kannst du am Schluss noch ergänzen.",
    swGo: "Kleiderschrank füllen",
    nein: "← Nein danke", ja: "Will ich →", stampJa: "Will ich", stampNein: "Nein",
    genug: "Ich habe genug gesehen", undo: "↶ Rückgängig", von: "{n} von {m}",
    leer: "Gerade sind keine Teile da. Du kannst trotzdem weitermachen.",
    ladeFehler: "Die Teile können gerade nicht geladen werden. Du kannst trotzdem weitermachen.",
    laden: "Teile werden geladen …",
    popH: "Gute Wahl!",
    popPreis: "Was wäre ein fairer Preis dafür? (CHF)",
    popPreisNote: "Ehrlich: Preis und Leistung sollen stimmen.",
    popAnlass: "Wann würdest du es tragen?",
    anlass: { Alltag: "Im Alltag", Anlass: "Für besondere Anlässe", Mieten: "Würde ich lieber mieten" },
    popOk: "Speichern und weiter",
    fehltH: "Was fehlt dir noch?",
    fehltP: "Dein Schrank ist jetzt neu gefüllt. Was fehlt dir noch, und warum? Zum Beispiel Basics, ein bestimmter Schnitt oder ein Teil, das du nie findest.",
    fehltPh: "z.B. eine gut sitzende schwarze Hose, weil …",
    kaufH: "Möchtest du etwas wirklich kaufen?",
    kaufP: "Kreuz an, was du gerne hättest. Das ist noch <b>kein Kauf</b>: Du schickst eine unverbindliche Anfrage. Wir fragen die Besitzerin und bringen euch zusammen. Den Rest macht ihr direkt untereinander.",
    keineLikes: "Du hast noch kein Teil nach rechts gewischt.",
    name: "Dein Name", kontakt: "E-Mail oder Handynummer",
    kontaktNote: "Nur für Frankly. Wir geben deine Angaben nur an die Besitzerin weiter, wenn du ein Teil anfragst.",
    verlosung: "Ich mache bei der Verlosung mit (1 Jahr Frankly Friends).",
    senden: "Absenden und Gutschein holen", sende: "Wird gesendet …",
    errKontakt: "Für eine Anfrage oder die Verlosung brauchen wir deine E-Mail oder Handynummer.",
    errName: "Für eine Anfrage brauchen wir deinen Namen.",
    errSenden: "Das hat nicht geklappt. Bitte versuch es nochmals.",
    dankeH: "Danke!<br><span>Dein Gutschein.</span>",
    dankeP: `CHF ${GUTSCHEIN_CHF} auf alle Frankly-Teile. Mach einen Screenshot und zeig den Code an der Kasse.`,
    dankeAnfrage: "Deine Anfrage ist bei uns. Wir fragen die Besitzerin und melden uns bei dir.",
    dankeVerl: "Du bist bei der Verlosung dabei. Viel Glück!",
    folgen: "Wir melden auf Instagram, wo und wann es weitergeht.",
    zumShop: "Zum Online-Shop", nochmal: "Umfrage neu starten",
    claim: "Less pieces. <span>More identity.</span>",
    groesse: "Gr. {g}"
  },
  en: {
    tag: "Survey",
    kick: "We're moving",
    h1: "Your closet.<br><span>From 0.</span>",
    lead: "For three weeks we ran our second-hand pop-up. Now we're moving and carrying on. So we can prepare the right selection for you and you get the most out of it, we're doing this short survey.",
    winH: "Your win",
    win: [`<b>CHF ${GUTSCHEIN_CHF} voucher</b> on all Frankly pieces, right at the end.`, "<b>Prize draw:</b> 1 year of «Frankly Friends» membership (worth CHF 120).", "A selection that fits you."],
    how: [["1", "10 short questions about you and your style."], ["2", "Swipe through our pieces: right = want it, left = no thanks."], ["3", "Rework: how should old pieces look new?"], ["4", "At the end: what's still missing?"]],
    dauer: "Takes about 6 minutes. You can stop at any time.",
    rwKick: "Frankly Rework",
    rwH: "Old becomes <span>new.</span>",
    rwP: "Pieces nobody wants anymore, we redesign: cropping, dyeing, combining, embellishing. Every piece stays one of a kind. What would you wear?",
    rwSwipe: "First a few ideas to swipe, then 3 short questions.",
    rwGo: "See rework ideas", rwFragenGo: "Next",
    rwPopH: "You like it!",
    rwPopTragen: "How would you wear it?",
    rwTragen: { Alltag: "Every day", Twist: "With a twist, but wearable", Statement: "As a statement piece" },
    rwPopPreis: "What would you pay for it? (CHF)",
    rwQ: [
      ["rework_mut", "single", "How bold may a reworked piece be?"],
      ["rework_art", "multi", "Which rework would you wear?"],
      ["rework_mehr", "single", "How much more would you pay for a reworked piece than for the original?"]
    ],
    rwFragenH: "3 questions about rework",
    rwMehrfach: "Several answers possible.",
    start: "Let's go", weiter: "Next", zurueck: "Back", skip: "Skip",
    frage: "Question {n} of {m}", anderes: "Other (optional)", oben: "Top", unten: "Bottom", waehlen: "choose",
    bis2: "Choose up to 2.",
    swH: "Imagine: <span>your closet is empty.</span>",
    swP: "All your clothes are gone. You're filling your closet again from 0. What would you take from our pieces?",
    swHow: "Swipe right = want it. Swipe left = no thanks. Or use the buttons.",
    swNote: "You can add basics and anything missing here at the end.",
    swGo: "Fill my closet",
    nein: "← No thanks", ja: "Want it →", stampJa: "Want it", stampNein: "Nope",
    genug: "I've seen enough", undo: "↶ Undo", von: "{n} of {m}",
    leer: "There are no pieces right now. You can still continue.",
    ladeFehler: "The pieces can't be loaded right now. You can still continue.",
    laden: "Loading pieces …",
    popH: "Good choice!",
    popPreis: "What would be a fair price? (CHF)",
    popPreisNote: "Honestly: price and value should match.",
    popAnlass: "When would you wear it?",
    anlass: { Alltag: "Every day", Anlass: "For special occasions", Mieten: "I'd rather rent it" },
    popOk: "Save and next",
    fehltH: "What's still missing?",
    fehltP: "Your closet is filled again. What's still missing, and why? For example basics, a certain cut, or a piece you can never find.",
    fehltPh: "e.g. well-fitting black trousers, because …",
    kaufH: "Would you really like to buy something?",
    kaufP: "Tick what you'd like to have. This is <b>not a purchase</b> yet: you send a no-obligation request. We ask the owner and connect you. You arrange the rest directly with each other.",
    keineLikes: "You haven't swiped any piece to the right yet.",
    name: "Your name", kontakt: "Email or mobile number",
    kontaktNote: "Only for Frankly. We only pass your details on to the owner if you request a piece.",
    verlosung: "I'd like to join the prize draw (1 year of Frankly Friends).",
    senden: "Send and get my voucher", sende: "Sending …",
    errKontakt: "For a request or the prize draw we need your email or mobile number.",
    errName: "For a request we need your name.",
    errSenden: "That didn't work. Please try again.",
    dankeH: "Thank you!<br><span>Your voucher.</span>",
    dankeP: `CHF ${GUTSCHEIN_CHF} on all Frankly pieces. Take a screenshot and show the code at checkout.`,
    dankeAnfrage: "We've got your request. We'll ask the owner and get back to you.",
    dankeVerl: "You're in the prize draw. Good luck!",
    folgen: "We'll announce on Instagram where and when we continue.",
    zumShop: "To the online shop", nochmal: "Restart survey",
    claim: "Less pieces. <span>More identity.</span>",
    groesse: "Size {g}"
  }
}[LANG];
const tx = (k, v) => String(T[k]).replace(/\{(\w+)\}/g, (m, x) => v && v[x] != null ? v[x] : "");

/* ---------- Die 10 Fragen ---------- */
const L2 = (de, en) => LANG === "en" ? en : de;
const O = (de, en) => ({ de, en }); // gespeichert wird immer Deutsch, damit die Auswertung zusammenpasst
const FRAGEN = [
  { id: "kaschieren", typ: "multi", anderes: true,
    q: L2("Was versuchst du an dir eher zu kaschieren?", "What do you usually try to hide?"),
    opt: O(["Bauch", "Hüften", "Po", "Oberschenkel", "Oberarme", "Brust", "Schultern", "Nichts, ich zeige alles"], ["Belly", "Hips", "Bum", "Thighs", "Upper arms", "Bust", "Shoulders", "Nothing, I show it all"]) },
  { id: "betonen", typ: "multi", anderes: true,
    q: L2("Was betonst du gerne an dir?", "What do you like to show off?"),
    opt: O(["Taille", "Beine", "Dekolleté", "Schultern", "Rücken", "Arme", "Po", "Hals und Nacken"], ["Waist", "Legs", "Neckline", "Shoulders", "Back", "Arms", "Bum", "Neck"]) },
  { id: "nie_im_laden", typ: "text",
    q: L2("Was findest du nie in einem Laden, obwohl du es suchst?", "What can you never find in a shop, even though you look for it?"),
    ph: L2("z.B. Hosen, die bei langen Beinen passen", "e.g. trousers that fit long legs") },
  { id: "mehr_zahlen", typ: "multi", anderes: true,
    q: L2("Für was bezahlst du gerne mehr?", "What are you happy to pay more for?"),
    opt: O(["Gutes Material", "Perfekte Passform", "Einzelstück", "Bekannte Marke", "Nachhaltig und fair", "Handarbeit", "Zeitloses Design"], ["Good material", "Perfect fit", "One-of-a-kind", "Known brand", "Sustainable and fair", "Handmade", "Timeless design"]) },
  { id: "stil", typ: "stil", max: 2,
    q: L2("Welcher Stil bist du?", "Which style are you?") },
  { id: "groesse", typ: "groesse",
    q: L2("Welche Grösse trägst du?", "What size do you wear?") },
  { id: "nervt", typ: "multi", anderes: true,
    q: L2("Was nervt dich beim Secondhand-Einkaufen?", "What annoys you about second-hand shopping?"),
    opt: O(["Zu viel durchsuchen", "Meine Grösse fehlt", "Zustand unklar", "Geruch", "Zu teuer", "Online nicht anprobieren", "Zu wenig für meinen Stil", "Nichts"], ["Too much digging", "My size is missing", "Unclear condition", "Smell", "Too expensive", "Can't try on online", "Too little for my style", "Nothing"]) },
  { id: "zeit", typ: "multi",
    q: L2("Wann hast du Zeit zum Einkaufen?", "When do you have time to go shopping?"),
    opt: O(["Unter der Woche tagsüber", "Unter der Woche abends", "Samstag", "Sonntag"], ["Weekdays, daytime", "Weekday evenings", "Saturday", "Sunday"]) },
  { id: "mieten", typ: "multi",
    q: L2("Würdest du Kleider mieten? Wenn ja, was?", "Would you rent clothes? If so, what?"),
    opt: O(["Abendkleid", "Wintermantel", "Ski- und Snowboardkleidung", "Festival-Outfit", "Business-Outfit", "Nein, ich kaufe lieber"], ["Evening dress", "Winter coat", "Ski and snowboard wear", "Festival outfit", "Business outfit", "No, I'd rather buy"]) },
  { id: "verkaufen", typ: "single",
    q: L2("Würdest du deine eigenen Kleider bei uns verkaufen?", "Would you sell your own clothes with us?"),
    opt: O(["Ja, gerne", "Vielleicht", "Nein"], ["Yes, happily", "Maybe", "No"]) }
];
const STILE = [
  { key: "FIERCE", img: "stile/fierce.jpg", w: L2("laut, Muster, Farbe, Statement", "loud, prints, colour, statement") },
  { key: "EDGY", img: "stile/edgy.jpg", w: L2("dunkel, kantig, Leder, Transparenz", "dark, sharp, leather, sheer") },
  { key: "DREAMY", img: "stile/dreamy.jpg", w: L2("weich, floral, verspielt, fliessend", "soft, floral, playful, flowing") },
  { key: "AGILE", img: "stile/agile.jpg", w: L2("sportlich, bequem, clean, Basics", "sporty, comfy, clean, basics") }
];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const RW_OPT = {
  rework_mut: O(["Dezent: man sieht es kaum", "Mit Twist: ein besonderes Detail", "Statement: auffällig und einzigartig"], ["Subtle: you barely notice", "With a twist: one special detail", "Statement: bold and unique"]),
  rework_art: O(["Kürzen (z.B. Crop-Top, kurze Jacke)", "Neue Knöpfe oder Details", "Einfärben (z.B. alles schwarz)", "Patchwork aus verschiedenen Stoffen", "Ärmel oder Ausschnitt verändern", "Stickerei oder Print", "Details aus Seil oder Paracord", "Aus zwei Teilen wird eines"], ["Cropping (e.g. crop top, short jacket)", "New buttons or details", "Dyeing (e.g. all black)", "Patchwork from different fabrics", "Changing sleeves or neckline", "Embroidery or print", "Rope or paracord details", "Two pieces become one"]),
  rework_mehr: O(["Nichts mehr", "bis CHF 10 mehr", "bis CHF 20 mehr", "bis CHF 40 mehr", "mehr als CHF 40"], ["Nothing more", "up to CHF 10 more", "up to CHF 20 more", "up to CHF 40 more", "more than CHF 40"])
};

/* ---------- Zustand (wird im Browser gemerkt, falls die Seite neu lädt) ---------- */
const KEY = "frankly-umfrage-v3";
let S = load() || neu();
function neu() { return { step: "intro", q: 0, antworten: {}, swipes: [], idx: 0, order: null, ridx: 0, rorder: null, fehlt: "", kauf: [], name: "", kontakt: "", verlosung: false, code: null, hatKauf: false }; }
function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.step ? v : null; } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

let sb = null, ITEMS = [], BYID = {}, loadState = "idle", loadP = null;

/* ---------- Teile und Fotos ---------- */
function loadItems() { if (!loadP) loadP = loadItemsNow(); return loadP; }
async function loadItemsNow() {
  loadState = "loading";
  try {
    const r = await sb.rpc("umfrage_liste");
    if (r.error) throw r.error;
    ITEMS = Array.isArray(r.data) ? r.data : [];
    ITEMS.forEach(i => { BYID[i.id] = i; });
    // Reihenfolge einmal festlegen und merken
    const fill = (key, list) => {
      if (!S[key]) S[key] = list.map(i => i.id);
      else { const known = new Set(S[key]); list.forEach(i => { if (!known.has(i.id)) S[key].push(i.id); }); S[key] = S[key].filter(id => BYID[id]); }
    };
    fill("order", ITEMS.filter(i => i.art !== "rework"));
    fill("rorder", ITEMS.filter(i => i.art === "rework"));
    save();
    loadState = "ok";
  } catch (e) { loadState = "error"; }
}
/* Videos und Fotos liegen im öffentlichen Speicher «umfrage» */
const mediaUrl = it => it && it.pfad ? `${CFG.url}/storage/v1/object/public/umfrage/${it.pfad.split("/").map(encodeURIComponent).join("/")}` : "";
const label = it => (it && (it.titel || it.nr)) || "";
function mediaHtml(it, mode) {
  const u = mediaUrl(it); if (!u) return "";
  if (it.typ !== "video") return `<img src="${esc(u)}" alt="${esc(label(it))}" draggable="false"${mode === "thumb" ? ' loading="lazy"' : ""}>`;
  if (mode === "play") return `<video src="${esc(u)}" autoplay muted loop playsinline preload="auto" aria-label="${esc(label(it))}"></video>`;
  return `<video src="${esc(u)}#t=0.1" muted playsinline preload="metadata" aria-hidden="true"></video>`;
}

/* ---------- Ansichten ---------- */
function render() {
  window.scrollTo(0, 0); app.oninput = app.onchange = null;
  ({ intro, fragen, swipeIntro, swipe, rswipe: swipe, reworkIntro, reworkFragen, ende, danke }[S.step] || intro)();
}
function go(step) { S.step = step; save(); render(); }

function intro() {
  app.innerHTML = `
    <p class="kick">${T.kick}</p>
    <h1>${T.h1}</h1>
    <p class="lead">${T.lead}</p>
    <div class="win"><p class="kick">${T.winH}</p><ul>${T.win.map(w => `<li>${w}</li>`).join("")}</ul></div>
    <div class="steps">${T.how.map(([n, s]) => `<div><b>${n}</b><span>${s}</span></div>`).join("")}</div>
    <p class="muted">${T.dauer}</p>
    <div class="row"><button class="btn primary btn-l" id="go">${T.start}</button></div>
    <p class="claimline">${T.claim}</p>`;
  $("go").onclick = () => { S.q = 0; go("fragen"); };
}

function fragen() {
  const f = FRAGEN[S.q], a = S.antworten[f.id];
  const pct = Math.round(S.q / FRAGEN.length * 100);
  let body = "";
  if (f.typ === "multi" || f.typ === "single") {
    const sel = f.typ === "multi" ? (a && a.wahl) || [] : [a];
    body = `<div class="chips" role="group" aria-label="${esc(f.q)}">${f.opt.de.map((o, i) => `<button type="button" class="chip" data-o="${esc(o)}" aria-pressed="${sel.includes(o)}">${esc(LANG === "en" ? f.opt.en[i] : o)}</button>`).join("")}</div>`;
    if (f.anderes) body += `<label class="f" for="anders">${T.anderes}</label><input type="text" id="anders" maxlength="200" value="${esc(a && a.anders || "")}">`;
  } else if (f.typ === "text") {
    body = `<textarea id="txt" maxlength="1000" placeholder="${esc(f.ph)}">${esc(a || "")}</textarea>`;
  } else if (f.typ === "stil") {
    const sel = a || [];
    body = `<p class="muted">${T.bis2}</p><div class="stile">${STILE.map(s => `<button type="button" class="stil" data-s="${s.key}" aria-pressed="${sel.includes(s.key)}"><img src="${s.img}" alt=""><span><b>${s.key}</b><small>${esc(s.w)}</small></span></button>`).join("")}</div>`;
  } else if (f.typ === "groesse") {
    const v = a || {};
    const sel = (id, cur) => `<select id="${id}"><option value="">– ${T.waehlen} –</option>${SIZES.map(s => `<option ${cur === s ? "selected" : ""}>${s}</option>`).join("")}</select>`;
    body = `<div class="two"><div><label class="f" for="go_">${T.oben}</label>${sel("go_", v.oben)}</div><div><label class="f" for="gu_">${T.unten}</label>${sel("gu_", v.unten)}</div></div>`;
  }
  app.innerHTML = `
    <p class="kick">${tx("frage", { n: S.q + 1, m: FRAGEN.length })}</p>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <h2>${esc(f.q)}</h2>
    ${body}
    <div class="row"><button class="btn" id="back">${T.zurueck}</button><button class="btn primary" id="next">${T.weiter}</button><button class="btn ghost" id="skip">${T.skip}</button></div>`;

  app.querySelectorAll(".chip").forEach(b => b.onclick = () => {
    if (f.typ === "single") { app.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b)); return; }
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
  });
  app.querySelectorAll(".stil").forEach(b => b.onclick = () => {
    const on = b.getAttribute("aria-pressed") === "true";
    if (!on && app.querySelectorAll('.stil[aria-pressed="true"]').length >= f.max) return;
    b.setAttribute("aria-pressed", !on);
  });
  const store = () => {
    if (f.typ === "multi") S.antworten[f.id] = { wahl: [...app.querySelectorAll('.chip[aria-pressed="true"]')].map(b => b.dataset.o), anders: f.anderes ? $("anders").value.trim() : "" };
    else if (f.typ === "single") { const b = app.querySelector('.chip[aria-pressed="true"]'); S.antworten[f.id] = b ? b.dataset.o : null; }
    else if (f.typ === "text") S.antworten[f.id] = $("txt").value.trim();
    else if (f.typ === "stil") S.antworten[f.id] = [...app.querySelectorAll('.stil[aria-pressed="true"]')].map(b => b.dataset.s);
    else if (f.typ === "groesse") S.antworten[f.id] = { oben: $("go_").value, unten: $("gu_").value };
  };
  const nextQ = () => { if (S.q < FRAGEN.length - 1) { S.q++; save(); render(); } else go("swipeIntro"); };
  $("next").onclick = () => { store(); nextQ(); };
  $("skip").onclick = () => { delete S.antworten[f.id]; nextQ(); };
  $("back").onclick = () => { store(); if (S.q > 0) { S.q--; save(); render(); } else go("intro"); };
}

function swipeIntro() {
  app.innerHTML = `
    <div class="bar"><i style="width:100%"></i></div>
    <h1>${T.swH}</h1>
    <p class="lead">${T.swP}</p>
    <div class="steps"><div><b>→</b><span>${T.swHow}</span></div><div><b>+</b><span>${T.swNote}</span></div></div>
    <div class="row"><button class="btn" id="back">${T.zurueck}</button><button class="btn primary btn-l" id="go">${T.swGo}</button></div>`;
  $("go").onclick = () => go("swipe");
  $("back").onclick = () => { S.q = FRAGEN.length - 1; go("fragen"); };
}

/* ---------- Swipe ---------- */
async function swipe() {
  const step = S.step, RW = step === "rswipe";
  const IX = RW ? "ridx" : "idx", after = RW ? "reworkFragen" : "reworkIntro";
  if (loadState !== "ok" && loadState !== "error") {
    app.innerHTML = `<p class="muted">${T.laden}</p>`;
    await loadItems();
    if (S.step !== step) return;
  }
  const order = (RW ? S.rorder : S.order) || [];
  if (loadState === "error" || !order.length) {
    if (RW) { go(after); return; }
    app.innerHTML = `<p>${loadState === "error" ? T.ladeFehler : T.leer}</p><div class="row"><button class="btn primary" id="on">${T.weiter}</button></div>`;
    $("on").onclick = () => go(after); return;
  }
  if (S[IX] >= order.length) { go(after); return; }
  const mine = S.swipes.filter(x => RW ? x.art === "rework" : x.art !== "rework");
  const cur = BYID[order[S[IX]]], nxt = BYID[order[S[IX] + 1]];
  const cardHtml = (it, cls) => it ? `<div class="card ${cls}" ${cls === "top" ? 'id="card"' : ""}>
      <div class="ph">${mediaHtml(it, cls === "top" ? "play" : "still")}</div>
      <div class="info"><b>${esc(label(it))}</b><small>${it.groesse ? esc(tx("groesse", { g: it.groesse })) : ""}</small></div>
      ${cls === "top" ? `<div class="stamp yes">${T.stampJa}</div><div class="stamp no">${T.stampNein}</div>` : ""}
    </div>` : "";
  app.innerHTML = `
    ${RW ? `<p class="kick">${T.rwKick}</p>` : ""}
    <div class="under" style="margin:0 0 6px"><span class="cnt">${tx("von", { n: S[IX] + 1, m: order.length })}</span>${mine.length ? `<button class="btn ghost" id="undo">${T.undo}</button>` : ""}</div>
    <div class="bar"><i style="width:${Math.round(S[IX] / order.length * 100)}%"></i></div>
    <div class="deck" id="deck">${cardHtml(nxt, "next")}${cardHtml(cur, "top")}</div>
    <div class="swipebtns"><button class="btn" id="no">${T.nein}</button><button class="btn primary" id="yes">${T.ja}</button></div>
    <div class="under">${!RW && mine.length >= MIN_SWIPES ? `<button class="btn ghost" id="enough">${T.genug}</button>` : "<span></span>"}</div>`;

  const card = $("card"), yes = card.querySelector(".stamp.yes"), no = card.querySelector(".stamp.no");
  let x0 = null, dx = 0, busy = false;
  const fly = dir => {
    if (busy) return; busy = true;
    card.style.transition = "transform .28s ease, opacity .28s";
    card.style.transform = `translateX(${dir * 130}%) rotate(${dir * 18}deg)`; card.style.opacity = "0";
    setTimeout(() => decide(cur, dir > 0 ? "ja" : "nein", RW), 220);
  };
  card.addEventListener("pointerdown", e => { x0 = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.style.transition = "none"; });
  card.addEventListener("pointermove", e => {
    if (x0 == null) return; dx = e.clientX - x0;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    yes.style.opacity = Math.max(0, Math.min(1, dx / 90)); no.style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const end = () => {
    if (x0 == null) return; x0 = null;
    if (Math.abs(dx) > 90) fly(dx > 0 ? 1 : -1);
    else { card.style.transition = "transform .2s"; card.style.transform = ""; yes.style.opacity = 0; no.style.opacity = 0; }
  };
  card.addEventListener("pointerup", end); card.addEventListener("pointercancel", end);
  $("yes").onclick = () => fly(1); $("no").onclick = () => fly(-1);
  if ($("enough")) $("enough").onclick = () => go(after);
  if ($("undo")) $("undo").onclick = () => {
    const last = S.swipes[S.swipes.length - 1];
    if (last && (last.art === "rework") === RW) { S.swipes.pop(); S[IX] = Math.max(0, S[IX] - 1); }
    save(); render();
  };
  document.onkeydown = e => { if (S.step !== step || document.querySelector(".sheet")) return; if (e.key === "ArrowRight") fly(1); if (e.key === "ArrowLeft") fly(-1); };
}
function decide(it, wahl, RW) {
  const rec = { id: it.id, nr: it.nr, wahl };
  if (RW) rec.art = "rework";
  if (wahl === "nein") { S.swipes.push(rec); S[RW ? "ridx" : "idx"]++; save(); render(); return; }
  popup(it, rec, RW);
}
function popup(it, rec, RW) {
  const el = document.createElement("div");
  el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("data-notr", "");
  el.innerHTML = `<div>
    <p class="kick">${esc(label(it))}</p>
    <h2>${RW ? T.rwPopH : T.popH}</h2>
    <p class="q">${RW ? T.rwPopPreis : T.popPreis}</p>${RW ? "" : `<p class="muted">${T.popPreisNote}</p>`}
    <div class="chips" id="pp">${PREISE.map(p => `<button type="button" class="chip" data-v="${p}" aria-pressed="false">${p}</button>`).join("")}</div>
    <p class="q">${RW ? T.rwPopTragen : T.popAnlass}</p>
    <div class="chips" id="pa">${Object.entries(RW ? T.rwTragen : T.anlass).map(([k, v]) => `<button type="button" class="chip" data-v="${k}" aria-pressed="false">${esc(v)}</button>`).join("")}</div>
    <div class="row"><button class="btn primary" id="pok">${T.popOk}</button><button class="btn ghost" id="pskip">${T.skip}</button></div>
  </div>`;
  document.body.appendChild(el);
  const one = id => el.querySelectorAll(`#${id} .chip`).forEach(b => b.onclick = () => el.querySelectorAll(`#${id} .chip`).forEach(x => x.setAttribute("aria-pressed", x === b)));
  one("pp"); one("pa");
  const val = id => { const b = el.querySelector(`#${id} .chip[aria-pressed="true"]`); return b ? b.dataset.v : null; };
  const done = withVals => {
    if (withVals) { rec.preis = val("pp"); rec.anlass = val("pa"); }
    el.remove(); S.swipes.push(rec); S[RW ? "ridx" : "idx"]++; save(); render();
  };
  el.querySelector("#pok").onclick = () => done(true);
  el.querySelector("#pskip").onclick = () => done(false);
  el.querySelector(".chip").focus();
}

/* ---------- Rework ---------- */
async function reworkIntro() {
  if (loadState !== "ok" && loadState !== "error") { app.innerHTML = `<p class="muted">${T.laden}</p>`; await loadItems(); if (S.step !== "reworkIntro") return; }
  const hat = (S.rorder || []).length > 0;
  app.innerHTML = `
    <p class="kick">${T.rwKick}</p>
    <h1>${T.rwH}</h1>
    <p class="lead">${T.rwP}</p>
    ${hat ? `<p class="muted">${T.rwSwipe}</p>` : ""}
    <div class="row"><button class="btn" id="back">${T.zurueck}</button><button class="btn primary btn-l" id="go">${hat ? T.rwGo : T.rwFragenGo}</button></div>`;
  $("go").onclick = () => go(hat ? "rswipe" : "reworkFragen");
  $("back").onclick = () => {
    const n = (S.order || []).length, last = S.swipes[S.swipes.length - 1];
    if (n && S.idx >= n && last && last.art !== "rework") { S.swipes.pop(); S.idx = n - 1; }
    go(n ? "swipe" : "swipeIntro");
  };
}
function reworkFragen() {
  const blocks = T.rwQ.map(([id, typ, q]) => {
    const o = RW_OPT[id], a = S.antworten[id];
    const sel = typ === "multi" ? (a && a.wahl) || [] : [a];
    return `<h2 style="margin-top:20px">${esc(q)}</h2>${typ === "multi" ? `<p class="muted">${T.rwMehrfach}</p>` : ""}
      <div class="chips" data-q="${id}" data-typ="${typ}">${o.de.map((x, i) => `<button type="button" class="chip" data-o="${esc(x)}" aria-pressed="${sel.includes(x)}">${esc(LANG === "en" ? o.en[i] : x)}</button>`).join("")}</div>`;
  }).join("");
  app.innerHTML = `<p class="kick">${T.rwKick}</p><h1 style="font-size:clamp(28px,7vw,40px)">${T.rwFragenH}</h1>${blocks}
    <div class="row"><button class="btn" id="back">${T.zurueck}</button><button class="btn primary" id="next">${T.weiter}</button></div>`;
  app.querySelectorAll("[data-q]").forEach(g => g.querySelectorAll(".chip").forEach(b => b.onclick = () => {
    if (g.dataset.typ === "single") g.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === b && b.getAttribute("aria-pressed") !== "true"));
    else b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
  }));
  const store = () => app.querySelectorAll("[data-q]").forEach(g => {
    const on = [...g.querySelectorAll('.chip[aria-pressed="true"]')].map(b => b.dataset.o);
    if (g.dataset.typ === "multi") { if (on.length) S.antworten[g.dataset.q] = { wahl: on, anders: "" }; else delete S.antworten[g.dataset.q]; }
    else { if (on[0]) S.antworten[g.dataset.q] = on[0]; else delete S.antworten[g.dataset.q]; }
  });
  $("next").onclick = () => { store(); go("ende"); };
  $("back").onclick = () => { store(); go("reworkIntro"); };
}

/* ---------- Ende ---------- */
async function ende() {
  const likes = S.swipes.filter(s => s.wahl === "ja" && s.art !== "rework");
  if (KAUF_AKTIV && likes.length) { app.innerHTML = `<p class="muted">${T.laden}</p>`; await loadItems(); }
  if (S.step !== "ende") return;
  const kaufHtml = !KAUF_AKTIV ? "" : `
    <h2 style="margin-top:26px">${T.kaufH}</h2>
    <p>${T.kaufP}</p>
    ${likes.length ? `<div class="likes">${likes.map(s => { const it = BYID[s.id] || { nr: s.nr }; return `<label class="like">
        ${mediaHtml(it, "thumb") || "<span></span>"}
        <span>${esc(label(it))}<small>${it.groesse ? esc(tx("groesse", { g: it.groesse })) : ""}${s.preis ? " · CHF " + esc(s.preis) : ""}</small></span>
        <input type="checkbox" data-k="${esc(s.id)}" ${S.kauf.includes(s.id) ? "checked" : ""}>
      </label>`; }).join("")}</div>` : `<p class="muted">${T.keineLikes}</p>`}`;
  app.innerHTML = `
    <h2>${T.fehltH}</h2>
    <p>${T.fehltP}</p>
    <textarea id="fehlt" maxlength="2000" placeholder="${esc(T.fehltPh)}">${esc(S.fehlt)}</textarea>
    ${kaufHtml}
    <label class="f" for="nm">${T.name}</label><input type="text" id="nm" maxlength="120" autocomplete="name" value="${esc(S.name)}">
    <label class="f" for="kt">${T.kontakt}</label><input type="text" id="kt" maxlength="160" autocomplete="email" value="${esc(S.kontakt)}">
    <p class="muted" style="margin-top:6px">${T.kontaktNote}</p>
    <label class="check"><input type="checkbox" id="vl" ${S.verlosung ? "checked" : ""}><span>${T.verlosung}</span></label>
    <p class="err" id="err" role="alert"></p>
    <div class="row"><button class="btn" id="back">${T.zurueck}</button><button class="btn primary btn-l" id="send">${T.senden}</button></div>`;
  const keep = () => {
    S.fehlt = $("fehlt").value; S.name = $("nm").value; S.kontakt = $("kt").value; S.verlosung = $("vl").checked;
    S.kauf = [...app.querySelectorAll("[data-k]:checked")].map(i => i.dataset.k); save();
  };
  app.oninput = keep; app.onchange = keep;
  $("back").onclick = () => { keep(); go("reworkFragen"); };
  $("send").onclick = send;
}
async function send() {
  const err = $("err"); err.textContent = "";
  const name = S.name.trim(), kontakt = S.kontakt.trim();
  if ((S.kauf.length || S.verlosung) && kontakt.length < 3) { err.textContent = T.errKontakt; return; }
  if (S.kauf.length && !name) { err.textContent = T.errName; return; }
  const btn = $("send"); btn.disabled = true; btn.textContent = T.sende;
  const swipeById = Object.fromEntries(S.swipes.map(s => [s.id, s]));
  const payload = {
    sprache: LANG, fragen: S.antworten, swipes: S.swipes, fehlt: S.fehlt.trim(),
    name, kontakt, verlosung: S.verlosung,
    kauf: S.kauf.map(id => ({ id, preis: (swipeById[id] && swipeById[id].preis) || "" }))
  };
  try {
    const r = await sb.rpc("umfrage_senden", { p: payload });
    if (r.error) throw r.error;
    S.code = r.data; S.hatKauf = S.kauf.length > 0; go("danke");
  } catch (e) {
    err.textContent = (e && e.message && /brauchen wir|höchstens/.test(e.message) && LANG === "de") ? e.message : T.errSenden;
    btn.disabled = false; btn.textContent = T.senden;
  }
}
function danke() {
  app.innerHTML = `
    <h1>${T.dankeH}</h1>
    <div class="code">${esc(S.code || "")}</div>
    <p>${T.dankeP}</p>
    ${S.hatKauf ? `<p>${T.dankeAnfrage}</p>` : ""}
    ${S.verlosung ? `<p>${T.dankeVerl}</p>` : ""}
    <p class="muted">${T.folgen}</p>
    <div class="row"><a class="btn primary" href="./">${T.zumShop}</a><button class="btn ghost" id="again">${T.nochmal}</button></div>
    <p class="claimline">${T.claim}</p>`;
  $("again").onclick = () => { S = neu(); save(); render(); };
}

/* ---------- Start ---------- */
$("tag").textContent = T.tag;
if (LANG === "en") document.title = "0–100 Frankly · Survey";
if (!window.supabase || !CFG) { app.innerHTML = `<p class="err">${T.errSenden}</p>`; }
else {
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "frankly-umfrage" } });
  render(); loadItems();
}
