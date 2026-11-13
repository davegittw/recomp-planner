// Coaching engine for the workout generator. Runs entirely on the phone: no AI service, no network.
// It reads a plain-English request, looks at what you've logged (recent muscle volume, recovery, past
// performance) and builds a session from the exercise library, with weights from your own history.
window.Coach = (function () {
  "use strict";

  /* ---------- muscles ---------- */
  const M = {
    chest: { n: "Chest", rec: 72, wk: [10, 20] }, frontdelt: { n: "Front delts", rec: 48, wk: [6, 14] },
    sidedelt: { n: "Side delts", rec: 48, wk: [8, 20] }, reardelt: { n: "Rear delts", rec: 48, wk: [6, 16] },
    triceps: { n: "Triceps", rec: 48, wk: [8, 16] }, lats: { n: "Lats", rec: 72, wk: [10, 20] },
    upperback: { n: "Upper back", rec: 72, wk: [10, 20] }, traps: { n: "Traps", rec: 48, wk: [4, 12] },
    biceps: { n: "Biceps", rec: 48, wk: [8, 16] }, forearms: { n: "Forearms", rec: 36, wk: [2, 10] },
    abs: { n: "Abs", rec: 36, wk: [6, 16] }, obliques: { n: "Obliques", rec: 36, wk: [4, 12] },
    lowback: { n: "Lower back", rec: 72, wk: [3, 10] }, glutes: { n: "Glutes", rec: 72, wk: [8, 18] },
    quads: { n: "Quads", rec: 72, wk: [10, 18] }, hams: { n: "Hamstrings", rec: 72, wk: [8, 16] },
    adductors: { n: "Adductors", rec: 60, wk: [2, 10] }, calves: { n: "Calves", rec: 48, wk: [6, 16] },
  };
  const ALL = Object.keys(M);
  const nameOf = m => (M[m] || {}).n || m;
  const listNames = ms => { const n = ms.map(nameOf); return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1]; };

  // Words people use → muscles. Longer phrases are checked first.
  const SYN = [
    ["upper body", ["chest", "lats", "upperback", "frontdelt", "sidedelt", "biceps", "triceps"]],
    ["lower body", ["quads", "glutes", "hams", "calves"]],
    ["full body", ["quads", "glutes", "hams", "chest", "lats", "upperback", "frontdelt"]], ["whole body", ["quads", "glutes", "hams", "chest", "lats", "upperback", "frontdelt"]],
    ["posterior chain", ["glutes", "hams", "lowback"]], ["lower back", ["lowback"]], ["low back", ["lowback"]], ["erector", ["lowback"]],
    ["upper back", ["upperback", "traps", "reardelt"]], ["mid back", ["upperback"]], ["middle back", ["upperback"]], ["rhomboid", ["upperback"]],
    ["rear delt", ["reardelt"]], ["side delt", ["sidedelt"]], ["lateral delt", ["sidedelt"]], ["front delt", ["frontdelt"]],
    ["inner thigh", ["adductors"]], ["back of legs", ["hams"]], ["back of the legs", ["hams"]], ["six pack", ["abs"]],
    ["chest", ["chest"]], ["pec", ["chest"]], ["shoulder", ["frontdelt", "sidedelt", "reardelt"]], ["delt", ["frontdelt", "sidedelt", "reardelt"]],
    ["tricep", ["triceps"]], ["tris", ["triceps"]], ["bicep", ["biceps"]], ["bis", ["biceps"]], ["arms", ["biceps", "triceps"]], ["arm", ["biceps", "triceps"]],
    ["forearm", ["forearms"]], ["grip", ["forearms"]], ["lats", ["lats"]], ["lat", ["lats"]], ["wings", ["lats"]], ["back", ["lats", "upperback"]],
    ["traps", ["traps"]], ["trap", ["traps"]], ["abs", ["abs"]], ["core", ["abs", "obliques"]], ["stomach", ["abs", "obliques"]], ["belly", ["abs", "obliques"]],
    ["oblique", ["obliques"]], ["glute", ["glutes"]], ["bum", ["glutes"]], ["butt", ["glutes"]], ["hip", ["glutes"]],
    ["quad", ["quads"]], ["thigh", ["quads", "hams"]], ["hamstring", ["hams"]], ["hammy", ["hams"]], ["hams", ["hams"]],
    ["calf", ["calves"]], ["calves", ["calves"]], ["adductor", ["adductors"]], ["groin", ["adductors"]],
    ["legs", ["quads", "glutes", "hams", "calves"]], ["leg", ["quads", "glutes", "hams", "calves"]],
    ["push", ["chest", "frontdelt", "sidedelt", "triceps"]], ["pull", ["lats", "upperback", "reardelt", "biceps"]],
  ];
  // Named lifts people ask to improve
  const LIFTS = [
    ["bench press", "x-bench"], ["bench", "x-bench"], ["incline", "x-inc-bb"], ["overhead press", "x-ohp"], ["ohp", "x-ohp"], ["military press", "x-ohp"], ["shoulder press", "x-ohp"],
    ["front squat", "x-front-sq"], ["squat", "x-squat"], ["sumo", "x-sumo"], ["romanian", "x-rdl"], ["rdl", "x-rdl"], ["deadlift", "x-deadlift"],
    ["pull-up", "x-pullup"], ["pull up", "x-pullup"], ["pullup", "x-pullup"], ["chin-up", "x-chinup"], ["chin up", "x-chinup"], ["chinup", "x-chinup"],
    ["barbell row", "x-bbrow"], ["hip thrust", "x-hipthrust"], ["push-up", "x-pushup"], ["push up", "x-pushup"], ["pushup", "x-pushup"],
  ];
  // Muscles that support each main lift, for "improve my X" sessions
  const LIFT_HELPERS = {
    "x-bench": ["chest", "triceps", "frontdelt", "upperback"], "x-inc-bb": ["chest", "frontdelt", "triceps"], "x-ohp": ["frontdelt", "sidedelt", "triceps", "upperback"],
    "x-squat": ["quads", "glutes", "adductors", "abs"], "x-front-sq": ["quads", "glutes", "upperback"], "x-deadlift": ["glutes", "hams", "lowback", "upperback"],
    "x-sumo": ["glutes", "adductors", "hams"], "x-rdl": ["hams", "glutes", "lowback"], "x-pullup": ["lats", "biceps", "upperback"], "x-chinup": ["lats", "biceps"],
    "x-bbrow": ["upperback", "lats", "reardelt"], "x-hipthrust": ["glutes", "hams"], "x-pushup": ["chest", "triceps", "abs"],
  };

  /* ---------- request parsing ---------- */
  function musclesIn(text) {
    let t = " " + text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ") + " ", out = [];
    for (const [w, ms] of SYN) {
      const re = new RegExp("\\b" + w.replace(/ /g, "\\s+") + "(s|es)?\\b", "g");
      if (re.test(t)) { ms.forEach(m => { if (!out.includes(m)) out.push(m); }); t = t.replace(re, " "); }
    }
    return out;
  }
  function parse(text, opts) {
    opts = opts || {};
    const raw = String(text || "").trim(), t = raw.toLowerCase();
    const r = { text: raw, muscles: [], minutes: null, goal: "build", sore: [], pain: [], painText: null, focus: null, only: null, exclude: [], strengthenLowBack: false, auto: false, notes: [] };
    // time
    let m;
    if ((m = t.match(/(\d{2,3})\s*-?\s*(?:min|mins|minute|minutes|m)\b/))) r.minutes = +m[1];
    else if (/\b(an?|one)\s+hour\b|\b1\s*(?:h|hr|hour)\b|\b60\b/.test(t)) r.minutes = 60;
    else if (/half\s+an?\s+hour|\b30\b/.test(t)) r.minutes = 30;
    else if (/\b(quick|short|fast|express)\b/.test(t)) r.minutes = 30;
    else if (/\b(long|big)\s+(session|workout)\b/.test(t)) r.minutes = 60;
    if (r.minutes) r.minutes = Math.max(15, Math.min(90, r.minutes));
    // goal
    if (/\b(strength|stronger|strong|heavy|1rm|one rep max|max|pb|pr|personal best)\b/.test(t) || /\bimprove (my )?\w/.test(t)) r.goal = "strength";
    if (/\b(size|hypertrophy|bigger|grow|growth|pump|build muscle|mass|bulk)\b/.test(t)) r.goal = "build";
    if (/\b(endurance|conditioning|circuit|hiit|sweat|cardio|fat loss|burn|metcon|finisher)\b/.test(t)) r.goal = "condition";
    if (/\b(light|easy|recovery|deload|gentle|tired|knackered|exhausted|low energy)\b/.test(t)) r.goal = "light";
    // named lift
    for (const [w, id] of LIFTS) if (t.includes(w)) { r.focus = id; break; }
    if (r.focus && /\b(improve|better|increase|boost|work on|get my)\b/.test(t)) r.goal = r.goal === "light" ? "light" : "strength";
    // equipment limits
    const EQ = [["barbell", "Barbell"], ["dumbbell", "Dumbbells"], ["cable", "Cables"], ["landmine", "Landmine"], ["band", "Bands"], ["bench", "Bench"], ["pull-up bar", "Pull-up bar"], ["bodyweight", "Bodyweight"], ["body weight", "Bodyweight"]];
    for (const [w, e] of EQ) {
      if (new RegExp("\\b(no|without|not using|avoid)\\s+(the\\s+|a\\s+)?" + w).test(t)) r.exclude.push(e);
      if (new RegExp("\\b(only|just)\\s+(the\\s+)?" + w + "s?\\b|\\b" + w + "s?\\s+only\\b").test(t)) r.only = (r.only || []).concat([e]);
    }
    // soreness, pain
    const painRe = /\b(pain|painful|hurts?|hurting|injur\w*|tweak\w*|strain\w*|pulled|twinge|sciatica|slipped disc|disc)\b/;
    const soreRe = /\b(sore|doms|stiff|tight|aching|achy|tired|fatigued|battered|killing me)\b/;
    // Split into clauses so "sore hamstrings, train back" keeps the sore part separate from the target.
    const clauses = t.split(/[,.;]|\bbut\b|\bso\b|\band\s+(?=(want|would|can|need|let|give|train|do)\b)/).map(x => (x || "").trim()).filter(Boolean);
    let targetText = "";
    for (const c of clauses) {
      if (painRe.test(c)) { const ms = musclesIn(c); r.pain.push(...(ms.length ? ms : [])); r.painText = c; if (!ms.length && /\bback\b/.test(c)) r.pain.push("lowback"); continue; }
      if (soreRe.test(c)) { const ms = musclesIn(c); r.sore.push(...ms); if (/\b(suggest|something|what|give)\b/.test(c)) r.notes.push("suggest"); continue; }
      targetText += " " + c;
    }
    if (/\b(strengthen|strengthening|strong|stronger|build|bulletproof|work)\b[^.]*\blower back\b|\blower back\b[^.]*\b(strength|strengthen|stronger)\b/.test(t) && !r.pain.includes("lowback")) r.strengthenLowBack = true;
    r.muscles = musclesIn(targetText).filter(m => !r.sore.includes(m) && !r.pain.includes(m));
    if (r.focus && LIFT_HELPERS[r.focus]) LIFT_HELPERS[r.focus].forEach(m => { if (!r.muscles.includes(m) && !r.sore.includes(m) && !r.pain.includes(m)) r.muscles.push(m); });
    if (opts.muscles && opts.muscles.length) opts.muscles.forEach(m => { if (!r.muscles.includes(m)) r.muscles.push(m); });
    if (!r.muscles.length) r.auto = true;
    r.sore = [...new Set(r.sore)]; r.pain = [...new Set(r.pain)];
    return r;
  }

  /* ---------- exercises ---------- */
  function lib() { return window.EX_LIBRARY || []; }
  function metaFor(id, ex) {
    const meta = (window.EX_META || {})[id];
    if (meta) return { pm: meta[0], sm: meta[1], kind: meta[2], load: meta[3], back: meta[4] };
    // your own exercises: work the muscles out from their muscle names
    const ms = musclesIn(((ex && ex.muscles) || []).join(" ") + " " + ((ex && ex.name) || ""));
    const eq = (ex && ex.equipment) || [];
    const load = eq.includes("Barbell") ? "bb" : eq.includes("Dumbbells") ? "db" : eq.includes("Cables") ? "cb" : eq.includes("Landmine") ? "lm" : eq.includes("Bands") ? "band" : "bw";
    return { pm: ms.slice(0, 2), sm: ms.slice(2), kind: ms.length > 1 ? "c" : "i", load, back: 0 };
  }
  function pool(userEx) {
    const out = new Map();
    for (const x of lib()) out.set(x.id, { id: x.id, name: x.n, group: x.g, equip: x.e, sets: x.s, reps: x.r, rest: x.rt, cue: x.c, ...metaFor(x.id) });
    for (const e of Object.values(userEx || {})) if (!out.has(e.id)) {
      const m = metaFor(e.id, e); if (!m.pm.length) continue;
      out.set(e.id, { id: e.id, name: e.name, group: "Your exercises", equip: e.equipment || [], sets: e.sets, reps: e.reps, rest: e.rest, cue: e.notes || "", own: true, ...m });
    }
    return out;
  }

  /* ---------- history ---------- */
  const dayMs = 86400000;
  const pd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
  const e1rm = (w, r, rir) => { w = +w || 0; r = +r || 0; if (!w || !r) return 0; const reps = r + (+rir >= 0 && rir !== "" && rir != null ? +rir : 0); return reps <= 1 ? w : w * (1 + reps / 30); };
  function history(days, exPool, today) {
    const H = { ex: {}, muscle: {}, sessions: [] }, t0 = pd(today);
    for (const m of ALL) H.muscle[m] = { week: 0, last: null, lastSets: 0, byDate: {} };
    const dates = Object.keys(days || {}).filter(d => d <= today).sort();
    for (const date of dates) {
      const log = (days[date] && days[date].log) || {}, sessionEx = [];
      for (const [exId, rows] of Object.entries(log)) {
        const done = (rows || []).filter(r => r && r.done && (+r.r > 0 || r.r === "" || r.r == null));
        if (!done.length) continue;
        const ex = exPool.get(exId); sessionEx.push(exId);
        const sets = done.map(r => ({ w: +r.w || 0, r: parseInt(r.r) || 0, rir: r.rir === "" || r.rir == null ? null : +r.rir }));
        (H.ex[exId] = H.ex[exId] || []).push({ date, sets });
        if (!ex) continue;
        const ageDays = (t0 - pd(date)) / dayMs;
        for (const [list, wgt] of [[ex.pm, 1], [ex.sm, 0.5]]) for (const m of list) {
          const mm = H.muscle[m]; if (!mm) continue;
          const v = done.length * wgt;
          if (ageDays < 7) mm.week += v;
          mm.byDate[date] = (mm.byDate[date] || 0) + v;
        }
      }
      if (sessionEx.length) H.sessions.push({ date, ex: sessionEx });
    }
    for (const m of ALL) { const ds = Object.keys(H.muscle[m].byDate).sort(); const last = ds.filter(d => H.muscle[m].byDate[d] >= 2).pop() || ds.pop(); if (last) { H.muscle[m].last = last; H.muscle[m].lastSets = H.muscle[m].byDate[last]; } }
    return H;
  }
  // 0 = just trained hard, 1 = fully recovered
  function recovery(H, m, today, sore) {
    const mm = H.muscle[m]; if (!mm || !mm.last) return sore && sore.includes(m) ? 0.4 : 1;
    const hours = (pd(today) - pd(mm.last)) / 3600000 + 12; // assume sessions are ~12h before "now" on average
    const need = M[m].rec * (0.6 + 0.4 * Math.min(mm.lastSets / 8, 1.5));
    let r = Math.max(0, Math.min(1, hours / need));
    if (sore && sore.includes(m)) r = Math.min(r, 0.4);
    return r;
  }
  function fmtD(s) { const d = new Date(pd(s)); return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] + " " + d.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]; }
  function daysAgo(today, date) { const d = Math.round((pd(today) - pd(date)) / dayMs); return d === 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; }
  function bestE1rm(sessions) { let b = 0; for (const s of sessions || []) for (const x of s.sets) b = Math.max(b, e1rm(x.w, x.r, x.rir)); return b; }
  function prs(H, exId) {
    const ss = H.ex[exId] || []; let bestW = 0, bestE = 0, bestReps = 0;
    for (const s of ss) for (const x of s.sets) { bestW = Math.max(bestW, x.w); bestE = Math.max(bestE, e1rm(x.w, x.r, x.rir)); if (!x.w) bestReps = Math.max(bestReps, x.r); }
    return { bestW, bestE: Math.round(bestE * 10) / 10, bestReps, sessions: ss.length };
  }

  /* ---------- prescription ---------- */
  function rangeOf(s) { const m = String(s || "").match(/(\d+)\s*[-–]\s*(\d+)/); if (m) return [+m[1], +m[2]]; const n = parseInt(s); return n ? [n, n] : [8, 12]; }
  function scheme(ex, goal, slot, lastRange) {
    const timed = /s$|m$|steps/.test(String(ex.reps || "")) || ["x-plank", "x-side-plank", "x-hollow", "x-copenhagen", "x-farmer", "x-suitcase"].includes(ex.id);
    if (timed) return { sets: 3, reps: ex.reps, rir: null, rest: Math.min(ex.rest || 60, 75), timed: true };
    const big = ex.kind === "c";
    if (goal === "strength" && big && slot === 0) return { sets: 4, reps: lastRange === "4-6" ? "3-5" : "4-6", rir: 2, rest: 180 };
    if (goal === "strength" && big) return { sets: 3, reps: "6-8", rir: 2, rest: 150 };
    if (goal === "condition") return { sets: 3, reps: big ? "10-12" : "12-15", rir: 2, rest: big ? 60 : 45 };
    if (goal === "light") return { sets: 2, reps: big ? "8-10" : "12-15", rir: 3, rest: big ? 90 : 60 };
    if (big && slot <= 1) return { sets: 3, reps: lastRange === "6-8" ? "8-10" : lastRange === "8-10" ? "6-8" : (ex.load === "bb" ? "6-8" : "8-10"), rir: 2, rest: ex.load === "bb" ? 150 : 120 };
    if (big) return { sets: 3, reps: lastRange === "8-12" ? "10-12" : "8-12", rir: 1, rest: 105 };
    return { sets: 3, reps: lastRange === "10-15" ? "12-20" : "10-15", rir: 1, rest: 60 };
  }
  function step(load, P) { return load === "bb" ? P.bbStep || 2.5 : load === "db" || load === "db1" ? P.dbStep || 2 : load === "lm" ? 2.5 : load === "cb" ? P.cbStep || 2.5 : 0; }
  function cap(load, P) { return load === "bb" ? P.bbMax || 90 : load === "db" || load === "db1" ? P.dbMax || 25 : load === "lm" ? P.lmMax || 60 : load === "cb" ? P.cbMax || 100 : 0; }
  const roundTo = (w, s) => s ? Math.round(w / s) * s : Math.round(w);
  function loadPlan(ex, H, sch, P) {
    const ss = H.ex[ex.id] || [], last = ss[ss.length - 1], out = { weight: null, aim: null, last: null, note: null, progress: null };
    if (!last) {
      if (sch.rir == null) return out;
      out.note = (ex.load === "bw" || ex.load === "band") ? `First time: aim for ${sch.reps} reps, stopping with about ${sch.rir} left in the tank.${ex.load === "band" && !/dislocate|pull-apart/.test(ex.id + ex.name) ? " Pick a band that makes that hard." : ""}`
        : `First time: pick a weight you could lift about ${sch.rir + rangeOf(sch.reps)[1]} times, so each set ends with ${sch.rir} rep${sch.rir === 1 ? "" : "s"} in reserve.`;
      return out; }
    const sets = last.sets, top = Math.max(...sets.map(x => x.w)), working = sets.filter(x => x.w === top);
    out.last = { date: last.date, text: sets.map(x => (x.w ? `${+x.w}×` : "") + x.r).join(", ") + (sets.some(x => x.rir != null) ? ` (RIR ${sets.filter(x => x.rir != null).map(x => x.rir).join(",")})` : "") };
    const [lo, hi] = rangeOf(sch.reps), st = step(ex.load, P), mx = cap(ex.load, P);
    if (ex.load === "bw" || ex.load === "band" || !top) {
      const reps = Math.max(...sets.map(x => x.r)); out.aim = `Beat ${reps} reps on your best set`; out.progress = "reps"; return out;
    }
    const lastRange = last.range || null, avgRir = (() => { const v = working.filter(x => x.rir != null).map(x => x.rir); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; })();
    const allTop = working.every(x => x.r >= hi), allIn = working.every(x => x.r >= lo), struggled = avgRir != null && avgRir < 1;
    // Rep range changed since last time (or no clear range): convert through estimated 1RM
    const lastReps = working.reduce((a, x) => a + x.r, 0) / working.length;
    if (lastReps < lo - 1 || lastReps > hi + 1) {
      const e = bestE1rm([last]); const target = e / (1 + (Math.round((lo + hi) / 2) + (sch.rir || 1)) / 30);
      out.weight = Math.min(mx, Math.max(st || 1, roundTo(target, st))); out.aim = `${sch.sets} × ${sch.reps} at about ${out.weight} kg (worked out from your last session's ${Math.round(e)} kg estimated max)`; out.progress = "convert";
    } else if (allTop && !struggled) {
      const nw = top + st;
      if (nw > mx) { out.weight = top; out.aim = `You're at the heaviest ${ex.load === "bb" ? "barbell load" : "dumbbells"} you have (${mx} kg). Aim for ${hi + 2} reps or slow 3-second lowering instead.`; out.progress = "capped"; }
      else { out.weight = nw; out.aim = `Up to ${nw} kg: you hit ${hi} reps on every set last time.`; out.progress = "up"; }
    } else if (allIn && !struggled) {
      out.weight = top; const tgt = sets.filter(x => x.w === top).map(x => Math.min(hi, x.r + 1)); out.aim = `Same ${top} kg, aim for ${tgt.join(", ")} reps (one more than last time).`; out.progress = "reps";
    } else {
      out.weight = struggled && !allIn ? Math.max(st, roundTo(top * 0.95, st)) : top; out.aim = out.weight < top ? `Drop to ${out.weight} kg and own every rep; last time was a grind.` : `Stay at ${top} kg and get every set into ${lo}–${hi} reps.`; out.progress = "hold";
    }
    return out;
  }

  /* ---------- generation ---------- */
  function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const has = (eq, avail) => eq.every(e => avail.includes(e));
  const DEFAULT_EQ = ["Barbell", "Squat rack", "Dumbbells", "Cables", "Landmine", "Pull-up bar", "Bench", "Bands", "Bodyweight"];

  function generate(input) {
    // input: { request (parsed), days, userEx, today, profile, checkin, seed, keep }
    const R = input.request, today = input.today, P = Object.assign({ dbMax: 25, bbMax: 90, dbStep: 2, bbStep: 2.5, equipment: DEFAULT_EQ, typicalMin: 45 }, input.profile || {});
    const exPool = pool(input.userEx), H = history(input.days, exPool, today), rand = rng(input.seed || today + R.text);
    const minutes = R.minutes || P.typicalMin || 45, reasons = [], warnings = [];
    const sore = [...(R.sore || []), ...((input.checkin && input.checkin.sore) || [])];
    let goal = R.goal;
    const lowEnergy = input.checkin && (input.checkin.energy === "low" || input.checkin.sleep === "poor");
    if (lowEnergy && goal !== "light") reasons.push("You logged low energy or poor sleep, so sets are trimmed a little and every set stops further from failure.");
    // safety: pain is not something to train through
    let safety = null;
    if (R.pain.length) {
      safety = `You mentioned pain${R.pain.length ? ` in your ${listNames(R.pain).toLowerCase()}` : ""}. I can't treat pain or injuries, and this session isn't a rehab plan. ` +
        (R.pain.includes("lowback") ? "If your lower back hurts, especially with pain down a leg, numbness or pain that's getting worse, get it checked by a GP or physio before loading it. " : "If it's sharp, getting worse or not settling within a few days, get it checked by a GP or physio. ") +
        "I've left out exercises that load that area, so you can still train the rest of you.";
    }
    // which muscles
    let targets = R.muscles.slice(), autoNote = null;
    if (R.strengthenLowBack) { ["lowback", "glutes", "abs"].forEach(m => { if (!targets.includes(m) && !R.pain.includes(m)) targets.push(m); });
      reasons.push("A strong lower back comes from the hinge muscles and the trunk working together, so this trains the spinal erectors with your glutes and abs. It's for building strength in a back that feels fine, not for treating pain."); }
    if (!targets.length) {
      // Pick the most recovered, least-trained day type
      const days = [["Push", ["chest", "frontdelt", "sidedelt", "triceps"]], ["Pull", ["lats", "upperback", "reardelt", "biceps"]], ["Legs", ["quads", "glutes", "hams", "calves"]], ["Upper body", ["chest", "lats", "upperback", "frontdelt", "sidedelt", "biceps", "triceps"]]];
      const scored = days.map(([n, ms]) => { const ok = ms.filter(m => !R.pain.includes(m) && !sore.includes(m)); const rec = ok.reduce((a, m) => a + recovery(H, m, today, sore), 0) / Math.max(1, ok.length); const vol = ok.reduce((a, m) => a + H.muscle[m].week / M[m].wk[0], 0) / Math.max(1, ok.length); return { n, ms: ok, s: rec * 2 - vol + rand() * 0.15 - (ok.length < ms.length ? 0.6 : 0) }; }).sort((a, b) => b.s - a.s);
      targets = scored[0].ms; autoNote = `${scored[0].n} day: ${listNames(targets)} are your most recovered and least trained muscles this week.`;
    }
    targets = targets.filter(m => !R.pain.includes(m));
    // recovery and weekly volume checks on the targets
    const recov = {}; targets.forEach(m => recov[m] = recovery(H, m, today, sore));
    const tired = targets.filter(m => recov[m] < 0.6 && H.muscle[m].last);
    if (tired.length) warnings.push({ kind: "recovery", text: `${listNames(tired)} ${tired.length > 1 ? "were" : "was"} trained ${daysAgo(today, H.muscle[tired[0]].last)} (${Math.round(H.muscle[tired[0]].lastSets)} sets) and ${tired.length > 1 ? "are" : "is"} probably still recovering. Training ${tired.length > 1 ? "them" : "it"} hard again now adds fatigue more than growth. I've kept the session lighter on ${tired.length > 1 ? "those" : "that muscle"}; you can still go ahead, or ask for something else.`, muscles: tired });
    const maxed = targets.filter(m => H.muscle[m].week >= M[m].wk[1]);
    if (maxed.length) warnings.push({ kind: "volume", text: `${listNames(maxed)} ${maxed.length > 1 ? "are" : "is"} already at ${Math.round(H.muscle[maxed[0]].week)} sets this week, the top of the useful range. Extra sets today won't add much.`, muscles: maxed });
    if (sore.length) reasons.push(`Going easy on sore ${listNames(sore).toLowerCase()}: nothing that works ${sore.length > 1 ? "them" : "it"} directly.`);
    // per-muscle set budget for this session
    const setTime = (rest) => 0.75 + rest / 60; // minutes per set: ~45s work + rest
    const budget = minutes - 5; // 5 min warm-up
    const want = {}; targets.forEach(m => {
      let base = R.focus && LIFT_HELPERS[R.focus] && LIFT_HELPERS[R.focus][0] === m ? 8 : ["abs", "obliques", "forearms", "calves", "traps", "adductors"].includes(m) ? 3 : 6;
      if (recov[m] < 0.6) base *= 0.5; if (H.muscle[m].week >= M[m].wk[1]) base *= 0.5;
      base *= minutes / 45; if (goal === "light") base *= 0.6;
      want[m] = base;
    });
    const maxEx = Math.max(3, Math.round(minutes / 9) + 1);
    // candidates
    const avail = (R.only ? P.equipment.filter(e => R.only.includes(e) || ["Bench", "Squat rack", "Bodyweight"].includes(e)) : P.equipment).filter(e => !R.exclude.includes(e));
    const blocked = new Set([...R.pain]);
    const lastSessions = H.sessions.slice(-6).reverse();
    const recentUse = id => { const i = lastSessions.findIndex(s => s.ex.includes(id)); return i < 0 ? 99 : i; };
    // the last two sessions that trained these same muscles: rotate away from what was done there
    const sameMuscle = H.sessions.slice().reverse().filter(s => s.ex.some(id => { const e = exPool.get(id); return e && e.pm.some(m => targets.includes(m)); })).slice(0, 2);
    const prevSame = id => sameMuscle.findIndex(s => s.ex.includes(id));
    const count = id => (H.ex[id] || []).length;
    const fav = input.favourites || [];
    const cands = [...exPool.values()].filter(x => has(x.equip, avail) && x.pm.length &&
      !x.pm.some(m => blocked.has(m)) && !x.sm.some(m => blocked.has(m) && m !== "forearms") &&
      !(blocked.has("lowback") && x.back >= 1) && !x.pm.some(m => sore.includes(m) && !targets.includes(m)) &&
      (x.pm.some(m => targets.includes(m))));
    const chosen = [], keep = (input.keep || []).filter(id => exPool.has(id));
    let used = 0, slot = 0, backHeavy = 0;
    const lastRangeFor = id => { const s = (H.ex[id] || []).slice(-1)[0]; if (!s) return null; const reps = s.sets.map(x => x.r); const a = reps.reduce((p, c) => p + c, 0) / reps.length; return a <= 5 ? "3-5" : a <= 6.5 ? "4-6" : a <= 8 ? "6-8" : a <= 10 ? "8-10" : a <= 12 ? "8-12" : a <= 15 ? "10-15" : "12-20"; };
    function add(x) {
      const sch = scheme(x, goal, slot, lastRangeFor(x.id));
      if (lowEnergy && goal !== "light") { sch.sets = Math.max(2, sch.sets - 1); if (sch.rir != null) sch.rir += 1; }
      const tired = x.pm.filter(m => recov[m] != null && recov[m] < 0.6);
      if (tired.length && sch.sets > 2) sch.sets -= 1;
      const t = sch.sets * setTime(sch.rest);
      chosen.push({ x, sch, t }); used += t; slot++;
      for (const m of x.pm) if (want[m] != null) want[m] -= sch.sets;
      for (const m of x.sm) if (want[m] != null) want[m] -= sch.sets * 0.5;
      if (x.back >= 2) backHeavy++;
    }
    // main lift first if one was named
    if (R.focus && exPool.has(R.focus) && cands.find(c => c.id === R.focus)) add(exPool.get(R.focus));
    keep.forEach(id => { if (!chosen.find(c => c.x.id === id)) add(exPool.get(id)); });
    let guard = 0, topups = 0;
    while (used < budget - 3 && guard++ < 16 && chosen.length < maxEx) {
      let need = targets.filter(m => want[m] > 0.5);
      if (!need.length) {
        if (topups++ >= 2 || budget - used < 6) break;
        // time left: add a little more for the muscles that are furthest from their weekly minimum
        targets.slice().sort((a, b) => H.muscle[a].week / M[a].wk[0] - H.muscle[b].week / M[b].wk[0]).slice(0, 2).forEach(m => { if (recov[m] >= 0.6 && H.muscle[m].week < M[m].wk[1]) want[m] += 3; });
        need = targets.filter(m => want[m] > 0.5); if (!need.length) break;
      }
      let best = null, bestS = -1e9;
      for (const x of cands) {
        if (chosen.find(c => c.x.id === x.id)) continue;
        let s = 0;
        for (const m of x.pm) s += Math.max(0, want[m] != null ? want[m] : -1) * 1.0;
        for (const m of x.sm) if (want[m] > 0) s += want[m] * 0.25;
        if (x.pm.every(m => !(want[m] > 0.5))) s -= 6;
        if (x.pm.some(m => !targets.includes(m) && !["forearms"].includes(m))) s -= 1.5;
        if (used + 3 * setTime(x.kind === "c" ? 120 : 60) > budget + 4) s -= 4;
        if (slot <= 1 && x.kind === "c") s += 4;
        if (slot >= 2 && x.kind === "i") s += 1.2;
        if (goal === "strength" && x.kind === "c" && (x.load === "bb" || x.load === "db")) s += 1.5;
        if (goal === "condition" && (x.load === "bw" || x.load === "db" || x.load === "band")) s += 1;
        // learn preferences, but keep it varied
        s += Math.min(2, Math.log2(1 + count(x.id)) * 0.7) + (fav.includes(x.id) ? 2 : 0);
        const ru = recentUse(x.id), ps = prevSame(x.id);
        if (ps === 0) s -= x.id === R.focus ? 0 : (x.kind === "c" && slot <= 1 ? 2.2 : 3); else if (ps === 1) s -= 1;
        if (ru === 0) s -= 1; if (ru >= 99 && count(x.id) > 0) s += 0.3;
        // don't stack near-identical moves
        if (chosen.some(c => c.x.load === x.load && c.x.kind === x.kind && c.x.pm.some(m => x.pm.includes(m)))) s -= 2.5;
        if (x.back >= 2 && backHeavy >= 1) s -= 9;
        if (x.back >= 1 && recovery(H, "lowback", today, sore) < 0.5) s -= 3;
        if (x.sm.some(m => sore.includes(m))) s -= 1.5;
        if (x.own) s += 0.4;
        const dl = (input.dislikes || {})[x.id]; if (dl) s -= Math.min(4, dl * 1.2); // swapped out before

        if (R.strengthenLowBack && x.pm.includes("lowback")) s += 3;
        if (R.strengthenLowBack && (/thrust|bridge|plank|dead-bug|deadbug|wheel|rollout|pallof|carry|farmer|suitcase/.test(x.id + " " + x.name.toLowerCase()))) s += 2.5;
        s += rand() * 1.6;
        if (s > bestS) { bestS = s; best = x; }
      }
      if (!best || (bestS < 0 && chosen.length >= 3)) break;
      add(best);
    }
    // order: heavy compounds, other compounds, isolations, core last
    const rank = c => (c.x.id === R.focus ? -10 : 0) + (c.x.kind === "c" ? (c.x.load === "bb" ? 0 : 1) : 3) + (["abs", "obliques"].includes(c.x.pm[0]) ? 4 : 0) + (c.x.back >= 2 ? -0.5 : 0);
    chosen.sort((a, b) => rank(a) - rank(b));
    // re-prescribe with final positions and attach loads
    const items = chosen.map((c, i) => {
      const sch = scheme(c.x, goal, i, lastRangeFor(c.x.id));
      if (lowEnergy && goal !== "light") { sch.sets = Math.max(2, sch.sets - 1); if (sch.rir != null) sch.rir += 1; }
      if (c.x.pm.some(m => recov[m] != null && recov[m] < 0.6) && sch.sets > 2) sch.sets -= 1;
      const L = loadPlan(c.x, H, sch, P), pr = prs(H, c.x.id);
      const why = [];
      if (c.x.id === R.focus) why.push("Main lift for what you asked to improve.");
      const ru = recentUse(c.x.id);
      if (ru === 99 && count(c.x.id)) why.push("Not done recently, so it's back in for variety.");
      if (!count(c.x.id)) why.push("New for you; a fresh stimulus for " + listNames(c.x.pm).toLowerCase() + ".");
      return { exId: c.x.id, name: c.x.name, pm: c.x.pm, sm: c.x.sm, load: c.x.load, kind: c.x.kind, cue: c.x.cue, equip: c.x.equip,
        sets: sch.sets, reps: sch.reps, rir: sch.rir, rest: sch.rest, timed: !!sch.timed, weight: L.weight, aim: L.aim, last: L.last, note: L.note, progress: L.progress, pr, why: why.join(" ") };
    });
    const est = Math.round(5 + items.reduce((a, it) => a + it.sets * setTime(it.rest), 0));
    // explanation
    if (autoNote) reasons.unshift(autoNote);
    else reasons.unshift(`${listNames(targets.length > 4 ? summariseTargets(targets) : targets)}${R.focus ? `, built around your ${(exPool.get(R.focus) || {}).name || "main lift"}` : ""}: ${items.filter(i => i.kind === "c").length} compound and ${items.filter(i => i.kind === "i").length} isolation exercises in about ${est} minutes.`);
    const lastFor = targets.filter(m => H.muscle[m].last && recov[m] >= 0.6).map(m => `${nameOf(m)} ${daysAgo(today, H.muscle[m].last)}${recov[m] < 0.9 ? " (mostly recovered)" : ""}`);
    if (lastFor.length) reasons.push("Last trained: " + lastFor.join(", ") + ".");
    const ups = items.filter(i => i.progress === "up").map(i => i.name);
    if (ups.length) reasons.push(`Weight goes up on ${ups.join(", ")} because you hit the top of the rep range last time.`);
    if (sameMuscle.length) { const kept = items.filter(i => prevSame(i.exId) === 0); const changed = items.length - kept.length;
      reasons.push(kept.length ? `${changed} of ${items.length} exercises are different from your last ${listNames(targets.slice(0, 2)).toLowerCase()} session (${fmtD(sameMuscle[0].date)}); ${kept.map(i => i.name).join(", ")} stay${kept.length === 1 ? "s" : ""} so you can keep progressing ${kept.length === 1 ? "it" : "them"}.` : `All exercises are different from your last ${listNames(targets.slice(0, 2)).toLowerCase()} session (${fmtD(sameMuscle[0].date)}).`); }
    if (goal === "strength") reasons.push("Strength focus: heavier sets, longer rests, stopping 2 reps short of failure.");
    if (goal === "condition") reasons.push("Conditioning focus: shorter rests and higher reps.");
    if (goal === "light") reasons.push("Light session: fewer sets, well short of failure.");
    if (est > minutes + 7) warnings.push({ kind: "time", text: `This comes out at about ${est} minutes. Remove an exercise if you're short on time.` });
    const title = R.focus && exPool.get(R.focus) ? `${exPool.get(R.focus).name} focus` : autoNote ? autoNote.split(":")[0] : listNames(targets.length > 4 ? summariseTargets(targets) : targets);
    return { title, request: R.text, targets, minutes, est, goal, items, reasons, warnings, safety, created: Date.now(), seed: input.seed };
  }
  function summariseTargets(ts) {
    const g = [["Chest", ["chest"]], ["Back", ["lats", "upperback"]], ["Shoulders", ["frontdelt", "sidedelt", "reardelt"]], ["Arms", ["biceps", "triceps"]], ["Legs", ["quads", "hams", "glutes", "calves"]], ["Core", ["abs", "obliques"]]];
    const hit = g.filter(([, ms]) => ms.some(m => ts.includes(m))).map(([n]) => n);
    return hit.length ? hit : ts;
  }

  // Alternatives for swapping an exercise in a session
  function alternatives(exId, session, input) {
    const exPool = pool(input.userEx), H = history(input.days, exPool, input.today), x = exPool.get(exId), P = Object.assign({ equipment: DEFAULT_EQ }, input.profile || {});
    if (!x) return [];
    const inSession = new Set(session.items.map(i => i.exId));
    return [...exPool.values()].filter(y => y.id !== exId && !inSession.has(y.id) && has(y.equip, P.equipment) && y.pm.some(m => x.pm.includes(m)))
      .map(y => ({ y, s: y.pm.filter(m => x.pm.includes(m)).length * 3 + (y.kind === x.kind ? 2 : 0) + (y.load === x.load ? 0.5 : 1) + Math.min(2, (H.ex[y.id] || []).length * 0.3) }))
      .sort((a, b) => b.s - a.s).slice(0, 20).map(o => o.y);
  }
  function prescribeSwap(newId, oldItem, input) {
    const exPool = pool(input.userEx), H = history(input.days, exPool, input.today), x = exPool.get(newId), P = Object.assign({ dbMax: 25, bbMax: 90, dbStep: 2, bbStep: 2.5 }, input.profile || {});
    const sch = scheme(x, input.goal || "build", input.slot || 2, null);
    const L = loadPlan(x, H, sch, P);
    return { exId: x.id, name: x.name, pm: x.pm, sm: x.sm, load: x.load, kind: x.kind, cue: x.cue, equip: x.equip, sets: sch.sets, reps: sch.reps, rir: sch.rir, rest: sch.rest, timed: !!sch.timed, weight: L.weight, aim: L.aim, last: L.last, note: L.note, progress: L.progress, pr: prs(H, x.id), why: "Swapped in." };
  }
  // Weekly muscle summary for the body map
  function weekly(days, userEx, today) {
    const H = history(days, pool(userEx), today), out = {};
    for (const m of ALL) out[m] = { sets: Math.round(H.muscle[m].week * 2) / 2, range: M[m].wk, last: H.muscle[m].last, rec: recovery(H, m, today, []) };
    return out;
  }
  function personalBests(days, userEx, today) {
    const exPool = pool(userEx), H = history(days, exPool, today), out = {};
    for (const id of Object.keys(H.ex)) out[id] = prs(H, id);
    return out;
  }
  function suggestions(days, userEx, today, profile) {
    const H = history(days, pool(userEx), today), opts = [["Push", ["chest", "frontdelt", "sidedelt", "triceps"]], ["Pull", ["lats", "upperback", "reardelt", "biceps"]], ["Legs", ["quads", "glutes", "hams", "calves"]], ["Arms", ["biceps", "triceps"]], ["Core", ["abs", "obliques"]], ["Full body", ["quads", "glutes", "chest", "lats", "upperback"]]];
    return opts.map(([n, ms]) => ({ n, ms, rec: ms.reduce((a, m) => a + recovery(H, m, today, []), 0) / ms.length, vol: ms.reduce((a, m) => a + H.muscle[m].week / M[m].wk[0], 0) / ms.length }))
      .map(o => ({ ...o, s: o.rec * 2 - o.vol })).sort((a, b) => b.s - a.s);
  }
  return { M, ALL, nameOf, listNames, parse, generate, alternatives, prescribeSwap, weekly, personalBests, suggestions, e1rm, musclesIn, metaFor, pool };
})();
