/* =========================================================
   0–100 FRANKLY · Outfit-Bild für Looks
   Ordnet die Teile eines Looks wie ein Outfit an
   (Jacke, Oberteil, Hose/Rock oder Kleid, Schuhe, Tasche, Accessoire)
   und würfelt neue Kombinationen aus den Teilen eines Stil-Looks:
   Oberteil + Unterteil oder Kleid, dazu Schuhe und vielleicht eine Jacke (max. 4).
   Wird von Lager (app.js) und Shop (shop.js) benutzt.
   ========================================================= */
"use strict";

window.FRANKLY_OUTFIT = (() => {
  const CAT = { Oberteile: "top", Hosen: "bottom", "Röcke": "bottom", Kleider: "dress", Jacken: "outer", Kimonos: "outer", Tuniken: "top", Schuhe: "shoes", Taschen: "bag", Accessoires: "acc" };
  const KW = [
    ["dress", /kleid|dress|jumpsuit|overall/i],
    ["outer", /kimono|jacke|jacket|blazer|mantel|coat|weste|vest\b|parka|trench|cardigan|bomber/i],
    ["shoes", /schuh|shoe|sneaker|boot|stiefel|sandal|heels?\b|pumps?\b|loafer/i],
    ["bag", /tasche|\bbag|clutch|beutel/i],
    ["acc", /gürtel|belt|schal|scarf|halstuch|\bhut\b|\bhat\b|mütze|\bcap\b|kette|schmuck|accessoir|brille/i],
    ["bottom", /hose|jeans|trouser|pants?\b|\brock\b|skirt|shorts|culotte|legging/i],
    ["top", /tunika|tunic|shirt|bluse|blouse|\btop\b|pullover|pulli|sweat|hoodie|strick|knit|\btee\b|body|korsett|corset|bustier/i]
  ];
  /* Welche Rolle hat ein Teil im Outfit? Kategorie zuerst, bei «Oberteile» oder unklar auch der Titel */
  function slot(it) {
    const c = CAT[it.kategorie];
    if (c && c !== "top") return c;
    const t = [it.unterkategorie, it.titel].filter(Boolean).join(" ");
    for (const [s, re] of KW) if (re.test(t)) return (c === "top" && !["outer", "dress"].includes(s)) ? "top" : s;
    return c || "top";
  }
  const SHIRTDRESS = /hemd|shirt|longshirt|tunika|tunic|bluse/i;
  function groups(items) {
    const g = { top: [], bottom: [], dress: [], outer: [], shoes: [], bag: [], acc: [] };
    items.forEach(it => g[slot(it)].push(it));
    return g;
  }
  /* Grundlage einer Kombi: Oberteil + Unterteil ODER Kleid (Hemdblusenkleid auch über Hose/Shorts).
     Nie zwei Oberteile, nie zwei Unterteile. Ohne Grundlage keine Kombi. */
  function bases(g) {
    const b = [];
    g.top.forEach(t => g.bottom.forEach(u => b.push([t, u])));
    g.dress.filter(d => SHIRTDRESS.test([d.unterkategorie, d.titel].join(" "))).forEach(d => g.bottom.forEach(u => b.push([d, u])));
    g.dress.forEach(d => b.push([d]));
    return b;
  }
  /* Höchstens 4 Teile: Grundlage + Schuhe (wenn vorhanden) + vielleicht eine Jacke */
  function count(items) {
    const g = groups(items), n = bases(g).length;
    return n * (g.outer.length + 1) * (g.shoes.length || 1);
  }
  function ok(items) { return bases(groups(items)).length > 0; }
  function first(items) {
    const g = groups(items), b = bases(g)[0];
    return b ? b.concat(g.outer.slice(0, 1), g.shoes.slice(0, 1)) : [];
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function key(c) { return c.map(x => x.id).sort().join(","); }
  /* Neue Kombination, möglichst anders als die aktuelle. must = Teil, das drin sein soll (optional) */
  function shuffle(items, current, must) {
    const g = groups(items), bs = bases(g), cur = current ? key(current) : "";
    if (!bs.length) return [];
    let best = null;
    for (let i = 0; i < 60; i++) {
      const c = pick(bs).slice();
      if (g.outer.length && Math.random() < 0.5) c.push(pick(g.outer));
      if (g.shoes.length) c.push(pick(g.shoes));
      if (must && !c.some(x => x.id === must)) continue;
      best = c;
      if (key(c) !== cur) break;
    }
    return best || (must ? [] : first(items));
  }
  /* Bild bauen: jedes Teil bekommt einen eigenen Platz, nichts überlappt.
     url(it) liefert {src, cut}: cut = freigestellt (durchsichtiger Hintergrund) */
  function places(combo) {
    const g = groups(combo), P = new Map();
    const set = (it, l, t, w, h) => { if (it) P.set(it.id, [l, t, w, h]); };
    const dressUp = g.bottom.length ? g.dress : [];          // Kleid über Hose = wie Oberteil
    const upper = g.outer.concat(g.top, dressUp);
    if (g.dress.length && !g.bottom.length) {                  // Kleid
      if (g.outer.length) { set(g.outer[0], 2, 2, 46, 60); set(g.dress[0], 50, 2, 48, 96); }
      else set(g.dress[0], 16, 2, 68, 96);
    } else if (g.bottom.length) {                              // oben + unten
      if (upper.length >= 2) { set(upper[0], 2, 2, 47, 47); set(upper[1], 51, 2, 47, 47); }
      else if (upper.length === 1) set(upper[0], 20, 2, 60, 47);
      set(g.bottom[0], 22, upper.length ? 51 : 4, 56, upper.length ? 47 : 92);
    } else {                                                   // nur Oberteile / Jacke
      if (upper.length >= 2) { set(upper[0], 2, 8, 47, 72); set(upper[1], 51, 8, 47, 72); }
      else if (upper.length === 1) set(upper[0], 15, 6, 70, 82);
    }
    set(g.shoes[0], 80, 79, 18, 19);
    set(g.bag[0], 2, 52, 18, 26);
    set(g.acc[0], 2, 80, 18, 18);
    return P;
  }
  function html(combo, url, label) {
    const P = places(combo);
    const imgs = combo.map(it => {
      const u = url(it), p = P.get(it.id); if (!u || !u.src || !p) return "";
      return `<img class="o-${slot(it)}${u.cut ? "" : " raw"}" style="left:${p[0]}%;top:${p[1]}%;width:${p[2]}%;height:${p[3]}%" src="${String(u.src).replace(/"/g, "&quot;")}" alt="" loading="lazy" decoding="async">`;
    }).join("");
    return `<span class="outfit" role="img" aria-label="${String(label || "Outfit").replace(/"/g, "&quot;")}">${imgs || `<span class="nofoto">Fotos fehlen</span>`}</span>`;
  }
  return { slot, groups, count, ok, first, shuffle, html };
})();
