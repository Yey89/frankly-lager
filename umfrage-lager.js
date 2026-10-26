/* =========================================================
   0–100 FRANKLY · LAGER · Tab «Umfrage»
   Eigene Stücke für die Umfrage (Videos oder Fotos), unabhängig
   von den Lager-Teilen. Hier: hochladen, benennen, ein-/ausblenden,
   Resultate ansehen, Kaufanfragen, Verlosung, Gutscheine.
   Braucht supabase/22_umfrage.sql. Läuft nach app.js.
   ========================================================= */
"use strict";

let UST = [], UANT = [], UAUS = {}, uState = "idle", uView = "stuecke", uSort = "neu", uDel = null;
const U_MAX_MB = 50;
const U_FRAGEN = [
  ["kaschieren", "Was kaschierst du?"], ["betonen", "Was betonst du gerne?"], ["nie_im_laden", "Was findest du nie im Laden?"],
  ["mehr_zahlen", "Wofür zahlst du gerne mehr?"], ["stil", "Welcher Stil bist du?"], ["groesse", "Grösse"],
  ["nervt", "Was nervt beim Secondhand-Einkaufen?"], ["zeit", "Wann Zeit zum Einkaufen?"], ["mieten", "Was würdest du mieten?"],
  ["verkaufen", "Würdest du bei uns verkaufen?"]
];

(function css() {
  const st = document.createElement("style");
  st.textContent = `
  .ugrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}
  .ucard{background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column}
  .ucard video,.ucard img{width:100%;aspect-ratio:3/4;object-fit:cover;background:#ddd;display:block}
  .ucard .ub{padding:8px;display:grid;gap:6px}
  .ucard input[type=text]{width:100%;border:1px solid var(--line);background:var(--bg);padding:6px 8px}
  .ucard .ust{font-size:12px;color:var(--muted);line-height:1.35}
  .ucard .ust b{color:var(--ink)}
  .ucard.off{opacity:.55}
  .ubar{display:grid;grid-template-columns:minmax(120px,1fr) 2fr 34px;gap:8px;align-items:center;font-size:13px;margin:3px 0}
  .ubar i{display:block;height:10px;background:var(--red)}
  .ubox{background:var(--surface);border:1px solid var(--line);padding:12px 14px;margin:0 0 12px}
  .ubox h3{margin:0 0 8px;font-size:15px}
  .ulist{margin:0;padding-left:18px}.ulist li{margin:4px 0}
  .urow{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .uprog{font-family:var(--mono);font-size:12px;color:var(--muted)}`;
  document.head.appendChild(st);
})();

const uUrl = s => `${FRANKLY_CONFIG.url}/storage/v1/object/public/umfrage/${String(s.medien_pfad).split("/").map(encodeURIComponent).join("/")}`;
const uDate = d => String(d || "").slice(0, 10).split("-").reverse().join(".");

async function loadUmfrage() {
  uState = "loading";
  const [a, b, c] = await Promise.all([
    sb.from("umfrage_stuecke").select("*").order("nr_num", { ascending: false }),
    sb.from("umfrage").select("*").order("created_at", { ascending: false }),
    sb.from("umfrage_auswertung").select("*")
  ]);
  if (a.error || b.error) { uState = "missing"; return renderUmfrage(); }
  UST = a.data || []; UANT = b.data || [];
  UAUS = {}; (c.data || []).forEach(x => { UAUS[x.id] = x; });
  uState = "ok"; renderUmfrage();
}

function renderUmfrage(reload) {
  const el = $("umfrage"); if (!el) return;
  if (reload || uState === "idle") { if (uState !== "loading") loadUmfrage(); }
  const offen = UANT.filter(a => (a.kauf || []).length && !a.kauf_erledigt).length;
  const c = $("cntUmf"); if (c) c.textContent = offen || "";
  if (uState === "missing") { el.innerHTML = `<p class="hint" style="margin-top:14px">Bitte zuerst 22_umfrage.sql in Supabase ausführen.</p>`; return; }
  if (uState === "loading" && !UST.length && !UANT.length) { el.innerHTML = `<p class="loading">Umfrage wird geladen …</p>`; return; }
  const verl = UANT.filter(a => a.verlosung && a.kontakt);
  const tabs = [["stuecke", `Stücke (${UST.length})`], ["antworten", `Antworten (${UANT.length})`], ["kauf", `Kaufanfragen${offen ? ` (${offen})` : ""}`], ["verlosung", `Verlosung (${verl.length})`]];
  el.innerHTML = `
    <div class="tools" style="justify-content:space-between">
      <span class="hint" style="flex:1 1 280px;max-width:64ch">Eigene Stücke für die Umfrage, unabhängig von den Lager-Teilen. Videos oder Fotos hochladen, höchstens ${U_MAX_MB} MB pro Datei. Kurze, kleine Videos laden für die Leute viel schneller.</span>
      <span class="urow">
        <a class="btn ghost" href="umfrage.html" target="_blank" rel="noopener">Umfrage ansehen</a>
        <label class="btn primary" style="cursor:pointer">+ Videos / Fotos hochladen<input type="file" id="uFiles" accept="video/*,image/*" multiple hidden></label>
      </span>
    </div>
    <p class="uprog" id="uProg"></p>
    <div class="urow" style="margin-bottom:12px">
      <span class="chips" style="margin:0">${tabs.map(([k, l]) => `<button class="chip" type="button" data-uview="${k}" aria-pressed="${k === uView}">${l}</button>`).join("")}</span>
      <span class="rowsmall" style="margin:0 0 0 auto"><input class="search" id="uCode" placeholder="Gutschein, z.B. FRANKLY-7K3MZ" aria-label="Gutschein-Code"><button class="btn" type="button" id="uCodeBtn">Einlösen</button></span>
    </div>
    <div id="uBody"></div>`;
  $("uFiles").onchange = e => upload([...e.target.files]);
  const body = $("uBody");
  if (uView === "stuecke") body.innerHTML = stueckeHtml();
  if (uView === "antworten") body.innerHTML = antwortenHtml();
  if (uView === "kauf") body.innerHTML = kaufHtml();
  if (uView === "verlosung") body.innerHTML = verlosungHtml(verl);
}

/* ---------- Stücke ---------- */
function stueckeHtml() {
  if (!UST.length) return `<p class="empty">Noch keine Stücke. Lade oben deine Videos oder Fotos hoch.</p>`;
  const list = UST.slice();
  if (uSort === "beliebt") list.sort((x, y) => ((UAUS[y.id] || {}).ja || 0) - ((UAUS[x.id] || {}).ja || 0));
  if (uSort === "unbeliebt") list.sort((x, y) => ((UAUS[y.id] || {}).nein || 0) - ((UAUS[x.id] || {}).nein || 0));
  return `<div class="chips" style="margin:0 0 10px">${[["neu", "Neueste"], ["beliebt", "Am meisten Ja"], ["unbeliebt", "Am meisten Nein"]].map(([k, l]) => `<button class="chip" type="button" data-usort="${k}" aria-pressed="${k === uSort}">${l}</button>`).join("")}</div>
  <div class="ugrid">${list.map(s => {
    const a = UAUS[s.id] || {};
    const media = s.typ === "video" ? `<video src="${esc(uUrl(s))}#t=0.1" muted playsinline preload="metadata" controls></video>` : `<img src="${esc(uUrl(s))}" alt="" loading="lazy">`;
    return `<div class="ucard ${s.aktiv ? "" : "off"}">${media}<div class="ub">
      <b>${esc(s.nr)}</b>
      <input type="text" data-utitel="${esc(s.id)}" value="${esc(s.titel || "")}" placeholder="Titel, z.B. Lederjacke" maxlength="120" aria-label="Titel">
      <input type="text" data-ugr="${esc(s.id)}" value="${esc(s.groesse || "")}" placeholder="Grösse" maxlength="20" aria-label="Grösse">
      <span class="ust">${a.ja || a.nein ? `<b>${a.ja || 0}× Ja</b> · ${a.nein || 0}× Nein · ${a.ja_prozent ?? 0} %<br>Fairer Preis: <b>${a.fairer_preis ? "CHF " + esc(a.fairer_preis) : "–"}</b><br>Alltag ${a.alltag || 0} · Anlass ${a.besonderer_anlass || 0} · Mieten ${a.lieber_mieten || 0}` : "Noch keine Antworten"}</span>
      <label class="ust"><input type="checkbox" data-uaktiv="${esc(s.id)}" ${s.aktiv ? "checked" : ""}> In der Umfrage zeigen</label>
      <button class="btn" type="button" data-udel="${esc(s.id)}">${uDel === s.id ? "Wirklich löschen?" : "Löschen"}</button>
    </div></div>`;
  }).join("")}</div>`;
}
async function upload(files) {
  const prog = $("uProg"); let ok = 0, skip = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.size > U_MAX_MB * 1024 * 1024) { skip.push(f.name); continue; }
    prog.textContent = `Lade hoch: ${i + 1} von ${files.length} (${f.name}) …`;
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const up = await sb.storage.from("umfrage").upload(path, f, { contentType: f.type || undefined, upsert: false });
    if (up.error) { skip.push(f.name); continue; }
    const typ = (f.type || "").startsWith("image/") ? "foto" : "video";
    const ins = await sb.from("umfrage_stuecke").insert({ medien_pfad: path, typ }).select().single();
    if (ins.error) { skip.push(f.name); continue; }
    UST.unshift(ins.data); ok++;
  }
  prog.textContent = `${ok} hochgeladen.` + (skip.length ? ` Nicht geklappt oder grösser als ${U_MAX_MB} MB: ${skip.join(", ")}` : "");
  const keep = prog.textContent; renderUmfrage(); $("uProg").textContent = keep;
}
async function saveSt(id, patch) {
  const { data, error } = await sb.from("umfrage_stuecke").update(patch).eq("id", id).select().single();
  if (error) return toast(nice(error), 4500);
  UST = UST.map(s => s.id === id ? data : s);
  if ("aktiv" in patch) renderUmfrage(); else toast("Gespeichert");
}
async function delSt(id, btn) {
  if (uDel !== id) { uDel = id; renderUmfrage(); return; }
  uDel = null; busy(btn, true, "…");
  const s = UST.find(x => x.id === id);
  const { error } = await sb.from("umfrage_stuecke").delete().eq("id", id);
  if (error) { busy(btn, false); return toast(nice(error), 4500); }
  if (s) await sb.storage.from("umfrage").remove([s.medien_pfad]);
  UST = UST.filter(x => x.id !== id); renderUmfrage(); toast("Gelöscht");
}

/* ---------- Antworten (zusammengezählt) ---------- */
function antwortenHtml() {
  if (!UANT.length) return `<p class="empty">Noch keine Antworten.</p>`;
  const n = UANT.length;
  const bars = (counts) => { const max = Math.max(1, ...Object.values(counts)); return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="ubar"><span>${esc(k)}</span><i style="width:${Math.round(v / max * 100)}%"></i><span>${v}</span></div>`).join(""); };
  const texts = arr => arr.length ? `<ul class="ulist">${arr.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="hint">Noch nichts.</p>`;
  const boxes = U_FRAGEN.map(([id, q]) => {
    const counts = {}, frei = [];
    UANT.forEach(a => {
      const v = (a.fragen || {})[id]; if (v == null || v === "") return;
      if (id === "groesse") { ["oben", "unten"].forEach(k => { if (v[k]) { const key = `${k === "oben" ? "Oben" : "Unten"} ${v[k]}`; counts[key] = (counts[key] || 0) + 1; } }); return; }
      if (typeof v === "string") { if (id === "nie_im_laden") frei.push(v); else counts[v] = (counts[v] || 0) + 1; return; }
      if (Array.isArray(v)) { v.forEach(x => counts[x] = (counts[x] || 0) + 1); return; }
      (v.wahl || []).forEach(x => counts[x] = (counts[x] || 0) + 1);
      if (v.anders) frei.push(v.anders);
    });
    return `<div class="ubox"><h3>${esc(q)}</h3>${Object.keys(counts).length ? bars(counts) : ""}${frei.length || id === "nie_im_laden" ? `<div class="hint" style="margin-top:6px">Eigene Antworten:</div>${texts(frei)}` : ""}</div>`;
  }).join("");
  const fehlt = UANT.map(a => a.fehlt).filter(Boolean);
  return `<p class="hint" style="margin:0 0 10px">${n} Antworten. Pro Stück siehst du die Resultate unter «Stücke».</p>
    <div class="ubox"><h3>Was fehlt dir noch in deinem Kleiderschrank, und warum?</h3>${texts(fehlt)}</div>${boxes}`;
}

/* ---------- Kaufanfragen ---------- */
function kaufHtml() {
  const list = UANT.filter(a => (a.kauf || []).length);
  if (!list.length) return `<p class="empty">Noch keine Kaufanfragen.</p>`;
  return `<p class="hint" style="margin:0 0 10px">Noch kein Kauf: Frag die Besitzerin und bring die beiden zusammen. Dann auf «Erledigt».</p>` + list.map(a => {
    const k = String(a.kontakt || ""), mail = /@/.test(k);
    return `<div class="ubox" style="${a.kauf_erledigt ? "opacity:.55" : ""}">
      <div class="urow" style="justify-content:space-between"><b>${esc(a.name || "–")}</b><span class="hint">${uDate(a.created_at)}</span></div>
      <p style="margin:4px 0">${mail ? `<a href="mailto:${esc(k)}">${esc(k)}</a>` : esc(k)}</p>
      <ul class="ulist">${a.kauf.map(x => `<li>${esc(x.nr)}${x.titel ? " · " + esc(x.titel) : ""}${x.preis ? ` · fairer Preis CHF ${esc(x.preis)}` : ""}</li>`).join("")}</ul>
      <div class="urow" style="margin-top:8px"><button class="btn ${a.kauf_erledigt ? "" : "primary"}" type="button" data-ukauf="${esc(a.id)}">${a.kauf_erledigt ? "Wieder offen" : "Erledigt"}</button></div>
    </div>`;
  }).join("");
}
async function toggleKauf(id, btn) {
  const a = UANT.find(x => x.id === id); if (!a) return;
  busy(btn, true, "…");
  const { data, error } = await sb.from("umfrage").update({ kauf_erledigt: !a.kauf_erledigt }).eq("id", id).select().single();
  if (error) { busy(btn, false); return toast(nice(error), 4500); }
  UANT = UANT.map(x => x.id === id ? data : x); renderUmfrage();
}

/* ---------- Verlosung ---------- */
function verlosungHtml(verl) {
  if (!verl.length) return `<p class="empty">Noch niemand bei der Verlosung.</p>`;
  return `<div class="urow" style="margin-bottom:10px"><button class="btn primary" type="button" id="uZiehen">Gewinnerin ziehen</button><span id="uGew" style="font-weight:600"></span></div>
    <div class="ubox"><ul class="ulist">${verl.map(a => `<li>${esc(a.name || "–")} · ${esc(a.kontakt)} <span class="hint">${uDate(a.created_at)}</span></li>`).join("")}</ul></div>`;
}

/* ---------- Gutschein einlösen ---------- */
async function redeemU(btn) {
  let code = ($("uCode").value || "").trim().toUpperCase().replace(/\s/g, "");
  if (!code) return toast("Bitte den Code eingeben.");
  if (!code.startsWith("FRANKLY-")) code = "FRANKLY-" + code;
  busy(btn, true, "Prüfen …");
  const { data, error } = await sb.from("umfrage").select("id,eingeloest_am").eq("gutschein", code).maybeSingle();
  if (error) { busy(btn, false); return toast(nice(error), 4500); }
  if (!data) { busy(btn, false); return toast("Diesen Code gibt es nicht.", 4000); }
  if (data.eingeloest_am) { busy(btn, false); return toast(`Schon eingelöst am ${uDate(data.eingeloest_am)}.`, 4500); }
  const u = await sb.from("umfrage").update({ eingeloest_am: new Date().toISOString() }).eq("id", data.id).select().single();
  busy(btn, false);
  if (u.error) return toast(nice(u.error), 4500);
  UANT = UANT.map(x => x.id === data.id ? u.data : x); $("uCode").value = "";
  toast("Gutschein eingelöst: CHF 5 auf Frankly-Teile.", 6000);
}

/* ---------- Klicks und Eingaben ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || !$("umfrage") || !$("umfrage").contains(b)) return;
  if (b.dataset.uview) { uView = b.dataset.uview; uDel = null; return renderUmfrage(); }
  if (b.dataset.usort) { uSort = b.dataset.usort; return renderUmfrage(); }
  if (b.dataset.udel) return delSt(b.dataset.udel, b);
  if (b.dataset.ukauf) return toggleKauf(b.dataset.ukauf, b);
  if (b.id === "uCodeBtn") return redeemU(b);
  if (b.id === "uZiehen") { const v = UANT.filter(a => a.verlosung && a.kontakt); const w = v[Math.floor(Math.random() * v.length)]; $("uGew").textContent = w ? `${w.name || "–"} · ${w.kontakt}` : ""; }
});
document.addEventListener("change", e => {
  const t = e.target; if (!$("umfrage") || !$("umfrage").contains(t)) return;
  if (t.dataset.utitel) return saveSt(t.dataset.utitel, { titel: t.value.trim() || null });
  if (t.dataset.ugr) return saveSt(t.dataset.ugr, { groesse: t.value.trim() || null });
  if (t.dataset.uaktiv) return saveSt(t.dataset.uaktiv, { aktiv: t.checked });
});
window.renderUmfrage = renderUmfrage;
