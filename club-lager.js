/* =========================================================
   SECONDHAND AMONG FRIENDS · LAGER · Tab «Club»
   Mitglieder des Among Friends Club: Anmeldungen von der Website,
   Zahlungen im Laden eintragen (bar, Karte, TWINT), E-Mails für die
   Digital Preview kopieren. Läuft nach app.js (nutzt sb, $, esc, toast …).
   Braucht supabase/26_club.sql.
   ========================================================= */
"use strict";
const CLUB_PREIS = { Jahr: 120, Monat: 15 };
let CLUB = [], clubState = "idle", clubFilter = "Aktiv", clubQ = "", clubPay = null;

async function loadClub() {
  clubState = "loading";
  const r = await sb.from("mitglieder").select("*").order("created_at", { ascending: false });
  if (r.error) { clubState = "missing"; CLUB = []; return renderClub(); }
  CLUB = r.data || []; clubState = "ok"; renderClub();
}
function clubIso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function clubToday() { return clubIso(new Date()); }
function clubStand(m) {
  if (m.status === "Beendet") return "Beendet";
  if (m.status === "Neu" && !m.bezahlt_bis) return "Neu";
  if (m.bezahlt_bis && m.bezahlt_bis >= clubToday()) return "Aktiv";
  return "Abgelaufen";
}
function clubDate(s) { if (!s) return "–"; const [y, mo, d] = s.split("-"); return `${d}.${mo}.${y}`; }
function renderClub(reload) {
  const el = $("club"); if (!el) return;
  if (reload || clubState === "idle") { if (clubState !== "loading") loadClub(); }
  const neu = CLUB.filter(m => clubStand(m) === "Neu").length;
  const c = $("cntClub"); if (c) c.textContent = neu || "";
  if (clubState === "missing") { el.innerHTML = `<p class="hint" style="margin-top:14px">Bitte zuerst <b>26_club.sql</b> in Supabase ausführen.</p>`; return; }
  if (clubState === "loading" && !CLUB.length) { el.innerHTML = `<p class="loading">Mitglieder werden geladen …</p>`; return; }
  const counts = {}; CLUB.forEach(m => { const s = clubStand(m); counts[s] = (counts[s] || 0) + 1; });
  const q = clubQ.toLowerCase();
  const list = CLUB.filter(m => (clubFilter === "Alle" || clubStand(m) === clubFilter) &&
    (!q || [m.vorname, m.nachname, m.email, m.telefon].join(" ").toLowerCase().includes(q)));
  const aktive = CLUB.filter(m => clubStand(m) === "Aktiv");
  el.innerHTML = `
    <div class="tools" style="justify-content:space-between;margin-top:14px">
      <span class="hint" style="flex:1 1 280px;max-width:62ch">Anmeldungen kommen von der Website (Menü «Club»). Bezahlt wird im Laden. Trag die Zahlung hier ein, dann ist die Person Mitglied bis zum angezeigten Datum, und der Betrag erscheint unter Finanzen.</span>
      <span class="rowsmall" style="margin:0">
        <input class="search" id="clubQ" placeholder="Name oder E-Mail suchen" aria-label="Mitglied suchen" value="${esc(clubQ)}">
        <button class="btn" type="button" id="clubMails">E-Mails für die Preview kopieren (${aktive.length})</button>
        <button class="btn" type="button" id="clubAdd">+ Mitglied</button>
      </span>
    </div>
    <div class="chips" style="margin:12px 0">${["Neu", "Aktiv", "Abgelaufen", "Beendet", "Alle"].map(x => `<button class="chip" type="button" data-cfilter="${x}" aria-pressed="${x === clubFilter}">${x}${x !== "Alle" && counts[x] ? ` (${counts[x]})` : ""}</button>`).join("")}</div>
    <div id="clubForm"></div>
    ${list.length ? `<div class="clist">${list.map(clubRow).join("")}</div>` : `<p class="empty">Keine Mitglieder in dieser Ansicht.</p>`}`;
  const qi = $("clubQ"); qi.addEventListener("input", () => { clubQ = qi.value; const pos = qi.selectionStart; renderClub(); const n = $("clubQ"); n.focus(); n.setSelectionRange(pos, pos); });
}
function clubRow(m) {
  const s = clubStand(m), pill = { Neu: "pill", Aktiv: "pill ok", Abgelaufen: "pill warn", Beendet: "pill muted" }[s];
  const open = clubPay === m.id;
  return `<div class="box" style="margin:0 0 8px">
    <div style="display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;justify-content:space-between">
      <div style="min-width:0"><b>${esc(m.vorname)} ${esc(m.nachname || "")}</b> <span class="${pill}">${s}</span>
        <div class="hint" style="margin:2px 0 0">${esc(m.email)}${m.telefon ? " · " + esc(m.telefon) : ""}${m.groessen ? " · Grösse " + esc(m.groessen) : ""} · ${m.abo === "Monat" ? "CHF 15 pro Monat" : "CHF 120 pro Jahr"}</div>
        <div class="hint" style="margin:2px 0 0">${m.bezahlt_bis ? `Bezahlt bis <b>${clubDate(m.bezahlt_bis)}</b>${m.zahlart ? " · zuletzt " + esc(m.zahlart) : ""}` : "Noch nicht bezahlt"} · angemeldet ${clubDate(String(m.created_at).slice(0, 10))}</div>
      </div>
      <span class="rowsmall" style="margin:0">
        <button class="btn" type="button" data-cpay="${m.id}">Zahlung eintragen</button>
        ${s !== "Beendet" ? `<button class="btn ghost" type="button" data-cend="${m.id}">Beenden</button>` : `<button class="btn ghost" type="button" data-creopen="${m.id}">Wieder aktivieren</button>`}
      </span>
    </div>
    ${open ? `<form class="form" data-cpayform="${m.id}" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end">
      <label>Mitgliedschaft<select id="cp-abo"><option value="Jahr" ${m.abo !== "Monat" ? "selected" : ""}>1 Jahr · CHF 120</option><option value="Monat" ${m.abo === "Monat" ? "selected" : ""}>1 Monat · CHF 15</option></select></label>
      <label>Bezahlt mit<select id="cp-art"><option>Bar</option><option>Karte</option><option>TWINT</option><option>Bank</option></select></label>
      <label>Datum<input id="cp-d" type="date" value="${clubToday()}"></label>
      <button class="btn primary" type="submit">Speichern</button>
      <button class="btn ghost" type="button" data-cpay="">Abbrechen</button>
    </form>` : ""}
  </div>`;
}
async function clubSavePay(id, form) {
  const m = CLUB.find(x => x.id === id); if (!m) return;
  const abo = $("cp-abo").value, art = $("cp-art").value, d = $("cp-d").value || clubToday();
  const start = m.bezahlt_bis && m.bezahlt_bis >= d ? new Date(m.bezahlt_bis + "T12:00") : new Date(d + "T12:00");
  if (m.bezahlt_bis && m.bezahlt_bis >= d) start.setDate(start.getDate() + 1);
  const bis = new Date(start); if (abo === "Jahr") bis.setFullYear(bis.getFullYear() + 1); else bis.setMonth(bis.getMonth() + 1);
  bis.setDate(bis.getDate() - 1);
  const btn = form.querySelector('[type="submit"]'); busy(btn, true);
  const u = await sb.from("mitglieder").update({ abo, status: "Aktiv", bezahlt_bis: clubIso(bis), letzte_zahlung: d, zahlart: art }).eq("id", id).select().single();
  if (u.error) { busy(btn, false); return toast(nice(u.error), 4500); }
  const e = await sb.from("einnahmen").insert({ art: "Mitgliedschaft", anzahl: 1, betrag: CLUB_PREIS[abo], datum: d, notiz: `${m.vorname} ${m.nachname || ""}`.trim() + ` · ${abo} · ${art}` }).select().single();
  busy(btn, false);
  Object.assign(m, u.data); clubPay = null; renderClub();
  if (e.error) return toast("Mitglied gespeichert. Für Finanzen bitte den Betrag von Hand eintragen.", 5000);
  if (typeof FIN_E !== "undefined") FIN_E = [e.data].concat(FIN_E);
  toast(`${m.vorname} ist Mitglied bis ${clubDate(u.data.bezahlt_bis)}`);
}
async function clubSetStatus(id, status) {
  const u = await sb.from("mitglieder").update({ status }).eq("id", id).select().single();
  if (u.error) return toast(nice(u.error), 4500);
  Object.assign(CLUB.find(x => x.id === id), u.data); renderClub();
}
function clubAddForm() {
  $("clubForm").innerHTML = `<form class="form box" id="clubNew" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:0 0 12px">
    <label>Vorname *<input id="cn-v" required></label><label>Nachname<input id="cn-n"></label>
    <label>E-Mail *<input id="cn-e" type="email" required></label><label>Telefon<input id="cn-t" type="tel"></label>
    <label>Mitgliedschaft<select id="cn-a"><option value="Jahr">CHF 120 pro Jahr</option><option value="Monat">CHF 15 pro Monat</option></select></label>
    <button class="btn primary" type="submit">Hinzufügen</button></form>`;
  $("cn-v").focus();
}
async function clubAddSave(form) {
  const row = { vorname: $("cn-v").value.trim(), nachname: $("cn-n").value.trim() || null, email: $("cn-e").value.trim().toLowerCase(), telefon: $("cn-t").value.trim() || null, abo: $("cn-a").value };
  if (!row.vorname || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) return toast("Bitte Vorname und gültige E-Mail eingeben.");
  const btn = form.querySelector('[type="submit"]'); busy(btn, true);
  const r = await sb.from("mitglieder").insert(row).select().single();
  busy(btn, false);
  if (r.error) return toast(nice(r.error), 4500);
  CLUB = [r.data].concat(CLUB); clubFilter = "Neu"; clubPay = r.data.id; renderClub();
  toast("Hinzugefügt. Trag jetzt die Zahlung ein.");
}
async function clubCopyMails() {
  const mails = CLUB.filter(m => clubStand(m) === "Aktiv").map(m => m.email).join(", ");
  if (!mails) return toast("Noch keine aktiven Mitglieder.");
  try { await navigator.clipboard.writeText(mails); toast("E-Mails kopiert. Im Mail ins Feld «Bcc» einfügen.", 4000); }
  catch (e) { $("clubForm").innerHTML = `<label class="box" style="display:block">E-Mails (markieren und kopieren, ins Feld «Bcc»)<textarea rows="3" readonly>${esc(mails)}</textarea></label>`; }
}
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || !$("club") || !$("viewClub").contains(b)) return;
  const d = b.dataset;
  if (d.cfilter) { clubFilter = d.cfilter; return renderClub(); }
  if (d.cpay !== undefined) { clubPay = d.cpay || null; return renderClub(); }
  if (d.cend) return clubSetStatus(d.cend, "Beendet");
  if (d.creopen) return clubSetStatus(d.creopen, "Aktiv");
  if (b.id === "clubAdd") return clubAddForm();
  if (b.id === "clubMails") return clubCopyMails();
});
document.addEventListener("submit", e => {
  const f = e.target;
  if (f.dataset && f.dataset.cpayform) { e.preventDefault(); return clubSavePay(f.dataset.cpayform, f); }
  if (f.id === "clubNew") { e.preventDefault(); return clubAddSave(f); }
});
window.renderClub = renderClub;
