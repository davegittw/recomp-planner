// Weekly meal planner. Works offline from your meal ideas and saved recipes; every calorie and protein
// figure comes from the same ingredient database the rest of the app uses.
// meals: { [mid]: { mid, name, cat: Breakfast|Lunch|Dinner|Snack, serves, per:{kcal,p,c,f}, batch, liked } }
// people: [{ id, name, kcal, protein, slots:{breakfast,lunch,dinner,snack} }]
window.Planner = (function () {
  "use strict";
  const SLOTS = ["breakfast", "lunch", "dinner", "snack"], CAT = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
  const LIKED = /steak|curry|tikka|fajita|paella|pasta|bolognese|spaghetti|orzo|chilli|stir-fry/i;
  function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const q25 = v => Math.round(v * 4) / 4;

  function pick(cands, used, rand, opts) {
    let best = null, bs = -1e9;
    for (const m of cands) {
      let s = rand() * 2;
      if (used.has(m.mid)) s -= 8;
      if ((opts.prev || new Set()).has(m.mid)) s -= 2.5;           // in last week's plan
      if ((opts.fav || []).includes(m.mid)) s += 3;
      if (m.liked || LIKED.test(m.name)) s += 1.2;
      if (m.own) s += 0.8;
      if (opts.wantBatch != null) s += (m.batch === opts.wantBatch ? 1.5 : 0);
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }
  function generate(o) {
    // o: { week, meals, people, prefs:{weekdayBreakfast, weekendBreakfast, batch:true}, prevMids:[], seed }
    const rand = rng(o.seed || o.week), P = o.prefs || {}, meals = Object.values(o.meals).filter(m => !(P.hide || []).includes(m.mid));
    const by = c => meals.filter(m => m.cat === c), used = new Set(), prev = new Set(o.prevMids || []), fav = P.fav || [];
    const days = [];
    for (let i = 0; i < 7; i++) days.push({ slots: {} });
    // breakfasts: your usual on weekdays, a cooked one at weekends
    const bfs = by("Breakfast"), wk = o.meals[P.weekdayBreakfast] || bfs[0], we = o.meals[P.weekendBreakfast] || bfs[0];
    for (let i = 0; i < 7; i++) days[i].slots.breakfast = { mid: (i >= 5 ? we : wk).mid };
    // dinners: seven different ones, about half of them batch cooks that cover the next day's lunch
    const dins = by("Dinner");
    for (let i = 0; i < 7; i++) {
      const wantBatch = P.batch === false ? null : (i % 2 === 0 && i < 6); // Mon, Wed, Fri, (Sun stays free)
      const m = pick(dins, used, rand, { prev, fav, wantBatch }); if (!m) break;
      used.add(m.mid); days[i].slots.dinner = { mid: m.mid };
    }
    fillLunches(days, o.meals, meals, used, rand, { prev, fav, batch: P.batch !== false });
    // snacks rotate; whether each person has one is decided when portions are worked out
    const sn = by("Snack");
    for (let i = 0; i < 7; i++) { const m = sn.length ? sn[(i + Math.floor(rand() * sn.length)) % sn.length] : null; if (m) days[i].slots.snack = { mid: m.mid }; }
    const plan = { week: o.week, created: Date.now(), days };
    return recompute(plan, o.meals, o.people);
  }
  function fillLunches(days, mealsMap, meals, used, rand, opts) {
    const lun = meals.filter(m => m.cat === "Lunch");
    for (let i = 0; i < 7; i++) {
      const cur = days[i].slots.lunch; if (cur && cur.locked) continue;
      const y = i > 0 && days[i - 1].slots.dinner, ym = y && mealsMap[y.mid];
      if (opts.batch && ym && ym.batch) { days[i].slots.lunch = { mid: ym.mid, leftover: true }; continue; }
      if (cur && !cur.leftover && mealsMap[cur.mid]) continue;
      const m = pick(lun, used, rand, opts); if (m) { used.add(m.mid); days[i].slots.lunch = { mid: m.mid }; }
    }
  }
  // Work out portions for each person so their day lands near their calorie target, then how much to cook.
  function recompute(plan, mealsMap, people) {
    const D = plan.days;
    for (let i = 0; i < D.length; i++) {
      const sl = D[i].slots; D[i].tot = {}; D[i].tgt = {};
      for (const s of SLOTS) if (sl[s]) sl[s].portions = {};
      for (const p of people) {
        const on = s => sl[s] && mealsMap[sl[s].mid] && (p.slots || {})[s] !== false;
        const k = s => on(s) ? mealsMap[sl[s].mid].per.kcal : 0, pr = s => on(s) ? mealsMap[sl[s].mid].per.p : 0;
        // only the share of the day this person eats from the plan: breakfast 25%, lunch 30%, dinner 35%, snack 10%
        const SHARE = { breakfast: 0.25, lunch: 0.3, dinner: 0.35, snack: 0.1 };
        const K = p.kcal * SLOTS.reduce((a, s) => a + ((p.slots || {})[s] !== false && sl[s] ? SHARE[s] : 0), 0), Pt = p.protein * K / p.kcal;
        D[i].tgt[p.id] = { kcal: K, p: Pt };
        const fixed = k("breakfast"), flex = k("lunch") + k("dinner");
        let snack = on("snack") ? 1 : 0, f = flex ? (K - fixed) / flex : 1;
        // add the snack only when the main meals would otherwise have to be huge, or protein would fall short
        if (snack) { const fNo = f, fYes = flex ? (K - fixed - k("snack")) / flex : 1, protNo = pr("breakfast") + (pr("lunch") + pr("dinner")) * Math.min(1.75, fNo);
          if (fNo <= 1.3 && protNo >= Pt * 0.95) snack = 0; else f = fYes; }
        f = Math.max(0.5, Math.min(1.75, q25(f)));
        let bq = 1; if (f <= 0.5 && fixed > 0) bq = 0.75;
        if (on("breakfast")) sl.breakfast.portions[p.id] = bq;
        if (on("lunch")) sl.lunch.portions[p.id] = f;
        if (on("dinner")) sl.dinner.portions[p.id] = f;
        if (on("snack") && snack) sl.snack.portions[p.id] = 1;
        const t = { kcal: 0, p: 0 };
        for (const s of SLOTS) { const q = sl[s] && sl[s].portions[p.id]; if (q) { const m = mealsMap[sl[s].mid]; t.kcal += m.per.kcal * q; t.p += m.per.p * q; } }
        D[i].tot[p.id] = t;
      }
    }
    // cooking: a batch dinner also makes the next day's leftover lunch
    for (let i = 0; i < D.length; i++) for (const s of SLOTS) {
      const x = D[i].slots[s]; if (!x) continue; const own = Object.values(x.portions || {}).reduce((a, b) => a + b, 0);
      if (x.leftover) { x.cook = 0; continue; }
      const next = s === "dinner" && D[i + 1] && D[i + 1].slots.lunch && D[i + 1].slots.lunch.leftover && D[i + 1].slots.lunch.mid === x.mid ? D[i + 1].slots.lunch : null;
      x.cook = own + (next ? Object.values(next.portions || {}).reduce((a, b) => a + b, 0) : 0);
    }
    return plan;
  }
  function alternatives(plan, mealsMap, dayIdx, slot, prefs) {
    const cur = plan.days[dayIdx].slots[slot], cat = CAT[slot], inWeek = new Set(plan.days.map(d => (d.slots[slot] || {}).mid));
    return Object.values(mealsMap).filter(m => m.cat === cat && !(prefs.hide || []).includes(m.mid) && (!cur || m.mid !== cur.mid))
      .sort((a, b) => (inWeek.has(a.mid) - inWeek.has(b.mid)) || ((prefs.fav || []).includes(b.mid) - (prefs.fav || []).includes(a.mid)) || a.name.localeCompare(b.name));
  }
  function setMeal(plan, mealsMap, people, dayIdx, slot, mid, prefs) {
    const d = plan.days[dayIdx]; d.slots[slot] = { mid };
    if (slot === "dinner" && plan.days[dayIdx + 1]) { const l = plan.days[dayIdx + 1].slots.lunch; if (l && l.leftover) delete plan.days[dayIdx + 1].slots.lunch; }
    const used = new Set(plan.days.flatMap(x => Object.values(x.slots).map(s => s.mid)));
    fillLunches(plan.days, mealsMap, Object.values(mealsMap).filter(m => !(prefs.hide || []).includes(m.mid)), used, rng(Date.now()), { prev: new Set(), fav: prefs.fav || [], batch: prefs.batch !== false });
    return recompute(plan, mealsMap, people);
  }
  function shuffle(plan, mealsMap, people, dayIdx, slot, prefs) {
    const alts = alternatives(plan, mealsMap, dayIdx, slot, prefs).filter(m => !plan.days.some(d => (d.slots[slot] || {}).mid === m.mid));
    const list = alts.length ? alts : alternatives(plan, mealsMap, dayIdx, slot, prefs); if (!list.length) return plan;
    const m = list[Math.floor(Math.random() * Math.min(list.length, 6))];
    return setMeal(plan, mealsMap, people, dayIdx, slot, m.mid, prefs);
  }
  return { SLOTS, CAT, generate, recompute, alternatives, setMeal, shuffle };
})();
