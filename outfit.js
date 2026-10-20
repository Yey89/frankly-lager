/* =========================================================
   0–100 FRANKLY · Outfit-Bild für Looks
   Ordnet die Teile eines Looks wie ein Outfit an
   (Jacke, Oberteil, Hose/Rock oder Kleid, Schuhe, Tasche, Accessoire)
   und würfelt neue Kombinationen aus den Teilen eines Looks.
   Wird von Lager (app.js) und Shop (shop.js) benutzt.
   ========================================================= */
"use strict";

window.FRANKLY_OUTFIT = (() => {
  const CAT = { Oberteile: "top", Hosen: "bottom", "Röcke": "bottom", Kleider: "dress", Jacken: "outer", Schuhe: "shoes", Taschen: "bag", Accessoires: "acc" };
  const KW = [
    ["dress", /kleid|dress|jumpsuit|overall/i],
    ["outer", /jacke|jacket|blazer|mantel|coat|weste|vest\b|parka|trench|cardigan|bomber/i],
    ["shoes", /schuh|shoe|sneaker|boot|stiefel|sandal|heels?\b|pumps?\b|loafer/i],
    ["bag", /tasche|\bbag|clutch|beutel/i],
    ["acc", /gürtel|belt|schal|scarf|halstuch|\bhut\b|\bhat\b|mütze|\bcap\b|kette|schmuck|accessoir|brille/i],
    ["bottom", /hose|jeans|trouser|pants?\b|\brock\b|skirt|shorts|culotte|legging/i],
    ["top", /shirt|bluse|blouse|\btop\b|pullover|pulli|sweat|hoodie|strick|knit|\btee\b|body|korsett|corset|bustier/i]
  ];
  /* Welche Rolle hat ein Teil im Outfit? Kategorie zuerst, bei «Oberteile» oder unklar auch der Titel */
  function slot(it) {
    const c = CAT[it.kategorie];
    if (c && c !== "top") return c;
    const t = [it.unterkategorie, it.titel].filter(Boolean).join(" ");
    for (const [s, re] of KW) if (re.test(t)) return (c === "top" && !["outer", "dress"].includes(s)) ? "top" : s;
    return c || "top";
  }
  function groups(items) {
    const g = { top: [], bottom: [], dress: [], outer: [], shoes: [], bag: [], acc: [] };
    items.forEach(it => g[slot(it)].push(it));
    return g;
  }
  /* Grundlagen: Kleid ODER Oberteil + Unterteil (oder nur eines davon) */
  function bases(g) {
    const b = [];
    if (g.top.length && g.bottom.length) g.top.forEach(t => g.bottom.forEach(u => b.push([t, u])));
    g.dress.forEach(d => b.push([d]));
    if (!b.length) g.top.concat(g.bottom).forEach(x => b.push([x]));
    if (!b.length && g.outer.length) b.push([]);
    return b;
  }
  function count(items) {
    const g = groups(items), n = bases(g).length || 1;
    return n * (g.outer.length ? g.outer.length + 1 : 1) * (g.shoes.length || 1) * (g.bag.length ? g.bag.length + 1 : 1);
  }
  /* Standard: das erste von jedem (Reihenfolge im Look) */
  function first(items) {
    const g = groups(items), b = bases(g)[0] || [];
    return b.concat(g.outer.slice(0, 1), g.shoes.slice(0, 1), g.bag.slice(0, 1), g.acc.slice(0, 1));
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function key(c) { return c.map(x => x.id).sort().join(","); }
  /* Neue Kombination, möglichst anders als die aktuelle */
  function shuffle(items, current) {
    const g = groups(items), bs = bases(g), cur = current ? key(current) : "";
    let best = null;
    for (let i = 0; i < 30; i++) {
      const c = (pick(bs) || []).slice();
      if (g.outer.length && (Math.random() < 0.7 || !c.length)) c.push(pick(g.outer));
      if (g.shoes.length) c.push(pick(g.shoes));
      if (g.bag.length && Math.random() < 0.7) c.push(pick(g.bag));
      if (g.acc.length && Math.random() < 0.5) c.push(pick(g.acc));
      best = c;
      if (key(c) !== cur) break;
    }
    return best || first(items);
  }
  /* Bild bauen. url(it) liefert {src, cut}: cut = freigestellt (durchsichtiger Hintergrund) */
  function html(combo, url, label) {
    const g = groups(combo);
    const cls = ["outfit", g.outer.length ? "has-outer" : "", g.dress.length ? "has-dress" : "",
      g.top.length && !g.bottom.length && !g.dress.length ? "only-top" : "", g.bottom.length && !g.top.length ? "only-bottom" : ""].filter(Boolean).join(" ");
    const imgs = combo.map(it => {
      const u = url(it); if (!u || !u.src) return "";
      return `<img class="o-${slot(it)}${u.cut ? "" : " raw"}" src="${String(u.src).replace(/"/g, "&quot;")}" alt="" loading="lazy" decoding="async">`;
    }).join("");
    return `<span class="${cls}" role="img" aria-label="${String(label || "Outfit").replace(/"/g, "&quot;")}">${imgs || `<span class="nofoto">Fotos fehlen</span>`}</span>`;
  }
  return { slot, groups, count, first, shuffle, html };
})();
