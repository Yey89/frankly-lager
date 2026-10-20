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
const CATS = ["Oberteile", "Tuniken", "Hosen", "Röcke", "Kleider", "Jacken", "Kimonos", "Schuhe", "Taschen", "Accessoires"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const CFG = window.FRANKLY_CONFIG;
const $ = id => document.getElementById(id);
let sb = null, ITEMS = [], OWNERS = [], LOOKS = [], RENT = {}, KOMBIS = [], STREET = [], URLS = {}, cat = "Alle";
const SZ = window.FRANKLY_SIZES;
const SEL_KEY = "frankly-groessen";
let SEL = loadSel(), TMP = null, SHOWALL = false;
function loadSel() { try { const v = JSON.parse(localStorage.getItem(SEL_KEY) || "null"); return v && v.oben ? v : null; } catch (e) { return null; } }
function saveSel() { try { localStorage.setItem(SEL_KEY, JSON.stringify(SEL)); } catch (e) {} }

/* ---------- Hilfen ---------- */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function chf(v) { if (v === null || v === undefined || v === "") return "Preis im Laden"; const n = Number(v); return "CHF " + n.toFixed(n % 1 ? 2 : 0); }
function known(v) { return v != null && v !== "" && !/prüfen|unbekannt|\?/i.test(String(v)); }
function clean(v) { return String(v).replace(/\s*\(.*?\)\s*/g, " ").trim(); }
/* Karten zeigen das kleine Vorschaubild (thumbs/…), die Detailansicht das grosse Foto */
function imgUrl(p) { return p ? URLS["thumbs/" + p] || URLS[p] || "" : ""; }
function bigUrl(p) { return p ? URLS[p] || URLS["thumbs/" + p] || "" : ""; }
function imgTag(p, alt, big) { const u = big ? bigUrl(p) : imgUrl(p); return u ? `<img src="${esc(u)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : `<span class="nofoto">${p ? "Foto lädt …" : "Foto folgt"}</span>`; }
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
function franklyPill(it) { return it.owner_id === "OWN-001" ? `<span class="pill fpill">Frankly-Teil</span>` : ""; }
function resText(iso) {
  const d = new Date(iso), wt = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  return `${wt} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}., ${d.getHours()}${d.getMinutes() ? "." + String(d.getMinutes()).padStart(2, "0") : ""} Uhr`;
}
function badge(it) {
  if (it.status === "Reserviert") return `<span class="pill">Reserviert</span>`;
  if (it.status === "Vermietet") return `<span class="pill muted">${esc(rentText(it))}</span>`;
  if (it.stufe === "Lager") return `<span class="pill">Auf Anfrage</span>`;
  if (it.stufe === "Online") return `<span class="pill">Versand durch Owner</span>`;
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
  const F = "id,nr,nr_num,titel,kategorie,unterkategorie,schnitt,farben,muster,groesse,marke,material,zustand,preis,status,owner_id,foto_pfad,stufe,fotos_extra";
  const itemsQ = f => sb.from("items").select(f).in("status", ["Verfügbar", "Reserviert", "Vermietet"]).order("nr_num", { ascending: false });
  sb.rpc("frankly_res_aufraeumen").then(() => {}, () => {}); // abgelaufene Reservationen freigeben (falls 16_reservieren.sql fehlt: egal)
  let [a, b, c] = await Promise.all([
    itemsQ(F + ",cut_pfad,reserviert_bis"),
    sb.from("owners").select("id,profilname,stil,instagram"),
    sb.from("looks").select("id,nr,nr_num,name,style,konzept,foto_pfad,look_items(item_id,position)").order("nr_num", { ascending: false })
  ]);
  if (a.error && /reserviert_bis/.test(a.error.message || "")) a = await itemsQ(F + ",cut_pfad"); // falls 16_reservieren.sql noch fehlt
  if (a.error && /cut_pfad/.test(a.error.message || "")) a = await itemsQ(F); // falls 14_outfit.sql noch fehlt
  if (a.error) throw a.error;
  ITEMS = (a.data || []).map(i => i.status === "Reserviert" && i.reserviert_bis && new Date(i.reserviert_bis) < new Date() ? Object.assign({}, i, { status: "Verfügbar", reserviert_bis: null }) : i);
  OWNERS = b.error ? [] : (b.data || []);
  const ids = new Set(ITEMS.map(i => i.id));
  RENT = {};
  if (ITEMS.some(i => i.status === "Vermietet")) {
    const r = await sb.from("vermietungen").select("item_id,von,bis,zurueck_am").is("zurueck_am", null);
    (r.data || []).forEach(x => { const cur = RENT[x.item_id]; if (!cur || String(x.von) > String(cur.von)) RENT[x.item_id] = x; });
  }
  const fe = await sb.from("fotoecke").select("id,created_at,pfad,teile,name,instagram").order("created_at", { ascending: false }).limit(60);
  STREET = fe.error ? [] : (fe.data || []);
  const kb = await sb.from("kombis").select("item_a,item_b");
  KOMBIS = kb.error ? [] : (kb.data || []);
  LOOKS = (c.error ? [] : (c.data || [])).map(l => Object.assign({}, l, { items: (l.look_items || []).slice().sort((x, y) => x.position - y.position).map(x => x.item_id).filter(id => ids.has(id)) })).filter(l => l.items.length >= 2);
}
/* Fotos erst nach dem Anzeigen holen: zuerst die kleinen Vorschaubilder, wo keines existiert das Original */
async function signPaths(paths) {
  const ok = new Set();
  for (let i = 0; i < paths.length; i += 100) {
    const r = await sb.storage.from(CFG.bucket || "fotos").createSignedUrls(paths.slice(i, i + 100), 60 * 60 * 6);
    (r.data || []).forEach(x => { if (x.signedUrl && x.path) { URLS[x.path] = x.signedUrl; ok.add(x.path); } });
  }
  return ok;
}
async function loadImages() {
  const paths = [...new Set(ITEMS.map(i => i.foto_pfad).concat(LOOKS.map(l => l.foto_pfad)).filter(Boolean))];
  const ok = await signPaths(paths.map(p => "thumbs/" + p));
  const missing = paths.filter(p => !ok.has("thumbs/" + p));
  if (missing.length) await signPaths(missing);
  const cuts = ITEMS.map(i => i.cut_pfad).filter(Boolean); if (cuts.length) await signPaths(cuts);
  const sp = STREET.map(f => f.pfad).filter(Boolean);
  for (let i = 0; i < sp.length; i += 100) {
    const r = await sb.storage.from("fotoecke").createSignedUrls(sp.slice(i, i + 100), 60 * 60 * 6);
    (r.data || []).forEach(x => { if (x.signedUrl && x.path) URLS["fe:" + x.path] = x.signedUrl; });
  }
}
/* Zusatzfotos (Hinten, Etikett, Detail, Mangel): erst beim Öffnen laden */
function extras(it) { return Array.isArray(it.fotos_extra) ? it.fotos_extra : []; }
function galleryHtml(it) {
  const fs = extras(it); if (!fs.length) return "";
  const main = { pfad: it.foto_pfad, art: "Vorne" };
  return `<div class="gal" role="group" aria-label="Weitere Fotos">${[main].concat(fs).map((f, i) => `<button class="galb" type="button" data-gal="${esc(f.pfad)}" aria-pressed="${i === 0}"><span class="galimg" data-galimg="${esc(f.pfad)}">${URLS["thumbs/" + f.pfad] || URLS[f.pfad] ? `<img src="${esc(URLS["thumbs/" + f.pfad] || URLS[f.pfad])}" alt="">` : ""}</span><span>${esc(f.art)}</span></button>`).join("")}</div>`;
}
async function loadExtras(it) {
  const fs = extras(it); if (!fs.length) return;
  const need = fs.map(f => f.pfad).filter(p => !URLS["thumbs/" + p] && !URLS[p]);
  if (need.length) {
    const ok = await signPaths(need.map(p => "thumbs/" + p));
    const miss = need.filter(p => !ok.has("thumbs/" + p)); if (miss.length) await signPaths(miss);
  }
  fs.forEach(f => { const el = panel.querySelector(`[data-galimg="${CSS.escape(f.pfad)}"]`); const u = URLS["thumbs/" + f.pfad] || URLS[f.pfad]; if (el && u && !el.firstChild) el.innerHTML = `<img src="${esc(u)}" alt="">`; });
}
async function showGal(p, btn) {
  panel.querySelectorAll("[data-gal]").forEach(b => b.setAttribute("aria-pressed", b === btn));
  const big = panel.querySelector(".big");
  if (!URLS[p]) { const r = await sb.storage.from(CFG.bucket || "fotos").createSignedUrl(p, 60 * 60 * 6); if (r.data && r.data.signedUrl) URLS[p] = r.data.signedUrl; }
  const u = URLS[p] || URLS["thumbs/" + p];
  if (big && u) big.innerHTML = `<img src="${esc(u)}" alt="">`;
}
async function ensureBig(p) {
  if (!p || URLS[p]) return;
  const r = await sb.storage.from(CFG.bucket || "fotos").createSignedUrl(p, 60 * 60 * 6);
  if (r.data && r.data.signedUrl) { URLS[p] = r.data.signedUrl; const img = panel.querySelector(".big img"); if (img) img.src = URLS[p]; }
}

/* ---------- Stöbern ---------- */
function card(it) {
  return `
    <button class="card" type="button" data-item="${esc(it.nr)}">
      <div class="ph">${imgTag(it.foto_pfad, it.titel)}<span class="tag">${esc(it.nr)}</span></div>
      <div class="meta"><span class="title">${esc(it.titel)}</span><span class="price">${esc(chf(it.preis))}</span></div>
      <div class="line2">${badge(it)}${franklyPill(it)}<span>${esc(known(it.groesse) && SZ.label(it) ? "Gr. " + SZ.label(it) : (it.unterkategorie || it.kategorie || ""))}</span></div>
    </button>`;
}
function renderFilters() {
  const cs = ["Alle"].concat(CATS.filter(c => ITEMS.some(i => i.kategorie === c)));
  $("cats").innerHTML = cs.map(c => `<button class="chip" type="button" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}
function renderGrid() {
  const q = $("q").value.trim().toLowerCase();
  const list = ITEMS.filter(i => (cat === "Alle" || i.kategorie === cat) && (SHOWALL || SZ.matches(i, SEL)) &&
    (!q || [i.nr, i.titel, i.marke, i.farben, i.kategorie, i.unterkategorie, i.groesse, i.material].join(" ").toLowerCase().includes(q)));
  $("grid").innerHTML = !ITEMS.length ? `<p class="empty">Gerade ist nichts online. Komm im Laden vorbei, wir hängen laufend neue Teile auf.</p>`
    : (list.length ? list.map(card).join("") : `<p class="empty">In deiner Grösse ist gerade nichts dabei. Ändere die Grösse oben oder schau bald wieder vorbei.</p>`);
  renderSizeBar(list.length);
}

/* ---------- Grösse wählen ---------- */
function selText(g, arr) { return arr.length ? arr.join(", ") : "alle"; }
function renderSizeBar(n) {
  if (!SEL) { $("sizeBar").hidden = true; return; }
  const all = !SEL.oben.length && !SEL.unten.length && !SEL.schuhe.length;
  const mine = `Oben <b>${esc(selText("oben", SEL.oben))}</b> · Unten <b>${esc(selText("unten", SEL.unten))}</b> · Schuhe <b>${esc(selText("schuhe", SEL.schuhe))}</b>`;
  $("sizeBar").hidden = false;
  $("sizeBar").innerHTML = `<span><b>${n}</b> ${n === 1 ? "Teil" : "Teile"} · ${all || SHOWALL ? "alle Grössen" : mine}</span>
    <span class="rowsmall" style="margin:0">${all ? "" : `<button class="btn" type="button" data-szshow aria-pressed="${SHOWALL}">${SHOWALL ? "Nur meine Grösse" : "Alle Grössen zeigen"}</button>`}<button class="btn ghost" type="button" data-szedit>Grösse ändern</button></span>`;
}
function chipRow(g, opts, hints) {
  return opts.map(v => `<button class="chip szchip" type="button" data-sz="${g}" data-v="${v}" aria-pressed="${TMP[g].includes(v)}"><b>${v}</b>${hints ? `<small>${esc(hints[v])}</small>` : ""}</button>`).join("");
}
function showPicker() {
  TMP = SEL ? { oben: SEL.oben.slice(), unten: SEL.unten.slice(), schuhe: SEL.schuhe.slice() } : { oben: [], unten: [], schuhe: [] };
  $("sizePick").innerHTML = `
    <h2 class="vtitle szt">Deine Grösse</h2>
    <p class="hint">Wähl, was dir passt, gern auch zwei Grössen. Leer lassen heisst: alle Grössen. Unter jeder Grösse steht die passende EU-Grösse und Jeans-Weite.</p>
    <div class="field"><span class="flabel">Oberteile, Kleider, Jacken</span><div class="chips">${chipRow("oben", SZ.LETTERS, SZ.HINT_OBEN)}</div></div>
    <div class="field"><span class="flabel">Hosen &amp; Röcke</span><div class="chips">${chipRow("unten", SZ.LETTERS, SZ.HINT_UNTEN)}</div></div>
    <div class="field"><span class="flabel">Schuhe</span><div class="chips">${chipRow("schuhe", SZ.SHOES)}</div></div>
    <div class="rowsmall"><button class="btn primary big-btn" type="button" data-szgo>Teile zeigen</button><button class="btn ghost" type="button" data-szall>Alle Teile ansehen</button></div>`;
  $("sizePick").hidden = false; $("sizeBar").hidden = true; $("shopTools").hidden = true; $("grid").hidden = true;
}
function applySel(all) {
  SEL = all ? { oben: [], unten: [], schuhe: [] } : TMP; saveSel();
  $("sizePick").hidden = true; $("shopTools").hidden = false; $("grid").hidden = false;
  renderGrid();
  const t = $("shopTools"); if (t && t.scrollIntoView) t.scrollIntoView({ block: "start" });
}
/* Looks aus der Fotoecke: echte Menschen, die Frankly-Teile tragen */
function streetItems(f) {
  const nrs = (String(f.teile || "").toUpperCase().match(/FR-?\d{1,6}/g) || []).map(n => "FR-" + n.replace(/\D/g, "").padStart(6, "0"));
  return [...new Set(nrs)].map(n => ITEMS.find(x => x.nr === n)).filter(Boolean);
}
function streetWho(f) { const ig = f.instagram ? "@" + String(f.instagram).replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "") : ""; return [f.name, ig].filter(Boolean).join(" · "); }
function streetCard(f) {
  const its = streetItems(f), u = URLS["fe:" + f.pfad];
  return `
    <div class="look">
      <button class="card" type="button" data-street="${esc(f.id)}" style="gap:10px">
        <div class="ph">${u ? `<img src="${esc(u)}" alt="Look aus der Fotoecke" loading="lazy" decoding="async">` : `<span class="nofoto">Foto lädt …</span>`}</div>
        ${streetWho(f) ? `<span class="style">${esc(streetWho(f))}</span>` : ""}
      </button>
      ${its.length ? `<div class="thumbs">${its.map(it => `<button class="mini" type="button" data-item="${esc(it.nr)}">${imgUrl(it.foto_pfad) ? `<img src="${esc(imgUrl(it.foto_pfad))}" alt="">` : ""}${esc(it.nr)}</button>`).join("")}</div>` : ""}
    </div>`;
}
function showStreet(id) {
  const f = STREET.find(x => x.id === id); if (!f) return;
  const its = streetItems(f), u = URLS["fe:" + f.pfad], ig = f.instagram ? String(f.instagram).replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "") : "";
  openPanel(`
    <div class="phead"><span class="sub">Look aus der Fotoecke</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <div class="d">
      <div class="big">${u ? `<img src="${esc(u)}" alt="Look aus der Fotoecke">` : ""}</div>
      <div>
        ${f.name ? `<h2 class="dt">${esc(f.name)}</h2>` : ""}
        ${ig ? `<a class="btn" href="https://instagram.com/${esc(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a>` : ""}
        <div class="sec">${its.length ? "Diese Teile trägt sie" : "Die Teile sind schon weg"}</div>
        ${its.length ? `<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${its.map(card).join("")}</div>` : `<p class="hint">Stöbere nach ähnlichen Teilen in deiner Grösse.</p>`}
        <div class="box"><span class="klabel">Fotoecke</span><p class="pline">Probier im Laden, mach dein Foto und teile es mit uns. Dafür gibt es einen Gutschein.</p></div>
      </div>
    </div>`);
}
/* Outfit-Bild (outfit.js): Teile wie ein Outfit angeordnet */
const OF = window.FRANKLY_OUTFIT, COMBO = {};
function lookItems(l) { return l.items.map(id => ITEMS.find(x => x.id === id)).filter(Boolean); }
function lookCombo(l) { const its = lookItems(l), c = (COMBO[l.id] || []).map(id => its.find(x => x.id === id)).filter(Boolean); return c.length ? c : OF.first(its); }
function outfitUrl(it) { return it.cut_pfad && URLS[it.cut_pfad] ? { src: URLS[it.cut_pfad], cut: true } : { src: imgUrl(it.foto_pfad), cut: false }; }
function collage(l) { return OF.html(lookCombo(l), outfitUrl, l.name); }
function lookCard(l, combo) {
  return `
    <div class="look">
      <button class="card" type="button" data-look="${esc(l.id)}" style="gap:10px">
        <div class="ph">${combo ? OF.html(combo, outfitUrl, l.name) : collage(l)}</div>
        <span class="style">${esc(l.style || "")}</span>
        <span class="lname">${esc(l.name)} · ${l.items.length} Teile</span>
      </button>
    </div>`;
}
/* Kombi, in der ein bestimmtes Teil vorkommt (für die Teil-Ansicht / QR-Code) */
function comboWith(l, it) {
  const its = lookItems(l); let c = lookCombo(l);
  for (let i = 0; i < 40 && !c.some(x => x.id === it.id); i++) c = OF.shuffle(its, c);
  return c.some(x => x.id === it.id) ? c : null;
}
function renderLooks() {
  const own = `<h3 class="osec">Looks von Frankly</h3>` + (LOOKS.length ? `<div class="looks">${LOOKS.map(l => lookCard(l)).join("")}</div>` : `<p class="hint">Bald zeigen wir hier, wie du unsere Teile kombinieren kannst.</p>`);
  const street = `<h3 class="osec">Aus der Fotoecke</h3>` + (STREET.length ? `<div class="looks">${STREET.map(streetCard).join("")}</div>` : `<p class="hint">Hier erscheinen bald Fotos von euch. Probier im Laden, mach dein Foto in der Fotoecke und teile es mit uns: Dafür gibt es einen Gutschein.</p>`);
  $("lookGrid").innerHTML = own + street;
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
  const facts = [["Grösse", SZ.label(it) || it.groesse], ["Marke", it.marke], ["Material", it.material], ["Farben", it.farben], ["Muster", it.muster], ["Schnitt", it.schnitt], ["Zustand", it.zustand], ["Kategorie", it.unterkategorie || it.kategorie]].filter(([, v]) => known(v));
  const ls = LOOKS.filter(l => l.items.includes(it.id));
  openPanel(`
    <div class="phead"><span class="sub">Teil</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <div class="d">
      <div><div class="big">${imgTag(it.foto_pfad, it.titel, true)}</div>${galleryHtml(it)}</div>
      <div>
        <div class="nr"><small>Nummer</small>${esc(it.nr)}</div>
        <h2 class="dt">${esc(it.titel)}</h2>
        <div class="statusrow"><span class="sprice">${esc(chf(it.preis))}</span>${badge(it)}${franklyPill(it)}</div>
        ${it.owner_id === "OWN-001" ? `<p class="hint">Frankly-Teil: Hier gilt dein Fotoecke-Gutschein.</p>` : ""}
        ${it.status === "Vermietet" ? `<p class="hint">${RENT[it.id] && RENT[it.id].bis ? `Dieses Teil ist bis ${esc(shortDate(RENT[it.id].bis))} vermietet und danach wieder im Laden.` : "Dieses Teil ist gerade vermietet und bald wieder im Laden."}</p>` : ""}
        ${it.status === "Reserviert" ? `<p class="hint">${it.reserviert_bis ? `Dieses Teil ist bis ${esc(resText(it.reserviert_bis))} reserviert. Danach ist es vielleicht wieder frei.` : "Dieses Teil ist für jemanden reserviert."}</p>` : ""}
        ${it.status === "Verfügbar" && ["Stange", "Reduziert", "Upcycling"].includes(it.stufe || "Stange") ? resBox(it) : ""}
        ${(it.stufe === "Lager" || it.stufe === "Online") && it.status === "Verfügbar" ? anfrageBox(it) : ""}
        ${facts.length ? `<dl class="f">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(clean(v))}</dd>`).join("")}</dl>` : ""}
        ${o ? `<div class="box owner"><span class="klabel">Aus dem Kleiderschrank von</span><button class="linkbtn oname" type="button" data-owner="${esc(o.id)}">${esc(o.profilname)}</button>${o.stil ? `<p class="hint">${esc(o.stil)}</p>` : ""}</div>` : ""}
        ${ls.length ? `<div class="sec">So kannst du es kombinieren</div><div class="looks">${ls.map(l => lookCard(l, comboWith(l, it))).join("")}</div>` : ""}
        ${kombiSection(it)}
        ${(() => { const fs = STREET.filter(f => streetItems(f).some(x => x.id === it.id)); return fs.length ? `<div class="sec">So wurde es getragen</div><div class="thumbs">${fs.map(f => `<button class="mini" type="button" data-street="${esc(f.id)}">${URLS["fe:" + f.pfad] ? `<img src="${esc(URLS["fe:" + f.pfad])}" alt="">` : ""}${esc(f.name || "Look")}</button>`).join("")}</div>` : ""; })()}
        ${visitBox()}
        <div class="rowsmall"><button class="btn" type="button" data-share="${esc(it.nr)}">Link kopieren</button></div>
      </div>
    </div>`);
  ensureBig(it.foto_pfad); loadExtras(it);
}
/* Kombiniere mit: Teile, die im Lager verknüpft wurden */
function kombiSection(it) {
  const ids = [...new Set(LOOKS.filter(l => l.items.includes(it.id)).flatMap(l => l.items).concat(KOMBIS.filter(k => k.item_a === it.id || k.item_b === it.id).map(k => k.item_a === it.id ? k.item_b : k.item_a)))].filter(id => id !== it.id);
  const its = ids.map(id => ITEMS.find(x => x.id === id)).filter(Boolean);
  return its.length ? `<div class="sec">Kombiniere mit</div><div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${its.map(card).join("")}</div>` : "";
}
/* Teile im Laden: online reservieren (bis Ladenschluss des 2. Öffnungstags) */
function resBox(it) {
  return `<div class="box"><span class="klabel">Reservieren</span>
    <p class="pline">Gefällt dir das Teil? Reserviere es und probier es im Laden an. Die Reservation gilt bis Ladenschluss des zweiten Öffnungstags.</p>
    <button class="btn" type="button" id="resOpen">Jetzt reservieren</button>
    <form class="form anfform" id="resForm" data-res="${esc(it.id)}" hidden novalidate>
      <label>Dein Name *<input id="r-name" autocomplete="name" maxlength="120"></label>
      <label>E-Mail oder Telefon *<input id="r-kontakt" autocomplete="email" maxlength="160"></label>
      <label class="hp" aria-hidden="true">Website<input id="r-website" tabindex="-1" autocomplete="off"></label>
      <p class="err" id="r-err" aria-live="polite"></p>
      <button class="btn primary" type="submit" id="r-btn">Reservieren</button>
    </form>
    <p class="lead" id="r-done" hidden></p></div>`;
}
async function sendRes(form) {
  const err = $("r-err"), btn = $("r-btn"); err.textContent = "";
  if ($("r-website").value) return;
  const name = $("r-name").value.trim(), kontakt = $("r-kontakt").value.trim();
  if (!name || kontakt.length < 3) { err.textContent = "Bitte Name und E-Mail oder Telefon angeben."; return; }
  btn.disabled = true; btn.textContent = "Wird reserviert …";
  const { data, error } = await sb.rpc("frankly_reservieren", { p_item: form.dataset.res, p_name: name, p_kontakt: kontakt });
  btn.disabled = false; btn.textContent = "Reservieren";
  if (error) { err.textContent = /fetch|network/i.test(error.message) ? "Keine Verbindung. Bitte nochmals versuchen." : (error.message || "Das hat nicht geklappt."); return; }
  const it = ITEMS.find(x => x.id === form.dataset.res);
  if (it) { it.status = "Reserviert"; it.reserviert_bis = data; renderGrid && renderGrid(); }
  form.hidden = true; $("resOpen").hidden = true;
  const done = $("r-done"); done.hidden = false;
  done.innerHTML = `Reserviert bis <b>${esc(resText(data))}</b>. Komm vorbei: ${esc(SHOP.strasse)}, ${esc(SHOP.plz)}. Sag an der Kasse deinen Namen und die Nummer <b>${esc(it ? it.nr : "")}</b>.`;
}
document.addEventListener("submit", e => { const f = e.target.closest("#resForm"); if (f) { e.preventDefault(); sendRes(f); } });
document.addEventListener("click", e => { if (e.target.closest("#resOpen")) { $("resForm").hidden = false; e.target.closest("#resOpen").hidden = true; $("r-name").focus(); } });
/* Teile im Lager oder auf der Online-Stange: anfragen */
function anfrageBox(it) {
  const online = it.stufe === "Online";
  return `<div class="box"><span class="klabel">${online ? "Versand durch Owner" : "Auf Anfrage"}</span>
    <p class="pline">${online ? "Dieses Teil ist nicht mehr bei uns im Laden, sondern zurück bei der Owner. Schick uns eine Anfrage: Wir prüfen, ob es noch erhältlich ist, und melden uns mit dem Preis inklusive Versand." : "Dieses Teil hängt gerade nicht im Laden, sondern im Lager. Schreib uns, dann legen wir es für deinen Besuch bereit."}</p>
    <form class="form anfform" id="anfForm" data-anf="${esc(it.id)}" novalidate>
      <label>Dein Name *<input id="a-name" autocomplete="name" maxlength="120"></label>
      <label>E-Mail oder Telefon *<input id="a-kontakt" autocomplete="email" maxlength="160"></label>
      <label>${online ? "Nachricht (freiwillig)" : "Wann kommst du vorbei? (freiwillig)"}<input id="a-msg" maxlength="500" placeholder="${online ? "z.B. Lieferadresse in Zürich" : "z.B. Samstag Vormittag"}"></label>
      <label class="hp" aria-hidden="true">Website<input id="a-website" tabindex="-1" autocomplete="off"></label>
      <p class="err" id="a-err" aria-live="polite"></p>
      <button class="btn primary" type="submit" id="a-btn">${online ? "Verfügbarkeit anfragen" : "Anprobe anfragen"}</button>
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
      <div><div class="big">${collage(l)}</div>
        ${OF.count(lookItems(l)) > 1 ? `<div class="okombi"><button class="btn" type="button" data-roll="${esc(l.id)}">Neu kombinieren</button><span class="hint">Andere Kombi aus diesen Teilen</span></div>` : ""}</div>
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
  if (d.gal) return showGal(d.gal, b);
  if (d.sz) { const arr = TMP[d.sz], on = !arr.includes(d.v); if (on) arr.push(d.v); else arr.splice(arr.indexOf(d.v), 1); b.setAttribute("aria-pressed", on); return; }
  if (d.szgo !== undefined) return applySel(false);
  if (d.szall !== undefined) return applySel(true);
  if (d.szedit !== undefined) { SHOWALL = false; return showPicker(); }
  if (d.szshow !== undefined) { SHOWALL = !SHOWALL; return renderGrid(); }
  if (d.item) return showItem(d.item);
  if (d.look) return showLook(d.look);
  if (d.roll) { const l = LOOKS.find(x => x.id === d.roll); if (l) { COMBO[l.id] = OF.shuffle(lookItems(l), lookCombo(l)).map(x => x.id); showLook(l.id); renderLooks(); } return; }
  if (d.street) return showStreet(d.street);
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

/* ---------- Start ---------- */
async function init() {
  renderInfo(); initJoin();
  const h = (location.hash || "").replace("#", "");
  go(HASH[h] || "shop", false);
  if (!window.supabase || !CFG) { $("grid").innerHTML = `<p class="err">Die Seite konnte nicht geladen werden. Bitte neu laden.</p>`; return; }
  // Eigener, login-freier Zugang: liest nie eine gespeicherte Team-Anmeldung
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "frankly-shop" } });
  try {
    await load(); renderFilters(); renderLooks();
    if (SEL) renderGrid(); else showPicker();
    await loadImages(); renderGrid(); renderLooks();
  }
  catch (e) { $("grid").hidden = false; $("grid").innerHTML = `<p class="empty">Die Teile können gerade nicht geladen werden. Bitte versuch es später nochmals.</p>`; }
  const nr = new URLSearchParams(location.search).get("teil");
  if (nr) showItem(nr.toUpperCase());
}
init();
