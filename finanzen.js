/* =========================================================
   0–100 FRANKLY · LAGER · Tab «Finanzen»
   Ziel pro Monat (Menge × Ø Preis) neben dem, was wirklich passiert ist.
   Automatisch: Verkäufe (Owner-Teile und Frankly-Teile) und Vermietungen.
   Von Hand: Servicepauschale, Workshop, Create Together, Basteltisch, Anpassungen …
   Läuft nach app.js. Braucht supabase/18_finanzen.sql.
   ========================================================= */
"use strict";

const FIN_ARTEN = ["Servicepauschale", "Workshop", "Create Together", "Basteltisch", "Anpassung", "Mitgliedschaft", "Anderes"];
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
  { q: "Mitgliedschaft", art: "Mitgliedschaft", einheit: "Mitglieder", txt: "später" },
  { q: "Anderes", art: "Anderes", einheit: "", txt: "alles andere" }
];
let FIN_E = [], FIN_Z = {}, finState = "idle", finMonat = null, finEdit = false;

function finMonthKey(d) { return String(d).slice(0, 7); }
function finNowKey() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`; }
function finLabel(k) { const [y, m] = k.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("de-CH", { month: "long", year: "numeric" }); }
function finShift(k, n) { const [y, m] = k.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
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
function finZielChf(q) {
  const z = FIN_Z[q]; if (!z) return 0;
  if (q === "Verkauf Owner-Teile") return z.anzahl * z.preis * 0.10;  // Provision 10 %
  if (q === "Vermietung") return z.anzahl * z.preis * 0.30;           // Anteil 30 %
  return z.anzahl * z.preis;
}
function finZielTxt(q, einheit) {
  const z = FIN_Z[q]; if (!z || (!z.anzahl && !z.preis)) return `<span class="hint">kein Ziel</span>`;
  const extra = q === "Verkauf Owner-Teile" ? " · davon 10 %" : q === "Vermietung" ? " · davon 30 %" : "";
  return `${z.anzahl} ${esc(einheit)} × Ø ${fchf(z.preis)}${extra}`;
}
function renderFinanzen(reload) {
  const el = $("finanzen"); if (!el) return;
  if (!finMonat) finMonat = finNowKey();
  if (reload || finState === "idle") { if (finState !== "loading") loadFin(); }
  if (finState === "missing") { el.innerHTML = `<p class="hint">Bitte zuerst <b>18_finanzen.sql</b> in Supabase ausführen.</p>`; return; }
  if (finState !== "ok") { el.innerHTML = `<p class="loading">Finanzen werden geladen …</p>`; return; }
  const k = finMonat, ist = finIst(k);
  const rows = FIN_QUELLEN.map(x => {
    const zc = finZielChf(x.q), ic = (ist[x.q] || {}).chf || 0, n = (ist[x.q] || {}).n || 0;
    if (!zc && !ic && !finEdit && (x.q === "Mitgliedschaft" || x.q === "Anderes")) return "";
    const pct = zc ? Math.min(100, Math.round(ic / zc * 100)) : (ic ? 100 : 0);
    const z = FIN_Z[x.q] || { anzahl: 0, preis: 0 };
    return `<tr>
      <td><b>${esc(x.q)}</b>${x.auto ? ` <span class="pill">automatisch</span>` : ""}<br><span class="hint">${esc(x.txt)}</span></td>
      <td>${finEdit ? `<span class="finedit"><input type="number" min="0" step="1" data-zn="${esc(x.q)}" value="${z.anzahl}" aria-label="Ziel Anzahl ${esc(x.q)}"> × CHF <input type="number" min="0" step="1" data-zp="${esc(x.q)}" value="${z.preis}" aria-label="Ziel Ø Preis ${esc(x.q)}"></span>` : finZielTxt(x.q, x.einheit)}<br><b>${fchf(zc)}</b></td>
      <td>${n} ${esc(x.einheit)}${ist[x.q] && ist[x.q].umsatz ? `<br><span class="hint">Umsatz ${fchf(ist[x.q].umsatz)}</span>` : ""}<br><b>${fchf(ic)}</b></td>
      <td class="finbar"><span class="bar"><i style="width:${pct}%"></i></span><span class="hint">${pct} %</span></td>
    </tr>`;
  }).join("");
  const zSum = FIN_QUELLEN.reduce((s, x) => s + finZielChf(x.q), 0), iSum = FIN_QUELLEN.reduce((s, x) => s + ((ist[x.q] || {}).chf || 0), 0);
  const kosten = FIN_Z.Kosten ? FIN_Z.Kosten.anzahl * FIN_Z.Kosten.preis : 0;
  const dayPct = k === finNowKey() ? Math.round(new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() * 100) : null;
  const me = FIN_E.filter(e => finMonthKey(e.datum) === k).sort((x, y) => String(y.datum).localeCompare(String(x.datum)));
  el.innerHTML = `
    <div class="finhead">
      <button class="btn" type="button" data-finm="-1" aria-label="Monat zurück">←</button>
      <b class="finmonth">${esc(finLabel(k))}</b>
      <button class="btn" type="button" data-finm="1" aria-label="Monat vor">→</button>
      ${k !== finNowKey() ? `<button class="btn ghost" type="button" data-finm="0">Heute</button>` : ""}
    </div>
    <div class="finsum">
      <div><span class="lbl">Einnahmen bis jetzt</span><b>${fchf(iSum)}</b><span class="hint">Ziel ${fchf(zSum)}</span></div>
      <div><span class="lbl">Bleibt (nach Kosten ${fchf(kosten)})</span><b class="${iSum - kosten >= zSum - kosten ? "ok" : ""}">${fchf(iSum - kosten)}</b><span class="hint">Ziel ${fchf(zSum - kosten)}</span></div>
      <div><span class="lbl">Fortschritt</span><b>${zSum ? Math.round(iSum / zSum * 100) : 0} %</b><span class="hint">${dayPct != null ? `vom Monat vorbei: ${dayPct} %` : ""}</span></div>
    </div>
    <div class="fintable"><table class="fin">
      <thead><tr><th>Einnahmequelle</th><th>Ziel pro Monat</th><th>Erreicht</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="rowsmall">${finEdit ? `<button class="btn primary" type="button" data-finsave>Ziele speichern</button><label style="display:inline-flex;gap:6px;align-items:center">Kosten pro Monat CHF <input type="number" min="0" step="10" id="finKost" value="${kosten}" style="width:90px"></label><button class="btn ghost" type="button" data-finedit>Abbrechen</button>` : `<button class="btn" type="button" data-finedit>Ziele anpassen</button>`}</div>

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
    <p class="hint">Ziele sind deine Annahmen (Startwerte: Variante C «Fair + Services»). Beträge vor AHV und Steuern.</p>`;
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
  const rows = FIN_QUELLEN.map(x => ({ quelle: x.q, anzahl: parseFloat(document.querySelector(`[data-zn="${CSS.escape(x.q)}"]`).value) || 0, preis: parseFloat(document.querySelector(`[data-zp="${CSS.escape(x.q)}"]`).value) || 0 }));
  rows.push({ quelle: "Kosten", anzahl: 1, preis: parseFloat($("finKost").value) || 0 });
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
