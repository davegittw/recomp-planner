// Offline ingredient search and recipe-line parsing. No network calls except loading the
// bundled data/usda-foods.json from this site (cached for offline use by the service worker).
window.Ing = (function () {
  "use strict";
  const CORE = (window.CORE_INGREDIENTS || []);
  let FULL = null, fullPromise = null;

  /* ---------- text helpers ---------- */
  const STOP = new Set(("of the a an and or with fresh freshly chopped finely roughly diced sliced thinly thickly minced grated crushed " +
    "peeled halved quartered cubed shredded torn trimmed rinsed drained cooked raw to serve optional about approx approximately x " +
    "for into in at room temperature softened melted beaten whisked plus extra more garnish taste season seasoning good quality " +
    "organic free range large medium small big little heaped level rounded generous splash drizzle pinch handful bunch sprig knob " +
    "tin tins can cans jar pack packet pot bag g kg ml l oz lb tbsp tsp cup cups tablespoon tablespoons teaspoon teaspoons " +
    "clove cloves slice slices rasher rashers fillet fillets piece pieces scoop scoops block ball head stick sticks").split(" "));
  function stem(w) {
    if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.length > 4 && w.endsWith("oes")) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("es") && /(ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }
  const norm = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ");
  const words = s => norm(s).replace(/[^a-z0-9%]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const keyTokens = s => words(s).filter(w => !STOP.has(w) && !/^\d+([.,]\d+)?$/.test(w)).map(stem);

  /* ---------- sources: one shape for core, USDA and your own foods ---------- */
  // base = macros for one "base amount" (100 g for database items, one serving/size for your foods)
  // units = [{l: label, f: base amounts per 1 unit, g: grams per unit or null}]
  function coreSource(c) {
    const units = [{ l: "g", f: 0.01, g: 1 }];
    for (const [l, g] of Object.entries(c.u || {})) {
      if (l === "ml") units.push({ l: "ml", f: g / 100, g });
      else units.push({ l, f: g / 100, g });
    }
    const [k, p, cb, f, fi] = c.v;
    return { ref: "core:" + c.id, kind: "core", name: c.n, emoji: c.e, base: { k, p, c: cb, f, fi }, units, note: c.s,
      _tok: new Set(keyTokens(c.n + " " + (c.a || []).join(" "))), _alias: (c.a || []).concat([c.n]).map(a => keyTokens(a).join(" ")) };
  }
  function usdaSource(r) {
    const [id, name, k, p, cb, f, fi] = r;
    return { ref: "usda:" + id, kind: "usda", name, emoji: "", base: { k, p, c: cb, f, fi }, units: [{ l: "g", f: 0.01, g: 1 }],
      note: "USDA: " + name, _tok: new Set(keyTokens(name)), _alias: [] };
  }
  function foodSource(fd) {
    const size = Number(fd.size) || 1, unit = fd.unit || "serving";
    const isMass = unit === "g" || unit === "ml";
    const units = isMass ? [{ l: unit, f: 1 / size, g: 1 }] : [{ l: unit, f: 1 / size, g: null }];
    if (fd.recipe && fd.recipe.gramsPerServing) units.push({ l: "g", f: 1 / fd.recipe.gramsPerServing, g: 1 });
    return { ref: "food:" + fd.id, kind: "food", foodId: fd.id, name: fd.name, emoji: fd.emoji || "",
      base: { k: +fd.kcal || 0, p: +fd.p || 0, c: +fd.c || 0, f: +fd.f || 0, fi: +fd.fibre || 0 }, units,
      defaultQty: isMass ? size : 1, note: fd.recipe ? "Your recipe" : "Your food",
      _tok: new Set(keyTokens(fd.name)), _alias: [keyTokens(fd.name).join(" ")] };
  }
  const coreSources = CORE.map(coreSource);
  const byRef = new Map(coreSources.map(s => [s.ref, s]));

  function loadFull() {
    if (FULL) return Promise.resolve(FULL);
    if (!fullPromise) fullPromise = fetch("data/usda-foods.json").then(r => r.json()).then(j => {
      FULL = j.rows.map(usdaSource); FULL.forEach(s => byRef.set(s.ref, s)); return FULL;
    }).catch(e => { fullPromise = null; throw e; });
    return fullPromise;
  }
  const fullLoaded = () => !!FULL;

  /* ---------- scoring ---------- */
  function tokHit(t, set, mode) {
    if (set.has(t)) return 1;
    if (t.length >= 2) for (const x of set) if (x.startsWith(t)) return mode === "search" ? 1 : 0.8;
    if (t.length >= 4) for (const x of set) if (x.length >= 4 && t.startsWith(x)) return 0.8;
    return 0;
  }
  function score(src, q, qPhrase, mode) {
    if (!q.length) return 0;
    let hit = 0, tot = 0, headHit = 1;
    const head = [...q].reverse().find(t => /[a-z]/.test(t) && !/%$/.test(t));
    for (const t of q) { const w = mode === "parse" && t === head ? 2 : 1, h = tokHit(t, src._tok, mode); hit += h * w; tot += w; if (t === head) headHit = h; }
    const cov = hit / tot;
    if (mode === "search" ? cov < 0.99 : (cov < 0.6 || headHit === 0)) return 0;
    let s = cov * 60;
    if (src._alias.includes(qPhrase)) s += 40;
    else if (src._alias.some(a => a.startsWith(qPhrase))) s += 12;
    s -= Math.max(0, src._tok.size - q.length) * (src.kind === "usda" ? 1.6 : 1.0);
    s += src.kind === "food" ? 8 : src.kind === "core" ? 6 : 0;
    if (/, raw$|, raw,/.test(src.name.toLowerCase()) && !q.includes("cooked")) s += 1;
    return s;
  }
  function candidates(foods) {
    const own = Object.values(foods || {}).map(foodSource);
    own.forEach(s => byRef.set(s.ref, s));
    return own.concat(coreSources, FULL || []);
  }
  function search(query, foods, limit = 40) {
    const q = keyTokens(query); const phrase = words(query).join(" ");
    if (!q.length) return [];
    const out = [];
    for (const s of candidates(foods)) { const sc = score(s, q, phrase, "search"); if (sc > 0) out.push([sc, s]); }
    out.sort((a, b) => b[0] - a[0] || a[1].name.length - b[1].name.length);
    return out.slice(0, limit).map(x => x[1]);
  }
  function ranked(text, foods) {
    const q = keyTokens(text); const phrase = q.join(" "), out = [];
    for (const s of candidates(foods)) { const sc = score(s, q, phrase, "parse"); if (sc > 0) out.push({ src: s, score: sc }); }
    return out.sort((a, b) => b.score - a.score || a.src.name.length - b.src.name.length);
  }
  function best(text, foods) { const r = ranked(text, foods)[0]; return r ? { src: r.src, score: r.score, strong: r.score >= 50 } : null; }

  /* ---------- quantities and units ---------- */
  const FRAC = { "½": " 1/2", "¼": " 1/4", "¾": " 3/4", "⅓": " 1/3", "⅔": " 2/3", "⅛": " 1/8", "⅕": " 1/5" };
  const UNIT = [
    [/^(kg|kilos?|kilograms?)\b/, "kg"], [/^(g|gr|grams?|grammes?)\b/, "g"], [/^(ml|millilit(er|re)s?)\b/, "ml"],
    [/^(l|lit(er|re)s?)\b/, "l"], [/^(oz|ounces?)\b/, "oz"], [/^(lbs?|pounds?)\b/, "lb"],
    [/^(tbsps?|tbs|tbls?|tablespoons?|tblsp)\b/, "tbsp"], [/^(tsps?|teaspoons?)\b/, "tsp"], [/^(cups?)\b/, "cup"],
    [/^(tins?|cans?)\b/, "tin"], [/^(cloves?)\b/, "clove"], [/^(slices?)\b/, "slice"], [/^(rashers?)\b/, "rasher"],
    [/^(handfuls?)\b/, "handful"], [/^(pinch(es)?)\b/, "pinch"], [/^(scoops?)\b/, "scoop"], [/^(fillets?)\b/, "fillet"],
    [/^(breasts?)\b/, "breast"], [/^(thighs?)\b/, "thigh"], [/^(bunch(es)?)\b/, "bunch"], [/^(packs?|packets?)\b/, "pack"],
    [/^(pots?|tubs?)\b/, "pot"], [/^(jars?)\b/, "jar"], [/^(balls?)\b/, "ball"], [/^(blocks?)\b/, "block"],
    [/^(sprigs?)\b/, "sprig"], [/^(knobs?)\b/, "knob"], [/^(splash(es)?)\b/, "splash"], [/^(drizzles?)\b/, "drizzle"],
    [/^(pieces?)\b/, "piece"], [/^(bags?)\b/, "bag"], [/^(sticks?)\b/, "stick"], [/^(heads?)\b/, "head"],
    [/^(stalks?)\b/, "stick"], [/^(small)\b/, "small"], [/^(medium)\b/, "medium"], [/^(large|big)\b/, "large"]
  ];
  const GENERIC = { tbsp: 15, tsp: 5, cup: 240, handful: 30, pinch: 0.4, knob: 10, splash: 15, drizzle: 7, sprig: 1, bunch: 30, slice: 30 };

  function parseQty(s) {
    s = s.replace(/(\d)?([½¼¾⅓⅔⅛⅕])/g, (m, d, f) => (d ? d + " " : "") + FRAC[f].trim()).replace(/^\s+/, "");
    let m, n = null, len = 0;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)/))) { n = +m[1] + (+m[2]) / (+m[3]); len = m[0].length; }
    else if ((m = s.match(/^(\d+)\/(\d+)/))) { n = (+m[1]) / (+m[2]); len = m[0].length; }
    else if ((m = s.match(/^(\d+(?:[.,]\d+)?)/))) { n = parseFloat(m[1].replace(",", ".")); len = m[0].length; }
    if (n != null) {
      const r = s.slice(len).match(/^\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?)/);
      if (r) { n = (n + parseFloat(r[1].replace(",", "."))) / 2; len += r[0].length; }
      const x = s.slice(len).match(/^\s*(?:x\b|×)\s*/i); if (x) len += x[0].length;
      return [n, s.slice(len).replace(/^\s+/, "")];
    }
    const w = s.match(/^(a|an|one|two|three|four|five|six|half(?: a| an)?)\b\s*/i);
    if (w) { const k = w[1].toLowerCase(); return [{ a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[k] ?? 0.5, s.slice(w[0].length)]; }
    return [null, s];
  }
  function parseUnit(s) {
    const t = s.toLowerCase();
    for (const [re, u] of UNIT) { const m = t.match(re); if (m) return [u, s.slice(m[0].length).replace(/^\s*(of\s+)?/i, "")]; }
    return [null, s];
  }
  function findPortion(src, word) {
    if (!word) return -1;
    const w = stem(word);
    return src.units.findIndex(u => u.l !== "g" && u.l !== "ml" && words(u.l).map(stem).some(t => t === w || t.startsWith(w)));
  }
  function firstCountPortion(src) {
    return src.units.findIndex(u => u.l !== "g" && u.l !== "ml" && !/^(tbsp|tsp|pinch)\b|^cup( grated)?$/.test(u.l) && u.g != null);
  }
  function ensureUnit(row, label, grams) {
    let i = row.units.findIndex(u => u.l === label);
    if (i < 0 && row.units.some(u => u.g === 1)) { row.units = row.units.concat([{ l: label, f: grams / 100, g: grams, approx: true }]); i = row.units.length - 1; }
    return i;
  }

  /* ---------- rows ---------- */
  function makeRow(src, qty, unitIndex) {
    const row = { ref: src.ref, kind: src.kind, foodId: src.foodId || null, name: src.name, emoji: src.emoji || "",
      base: Object.assign({}, src.base), units: src.units.map(u => Object.assign({}, u)), u: 0, q: 1 };
    if (unitIndex != null && unitIndex >= 0) { row.u = unitIndex; row.q = qty ?? 1; }
    else { const i = naturalPortion(src); if (src.defaultQty) { row.q = src.defaultQty; } else if (i >= 0) { row.u = i; row.q = 1; } else { row.q = 100; } }
    return row;
  }
  function rowMacros(row) {
    const u = row.units[row.u] || row.units[0], m = (Number(row.q) || 0) * (u ? u.f : 0), b = row.base;
    return { kcal: b.k * m, p: b.p * m, c: b.c * m, f: b.f * m, fi: (b.fi || 0) * m };
  }
  function rowGrams(row) { const u = row.units[row.u]; return u && u.g != null ? (Number(row.q) || 0) * u.g : null; }

  const METHOD = /^(preheat|heat|add|mix|stir|cook|bake|roast|serve|place|combine|season|bring|pour|chop|fry|simmer|blend|whisk|top|garnish|leave|let|remove|transfer|spread|sprinkle|then|once|meanwhile|step|put|boil|drain|toss|marinate|grill|air ?fry|enjoy|divide|store|cover|line|meal ?prep|tag|follow|save|comment|recipe)\b/i;
  // Read the amount part of a line: quantity, unit and the food words.
  function readAmount(raw) {
    let line = String(raw).replace(/^[\s\-–•*·▪︎✔️☐□○●◦>]+/, "").replace(/\s+/g, " ").trim();
    if (!line || !/[a-z]/i.test(line)) return null;
    if (/:$/.test(line) || /^(ingredients?|method|instructions?|directions?|steps?|serves|makes|macros?|nutrition|calories|for the)\b/i.test(line)) return null;
    if (line.length > 110 || /^#/.test(line)) return null;
    if (/^(salt|sea salt|black pepper|pepper|salt\s*(and|&|\+)\s*(black\s+)?pepper|seasoning|to taste)\b[^0-9]*$/i.test(line)) return null;
    if (!/^[\d½¼¾⅓⅔⅛]/.test(line) && (METHOD.test(line) || /\b(minutes?|mins|°c?|degrees|oven|until|preheated)\b/i.test(line))) return null;
    let bracketG = null, bracketUnit = "g";
    const bm = line.match(/\(\s*(?:about\s+|approx\.?\s+)?(\d+(?:[.,]\d+)?)\s*(g|ml|kg)\b[^)]*\)/i);
    if (bm) { bracketG = parseFloat(bm[1].replace(",", ".")) * (bm[2].toLowerCase() === "kg" ? 1000 : 1); bracketUnit = bm[2].toLowerCase() === "ml" ? "ml" : "g"; line = line.replace(bm[0], " "); }
    let [qty, rest] = parseQty(line);
    let [unit, rest2] = parseUnit(rest);
    if (qty == null) { const tm = rest2.match(/\s+x\s*(\d+(?:\.\d+)?)\s*$/i) || rest2.match(/\s+(\d+(?:\.\d+)?)\s*(g|ml)\s*$/i);
      if (tm) { qty = parseFloat(tm[1]); if (tm[2]) unit = tm[2].toLowerCase(); rest2 = rest2.slice(0, tm.index); } }
    const sizeWord = unit === "small" || unit === "medium" || unit === "large" ? unit : null;
    let text = rest2.split(/,|\s+[-–]\s+|\s+\(|;/)[0].replace(/\)/g, " ").trim();
    if (!text) text = rest2;
    return { line: String(raw).trim(), qty, unit, sizeWord, bracketG, bracketUnit, text };
  }
  // A sensible single portion to default to (an egg, a slice, a fillet), never a whole block or bag.
  function naturalPortion(src) {
    return src.units.findIndex(u => u.l !== "g" && u.l !== "ml" && u.g != null && u.g <= 250 &&
      !/^(tbsp|tsp|pinch)\b|^cup( grated)?$|^(block|bag|pack|tin|carton|pouch|head|ball|jar|pint|whole \()/.test(u.l));
  }
  // Fit an amount onto a chosen food.
  function applyAmount(src, a) {
    const row = makeRow(src, null, null); row.line = a.line;
    const { qty, unit, sizeWord, bracketG, bracketUnit } = a, n = qty == null ? 1 : qty;
    const setGrams = (g, lab) => { const gi = row.units.findIndex(u => u.l === (lab || "g")); if (gi >= 0) { row.u = gi; row.q = round(lab === "ml" ? g : g / (row.units[gi].g || 1)); } else { row.approx = true; } };
    if (bracketG != null) { setGrams(bracketG, bracketUnit === "ml" && row.units.some(u => u.l === "ml") ? "ml" : "g"); if (bracketUnit === "ml") row.q = bracketG; }
    else if (unit === "g" || unit === "kg" || unit === "oz" || unit === "lb") setGrams(n * { g: 1, kg: 1000, oz: 28.35, lb: 453.6 }[unit]);
    else if (unit === "ml" || unit === "l") {
      const ml = n * (unit === "l" ? 1000 : 1), mi = row.units.findIndex(u => u.l === "ml");
      if (mi >= 0) { row.u = mi; row.q = round(ml); } else setGrams(ml);
    }
    else if (unit && !sizeWord) {
      let i = findPortion(src, unit);
      if (i < 0 && GENERIC[unit] != null) { i = ensureUnit(row, unit, GENERIC[unit]); if (unit === "cup") row.approx = true; }
      if (i < 0) { i = naturalPortion(src); row.approx = true; }
      if (i >= 0) { row.u = i; row.q = n; } else { row.q = round(n * 100); row.approx = true; }
    } else {
      let i = sizeWord ? findPortion(src, sizeWord) : -1;
      if (i < 0) i = naturalPortion(src);
      if (src.kind === "food") { row.u = 0; row.q = qty == null ? src.defaultQty || 1 : (row.units[0].g ? n * (src.defaultQty || 1) : n); }
      else if (i >= 0) { row.u = i; row.q = n; }
      else if (qty != null && qty >= 10) { row.u = 0; row.q = qty; }
      else if (qty == null && (findPortion(src, "tbsp") >= 0 || findPortion(src, "tsp") >= 0)) { row.u = findPortion(src, "tbsp") >= 0 ? findPortion(src, "tbsp") : findPortion(src, "tsp"); row.q = 1; row.approx = true; }
      else { row.u = 0; row.q = 100 * n; row.approx = true; }
    }
    return row;
  }
  function parseLine(raw, foods) {
    const a = readAmount(raw);
    if (!a) return null;
    const list = ranked(a.text, foods);
    if (!list.length) return { line: a.line, text: a.text, row: null };
    let m = list[0];
    const wantWord = a.unit && !["g", "kg", "ml", "l", "oz", "lb"].includes(a.unit) ? a.unit : null;
    if (wantWord) { const alt = list.find(x => x.score >= m.score - 10 && findPortion(x.src, wantWord) >= 0); if (alt) m = alt; }
    const row = applyAmount(m.src, a);
    if (m.score < 50) row.approx = true;
    return { line: a.line, text: a.text, row };
  }
  // Re-fit a recipe line's amount onto a food the user picked by hand. Null if the line has no amount.
  function fitLine(src, raw) {
    const a = readAmount(raw);
    if (!a || (a.qty == null && !a.unit && a.bracketG == null)) return null;
    const row = applyAmount(src, a); row.approx = false; return row;
  }
  const round = v => Math.round(v * 10) / 10;

  function splitMeal(text) { return String(text).split(/\n|,|;|\s+\+\s+|\s+and\s+|\s+&\s+|\s+with\s+/i).map(s => s.trim()).filter(Boolean); }
  function splitRecipe(text) { return String(text).split(/\n/).map(s => s.trim()).filter(Boolean); }

  // Turn an older Claude-imported recipe item into an editable row (grams-based).
  function legacyItemRow(it) {
    const g = Number(it.grams) || 0, k = g > 0 ? 100 / g : 0;
    return { ref: "legacy", kind: "legacy", name: it.name, emoji: "", base: { k: (it.kcal || 0) * k, p: (it.p || 0) * k, c: (it.c || 0) * k, f: (it.f || 0) * k, fi: 0 },
      units: [{ l: "g", f: 0.01, g: 1 }], u: 0, q: g };
  }

  function get(ref, foods) {
    if (!ref) return null;
    if (ref.startsWith("food:")) { const fd = (foods || {})[ref.slice(5)]; return fd ? foodSource(fd) : null; }
    return byRef.get(ref) || null;
  }

  return { search, best, parseLine, fitLine, readAmount, get, splitMeal, splitRecipe, makeRow, rowMacros, rowGrams, loadFull, fullLoaded,
    foodSource, legacyItemRow, get coreCount() { return CORE.length; } };
})();
