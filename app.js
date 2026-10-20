/* =========================================================
   0–100 FRANKLY · LAGER  (Version 2: Owner, Phasen, Verkauf, Miete)
   Daten in Supabase: items, looks, look_items, owners, vermietungen,
   preis_verlauf · Fotos im privaten Speicher "fotos".
   ========================================================= */
"use strict";

const CFG = window.FRANKLY_CONFIG;
const BUCKET = CFG.bucket || "fotos";
const SELF = "OWN-001"; // Frankly / eigene Teile: keine Provision, keine Abrechnung
const STATUSES = ["Entwurf", "Verfügbar", "Reserviert", "Verkauft", "Vermietet", "Zurückgegeben", "Gespendet"];
const CLOSED = ["Verkauft", "Zurückgegeben", "Gespendet"];
const STUFEN = ["Stange", "Reduziert", "Upcycling", "Lager"];
const STUFE_TXT = { Stange: "Monat 1 · Stange", Reduziert: "Monat 2 · Reduziert-Stange", Upcycling: "Monat 2 · Upcycling-Stange", Lager: "Monat 3 · Lager, auf Anfrage" };
const IN_SHOP = ["Entwurf", "Verfügbar", "Reserviert", "Vermietet"];
const STYLES = ["EDGY", "FIERCE", "DREAMY", "AGILE"];
const BASE_CATS = ["Oberteile", "Hosen", "Röcke", "Kleider", "Jacken", "Schuhe", "Taschen", "Accessoires"];
const FIELDS = [
  ["kategorie", "Kategorie"], ["unterkategorie", "Unterkategorie"], ["schnitt", "Schnitt"], ["farben", "Farben"],
  ["muster", "Muster"], ["groesse", "Grösse"], ["marke", "Marke"], ["material", "Material"], ["zustand", "Zustand"],
  ["preis", "Preis CHF"], ["standort", "Standort"]
];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const $ = id => document.getElementById(id);
let sb = null;
let ITEMS = [], LOOKS = [], OWNERS = [], RENTALS = [], ANM = [], ANFRAGEN = [], URLS = {};
let cat = "Alle", lastAdded = null, started = false, lastLoad = 0, lastOwner = SELF;

/* ---------- Hilfsfunktionen ---------- */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function isOpen(v) { return v == null || v === "" || /prüfen|unbekannt|nicht geprüft/i.test(String(v)); }
function chf(v) { if (v === null || v === undefined || v === "") return "–"; const n = Number(v); return "CHF " + n.toFixed(n % 1 ? 2 : 0); }
function priceTxt(p) { return (p === null || p === undefined || p === "") ? "Preis offen" : chf(p); }
function round2(n) { return Math.round(n * 100) / 100; }
function share(betrag, prov) { return round2(Number(betrag) * (100 - Number(prov || 0)) / 100); }
function pill(st) {
  const c = st === "Verkauft" || st === "Vermietet" ? "sold" : (st === "Verfügbar" ? "ok" : (st === "Zurückgegeben" || st === "Gespendet" ? "muted" : ""));
  return `<span class="pill ${c}">${esc(st || "Entwurf")}</span>`;
}
function parsePrice(v) { v = String(v == null ? "" : v).trim(); if (!v) return null; const n = Number(v.replace(",", ".").replace(/[^\d.]/g, "")); return isNaN(n) ? null : n; }
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function imgUrl(path) { return path ? URLS[path] || "" : ""; }
function imgTag(path, alt) { const u = imgUrl(path); return u ? `<img src="${esc(u)}" alt="${esc(alt)}" loading="lazy">` : `<span class="nofoto">Foto fehlt</span>`; }
function lookPath(l) { if (l.foto_pfad) return l.foto_pfad; const f = ITEMS.find(x => x.id === l.items[0]); return f ? f.foto_pfad : ""; }
function looksOf(id) { return LOOKS.filter(l => l.items.includes(id)); }
function nice(err) {
  const m = (err && (err.message || err.error_description || err.error)) || String(err);
  if (/Invalid login credentials/i.test(m)) return "E-Mail oder Passwort stimmt nicht.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Keine Verbindung. Prüfe das Internet und versuch es nochmals.";
  if (/JWT expired|session/i.test(m)) return "Deine Anmeldung ist abgelaufen. Bitte neu anmelden.";
  if (/row-level security|permission denied/i.test(m)) return "Keine Berechtigung. Bist du angemeldet?";
  if (/items_owner_fk|foreign key/i.test(m)) return "Diese Person hat noch Teile. Ordne die Teile zuerst jemand anderem zu.";
  if (/column .* does not exist|relation .* does not exist|schema cache/i.test(m)) return "Die Datenbank ist noch nicht aktualisiert. Bitte zuerst 03_owner_phasen.sql in Supabase ausführen.";
  return m;
}
let tt;
function toast(m, ms) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, ms || 2800); }
function busy(btn, on, label) { if (!btn) return; if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || "Speichern …"; btn.disabled = true; } else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; } }
function val(id) { const el = $(id); if (!el) return null; const v = el.value.trim(); return v === "" ? null : v; }

/* ---------- Datum & Phasen ----------
   Eine Phase läuft vom ersten bis zum letzten Samstag eines Monats.
   phase_monat wird als 1. Tag des Monats gespeichert (z.B. 2026-11-01).
   Auszahlung: am letzten Samstag des Monats, in dem verkauft/vermietet wurde. */
const pad = n => String(n).padStart(2, "0");
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseD(s) { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); }
function today() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
function firstSat(y, m) { const d = new Date(y, m, 1); d.setDate(1 + ((6 - d.getDay() + 7) % 7)); return d; }
function lastSat(y, m) { const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); return d; }
function fmt(d) { if (typeof d === "string") d = parseD(d); return d ? `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : ""; }
function monthLabel(s) { const d = parseD(s); return d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "Keine Phase"; }
function monthStart(d) { return iso(new Date(d.getFullYear(), d.getMonth(), 1)); }
function defaultPhase() { const t = today(); return t <= lastSat(t.getFullYear(), t.getMonth()) ? monthStart(t) : monthStart(new Date(t.getFullYear(), t.getMonth() + 1, 1)); }
function nextPhase(s) {
  const t = today(), base = parseD(s) || t;
  let d = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const cur = new Date(t.getFullYear(), t.getMonth(), 1);
  if (d < cur) d = cur;
  if (t > lastSat(d.getFullYear(), d.getMonth())) d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return iso(d);
}
function payoutDate(s) { const d = parseD(s) || today(); const ls = lastSat(d.getFullYear(), d.getMonth()); return d <= ls ? ls : lastSat(d.getFullYear(), d.getMonth() + 1); }
function nextSaturdays(n) { const out = []; const d = today(); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); for (let i = 0; i < n; i++) { out.push(new Date(d)); d.setDate(d.getDate() + 7); } return out; }
function phaseInfo(it) {
  if (!it.phase_monat) return null;
  const m = parseD(it.phase_monat), start = firstSat(m.getFullYear(), m.getMonth()), end = lastSat(m.getFullYear(), m.getMonth()), t = today();
  if (CLOSED.includes(it.status)) return { start, end, state: "done" };
  if (it.entscheid) return { start, end, state: "decided" };
  if (t < start) return { start, end, state: "upcoming" };
  if (t <= end) return { start, end, state: "running", days: Math.round((end - t) / 864e5) };
  return { start, end, state: "due" };
}
function phaseOptions(current) {
  const t = today(), opts = [""];
  for (let i = -1; i <= 3; i++) opts.push(iso(new Date(t.getFullYear(), t.getMonth() + i, 1)));
  if (current && !opts.includes(current.slice(0, 10))) opts.push(current.slice(0, 10));
  return opts.map(o => `<option value="${o}" ${o === (current || "").slice(0, 10) ? "selected" : ""}>${o ? monthLabel(o) + " · " + fmt(firstSat(parseD(o).getFullYear(), parseD(o).getMonth())).slice(3) + " – " + fmt(lastSat(parseD(o).getFullYear(), parseD(o).getMonth())).slice(3) : "Keine Phase"}</option>`).join("");
}

/* ---------- Owner ---------- */
function ownerOf(id) { return OWNERS.find(o => o.id === id); }
function ownerName(id) { const o = ownerOf(id); return o ? o.profilname : (id || "–"); }
function ownerProv(id) { const o = ownerOf(id); return o ? Number(o.provision_prozent) : 10; }
function ownerOptions(sel) { return OWNERS.map(o => `<option value="${esc(o.id)}" ${o.id === sel ? "selected" : ""}>${esc(o.profilname)} · ${esc(o.id)}</option>`).join(""); }
function itemOwner(itemId) { const it = ITEMS.find(x => x.id === itemId); return it ? it.owner_id : null; }
/* ---------- Geld: Verkäufe & Mieten ----------
   Provision = Anteil Frankly (z.B. 10 %). Owner erhält den Rest (z.B. 90 %).
   Bei eigenen Teilen (OWN-001) geht alles an Frankly. */
function saleAmount(i) { return i.verkauf_preis != null ? Number(i.verkauf_preis) : (i.preis != null ? Number(i.preis) : null); }
function saleDate(i) { return i.verkauf_datum || (i.updated_at ? String(i.updated_at).slice(0, 10) : null); }
function itemProv(i) { return i.owner_id === SELF ? 100 : (i.verkauf_provision != null ? Number(i.verkauf_provision) : ownerProv(i.owner_id)); }
/* Alle Buchungen (Verkauf + Miete), optional nur einer Owner */
function allPosts(oid) {
  const posts = [];
  ITEMS.filter(i => i.status === "Verkauft" && (!oid || i.owner_id === oid)).forEach(i => {
    const b = saleAmount(i); if (b == null) return;
    const prov = itemProv(i), anteil = i.owner_id === SELF ? 0 : share(b, prov);
    posts.push({ kind: "item", id: i.id, itemId: i.id, owner: i.owner_id, nr: i.nr, titel: i.titel, art: "Verkauf", betrag: b, prov,
      anteil, frankly: round2(b - anteil), datum: saleDate(i), paid: i.ausbezahlt_am || null, missingPrice: i.verkauf_preis == null });
  });
  RENTALS.forEach(r => {
    const it = ITEMS.find(x => x.id === r.item_id); if (!it) return;
    if (oid && it.owner_id !== oid) return;
    const prov = it.owner_id === SELF ? 100 : Number(r.provision_prozent), b = Number(r.betrag), anteil = it.owner_id === SELF ? 0 : share(b, prov);
    posts.push({ kind: "rental", id: r.id, itemId: it.id, owner: it.owner_id, nr: it.nr, titel: it.titel, art: "Miete", betrag: b, prov,
      anteil, frankly: round2(b - anteil), datum: r.von, paid: r.ausbezahlt_am || null });
  });
  return posts.sort((a, b) => String(b.datum || "").localeCompare(String(a.datum || "")));
}
function openPosts(oid) { return oid === SELF ? [] : allPosts(oid).filter(p => !p.paid); }
function sum(arr, k) { return round2(arr.reduce((s, p) => s + (Number(p[k]) || 0), 0)); }
function ownerStats(oid) {
  const its = ITEMS.filter(i => i.owner_id === oid), posts = allPosts(oid);
  return {
    total: its.length,
    shop: its.filter(i => IN_SHOP.includes(i.status)).length,
    sold: its.filter(i => i.status === "Verkauft").length,
    due: its.filter(i => { const p = phaseInfo(i); return p && p.state === "due"; }).length,
    earned: sum(posts, "anteil"),
    paid: sum(posts.filter(p => p.paid), "anteil"),
    open: sum(posts.filter(p => !p.paid), "anteil")
  };
}
function splitLabel(o) { const p = Number(o.provision_prozent); return `${100 - p} % Owner · ${p} % Frankly`; }

/* ---------- Start & Anmeldung ---------- */
function show(which) { $("boot").hidden = which !== "boot"; $("login").hidden = which !== "login"; $("app").hidden = which !== "app"; }

async function init() {
  if (!window.supabase || !CFG) { $("boot").innerHTML = `<p class="err">Die App konnte nicht geladen werden. Seite neu laden.</p>`; return; }
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") { started = false; ITEMS = []; LOOKS = []; OWNERS = []; RENTALS = []; URLS = {}; show("login"); }
    else if (session && !started) setTimeout(startApp, 0); // nicht direkt im Auth-Callback laden
  });
  const { data } = await sb.auth.getSession();
  if (data && data.session) startApp(); else show("login");
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("loginBtn"); $("loginErr").textContent = "";
  const email = $("email").value.trim(), password = $("password").value;
  if (!email || !password) { $("loginErr").textContent = "Bitte E-Mail und Passwort eingeben."; return; }
  busy(btn, true, "Anmelden …");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  busy(btn, false);
  if (error) $("loginErr").textContent = nice(error);
});

async function startApp() {
  if (started) return; started = true;
  show("app");
  $("grid").innerHTML = `<p class="loading">Teile werden geladen …</p>`;
  try { await load(); renderAll(); }
  catch (err) { started = false; $("grid").innerHTML = `<p class="err">${esc(nice(err))}</p>`; }
}

/* ---------- Daten laden ---------- */
async function load() {
  const [a, b, c, d] = await Promise.all([
    sb.from("items").select("*").order("nr_num"),
    sb.from("looks").select("*, look_items(item_id, position)").order("nr_num"),
    sb.from("owners").select("*").order("id"),
    sb.from("vermietungen").select("*").order("von")
  ]);
  for (const r of [a, b, c, d]) if (r.error) throw r.error;
  ITEMS = a.data || [];
  LOOKS = (b.data || []).map(l => Object.assign({}, l, { items: (l.look_items || []).slice().sort((x, y) => x.position - y.position).map(x => x.item_id) }));
  OWNERS = c.data || [];
  RENTALS = d.data || [];
  await signUrls(ITEMS.map(i => i.foto_pfad).concat(LOOKS.map(l => l.foto_pfad)));
  const an = await sb.from("anmeldungen").select("*").order("created_at", { ascending: false });
  ANM = an.error ? [] : (an.data || []);
  const af = await sb.from("anfragen").select("*").order("created_at", { ascending: false });
  ANFRAGEN = af.error ? [] : (af.data || []);
  const ap = [...new Set(ANM.flatMap(a => a.vermieten_fotos || []))].filter(p => !URLS["anm:" + p]);
  for (let i = 0; i < ap.length; i += 100) {
    const r = await sb.storage.from("anmeldungen").createSignedUrls(ap.slice(i, i + 100), 60 * 60 * 12);
    (r.data || []).forEach(x => { if (x.signedUrl && x.path) URLS["anm:" + x.path] = x.signedUrl; });
  }
  lastLoad = Date.now();
}
async function signUrls(paths) {
  const todo = [...new Set(paths.filter(p => p && !URLS[p]))];
  for (let i = 0; i < todo.length; i += 100) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(todo.slice(i, i + 100), 60 * 60 * 12);
    if (error) throw error;
    (data || []).forEach(x => { if (x.signedUrl && x.path) URLS[x.path] = x.signedUrl; });
  }
}

/* Fotos verkleinern (max. 1600 px) */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error("Foto konnte nicht verarbeitet werden.")), "image/jpeg", 0.84);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Dieses Bild konnte nicht gelesen werden. Bitte JPG, PNG oder HEIC wählen.")); };
    img.src = url;
  });
}
async function uploadPhoto(path, blob) {
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  URLS[path] = URL.createObjectURL(blob);
}
async function removePhoto(path) {
  if (!path || !(path.startsWith("items/") || path.startsWith("looks-neu/"))) return; // Originale aus dem Starterpaket bleiben
  await sb.storage.from(BUCKET).remove([path]);
}

/* ---------- Übersicht Teile ---------- */
function matchesStatus(it, f) {
  if (!f || f === "alle") return true;
  if (f === "laden") return IN_SHOP.includes(it.status);
  if (f === "faellig") { const p = phaseInfo(it); return p && p.state === "due"; }
  if (f === "anfrage") return openAnfragen(it.id).length > 0;
  if (f.startsWith("stufe:")) return it.stufe === f.slice(6) && !CLOSED.includes(it.status);
  return it.status === f;
}
function renderCats() {
  const cs = ["Alle"].concat([...new Set(ITEMS.map(i => i.kategorie).filter(Boolean))]);
  if (!cs.includes(cat)) cat = "Alle";
  $("cats").innerHTML = cs.map(c => `<button class="chip" type="button" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  const due = ITEMS.filter(i => { const p = phaseInfo(i); return p && p.state === "due"; }).length;
  const o = $("fstat").querySelector('option[value="faellig"]'); if (o) o.textContent = `Entscheid fällig (${due})`;
  const oa = $("fstat").querySelector('option[value="anfrage"]'); if (oa) oa.textContent = `Anfrage offen (${ANFRAGEN.filter(a => !a.erledigt).length})`;
}
function itemCard(it) {
  const p = phaseInfo(it);
  const flag = (p && p.state === "due" ? `<span class="flag">Entscheid fällig</span>` : "") + (openAnfragen(it.id).length ? `<span class="flag">Anfrage</span>` : "");
  const st = it.stufe && it.stufe !== "Stange" && !CLOSED.includes(it.status) ? `<span class="pill">${esc(it.stufe)}</span>` : "";
  const own = it.owner_id && it.owner_id !== SELF ? `<span>· ${esc(ownerName(it.owner_id))}</span>` : "";
  return `
    <button class="card" type="button" data-item="${esc(it.id)}">
      <div class="ph ${CLOSED.includes(it.status) ? "dim" : ""}">${imgTag(it.foto_pfad, it.titel)}<span class="tag ${it.id === lastAdded ? "new" : ""}">${esc(it.nr)}</span></div>
      <div class="meta"><span class="title">${esc(it.titel)}</span><span class="price ${it.preis == null ? "open" : ""}">${esc(priceTxt(it.preis))}</span></div>
      <div class="line2">${pill(it.status)}${st}${flag}<span>${esc(it.unterkategorie || it.kategorie || "")}</span>${own}</div>
    </button>`;
}
function renderGrid() {
  const q = $("q").value.trim().toLowerCase(), f = $("fstat").value;
  const list = ITEMS.filter(it => (cat === "Alle" || it.kategorie === cat) && matchesStatus(it, f) &&
    (!q || [it.nr, it.titel, it.marke, it.farben, it.kategorie, it.unterkategorie, it.notiz, it.groesse, ownerName(it.owner_id), it.owner_id].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => a.nr_num - b.nr_num);
  $("cntItems").textContent = ITEMS.length;
  $("cntLooks").textContent = LOOKS.length;
  $("cntOwners").textContent = OWNERS.length;
  const g = $("grid");
  if (!ITEMS.length) { g.innerHTML = `<p class="empty">Noch keine Teile. Tippe oben auf «+ Teil erfassen».</p>`; return; }
  if (!list.length) { g.innerHTML = `<p class="empty">Keine Teile gefunden. Suche oder Filter anpassen.</p>`; return; }
  g.innerHTML = list.map(itemCard).join("");
}
function renderLooks() {
  const lg = $("lookGrid");
  if (!LOOKS.length) { lg.innerHTML = `<p class="empty">Noch keine Looks. Tippe auf «+ Look erstellen».</p>`; return; }
  lg.innerHTML = LOOKS.map(l => `
    <div class="look">
      <button class="card" type="button" data-look="${esc(l.id)}" style="gap:10px">
        <div class="ph">${imgTag(lookPath(l), l.name)}<span class="tag">${esc(l.nr)}</span></div>
        <span class="style">${esc(l.style || "")}</span>
        <span class="lname">${esc(l.name)}</span>
      </button>
      <div class="thumbs">${l.items.map(id => { const it = ITEMS.find(x => x.id === id); return it ? `<button class="mini" type="button" data-item="${esc(id)}">${imgUrl(it.foto_pfad) ? `<img src="${esc(imgUrl(it.foto_pfad))}" alt="">` : ""}${esc(it.nr)}</button>` : ""; }).join("")}</div>
    </div>`).join("");
}
function renderOwners() {
  const og = $("ownerGrid");
  if (!OWNERS.length) { og.innerHTML = `<p class="empty">Noch keine Owner. Bitte zuerst 03_owner_phasen.sql in Supabase ausführen.</p>`; return; }
  og.innerHTML = OWNERS.map(o => {
    const s = ownerStats(o.id);
    return `
    <button class="ocard" type="button" data-owner="${esc(o.id)}">
      <div class="otop"><span class="oid">${esc(o.id)}</span>${o.id === SELF ? `<span class="pill">Eigene Teile</span>` : `<span class="pill">${esc(100 - Number(o.provision_prozent))} / ${esc(Number(o.provision_prozent))}</span>`}</div>
      <span class="oname">${esc(o.profilname)}</span>
      <div class="ostats">
        <span><b>${s.shop}</b> im Laden</span><span><b>${s.sold}</b> verkauft</span>
        ${o.id !== SELF ? `<span><b>${esc(chf(s.earned))}</b> verdient</span><span class="${s.open > 0 ? "warn" : ""}"><b>${esc(chf(s.open))}</b> offen</span>` : `<span><b>${esc(chf(franklyTotals("all").total))}</b> Einnahmen</span>`}
        ${s.due ? `<span class="warn"><b>${s.due}</b> Entscheid fällig</span>` : ""}
      </div>
    </button>`;
  }).join("");
}
function renderAll() {
  renderCats(); renderGrid(); renderLooks(); renderOwners(); renderAnm();
  $("foot").textContent = `0–100 Frankly · ${ITEMS.length} Teile · ${LOOKS.length} Looks · ${OWNERS.length} Owner`;
}
function setTab(t) {
  ["items", "looks", "owners", "anm"].forEach(x => { $("tab-" + x).setAttribute("aria-selected", t === x); });
  $("viewAnm").hidden = t !== "anm";
  $("viewItems").hidden = t !== "items";
  $("viewLooks").hidden = t !== "looks";
  $("viewOwners").hidden = t !== "owners";
}

/* ---------- Seitenpanel ---------- */
const ov = $("ov"), panel = $("panel");
let lastFocus = null, panelState = null;
function openPanel(html, state) {
  if (ov.hidden) lastFocus = document.activeElement;
  panelState = state || null;
  panel.innerHTML = html; ov.hidden = false; document.body.style.overflow = "hidden"; panel.scrollTop = 0;
  const c = panel.querySelector(".close"); if (c) c.focus({ preventScroll: true });
}
function closePanel() { ov.hidden = true; panel.innerHTML = ""; panelState = null; document.body.style.overflow = ""; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
function refreshPanel() { if (!panelState) return; if (panelState.type === "item") showItem(panelState.id); else if (panelState.type === "owner") showOwner(panelState.id); else if (panelState.type === "anm") showAnm(panelState.id); }
ov.addEventListener("click", e => { if (e.target === ov) closePanel(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !ov.hidden) closePanel(); });

/* ---------- Teil anzeigen ---------- */
function statusActions(it) {
  const s = it.status, p = phaseInfo(it), out = [];
  if (["Entwurf", "Verfügbar", "Reserviert"].includes(s)) {
    out.push(`<button class="btn primary" type="button" data-act="sell">Verkauft …</button>`);
    out.push(s === "Reserviert" ? `<button class="btn" type="button" data-act="setstatus" data-v="Verfügbar">Reservierung aufheben</button>` : `<button class="btn" type="button" data-act="setstatus" data-v="Reserviert">Reservieren</button>`);
    out.push(`<button class="btn" type="button" data-act="rent">Vermieten …</button>`);
    if (s === "Entwurf") out.push(`<button class="btn" type="button" data-act="setstatus" data-v="Verfügbar">Verfügbar machen</button>`);
  }
  if (s === "Vermietet") out.push(`<button class="btn primary" type="button" data-act="returned">Zurück erhalten</button>`);
  if (s === "Verkauft" && !it.ausbezahlt_am) out.push(`<button class="btn danger" type="button" data-act="unsell">Verkauf rückgängig</button>`);
  if (s === "Zurückgegeben" || s === "Gespendet") out.push(`<button class="btn" type="button" data-act="setstatus" data-v="Verfügbar">Wieder im Laden</button>`);
  return out.join("");
}
function openAnfragen(id) { return ANFRAGEN.filter(a => a.item_id === id && !a.erledigt); }
function phaseBlock(it) {
  const p = phaseInfo(it);
  if (!p) return "";
  const stufe = it.stufe || "Stange", stTxt = STUFE_TXT[stufe] || stufe;
  let line = "", acts = "";
  const range = `${fmt(p.start)} – ${fmt(p.end)}`;
  if (p.state === "upcoming") line = `${esc(stTxt)} · Runde ${monthLabel(it.phase_monat)} startet am ${fmt(p.start)}.`;
  if (p.state === "running") line = `${esc(stTxt)} · Runde ${monthLabel(it.phase_monat)} läuft bis ${fmt(p.end)} · noch ${p.days} ${p.days === 1 ? "Tag" : "Tage"}.`;
  if (p.state === "done") line = `${esc(stTxt)} · Runde ${monthLabel(it.phase_monat)} (${range}) abgeschlossen.`;
  if (p.state === "due") line = `<b class="warn">Entscheid fällig.</b> ${esc(stTxt)} · Runde ${monthLabel(it.phase_monat)} ist am ${fmt(p.end)} zu Ende gegangen. Die Owner kann auch selbst online entscheiden.`;
  if (p.state === "decided") {
    const d = it.entscheid_datum ? ` am ${fmt(it.entscheid_datum)}` : "";
    const von = it.entscheid_von === "Owner" ? ` <span class="hint">(online von der Owner)</span>` : "";
    line = `Entscheid: <b>${esc(it.entscheid)}</b>${d}.${it.entscheid_notiz ? " " + esc(it.entscheid_notiz) + "." : ""}${von}`;
    const doneTxt = { "Zurücknehmen": "Abgeholt", "Upcycling": "Upcycling fertig", "Spenden": "Gespendet" }[it.entscheid] || "Erledigt";
    acts = `<button class="btn primary" type="button" data-act="done">${doneTxt}</button><button class="btn" type="button" data-act="undecide">Entscheid ändern</button>`;
  }
  if (p.state === "due" || p.state === "running") {
    if (stufe === "Stange") acts = `<button class="btn" type="button" data-act="lower">Preis senken …</button><button class="btn" type="button" data-act="upcycle">Upcycling …</button><button class="btn" type="button" data-act="takeback">Zurücknehmen …</button>`;
    else if (stufe === "Lager") acts = `<button class="btn" type="button" data-act="takeback">Zurücknehmen …</button><button class="btn" type="button" data-act="donate">Spenden</button>`;
    else acts = `<button class="btn" type="button" data-act="tolager">Ins Lager</button><button class="btn" type="button" data-act="takeback">Zurücknehmen …</button><button class="btn" type="button" data-act="donate">Spenden</button>`;
  }
    return `<div class="box ${p.state === "due" ? "alert" : ""}"><div class="sec" style="margin:0 0 6px">Runde</div><p class="pline">${line}</p>${acts ? `<div class="rowsmall">${acts}</div>` : ""}</div>`;
}
function anfrageBlock(it) {
  const as = ANFRAGEN.filter(a => a.item_id === it.id);
  if (!as.length) return "";
  return `<div class="box ${as.some(a => !a.erledigt) ? "alert" : ""}"><div class="sec" style="margin:0 0 6px">Anfragen</div>
    <ul class="rlist">${as.map(a => `<li><span>${esc(String(a.created_at).slice(0, 10).split("-").reverse().join("."))}</span><span><b>${esc(a.name)}</b> · ${esc(a.kontakt)}${a.nachricht ? `<br><span class="hint">${esc(a.nachricht)}</span>` : ""}</span><span>${a.erledigt ? `<span class="hint">erledigt</span>` : `<button class="btn" type="button" data-anfdone="${esc(a.id)}">Erledigt</button>`}</span></li>`).join("")}</ul></div>`;
}
function saleBlock(it) {
  if (it.status !== "Verkauft") return "";
  const prov = it.verkauf_provision != null ? Number(it.verkauf_provision) : ownerProv(it.owner_id);
  const self = it.owner_id === SELF;
  return `<div class="box"><div class="sec" style="margin:0 0 6px">Verkauf</div>
    <dl class="f compact"><dt>Verkauft am</dt><dd>${esc(fmt(it.verkauf_datum) || "–")}</dd><dt>Verkaufspreis</dt><dd>${esc(chf(saleAmount(it)))}</dd>
    ${self ? "" : `<dt>An ${esc(ownerName(it.owner_id))}</dt><dd>${esc(chf(share(saleAmount(it), prov)))} <span class="hint">(${100 - prov} %)</span></dd><dt>Ausbezahlt</dt><dd>${it.ausbezahlt_am ? esc(fmt(it.ausbezahlt_am)) : `<span class="warn">offen</span>`}</dd>`}</dl></div>`;
}
function rentalBlock(it) {
  const rs = RENTALS.filter(r => r.item_id === it.id).sort((a, b) => String(b.von).localeCompare(String(a.von)));
  if (!rs.length) return "";
  return `<div class="box"><div class="sec" style="margin:0 0 6px">Vermietungen</div>
    <ul class="rlist">${rs.map(r => `<li><span>${esc(fmt(r.von))}${r.bis ? " – " + esc(fmt(r.bis)) : ""}</span><span>${esc(chf(r.betrag))}</span><span class="hint">${r.zurueck_am ? "zurück " + esc(fmt(r.zurueck_am)) : "unterwegs"}${it.owner_id !== SELF ? (r.ausbezahlt_am ? " · ausbezahlt" : " · Anteil offen") : ""}</span></li>`).join("")}</ul></div>`;
}
function showItem(id, editing) {
  const it = ITEMS.find(x => x.id === id); if (!it) return closePanel();
  if (editing) return showItemEdit(id);
  const ls = looksOf(id);
  const v = k => {
    const x = it[k];
    if (k === "preis") return `<span class="${x == null ? "warn" : ""}">${esc(priceTxt(x))}</span>`;
    if (x == null || x === "") return `<span class="warn">offen</span>`;
    return `<span class="${isOpen(x) ? "warn" : ""}">${esc(x)}</span>`;
  };
  openPanel(`
    <div class="phead"><span class="sub">Teil</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <div class="d">
      <div>
        <div class="big">${imgTag(it.foto_pfad, it.titel)}</div>
        <div class="rowsmall">
          <label class="btn" for="rep-lib">Foto ersetzen</label>
          <input id="rep-lib" type="file" accept="image/*" hidden>
        </div>
      </div>
      <div>
        <div class="nr"><small>Anzeigenummer</small>${esc(it.nr)}</div>
        <h2 class="dt">${esc(it.titel)}</h2>
        <p class="desc">${esc(it.notiz || "")}</p>
        <div class="statusrow">${pill(it.status)}<span class="price">${esc(priceTxt(it.preis))}</span></div>
        <div class="rowsmall">${statusActions(it)}</div>
        <div id="act"></div>
        ${anfrageBlock(it)}
        ${phaseBlock(it)}
        ${saleBlock(it)}
        ${rentalBlock(it)}
        <dl class="f">
          <dt>Owner</dt><dd><button class="linkbtn" type="button" data-owner="${esc(it.owner_id)}">${esc(ownerName(it.owner_id))} · ${esc(it.owner_id)}</button></dd>
          <dt>Runde</dt><dd>${esc(monthLabel(it.phase_monat))}</dd>
          <dt>Stufe</dt><dd>${esc(STUFE_TXT[it.stufe || "Stange"] || it.stufe)}</dd>
          ${FIELDS.map(([k, l]) => `<dt>${l}</dt><dd>${v(k)}</dd>`).join("")}
        </dl>
        <div class="row">
          <button class="btn" type="button" data-edit="${esc(id)}">Bearbeiten</button>
          <button class="btn danger" type="button" data-del="${esc(id)}">Löschen</button>
        </div>
        <div class="sec">In Looks</div>
        ${ls.length ? `<div class="thumbs">${ls.map(l => `<button class="mini" type="button" data-look="${esc(l.id)}">${esc(l.style || "")} · ${esc(l.name)}</button>`).join("")}</div>` : `<p class="hint">Noch in keinem Look.</p>`}
        <div class="tech">Feste ID (ändert sich nie, auch wenn die Anzeigenummer wechselt):<br>${esc(it.id)}</div>
      </div>
    </div>`, { type: "item", id });
  const rep = $("rep-lib");
  rep.addEventListener("change", () => { if (rep.files[0]) replacePhoto(id, rep.files[0]); });
}

function showItemEdit(id) {
  const it = ITEMS.find(x => x.id === id); if (!it) return;
  const cats = [...new Set(BASE_CATS.concat(ITEMS.map(i => i.kategorie).filter(Boolean)))];
  const inp = k => {
    const x = it[k];
    if (k === "kategorie") return `<select id="e-${k}">${cats.map(c => `<option ${c === x ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>`;
    return `<input id="e-${k}" value="${esc(x == null ? "" : x)}" ${k === "preis" ? 'inputmode="decimal"' : ""}>`;
  };
  openPanel(`
    <div class="phead"><span class="sub">Teil bearbeiten</span><button class="btn ghost close" type="button" data-view="${esc(id)}">Abbrechen ✕</button></div>
    <div class="d">
      <div class="big">${imgTag(it.foto_pfad, it.titel)}</div>
      <div>
        <div class="nr"><small>Anzeigenummer</small>${esc(it.nr)}</div>
        <label class="sec" for="e-titel">Titel</label><input id="e-titel" class="search" style="width:100%" value="${esc(it.titel)}">
        <label class="sec" for="e-notiz">Beschreibung</label><textarea id="e-notiz" class="search" style="width:100%" rows="3">${esc(it.notiz || "")}</textarea>
        <dl class="f">
          <dt>Owner</dt><dd><select id="e-owner_id">${ownerOptions(it.owner_id)}</select></dd>
          <dt>Runde</dt><dd><select id="e-phase_monat">${phaseOptions(it.phase_monat)}</select></dd>
          <dt>Stufe</dt><dd><select id="e-stufe">${STUFEN.map(x => `<option value="${x}" ${x === (it.stufe || "Stange") ? "selected" : ""}>${esc(STUFE_TXT[x])}</option>`).join("")}</select></dd>
          <dt>Status</dt><dd><select id="e-status">${STATUSES.map(s => `<option ${s === (it.status || "Entwurf") ? "selected" : ""}>${s}</option>`).join("")}</select></dd>
          ${FIELDS.map(([k, l]) => `<dt>${l}</dt><dd>${inp(k)}</dd>`).join("")}
        </dl>
        <div class="row"><button class="btn primary" type="button" data-save="${esc(id)}">Speichern</button><button class="btn" type="button" data-view="${esc(id)}">Abbrechen</button></div>
      </div>
    </div>`, { type: "itemedit", id });
}

async function patchItem(id, patch, msg) {
  const { data, error } = await sb.from("items").update(patch).eq("id", id).select().single();
  if (error) { toast(nice(error), 4500); return null; }
  ITEMS = ITEMS.map(x => x.id === id ? data : x);
  renderAll(); if (msg) toast(msg);
  return data;
}
async function saveEdit(id, btn) {
  const patch = {};
  ["titel", "notiz", "owner_id", "phase_monat", "stufe", "status"].concat(FIELDS.map(f => f[0])).forEach(k => {
    const el = $("e-" + k); if (!el) return;
    let v = el.value.trim();
    if (k === "preis") v = parsePrice(v); else if (v === "") v = null;
    patch[k] = v;
  });
  if (!patch.titel) { toast("Der Titel darf nicht leer sein."); return; }
  if (!patch.owner_id) patch.owner_id = SELF;
  if (!patch.stufe) patch.stufe = "Stange";
  const old = ITEMS.find(x => x.id === id) || {};
  if (patch.status === "Verkauft" && old.status !== "Verkauft") {
    patch.verkauf_preis = old.verkauf_preis != null ? old.verkauf_preis : patch.preis;
    patch.verkauf_datum = old.verkauf_datum || iso(today());
    patch.verkauf_provision = ownerProv(patch.owner_id);
  }
  if (patch.status !== "Verkauft" && old.status === "Verkauft" && !old.ausbezahlt_am) {
    Object.assign(patch, { verkauf_preis: null, verkauf_datum: null, verkauf_provision: null });
  }
  busy(btn, true);
  const ok = await patchItem(id, patch, "Gespeichert");
  busy(btn, false);
  if (ok) showItem(id);
}
async function replacePhoto(id, file) {
  const it = ITEMS.find(x => x.id === id); if (!it) return;
  toast("Foto wird hochgeladen …", 10000);
  try {
    const blob = await resizeImage(file);
    const path = `items/${id}-${Date.now()}.jpg`;
    await uploadPhoto(path, blob);
    const { data, error } = await sb.from("items").update({ foto_pfad: path }).eq("id", id).select().single();
    if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
    await removePhoto(it.foto_pfad).catch(() => {});
    ITEMS = ITEMS.map(x => x.id === id ? data : x);
    renderAll(); showItem(id); toast("Foto ersetzt");
  } catch (err) { toast(nice(err), 4500); }
}

/* Zwei-Tipp-Bestätigung für heikle Knöpfe */
const armed = new Map();
function confirmTap(btn, key, label) {
  if (armed.get(key)) { armed.delete(key); return true; }
  armed.set(key, true); const orig = btn.textContent; btn.textContent = label || "Sicher? Nochmals tippen";
  setTimeout(() => { if (armed.get(key)) { armed.delete(key); if (btn.isConnected) btn.textContent = orig; } }, 4000);
  return false;
}
async function deleteItem(id, btn) {
  if (!confirmTap(btn, "del" + id, "Wirklich löschen? Nochmals tippen")) return;
  const it = ITEMS.find(x => x.id === id);
  busy(btn, true, "Löschen …");
  const { error } = await sb.from("items").delete().eq("id", id);
  if (error) { busy(btn, false); toast(nice(error), 4000); return; }
  await removePhoto(it && it.foto_pfad).catch(() => {});
  ITEMS = ITEMS.filter(x => x.id !== id);
  RENTALS = RENTALS.filter(r => r.item_id !== id);
  LOOKS = LOOKS.map(l => Object.assign({}, l, { items: l.items.filter(x => x !== id) }));
  closePanel(); renderAll(); toast((it ? it.nr : "Teil") + " gelöscht");
}

/* ---------- Schnellaktionen am Teil ---------- */
function actForm(html) { const a = $("act"); if (a) { a.innerHTML = `<form class="box actform" id="actForm" novalidate>${html}</form>`; a.scrollIntoView({ block: "nearest" }); const f = a.querySelector("input,select"); if (f) f.focus({ preventScroll: true }); } }
function satOptions() { return nextSaturdays(8).map(d => `<option value="${iso(d)}">${fmt(d)}</option>`).join(""); }

function openAction(kind, it) {
  const prov = ownerProv(it.owner_id), self = it.owner_id === SELF;
  if (kind === "sell") {
    actForm(`<div class="sec" style="margin:0">Verkauf erfassen</div>
      <div class="two"><label>Verkaufspreis CHF<input id="a-preis" inputmode="decimal" value="${esc(it.preis ?? "")}"></label>
      <label>Datum<input id="a-datum" type="date" value="${iso(today())}"></label></div>
      ${self ? "" : `<p class="hint" id="a-info"></p>`}
      <div class="rowsmall"><button class="btn primary" type="submit">Als verkauft speichern</button><button class="btn ghost" type="button" data-act="cancel">Abbrechen</button></div>`);
    const upd = () => { const i = $("a-info"); if (!i) return; const p = parsePrice($("a-preis").value); i.textContent = p == null ? "" : `An ${ownerName(it.owner_id)}: ${chf(share(p, prov))} (${100 - prov} %) · Frankly: ${chf(round2(p - share(p, prov)))} (${prov} %)`; };
    $("a-preis").addEventListener("input", upd); $("a-datum").addEventListener("input", upd); upd();
    $("actForm").onsubmit = async e => {
      e.preventDefault(); const p = parsePrice($("a-preis").value);
      if (p == null) return toast("Bitte den Verkaufspreis eingeben.");
      const btn = e.submitter; busy(btn, true);
      const ok = await patchItem(it.id, { status: "Verkauft", verkauf_preis: p, verkauf_datum: $("a-datum").value || iso(today()), verkauf_provision: prov, ausbezahlt_am: null }, `${it.nr} verkauft`);
      busy(btn, false); if (ok) showItem(it.id);
    };
  }
  if (kind === "rent") {
    actForm(`<div class="sec" style="margin:0">Vermietung erfassen</div>
      <div class="two"><label>Mietbetrag CHF<input id="a-betrag" inputmode="decimal"></label><label>Von<input id="a-von" type="date" value="${iso(today())}"></label></div>
      <label>Bis (geplante Rückgabe)<input id="a-bis" type="date"></label>
      ${self ? "" : `<p class="hint">Die Miete wird ${100 - prov}/${prov} geteilt und am letzten Samstag des Monats ausbezahlt.</p>`}
      <div class="rowsmall"><button class="btn primary" type="submit">Vermietung speichern</button><button class="btn ghost" type="button" data-act="cancel">Abbrechen</button></div>`);
    $("actForm").onsubmit = async e => {
      e.preventDefault(); const b = parsePrice($("a-betrag").value);
      if (b == null) return toast("Bitte den Mietbetrag eingeben.");
      const btn = e.submitter; busy(btn, true);
      const { data, error } = await sb.from("vermietungen").insert({ item_id: it.id, betrag: b, von: $("a-von").value || iso(today()), bis: $("a-bis").value || null, provision_prozent: prov }).select().single();
      if (error) { busy(btn, false); return toast(nice(error), 4500); }
      RENTALS.push(data);
      const ok = await patchItem(it.id, { status: "Vermietet" }, `${it.nr} vermietet`);
      busy(btn, false); if (ok) showItem(it.id);
    };
  }
  if (kind === "lower") {
    actForm(`<div class="sec" style="margin:0">Preis senken</div>
      <div class="two"><label>Neuer Preis CHF<input id="a-preis" inputmode="decimal" placeholder="${esc(it.preis ?? "")}"></label>
      <label>Nächste Runde<select id="a-phase">${phaseOptions(nextPhase(it.phase_monat))}</select></label></div>
      <p class="hint">Bisher ${esc(priceTxt(it.preis))}. Das Teil kommt an die Reduziert-Stange und startet in die nächste Runde.</p>
      <div class="rowsmall"><button class="btn primary" type="submit">Preis senken</button><button class="btn ghost" type="button" data-act="cancel">Abbrechen</button></div>`);
    $("actForm").onsubmit = async e => {
      e.preventDefault(); const p = parsePrice($("a-preis").value);
      if (p == null) return toast("Bitte den neuen Preis eingeben.");
      if (it.preis != null && p >= Number(it.preis)) return toast("Der neue Preis muss tiefer sein als der bisherige.");
      const btn = e.submitter; busy(btn, true);
      const ok = await patchItem(it.id, { preis: p, stufe: "Reduziert", phase_monat: $("a-phase").value || null, entscheid: null, entscheid_datum: null, entscheid_notiz: null, entscheid_von: "Team", status: it.status === "Entwurf" ? "Entwurf" : "Verfügbar" }, `Neuer Preis ${chf(p)} · Reduziert-Stange`);
      busy(btn, false); if (ok) showItem(it.id);
    };
  }
  if (kind === "upcycle") {
    actForm(`<div class="sec" style="margin:0">Upcycling</div>
      <div class="two"><label>Wer<select id="a-wer"><option>Selbst upcyceln</option><option>Upcycling-Team im Josy</option></select></label><label>Termin<input id="a-datum" type="date" value="${iso(nextSaturdays(1)[0])}"></label></div>
      <label>Notiz (Uhrzeit, Idee)<input id="a-notiz" placeholder="z.B. 14 Uhr"></label>
      <p class="hint">Wenn das Upcycling fertig ist, auf «Upcycling fertig» tippen. Dann hängt das Teil einen Monat an der Upcycling-Stange.</p>
      <div class="rowsmall"><button class="btn primary" type="submit">Termin speichern</button><button class="btn ghost" type="button" data-act="cancel">Abbrechen</button></div>`);
    $("actForm").onsubmit = async e => {
      e.preventDefault(); if ($("a-wer").value === "Selbst upcyceln" && !$("a-datum").value) return toast("Bitte ein Datum wählen.");
      const btn = e.submitter; busy(btn, true);
      const wer = $("a-wer").value, notiz = [wer, val("a-notiz")].filter(Boolean).join(" · ");
      const ok = await patchItem(it.id, { entscheid: "Upcycling", entscheid_datum: $("a-datum").value || null, entscheid_notiz: notiz, entscheid_von: "Team" }, "Upcycling gespeichert");
      busy(btn, false); if (ok) showItem(it.id);
    };
  }
  if (kind === "takeback") {
    actForm(`<div class="sec" style="margin:0">Zurücknehmen · Abholung am Samstag</div>
      <label>Abhol-Samstag<select id="a-datum">${satOptions()}</select></label>
      <div class="rowsmall"><button class="btn primary" type="submit">Abholung speichern</button><button class="btn ghost" type="button" data-act="cancel">Abbrechen</button></div>`);
    $("actForm").onsubmit = async e => {
      e.preventDefault(); const btn = e.submitter; busy(btn, true);
      const ok = await patchItem(it.id, { entscheid: "Zurücknehmen", entscheid_datum: $("a-datum").value, entscheid_von: "Team" }, "Abholung gespeichert");
      busy(btn, false); if (ok) showItem(it.id);
    };
  }
}

async function runAct(kind, btn) {
  const id = panelState && panelState.id, it = ITEMS.find(x => x.id === id); if (!it) return;
  if (kind === "cancel") { const a = $("act"); if (a) a.innerHTML = ""; return; }
  if (["sell", "rent", "lower", "upcycle", "takeback"].includes(kind)) return openAction(kind, it);
  if (kind === "setstatus") { busy(btn, true); const ok = await patchItem(id, { status: btn.dataset.v }, `${it.nr}: ${btn.dataset.v}`); if (ok) showItem(id); else busy(btn, false); return; }
  if (kind === "returned") {
    busy(btn, true);
    const open = RENTALS.filter(r => r.item_id === id && !r.zurueck_am);
    for (const r of open) {
      const { data, error } = await sb.from("vermietungen").update({ zurueck_am: iso(today()) }).eq("id", r.id).select().single();
      if (error) { busy(btn, false); return toast(nice(error), 4500); }
      RENTALS = RENTALS.map(x => x.id === r.id ? data : x);
    }
    const ok = await patchItem(id, { status: "Verfügbar" }, `${it.nr} ist zurück`); if (ok) showItem(id); else busy(btn, false); return;
  }
  if (kind === "unsell") {
    if (!confirmTap(btn, "unsell" + id, "Verkauf wirklich rückgängig? Nochmals tippen")) return;
    busy(btn, true);
    const ok = await patchItem(id, { status: "Verfügbar", verkauf_preis: null, verkauf_datum: null, verkauf_provision: null, ausbezahlt_am: null }, "Verkauf rückgängig gemacht"); if (ok) showItem(id); else busy(btn, false); return;
  }
  if (kind === "undecide") { busy(btn, true); const ok = await patchItem(id, { entscheid: null, entscheid_datum: null, entscheid_notiz: null, entscheid_von: null }, "Entscheid zurückgesetzt"); if (ok) showItem(id); else busy(btn, false); return; }
  if (kind === "tolager") {
    busy(btn, true);
    const ok = await patchItem(id, { stufe: "Lager", phase_monat: nextPhase(it.phase_monat), entscheid: null, entscheid_datum: null, entscheid_notiz: null, entscheid_von: "Team" }, `${it.nr} ist im Lager · online «Auf Anfrage»`); if (ok) showItem(id); else busy(btn, false); return;
  }
  if (kind === "donate") {
    if (!confirmTap(btn, "donate" + id, "Wirklich spenden? Nochmals tippen")) return;
    busy(btn, true);
    const ok = await patchItem(id, { entscheid: "Spenden", entscheid_datum: null, entscheid_notiz: null, entscheid_von: "Team" }, "Wird gespendet"); if (ok) showItem(id); else busy(btn, false); return;
  }
  if (kind === "done") {
    busy(btn, true);
    let patch = { status: "Zurückgegeben" }, msg = `${it.nr} abgeholt`;
    if (it.entscheid === "Upcycling") { patch = { stufe: "Upcycling", phase_monat: nextPhase(it.phase_monat), entscheid: null, entscheid_datum: null, entscheid_notiz: null, status: "Verfügbar" }; msg = `${it.nr} hängt jetzt an der Upcycling-Stange. Preis bei Bedarf unter «Bearbeiten» anpassen.`; }
    if (it.entscheid === "Spenden") { patch = { status: "Gespendet" }; msg = `${it.nr} gespendet`; }
    const ok = await patchItem(id, patch, msg); if (ok) showItem(id); else busy(btn, false); return;
  }
}

/* ---------- Owner ---------- */
function postTable(posts, cols) {
  if (!posts.length) return `<p class="hint">Noch keine Verkäufe oder Mieten.</p>`;
  const head = { datum: "Datum", teil: "Teil", owner: "Owner", art: "Art", betrag: "Betrag", anteil: "An Owner", frankly: "Frankly", status: "Status" };
  const cell = (p, c) => {
    if (c === "datum") return esc(p.datum ? fmt(p.datum).slice(3) : "–");
    if (c === "teil") return `<button class="linkbtn" type="button" data-item="${esc(p.itemId)}">${esc(p.nr || "")}</button> ${esc(p.titel || "")}${p.missingPrice ? ` <span class="hint">(Listenpreis)</span>` : ""}`;
    if (c === "owner") return `<button class="linkbtn" type="button" data-owner="${esc(p.owner)}">${esc(ownerName(p.owner))}</button>`;
    if (c === "art") return p.art;
    if (c === "betrag") return esc(chf(p.betrag));
    if (c === "anteil") return `<b>${esc(chf(p.anteil))}</b>`;
    if (c === "frankly") return `<b>${esc(chf(p.frankly))}</b>`;
    if (c === "status") return p.paid ? `ausbezahlt ${esc(fmt(p.paid).slice(3, 9))}` : `<span class="warn">offen</span>`;
  };
  return `<div class="tablewrap"><table class="tbl"><thead><tr>${cols.map(c => `<th>${head[c]}</th>`).join("")}</tr></thead>
    <tbody>${posts.map(p => `<tr>${cols.map(c => `<td>${cell(p, c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
/* Einnahmen Frankly: eigene Verkäufe (100 %) + Provisionen von Owners */
let fPeriod = "month";
function inPeriod(p, period) {
  if (period === "all") return true;
  const d = parseD(p.datum), t = today();
  return d && d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth();
}
function franklyTotals(period) {
  const posts = allPosts().filter(p => inPeriod(p, period));
  const own = posts.filter(p => p.owner === SELF), prov = posts.filter(p => p.owner !== SELF);
  return { own, prov, ownSum: sum(own, "frankly"), provSum: sum(prov, "frankly"), total: round2(sum(own, "frankly") + sum(prov, "frankly")), owed: sum(prov.filter(p => !p.paid), "anteil") };
}
function franklyBlock() {
  const t = franklyTotals(fPeriod), mLabel = MONTHS[today().getMonth()] + " " + today().getFullYear();
  const byOwner = {};
  t.prov.forEach(p => { const o = byOwner[p.owner] = byOwner[p.owner] || { umsatz: 0, frankly: 0, offen: 0, n: 0 }; o.umsatz += p.betrag; o.frankly += p.frankly; o.n++; if (!p.paid) o.offen += p.anteil; });
  const rows = Object.keys(byOwner).sort().map(id => { const o = byOwner[id]; return `<tr><td><button class="linkbtn" type="button" data-owner="${esc(id)}">${esc(ownerName(id))}</button></td><td>${o.n}</td><td>${esc(chf(round2(o.umsatz)))}</td><td><b>${esc(chf(round2(o.frankly)))}</b></td><td class="${o.offen > 0 ? "warn" : ""}">${esc(chf(round2(o.offen)))}</td></tr>`; }).join("");
  return `
    <div class="periodsw" role="group" aria-label="Zeitraum">
      <button class="chip" type="button" data-period="month" aria-pressed="${fPeriod === "month"}">${esc(mLabel)}</button>
      <button class="chip" type="button" data-period="all" aria-pressed="${fPeriod === "all"}">Gesamt</button>
    </div>
    <div class="kpis">
      <div class="kpi"><span class="klabel">Eigene Teile · 100 %</span><span class="kval">${esc(chf(t.ownSum))}</span><span class="hint">${t.own.length} Verkäufe/Mieten</span></div>
      <div class="kpi"><span class="klabel">Provision von Owners</span><span class="kval">${esc(chf(t.provSum))}</span><span class="hint">${t.prov.length} Verkäufe/Mieten</span></div>
      <div class="kpi strong"><span class="klabel">Total Frankly</span><span class="kval">${esc(chf(t.total))}</span><span class="hint">An Owners noch offen: ${esc(chf(t.owed))}</span></div>
    </div>
    <div class="sec">Provision nach Owner</div>
    ${rows ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Owner</th><th>Anzahl</th><th>Umsatz</th><th>Frankly</th><th>An Owner offen</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="hint">In diesem Zeitraum noch keine Verkäufe von Owners.</p>`}
    <div class="sec">Detail Provisionen</div>
    ${postTable(t.prov, ["datum", "teil", "owner", "art", "betrag", "frankly", "anteil"])}
    <div class="sec">Detail eigene Verkäufe & Mieten</div>
    ${postTable(t.own, ["datum", "teil", "art", "betrag"])}`;
}
function showOwner(oid) {
  const o = ownerOf(oid); if (!o) return closePanel();
  const s = ownerStats(oid), its = ITEMS.filter(i => i.owner_id === oid).sort((a, b) => a.nr_num - b.nr_num);
  const self = oid === SELF, posts = self ? [] : allPosts(oid);
  openPanel(`
    <div class="phead"><span class="sub">Owner</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <div class="nr"><small>Owner</small>${esc(o.id)}</div>
    <h2 class="dt">${esc(o.profilname)}</h2>
    <p class="desc">${esc(o.stil || "")}</p>
    <div class="ostats lg"><span><b>${s.total}</b> Teile</span><span><b>${s.shop}</b> im Laden</span><span><b>${s.sold}</b> verkauft</span>${s.due ? `<span class="warn"><b>${s.due}</b> Entscheid fällig</span>` : ""}</div>
    ${self ? `<div class="box"><div class="sec" style="margin:0 0 8px">Einnahmen Frankly</div><div id="fblock">${franklyBlock()}</div></div>` : `
    <div class="box ${s.open > 0 ? "alert" : ""}">
      <div class="sec" style="margin:0 0 8px">Abrechnung · ${esc(splitLabel(o))}</div>
      <div class="kpis">
        <div class="kpi"><span class="klabel">Verdient bisher</span><span class="kval">${esc(chf(s.earned))}</span><span class="hint">${posts.length} Verkäufe/Mieten</span></div>
        <div class="kpi"><span class="klabel">Ausbezahlt</span><span class="kval">${esc(chf(s.paid))}</span></div>
        <div class="kpi ${s.open > 0 ? "strong" : ""}"><span class="klabel">Schulde ich ihr</span><span class="kval">${esc(chf(s.open))}</span></div>
      </div>
      ${postTable(posts, ["datum", "teil", "art", "betrag", "anteil", "frankly", "status"])}
      ${s.open > 0 ? `<div class="rowsmall"><button class="btn primary" type="button" data-payout="${esc(oid)}">${esc(chf(s.open))} als ausbezahlt markieren</button></div>` : ""}
    </div>`}
    ${self ? "" : linkBox(o)}
    <dl class="f">
      ${self ? "" : `<dt>Aufteilung</dt><dd>${esc(splitLabel(o))}</dd>`}
      <dt>Voller Name</dt><dd>${esc(o.voller_name || "–")}</dd>
      <dt>E-Mail</dt><dd>${esc(o.email || "–")}</dd>
      <dt>Telefon</dt><dd>${esc(o.telefon || "–")}</dd>
      <dt>Instagram</dt><dd>${esc(o.instagram || "–")}</dd>
      <dt>Öffentlich</dt><dd>${o.oeffentlich ? "Ja, Profil darf gezeigt werden" : "Nein"}</dd>
      <dt>Vereinbarung</dt><dd>${esc(fmt(o.vereinbarung_datum) || "–")}</dd>
      <dt>Notiz</dt><dd>${esc(o.notiz || "–")}</dd>
    </dl>
    <div class="row"><button class="btn" type="button" data-oedit="${esc(oid)}">Bearbeiten</button>${self ? "" : `<button class="btn danger" type="button" data-odel="${esc(oid)}">Löschen</button>`}</div>
    <div class="sec">Teile von ${esc(o.profilname)}</div>
    ${its.length ? `<div class="grid">${its.map(itemCard).join("")}</div>` : `<p class="hint">Noch keine Teile.</p>`}
  `, { type: "owner", id: oid });
}
/* Persönlicher Link für den Owner-Bereich (owner.html) */
function ownerLink(o) { return o && o.zugang_token ? new URL("owner.html?k=" + o.zugang_token, location.href).toString() : ""; }
function linkBox(o) {
  const url = ownerLink(o);
  if (!url) return `<div class="box"><div class="sec" style="margin:0 0 6px">Mein Frankly</div><p class="hint">Für den persönlichen Link bitte zuerst 06_owner_bereich.sql in Supabase ausführen.</p></div>`;
  return `<div class="box"><div class="sec" style="margin:0 0 6px">Mein Frankly · persönlicher Link</div>
    <p class="hint">Mit diesem Link sieht ${esc(o.profilname)} ihre Teile, ihr Guthaben und entscheidet nach jeder Runde selbst. Kein Passwort nötig, darum nur ihr schicken.</p>
    <input class="search linkfield" id="olink" readonly value="${esc(url)}" aria-label="Persönlicher Link">
    <div class="rowsmall"><button class="btn primary" type="button" data-olink="${esc(o.id)}">Link kopieren</button><button class="btn" type="button" data-omail="${esc(o.id)}">Per E-Mail senden</button><button class="btn ghost" type="button" data-otoken="${esc(o.id)}">Neuen Link erstellen</button></div></div>`;
}
function ownerMail(o) {
  if (!o.email) return toast("Für diese Person ist keine E-Mail gespeichert. Link kopieren und z.B. per WhatsApp schicken.", 5000);
  const name = (o.voller_name || o.profilname || "").split(" ")[0];
  mailTo(o.email, "Dein persönlicher Link: Mein Frankly", `Hallo ${name}\n\nhier ist dein persönlicher Link zu «Mein Frankly»:\n${ownerLink(o)}\n\nDort siehst du jederzeit, wie es deinen Teilen geht, was du verdient hast und wann ausbezahlt wird. Nach jeder Runde kannst du dort selbst entscheiden, wie es weitergeht.\n\nBitte gib den Link nicht weiter, er ist nur für dich.` + GRUSS);
}
async function newToken(oid, btn) {
  if (!confirmTap(btn, "tok" + oid, "Alter Link funktioniert dann nicht mehr. Nochmals tippen")) return;
  busy(btn, true, "Wird erstellt …");
  const { data, error } = await sb.from("owners").update({ zugang_token: uuid() }).eq("id", oid).select().single();
  busy(btn, false);
  if (error) return toast(nice(error), 4500);
  OWNERS = OWNERS.map(x => x.id === oid ? data : x); showOwner(oid); toast("Neuer Link erstellt. Der alte gilt nicht mehr.");
}
async function anfrageDone(id, btn) {
  busy(btn, true);
  const { data, error } = await sb.from("anfragen").update({ erledigt: true }).eq("id", id).select().single();
  if (error) { busy(btn, false); return toast(nice(error), 4500); }
  ANFRAGEN = ANFRAGEN.map(a => a.id === id ? data : a); renderAll(); refreshPanel(); toast("Anfrage erledigt");
}
function ownerForm(o) {
  o = o || {};
  const isNew = !o.id;
  openPanel(`
    <div class="phead"><span class="sub">${isNew ? "Neuer Owner" : "Owner bearbeiten"}</span><button class="btn ghost close" type="button" ${isNew ? "data-close" : `data-owner="${esc(o.id)}"`}>Abbrechen ✕</button></div>
    <form class="form" id="ownerForm" novalidate>
      ${isNew ? `<div class="next"><div class="nr"><small>Owner-Nummer</small>wird vergeben</div><span class="hint" style="max-width:24ch">z.B. OWN-002. Du musst nichts eintippen.</span></div>` : `<div class="nr"><small>Owner</small>${esc(o.id)}</div>`}
      <div class="sec" style="margin:4px 0 0">Profil · kann später öffentlich sein</div>
      <label>Profilname *<input id="o-profilname" value="${esc(o.profilname || "")}" placeholder="z.B. Mira oder ein Alias"></label>
      <label>Stil<input id="o-stil" value="${esc(o.stil || "")}" placeholder="z.B. edgy, viel Schwarz, Vintage-Denim"></label>
      <label>Instagram<input id="o-instagram" value="${esc(o.instagram || "")}" placeholder="@name (freiwillig)"></label>
      <label class="check"><input id="o-oeffentlich" type="checkbox" ${o.oeffentlich ? "checked" : ""}> Profil darf öffentlich gezeigt werden (Zustimmung der Person)</label>
      <div class="sec" style="margin:8px 0 0">Intern · nie öffentlich</div>
      <label>Voller Name<input id="o-voller_name" value="${esc(o.voller_name || "")}"></label>
      <div class="two"><label>E-Mail<input id="o-email" type="email" value="${esc(o.email || "")}"></label><label>Telefon<input id="o-telefon" type="tel" value="${esc(o.telefon || "")}"></label></div>
      <div class="two"><label>Anteil Frankly %<input id="o-provision_prozent" inputmode="decimal" value="${esc(o.provision_prozent ?? 10)}"></label><label>Vereinbarung vom<input id="o-vereinbarung_datum" type="date" value="${esc(o.vereinbarung_datum || "")}"></label></div>
      <label>Notiz<textarea id="o-notiz" rows="2">${esc(o.notiz || "")}</textarea></label>
      <p class="hint">Anteil Frankly = deine Provision. Bei 10 % erhält die Owner 90 % jedes Verkaufs und jeder Miete. Bankdaten (IBAN) bitte nicht hier speichern, sondern im E-Banking.</p>
      <div class="row" style="margin-top:0"><button class="btn primary" type="submit">${isNew ? "Owner anlegen" : "Speichern"}</button></div>
    </form>`, { type: "ownerform", id: o.id });
  $("ownerForm").addEventListener("submit", async e => {
    e.preventDefault();
    const row = { profilname: val("o-profilname"), stil: val("o-stil"), instagram: val("o-instagram"), oeffentlich: $("o-oeffentlich").checked,
      voller_name: val("o-voller_name"), email: val("o-email"), telefon: val("o-telefon"), vereinbarung_datum: val("o-vereinbarung_datum"), notiz: val("o-notiz") };
    const prov = parsePrice($("o-provision_prozent").value);
    row.provision_prozent = prov == null ? 10 : Math.min(100, prov);
    if (!row.profilname) return toast("Bitte einen Profilnamen eingeben.");
    const btn = e.submitter; busy(btn, true);
    const q = isNew ? sb.from("owners").insert(row).select().single() : sb.from("owners").update(row).eq("id", o.id).select().single();
    const { data, error } = await q;
    busy(btn, false);
    if (error) return toast(nice(error), 4500);
    OWNERS = isNew ? OWNERS.concat(data).sort((a, b) => a.id.localeCompare(b.id)) : OWNERS.map(x => x.id === data.id ? data : x);
    renderAll(); showOwner(data.id); toast(isNew ? `${data.id} angelegt` : "Gespeichert");
  });
}
async function payout(oid, btn) {
  const posts = openPosts(oid);
  if (!posts.length) return;
  const total = round2(posts.reduce((a, p) => a + p.anteil, 0));
  if (!confirmTap(btn, "pay" + oid, `${chf(total)} an ${ownerName(oid)} ausbezahlt? Nochmals tippen`)) return;
  busy(btn, true, "Wird gespeichert …");
  const d = iso(today());
  const itemIds = posts.filter(p => p.kind === "item").map(p => p.id), rentIds = posts.filter(p => p.kind === "rental").map(p => p.id);
  if (itemIds.length) {
    const { data, error } = await sb.from("items").update({ ausbezahlt_am: d }).in("id", itemIds).select();
    if (error) { busy(btn, false); return toast(nice(error), 4500); }
    (data || []).forEach(n => { ITEMS = ITEMS.map(x => x.id === n.id ? n : x); });
  }
  if (rentIds.length) {
    const { data, error } = await sb.from("vermietungen").update({ ausbezahlt_am: d }).in("id", rentIds).select();
    if (error) { busy(btn, false); return toast(nice(error), 4500); }
    (data || []).forEach(n => { RENTALS = RENTALS.map(x => x.id === n.id ? n : x); });
  }
  renderAll(); showOwner(oid); toast(`${chf(total)} als ausbezahlt markiert`);
}
async function deleteOwner(oid, btn) {
  if (ITEMS.some(i => i.owner_id === oid)) return toast("Diese Person hat noch Teile. Ordne die Teile zuerst jemand anderem zu.", 4500);
  if (!confirmTap(btn, "odel" + oid, "Wirklich löschen? Nochmals tippen")) return;
  busy(btn, true, "Löschen …");
  const { error } = await sb.from("owners").delete().eq("id", oid);
  if (error) { busy(btn, false); return toast(nice(error), 4500); }
  OWNERS = OWNERS.filter(o => o.id !== oid);
  closePanel(); renderAll(); toast(`${oid} gelöscht`);
}


/* ---------- Anmeldungen (Owner werden) ---------- */
const SHOP_ADR = "Neue Hard 10, 8005 Zürich";
function anmName(a) { return [a.vorname, a.nachname].filter(Boolean).join(" "); }
function anmStile(a) { return a.stil_frankly ? [a.stil_frankly] : (a.stile || []); }
function anmPill(a) {
  const c = a.status === "Angenommen" ? "ok" : (a.status === "Absage" ? "muted" : (a.status === "Neu" ? "sold" : ""));
  return `<span class="pill ${c}">${esc(a.status)}${a.status === "Angenommen" && a.status_monat ? " · " + esc(monthLabel(a.status_monat)) : ""}</span>`;
}
function monthsAhead(n) { const t = today(), out = []; for (let i = 0; i < n; i++) out.push(iso(new Date(t.getFullYear(), t.getMonth() + i, 1))); return out; }
function countBy(arr) { const m = {}; arr.forEach(x => { if (x) m[x] = (m[x] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }
function renderAnm() {
  const neu = ANM.filter(a => a.status === "Neu").length;
  $("cntAnm").textContent = neu ? neu + " neu" : ANM.length;
  $("mplan").innerHTML = monthsAhead(4).map(m => {
    const acc = ANM.filter(a => a.status === "Angenommen" && a.status_monat && a.status_monat.slice(0, 10) === m);
    const wish = ANM.filter(a => (a.status === "Neu" || a.status === "Warteliste") && a.wunsch_monat && a.wunsch_monat.slice(0, 10) === m).length;
    const teile = acc.reduce((s, a) => s + (a.anzahl_teile || 0), 0);
    const stile = countBy(acc.flatMap(anmStile)), oben = countBy(acc.flatMap(a => (a.groesse_oben || "").split("/"))), unten = countBy(acc.flatMap(a => (a.groesse_unten || "").split("/")));
    const fmtC = arr => arr.length ? arr.map(([k, n]) => `${n}× ${esc(k)}`).join(" · ") : "–";
    return `<div class="mcard">
      <div class="mtop"><span class="oname">${esc(monthLabel(m))}</span><span class="hint">${esc(fmt(firstSat(parseD(m).getFullYear(), parseD(m).getMonth())).slice(3, 9))}–${esc(fmt(lastSat(parseD(m).getFullYear(), parseD(m).getMonth())).slice(3, 9))}</span></div>
      <div class="ostats"><span><b>${acc.length}</b> Owner</span><span><b>${teile}</b> Teile</span>${acc.some(a => a.vermieten) ? `<span><b>${acc.filter(a => a.vermieten).length}</b> mit Vermieten</span>` : ""}</div>
      <dl class="f compact"><dt>Stile</dt><dd>${fmtC(stile)}</dd><dt>Oberteile</dt><dd>${fmtC(oben)}</dd><dt>Unterteile</dt><dd>${fmtC(unten)}</dd></dl>
      ${wish ? `<p class="hint">${wish} weitere ${wish === 1 ? "Anmeldung wünscht" : "Anmeldungen wünschen"} diesen Monat.</p>` : ""}
    </div>`;
  }).join("");
  const f = $("fanm").value;
  const list = ANM.filter(a => f === "alle" ? true : f === "offen" ? a.status === "Neu" : f === "vermieten" ? a.vermieten : a.status === f);
  $("anmList").innerHTML = list.length ? list.map(a => `
    <button class="acard" type="button" data-anm="${esc(a.id)}">
      <div class="otop"><span class="oname">${esc(anmName(a))}</span>${anmPill(a)}</div>
      <div class="ostats">
        <span>${esc(fmt(a.created_at.slice(0, 10)).slice(3))}</span>
        <span>Wunsch: <b>${esc(a.wunsch_monat ? monthLabel(a.wunsch_monat) : "egal")}</b></span>
        <span><b>${a.anzahl_teile || "?"}</b> Teile</span>
        <span>Oben <b>${esc(a.groesse_oben || "–")}</b> · Unten <b>${esc(a.groesse_unten || "–")}</b>${a.schuhgroesse ? ` · Schuhe <b>${esc(a.schuhgroesse)}</b>` : ""}</span>
      </div>
      <div class="line2">${(a.stile || []).map(s => `<span class="pill">${esc(s)}</span>`).join("")}${a.vermieten ? `<span class="flag">Vermieten · ${(a.vermieten_fotos || []).length} Fotos</span>` : ""}</div>
    </button>`).join("") : `<p class="empty">${f === "offen" ? "Keine neuen Anmeldungen." : "Keine Anmeldungen in dieser Ansicht."}</p>`;
}
function showAnm(id) {
  const a = ANM.find(x => x.id === id); if (!a) return closePanel();
  const fotos = (a.vermieten_fotos || []).map(p => URLS["anm:" + p]).filter(Boolean);
  openPanel(`
    <div class="phead"><span class="sub">Anmeldung</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <h2 class="dt">${esc(anmName(a))}</h2>
    <div class="statusrow">${anmPill(a)}<span class="hint">eingegangen ${esc(fmt(a.created_at.slice(0, 10)))}</span></div>
    <dl class="f">
      <dt>E-Mail</dt><dd>${esc(a.email)}</dd>
      <dt>Telefon</dt><dd>${esc(a.telefon || "–")}</dd>
      <dt>Instagram</dt><dd>${esc(a.instagram || "–")}</dd>
      <dt>Wunschmonat</dt><dd>${esc(a.wunsch_monat ? monthLabel(a.wunsch_monat) : "egal")}</dd>
      <dt>Anzahl Teile</dt><dd>${esc(a.anzahl_teile || "–")}</dd>
      <dt>Was dabei ist</dt><dd>${esc((a.kategorien || []).join(", ") || "–")}</dd>
      <dt>Grösse oben</dt><dd>${esc(a.groesse_oben || "–")}</dd>
      <dt>Grösse unten</dt><dd>${esc(a.groesse_unten || "–")}</dd>
      <dt>Schuhe</dt><dd>${esc(a.schuhgroesse || "keine")}</dd>
      <dt>Stil (ihre Wahl)</dt><dd>${(a.stile || []).map(s => `<span class="pill">${esc(s)}</span>`).join(" ") || "–"}</dd>
      <dt>Stil (deine Einschätzung)</dt><dd><select id="a-stil"><option value="">wie ihre Wahl</option>${STYLES.map(s => `<option ${s === a.stil_frankly ? "selected" : ""}>${s}</option>`).join("")}</select></dd>
      ${a.nachricht ? `<dt>Nachricht</dt><dd>${esc(a.nachricht)}</dd>` : ""}
    </dl>
    ${a.vermieten ? `<div class="box ${a.vermieten_ok == null ? "alert" : ""}">
      <div class="sec" style="margin:0 0 6px">Vermieten · Abendkleider & Statement Pieces ${a.vermieten_ok == null ? "· Antwort innert 24 h" : (a.vermieten_ok ? "· zugesagt" : "· abgesagt")}</div>
      ${a.vermieten_text ? `<p class="pline">${esc(a.vermieten_text)}</p>` : ""}
      <div class="afotos">${fotos.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Vermiet-Teil"></a>`).join("") || `<p class="hint">Keine Fotos.</p>`}</div>
      <div class="rowsmall"><button class="btn" type="button" data-aact="rent-yes">Vermieten zusagen …</button><button class="btn" type="button" data-aact="rent-no">Vermieten absagen …</button></div>
    </div>` : ""}
    <div class="sec">Entscheid</div>
    <div class="rowsmall">
      <button class="btn primary" type="button" data-aact="accept">Annehmen …</button>
      <button class="btn" type="button" data-aact="wait">Warteliste …</button>
      <button class="btn danger" type="button" data-aact="reject">Absage …</button>
      ${a.status === "Angenommen" && !a.owner_id ? `<button class="btn" type="button" data-aact="mkowner">Als Owner anlegen</button>` : ""}
      ${a.owner_id ? `<button class="linkbtn" type="button" data-owner="${esc(a.owner_id)}">Owner ${esc(a.owner_id)} ansehen</button>` : ""}
    </div>
    <div id="act"></div>
    ${a.status_grund ? `<div class="box"><div class="sec" style="margin:0 0 6px">Letzte Nachricht</div><p class="pline">${esc(a.status_grund)}</p></div>` : ""}
    <div class="row"><button class="btn danger" type="button" data-aact="delete">Anmeldung löschen</button></div>
  `, { type: "anm", id });
  $("a-stil").addEventListener("change", async () => {
    const r = await sb.from("anmeldungen").update({ stil_frankly: $("a-stil").value || null }).eq("id", id).select().single();
    if (r.error) return toast(nice(r.error), 4500);
    ANM = ANM.map(x => x.id === id ? r.data : x); renderAnm(); toast("Stil gespeichert");
  });
}
function mailTo(to, subject, body) {
  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}
const GRUSS = "\n\nLiebe Grüsse\nYesim · 0–100 Frankly";
function anmMail(kind, a, monat, text) {
  const hi = `Hallo ${a.vorname}\n\n`;
  if (kind === "accept") {
    const m = parseD(monat), fs = firstSat(m.getFullYear(), m.getMonth()), ls = lastSat(m.getFullYear(), m.getMonth());
    return ["Du bist dabei bei 0–100 Frankly", hi + `schön, dass du mitmachst! Du bist für ${monthLabel(monat)} dabei. Die Runde läuft vom ${fmt(fs)} bis ${fmt(ls)}.\n\nBitte bring deine Teile (maximal 10) vor Rundenbeginn vorbei:\n${SHOP_ADR}\n\n` + (text ? text + "\n\n" : "") + `Von jedem Verkauf bekommst du 90 %, ausbezahlt am Ende der Runde.` + GRUSS];
  }
  if (kind === "wait") return ["Deine Anmeldung bei 0–100 Frankly", hi + `danke für deine Anmeldung bei 0–100 Frankly! ${monat ? `Für ${monthLabel(monat)} sind wir leider schon voll. ` : ""}Wir haben dich auf die Warteliste gesetzt und melden uns, sobald ein Platz frei wird.\n\n` + (text || "") + GRUSS];
  if (kind === "reject") return ["Deine Anmeldung bei 0–100 Frankly", hi + `vielen Dank für dein Interesse an 0–100 Frankly und für deine Anmeldung. Leider können wir dich diesmal nicht aufnehmen.\n\n` + (text || "") + GRUSS];
  if (kind === "rent-yes") return ["Vermieten bei 0–100 Frankly: Zusage", hi + `gute Nachrichten: Wir nehmen deine Teile gerne zum Vermieten auf! Von jeder Miete bekommst du 90 %.\n\n` + (text || "") + GRUSS];
  if (kind === "rent-no") return ["Vermieten bei 0–100 Frankly", hi + `danke für deine Fotos! Leider passen deine Teile diesmal nicht in unser Vermiet-Angebot.\n\n` + (text || "") + GRUSS];
}
async function patchAnm(id, patch, msg) {
  const r = await sb.from("anmeldungen").update(Object.assign({ bearbeitet_am: new Date().toISOString() }, patch)).eq("id", id).select().single();
  if (r.error) { toast(nice(r.error), 4500); return null; }
  ANM = ANM.map(x => x.id === id ? r.data : x); renderAnm(); if (msg) toast(msg); return r.data;
}
async function anmAction(kind, btn) {
  const id = panelState && panelState.id, a = ANM.find(x => x.id === id); if (!a) return;
  if (kind === "cancel") { const el = $("act"); if (el) el.innerHTML = ""; return; }
  if (kind === "delete") {
    if (!confirmTap(btn, "anmdel" + id, "Wirklich löschen? Nochmals tippen")) return;
    const r = await sb.from("anmeldungen").delete().eq("id", id);
    if (r.error) return toast(nice(r.error), 4500);
    if ((a.vermieten_fotos || []).length) await sb.storage.from("anmeldungen").remove(a.vermieten_fotos).catch(() => {});
    ANM = ANM.filter(x => x.id !== id); closePanel(); renderAnm(); return toast("Anmeldung gelöscht");
  }
  if (kind === "mkowner") {
    busy(btn, true, "Wird angelegt …");
    const row = { profilname: a.vorname, voller_name: anmName(a), email: a.email, telefon: a.telefon, instagram: a.instagram,
      stil: anmStile(a).join(", ") || null, provision_prozent: 10, vereinbarung_datum: iso(today()), notiz: "Aus Anmeldung vom " + fmt(a.created_at.slice(0, 10)) };
    const { data, error } = await sb.from("owners").insert(row).select().single();
    if (error) { busy(btn, false); return toast(nice(error), 4500); }
    OWNERS = OWNERS.concat(data).sort((x, y) => x.id.localeCompare(y.id));
    await patchAnm(id, { owner_id: data.id }, `${data.id} angelegt`); renderAll(); return showAnm(id);
  }
  const needsText = kind === "reject";
  const withMonth = kind === "accept" || kind === "wait";
  const label = { accept: "Annehmen", wait: "Auf Warteliste setzen", reject: "Absage", "rent-yes": "Vermieten zusagen", "rent-no": "Vermieten absagen" }[kind];
  const ph = { accept: "Optional: persönliche Ergänzung, z.B. Abgabetermin", wait: "Was du ihr noch sagen möchtest (optional)", reject: "Warum? Kurz und freundlich, z.B. Stil oder Grössen passen diesen Monat nicht.", "rent-yes": "Optional: wie es weitergeht, z.B. wann sie die Teile bringen kann", "rent-no": "Optional: Grund" }[kind];
  const el = $("act");
  el.innerHTML = `<form class="box actform" id="actForm" novalidate>
    <div class="sec" style="margin:0">${label}</div>
    ${withMonth ? `<label>Monat<select id="m-monat">${monthsAhead(5).map(m => `<option value="${m}" ${m === (a.status_monat || a.wunsch_monat || "").slice(0, 10) ? "selected" : ""}>${monthLabel(m)}</option>`).join("")}</select></label>` : ""}
    <label>${needsText ? "Grund *" : "Dein Text"}<textarea id="m-text" rows="4" placeholder="${esc(ph)}"></textarea></label>
    <p class="hint">Danach öffnet sich dein Mailprogramm mit einer fertigen E-Mail an ${esc(a.email)}. Du kannst sie vor dem Senden noch anpassen.</p>
    <div class="rowsmall"><button class="btn primary" type="submit">Speichern & E-Mail öffnen</button><button class="btn" type="button" data-aact="save-only">Nur speichern</button><button class="btn ghost" type="button" data-aact="cancel">Abbrechen</button></div>
  </form>`;
  el.scrollIntoView({ block: "nearest" });
  const run = async (sendMail, b) => {
    const text = $("m-text").value.trim(), monat = withMonth ? $("m-monat").value : null;
    if (needsText && !text) return toast("Bitte einen Grund eingeben.");
    busy(b, true);
    const patch = kind.startsWith("rent") ? { vermieten_ok: kind === "rent-yes", status_grund: text || null }
      : { status: kind === "accept" ? "Angenommen" : kind === "wait" ? "Warteliste" : "Absage", status_monat: monat, status_grund: text || null };
    const ok = await patchAnm(id, patch, label + " gespeichert");
    busy(b, false);
    if (!ok) return;
    showAnm(id);
    if (sendMail) { const [subj, body] = anmMail(kind, a, monat, text); mailTo(a.email, subj, body); }
  };
  $("actForm").onsubmit = e => { e.preventDefault(); run(true, e.submitter); };
  el.querySelector('[data-aact="save-only"]').onclick = e => { e.stopPropagation(); run(false, e.currentTarget); };
}

/* ---------- Look anzeigen ---------- */
function showLook(id) {
  const l = LOOKS.find(x => x.id === id); if (!l) return;
  openPanel(`
    <div class="phead"><span class="sub">Look</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <div class="d">
      <div class="big">${imgTag(lookPath(l), l.name)}</div>
      <div>
        <div class="nr"><small>Look</small>${esc(l.nr)}</div>
        <div class="style" style="margin-top:14px">${esc(l.style || "")}</div>
        <h2 class="dt" style="margin-top:4px">${esc(l.name)}</h2>
        <p class="desc">${esc(l.konzept || "")}</p>
        <dl class="f"><dt>Status</dt><dd>${esc(l.status || "")}</dd><dt>Notiz</dt><dd>${esc(l.bemerkung || "")}</dd></dl>
        <div class="sec">Teile in diesem Look</div>
        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${l.items.map(iid => { const it = ITEMS.find(x => x.id === iid); return it ? itemCard(it) : ""; }).join("")}</div>
        <div class="row"><button class="btn danger" type="button" data-dellook="${esc(l.id)}">Look löschen</button></div>
        <p class="hint">Beim Löschen eines Looks bleiben die Teile erhalten.</p>
      </div>
    </div>`, { type: "look", id });
}
async function deleteLook(id, btn) {
  if (!confirmTap(btn, "dellook" + id, "Wirklich löschen? Nochmals tippen")) return;
  const l = LOOKS.find(x => x.id === id);
  busy(btn, true, "Löschen …");
  const { error } = await sb.from("looks").delete().eq("id", id);
  if (error) { busy(btn, false); toast(nice(error), 4000); return; }
  await removePhoto(l && l.foto_pfad).catch(() => {});
  LOOKS = LOOKS.filter(x => x.id !== id);
  closePanel(); renderAll(); toast((l ? l.nr : "Look") + " gelöscht");
}

/* ---------- Foto-Auswahl (Galerie oder Kamera) ---------- */
let pendingBlob = null, onPhoto = () => {};
function photoPicker() {
  return `<div class="drop" id="drop">
    <span class="plus">+</span>
    <span class="hint">Foto hierher ziehen oder wählen:</span>
    <div class="pick">
      <label class="btn" for="fileLib">Aus Fotos wählen</label>
      <label class="btn" for="fileCam">Foto machen</label>
    </div>
    <input id="fileLib" type="file" accept="image/*" hidden>
    <input id="fileCam" type="file" accept="image/*" capture="environment" hidden>
    <button class="btn swap" id="swapPhoto" type="button" hidden>Anderes Foto</button>
  </div>`;
}
function wirePicker(cb) {
  pendingBlob = null; onPhoto = cb;
  const drop = $("drop");
  ["fileLib", "fileCam"].forEach(id => { const inp = $(id); inp.addEventListener("change", () => { if (inp.files[0]) takePhoto(inp.files[0]); inp.value = ""; }); });
  ["dragover", "dragenter"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f && f.type.startsWith("image/")) takePhoto(f); });
  $("swapPhoto").addEventListener("click", () => {
    pendingBlob = null; const pv = drop.querySelector("img.pv"); if (pv) pv.remove();
    drop.classList.remove("has"); $("swapPhoto").hidden = true; onPhoto();
  });
}
async function takePhoto(file) {
  try {
    pendingBlob = await resizeImage(file);
    const drop = $("drop"); if (!drop) return;
    let pv = drop.querySelector("img.pv"); if (!pv) { pv = document.createElement("img"); pv.className = "pv"; drop.appendChild(pv); }
    pv.src = URL.createObjectURL(pendingBlob); pv.alt = "Gewähltes Foto";
    drop.classList.add("has"); $("swapPhoto").hidden = false;
    onPhoto();
  } catch (err) { toast(nice(err), 4000); }
}

/* ---------- Neues Teil ---------- */
function showAdd() {
  const cats = [...new Set(BASE_CATS.concat(ITEMS.map(i => i.kategorie).filter(Boolean)))];
  const owner = ownerOf(lastOwner) ? lastOwner : SELF;
  openPanel(`
    <div class="phead"><span class="sub">Neues Teil</span><button class="btn ghost close" type="button" data-close>Abbrechen ✕</button></div>
    <div class="d">
      ${photoPicker()}
      <form class="form" id="addForm" novalidate>
        <div class="next"><div class="nr"><small>Bekommt automatisch</small><span id="nextNr">…</span></div><span class="hint" style="max-width:20ch">Du musst keine Nummer eintippen.</span></div>
        <label>Titel *<input id="f-titel" required placeholder="z.B. Black Leather Biker Jacket"></label>
        <div class="two">
          <label>Owner<select id="f-owner">${ownerOptions(owner)}</select></label>
          <label>Phase<select id="f-phase">${phaseOptions(owner === SELF ? "" : defaultPhase())}</select></label>
        </div>
        <div class="two">
          <label>Kategorie<select id="f-kategorie">${cats.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
          <label>Preis CHF<input id="f-preis" inputmode="decimal" placeholder="offen"></label>
        </div>
        <div class="two">
          <label>Grösse<input id="f-groesse" placeholder="z.B. M / 38"></label>
          <label>Marke<input id="f-marke" placeholder="optional"></label>
        </div>
        <label>Notiz<textarea id="f-notiz" rows="2" placeholder="Was fällt auf? Zustand, Details …"></textarea></label>
        <p class="hint" id="formMsg">Pflicht sind nur Foto und Titel. Alles andere kannst du später ergänzen.</p>
        <div class="row" style="margin-top:0"><button class="btn primary" id="saveNew" type="submit" disabled>Teil anlegen</button></div>
      </form>
    </div>`, { type: "add" });
  wirePicker(checkReady);
  let phaseTouched = false;
  $("f-phase").addEventListener("change", () => { phaseTouched = true; });
  $("f-owner").addEventListener("change", () => { if (!phaseTouched) $("f-phase").innerHTML = phaseOptions($("f-owner").value === SELF ? "" : defaultPhase()); });
  $("f-titel").addEventListener("input", checkReady);
  $("addForm").addEventListener("submit", e => { e.preventDefault(); createItem(); });
  sb.rpc("naechste_item_nr").then(({ data, error }) => { const el = $("nextNr"); if (el) el.textContent = error || !data ? "wird vergeben" : data; });
}
function checkReady() {
  const btn = $("saveNew"); if (!btn) return;
  const ok = !!pendingBlob && $("f-titel").value.trim().length > 0;
  btn.disabled = !ok;
  $("formMsg").textContent = ok ? "Bereit. Tippe auf «Teil anlegen»." : (!pendingBlob ? "Zuerst ein Foto wählen." : "Jetzt noch einen Titel eingeben.");
}
async function createItem() {
  const btn = $("saveNew"); if (btn.disabled) return;
  busy(btn, true, "Wird hochgeladen …");
  try {
    const id = uuid(), path = `items/${id}.jpg`;
    await uploadPhoto(path, pendingBlob);
    const owner = $("f-owner").value || SELF;
    const row = { id, titel: val("f-titel"), kategorie: val("f-kategorie"), groesse: val("f-groesse"), marke: val("f-marke"),
      preis: parsePrice($("f-preis").value), notiz: val("f-notiz"), foto_pfad: path, owner_id: owner, phase_monat: $("f-phase").value || null };
    const { data, error } = await sb.from("items").insert(row).select().single();
    if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
    lastOwner = owner;
    ITEMS.push(data); lastAdded = data.id; pendingBlob = null;
    cat = "Alle"; $("q").value = ""; $("fstat").value = "alle"; setTab("items"); renderAll();
    showItem(data.id); toast(data.nr + " angelegt");
  } catch (err) { busy(btn, false); toast(nice(err), 4500); }
}

/* ---------- Neuer Look ---------- */
let pickedItems = [];
function showAddLook() {
  pickedItems = [];
  const all = ITEMS.filter(i => i.status !== "Zurückgegeben").sort((a, b) => a.nr_num - b.nr_num);
  openPanel(`
    <div class="phead"><span class="sub">Neuer Look</span><button class="btn ghost close" type="button" data-close>Abbrechen ✕</button></div>
    <form class="form" id="lookForm" novalidate>
      <div class="next"><div class="nr"><small>Look-Nummer</small>wird vergeben</div><span class="hint" style="max-width:24ch">Foto ist freiwillig. Ohne Foto zeigt der Look das erste Teil.</span></div>
      <div class="sec" style="margin:4px 0 0">1 · Teile antippen (mindestens 2)</div>
      <div class="pickgrid" id="pickgrid">${all.map(it => `
        <button class="pk" type="button" aria-pressed="false" data-pick="${esc(it.id)}"><div class="ph">${imgTag(it.foto_pfad, it.titel)}</div><span>${esc(it.nr)}</span></button>`).join("")}</div>
      <div class="sec" style="margin:8px 0 0">2 · Style und Name</div>
      <div class="two">
        <label>Style<select id="l-style">${STYLES.map(s => `<option>${s}</option>`).join("")}</select></label>
        <label>Name *<input id="l-name" placeholder="z.B. Leather × Lace"></label>
      </div>
      <label>Idee / Styling<textarea id="l-konzept" rows="2" placeholder="Was macht die Kombination aus?"></textarea></label>
      <div class="sec" style="margin:8px 0 0">3 · Look-Foto (optional)</div>
      <div style="max-width:260px">${photoPicker()}</div>
      <p class="hint" id="lookMsg">Wähle mindestens 2 Teile und gib einen Namen ein.</p>
      <div class="row" style="margin-top:0"><button class="btn primary" id="saveLook" type="submit" disabled>Look anlegen</button></div>
    </form>`, { type: "addlook" });
  wirePicker(checkLook);
  $("l-name").addEventListener("input", checkLook);
  $("pickgrid").addEventListener("click", e => {
    const b = e.target.closest("[data-pick]"); if (!b) return;
    const id = b.dataset.pick, on = !pickedItems.includes(id);
    pickedItems = on ? pickedItems.concat(id) : pickedItems.filter(x => x !== id);
    b.setAttribute("aria-pressed", on); checkLook();
  });
  $("lookForm").addEventListener("submit", e => { e.preventDefault(); createLook(); });
}
function checkLook() {
  const btn = $("saveLook"); if (!btn) return;
  const n = pickedItems.length, name = $("l-name").value.trim();
  btn.disabled = !(n >= 2 && name);
  $("lookMsg").textContent = n < 2 ? `${n} von mindestens 2 Teilen gewählt.` : (!name ? "Jetzt noch einen Namen eingeben." : `${n} Teile gewählt. Bereit.`);
}
async function createLook() {
  const btn = $("saveLook"); if (btn.disabled) return;
  busy(btn, true, "Wird gespeichert …");
  try {
    const id = uuid();
    const path = pendingBlob ? `looks-neu/${id}.jpg` : null;
    const parts = pickedItems.map(x => ITEMS.find(i => i.id === x)).filter(Boolean);
    if (path) await uploadPhoto(path, pendingBlob);
    const { data, error } = await sb.from("looks").insert({
      id, name: $("l-name").value.trim(), style: $("l-style").value, status: path ? "Fotografiert" : "Idee",
      konzept: $("l-konzept").value.trim() || parts.map(p => p.titel).join(" + "), foto_pfad: path
    }).select().single();
    if (error) { if (path) await sb.storage.from(BUCKET).remove([path]); throw error; }
    const li = await sb.from("look_items").insert(pickedItems.map((item_id, i) => ({ look_id: id, item_id, position: i + 1 })));
    if (li.error) { await sb.from("looks").delete().eq("id", id); if (path) await sb.storage.from(BUCKET).remove([path]); throw li.error; }
    LOOKS.push(Object.assign({}, data, { items: pickedItems.slice() })); pendingBlob = null;
    setTab("looks"); renderAll(); showLook(id); toast(data.nr + " angelegt");
  } catch (err) { busy(btn, false); toast(nice(err), 4500); }
}

/* ---------- Klicks ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const d = b.dataset;
  if (d.close !== undefined) return closePanel();
  if (d.pick) return; // im Look-Formular separat behandelt
  if (d.cat) { cat = d.cat; renderCats(); renderGrid(); return; }
  if (d.act) return runAct(d.act, b);
  if (d.edit) return showItem(d.edit, true);
  if (d.view) return showItem(d.view);
  if (d.save) return saveEdit(d.save, b);
  if (d.del) return deleteItem(d.del, b);
  if (d.dellook) return deleteLook(d.dellook, b);
  if (d.period) { fPeriod = d.period; const fb = $("fblock"); if (fb) fb.innerHTML = franklyBlock(); return; }
  if (d.anm) return showAnm(d.anm);
  if (d.aact) return anmAction(d.aact, b);
  if (d.payout) return payout(d.payout, b);
  if (d.olink) { const el = $("olink"), txt = el ? el.value : ""; if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast("Link kopiert"), () => { el.select(); toast("Link markiert. Jetzt kopieren."); }); else { el.select(); toast("Link markiert. Jetzt kopieren."); } return; }
  if (d.omail) return ownerMail(ownerOf(d.omail));
  if (d.otoken) return newToken(d.otoken, b);
  if (d.anfdone) return anfrageDone(d.anfdone, b);
  if (d.oedit) return ownerForm(ownerOf(d.oedit));
  if (d.odel) return deleteOwner(d.odel, b);
  if (d.owner) return showOwner(d.owner);
  if (d.item) return showItem(d.item);
  if (d.look) return showLook(d.look);
  switch (b.id) {
    case "tab-items": return setTab("items");
    case "tab-looks": return setTab("looks");
    case "tab-owners": return setTab("owners");
    case "tab-anm": return setTab("anm");
    case "addBtn": return showAdd();
    case "addLookBtn": return showAddLook();
    case "addOwnerBtn": return ownerForm();
    case "logoutBtn": return sb.auth.signOut();
    case "reloadBtn": return reload(true);
  }
});
$("q").addEventListener("input", renderGrid);
$("fstat").addEventListener("change", renderGrid);
$("fanm").addEventListener("change", renderAnm);

/* Beim Zurückkehren zur App neue Daten holen, damit PC und Handy gleich sind */
async function reload(manual) {
  try { URLS = {}; await load(); renderAll(); if (manual) toast("Aktualisiert"); if (!ov.hidden && panelState && ["item", "owner", "anm"].includes(panelState.type)) refreshPanel(); }
  catch (err) { toast(nice(err), 4000); }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && started && ov.hidden && Date.now() - lastLoad > 60000) reload(false);
});

init();
