/* =========================================================
   0–100 FRANKLY · Grössen vereinheitlichen
   Aus der Grösse, wie sie auf dem Etikett steht (z.B. "W28 L32", "38", "M", "36/38"),
   wird eine einheitliche Shop-Grösse XXS – 3XL (bei Schuhen die Zahl).
   Regeln:
   • Stehen Buchstaben im Feld (z.B. "W28 S"), gelten NUR diese. So kannst du jede
     Umrechnung selbst übersteuern.
   • Jeans-Weite: W25 = XS, W26 = XS/S, W27 = S, W28 = M, W29 = M/L, W30 = L,
     W31 = L/XL, W32 = XL, W33 = XL/XXL, W34 = XXL. Die Länge (L32) wird ignoriert.
     Bei Hosen gilt eine Zahl von 23 bis 31 ohne "W" auch als Jeans-Weite.
   • EU-Grössen: 32 = XXS, 34 = XS, 36 = S, 38 = M, 40 = L, 42 = XL, 44 = XXL, 46+ = 3XL.
     Ungerade Zahlen (z.B. 37) zählen zu beiden Nachbarn.
   • Taschen und Accessoires haben keine Grösse und passen immer.
   ========================================================= */
(function () {
  "use strict";
  const LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
  const EU = { 32: "XXS", 34: "XS", 36: "S", 38: "M", 40: "L", 42: "XL", 44: "XXL", 46: "3XL", 48: "3XL", 50: "3XL" };
  const W = { 23: ["XXS"], 24: ["XXS"], 25: ["XS"], 26: ["XS", "S"], 27: ["S"], 28: ["M"], 29: ["M", "L"], 30: ["L"], 31: ["L", "XL"], 32: ["XL"], 33: ["XL", "XXL"], 34: ["XXL"], 35: ["XXL", "3XL"], 36: ["3XL"] };
  const HINT_OBEN = { XXS: "32", XS: "34", S: "36", M: "38", L: "40", XL: "42", XXL: "44", "3XL": "46+" };
  const HINT_UNTEN = { XXS: "32 · W24", XS: "34 · W25", S: "36 · W27", M: "38 · W28", L: "40 · W30", XL: "42 · W32", XXL: "44 · W34", "3XL": "46+ · W36" };
  const SHOES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44"];

  function group(kat) {
    if (["Oberteile", "Tuniken", "Kleider", "Jacken", "Kimonos"].includes(kat)) return "oben";
    if (["Hosen", "Röcke"].includes(kat)) return "unten";
    if (kat === "Schuhe") return "schuhe";
    return "alle";
  }
  function parse(txt, kat) {
    const g = group(kat);
    if (txt == null || String(txt).trim() === "" || g === "alle") return [];
    let t = " " + String(txt).toUpperCase().replace(/\(.*?\)/g, " ").replace(/,/g, ".") + " ";
    if (/ONE ?SIZE|EINHEITS/.test(t)) return ["ONE"];
    if (g === "schuhe") {
      const m = t.match(/\b(3[4-9]|4[0-7])(?:\.5)?\b/);
      return m ? [m[1]] : [];
    }
    t = t.replace(/\bL\s?\d{2}\b/g, " ");              // Jeans-Länge ignorieren
    t = t.replace(/\bXXXL\b/g, "3XL");
    const letters = (t.match(/\b(XXS|XS|S|M|L|XL|XXL|3XL)\b/g) || []);
    if (letters.length) return LETTERS.filter(l => letters.includes(l));
    const out = new Set();
    let wm = t.match(/\bW\s?(\d{2})\b/);
    if (!wm && g === "unten") wm = t.match(/\b(2[3-9]|3[01])\b/);
    if (wm) { (W[+wm[1]] || []).forEach(x => out.add(x)); t = t.replace(wm[0], " "); }
    (t.match(/\b(3[2-9]|4\d|50)\b/g) || []).forEach(n => {
      n = +n;
      if (n % 2 === 0) { if (EU[n]) out.add(EU[n]); }
      else { if (EU[n - 1]) out.add(EU[n - 1]); if (EU[n + 1]) out.add(EU[n + 1]); }
    });
    return LETTERS.filter(l => out.has(l));
  }
  /* Passt ein Teil zur Auswahl? sel = {oben:[], unten:[], schuhe:[]}; leere Liste = alle */
  function matches(item, sel) {
    const g = group(item.kategorie);
    if (g === "alle" || !sel) return true;
    const want = sel[g] || [];
    if (!want.length) return true;
    const s = parse(item.groesse, item.kategorie);
    if (!s.length || s.includes("ONE")) return true;   // Grösse unbekannt: lieber zeigen
    return s.some(x => want.includes(x));
  }
  /* Anzeige: Etikett + einheitliche Grösse, z.B. "W28 · M" */
  function label(item) {
    const raw = item.groesse == null ? "" : String(item.groesse).replace(/\s*\(.*?\)\s*/g, " ").trim();
    const s = parse(item.groesse, item.kategorie).filter(x => x !== "ONE");
    if (!raw) return "";
    if (!s.length || group(item.kategorie) === "schuhe") return raw;
    if (/\b(XXS|XS|S|M|L|XL|XXL|XXXL|3XL)\b/.test(raw.toUpperCase().replace(/\bL\s?\d{2}\b/g, " "))) return raw;
    return `${raw} · ${s.join("/")}`;
  }
  window.FRANKLY_SIZES = { LETTERS, SHOES, HINT_OBEN, HINT_UNTEN, group, parse, matches, label };
})();
