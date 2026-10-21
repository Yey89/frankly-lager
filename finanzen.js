/* =========================================================
   0–100 FRANKLY · LAGER · Tab «Finanzen»
   Ziel pro Monat (Menge × Ø Preis) neben dem, was wirklich passiert ist.
   Automatisch: Verkäufe (Owner-Teile und Frankly-Teile) und Vermietungen.
   Von Hand: Servicepauschale, Workshop, Create Together, Basteltisch, Anpassungen …
   Läuft nach app.js. Braucht supabase/18_finanzen.sql.
   ========================================================= */
"use strict";

const FIN_ARTEN = ["Servicepauschale", "Workshop", "Create Together", "Basteltisch", "Anpassung", "Mitgliedschaft", "Zuschlag Nichtmitglieder", "Anderes"];
/* Reihenfolge und Beschreibung der Zeilen. art = Name in «einnahmen» (von Hand) */
const FIN_QUELLEN = [
  { q: "Verkauf Owner-Teile", auto: true, einheit: "Teile", txt: "Deine Provision auf verkaufte Owner-Teile" },
  { q: "Frankly-Teile", auto: true, einheit: "Teile", txt: "Deine eigenen Teile, 100 % für dich" },
  { q: "Vermietung", auto: true, einheit: "Vermietungen", txt: "Dein Anteil an der Miete" },
  { q: "Servicepauschale", art: "Servicepauschale", einheit: "Owner", txt: "pro Owner bei der Abgabe" },
  { q: "Workshop", art: "Workshop", einheit: "Personen", txt: "Teilnehmende im Monat" },
  { q: "Create Together", art: "Create Together", einheit: "Termine", txt: "Begleitung bei eigenen Ideen" },
  { q: "Basteltisch", art: "Basteltisch", einheit: "Besuche", txt: "Platz und Material" },
  { q: "Anpassung", art: "Anpassung", einheit: "Aufträge", txt: "Kürzen, enger machen" },
  { q: "Mitgliedschaft", art: "Mitgliedschaft", einheit: "Mitglieder", txt: "Frankly Friends, Beitrag pro Monat" },
  { q: "Zuschlag Nichtmitglieder", art: "Zuschlag Nichtmitglieder", einheit: "Teile", txt: "Zuschlag pro Teil für Nichtmitglieder" },
  { q: "Anderes", art: "Anderes", einheit: "", txt: "alles andere" }
];
let FIN_E = [], FIN_Z = {}, finState = "idle", finMonat = null, finEdit = false;

function finMonthKey(d) { return String(d).slice(0, 7); }
function finNowKey() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; }
function finLabel(k) { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" }); }
function finShift(k, n) { const [y, m] = k.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function finStart() { const z = FIN_Z.Start; if (z && z.anzahl > 190000) { const v = Math.round(z.anzahl); return `${Math.floor(v / 100)}-${String(v % 100).padStart(2, "0")}`; } return finNowKey(); }
function finMonthNo(k) { const [y1, m1] = finStart().split("-").map(Number), [y2, m2] = k.split("-").map(Number); return (y2 - y1) * 12 + (m2 - m1) + 1; }
function finQ(k) { const n = finMonthNo(k); return n < 1 ? 1 : n > 12 ? 4 : Math.ceil(n / 3); }
function finZ(q, quelle) { return FIN_Z[`Q${q}|${quelle}`] || { anzahl: 0, preis: 0 }; }
function fchf(n) { return "CHF " + Math.round(Number(n) || 0).toLocaleString("de-CH"); }

async function loadFin() {
  finState = "loading";
  const [e, z] = await Promise.all([
    sb.from("einnahmen").select("*").order("datum", { ascending: false }),
    sb.from("finanz_ziele").select("*")
  ]);
  if (e.error || z.error) { finState = "missing"; return renderFinanzen(); }
  FIN_E = e.data || []; FIN_Z = {};
  (z.data || []).forEach(r => { FIN_Z[r.quelle] = { anzahl: Number(r.anzahl), preis: Number(r.preis) }; });
  finState = "ok"; renderFinanzen();
}
/* Was wirklich passiert ist, im gewählten Monat */
function finIst(k) {
  const ist = {};
  const sold = ITEMS.filter(i => i.status === "Verkauft" && i.verkauf_datum && finMonthKey(i.verkauf_datum) === k);
  const own = sold.filter(i => i.owner_id !== SELF), self = sold.filter(i => i.owner_id === SELF);
  ist["Verkauf Owner-Teile"] = { n: own.length, chf: own.reduce((s, i) => { const p = i.verkauf_provision != null ? Number(i.verkauf_provision) : ownerProv(i.owner_id); return s + (saleAmount(i) || 0) * p / 100; }, 0), umsatz: own.reduce((s, i) => s + (saleAmount(i) || 0), 0) };
  ist["Frankly-Teile"] = { n: self.length, chf: self.reduce((s, i) => s + (saleAmount(i) || 0), 0) };
  const rents = RENTALS.filter(r => r.von && finMonthKey(r.von) === k);
  ist["Vermietung"] = { n: rents.length, chf: rents.reduce((s, r) => { const it = ITEMS.find(x => x.id === r.item_id); const p = it && it.owner_id === SELF ? 100 : Number(r.provision_prozent); return s + Number(r.betrag) * p / 100; }, 0), umsatz: rents.reduce((s, r) => s + Number(r.betrag), 0) };
  FIN_QUELLEN.filter(x => x.art).forEach(x => {
    const es = FIN_E.filter(e => e.art === x.art && finMonthKey(e.datum) === k);
    ist[x.q] = { n: es.reduce((s, e) => s + Number(e.anzahl || 0), 0), chf: es.reduce((s, e) => s + Number(e.betrag), 0) };
  });
  return ist;
}
function finZielChf(q, quarter) {
  const z = finZ(quarter, q); if (!z) return 0;
  if (q === "Verkauf Owner-Teile") return z.anzahl * z.preis * 0.10;  // Provision 10 %
  if (q === "Vermietung") return z.anzahl * z.preis * 0.30;           // Anteil 30 %
  return z.anzahl * z.preis;
}
function finZielTxt(q, einheit, quarter) {
  const z = finZ(quarter, q); if (!z || (!z.anzahl && !z.preis)) return `<span class="hint">kein Ziel</span>`;
  const extra = q === "Verkauf Owner-Teile" ? " · davon 10 %" : q === "Vermietung" ? " · davon 30 %" : "";
  return `${z.anzahl} ${esc(einheit)} × Ø ${fchf(z.preis)}${extra}`;
}
function renderFinanzen(reload) {
  const el = $("finanzen"); if (!el) return;
  if (!finMonat) finMonat = finNowKey();
  if (reload || finState === "idle") { if (finState !== "loading") loadFin(); }
  if (finState === "missing") { el.innerHTML = `<p class="hint">Bitte zuerst <b>18_finanzen.sql</b> in Supabase ausführen.</p>`; return; }
  if (finState !== "ok") { el.innerHTML = `<p class="loading">Finanzen werden geladen …</p>`; return; }
  if (!Object.keys(FIN_Z).some(x => /^Q\d\|/.test(x))) { el.innerHTML = `<p class="hint">Bitte noch <b>19_finanzen_jahr.sql</b> in Supabase ausführen.</p>`; return; }
  const k = finMonat, ist = finIst(k), Q = finQ(k), mNo = finMonthNo(k);
  const rows = FIN_QUELLEN.map(x => {
    const zc = finZielChf(x.q, Q), ic = (ist[x.q] || {}).chf || 0, n = (ist[x.q] || {}).n || 0;
    if (!zc && !ic && !finEdit && (x.q === "Mitgliedschaft" || x.q === "Anderes")) return "";
    const pct = zc ? Math.min(100, Math.round(ic / zc * 100)) : (ic ? 100 : 0);
    const z = finZ(Q, x.q);
    return `<tr>
      <td><b>${esc(x.q)}</b>${x.auto ? ` <span class="pill">automatisch</span>` : ""}<br><span class="hint">${esc(x.txt)}</span></td>
      <td>${finEdit ? `<span class="finedit"><input type="number" min="0" step="1" data-zn="${esc(x.q)}" value="${z.anzahl}" aria-label="Ziel Anzahl ${esc(x.q)}"> × CHF <input type="number" min="0" step="1" data-zp="${esc(x.q)}" value="${z.preis}" aria-label="Ziel Ø Preis ${esc(x.q)}"></span>` : finZielTxt(x.q, x.einheit, Q)}<br><b>${fchf(zc)}</b></td>
      <td>${n} ${esc(x.einheit)}${ist[x.q] && ist[x.q].umsatz ? `<br><span class="hint">Umsatz ${fchf(ist[x.q].umsatz)}</span>` : ""}<br><b>${fchf(ic)}</b></td>
      <td class="finbar"><span class="bar"><i style="width:${pct}%"></i></span><span class="hint">${pct} %</span></td>
    </tr>`;
  }).join("");
  const zSum = FIN_QUELLEN.reduce((s, x) => s + finZielChf(x.q, Q), 0), iSum = FIN_QUELLEN.reduce((s, x) => s + ((ist[x.q] || {}).chf || 0), 0);
  const kosten = finZ(Q, "Kosten").anzahl * finZ(Q, "Kosten").preis;
  const dayPct = k === finNowKey() ? Math.round(new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() * 100) : null;
  const me = FIN_E.filter(e => finMonthKey(e.datum) === k).sort((x, y) => String(y.datum).localeCompare(String(x.datum)));
  el.innerHTML = `
    <div class="finhead">
      <button class="btn" type="button" data-finm="-1" aria-label="Monat zurück">←</button>
      <b class="finmonth">${esc(finLabel(k))}</b>
      <button class="btn" type="button" data-finm="1" aria-label="Monat vor">→</button>
      ${k !== finNowKey() ? `<button class="btn ghost" type="button" data-finm="0">Heute</button>` : ""}
      <span class="hint">${mNo >= 1 && mNo <= 12 ? `Monat ${mNo} von 12 · Ziele für Monat ${Q * 3 - 2}–${Q * 3}` : mNo < 1 ? "vor dem Start · Ziele Monat 1–3" : "nach dem ersten Jahr · Ziele Monat 10–12"}</span>
    </div>
    <div class="finsum">
      <div><span class="lbl">Einnahmen bis jetzt</span><b>${fchf(iSum)}</b><span class="hint">Ziel ${fchf(zSum)}</span></div>
      <div><span class="lbl">Bleibt (nach Kosten ${fchf(kosten)})</span><b class="${iSum - kosten >= zSum - kosten ? "ok" : ""}">${fchf(iSum - kosten)}</b><span class="hint">Ziel ${fchf(zSum - kosten)}</span></div>
      <div><span class="lbl">Fortschritt</span><b>${zSum ? Math.round(iSum / zSum * 100) : 0} %</b><span class="hint">${dayPct != null ? `vom Monat vorbei: ${dayPct} %` : ""}</span></div>
    </div>
    <div class="fintable"><table class="fin">
      <thead><tr><th>Einnahmequelle</th><th>Ziel pro Monat (Monat ${Q * 3 - 2}–${Q * 3})</th><th>Erreicht</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="rowsmall">${finEdit ? `<button class="btn primary" type="button" data-finsave>Ziele speichern</button><label style="display:inline-flex;gap:6px;align-items:center">Kosten pro Monat CHF <input type="number" min="0" step="10" id="finKost" value="${kosten}" style="width:90px"></label><label style="display:inline-flex;gap:6px;align-items:center">Startmonat <input type="month" id="finStart" value="${finStart()}"></label><button class="btn ghost" type="button" data-finedit>Abbrechen</button>` : `<button class="btn" type="button" data-finedit>Ziele anpassen</button>`}</div>

    ${finYear()}
    <form class="box finform" id="finForm" novalidate>
      <div class="sec" style="margin:0 0 6px">Einnahme erfassen</div>
      <div class="finrow">
        <label>Was<select id="fi-art">${FIN_ARTEN.map(a => `<option>${a}</option>`).join("")}</select></label>
        <label>Anzahl<input id="fi-n" type="number" min="0" step="1" value="1"></label>
        <label>Betrag total CHF<input id="fi-b" type="number" min="0" step="0.05" placeholder="z.B. 45"></label>
        <label>Datum<input id="fi-d" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
      </div>
      <label>Notiz (freiwillig)<input id="fi-t" maxlength="300" placeholder="z.B. Workshop Häkeln, 6 Personen"></label>
      <div class="rowsmall"><button class="btn primary" type="submit">Speichern</button><span class="hint">Verkäufe und Vermietungen musst du hier nicht eintragen, die kommen automatisch.</span></div>
    </form>
    ${me.length ? `<div class="sec">Von Hand erfasst im ${esc(finLabel(k))}</div>
    <ul class="rlist">${me.map(e => `<li><span>${esc(String(e.datum).split("-").reverse().join("."))}</span><span><b>${esc(e.art)}</b> · ${e.anzahl}× · ${fchf(e.betrag)}${e.notiz ? `<br><span class="hint">${esc(e.notiz)}</span>` : ""}</span><span><button class="btn ghost" type="button" data-findel="${esc(e.id)}" aria-label="Eintrag löschen">✕</button></span></li>`).join("")}</ul>` : ""}
    <p class="hint">Ziele sind deine Annahmen aus dem Finanzplan fürs erste Jahr. «Ziele anpassen» ändert die Ziele des angezeigten Quartals. Beträge vor AHV und Steuern.</p>`;
}
/* Jahresübersicht: pro Quartal Ziel (× 3 Monate) neben dem Erreichten */
function finYear() {
  const start = finStart(), now = finNowKey();
  const rows = [1, 2, 3, 4].map(q => {
    const ziel = FIN_QUELLEN.reduce((s, x) => s + finZielChf(x.q, q), 0) - finZ(q, "Kosten").anzahl * finZ(q, "Kosten").preis;
    let ist = 0, done = 0;
    for (let i = 0; i < 3; i++) {
      const k = finShift(start, (q - 1) * 3 + i); if (k > now) continue; done++;
      const is = finIst(k); ist += FIN_QUELLEN.reduce((s, x) => s + ((is[x.q] || {}).chf || 0), 0) - finZ(q, "Kosten").anzahl * finZ(q, "Kosten").preis;
    }
    const cur = finQ(now) === q && finMonthNo(now) >= 1 && finMonthNo(now) <= 12;
    return `<tr${cur ? ' class="cur"' : ""}><td><b>Monat ${q * 3 - 2}–${q * 3}</b><br><span class="hint">${esc(finLabel(finShift(start, (q - 1) * 3)))} – ${esc(finLabel(finShift(start, q * 3 - 1)))}</span></td>
      <td>${fchf(ziel)} / Monat<br><b>${fchf(ziel * 3)}</b></td><td>${done ? `${done} von 3 Monaten<br><b>${fchf(ist)}</b>` : `<span class="hint">noch nicht</span>`}</td></tr>`;
  }).join("");
  return `<div class="sec">Das erste Jahr · was bleibt nach Kosten</div><div class="fintable"><table class="fin finyear"><thead><tr><th>Quartal</th><th>Ziel</th><th>Erreicht</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
async function finAdd(form) {
  const art = $("fi-art").value, n = parseInt($("fi-n").value, 10) || 0, b = parseFloat($("fi-b").value), d = $("fi-d").value;
  if (isNaN(b)) return toast("Bitte den Betrag eingeben.");
  const btn = form.querySelector('[type="submit"]'); busy(btn, true);
  const { data, error } = await sb.from("einnahmen").insert({ art, anzahl: n, betrag: b, datum: d || undefined, notiz: $("fi-t").value.trim() || null }).select().single();
  busy(btn, false);
  if (error) return toast(nice(error), 4500);
  FIN_E = [data].concat(FIN_E); finMonat = finMonthKey(data.datum); renderFinanzen(); toast(`${art} gespeichert`);
}
async function finDel(id, btn) {
  if (!confirmTap(btn, "findel" + id, "Löschen? Nochmals tippen")) return;
  const { error } = await sb.from("einnahmen").delete().eq("id", id);
  if (error) return toast(nice(error), 4500);
  FIN_E = FIN_E.filter(e => e.id !== id); renderFinanzen();
}
async function finSave(btn) {
  const Q = finQ(finMonat);
  const rows = FIN_QUELLEN.map(x => ({ quelle: `Q${Q}|${x.q}`, anzahl: parseFloat(document.querySelector(`[data-zn="${CSS.escape(x.q)}"]`).value) || 0, preis: parseFloat(document.querySelector(`[data-zp="${CSS.escape(x.q)}"]`).value) || 0 }));
  rows.push({ quelle: `Q${Q}|Kosten`, anzahl: 1, preis: parseFloat($("finKost").value) || 0 });
  const st = ($("finStart").value || "").split("-"); if (st.length === 2) rows.push({ quelle: "Start", anzahl: Number(st[0]) * 100 + Number(st[1]), preis: 0 });
  busy(btn, true);
  const { error } = await sb.from("finanz_ziele").upsert(rows);
  busy(btn, false);
  if (error) return toast(nice(error), 4500);
  rows.forEach(r => { FIN_Z[r.quelle] = { anzahl: r.anzahl, preis: r.preis }; });
  finEdit = false; renderFinanzen(); toast("Ziele gespeichert");
}
document.addEventListener("submit", e => { if (e.target.id === "finForm") { e.preventDefault(); finAdd(e.target); } });
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || !$("finanzen") || !$("finanzen").contains(b)) return;
  if (b.dataset.finm != null) { const n = Number(b.dataset.finm); finMonat = n === 0 ? finNowKey() : finShift(finMonat, n); renderFinanzen(); return; }
  if (b.hasAttribute("data-finedit")) { finEdit = !finEdit; renderFinanzen(); return; }
  if (b.hasAttribute("data-finsave")) return finSave(b);
  if (b.dataset.findel) return finDel(b.dataset.findel, b);
});
