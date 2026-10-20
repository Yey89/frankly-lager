/* =========================================================
   0–100 FRANKLY · OWNER-BEREICH ("Mein Frankly")
   Zugang über den persönlichen Link owner.html?k=<code>.
   Liest und entscheidet nur über die Funktionen owner_portal und
   owner_entscheid (siehe supabase/06_owner_bereich.sql).
   ========================================================= */
"use strict";

const CFG = window.FRANKLY_CONFIG;
const $ = id => document.getElementById(id);
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const STUFE = {
  Stange: "An der Stange",
  Reduziert: "An der Reduziert-Stange",
  Upcycling: "An der Upcycling-Stange",
  Lager: "Im Lager · online auf Anfrage",
  Online: "Online-Stange · bei dir zu Hause"
};
const WAHL = {
  Stange: ["Preis senken", "Upcycling", "Zurücknehmen"],
  Reduziert: ["Lager", "Online", "Zurücknehmen", "Spenden"],
  Upcycling: ["Lager", "Online", "Zurücknehmen", "Spenden"],
  Lager: ["Online", "Zurücknehmen", "Spenden"]
};
const WAHL_TXT = { "Preis senken": "Preis senken", Upcycling: "Upcyceln", Zurücknehmen: "Zurücknehmen", Lager: "Ins Lager", Online: "Online weiterverkaufen", Spenden: "Spenden" };

let sb = null, TOKEN = null, DATA = null, URLS = {}, open = {};

/* ---------- Hilfen ---------- */
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function chf(v) { if (v === null || v === undefined || v === "") return "–"; const n = Number(v); return "CHF " + n.toFixed(n % 1 ? 2 : 0); }
function round2(n) { return Math.round(n * 100) / 100; }
const pad = n => String(n).padStart(2, "0");
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseD(s) { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); }
function fmt(s) { const d = typeof s === "string" ? parseD(s) : s; return d ? `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.` : ""; }
function monthName(s) { const d = parseD(s); return d ? `${MONTHS[d.getMonth()]}` : ""; }
function lastSat(y, m) { const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); return d; }
function firstSat(y, m) { const d = new Date(y, m, 1); d.setDate(1 + ((6 - d.getDay() + 7) % 7)); return d; }
function parsePrice(v) { v = String(v == null ? "" : v).trim(); if (!v) return null; const n = Number(v.replace(",", ".").replace(/[^\d.]/g, "")); return isNaN(n) ? null : n; }
let tt; function toast(m, ms) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, ms || 3200); }
function heute() { return parseD(DATA.heute) || new Date(); }
function saturdays(n) {
  const out = [], d = new Date(heute());
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  for (let i = 0; i < n; i++) { out.push(new Date(d)); d.setDate(d.getDate() + 7); }
  return out;
}
function satOptions() { return saturdays(8).map(d => `<option value="${iso(d)}">${fmt(d)}${d.getFullYear() !== heute().getFullYear() ? d.getFullYear() : ""}</option>`).join(""); }
function payoutDate(s) { const d = parseD(s) || heute(); const ls = lastSat(d.getFullYear(), d.getMonth()); return d <= ls ? ls : lastSat(d.getFullYear(), d.getMonth() + 1); }
function niceErr(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Keine Verbindung. Prüfe das Internet und versuch es nochmals.";
  if (/invalid input syntax for type uuid/i.test(m)) return "Dieser Link ist nicht gültig.";
  return m;
}

/* ---------- Teile ---------- */
function phaseState(it) {
  if (!it.phase_monat) return null;
  const m = parseD(it.phase_monat), start = firstSat(m.getFullYear(), m.getMonth()), end = parseD(it.phase_ende) || lastSat(m.getFullYear(), m.getMonth()), t = heute();
  if (t < start) return { state: "upcoming", start, end };
  if (t <= end) return { state: "running", start, end };
  return { state: "due", start, end };
}
function isDue(it) { const p = phaseState(it); return it.status === "Verfügbar" && !it.entscheid && p && p.state === "due"; }
function provOf(it) { return it.verkauf_provision != null ? Number(it.verkauf_provision) : Number(DATA.owner.provision); }
function posts() {
  const out = [];
  DATA.items.filter(i => i.status === "Verkauft").forEach(i => {
    const b = i.verkauf_preis != null ? Number(i.verkauf_preis) : (i.preis != null ? Number(i.preis) : null); if (b == null) return;
    out.push({ betrag: b, anteil: round2(b * (100 - provOf(i)) / 100), datum: i.verkauf_datum, paid: i.ausbezahlt_am });
  });
  DATA.mieten.forEach(r => out.push({ betrag: Number(r.betrag), anteil: round2(Number(r.betrag) * (100 - Number(r.provision)) / 100), datum: r.von, paid: r.ausbezahlt_am }));
  return out;
}
function stateLine(it) {
  const p = phaseState(it);
  if (it.status === "Entwurf") return `Wird gerade erfasst`;
  if (it.status === "Verkauft") {
    const b = it.verkauf_preis != null ? it.verkauf_preis : it.preis, a = round2(Number(b) * (100 - provOf(it)) / 100);
    const pay = it.ausbezahlt_am ? `ausbezahlt am ${fmt(it.ausbezahlt_am)}` : `Auszahlung am ${fmt(payoutDate(it.verkauf_datum))}`;
    return `<b>Verkauft</b>${it.verkauf_datum ? " am " + esc(fmt(it.verkauf_datum)) : ""} für ${esc(chf(b))} · dein Anteil <b>${esc(chf(a))}</b> · ${esc(pay)}`;
  }
  if (it.status === "Vermietet") {
    const r = DATA.mieten.filter(x => x.item_id === it.id && !x.zurueck_am).pop();
    return `<b>Vermietet</b>${r && r.bis ? " bis " + esc(fmt(r.bis)) : ""}`;
  }
  if (it.status === "Reserviert") return `<b>Reserviert</b> für eine Kundin`;
  if (it.status === "Zurückgegeben") return `Zurück bei dir`;
  if (it.status === "Gespendet") return `Gespendet. Danke!`;
  if (it.entscheid === "Zurücknehmen" && it.entscheid_notiz === "Online weiterverkaufen") return `<b>Abholung</b> am ${esc(fmt(it.entscheid_datum))}, danach auf der Online-Stange`;
  if (it.entscheid === "Zurücknehmen") return `<b>Abholung</b> am ${esc(fmt(it.entscheid_datum))} im Laden`;
  if (it.stufe === "Online") return `<b>Online-Stange:</b> Das Teil ist bei dir. Bitte bewahre es separat auf. Wird es gekauft, melden wir uns, und du verschickst es innert 3 Tagen.<br><button class="btn" type="button" data-online-ende="${esc(it.id)}">Nicht mehr verfügbar</button>`;
  if (it.entscheid === "Spenden") return `<b>Wird gespendet</b>`;
  if (it.entscheid === "Upcycling") return it.entscheid_datum ? `<b>Upcycling</b> mit dir am ${esc(fmt(it.entscheid_datum))}` : `<b>Upcycling</b> durch das Team im Josy`;
  const s = STUFE[it.stufe] || "Im Laden";
  if (!p) return s;
  if (p.state === "upcoming") return `${s} ab ${esc(fmt(p.start))}`;
  if (p.state === "running") return `${s} bis ${esc(fmt(p.end))}`;
  return `<span class="warn">Runde vorbei: Bitte entscheide, wie es weitergeht.</span>`;
}
function thumb(it) { const u = URLS[it.foto_pfad]; return u ? `<img src="${esc(u)}" alt="" loading="lazy">` : `<span class="nofoto">kein Foto</span>`; }
function row(it) {
  const due = isDue(it), done = ["Verkauft", "Zurückgegeben", "Gespendet"].includes(it.status);
  return `
    <article class="orow ${due ? "due" : ""} ${done ? "done" : ""}" id="row-${esc(it.id)}">
      <div class="othumb">${thumb(it)}</div>
      <div class="oinfo">
        <span class="onr">${esc(it.nr)}${it.groesse ? " · Gr. " + esc(it.groesse) : ""}</span>
        <span class="otitle">${esc(it.titel)}</span>
        ${it.status !== "Verkauft" && it.preis != null ? `<span class="oprice">${esc(chf(it.preis))}</span>` : ""}
        <span class="ostate">${stateLine(it)}</span>
      </div>
      ${due ? decideBox(it) : ""}
    </article>`;
}

/* ---------- Entscheiden ---------- */
function decideBox(it) {
  const opts = WAHL[it.stufe] || WAHL.Stange, sel = open[it.id] || "";
  return `
    <div class="decide">
      <fieldset class="choices">
        <legend>Wie geht es weiter?</legend>
        ${opts.map(o => `<label class="choice"><input type="radio" name="w-${esc(it.id)}" value="${esc(o)}" data-wahl="${esc(it.id)}" ${o === sel ? "checked" : ""}><span>${esc(WAHL_TXT[o])}</span></label>`).join("")}
      </fieldset>
      ${sel ? decideForm(it, sel) : ""}
    </div>`;
}
function nextRound(it) { const n = parseD(it.naechste_runde); return n ? `${MONTHS[n.getMonth()]} (${fmt(firstSat(n.getFullYear(), n.getMonth()))} bis ${fmt(lastSat(n.getFullYear(), n.getMonth()))})` : "die nächste Runde"; }
function decideForm(it, w) {
  const id = esc(it.id);
  let body = "";
  if (w === "Preis senken") body = `
    <p class="dnote">Dein Teil hängt in ${esc(nextRound(it))} an der Reduziert-Stange. Bisher ${esc(chf(it.preis))}.</p>
    <label>Neuer Preis CHF<input id="d-preis-${id}" inputmode="decimal" autocomplete="off" placeholder="z.B. ${esc(it.preis != null ? Math.max(0, Math.round(Number(it.preis) * 0.7)) : 20)}"></label>`;
  if (w === "Upcycling") body = `
    <p class="dnote">Nach dem Upcycling hängt dein Teil einen Monat an der Upcycling-Stange.</p>
    <div class="radios">
      <label><input type="radio" name="d-wer-${id}" value="Selbst upcyceln" checked> Ich upcycle selbst im Laden (Termin am Samstag)</label>
      <label><input type="radio" name="d-wer-${id}" value="Upcycling-Team im Josy"> Das Upcycling-Team im Josy macht es</label>
    </div>
    <label id="d-tag-wrap-${id}">Termin<select id="d-tag-${id}">${satOptions()}</select></label>`;
  if (w === "Zurücknehmen") body = `
    <p class="dnote">Du holst dein Teil an einem Samstag im Laden ab.</p>
    <label>Abholung am<select id="d-tag-${id}">${satOptions()}</select></label>`;
  if (w === "Lager") body = `<p class="dnote">Dein Teil kommt für ${esc(nextRound(it))} ins Lager. Im Online-Shop bleibt es sichtbar mit «Auf Anfrage». Wer es anprobieren möchte, meldet sich bei uns.</p>`;
  if (w === "Online") body = `
    <p class="dnote">Du holst dein Teil an einem Samstag ab. Es bleibt aber im Online-Shop mit dem Hinweis «Versand durch Owner». Kaufanfragen kommen zu Frankly. Wir melden uns bei dir, du verschickst das Teil, und du bekommst 90 % wie bisher.</p>
    <label>Abholung am<select id="d-tag-${id}">${satOptions()}</select></label>
    <div class="radios"><label><input type="checkbox" id="d-ok-${id}"> Ich bewahre das Teil separat auf (nicht im eigenen Kleiderschrank), verschicke es innert 3 Tagen, wenn es gekauft wird, und melde hier, wenn ich es nicht mehr habe.</label></div>`;
  if (w === "Spenden") body = `<p class="dnote">Wir geben dein Teil an eine gemeinnützige Stelle in Zürich weiter. Das kannst du danach nicht mehr ändern.</p>`;
  return `<form class="dform" data-form="${id}" novalidate>${body}<div class="rowsmall"><button class="btn primary" type="submit">${esc(w === "Spenden" ? "Ja, spenden" : "Entscheid speichern")}</button></div></form>`;
}
async function submitDecision(id, btn) {
  const it = DATA.items.find(x => x.id === id), w = open[id]; if (!it || !w) return;
  const args = { p_token: TOKEN, p_item: id, p_wahl: w, p_preis: null, p_datum: null, p_notiz: null };
  if (w === "Preis senken") {
    const p = parsePrice(($("d-preis-" + id) || {}).value);
    if (p == null) return toast("Bitte einen neuen Preis eingeben.");
    if (it.preis != null && p >= Number(it.preis)) return toast("Der neue Preis muss tiefer sein als " + chf(it.preis) + ".");
    args.p_preis = p;
  }
  if (w === "Upcycling") {
    const r = document.querySelector(`input[name="d-wer-${CSS.escape(id)}"]:checked`);
    args.p_notiz = r ? r.value : "Selbst upcyceln";
    if (args.p_notiz === "Selbst upcyceln") args.p_datum = $("d-tag-" + id).value;
  }
  if (w === "Zurücknehmen") args.p_datum = $("d-tag-" + id).value;
  if (w === "Online") {
    if (!$("d-ok-" + id).checked) return toast("Bitte bestätige, dass du das Teil separat aufbewahrst und verschickst.");
    args.p_datum = $("d-tag-" + id).value;
  }
  btn.disabled = true; btn.textContent = "Wird gespeichert …";
  const { data, error } = await sb.rpc("owner_entscheid", args);
  if (error) { btn.disabled = false; btn.textContent = "Entscheid speichern"; return toast(niceErr(error), 5000); }
  DATA = data; delete open[id];
  render();
  toast(w === "Preis senken" ? "Neuer Preis gespeichert" : "Entscheid gespeichert. Danke!");
}

/* ---------- Anzeigen ---------- */
function render() {
  const o = DATA.owner, items = DATA.items;
  const ps = posts(), earned = round2(ps.reduce((s, p) => s + p.anteil, 0)), paid = round2(ps.filter(p => p.paid).reduce((s, p) => s + p.anteil, 0)), offen = round2(earned - paid);
  const unpaid = ps.filter(p => !p.paid).map(p => payoutDate(p.datum)).sort((a, b) => a - b)[0];
  const due = items.filter(isDue);
  const active = items.filter(i => !isDue(i) && !["Verkauft", "Zurückgegeben", "Gespendet"].includes(i.status));
  const done = items.filter(i => ["Verkauft", "Zurückgegeben", "Gespendet"].includes(i.status));
  const share = 100 - Number(o.provision);
  $("main").innerHTML = `
    <div class="ohead">
      <span class="sub">${esc(o.id)}</span>
      <h1 class="claim">Hallo ${esc(o.profilname)}</h1>
      <p class="lead">Hier siehst du jederzeit, wie es deinen Teilen geht. Von jedem Verkauf bekommst du ${esc(share)} %, von jeder Miete 70 %.</p>
    </div>
    <div class="okpis">
      <div class="okpi"><span class="klabel">Verdient bisher</span><span class="kval">${esc(chf(earned))}</span></div>
      <div class="okpi"><span class="klabel">Ausbezahlt</span><span class="kval">${esc(chf(paid))}</span></div>
      <div class="okpi ${offen > 0 ? "strong" : ""}"><span class="klabel">Kommt noch</span><span class="kval">${esc(chf(offen))}</span>${offen > 0 && unpaid ? `<span class="hint">Auszahlung am ${esc(fmt(unpaid))}</span>` : ""}</div>
    </div>
    ${due.length ? `<h2 class="osec">Jetzt entscheiden <span class="count">${due.length} ${due.length === 1 ? "Teil" : "Teile"}</span></h2><div class="olist">${due.map(row).join("")}</div>` : ""}
    <h2 class="osec">Deine Teile im Laden <span class="count">${active.length}</span></h2>
    <div class="olist">${active.length ? active.map(row).join("") : `<p class="hint">Gerade sind keine Teile von dir im Laden.</p>`}</div>
    ${done.length ? `<h2 class="osec">Abgeschlossen <span class="count">${done.length}</span></h2><div class="olist">${done.map(row).join("")}</div>` : ""}
    <div class="howto">
      <span class="klabel">So läuft es</span>
      <ol>
        <li><b>Monat 1:</b> Dein Teil hängt zu deinem Preis an der Stange. Eine Runde geht vom ersten bis zum letzten Samstag im Monat.</li>
        <li><b>Monat 2:</b> Ist es nicht verkauft, wählst du: Preis senken (Reduziert-Stange), upcyceln (Upcycling-Stange) oder zurücknehmen.</li>
        <li><b>Monat 3:</b> Dein Teil kommt ins Lager und bleibt online sichtbar. Oder du nimmst es zurück oder spendest es.</li>
        <li><b>Danach</b> holst du es an einem Samstag ab oder spendest es. Oder du verkaufst es auf der <b>Online-Stange</b> weiter: Es bleibt im Online-Shop, und du verschickst es, wenn jemand es kauft.</li>
      </ol>
    </div>`;
}
function noLink(msg) {
  $("main").innerHTML = `<div class="nolink"><h1 class="vtitle">Mein Frankly</h1><p class="lead">${esc(msg)}</p><p class="hint">Den persönlichen Link bekommst du von Frankly per E-Mail. Hast du ihn verloren? Frag im Laden nach einem neuen.</p></div>`;
}

/* ---------- Klicks ---------- */
document.addEventListener("change", e => {
  const r = e.target.closest("input[data-wahl]");
  if (r) { open[r.dataset.wahl] = r.value; const it = DATA.items.find(x => x.id === r.dataset.wahl); const box = document.querySelector(`#row-${CSS.escape(it.id)} .decide`); if (box) box.outerHTML = decideBox(it); const f = document.querySelector(`[data-form="${CSS.escape(it.id)}"] input, [data-form="${CSS.escape(it.id)}"] select`); if (f) f.focus({ preventScroll: true }); return; }
  const w = e.target.closest("input[name^='d-wer-']");
  if (w) { const id = w.name.slice(6), wrap = $("d-tag-wrap-" + id); if (wrap) wrap.hidden = w.value !== "Selbst upcyceln"; }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-online-ende]"); if (!b) return;
  if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Sicher? Nochmals tippen"; return; }
  b.disabled = true;
  const { data, error } = await sb.rpc("owner_online_ende", { p_token: TOKEN, p_item: b.dataset.onlineEnde });
  if (error) { b.disabled = false; return toast(niceErr(error), 5000); }
  DATA = data; render(); toast("Danke, das Teil ist jetzt nicht mehr online.");
});
document.addEventListener("submit", e => {
  const f = e.target.closest("form[data-form]"); if (!f) return;
  e.preventDefault(); submitDecision(f.dataset.form, f.querySelector("button[type=submit]"));
});

/* ---------- Start ---------- */
async function loadPhotos() {
  const paths = [...new Set(DATA.items.map(i => i.foto_pfad).filter(Boolean))];
  for (const p of paths) {
    let r = await sb.storage.from(CFG.bucket || "fotos").createSignedUrl("thumbs/" + p, 60 * 60 * 6);
    if (!(r.data && r.data.signedUrl)) r = await sb.storage.from(CFG.bucket || "fotos").createSignedUrl(p, 60 * 60 * 6);
    if (r.data && r.data.signedUrl) URLS[p] = r.data.signedUrl;
  }
}
async function init() {
  TOKEN = new URLSearchParams(location.search).get("k");
  if (!TOKEN) return noLink("Öffne diese Seite mit deinem persönlichen Link.");
  if (!window.supabase || !CFG) return noLink("Die Seite konnte nicht geladen werden. Bitte neu laden.");
  sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "frankly-owner" } });
  const { data, error } = await sb.rpc("owner_portal", { p_token: TOKEN });
  if (error) return noLink(niceErr(error));
  if (!data) return noLink("Dieser Link ist nicht mehr gültig.");
  DATA = data;
  render();
  await loadPhotos();
  DATA.items.forEach(it => { const t = document.querySelector(`#row-${CSS.escape(it.id)} .othumb`); if (t && URLS[it.foto_pfad]) t.innerHTML = thumb(it); });
}
init();
