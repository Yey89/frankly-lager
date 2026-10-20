/* =========================================================
   0–100 FRANKLY · LAGER · Tab «Erkenntnisse»
   Wertet die eigenen Daten aus (was verkauft sich, was bleibt liegen, was geben
   Owner ab und warum, was tragen Kundinnen seit Jahren) und sammelt
   «Lieblingsteile»-Karten. Grundlage für die spätere Kollektion.
   Läuft nach app.js und nutzt dessen Daten (ITEMS, RENTALS, ANFRAGEN, sb …).
   ========================================================= */
"use strict";

const GETRAGEN = ["Nie", "Selten", "Oft", "Jahrelang"];
const ABGABE = ["Passt nicht mehr", "Passform stimmte nie", "Stil passt nicht mehr", "Nie getragen", "Zu viele ähnliche", "Wusste nicht, wie kombinieren", "Abgenutzt", "Anderes"];
const GRUENDE = ["Passform", "Qualität", "Bequem", "Vielseitig kombinierbar", "Zeitlose Farbe", "Fühle mich darin wie ich", "Erinnerung", "Pflegeleicht"];
let LIEB = [], liebState = "idle", insightsDim = "kategorie";

async function loadLieb() {
  if (liebState === "loading") return;
  liebState = "loading";
  const r = await sb.from("lieblingsteile").select("*").order("created_at", { ascending: false });
  LIEB = r.error ? [] : (r.data || []);
  liebState = r.error ? "missing" : "ok";
  renderInsights();
}

/* ---------- Rechnen ---------- */
function dayDiff(a, b) { const x = parseD(String(a || "").slice(0, 10)), y = parseD(String(b || "").slice(0, 10)); return x && y ? Math.max(0, Math.round((y - x) / 864e5)) : null; }
function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); }
function pct(x) { return Math.round(x * 100) + " %"; }
function priceBand(p) { if (p == null || p === "") return null; p = Number(p); return p <= 20 ? "CHF 0–20" : p <= 40 ? "CHF 21–40" : p <= 60 ? "CHF 41–60" : "CHF 61–100"; }
function firstWord(v) {
  if (!v || isOpen(v)) return null;
  const w = String(v).split(/,|\/|&|\+| und /)[0].replace(/\(.*?\)/g, "").trim().toLowerCase();
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : null;
}
function sizeKeys(i) {
  if (!SZ) return [];
  const g = SZ.group(i.kategorie), s = SZ.parse(i.groesse, i.kategorie).filter(x => x !== "ONE");
  const pre = { oben: "Oben", unten: "Unten", schuhe: "Schuhe" }[g];
  return pre ? s.map(x => `${pre} ${x}`) : [];
}
const DIMS = {
  kategorie: { label: "Kategorie", key: i => i.kategorie || null },
  groesse: { label: "Grösse", key: sizeKeys },
  preis: { label: "Preis", key: i => priceBand(i.verkauf_preis != null ? i.verkauf_preis : i.preis) },
  farbe: { label: "Farbe", key: i => firstWord(i.farben) },
  material: { label: "Material", key: i => firstWord(i.material) },
  marke: { label: "Marke", key: i => firstWord(i.marke) },
  stufe: { label: "Verkauft in Stufe", key: i => i.status === "Verkauft" ? (STUFE_TXT[i.stufe || "Stange"] || i.stufe) : null }
};
function counted() { return ITEMS.filter(i => i.status !== "Entwurf"); }
function groupStats(dim) {
  const m = {}, fn = DIMS[dim].key;
  counted().forEach(i => {
    let ks = fn(i); if (!Array.isArray(ks)) ks = [ks];
    ks.filter(Boolean).forEach(k => {
      const r = m[k] = m[k] || { k, n: 0, sold: 0, days: [], rent: 0, anf: 0 };
      r.n++;
      if (i.status === "Verkauft") { r.sold++; const d = dayDiff(i.created_at, i.verkauf_datum); if (d != null) r.days.push(d); }
      r.rent += RENTALS.filter(x => x.item_id === i.id).length;
      r.anf += ANFRAGEN.filter(a => a.item_id === i.id).length;
    });
  });
  return Object.values(m).map(r => Object.assign(r, { quote: r.n ? r.sold / r.n : 0, med: median(r.days) }))
    .sort((a, b) => b.quote - a.quote || b.n - a.n);
}
function countList(values, order) {
  const m = {}; values.filter(Boolean).forEach(v => { m[v] = (m[v] || 0) + 1; });
  const keys = order ? order.filter(k => m[k]) : Object.keys(m);
  return keys.map(k => ({ k, n: m[k] })).sort((a, b) => b.n - a.n);
}

/* ---------- Anzeigen ---------- */
function bars(list, total) {
  if (!list.length) return `<p class="hint">Noch keine Angaben.</p>`;
  const max = Math.max(...list.map(x => x.n));
  return `<div class="ibars">${list.map(x => `<div class="ibar"><span class="ik">${esc(x.k)}</span><span class="qbar"><i style="width:${Math.round(x.n / max * 100)}%"></i></span><span class="iv">${x.n}${total ? ` · ${pct(x.n / total)}` : ""}</span></div>`).join("")}</div>`;
}
function fazit() {
  const all = counted(), sold = all.filter(i => i.status === "Verkauft");
  const out = [];
  if (!all.length) return `<p class="hint">Sobald Teile erfasst und verkauft sind, steht hier, was gut läuft.</p>`;
  const med = median(sold.map(i => dayDiff(i.created_at, i.verkauf_datum)).filter(d => d != null));
  out.push(`<b>${all.length}</b> Teile erfasst, <b>${sold.length}</b> verkauft (${pct(sold.length / all.length)})${med != null ? `, im Schnitt nach <b>${med} Tagen</b>` : ""}.`);
  const best = (dim, word) => {
    const rows = groupStats(dim).filter(r => r.n >= 3);
    if (rows.length < 2) return;
    const top = rows[0], low = rows[rows.length - 1];
    if (top.quote > low.quote) out.push(`${word}: am besten <b>${esc(top.k)}</b> (${top.sold} von ${top.n} verkauft), am schwächsten <b>${esc(low.k)}</b> (${low.sold} von ${low.n}).`);
  };
  best("kategorie", "Kategorie"); best("groesse", "Grösse"); best("preis", "Preis"); best("farbe", "Farbe");
  const fit = all.filter(i => ["Passform stimmte nie", "Passt nicht mehr"].includes(i.abgabe_grund)).length, withG = all.filter(i => i.abgabe_grund).length;
  if (withG >= 5) out.push(`<b>${pct(fit / withG)}</b> der abgegebenen Teile gingen wegen der Passform weg. Das ist ein Hinweis für deine Schnitte.`);
  if (sold.length < 50) out.push(`<span class="hint">Noch wenig Daten. Ab etwa 50 verkauften Teilen werden die Trends verlässlich.</span>`);
  return `<ul class="ifazit">${out.map(x => `<li>${x}</li>`).join("")}</ul>`;
}
function statTable() {
  const rows = groupStats(insightsDim).slice(0, 15);
  const sw = Object.entries(DIMS).map(([k, d]) => `<button class="chip" type="button" data-idim="${k}" aria-pressed="${k === insightsDim}">${esc(d.label)}</button>`).join("");
  const body = rows.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>${esc(DIMS[insightsDim].label)}</th><th>Erfasst</th><th>Verkauft</th><th>Quote</th><th>Tage bis Verkauf</th><th>Mieten</th><th>Anfragen</th></tr></thead><tbody>${rows.map(r => `
      <tr><td>${esc(r.k)}</td><td>${r.n}</td><td>${r.sold}</td><td><span class="qbar sm"><i style="width:${Math.round(r.quote * 100)}%"></i></span> ${pct(r.quote)}</td><td>${r.med != null ? r.med : "–"}</td><td>${r.rent || "–"}</td><td>${r.anf || "–"}</td></tr>`).join("")}</tbody></table></div>`
    : `<p class="hint">Noch keine Daten für diese Auswertung. Fülle beim Erfassen ${esc(DIMS[insightsDim].label)} aus.</p>`;
  return `<div class="chips" style="margin-bottom:10px">${sw}</div>${body}<p class="hint">Quote = verkauft geteilt durch erfasst. «Tage bis Verkauf» ist der Median. Gruppen mit weniger als 3 Teilen sind noch Zufall.</p>`;
}
function ownerBlock() {
  const all = counted(), g = all.filter(i => i.abgabe_grund), t = all.filter(i => i.getragen);
  return `<div class="igrid">
    <div><div class="klabel">Warum abgegeben</div>${bars(countList(g.map(i => i.abgabe_grund), ABGABE), g.length)}</div>
    <div><div class="klabel">Wie oft getragen</div>${bars(countList(t.map(i => i.getragen), GETRAGEN), t.length)}</div>
  </div><p class="hint">Diese zwei Fragen stellst du beim Erfassen der Owner-Teile («Getragen» und «Warum abgegeben»). Sie zeigen, was NICHT im Kleiderschrank bleibt.</p>`;
}
function liebBlock() {
  if (liebState === "missing") return `<p class="hint">Für Lieblingsteile bitte zuerst 08_erkenntnisse.sql in Supabase ausführen.</p>`;
  const n = LIEB.length, jahre = median(LIEB.map(l => l.jahre).filter(x => x != null));
  const form = `
    <form class="form box" id="liebForm" novalidate>
      <div class="sec" style="margin:0">Neue Karte eintragen</div>
      <div class="two"><label>Was für ein Teil<select id="lb-kat"><option value="">–</option>${BASE_CATS.map(c => `<option>${esc(c)}</option>`).join("")}</select></label>
      <label>Seit wie vielen Jahren getragen<input id="lb-jahre" inputmode="numeric" placeholder="z.B. 8"></label></div>
      <div class="two"><label>Farbe<input id="lb-farbe" placeholder="z.B. schwarz"></label><label>Material<input id="lb-material" placeholder="z.B. Wolle"></label></div>
      <label>Stil-Energie<select id="lb-stil"><option value="">–</option>${STYLES.map(s => `<option>${s}</option>`).join("")}</select></label>
      <div class="field"><span class="flabel">Warum bleibt es? Mehrere möglich</span><div class="chips">${GRUENDE.map(g => `<button class="chip" type="button" data-lbg="${esc(g)}" aria-pressed="false">${esc(g)}</button>`).join("")}</div></div>
      <label>In ihren Worten (freiwillig)<input id="lb-notiz" placeholder="z.B. «Darin fühle ich mich stark»"></label>
      <div class="rowsmall"><button class="btn primary" type="submit">Karte speichern</button></div>
    </form>`;
  const sum = n ? `<div class="igrid">
      <div><div class="klabel">Warum Teile bleiben</div>${bars(countList(LIEB.flatMap(l => l.gruende || [])), n)}</div>
      <div><div class="klabel">Welche Teile</div>${bars(countList(LIEB.map(l => l.kategorie)), n)}<div class="klabel" style="margin-top:12px">Material</div>${bars(countList(LIEB.map(l => firstWord(l.material))), n)}</div>
    </div>
    <p><b>${n}</b> ${n === 1 ? "Karte" : "Karten"}${jahre != null ? ` · im Schnitt seit <b>${jahre} Jahren</b> getragen` : ""}.</p>
    <ul class="rlist">${LIEB.slice(0, 8).map(l => `<li><span>${esc([l.kategorie, firstWord(l.farbe), firstWord(l.material)].filter(Boolean).join(" · ") || "Teil")}</span><span>${l.jahre != null ? esc(l.jahre) + " J." : ""}${l.stil ? " · " + esc(l.stil) : ""}</span><span class="hint">${esc((l.gruende || []).join(", "))}${l.notiz ? " · «" + esc(l.notiz) + "»" : ""}</span><button class="btn ghost" type="button" data-lbdel="${esc(l.id)}">Löschen</button></li>`).join("")}</ul>`
    : `<p class="hint">Noch keine Karten. Lege im Denkraum Karten auf: «Welches Kleidungsstück trägst du seit Jahren, und warum?» Die Antworten trägst du hier ein.</p>`;
  return sum + form;
}
const STUDIEN = [
  { t: "Frauen in Deutschland besitzen im Schnitt 107 Kleidungsstücke. 85 % wollen ihre Kleider länger tragen, Schuhe werden am schnellsten weggegeben.", q: "Greenpeace-Umfrage 2022", u: "https://fashionunited.de/nachrichten/mode/greenpeace-umfrage-340-millionen-kleidungstuecke-weniger-in-deutschen-schraenken/2022072747596" },
  { t: "Ein Kleidungsstück wird heute rund 36 % seltener getragen als 15 Jahre zuvor.", q: "Ellen MacArthur Foundation 2017", u: "https://www.retaildive.com/news/textile-waste-increased-811-since-1960/559351/" },
  { t: "Erwachsene geben Kleider vor allem wegen Abnutzung ab, Modewechsel ist selten der Grund. Länger hält, was gute Stoffe und Nähte hat, sich an den Körper anpassen lässt, repariert werden kann und mit Rückmeldung der Trägerinnen entworfen wurde.", q: "Laitala, Boks & Klepp 2015, Norwegen", u: "https://environment-review.yale.edu/node/4416" },
  { t: "Frauen behalten Kleider lange, die sie oft tragen und mit denen sie Erinnerungen verbinden. Ändern und Flicken verlängern die Bindung.", q: "Studie zu emotional langlebiger Mode, Radboud Universität", u: "https://theses.ubn.ru.nl/handle/123456789/13170" }
];
function studienBlock() {
  return `<ul class="istudien">${STUDIEN.map(s => `<li>${esc(s.t)} <a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.q)}</a></li>`).join("")}</ul>
    <p><b>Was das für deine Kollektion heisst:</b> gute Stoffe und Nähte, Schnitte mit Spielraum (Wickel, Bindebänder, verstellbarer Bund), Reparatur und Anpassen als Service, und genau diese Rückmeldung von Trägerinnen, die du hier sammelst.</p>`;
}
function renderInsights() {
  const el = $("insights"); if (!el) return;
  if (liebState === "idle") { loadLieb(); }
  el.innerHTML = `
    <div class="box"><div class="sec" style="margin:0 0 6px">Kurzfazit</div>${fazit()}</div>
    <div class="sec">Was verkauft sich?</div>${statTable()}
    <div class="sec">Was NICHT im Kleiderschrank bleibt · Owner-Teile</div>${ownerBlock()}
    <div class="sec">Was im Kleiderschrank BLEIBT · Lieblingsteile</div>${liebBlock()}
    <div class="sec">Was die Forschung sagt</div>${studienBlock()}
    <div class="rowsmall" style="margin-top:18px"><button class="btn" type="button" id="csvBtn">Alle Teile als Tabelle herunterladen (CSV)</button></div>`;
}

/* ---------- Aktionen ---------- */
async function saveLieb(form) {
  const jahre = parseInt(($("lb-jahre").value || "").replace(/\D/g, ""), 10);
  const row = { kategorie: val("lb-kat"), farbe: val("lb-farbe"), material: val("lb-material"), stil: val("lb-stil"),
    jahre: isNaN(jahre) ? null : Math.min(80, jahre), notiz: val("lb-notiz"),
    gruende: [...form.querySelectorAll('[data-lbg][aria-pressed="true"]')].map(b => b.dataset.lbg) };
  if (!row.kategorie && !row.gruende.length) return toast("Bitte mindestens das Teil oder einen Grund angeben.");
  const btn = form.querySelector("button[type=submit]"); busy(btn, true);
  const { data, error } = await sb.from("lieblingsteile").insert(row).select().single();
  busy(btn, false);
  if (error) return toast(nice(error), 4500);
  LIEB.unshift(data); renderInsights(); toast("Karte gespeichert");
}
async function delLieb(id, btn) {
  if (!confirmTap(btn, "lb" + id, "Nochmals tippen")) return;
  const { error } = await sb.from("lieblingsteile").delete().eq("id", id);
  if (error) return toast(nice(error), 4500);
  LIEB = LIEB.filter(l => l.id !== id); renderInsights();
}
function csvExport() {
  const cols = ["nr", "titel", "kategorie", "groesse", "shop_groesse", "farben", "material", "marke", "preis", "status", "stufe", "owner_id", "erfasst", "verkauf_datum", "verkauf_preis", "tage_bis_verkauf", "getragen", "abgabe_grund", "mieten", "anfragen"];
  const q = v => { v = v == null ? "" : String(v); return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const lines = [cols.join(";")].concat(ITEMS.map(i => [i.nr, i.titel, i.kategorie, i.groesse, SZ ? SZ.parse(i.groesse, i.kategorie).join("/") : "", i.farben, i.material, i.marke, i.preis, i.status, i.stufe, i.owner_id,
    String(i.created_at || "").slice(0, 10), i.verkauf_datum, i.verkauf_preis, i.status === "Verkauft" ? dayDiff(i.created_at, i.verkauf_datum) : "", i.getragen, i.abgabe_grund,
    RENTALS.filter(r => r.item_id === i.id).length, ANFRAGEN.filter(a => a.item_id === i.id).length].map(q).join(";")));
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `frankly-teile-${iso(today())}.csv`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || !$("insights") || !$("insights").contains(b)) return;
  if (b.dataset.idim) { insightsDim = b.dataset.idim; renderInsights(); return; }
  if (b.dataset.lbg) { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"); return; }
  if (b.dataset.lbdel) return delLieb(b.dataset.lbdel, b);
  if (b.id === "csvBtn") return csvExport();
});
document.addEventListener("submit", e => { if (e.target && e.target.id === "liebForm") { e.preventDefault(); saveLieb(e.target); } });
