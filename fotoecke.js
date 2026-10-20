/* =========================================================
   0–100 FRANKLY · LAGER · Tab «Fotoecke»
   Fotos, die Besucherinnen über foto.html hochgeladen haben:
   ansehen, freigeben, Gutschein einlösen. Läuft nach app.js.
   ========================================================= */
"use strict";

let FOTOS = [], FURLS = {}, fotoState = "idle", fotoFilter = "Neu";

async function loadFotos() {
  fotoState = "loading";
  const r = await sb.from("fotoecke").select("*").order("created_at", { ascending: false });
  if (r.error) { fotoState = "missing"; FOTOS = []; return renderFotoecke(); }
  FOTOS = r.data || [];
  const todo = FOTOS.map(f => f.pfad).filter(p => p && !FURLS[p]);
  for (let i = 0; i < todo.length; i += 100) {
    const s = await sb.storage.from("fotoecke").createSignedUrls(todo.slice(i, i + 100), 60 * 60 * 6);
    (s.data || []).forEach(x => { if (x.signedUrl && x.path) FURLS[x.path] = x.signedUrl; });
  }
  fotoState = "ok"; renderFotoecke();
}
function fotoNrs(f) { return String(f.teile || "").toUpperCase().match(/FR-?\d{1,6}/g) || []; }
function normNr(n) { const d = n.replace(/\D/g, ""); return "FR-" + d.padStart(6, "0"); }
function renderFotoecke(reload) {
  const el = $("fotoecke"); if (!el) return;
  if (reload || fotoState === "idle") { if (fotoState !== "loading") loadFotos(); }
  const neu = FOTOS.filter(f => f.status === "Neu").length;
  const c = $("cntFoto"); if (c) c.textContent = neu || "";
  if (fotoState === "missing") { el.innerHTML = `<p class="hint">Bitte zuerst 10_fotos_fotoecke.sql in Supabase ausführen.</p>`; return; }
  if (fotoState === "loading" && !FOTOS.length) { el.innerHTML = `<p class="loading">Fotos werden geladen …</p>`; return; }
  const list = FOTOS.filter(f => fotoFilter === "Alle" || f.status === fotoFilter);
  const top = {}; FOTOS.filter(f => f.status !== "Abgelehnt").forEach(f => fotoNrs(f).forEach(n => { n = normNr(n); top[n] = (top[n] || 0) + 1; }));
  const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 8);
  el.innerHTML = `
    <div class="chips" style="margin-bottom:12px">${["Neu", "Freigegeben", "Abgelehnt", "Alle"].map(x => `<button class="chip" type="button" data-ffilter="${x}" aria-pressed="${x === fotoFilter}">${x}${x === "Neu" && neu ? ` (${neu})` : ""}</button>`).join("")}</div>
    ${topList.length ? `<div class="box"><div class="sec" style="margin:0 0 6px">Am häufigsten fotografiert</div><div class="thumbs">${topList.map(([nr, n]) => { const it = ITEMS.find(x => x.nr === nr); return it ? `<button class="mini" type="button" data-item="${esc(it.id)}">${imgUrl(it.foto_pfad) ? `<img src="${esc(imgUrl(it.foto_pfad))}" alt="">` : ""}${esc(nr)} · ${n}×</button>` : `<span class="pill">${esc(nr)} · ${n}×</span>`; }).join("")}</div></div>` : ""}
    ${list.length ? `<div class="fgrid">${list.map(fotoCard).join("")}</div>` : `<p class="empty">Keine Fotos in dieser Ansicht.</p>`}`;
}
function fotoCard(f) {
  const nrs = fotoNrs(f).map(normNr);
  const its = nrs.map(n => ITEMS.find(x => x.nr === n)).filter(Boolean);
  const ig = f.instagram ? "@" + String(f.instagram).replace(/^@/, "") : "";
  return `<div class="fcard">
    ${FURLS[f.pfad] ? `<a href="${esc(FURLS[f.pfad])}" target="_blank" rel="noopener"><img src="${esc(FURLS[f.pfad])}" alt="Foto aus der Fotoecke" loading="lazy"></a>` : `<span class="nofoto">Foto</span>`}
    <div><span class="pill ${f.status === "Freigegeben" ? "ok" : f.status === "Abgelehnt" ? "muted" : ""}">${esc(f.status)}</span><span class="pill ${f.ok_oeffentlich ? "ok" : "muted"}">${f.ok_oeffentlich ? "Öffentlich erlaubt" : "Nur intern"}</span></div>
    <span class="hint">${esc(String(f.created_at).slice(0, 10).split("-").reverse().join("."))}${f.name ? " · " + esc(f.name) : ""}${ig ? " · " + esc(ig) : ""}</span>
    ${its.length ? `<div class="thumbs">${its.map(it => `<button class="mini" type="button" data-item="${esc(it.id)}">${esc(it.nr)} ${esc(it.titel)}</button>`).join("")}</div>` : `<span class="hint">Noch keine Teile angegeben.</span>`}
    <div class="rowsmall" style="margin:0"><input class="search" data-fteile="${esc(f.id)}" value="${esc(nrs.join(", "))}" placeholder="Teile ergänzen: FR-000123, 45" aria-label="Teile-Nummern" style="flex:1 1 140px;min-width:0"><button class="btn" type="button" data-fteilesave="${esc(f.id)}">Teile speichern</button></div>
    ${f.email ? `<div class="rowsmall" style="margin:0"><button class="btn" type="button" data-fmail="${esc(f.id)}">${f.mail_gesendet_am ? "Gutschein-Mail nochmals senden" : "Gutschein-Mail senden"}</button>${f.mail_gesendet_am ? `<span class="hint">gesendet ${esc(String(f.mail_gesendet_am).slice(0, 10).split("-").reverse().join("."))}</span>` : ""}</div>` : ""}
    <span class="hint">Gutschein ${esc(f.gutschein || "–")}${f.eingeloest_am ? " · eingelöst " + esc(String(f.eingeloest_am).slice(0, 10).split("-").reverse().join(".")) : ""}</span>
    <div class="rowsmall" style="margin:0">${f.status !== "Freigegeben" ? `<button class="btn primary" type="button" data-fset="${esc(f.id)}" data-v="Freigegeben">Freigeben</button>` : ""}${f.status !== "Abgelehnt" ? `<button class="btn" type="button" data-fset="${esc(f.id)}" data-v="Abgelehnt">Ablehnen</button>` : ""}</div>
  </div>`;
}
async function setFoto(id, status, btn) {
  busy(btn, true, "…");
  const { data, error } = await sb.from("fotoecke").update({ status }).eq("id", id).select().single();
  if (error) { busy(btn, false); return toast(nice(error), 4500); }
  FOTOS = FOTOS.map(f => f.id === id ? data : f); renderFotoecke();
  toast(status === "Freigegeben" ? "Freigegeben" : "Abgelehnt");
}
async function saveTeile(id, btn) {
  const inp = document.querySelector(`[data-fteile="${CSS.escape(id)}"]`); if (!inp) return;
  const nrs = (inp.value.toUpperCase().match(/(FR-?)?\d{1,6}/g) || []).map(n => "FR-" + n.replace(/\D/g, "").padStart(6, "0"));
  const unknown = nrs.filter(n => !ITEMS.some(x => x.nr === n));
  busy(btn, true, "…");
  const { data, error } = await sb.from("fotoecke").update({ teile: nrs.join(", ") || null }).eq("id", id).select().single();
  if (error) { busy(btn, false); return toast(nice(error), 4500); }
  FOTOS = FOTOS.map(f => f.id === id ? data : f); renderFotoecke();
  toast(unknown.length ? `Gespeichert. Unbekannte Nummer: ${unknown.join(", ")}` : "Teile gespeichert", 4000);
}
const GUTSCHEIN_GILT = "auf alle Teile mit dem Etikett «Frankly-Teil», einen Workshop, den Basteltisch oder die Tauschparty";
async function sendGsMail(id) {
  const f = FOTOS.find(x => x.id === id); if (!f || !f.email) return;
  const hi = f.name ? `Hallo ${f.name}` : "Hallo";
  const body = `${hi}\n\nherzlichen Dank für dein Foto aus der Frankly-Fotoecke! Es ist schön zu sehen, wie du unsere Teile trägst.\n\nHier ist dein Gutschein über CHF 5:\n\n${f.gutschein}\n\nEr gilt ${GUTSCHEIN_GILT}. Zeig den Code einfach im Laden an der Kasse. Ein Gutschein pro Besuch, nicht bar auszahlbar.\n\n0–100 Frankly · Josy, Neue Hard 10, 8005 Zürich\nMi–Fr 13–19 Uhr, Sa 9.30–17 Uhr` + GRUSS;
  mailTo(f.email, "Dein Gutschein von 0–100 Frankly", body);
  const { data, error } = await sb.from("fotoecke").update({ mail_gesendet_am: new Date().toISOString() }).eq("id", id).select().single();
  if (!error) { FOTOS = FOTOS.map(x => x.id === id ? data : x); renderFotoecke(); }
}
async function redeem(btn) {
  const code = ($("gsCode").value || "").trim().toUpperCase().replace(/\s/g, "");
  if (!code) return toast("Bitte den Code eingeben.");
  busy(btn, true, "Prüfen …");
  const { data, error } = await sb.from("fotoecke").select("*").eq("gutschein", code.startsWith("FOTO-") ? code : "FOTO-" + code).maybeSingle();
  if (error) { busy(btn, false); return toast(nice(error), 4500); }
  if (!data) { busy(btn, false); return toast("Diesen Code gibt es nicht.", 4000); }
  if (data.eingeloest_am) { busy(btn, false); return toast(`Schon eingelöst am ${String(data.eingeloest_am).slice(0, 10).split("-").reverse().join(".")}.`, 4500); }
  if (data.status === "Abgelehnt") { busy(btn, false); return toast("Das Foto zu diesem Code wurde abgelehnt. Gutschein nicht gültig.", 4500); }
  const u = await sb.from("fotoecke").update({ eingeloest_am: new Date().toISOString() }).eq("id", data.id).select().single();
  busy(btn, false);
  if (u.error) return toast(nice(u.error), 4500);
  FOTOS = FOTOS.map(f => f.id === data.id ? u.data : f); $("gsCode").value = ""; renderFotoecke();
  toast("Gutschein eingelöst: CHF 5 " + GUTSCHEIN_GILT + ".", 6000);
}
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "gsBtn") return redeem(b);
  if (!$("fotoecke") || !$("fotoecke").contains(b)) return;
  if (b.dataset.ffilter) { fotoFilter = b.dataset.ffilter; renderFotoecke(); return; }
  if (b.dataset.fset) return setFoto(b.dataset.fset, b.dataset.v, b);
  if (b.dataset.fteilesave) return saveTeile(b.dataset.fteilesave, b);
  if (b.dataset.fmail) return sendGsMail(b.dataset.fmail);
});
