/* =========================================================
   0–100 FRANKLY · ÖFFENTLICHER SHOP
   Ohne Login. Liest nur, was die Datenbank öffentlich freigibt
   (siehe supabase/04_shop_anmeldungen.sql) und nimmt Anmeldungen entgegen.
   ========================================================= */
"use strict";

/* ---------- Ladeninfos: hier anpassen ---------- */
const SHOP = {
  ort: "Josy · Zentrum für Kreislaufwirtschaft",
  strasse: "Neue Hard 10",
  plz: "8005 Zürich",
  zeiten: [["Mi – Fr", "13.00 – 19.00 Uhr"], ["Sa", "9.30 – 17.00 Uhr"], ["So – Di", "geschlossen"]],
  maps: "https://www.google.com/maps/search/?api=1&query=Neue+Hard+10+8005+Z%C3%BCrich"
};
/* Stil-Kacheln fürs Anmeldeformular. Eigene Fotos: Datei in den Ordner "stile/" legen. */
const STILE = [
  { key: "EDGY", img: "stile/edgy.jpg", words: "dunkel, kantig, Leder, Transparenz" },
  { key: "FIERCE", img: "stile/fierce.jpg", words: "laut, Muster, Farbe, Statement" },
  { key: "DREAMY", img: "stile/dreamy.jpg", words: "weich, floral, verspielt, fliessend" },
  { key: "AGILE", img: "stile/agile.jpg", words: "sportlich, bequem, clean, Basics" }
];
const CATS = ["Oberteile", "Hosen", "Röcke", "Kleider", "Jacken", "Schuhe", "Taschen", "Accessoires"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const CFG = window.FRANKLY_CONFIG;
const $ = id => document.getElementById(id);
let sb = null, ITEMS = [], OWNERS = [], LOOKS = [], RENT = {}, URLS = {}, cat = "Alle";

/* ---------- Hilfen ---------- */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function chf(v) { if (v === null || v === undefined || v === "") return "Preis im Laden"; const n = Number(v); return "CHF " + n.toFixed(n % 1 ? 2 : 0); }
function known(v) { return v != null && v !== "" && !/prüfen|unbekannt|\?/i.test(String(v)); }
function clean(v) { return String(v).replace(/\s*\(.*?\)\s*/g, " ").trim(); }
function imgUrl(p) { return p ? URLS[p] || "" : ""; }
function imgTag(p, alt) { const u = imgUrl(p); return u ? `<img src="${esc(u)}" alt="${esc(alt)}" loading="lazy">` : `<span class="nofoto">Foto folgt</span>`; }
function ownerOf(id) { return OWNERS.find(o => o.id === id); }
let tt; function toast(m, ms) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, ms || 2800); }
const pad = n => String(n).padStart(2, "0");
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function shortDate(s) { if (!s) return ""; const [y, m, d] = String(s).slice(0, 10).split("-"); return `${d}.${m}.`; }
function rentText(it) { const r = RENT[it.id]; return r && r.bis ? `Vermietet bis ${shortDate(r.bis)}` : "Gerade vermietet"; }
function badge(it) {
  if (it.status === "Reserviert") return `<span class="pill">Reserviert</span>`;
  if (it.status === "Vermietet") return `<span class="pill muted">${esc(rentText(it))}</span>`;
  if (it.stufe === "Lager") return `<span class="pill">Auf Anfrage</span>`;
  if (it.stufe === "Reduziert") return `<span class="pill sold">Reduziert</span>`;
  return "";
}

/* ---------- Ladeninfos anzeigen ---------- */
function renderInfo() {
  const hours = SHOP.zeiten.map(([d, z]) => `<tr><th>${esc(d)}</th><td>${esc(z)}</td></tr>`).join("");
  $("whereLine").innerHTML = `Im Laden: <b>${esc(SHOP.strasse)}, ${esc(SHOP.plz)}</b> · ${esc(SHOP.zeiten.slice(0, 2).map(z => z.join(" ")).join(" · "))}`;
  $("visit").innerHTML = `
    <div class="vblock">
      <span class="klabel">Adresse</span>
      <p class="addr">${esc(SHOP.ort)}<br><b>${esc(SHOP.strasse)}<br>${esc(SHOP.plz)}</b></p>
      <a class="btn" href="${esc(SHOP.maps)}" target="_blank" rel="noopener">In Karten öffnen</a>
    </div>
    <div class="vblock">
      <span class="klabel">Öffnungszeiten</span>
      <table class="hours">${hours}</table>
    </div>`;
  $("footInfo").innerHTML = `<b>0–100 Frankly</b> · ${esc(SHOP.strasse)}, ${esc(SHOP.plz)}`;
}

/* ---------- Daten laden ---------- */
async function load() {
  const [a, b, c] = await Promise.all([
    sb.from("items").select("id,nr,nr_num,titel,kategorie,unterkategorie,schnitt,farben,muster,groesse,marke,material,zustand,preis,status,owner_id,foto_pfad,stufe").in("status", ["Verfügbar", "Reserviert", "Vermietet"]).order("nr_num", { ascending: false }),
    sb.from("owners").select("id,profilname,stil,instagram"),
    sb.from("looks").select("id,nr,nr_num,name,style,konzept,foto_pfad,look_items(item_id,position)").order("nr_num", { ascending: false })
  ]);
  if (a.error) throw a.error;
  ITEMS = a.data || [];
  OWNERS = b.error ? [] : (b.data || []);
  const ids = new Set(ITEMS.map(i => i.id));
  RENT = {};
  if (ITEMS.some(i => i.status === "Vermietet")) {
    const r = await sb.from("vermietungen").select("item_id,von,bis,zurueck_am").is("zurueck_am", null);
    (r.data || []).forEach(x => { const cur = RENT[x.item_id]; if (!cur || String(x.von) > String(cur.von)) RENT[x.item_id] = x; });
  }
  LOOKS = (c.error ? [] : (c.data || [])).map(l => Object.assign({}, l, { items: (l.look_items || []).slice().sort((x, y) => x.position - y.position).map(x => x.item_id).filter(id => ids.has(id)) })).filter(l => l.items.length);
  const paths = [...new Set(ITEMS.map(i => i.foto_pfad).concat(LOOKS.map(l => l.foto_pfad)).filter(Boolean))];
  for (let i = 0; i < paths.length; i += 100) {
    const r = await sb.storage.from(CFG.bucket || "fotos").createSignedUrls(paths.slice(i, i + 100), 60 * 60 * 6);
    (r.data || []).forEach(x => { if (x.signedUrl && x.path) URLS[x.path] = x.signedUrl; });
  }
}

/* ---------- Stöbern ---------- */
function card(it) {
  return `
    <button class="card" type="button" data-item="${esc(it.nr)}">
      <div class="ph">${imgTag(it.foto_pfad, it.titel)}<span class="tag">${esc(it.nr)}</span></div>
      <div class="meta"><span class="title">${esc(it.titel)}</span><span class="price">${esc(chf(it.preis))}</span></div>
      <div class="line2">${badge(it)}<span>${esc(known(it.groesse) ? "Gr. " + clean(it.groesse) : (it.unterkategorie || it.kategorie || ""))}</span></div>
    </button>`;
}
function renderFilters() {
  const cs = ["Alle"].concat(CATS.filter(c => ITEMS.some(i => i.kategorie === c)));
  $("cats").innerHTML = cs.map(c => `<button class="chip" type="button" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  const sizes = [...new Set(ITEMS.map(i => known(i.groesse) ? clean(i.groesse) : null).filter(Boolean))].sort();
  const cur = $("fsize").value;
  $("fsize").innerHTML = `<option value="">Alle Grössen</option>` + sizes.map(s => `<option ${s === cur ? "selected" : ""}>${esc(s)}</option>`).join("");
}
function renderGrid() {
  const q = $("q").value.trim().toLowerCase(), size = $("fsize").value;
  const list = ITEMS.filter(i => (cat === "Alle" || i.kategorie === cat) && (!size || (known(i.groesse) && clean(i.groesse) === size)) &&
    (!q || [i.nr, i.titel, i.marke, i.farben, i.kategorie, i.unterkategorie, i.groesse, i.material].join(" ").toLowerCase().includes(q)));
  $("grid").innerHTML = !ITEMS.length ? `<p class="empty">Gerade ist nichts online. Komm im Laden vorbei, wir hängen laufend neue Teile auf.</p>`
    : (list.length ? list.map(card).join("") : `<p class="empty">Nichts gefunden. Versuch es mit einem anderen Filter.</p>`);
}
function renderLooks() {
  $("lookGrid").innerHTML = LOOKS.length ? LOOKS.map(l => {
    const first = ITEMS.find(i => i.id === l.items[0]);
    return `
    <div class="look">
      <button class="card" type="button" data-look="${esc(l.id)}" style="gap:10px">
        <div class="ph">${imgTag(l.foto_pfad || (first && first.foto_pfad), l.name)}</div>
        <span class="style">${esc(l.style || "")}</span>
        <span class="lname">${esc(l.name)}</span>
      </button>
      <div class="thumbs">${l.items.map(id => { const it = ITEMS.find(x => x.id === id); return it ? `<button class="mini" type="button" data-item="${esc(it.nr)}">${imgUrl(it.foto_pfad) ? `<img src="${esc(imgUrl(it.foto_pfad))}" alt="">` : ""}${esc(it.nr)}</button>` : ""; }).join("")}</div>
    </div>`;
  }).join("") : `<p class="empty">Bald gibt es hier Looks zu sehen.</p>`;
}

/* ---------- Panel ---------- */
const ov = $("ov"), panel = $("panel");
let lastFocus = null;
function openPanel(html) { if (ov.hidden) lastFocus = document.activeElement; panel.innerHTML = html; ov.hidden = false; document.body.style.overflow = "hidden"; panel.scrollTop = 0; const c = panel.querySelector(".close"); if (c) c.focus({ preventScroll: true }); }
function closePanel() { ov.hidden = true; panel.innerHTML = ""; document.body.style.overflow = ""; setParam(null); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
ov.addEventListener("click", e => { if (e.target === ov) closePanel(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !ov.hidden) closePanel(); });
function setParam(nr) {
  try { const u = new URL(location.href); if (nr) u.searchParams.set("teil", nr); else u.searchParams.delete("teil"); history.replaceState(null, "", u); } catch (e) {}
}
function visitBox() {
  return `<div class="box"><span class="klabel">Anprobieren im Laden</span>
    <p class="pline"><b>${esc(SHOP.strasse)}, ${esc(SHOP.plz)}</b><br>${SHOP.zeiten.slice(0, 2).map(([d, z]) => `${esc(d)} ${esc(z)}`).join("<br>")}</p></div>`;
}
function showItem(nr) {
  const it = ITEMS.find(x => x.nr === nr);
  if (!it) { openPanel(`<div class="phead"><span class="sub">Teil</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div><h2 class="dt">${esc(nr)}</h2><p class="desc">Dieses Teil ist gerade nicht mehr im Laden. Vielleicht wurde es schon verkauft.</p><button class="btn" type="button" data-close>Weiter stöbern</button>`); return; }
  setParam(it.nr);
  const o = ownerOf(it.owner_id);
  const facts = [["Grösse", it.groesse], ["Marke", it.marke], ["Material", it.material], ["Farben", it.farben], ["Muster", it.muster], ["Schnitt", it.schnitt], ["Zustand", it.zustand], ["Kategorie", it.unterkategorie || it.kategorie]].filter(([, v]) => known(v));
  const ls = LOOKS.filter(l => l.items.includes(it.id));
  openPanel(`
    <div class="phead"><span class="sub">Teil</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <div class="d">
      <div class="big">${imgTag(it.foto_pfad, it.titel)}</div>
      <div>
        <div class="nr"><small>Nummer</small>${esc(it.nr)}</div>
        <h2 class="dt">${esc(it.titel)}</h2>
        <div class="statusrow"><span class="sprice">${esc(chf(it.preis))}</span>${badge(it)}</div>
        ${it.status === "Vermietet" ? `<p class="hint">${RENT[it.id] && RENT[it.id].bis ? `Dieses Teil ist bis ${esc(shortDate(RENT[it.id].bis))} vermietet und danach wieder im Laden.` : "Dieses Teil ist gerade vermietet und bald wieder im Laden."}</p>` : ""}
        ${it.status === "Reserviert" ? `<p class="hint">Dieses Teil ist für jemanden reserviert.</p>` : ""}
        ${it.stufe === "Lager" && it.status === "Verfügbar" ? anfrageBox(it) : ""}
        ${facts.length ? `<dl class="f">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(clean(v))}</dd>`).join("")}</dl>` : ""}
        ${o ? `<div class="box owner"><span class="klabel">Aus dem Kleiderschrank von</span><button class="linkbtn oname" type="button" data-owner="${esc(o.id)}">${esc(o.profilname)}</button>${o.stil ? `<p class="hint">${esc(o.stil)}</p>` : ""}</div>` : ""}
        ${ls.length ? `<div class="sec">Steckt in diesen Looks</div><div class="thumbs">${ls.map(l => `<button class="mini" type="button" data-look="${esc(l.id)}">${esc(l.style || "")} · ${esc(l.name)}</button>`).join("")}</div>` : ""}
        ${visitBox()}
        <div class="rowsmall"><button class="btn" type="button" data-share="${esc(it.nr)}">Link kopieren</button></div>
      </div>
    </div>`);
}
/* Teile im Lager: Anprobe anfragen */
function anfrageBox(it) {
  return `<div class="box"><span class="klabel">Auf Anfrage</span>
    <p class="pline">Dieses Teil hängt gerade nicht im Laden, sondern im Lager. Schreib uns, dann legen wir es für deinen Besuch bereit.</p>
    <form class="form anfform" id="anfForm" data-anf="${esc(it.id)}" novalidate>
      <label>Dein Name *<input id="a-name" autocomplete="name" maxlength="120"></label>
      <label>E-Mail oder Telefon *<input id="a-kontakt" autocomplete="email" maxlength="160"></label>
      <label>Wann kommst du vorbei? (freiwillig)<input id="a-msg" maxlength="500" placeholder="z.B. Samstag Vormittag"></label>
      <label class="hp" aria-hidden="true">Website<input id="a-website" tabindex="-1" autocomplete="off"></label>
      <p class="err" id="a-err" aria-live="polite"></p>
      <button class="btn primary" type="submit" id="a-btn">Anprobe anfragen</button>
    </form>
    <p class="lead" id="a-done" hidden>Danke! Wir melden uns bei dir.</p></div>`;
}
async function sendAnfrage(form) {
  const err = $("a-err"), btn = $("a-btn"); err.textContent = "";
  if ($("a-website").value) return;
  const name = $("a-name").value.trim(), kontakt = $("a-kontakt").value.trim(), msg = $("a-msg").value.trim();
  if (!name || kontakt.length < 3) { err.textContent = "Bitte Name und E-Mail oder Telefon angeben."; return; }
  btn.disabled = true; btn.textContent = "Wird gesendet …";
  const { error } = await sb.from("anfragen").insert({ item_id: form.dataset.anf, name, kontakt, nachricht: msg || null });
  if (error) { btn.disabled = false; btn.textContent = "Anprobe anfragen"; err.textContent = /fetch|network/i.test(error.message) ? "Keine Verbindung. Bitte nochmals versuchen." : "Das hat nicht geklappt. Bitte komm direkt im Laden vorbei."; return; }
  form.hidden = true; $("a-done").hidden = false;
}
document.addEventListener("submit", e => { const f = e.target.closest("#anfForm"); if (f) { e.preventDefault(); sendAnfrage(f); } });
function showOwner(id) {
  const o = ownerOf(id); if (!o) return;
  const its = ITEMS.filter(i => i.owner_id === id);
  const ig = o.instagram ? o.instagram.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "") : "";
  openPanel(`
    <div class="phead"><span class="sub">Kleiderschrank</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <h2 class="dt">${esc(o.profilname)}</h2>
    ${o.stil ? `<p class="desc">${esc(o.stil)}</p>` : ""}
    ${ig ? `<a class="btn" href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener">@${esc(ig)} auf Instagram</a>` : ""}
    <div class="sec">${its.length} ${its.length === 1 ? "Teil" : "Teile"} im Laden</div>
    <div class="grid">${its.map(card).join("")}</div>`);
}
function showLook(id) {
  const l = LOOKS.find(x => x.id === id); if (!l) return;
  const first = ITEMS.find(i => i.id === l.items[0]);
  openPanel(`
    <div class="phead"><span class="sub">Look</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <div class="d">
      <div class="big">${imgTag(l.foto_pfad || (first && first.foto_pfad), l.name)}</div>
      <div>
        <div class="style">${esc(l.style || "")}</div>
        <h2 class="dt" style="margin-top:4px">${esc(l.name)}</h2>
        <p class="desc">${esc(l.konzept || "")}</p>
        <div class="sec">Teile in diesem Look</div>
        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${l.items.map(iid => { const it = ITEMS.find(x => x.id === iid); return it ? card(it) : ""; }).join("")}</div>
      </div>
    </div>`);
}

/* ---------- Navigation ---------- */
const VIEWS = { shop: "v-shop", looks: "v-looks", join: "v-join", visit: "v-visit" };
const HASH = { stoebern: "shop", looks: "looks", mitmachen: "join", besuch: "visit" };
function go(v, push) {
  Object.entries(VIEWS).forEach(([k, id]) => { $(id).hidden = k !== v; });
  document.querySelectorAll(".snav a").forEach(a => a.setAttribute("aria-current", a.dataset.nav === v ? "page" : "false"));
  if (push) { const h = Object.keys(HASH).find(k => HASH[k] === v); try { history.replaceState(null, "", h && v !== "shop" ? "#" + h : location.pathname + location.search); } catch (e) {} }
  window.scrollTo(0, 0);
}

/* ---------- Owner werden ---------- */
let rentFiles = [];
function initJoin() {
  const t = new Date(); let opts = "";
  for (let i = 0; i < 5; i++) { const d = new Date(t.getFullYear(), t.getMonth() + i, 1); opts += `<option value="${iso(d)}" ${i === 1 ? "selected" : ""}>${MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`; }
  $("j-monat").innerHTML = opts + `<option value="">Egal, sobald es passt</option>`;
  $("j-anzahl").innerHTML = Array.from({ length: 10 }, (_, i) => `<option ${i === 9 ? "selected" : ""}>${i + 1}</option>`).join("");
  $("j-kat").innerHTML = CATS.map(c => `<button class="chip" type="button" aria-pressed="false" data-jkat="${c}">${c}</button>`).join("");
  $("j-oben").innerHTML = SIZES.map(s => `<button class="chip" type="button" aria-pressed="false" data-jsize="oben" data-v="${s}">${s}</button>`).join("");
  $("j-unten").innerHTML = SIZES.map(s => `<button class="chip" type="button" aria-pressed="false" data-jsize="unten" data-v="${s}">${s}</button>`).join("");
  let sh = `<option value="">Keine Schuhe</option>`; for (let s = 35; s <= 44; s++) sh += `<option>${s}</option>`;
  $("j-schuhe").innerHTML = sh;
  $("j-stile").innerHTML = STILE.map(s => `
    <button class="stile" type="button" aria-pressed="false" data-stil="${s.key}">
      <span class="sph"><img src="${esc(s.img)}" alt="" onerror="this.remove()"><span class="sname">${s.key}</span></span>
      <span class="swords">${esc(s.words)}</span>
    </button>`).join("");
  $("j-vermieten").addEventListener("change", () => { $("rentBox").hidden = !$("j-vermieten").checked; });
  $("j-fotos").addEventListener("change", () => {
    const add = [...$("j-fotos").files].filter(f => f.type.startsWith("image/") || /\.heic$/i.test(f.name));
    rentFiles = rentFiles.concat(add).slice(0, 12); $("j-fotos").value = ""; renderRentThumbs();
  });
  $("joinForm").addEventListener("submit", e => { e.preventDefault(); submitJoin(); });
}
function renderRentThumbs() {
  $("rentThumbs").innerHTML = rentFiles.map((f, i) => `<span class="rthumb"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" data-rmfoto="${i}" aria-label="Foto entfernen">✕</button></span>`).join("");
}
function picked(sel) { return [...document.querySelectorAll(sel + '[aria-pressed="true"]')]; }
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error("Ein Foto konnte nicht verarbeitet werden.")), "image/jpeg", 0.84);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Ein Foto konnte nicht gelesen werden. Bitte JPG oder PNG wählen.")); };
    img.src = url;
  });
}
async function submitJoin() {
  const err = $("joinErr"), btn = $("joinBtn"); err.textContent = "";
  const v = id => { const x = $(id).value.trim(); return x || null; };
  if ($("j-website").value) return; // Spam-Schutz
  const email = v("j-email");
  const stile = picked("[data-stil]").map(b => b.dataset.stil);
  const fehler = [];
  if (!v("j-vorname")) fehler.push("Vorname");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fehler.push("gültige E-Mail");
  if (!stile.length) fehler.push("mindestens ein Stil-Bild");
  if ($("j-vermieten").checked && !rentFiles.length) fehler.push("Fotos der Teile zum Vermieten");
  if (!$("j-ok").checked) fehler.push("Zustimmung zu den Bedingungen");
  if (fehler.length) { err.textContent = "Bitte noch ergänzen: " + fehler.join(", ") + "."; return; }
  btn.disabled = true; btn.textContent = "Wird gesendet …";
  try {
    const folder = uuid(), fotos = [];
    if ($("j-vermieten").checked) {
      for (let i = 0; i < rentFiles.length; i++) {
        btn.textContent = `Foto ${i + 1} von ${rentFiles.length} wird hochgeladen …`;
        const blob = await resizeImage(rentFiles[i]), path = `${folder}/${i + 1}.jpg`;
        const { error } = await sb.storage.from("anmeldungen").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        fotos.push(path);
      }
    }
    const row = {
      vorname: v("j-vorname"), nachname: v("j-nachname"), email, telefon: v("j-telefon"), instagram: v("j-instagram"),
      groesse_oben: picked('[data-jsize="oben"]').map(b => b.dataset.v).join("/") || null,
      groesse_unten: picked('[data-jsize="unten"]').map(b => b.dataset.v).join("/") || null,
      schuhgroesse: v("j-schuhe"), kategorien: picked("[data-jkat]").map(b => b.dataset.jkat), stile,
      anzahl_teile: Number($("j-anzahl").value), wunsch_monat: $("j-monat").value || null,
      vermieten: $("j-vermieten").checked, vermieten_text: $("j-vermieten").checked ? v("j-vtext") : null, vermieten_fotos: fotos,
      nachricht: v("j-nachricht"), zustimmung: true
    };
    const { error } = await sb.from("anmeldungen").insert(row);
    if (error) throw error;
    $("joinForm").hidden = true; $("joinDone").hidden = false;
    $("joinDone").querySelector(".lead").textContent = row.vermieten
      ? "Deine Anmeldung ist bei uns. Deine Vermiet-Teile prüfen wir und melden uns innerhalb von 24 Stunden per E-Mail."
      : "Deine Anmeldung ist bei uns. Wir melden uns per E-Mail, sobald wir den Monat planen.";
    window.scrollTo(0, 0);
  } catch (e) {
    const m = (e && e.message) || String(e);
    err.textContent = /Failed to fetch|NetworkError|Load failed/i.test(m) ? "Keine Verbindung. Prüfe das Internet und versuch es nochmals." : "Das hat nicht geklappt: " + m;
    btn.disabled = false; btn.textContent = "Anmeldung senden";
  }
}

/* ---------- Klicks ---------- */
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-nav]");
  if (a) { e.preventDefault(); closePanelIfOpen(); go(a.dataset.nav, true); return; }
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.close !== undefined) return closePanel();
  if (d.cat) { cat = d.cat; renderFilters(); renderGrid(); return; }
  if (d.item) return showItem(d.item);
  if (d.look) return showLook(d.look);
  if (d.owner) return showOwner(d.owner);
  if (d.jkat) { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"); return; }
  if (d.jsize) {
    const on = b.getAttribute("aria-pressed") !== "true", group = picked(`[data-jsize="${d.jsize}"]`);
    if (on && group.length >= 2) { toast("Höchstens zwei Grössen, z.B. S und M."); return; }
    b.setAttribute("aria-pressed", on); return;
  }
  if (d.stil) {
    const on = b.getAttribute("aria-pressed") !== "true";
    if (on && picked("[data-stil]").length >= 2) { toast("Höchstens zwei Stile."); return; }
    b.setAttribute("aria-pressed", on); return;
  }
  if (d.rmfoto !== undefined) { rentFiles.splice(Number(d.rmfoto), 1); renderRentThumbs(); return; }
  if (d.share) {
    const u = new URL(location.href); u.hash = ""; u.search = "?teil=" + encodeURIComponent(d.share);
    const txt = u.toString();
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast("Link kopiert"), () => toast(txt, 6000)); else toast(txt, 6000);
  }
});
function closePanelIfOpen() { if (!ov.hidden) closePanel(); }
$("q").addEventListener("input", renderGrid);
$("fsize").addEventListener("change", renderGrid);

/* ---------- Start ---------- */
async function init() {
  renderInfo(); initJoin();
  const h = (location.hash || "").replace("#", "");
  go(HASH[h] || "shop", false);
  if (!window.supabase || !CFG) { $("grid").innerHTML = `<p class="err">Die Seite konnte nicht geladen werden. Bitte neu laden.</p>`; return; }
  // Eigener, login-freier Zugang: liest nie eine gespeicherte Team-Anmeldung
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "frankly-shop" } });
  try { await load(); renderFilters(); renderGrid(); renderLooks(); }
  catch (e) { $("grid").innerHTML = `<p class="empty">Die Teile können gerade nicht geladen werden. Bitte versuch es später nochmals.</p>`; }
  const nr = new URLSearchParams(location.search).get("teil");
  if (nr) showItem(nr.toUpperCase());
}
init();
