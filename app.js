/* =========================================================
   0–100 FRANKLY · LAGER
   Web-App für Teile, Fotos und Looks. Daten liegen in Supabase:
   Tabellen items, looks, look_items · Fotos im privaten Speicher "fotos".
   ========================================================= */
"use strict";

const CFG = window.FRANKLY_CONFIG;
const BUCKET = CFG.bucket || "fotos";
const STATUSES = ["Entwurf", "Verfügbar", "Reserviert", "Verkauft", "Vermietet"];
const STYLES = ["EDGY", "FIERCE", "DREAMY", "AGILE"];
const BASE_CATS = ["Oberteile", "Hosen", "Röcke", "Kleider", "Jacken", "Schuhe", "Taschen", "Accessoires"];
const FIELDS = [
  ["kategorie", "Kategorie"], ["unterkategorie", "Unterkategorie"], ["schnitt", "Schnitt"], ["farben", "Farben"],
  ["muster", "Muster"], ["groesse", "Grösse"], ["marke", "Marke"], ["material", "Material"], ["zustand", "Zustand"],
  ["preis", "Preis CHF"], ["status", "Status"], ["owner_id", "Besitzerin"], ["standort", "Standort"]
];

const $ = id => document.getElementById(id);
let sb = null;
let ITEMS = [], LOOKS = [], URLS = {};
let cat = "Alle", lastAdded = null, started = false, lastLoad = 0;

/* ---------- Hilfsfunktionen ---------- */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function isOpen(v) { return v == null || v === "" || /prüfen|unbekannt|nicht geprüft/i.test(String(v)); }
function priceTxt(p) { return (p === null || p === undefined || p === "") ? "Preis offen" : "CHF " + Number(p).toFixed(Number(p) % 1 ? 2 : 0); }
function pill(st) { const c = st === "Verkauft" || st === "Vermietet" ? "sold" : (st === "Verfügbar" ? "ok" : ""); return `<span class="pill ${c}">${esc(st || "Entwurf")}</span>`; }
function parsePrice(v) { v = String(v || "").trim(); if (!v) return null; const n = Number(v.replace(",", ".").replace(/[^\d.]/g, "")); return isNaN(n) ? null : n; }
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
  return m;
}
let tt;
function toast(m, ms) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, ms || 2800); }
function busy(btn, on, label) { if (!btn) return; if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || "Speichern …"; btn.disabled = true; } else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; } }

/* ---------- Start & Anmeldung ---------- */
function show(which) { $("boot").hidden = which !== "boot"; $("login").hidden = which !== "login"; $("app").hidden = which !== "app"; }

async function init() {
  if (!window.supabase || !CFG) { $("boot").innerHTML = `<p class="err">Die App konnte nicht geladen werden. Seite neu laden.</p>`; return; }
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true } });
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") { started = false; ITEMS = []; LOOKS = []; URLS = {}; show("login"); }
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
  const [a, b] = await Promise.all([
    sb.from("items").select("*").order("nr_num"),
    sb.from("looks").select("*, look_items(item_id, position)").order("nr_num")
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  ITEMS = a.data || [];
  LOOKS = (b.data || []).map(l => Object.assign({}, l, {
    items: (l.look_items || []).slice().sort((x, y) => x.position - y.position).map(x => x.item_id)
  }));
  await signUrls(ITEMS.map(i => i.foto_pfad).concat(LOOKS.map(l => l.foto_pfad)));
  lastLoad = Date.now();
}

async function signUrls(paths) {
  const todo = [...new Set(paths.filter(p => p && !URLS[p]))];
  for (let i = 0; i < todo.length; i += 100) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(todo.slice(i, i + 100), 60 * 60 * 12);
    if (error) throw error;
    (data || []).forEach(d => { if (d.signedUrl && d.path) URLS[d.path] = d.signedUrl; });
  }
}

/* Fotos verkleinern (max. 1600 px), damit Upload schnell und Speicher klein bleibt */
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

/* ---------- Anzeige ---------- */
function renderCats() {
  const cs = ["Alle"].concat([...new Set(ITEMS.map(i => i.kategorie).filter(Boolean))]);
  if (!cs.includes(cat)) cat = "Alle";
  $("cats").innerHTML = cs.map(c => `<button class="chip" type="button" aria-pressed="${c === cat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}
function renderGrid() {
  const q = $("q").value.trim().toLowerCase();
  const list = ITEMS.filter(it => (cat === "Alle" || it.kategorie === cat) &&
    (!q || [it.nr, it.titel, it.marke, it.farben, it.kategorie, it.unterkategorie, it.notiz, it.groesse].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => a.nr_num - b.nr_num);
  $("cntItems").textContent = ITEMS.length;
  $("cntLooks").textContent = LOOKS.length;
  const g = $("grid");
  if (!ITEMS.length) { g.innerHTML = `<p class="empty">Noch keine Teile. Tippe oben auf «+ Teil erfassen».</p>`; return; }
  if (!list.length) { g.innerHTML = `<p class="empty">Keine Teile gefunden. Suche anpassen.</p>`; return; }
  g.innerHTML = list.map(it => `
    <button class="card" type="button" data-item="${esc(it.id)}">
      <div class="ph">${imgTag(it.foto_pfad, it.titel)}<span class="tag ${it.id === lastAdded ? "new" : ""}">${esc(it.nr)}</span></div>
      <div class="meta"><span class="title">${esc(it.titel)}</span><span class="price ${it.preis == null ? "open" : ""}">${esc(priceTxt(it.preis))}</span></div>
      <div class="line2">${pill(it.status)}<span>${esc(it.unterkategorie || it.kategorie || "")}</span></div>
    </button>`).join("");
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
function renderAll() {
  renderCats(); renderGrid(); renderLooks();
  $("foot").textContent = `0–100 Frankly · ${ITEMS.length} Teile · ${LOOKS.length} Looks`;
}
function setTab(t) {
  $("tab-items").setAttribute("aria-selected", t === "items");
  $("tab-looks").setAttribute("aria-selected", t === "looks");
  $("viewItems").hidden = t !== "items";
  $("viewLooks").hidden = t !== "looks";
}

/* ---------- Seitenpanel ---------- */
const ov = $("ov"), panel = $("panel");
let lastFocus = null;
function openPanel(html) { lastFocus = document.activeElement; panel.innerHTML = html; ov.hidden = false; document.body.style.overflow = "hidden"; panel.scrollTop = 0; const c = panel.querySelector(".close"); if (c) c.focus(); }
function closePanel() { ov.hidden = true; panel.innerHTML = ""; document.body.style.overflow = ""; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
ov.addEventListener("click", e => { if (e.target === ov) closePanel(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !ov.hidden) closePanel(); });

/* ---------- Teil anzeigen / bearbeiten ---------- */
function showItem(id, editing) {
  const it = ITEMS.find(x => x.id === id); if (!it) return;
  const ls = looksOf(id);
  const cats = [...new Set(BASE_CATS.concat(ITEMS.map(i => i.kategorie).filter(Boolean)))];
  const val = k => {
    const v = it[k];
    if (editing) {
      if (k === "status") return `<select id="e-${k}">${STATUSES.map(s => `<option ${s === (v || "Entwurf") ? "selected" : ""}>${s}</option>`).join("")}</select>`;
      if (k === "kategorie") return `<select id="e-${k}">${cats.map(c => `<option ${c === v ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>`;
      return `<input id="e-${k}" value="${esc(v == null ? "" : v)}" ${k === "preis" ? 'inputmode="decimal"' : ""}>`;
    }
    if (k === "preis") return `<span class="${v == null ? "warn" : ""}">${esc(priceTxt(v))}</span>`;
    if (k === "status") return pill(v);
    if (v == null || v === "") return `<span class="warn">offen</span>`;
    return `<span class="${isOpen(v) ? "warn" : ""}">${esc(v)}</span>`;
  };
  openPanel(`
    <div class="phead"><span class="sub">Teil</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <div class="d">
      <div>
        <div class="big">${imgTag(it.foto_pfad, it.titel)}</div>
        <div class="rowsmall">
          <label class="btn" for="rep-lib">Foto ersetzen</label>
          <input id="rep-lib" type="file" accept="image/*" hidden data-replace="${esc(id)}">
        </div>
      </div>
      <div>
        <div class="nr"><small>Anzeigenummer</small>${esc(it.nr)}</div>
        ${editing ? `<label class="sec" for="e-titel">Titel</label><input id="e-titel" class="search" style="width:100%" value="${esc(it.titel)}">` : `<h2 class="dt">${esc(it.titel)}</h2>`}
        ${editing ? `<label class="sec" for="e-notiz">Beschreibung</label><textarea id="e-notiz" class="search" style="width:100%" rows="3">${esc(it.notiz || "")}</textarea>` : `<p class="desc">${esc(it.notiz || "")}</p>`}
        <dl class="f">${FIELDS.map(([k, l]) => `<dt>${l}</dt><dd>${val(k)}</dd>`).join("")}</dl>
        <div class="row">${editing
          ? `<button class="btn primary" type="button" data-save="${esc(id)}">Speichern</button><button class="btn" type="button" data-view="${esc(id)}">Abbrechen</button>`
          : `<button class="btn" type="button" data-edit="${esc(id)}">Bearbeiten</button><button class="btn danger" type="button" data-del="${esc(id)}">Löschen</button>`}</div>
        <div class="sec">In Looks</div>
        ${ls.length ? `<div class="thumbs">${ls.map(l => `<button class="mini" type="button" data-look="${esc(l.id)}">${esc(l.style || "")} · ${esc(l.name)}</button>`).join("")}</div>` : `<p class="hint">Noch in keinem Look.</p>`}
        <div class="tech">Feste ID (ändert sich nie, auch wenn die Anzeigenummer wechselt):<br>${esc(it.id)}</div>
      </div>
    </div>`);
  const rep = $("rep-lib");
  rep.addEventListener("change", () => { if (rep.files[0]) replacePhoto(id, rep.files[0]); });
}

async function saveEdit(id, btn) {
  const patch = {};
  ["titel", "notiz"].concat(FIELDS.map(f => f[0])).forEach(k => {
    const el = $("e-" + k); if (!el) return;
    let v = el.value.trim();
    if (k === "preis") v = parsePrice(v);
    else if (v === "") v = null;
    patch[k] = v;
  });
  if (!patch.titel) { toast("Der Titel darf nicht leer sein."); return; }
  busy(btn, true);
  const { data, error } = await sb.from("items").update(patch).eq("id", id).select().single();
  busy(btn, false);
  if (error) { toast(nice(error), 4000); return; }
  ITEMS = ITEMS.map(x => x.id === id ? data : x);
  renderAll(); showItem(id, false); toast("Gespeichert");
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
    renderAll(); showItem(id, false); toast("Foto ersetzt");
  } catch (err) { toast(nice(err), 4500); }
}

let delArmed = null;
async function deleteItem(id, btn) {
  if (delArmed !== id) {
    delArmed = id; btn.textContent = "Wirklich löschen? Nochmals tippen";
    setTimeout(() => { if (delArmed === id) { delArmed = null; if (btn.isConnected) btn.textContent = "Löschen"; } }, 4000);
    return;
  }
  delArmed = null;
  const it = ITEMS.find(x => x.id === id);
  busy(btn, true, "Löschen …");
  const { error } = await sb.from("items").delete().eq("id", id);
  if (error) { busy(btn, false); toast(nice(error), 4000); return; }
  await removePhoto(it && it.foto_pfad).catch(() => {});
  ITEMS = ITEMS.filter(x => x.id !== id);
  LOOKS = LOOKS.map(l => Object.assign({}, l, { items: l.items.filter(x => x !== id) }));
  closePanel(); renderAll(); toast((it ? it.nr : "Teil") + " gelöscht");
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
        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${l.items.map(iid => { const it = ITEMS.find(x => x.id === iid); return it ? `
          <button class="card" type="button" data-item="${esc(iid)}"><div class="ph">${imgTag(it.foto_pfad, it.titel)}<span class="tag">${esc(it.nr)}</span></div><span class="title">${esc(it.titel)}</span></button>` : ""; }).join("")}</div>
        <div class="row"><button class="btn danger" type="button" data-dellook="${esc(l.id)}">Look löschen</button></div>
        <p class="hint">Beim Löschen eines Looks bleiben die Teile erhalten.</p>
      </div>
    </div>`);
}
let delLookArmed = null;
async function deleteLook(id, btn) {
  if (delLookArmed !== id) {
    delLookArmed = id; btn.textContent = "Wirklich löschen? Nochmals tippen";
    setTimeout(() => { if (delLookArmed === id) { delLookArmed = null; if (btn.isConnected) btn.textContent = "Look löschen"; } }, 4000);
    return;
  }
  delLookArmed = null;
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
function nextNrHint() { const m = ITEMS.reduce((a, it) => Math.max(a, it.nr_num || 0), 0); return "FR-" + String(m + 1).padStart(6, "0"); }
function showAdd() {
  const cats = [...new Set(BASE_CATS.concat(ITEMS.map(i => i.kategorie).filter(Boolean)))];
  openPanel(`
    <div class="phead"><span class="sub">Neues Teil</span><button class="btn ghost close" type="button" data-close>Abbrechen ✕</button></div>
    <div class="d">
      ${photoPicker()}
      <form class="form" id="addForm" novalidate>
        <div class="next"><div class="nr"><small>Bekommt automatisch</small>${nextNrHint()}</div><span class="hint" style="max-width:20ch">Du musst keine Nummer eintippen.</span></div>
        <label>Titel *<input id="f-titel" required placeholder="z.B. Black Leather Biker Jacket"></label>
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
    </div>`);
  wirePicker(checkReady);
  $("f-titel").addEventListener("input", checkReady);
  $("addForm").addEventListener("submit", e => { e.preventDefault(); createItem(); });
}
function checkReady() {
  const btn = $("saveNew"); if (!btn) return;
  const ok = !!pendingBlob && $("f-titel").value.trim().length > 0;
  btn.disabled = !ok;
  $("formMsg").textContent = ok ? "Bereit. Tippe auf «Teil anlegen»." : (!pendingBlob ? "Zuerst ein Foto wählen." : "Jetzt noch einen Titel eingeben.");
}
async function createItem() {
  const btn = $("saveNew"); if (btn.disabled) return;
  const v = id => { const x = $(id).value.trim(); return x === "" ? null : x; };
  const id = uuid(), path = `items/${id}.jpg`;
  busy(btn, true, "Wird hochgeladen …");
  try {
    await uploadPhoto(path, pendingBlob);
    const row = { id, titel: v("f-titel"), kategorie: v("f-kategorie"), groesse: v("f-groesse"), marke: v("f-marke"),
      preis: parsePrice($("f-preis").value), notiz: v("f-notiz"), foto_pfad: path };
    const { data, error } = await sb.from("items").insert(row).select().single();
    if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }
    ITEMS.push(data); lastAdded = data.id; pendingBlob = null;
    cat = "Alle"; $("q").value = ""; setTab("items"); renderAll();
    showItem(data.id, false); toast(data.nr + " angelegt");
  } catch (err) { busy(btn, false); toast(nice(err), 4500); }
}

/* ---------- Neuer Look ---------- */
let pickedItems = [];
function showAddLook() {
  pickedItems = [];
  const all = ITEMS.slice().sort((a, b) => a.nr_num - b.nr_num);
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
    </form>`);
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
  const id = uuid();
  const path = pendingBlob ? `looks-neu/${id}.jpg` : null;
  const parts = pickedItems.map(x => ITEMS.find(i => i.id === x)).filter(Boolean);
  busy(btn, true, "Wird gespeichert …");
  try {
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
  if (b.dataset.close !== undefined) return closePanel();
  if (b.dataset.pick) return; // im Look-Formular separat behandelt
  if (b.dataset.cat) { cat = b.dataset.cat; renderCats(); renderGrid(); return; }
  if (b.dataset.edit) return showItem(b.dataset.edit, true);
  if (b.dataset.view) return showItem(b.dataset.view, false);
  if (b.dataset.save) return saveEdit(b.dataset.save, b);
  if (b.dataset.del) return deleteItem(b.dataset.del, b);
  if (b.dataset.dellook) return deleteLook(b.dataset.dellook, b);
  if (b.dataset.item) return showItem(b.dataset.item, false);
  if (b.dataset.look) return showLook(b.dataset.look);
  switch (b.id) {
    case "tab-items": return setTab("items");
    case "tab-looks": return setTab("looks");
    case "addBtn": return showAdd();
    case "addLookBtn": return showAddLook();
    case "logoutBtn": return sb.auth.signOut();
    case "reloadBtn": return reload(true);
  }
});
$("q").addEventListener("input", renderGrid);

/* Beim Zurückkehren zur App (z.B. Handy entsperrt) neue Daten holen, damit PC und Handy gleich sind */
async function reload(manual) {
  try { URLS = {}; await load(); renderAll(); if (manual) toast("Aktualisiert"); }
  catch (err) { toast(nice(err), 4000); }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && started && ov.hidden && Date.now() - lastLoad > 60000) reload(false);
});

init();
