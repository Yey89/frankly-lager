/* =========================================================
   0–100 FRANKLY · Fotoecke: Foto hochladen (QR-Code am Stativ)
   Ohne Login. Darf nur Fotos hochladen und einen Eintrag einfügen
   (siehe supabase/10_fotos_fotoecke.sql). Lesen kann nur das Team.
   ========================================================= */
"use strict";

const CFG = window.FRANKLY_CONFIG;
const $ = id => document.getElementById(id);
let sb = null, file = null, ITEMS = [], URLS = {}, chosen = [];
function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
/* Teile im Laden zum Antippen */
async function loadItems() {
  const r = await sb.from("items").select("id,nr,nr_num,titel,kategorie,farben,marke,foto_pfad").in("status", ["Verfügbar", "Reserviert", "Vermietet"]).order("nr_num", { ascending: false });
  ITEMS = r.data || [];
  renderItems();
  const paths = ITEMS.map(i => i.foto_pfad).filter(Boolean);
  for (let i = 0; i < paths.length; i += 100) {
    const t = await sb.storage.from(CFG.bucket || "fotos").createSignedUrls(paths.slice(i, i + 100).map(p => "thumbs/" + p), 60 * 60 * 3);
    (t.data || []).forEach(x => { if (x.signedUrl && x.path) URLS[x.path.slice(7)] = x.signedUrl; });
  }
  const miss = paths.filter(p => !URLS[p]);
  for (let i = 0; i < miss.length; i += 100) {
    const t = await sb.storage.from(CFG.bucket || "fotos").createSignedUrls(miss.slice(i, i + 100), 60 * 60 * 3);
    (t.data || []).forEach(x => { if (x.signedUrl && x.path) URLS[x.path] = x.signedUrl; });
  }
  renderItems();
}
function renderItems() {
  const q = ($("fSearch").value || "").trim().toLowerCase();
  const list = ITEMS.filter(i => chosen.includes(i.nr) || !q || [i.nr, i.titel, i.kategorie, i.farben, i.marke].join(" ").toLowerCase().includes(q)).slice(0, 60);
  $("fItems").innerHTML = list.length ? list.map(i => `<button class="fit" type="button" data-nr="${esc(i.nr)}" aria-pressed="${chosen.includes(i.nr)}"><span class="i">${URLS[i.foto_pfad] ? `<img src="${esc(URLS[i.foto_pfad])}" alt="">` : ""}</span>${esc(i.nr)}</button>`).join("") : `<p class="hint">Nichts gefunden.</p>`;
  $("fChosen").textContent = chosen.length ? "Ausgewählt: " + chosen.join(", ") : "";
}
$("fSearch").addEventListener("input", renderItems);
$("fGedanke").addEventListener("input", () => { $("fGedankeN").textContent = $("fGedanke").value.length + " / 280"; });
$("fItems").addEventListener("click", e => {
  const b = e.target.closest("[data-nr]"); if (!b) return;
  const nr = b.dataset.nr, i = chosen.indexOf(nr);
  if (i >= 0) chosen.splice(i, 1); else if (chosen.length < 8) chosen.push(nr);
  renderItems();
});

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function code() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = crypto.getRandomValues(new Uint8Array(5));
  return "FOTO-" + [...r].map(x => abc[x % abc.length]).join("");
}
function resizeImage(f) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error("Das Foto konnte nicht verarbeitet werden.")), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Das Foto konnte nicht gelesen werden. Bitte JPG oder PNG wählen.")); };
    img.src = url;
  });
}

$("fFile").addEventListener("change", () => {
  const f = $("fFile").files[0]; if (!f) return;
  file = f;
  $("fPick").innerHTML = `<img src="${URL.createObjectURL(f)}" alt="Dein Foto">`;
});
$("fAgain").addEventListener("click", () => {
  file = null; $("fFile").value = ""; $("fGedanke").value = ""; $("fGedankeN").textContent = "0 / 280"; $("fPick").innerHTML = "<span>Foto wählen oder aufnehmen</span>";
  chosen = []; renderItems();
  $("fDone").hidden = true; $("fForm").hidden = false; window.scrollTo(0, 0);
});
$("fForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("fErr"), btn = $("fBtn"); err.textContent = "";
  if ($("fWeb").value) return;
  if (!file) { err.textContent = "Bitte zuerst ein Foto wählen."; return; }
  if (!$("fIntern").checked) { err.textContent = "Bitte bestätige, dass Frankly das Foto intern anschauen darf."; return; }
  if (!sb) { err.textContent = "Die Seite konnte nicht geladen werden. Bitte neu laden."; return; }
  btn.disabled = true; btn.textContent = "Wird gesendet …";
  try {
    const blob = await resizeImage(file), path = `upload/${uuid()}.jpg`;
    const up = await sb.storage.from("fotoecke").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    const v = id => { const x = $(id).value.trim(); return x || null; };
    let c = null, lastErr = null;
    for (let i = 0; i < 3 && !c; i++) {
      const tryCode = code();
      const { error } = await sb.from("fotoecke").insert({ pfad: path, name: v("fName"), instagram: v("fIg"), teile: chosen.length ? chosen.join(", ") : null, email: v("fMail") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("fMail")) ? v("fMail") : null,
        ok_intern: true, ok_oeffentlich: $("fPublic").checked, gutschein: tryCode, gedanke: v("fGedanke") });
      if (!error) c = tryCode; else { lastErr = error; if (!/duplicate|unique/i.test(error.message || "")) break; }
    }
    if (!c) throw lastErr || new Error("Speichern fehlgeschlagen");
    $("fCode").textContent = c;
    $("fForm").hidden = true; $("fDone").hidden = false; window.scrollTo(0, 0);
  } catch (ex) {
    const m = (ex && ex.message) || String(ex);
    err.textContent = /Failed to fetch|NetworkError|Load failed/i.test(m) ? "Keine Verbindung. Prüfe das Internet und versuch es nochmals." : "Das hat nicht geklappt: " + m;
  }
  btn.disabled = false; btn.textContent = "Foto senden";
});

if (window.supabase && CFG) {
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "frankly-foto" } });
  loadItems().catch(() => { $("fItems").innerHTML = `<p class="hint">Teile konnten nicht geladen werden.</p>`; });
}
