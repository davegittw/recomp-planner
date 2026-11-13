// Progress maths and the weekly coaching review. Pure functions over your logged data, no network.
// Every number it shows can be traced back: trend weights use exponential smoothing, rates use a
// least-squares line through the last three weeks of weigh-ins, maintenance comes from intake minus
// the energy in the weight change (7,700 kcal per kg).
window.Progress = (function () {
  "use strict";
  const DAY = 86400000, KCAL_PER_KG = 7700;
  const pd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
  const pad = n => String(n).padStart(2, "0");
  const iso = t => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const add = (s, n) => { const d = new Date(pd(s)); d.setDate(d.getDate() + n); return iso(d.getTime()); };
  const diff = (a, b) => Math.round((pd(b) - pd(a)) / DAY);
  const monday = s => { const d = new Date(pd(s)); return add(s, -((d.getDay() + 6) % 7)); };
  const r1 = v => Math.round(v * 10) / 10, r0 = Math.round;
  const f2 = v => (Math.round(v * 100) / 100).toFixed(2);
  const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

  /* phases: target weekly change as % of body weight */
  const PHASES = {
    cut: { n: "Fat loss", lo: -1.0, hi: -0.5, kcalAdj: -450, blurb: "lose fat at 0.5–1% of body weight a week while keeping strength" },
    recomp: { n: "Recomp", lo: -0.35, hi: 0.05, kcalAdj: -150, blurb: "hold weight roughly steady or drift slightly down while waist drops and lifts go up" },
    build: { n: "Lean bulk", lo: 0.1, hi: 0.25, kcalAdj: 200, blurb: "gain slowly, 0.1–0.25% a week, so most of it is muscle" },
    maintain: { n: "Maintain", lo: -0.2, hi: 0.2, kcalAdj: 0, blurb: "keep weight stable" },
  };

  /* ---------- body ---------- */
  function bodyLog(days) {
    return Object.keys(days || {}).sort().map(d => ({ date: d, ...(days[d].body || {}) })).filter(x => x.weight > 0 || x.waist > 0 || x.bf > 0);
  }
  // Exponentially smoothed weight (10% of each new weigh-in, adjusted for gaps between weigh-ins)
  function trend(log) {
    const out = []; let t = null, last = null;
    for (const x of log) { if (!(x.weight > 0)) continue;
      if (t == null) t = x.weight; else { const gap = Math.max(1, diff(last, x.date)); const a = 1 - Math.pow(0.9, gap); t = t + a * (x.weight - t); }
      last = x.date; out.push({ date: x.date, weight: x.weight, trend: t }); }
    return out;
  }
  // Least-squares slope through weigh-ins in [from, to]; null unless there's enough data to trust it
  function rate(log, to, windowDays) {
    windowDays = windowDays || 21; const from = add(to, -windowDays + 1);
    const pts = log.filter(x => x.weight > 0 && x.date >= from && x.date <= to);
    if (pts.length < 5) return { ok: false, n: pts.length, why: `${pts.length} weigh-in${pts.length === 1 ? "" : "s"} in the last ${windowDays} days; I need at least 5` };
    const span = diff(pts[0].date, pts[pts.length - 1].date);
    if (span < 10) return { ok: false, n: pts.length, why: `weigh-ins only cover ${span} days; I need at least 10` };
    const xs = pts.map(p => diff(from, p.date)), ys = pts.map(p => p.weight), mx = mean(xs), my = mean(ys);
    let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
    const perDay = den ? num / den : 0, level = my + perDay * (diff(from, to) - mx);
    return { ok: true, n: pts.length, span, perWeek: perDay * 7, pctPerWeek: perDay * 7 / level * 100, level };
  }
  function lastOf(log, k, upto) { for (let i = log.length - 1; i >= 0; i--) if (log[i][k] > 0 && (!upto || log[i].date <= upto)) return log[i]; return null; }
  // Relative fat mass (Woolcott & Bergman 2018): men 64 − 20 × height / waist. An estimate, not a measurement.
  function rfm(heightCm, waistCm, sex) { if (!(heightCm > 0 && waistCm > 0)) return null; return (sex === "female" ? 76 : 64) - 20 * heightCm / waistCm; }
  // Mifflin–St Jeor resting energy × activity factor. Only a starting point until your own data takes over.
  function mifflin(P, kg) { if (!(P.age > 0 && P.heightCm > 0 && kg > 0)) return null; const bmr = 10 * kg + 6.25 * P.heightCm - 5 * P.age + (P.sex === "female" ? -161 : 5); return { bmr, tdee: bmr * (P.activity || 1.55), factor: P.activity || 1.55 }; }

  /* ---------- food ---------- */
  function dayIntake(d) { const t = { kcal: 0, p: 0, n: 0 }; for (const m of (d && d.meals) || []) { if (!m.eaten) continue; const k = (Number(m.qty) || 0) / (Number(m.size) || 1); t.kcal += (m.kcal || 0) * k; t.p += (m.p || 0) * k; t.n++; } return t; }
  // Days count as logged only when they hold a realistic day's food, so a forgotten evening doesn't drag the average down
  function intake(days, from, to, minKcal) {
    minKcal = minKcal || 1200; const kc = [], pr = []; let partial = 0;
    for (let d = from; d <= to; d = add(d, 1)) { const t = dayIntake(days[d]); if (!t.n) continue; if (t.kcal < minKcal) { partial++; continue; } kc.push(t.kcal); pr.push(t.p); }
    return { days: kc.length, partial, kcal: mean(kc), protein: mean(pr) };
  }
  function maintenance(days, log, to) {
    const R = rate(log, to, 28); if (!R.ok) return { ok: false, why: R.why };
    const I = intake(days, add(to, -27), to);
    if (I.days < 14) return { ok: false, why: `${I.days} fully logged days in the last 4 weeks; I need 14` };
    const kcal = I.kcal - R.perWeek / 7 * KCAL_PER_KG;
    return { ok: true, kcal, intake: I.kcal, perWeek: R.perWeek, days: I.days, calc: `${Math.round(I.kcal)} kcal average intake ${R.perWeek <= 0 ? "+" : "−"} ${Math.round(Math.abs(R.perWeek / 7 * KCAL_PER_KG))} kcal/day from ${R.perWeek <= 0 ? "losing" : "gaining"} ${f2(Math.abs(R.perWeek))} kg a week` };
  }

  /* ---------- training ---------- */
  function sessionDays(days, from, to) { const out = []; for (let d = from; d <= to; d = add(d, 1)) { const log = (days[d] && days[d].log) || {}; let n = 0; for (const rows of Object.values(log)) n += (rows || []).filter(r => r && r.done).length; if (n) out.push({ date: d, sets: n }); } return out; }
  function runs(days, from, to) { const out = []; for (let d = from; d <= to; d = add(d, 1)) for (const r of (days[d] && days[d].runs) || []) out.push({ date: d, ...r }); return out; }
  function bestE1rmByWeek(days, exId, weeks, today) {
    const out = []; const m0 = monday(today);
    for (let w = weeks - 1; w >= 0; w--) { const from = add(m0, -7 * w), to = add(from, 6); let best = 0;
      for (let d = from; d <= to; d = add(d, 1)) for (const r of ((days[d] && days[d].log) || {})[exId] || []) if (r && r.done) best = Math.max(best, window.Coach.e1rm(+r.w || 0, parseInt(r.r) || 0, r.rir === "" || r.rir == null ? null : +r.rir));
      out.push({ week: from, v: best || null }); }
    return out;
  }
  function topLifts(days, n) {
    const c = {}; for (const d of Object.values(days || {})) for (const [id, rows] of Object.entries(d.log || {})) if ((rows || []).some(r => r && r.done && +r.w > 0)) c[id] = (c[id] || 0) + 1;
    return Object.entries(c).filter(([, k]) => k >= 2).sort((a, b) => b[1] - a[1]).slice(0, n || 6).map(([id]) => id);
  }
  function checkins(days, from, to) { const sl = [], en = []; const S = { poor: 1, ok: 2, good: 3, low: 1, high: 3 };
    for (let d = from; d <= to; d = add(d, 1)) { const c = days[d] && days[d].checkin; if (!c) continue; if (S[c.sleep]) sl.push(S[c.sleep]); if (S[c.energy]) en.push(S[c.energy]); }
    return { sleep: mean(sl), energy: mean(en), n: Math.max(sl.length, en.length) }; }

  /* ---------- weekly review ---------- */
  // weekStart = Monday. Returns { items:[{area, tone, text, calc?, action?}], ... }
  function review(o) {
    const { days, settings, weekStart, today } = o, P = settings.profile || {}, T = settings.targets || {}, G = settings.goal || {};
    const phase = PHASES[G.phase] || PHASES.recomp, weekEnd = add(weekStart, 6), upto = weekEnd < today ? weekEnd : today, partialWeek = upto < weekEnd;
    const items = [], log = bodyLog(days), tr = trend(log);
    const say = (area, tone, text, extra) => items.push(Object.assign({ area, tone, text }, extra || {}));
    // weight
    const R = rate(log, upto, 21), wkW = log.filter(x => x.weight > 0 && x.date >= weekStart && x.date <= upto);
    const prevW = log.filter(x => x.weight > 0 && x.date >= add(weekStart, -7) && x.date < weekStart);
    const avgW = mean(wkW.map(x => x.weight)), avgPrev = mean(prevW.map(x => x.weight));
    let rateVerdict = null;
    if (!R.ok) say("Weight", "info", `Not enough weigh-ins to judge your trend yet: ${R.why}. Weigh in most mornings, after the loo and before food; I only use the trend across weeks, never a single day.`);
    else {
      const pct = R.pctPerWeek; rateVerdict = pct < phase.lo ? "fast-down" : pct > phase.hi ? "too-up" : "on";
      const dir = R.perWeek < 0 ? "down" : "up";
      say("Weight", rateVerdict === "on" ? "good" : "warn",
        `Trend is ${dir} ${f2(Math.abs(R.perWeek))} kg a week (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% of body weight). For ${phase.n.toLowerCase()} the aim is ${phase.lo}% to ${phase.hi}%, so that's ${rateVerdict === "on" ? "on track" : ({ "fast-down": { cut: "faster than planned, which risks muscle and strength", build: "below the range: you're not gaining yet", recomp: "dropping faster than a recomp needs", maintain: "drifting down" }, "too-up": { cut: "slower than planned", build: "faster than needed, so more of the gain will be fat", recomp: "drifting up", maintain: "drifting up" } })[rateVerdict][G.phase || "recomp"]}.`,
        { calc: `Straight line through ${R.n} weigh-ins over ${R.span} days.${avgW != null && avgPrev != null ? ` Weekly averages: ${r1(avgPrev)} → ${r1(avgW)} kg.` : ""}` });
    }
    // waist
    const wNow = lastOf(log, "waist", upto), wThen = (() => { for (const x of log) if (x.waist > 0 && x.date >= add(upto, -35) && x.date <= add(upto, -21)) return x; return null; })();
    if (wNow && wThen) { const d = wNow.waist - wThen.waist;
      say("Waist", d < -0.3 ? "good" : d > 0.5 ? "warn" : "info", `Waist ${d < 0 ? "down" : d > 0 ? "up" : "unchanged at"} ${d ? Math.abs(r1(d)) + " cm" : r1(wNow.waist) + " cm"} since ${wThen.date.slice(8)}/${wThen.date.slice(5, 7)} (${r1(wThen.waist)} → ${r1(wNow.waist)} cm).` +
        (R.ok && R.perWeek > -0.05 && d < -0.5 ? " Weight steady while your waist drops usually means you're losing fat and gaining muscle at the same time." : "")); }
    else if (!wNow) say("Waist", "info", "No waist measurement yet. Measure once a week at the navel, relaxed, same time of day: it's the best check on belly fat.");
    // nutrition
    const I = intake(days, weekStart, upto), Iprev = intake(days, add(weekStart, -21), add(weekStart, -1));
    if (I.days >= 3) {
      const dk = I.kcal - T.kcal, dp = I.protein - T.protein;
      say("Food", Math.abs(dk) <= T.kcal * 0.07 && dp > -15 ? "good" : "warn", `Averaged ${r0(I.kcal)} kcal and ${r0(I.protein)} g protein on ${I.days} fully logged day${I.days === 1 ? "" : "s"} (targets ${T.kcal} and ${T.protein}).` +
        (dp < -15 ? ` Protein is short by about ${r0(-dp)} g a day: a shake or a Greek yoghurt pot closes most of that.` : ""), { calc: I.partial ? `${I.partial} day${I.partial === 1 ? "" : "s"} under 1,200 kcal left out as probably incomplete.` : null });
    } else say("Food", "info", `Only ${I.days} fully logged day${I.days === 1 ? "" : "s"} this week, so I can't judge calories. Logging at least 5 days makes the weekly check-in worth having.`);
    // calorie decision: needs a trustworthy trend, enough logging, and the current target to have had time to work
    const lastChange = (settings.kcalHistory || []).slice(-1)[0], sinceChange = lastChange ? diff(lastChange.date, upto) : 99;
    const M = maintenance(days, log, upto);
    if (false) say("Maintenance", "info", `Your measured maintenance is about ${Math.round(M.kcal / 10) * 10} kcal a day.`, { calc: M.calc + ` (${M.days} logged days). This includes your training and runs, so it's more accurate than any formula.` });
    if (R.ok && rateVerdict !== "on") {
      const I3 = intake(days, add(upto, -20), upto);
      const why = []; if (I3.days < 10) why.push(`only ${I3.days} fully logged days in the last 3 weeks`); if (sinceChange < 14) why.push(`your calorie target changed ${sinceChange} days ago, so it hasn't had two weeks to show up on the scales`);
      if (I3.days >= 10 && Math.abs(I3.kcal - T.kcal) > 150) why.push(`you've been eating ${r0(I3.kcal)} kcal against a ${T.kcal} target, so the target itself hasn't really been tested; aim to hit it first`);
      const midPct = (phase.lo + phase.hi) / 2, wantPerWeek = midPct / 100 * R.level, gap = wantPerWeek - R.perWeek;
      let adj = Math.round(gap * KCAL_PER_KG / 7 / 50) * 50; adj = Math.max(-300, Math.min(300, adj));
      if (why.length || !adj) say("Calories", "info", `No calorie change yet: ${why.join("; ") || "the gap is too small to matter"}.`);
      else say("Calories", "act", `Suggest ${adj > 0 ? "adding" : "cutting"} ${Math.abs(adj)} kcal a day, to ${T.kcal + adj}. Keep protein where it is and take the change from carbs and fat.`,
        { calc: `Aim is ${midPct > 0 ? "+" : ""}${midPct.toFixed(2)}% a week (${f2(wantPerWeek)} kg); trend is ${f2(R.perWeek)} kg. The ${f2(Math.abs(gap))} kg gap × 7,700 kcal ÷ 7 days ≈ ${r0(Math.abs(gap) * KCAL_PER_KG / 7)} kcal a day, rounded and capped at 300 so changes stay gradual.`,
          action: { type: "kcal", to: T.kcal + adj, from: T.kcal } });
    } else if (R.ok) say("Calories", "good", `Keep calories at ${T.kcal}. The trend is where it should be, so there's nothing to change.`);
    // training
    const sess = sessionDays(days, weekStart, upto), planned = P.weeklySessions || 5;
    say("Training", sess.length >= planned ? "good" : partialWeek ? "info" : "warn", `${sess.length} resistance session${sess.length === 1 ? "" : "s"}${partialWeek ? " so far" : ""} (plan ${planned}), ${sess.reduce((a, s) => a + s.sets, 0)} working sets.`);
    if (window.Coach) {
      const W = window.Coach.weekly(days, o.userEx || {}, upto);
      const under = Object.entries(W).filter(([m, w]) => !["forearms", "adductors", "traps", "obliques", "lowback"].includes(m) && w.sets < w.range[0] * (partialWeek ? 0.5 : 0.75)).map(([m]) => m);
      const over = Object.entries(W).filter(([, w]) => w.sets > w.range[1] * 1.15).map(([m]) => m);
      if (under.length && !partialWeek) say("Muscles", "warn", `Low on ${window.Coach.listNames(under).toLowerCase()} this week. Leave the generator blank next time and it will lean towards them.`);
      if (over.length) say("Muscles", "warn", `${window.Coach.listNames(over)} went well past a useful weekly volume. More sets there mostly adds fatigue.`);
      // strength trend on main lifts
      const lifts = topLifts(days, 5), up = [], flat = [];
      for (const id of lifts) { const s = bestE1rmByWeek(days, id, 5, upto).filter(x => x.v); if (s.length < 3) continue; const now = Math.max(...s.slice(-2).map(x => x.v)), then = Math.max(...s.slice(0, -2).map(x => x.v));
        const name = (window.Coach.pool(o.userEx || {}).get(id) || {}).name || id; if (now > then * 1.01) up.push(`${name} ${r1(then)} → ${r1(now)} kg`); else flat.push(name); }
      if (up.length) say("Strength", "good", `Estimated maxes up: ${up.join(", ")}.`);
      // deload: stalls plus fatigue, or a long block
      const C = checkins(days, add(upto, -13), upto), lastDeload = settings.lastDeload, weeksSince = lastDeload ? Math.floor(diff(lastDeload, upto) / 7) : null;
      const tired = C.n >= 4 && ((C.energy != null && C.energy < 1.7) || (C.sleep != null && C.sleep < 1.6));
      if ((flat.length >= 2 && flat.length >= up.length && tired) || (weeksSince != null && weeksSince >= 8 && flat.length >= 2)) say("Recovery", "act", `${flat.length} main lifts have stalled${tired ? " and your sleep or energy has been low" : ""}. A lighter week (about half the sets, 3 reps in reserve) usually brings strength back up.`, { action: { type: "deload" }, calc: `Stalled: ${flat.join(", ")}.${weeksSince != null ? ` ${weeksSince} weeks since your last light week.` : ""}` });
      else if (tired) say("Recovery", "warn", "Sleep or energy has been low for two weeks. The generator already trims sets on days you mark yourself as tired; protecting sleep will do more than any programme change.");
    }
    // running
    const rs = runs(days, weekStart, upto), km = rs.reduce((a, r) => a + (+r.km || 0), 0), prevKm = runs(days, add(weekStart, -7), add(weekStart, -1)).reduce((a, r) => a + (+r.km || 0), 0);
    if (rs.length || prevKm) {
      const legClash = rs.filter(r => { const prev = (days[add(r.date, -1)] || {}).log || {}; let legSets = 0; for (const [id, rows] of Object.entries(prev)) { const x = window.Coach && window.Coach.pool(o.userEx || {}).get(id); if (x && x.pm.some(m => ["quads", "hams", "glutes"].includes(m))) legSets += (rows || []).filter(z => z && z.done).length; } return legSets >= 6 && /tempo|interval|long|hard/i.test(r.type || ""); });
      say("Running", km > prevKm * 1.3 && prevKm > 0 ? "warn" : "good", `${rs.length} run${rs.length === 1 ? "" : "s"}, ${r1(km)} km${prevKm ? ` (last week ${r1(prevKm)} km)` : ""}.` + (km > prevKm * 1.3 && prevKm > 0 ? " That's a big jump; build mileage by about 10% a week." : "") +
        (legClash.length ? " A hard run came the day after heavy legs; put easy runs there instead, and keep hard runs at least a day away from leg sessions." : ""));
    }
    return { weekStart, weekEnd, partialWeek, items, rate: R, phase };
  }
  // when you'd reach the goal at the current trend rate
  function eta(log, goal, today) {
    const R = rate(log, today, 21), tr = trend(log), now = tr.length ? tr[tr.length - 1].trend : null;
    if (!(goal && goal.weight > 0) || now == null) return null;
    const left = goal.weight - now;
    if (Math.abs(left) < 0.3) return { now, left, done: true };
    if (!R.ok || Math.sign(R.perWeek) !== Math.sign(left) || Math.abs(R.perWeek) < 0.02) return { now, left, weeks: null };
    const weeks = left / R.perWeek; return { now, left, weeks, date: add(today, Math.round(weeks * 7)) };
  }
  return { PHASES, KCAL_PER_KG, bodyLog, trend, rate, rfm, mifflin, intake, dayIntake, maintenance, sessionDays, runs, bestE1rmByWeek, topLifts, checkins, review, eta, add, monday, diff, lastOf };
})();
