/* =========================================================
   0–100 FRANKLY · LAGER · Etiketten drucken
   Teile auswählen → A4-Blatt mit 12 Hängeetiketten (5 × 9 cm).
   Jedes Etikett hat einen eigenen QR-Code zum Teil im Shop
   (dort: «So kannst du es kombinieren»).
   Zwei Layouts: «Frankly-Teil» (OWN-001) und Owner-Teil.
   QR-Codes: qrcode-generator (MIT), wird erst beim Drucken geladen.
   Läuft nach app.js.
   ========================================================= */
"use strict";

const ETI_PER_PAGE = 12;
let etiSel = new Set(), etiFilter = "laden";

function etiShopUrl(nr) { const u = new URL("./", location.href); u.search = "?teil=" + nr; u.hash = ""; return u.href; }
function etiLoadQr() {
  if (window.qrcode) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("QR-Programm konnte nicht geladen werden. Prüfe das Internet."));
    document.head.appendChild(s);
  });
}
/* QR als SVG: ein Pfad, scharf in jeder Grösse */
function etiQrSvg(text) {
  const q = window.qrcode(0, "M"); q.addData(text); q.make();
  const n = q.getModuleCount(); let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#111110"/></svg>`;
}
function etiPrice(it) { const p = Number(it.preis); return it.preis != null && it.preis !== "" && !isNaN(p) ? "CHF " + (p % 1 ? p.toFixed(2) : p) : "CHF ___"; }
function etiSize(it) { return (SZ && SZ.label ? SZ.label(it) : "") || it.groesse || "–"; }
/* Layout wie freigegebene Vorschau (Oktober 2026) */
function etiLabel(it) {
  const own = it.owner_id === "OWN-001", o = ownerOf(it.owner_id);
  const size = etiSize(it), meta = [size && size !== "–" ? "Grösse " + size : "", it.marke || ""].filter(Boolean).join(" · ");
  return `<div class="tag${own ? " own" : ""}"><span class="hole"></span>
    <div class="head">0–100 <b>FRANKLY</b></div>
    ${own ? `<div class="badge">FRANKLY-TEIL<small>Hier gilt dein Fotoecke-Gutschein</small></div>`
          : `<div class="from">Aus dem Kleiderschrank von<b>${esc(o ? o.profilname : "einer Frankly-Freundin")}</b></div>`}
    <div class="body">
      <div class="title">${esc(it.titel || "")}</div>
      ${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
      <div class="price">${esc(etiPrice(it))}</div>
      <div class="qrrow"><div class="qr">${etiQrSvg(etiShopUrl(it.nr))}</div><div class="qrtxt"><span class="nr">${esc(it.nr)}</span>Scannen und sehen, wie du es kombinierst</div></div>
    </div>
    <div class="foot">SECOND HAND AMONG FRIENDS</div>
  </div>`;
}
const ETI_CSS = `
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Archivo","Helvetica Neue",Arial,sans-serif;color:#111110;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;height:297mm;padding:13.5mm 5mm;display:grid;grid-template-columns:repeat(4,50mm);grid-template-rows:repeat(3,90mm);page-break-after:always;break-after:page}
.sheet:last-child{page-break-after:auto;break-after:auto}
.tag{position:relative;width:50mm;height:90mm;background:#fff;display:flex;flex-direction:column;overflow:hidden;outline:.2mm dashed #b9b8b2;outline-offset:-.1mm}
.tag.empty{outline-color:transparent}
.hole{position:absolute;top:4mm;left:50%;width:4.5mm;height:4.5mm;margin-left:-2.25mm;border-radius:50%;border:.3mm solid #9c9b94;background:#fff;z-index:3}
.head{padding:10.5mm 3mm 2.6mm;text-align:center;font-weight:800;font-stretch:112.5%;font-size:11.5pt;line-height:1;border-bottom:.5mm solid #111110;white-space:nowrap}
.head b{color:#E10600;font-weight:inherit}
.own .head{background:#111110;color:#fff;border-bottom:0}
.own .head b{color:#fff}
.badge{background:#E10600;color:#fff;font-weight:800;font-stretch:112.5%;font-size:9pt;text-align:center;padding:1.6mm 2mm 1.4mm;letter-spacing:.04em}
.badge small{display:block;font-weight:600;font-stretch:100%;font-size:5.6pt;letter-spacing:0;margin-top:.6mm}
.from{padding:2.2mm 4mm 0;font-family:"IBM Plex Mono",Menlo,monospace;font-weight:500;font-size:6pt;color:#66655F;text-transform:uppercase;letter-spacing:.04em}
.from b{display:block;font-family:"Archivo",Arial,sans-serif;font-weight:600;font-size:8.5pt;color:#111110;text-transform:none;letter-spacing:0;margin-top:.4mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.body{padding:2.4mm 4mm 0;flex:1;display:flex;flex-direction:column;min-height:0}
.title{font-weight:600;font-size:9pt;line-height:1.15;max-height:2.3em;overflow:hidden}
.meta{font-family:"IBM Plex Mono",Menlo,monospace;font-weight:500;font-size:6.4pt;color:#66655F;margin-top:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.price{font-weight:800;font-stretch:112.5%;font-size:17pt;line-height:1;margin-top:2.2mm;white-space:nowrap}
.qrrow{display:flex;gap:2.6mm;align-items:flex-end;margin-top:auto;padding-bottom:3mm}
.qr{width:21mm;height:21mm;flex:none}
.qr svg{width:100%;height:100%;display:block}
.qrtxt{font-size:6.2pt;line-height:1.25;font-weight:600}
.qrtxt .nr{display:block;font-family:"IBM Plex Mono",Menlo,monospace;font-weight:600;font-size:7.4pt;margin-bottom:1.2mm}
.foot{font-family:"IBM Plex Mono",Menlo,monospace;font-weight:500;font-size:5.2pt;letter-spacing:.06em;text-align:center;border-top:.3mm solid #D6D5D0;padding:1.4mm 0 1.6mm;color:#66655F}
.hint{font:12px/1.4 Arial,sans-serif;padding:10px 14px;background:#111110;color:#fff}
@media print{.hint{display:none}}
`;
function etiDoc(items, skip) {
  const cells = Array(skip || 0).fill(`<div class="tag empty"></div>`).concat(items.map(etiLabel));
  const pages = [];
  for (let i = 0; i < cells.length; i += ETI_PER_PAGE) {
    const c = cells.slice(i, i + ETI_PER_PAGE);
    while (c.length < ETI_PER_PAGE) c.push(`<div class="tag empty"></div>`);
    pages.push(`<div class="sheet">${c.join("")}</div>`);
  }
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Frankly Etiketten</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@500;600&display=block">
<style>${ETI_CSS}</style></head><body>
<p class="hint">${items.length} Etiketten · Drucken auf A4, Grösse 100 %, «An Seite anpassen» ausschalten. Danach entlang der gestrichelten Linien schneiden und lochen.</p>
${pages.join("")}
<script>document.fonts.ready.then(function(){setTimeout(function(){window.print()},300)})<\/script>
</body></html>`;
}
async function etiPrint(btn) {
  const items = ITEMS.filter(it => etiSel.has(it.id)).sort((a, b) => (a.nr_num || 0) - (b.nr_num || 0));
  if (!items.length) return toast("Bitte zuerst Teile auswählen.");
  const skip = Math.max(0, Math.min(ETI_PER_PAGE - 1, parseInt(($("etiSkip") || {}).value, 10) || 0));
  const w = window.open("", "_blank"); // sofort öffnen, sonst blockiert Safari das Fenster
  if (!w) return toast("Das Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.", 5000);
  w.document.write(`<p style="font:16px Arial;padding:20px">Etiketten werden erstellt …</p>`);
  busy(btn, true, "Erstellen …");
  try {
    await etiLoadQr();
    w.document.open(); w.document.write(etiDoc(items, skip)); w.document.close();
  } catch (e) { w.close(); toast(nice(e), 5000); }
  busy(btn, false);
}
function etiList() {
  const q = (($("etiQ") || {}).value || "").trim().toLowerCase();
  return ITEMS.filter(it => (etiFilter === "alle" || !CLOSED.includes(it.status)) &&
    (!q || [it.nr, it.titel, it.marke, it.farben, ownerName(it.owner_id)].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => (b.nr_num || 0) - (a.nr_num || 0));
}
function etiRenderList() {
  const el = $("etiList"); if (!el) return;
  const list = etiList();
  el.innerHTML = list.length ? list.map(it => `<label class="etirow"><input type="checkbox" data-eti="${esc(it.id)}" ${etiSel.has(it.id) ? "checked" : ""}>
      ${imgUrl(it.foto_pfad) ? `<img src="${esc(imgUrl(it.foto_pfad))}" alt="">` : `<span class="nofoto"></span>`}
      <span><b>${esc(it.nr)}</b> ${esc(it.titel || "")}<br><span class="hint">${it.owner_id === "OWN-001" ? "Frankly-Teil" : esc(ownerName(it.owner_id))} · ${esc(etiPrice(it))} · ${esc(it.status)}</span></span></label>`).join("")
    : `<p class="hint">Keine Teile gefunden.</p>`;
  $("etiCount").textContent = etiSel.size ? `${etiSel.size} ausgewählt · ${Math.ceil((etiSel.size + (parseInt($("etiSkip").value, 10) || 0)) / ETI_PER_PAGE)} A4-Blatt` : "Noch nichts ausgewählt";
}
function showEtiketten() {
  openPanel(`
    <div class="phead"><span class="sub">Etiketten drucken</span><button class="btn ghost close" type="button" data-close>Schliessen ✕</button></div>
    <h2 class="dt" style="margin:0 0 6px">Etiketten drucken</h2>
    <p class="hint">Teile auswählen. Jedes Etikett bekommt automatisch seinen QR-Code. Deine Teile (OWN-001) bekommen das schwarz-rote Etikett «Frankly-Teil», alle anderen das weisse mit dem Namen der Owner. 12 Etiketten pro A4-Blatt, je 5 × 9 cm.</p>
    <div class="tools" style="margin-top:10px">
      <input class="search" id="etiQ" type="search" placeholder="Suchen: Nummer, Titel, Owner …" aria-label="Teile suchen">
      <div class="chips"><button class="chip" type="button" data-etif="laden" aria-pressed="${etiFilter === "laden"}">Im Laden</button><button class="chip" type="button" data-etif="alle" aria-pressed="${etiFilter === "alle"}">Alle</button></div>
    </div>
    <div class="rowsmall"><button class="btn" type="button" data-etiall="1">Alle angezeigten wählen</button><button class="btn ghost" type="button" data-etinone="1">Auswahl leeren</button></div>
    <div class="etilist" id="etiList"></div>
    <div class="box" style="margin-top:12px">
      <label>Angefangenes Blatt? So viele Felder oben leer lassen<input class="search" id="etiSkip" type="number" min="0" max="11" value="0" style="max-width:120px"></label>
      <p class="hint" id="etiCount"></p>
      <button class="btn primary" type="button" id="etiPrintBtn">Etiketten drucken</button>
    </div>`, { type: "eti" });
  $("etiQ").addEventListener("input", etiRenderList);
  $("etiSkip").addEventListener("input", etiRenderList);
  etiRenderList();
}
document.addEventListener("change", e => {
  const c = e.target.closest("[data-eti]"); if (!c) return;
  if (c.checked) etiSel.add(c.dataset.eti); else etiSel.delete(c.dataset.eti);
  etiRenderList();
});
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "etiBtn") return showEtiketten();
  if (b.id === "etiPrintBtn") return etiPrint(b);
  if (b.dataset.etif) { etiFilter = b.dataset.etif; showEtiketten(); return; }
  if (b.dataset.etiall) { etiList().forEach(it => etiSel.add(it.id)); etiRenderList(); return; }
  if (b.dataset.etinone) { etiSel.clear(); etiRenderList(); return; }
});
