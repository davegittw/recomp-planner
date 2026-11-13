(function(){
"use strict";
/* ---------- helpers ---------- */
const $ = (s,r=document)=>r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (s,n) => { const d=parse(s); d.setDate(d.getDate()+n); return iso(d); };
const wd = s => (parse(s).getDay()+6)%7; // Mon=0
const monday = s => addDays(s,-wd(s));
const TODAY = () => iso(new Date());
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = s => { const d=parse(s); return DOW[wd(s)]+" "+d.getDate()+" "+MON[d.getMonth()]; };
const rid = p => p+"-"+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const n0 = v => Math.round(Number(v)||0).toLocaleString("en-GB");
const n1 = v => { v=Number(v)||0; return Math.abs(v)<10 ? (Math.round(v*10)/10).toString() : Math.round(v).toString(); };
const num = v => { const x=parseFloat(String(v).replace(",",".")); return isFinite(x)?x:0; };
const clone = o => JSON.parse(JSON.stringify(o));
const secs = s => { s=Number(s)||0; return s>=60 ? Math.floor(s/60)+":"+pad(s%60) : s+"s"; };
const firstRep = r => { const m=String(r||"").match(/\d+/); return m?m[0]:""; };
const SLOTS = [["breakfast","Breakfast"],["lunch","Lunch"],["dinner","Dinner"],["snacks","Snacks"]];
const PATTERNS = ["push","pull","legs","core"];
const TAGS = ["push","pull","legs","upper","lower","full","other"];
const EQUIP = ["Barbell","Squat rack","Dumbbells","Cables","Landmine","Pull-up bar","Bench","Bands","Bodyweight"];
const UNITS = ["g","ml","piece","slice","scoop","tbsp","tsp","serving"];
const ICON = {
  today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="12" cy="14.5" r="1.6" fill="currentColor"/></svg>',
  week:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="1.2" fill="currentColor"/><circle cx="14" cy="12" r="1.2" fill="currentColor"/><circle cx="10" cy="18" r="1.2" fill="currentColor"/></svg>',
  train:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12h19"/><rect x="5" y="7" width="3" height="10" rx="1"/><rect x="16" y="7" width="3" height="10" rx="1"/><rect x="2.5" y="9" width="2.5" height="6" rx=".8"/><rect x="19" y="9" width="2.5" height="6" rx=".8"/></svg>',
  food:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="13" r="7.5"/><circle cx="12" cy="13" r="3.8"/><path d="M12 2.5v3"/></svg>',
  left:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>',
  right:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 15l6-6 6 6"/></svg>',
  shuffle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h3.5c2 0 3 1 4.2 2.8l1.6 2.4C14.5 14 15.5 17 17.5 17H20M4 17h3.5c1.4 0 2.3-.6 3.1-1.6M14.4 8.6c.8-1 1.7-1.6 3.1-1.6H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/></svg>',
  down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'
};

/* ---------- state ---------- */
const S = { ex:{}, foods:{}, wo:{}, days:{}, plans:{}, settings:{ targets:{kcal:2400,protein:160,carbs:260,fat:70}, split:{} } };
function lsGet(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
const ui = { tab: lsGet("rp-tab","today"), date: TODAY(), week: monday(TODAY()), trainSeg: lsGet("rp-seg","workouts"),
  exFilter:"all", exQ:"", foodQ:"", sheets:[], confirm:null };

/* ---------- persistence (local-first, see sync.js) ---------- */
function loadS(){
  S.ex=Sync.all("exercises"); S.foods=Sync.all("foods"); S.wo=Sync.all("workouts"); S.days=Sync.all("days"); S.plans=Sync.all("plans");
  const st=Sync.get("settings/main")||{};
  S.settings=Object.assign({}, st, { targets:Object.assign({kcal:2400,protein:160,carbs:260,fat:70}, st.targets||{}), split:Object.assign({}, st.split||{}),
    profile:Object.assign({dbMax:25,bbMax:90,dbStep:2,bbStep:2.5,typicalMin:45,equipment:EQUIP.slice(),heightCm:180.3,sex:"male",activity:1.55,wUnit:"st",weeklySessions:5,weeklyRuns:2}, st.profile||{}),
    favEx:st.favEx||[], goal:Object.assign({phase:"recomp"}, st.goal||{}), kcalHistory:st.kcalHistory||[], swapOut:st.swapOut||{} });
}
function bodyFor(path){
  if(path==="settings/main") return clone(S.settings);
  if(path.startsWith("plans/")) return S.plans[path.slice(6)];
  if(path.startsWith("days/")) return S.days[path.slice(5)];
  return null;
}
function queueSave(path){ const b=bodyFor(path); if(b) Sync.put(path, b); }
async function saveDoc(path, body){ Sync.put(path, body); return true; }
async function delDoc(path){ Sync.remove(path); return true; }
function statusText(s){
  if(!s.user) return "";
  if(s.error) return s.pending? `Not synced · ${s.pending} waiting` : "Sync problem";
  if(!s.online) return s.pending? `Offline · ${s.pending} waiting` : "Offline";
  if(s.busy||s.pending) return "Syncing…";
  if(s.lastSync){ const d=new Date(s.lastSync); return "Synced "+pad(d.getHours())+":"+pad(d.getMinutes()); }
  return "";
}
function status(){ const el=$("#savestate"); if(el) el.textContent=statusText(Sync.status()); }
let toastTimer;
function toast(t){ const el=$("#toast"); el.textContent=t; el.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true,3200); }

/* ---------- domain ---------- */
function day(date){ return S.days[date] || { date, meals:[], log:{} }; }
function dayMut(date){ if(!S.days[date]) S.days[date]={ date, meals:[], log:{} }; const d=S.days[date]; d.meals=d.meals||[]; d.log=d.log||{}; return d; }
function workoutFor(date){
  const d=S.days[date]; const w = d && d.workout!=null ? d.workout : (S.settings.split||{})[wd(date)];
  if(!w || w==="rest") return { id:"rest", w:null, fromSplit: !(d && d.workout!=null) };
  if(w==="gen") return { id:"gen", w: d&&d.gen ? { id:"gen", name:d.gen.title, tag:"gen", items:d.gen.items||[], gen:true } : null, fromSplit:false };
  return { id:w, w:S.wo[w]||null, fromSplit: !(d && d.workout!=null) };
}
function macrosOf(item){ const k = (Number(item.qty)||0)/(Number(item.size)||1);
  return { kcal:(item.kcal||0)*k, p:(item.p||0)*k, c:(item.c||0)*k, f:(item.f||0)*k }; }
function foodMacros(food, qty){ return macrosOf({ ...food, qty }); }
function totals(date){
  const t={ plan:{kcal:0,p:0,c:0,f:0}, eat:{kcal:0,p:0,c:0,f:0}, n:0, nEat:0 };
  for(const m of (day(date).meals||[])){ const x=macrosOf(m); t.n++;
    for(const k in x){ t.plan[k]+=x[k]; if(m.eaten) t.eat[k]+=x[k]; } if(m.eaten) t.nEat++; }
  return t;
}
function sessionProgress(date){
  const wf=workoutFor(date); if(!wf.w) return null;
  const log=day(date).log||{}; let done=0,total=0;
  for(const it of wf.w.items||[]){ const rows=log[it.exId]; const n=rows?rows.length:(Number(it.sets)||0); total+=n; if(rows) done+=rows.filter(r=>r.done).length; }
  return { done,total };
}
function lastPerf(exId, before){
  const dates=Object.keys(S.days).filter(d=>d<before).sort().reverse();
  for(const d of dates){ const rows=(S.days[d].log||{})[exId]; if(rows && rows.some(r=>r.done)) return { date:d, rows:rows.filter(r=>r.done) }; }
  return null;
}
function history(exId, n){
  const out=[]; const dates=Object.keys(S.days).sort().reverse();
  for(const d of dates){ const rows=(S.days[d].log||{})[exId]; if(rows && rows.some(r=>r.done)){ out.push({date:d, rows:rows.filter(r=>r.done)}); if(out.length>=n) break; } }
  return out;
}
const setsText = rows => rows.map(r=>(r.w!==""&&r.w!=null? n1(r.w)+"×":"")+(r.r||"–")).join(" · ");
const sortedBy = (obj, f=(x)=>x.name) => Object.values(obj).sort((a,b)=>String(f(a)).localeCompare(String(f(b))));
const tgtLine = it => { const e=S.ex[it.exId]||{}; return (it.sets||e.sets||"?")+" × "+(it.reps||e.reps||"?")+(Number(it.weight)?" · "+n1(it.weight)+" kg":"")+((it.rest||e.rest)?" · "+secs(it.rest||e.rest)+" rest":""); };

/* ---------- views ---------- */
const EMOJI=[[/chicken|turkey/,"🍗"],[/beef|mince|steak|lamb|pork/,"🥩"],[/salmon|cod|fish|tuna|prawn|shrimp|haddock/,"🐟"],[/egg/,"🥚"],[/yog|skyr|kefir/,"🥣"],[/whey|protein shake|shake|smoothie/,"🥤"],[/milk/,"🥛"],[/oat|porridge|granola|cereal/,"🥣"],[/rice/,"🍚"],[/pasta|spaghetti|noodle|lasagne|lasagna/,"🍝"],[/potato/,"🍠"],[/bread|toast|bagel|wrap|tortilla|pitta|pita/,"🍞"],[/banana/,"🍌"],[/blueberr|strawberr|raspberr|berr/,"🫐"],[/apple/,"🍎"],[/broccoli|greens|spinach|kale|veg/,"🥦"],[/salad/,"🥗"],[/peanut|nut butter|almond|cashew|nut/,"🥜"],[/olive oil|oil/,"🫒"],[/cheese|cottage|feta|halloumi/,"🧀"],[/coffee|latte|cappuccino|flat white|espresso/,"☕"],[/avocado/,"🥑"],[/curry|tikka|korma/,"🍛"],[/pizza/,"🍕"],[/burger/,"🍔"],[/soup|stew|chilli|chili|casserole/,"🍲"],[/croissant|pastry/,"🥐"],[/chocolate|brownie|cookie|cake/,"🍫"],[/taco|burrito|fajita/,"🌯"],[/bowl/,"🥗"]];
function foodEmoji(x){ if(x&&x.emoji) return x.emoji; const n=String(x&&x.name||"").toLowerCase(); for(const [re,e] of EMOJI) if(re.test(n)) return e; return "🍽️"; }
const PAT_COL={push:"var(--p)",pull:"var(--f)",legs:"#2E9C73",core:"var(--c)"};
const LONGDOW=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LONGMON=["January","February","March","April","May","June","July","August","September","October","November","December"];
function longDate(s){ const d=parse(s); return LONGDOW[wd(s)]+" "+d.getDate()+" "+LONGMON[d.getMonth()]; }
function dayTitle(s){ const t=TODAY(); if(s===t) return "Today"; if(s===addDays(t,-1)) return "Yesterday"; if(s===addDays(t,1)) return "Tomorrow"; return LONGDOW[wd(s)]; }
function head({eyebrow, title, left="", right=""}){
  return `<header class="top"><div class="top-row">${left}<span class="spacer"></span><span class="savedot" id="savestate"></span>${right}</div>
  <div class="eyebrow">${eyebrow}</div><h1>${title}</h1></header>`;
}
function fmac(x){ return `<div class="fmac"><span class="kc">${n0(x.kcal)}<small>cal</small></span><span class="p">P ${n0(x.p)}</span><span class="c">C ${n0(x.c)}</span><span class="f">F ${n0(x.f)}</span></div>`; }
function leftToPlan(T,t){
  const k=T.kcal-t.plan.kcal, p=T.protein-t.plan.p;
  const kt = k>=0 ? `${n0(k)} kcal left to plan` : `${n0(-k)} kcal over target`;
  const pt = p>0 ? `${n1(p)} g protein still to find` : `protein target covered`;
  return kt+", "+pt+".";
}
function vToday(){
  const date=ui.date, d=day(date), T=S.settings.targets, t=totals(date), isToday=date===TODAY();
  const wf=workoutFor(date), prog=sessionProgress(date);
  let h=head({ eyebrow:longDate(date), title:dayTitle(date),
    left:`<button class="iconbtn" data-act="day" data-n="-1" aria-label="Previous day">${ICON.left}</button>`,
    right:`${isToday?"":`<button class="btn ghost" data-act="goToday">Today</button>`}<button class="iconbtn" data-act="day" data-n="1" aria-label="Next day">${ICON.right}</button>` });
  h+=`<div class="stack">`;
  if(date>=addDays(TODAY(),-1)) h+=coachCard(date);
  h+=checkinStrip(date);
  if(!Object.keys(S.ex).length && !Object.keys(S.foods).length) h+=welcomeCard();
  const pe=Math.min(100,t.eat.kcal/T.kcal*100), pp=Math.min(100,t.plan.kcal/T.kcal*100);
  const chip=(k,lab,v,tgt)=>`<span class="mchip ${v>tgt*1.08?"over":""}"><i style="background:var(--${k})"></i><b>${n0(v)}</b><span style="opacity:.75">/${n0(tgt)}g</span> ${lab}</span>`;
  h+=`<section class="hero" aria-label="Nutrition">
    <div class="big"><b>${n0(t.eat.kcal)}</b><span>/ ${n0(T.kcal)} cal</span></div>
    <div class="line" role="img" aria-label="${n0(t.eat.kcal)} eaten, ${n0(t.plan.kcal)} planned of ${n0(T.kcal)} kcal"><i class="pl" style="width:${pp}%"></i><i class="eat" style="width:${pe}%"></i></div>
    <div class="chips">${chip("p","Protein",t.eat.p,T.protein)}${chip("c","Carbs",t.eat.c,T.carbs)}${chip("f","Fat",t.eat.f,T.fat)}</div>
    <div class="note ${t.n?"":"muted"}">${t.n? `${t.nEat<t.n?`${n0(t.plan.kcal)} planned in total. `:""}${leftToPlan(T,t)}` : `Nothing down for ${isToday?"today":"this day"} yet. Type what you ate below, or plan the day's meals.`}</div>
  </section>`;

  // meals
  h+=`<section class="sec" aria-label="Meals"><div class="sec-h"><h2>Meals</h2><span class="spacer"></span>${t.n?`<span class="pill">${t.nEat}/${t.n} eaten</span>`:""}</div>`;
  for(const [slot,label] of SLOTS){
    const items=(d.meals||[]).filter(m=>m.slot===slot);
    const kc=items.reduce((a,m)=>a+macrosOf(m).kcal,0);
    h+=`<div class="slot"><div class="slot-h"><span class="label">${label}${items.length?` · ${n0(kc)} cal`:""}</span><button class="btn ghost" data-act="addFood" data-slot="${slot}">+ Add</button></div>`;
    for(const m of items){ const x=macrosOf(m);
      h+=`<div class="frow ${m.eaten?"":"off"}"><div class="plate" aria-hidden="true">${foodEmoji(m)}</div>
        <button class="body" data-act="mealItem" data-id="${esc(m.id)}"><div class="fname">${esc(m.name)}</div><div class="fqty">${n1(m.qty)} ${esc(m.unit)}${m.eaten?"":" · planned"}</div>${fmac(x)}</button>
        <button class="check ${m.eaten?"on":""}" data-act="eat" data-id="${esc(m.id)}" aria-label="Mark ${esc(m.name)} eaten" aria-pressed="${!!m.eaten}">${ICON.check}</button></div>`;
    }
    h+=`</div>`;
  }
  { const pw=S.plans[monday(date)], tag=pw&&(monday(date)+":"+wd(date)+":"); if(pw && !(d.meals||[]).some(m=>m.plan&&m.plan.startsWith(tag)) && Object.keys(pw.days[wd(date)].slots).length)
    h+=`<button class="btn block" data-act="planLogFor" data-date="${date}">Add ${isToday?"today's":"this day's"} planned meals</button>`; }
  h+=`<div class="setbtns"><button class="btn" data-act="copyMeals">Copy another day</button><button class="btn" data-act="openIdeas">Meal ideas</button><button class="btn" data-act="newRecipe">Build a recipe</button>${t.n&&t.nEat<t.n?`<button class="btn" data-act="eatAll">Mark all eaten</button>`:""}</div></section>`;

  // training
  const woOpts = [`<option value="" ${d.workout==null?"selected":""}>Split: ${(()=>{const s=(S.settings.split||{})[wd(date)]; return s&&s!=="rest"&&S.wo[s]?esc(S.wo[s].name):"Rest";})()}</option>`,
    `<option value="rest" ${d.workout==="rest"?"selected":""}>Rest day</option>`].concat(d.gen?[`<option value="gen" ${d.workout==="gen"?"selected":""}>Generated: ${esc(d.gen.title)}</option>`]:[])
    .concat(sortedBy(S.wo).map(w=>`<option value="${esc(w.id)}" ${d.workout===w.id?"selected":""}>${esc(w.name)}</option>`)).join("");
  h+=`<section class="sec" aria-label="Training"><div class="sec-h"><h2>Training</h2>
    ${prog?`<span class="pill ${prog.done&&prog.done>=prog.total?"done":""}">${prog.done}/${prog.total} sets</span>`:""}
    <span class="spacer"></span><select id="wsel" data-in="setWorkout" aria-label="Workout for this day">${woOpts}</select></div>`;
  if(wf.id==="rest") h+=`<div class="empty">Rest day. Pick a workout above to train anyway.</div>`;
  else if(!wf.w) h+=`<div class="empty">That workout has been deleted. Choose another above.</div>`;
  else{
    if(wf.w.notes) h+=`<div class="small muted">${esc(wf.w.notes)}</div>`;
    if((wf.w.items||[]).length) h+=`<button class="btn primary block" data-act="liveOpen">${prog&&prog.done?"Continue in workout mode":"Start workout mode"}</button>`;
    for(const it of wf.w.items||[]){
      const e=exInfo(it.exId); const rows=(d.log||{})[it.exId]; const n=rows?rows.length:(Number(it.sets)||0);
      const last=lastPerf(it.exId,date);
      h+=`<div class="ex"><div class="ex-h"><div class="plate sm" style="color:${PAT_COL[(e||{}).pattern]||"var(--muted)"}" aria-hidden="true">${ICON.train}</div>
        <div style="min-width:0"><div class="fname">${esc(e?e.name:"Removed exercise")}</div><div class="tgt">${esc(tgtLine(it))}</div>
        ${last?`<div class="last">Last ${fmtDate(last.date)} · <span class="num">${esc(setsText(last.rows))}</span></div>`:""}</div></div>
      <div class="sets">`;
      for(let i=0;i<n;i++){ const r=rows&&rows[i]||{};
        h+=`<div class="setrow"><span class="n">${i+1}</span>
        <label class="unitwrap"><input id="w-${esc(it.exId)}-${i}" inputmode="decimal" autocomplete="off" placeholder="${Number(it.weight)?n1(it.weight):"–"}" value="${esc(r.w??"")}" data-in="setVal" data-ex="${esc(it.exId)}" data-i="${i}" data-k="w" aria-label="Set ${i+1} weight"><span>kg</span></label>
        <label class="unitwrap"><input id="r-${esc(it.exId)}-${i}" inputmode="numeric" autocomplete="off" placeholder="${esc(firstRep(it.reps)||"–")}" value="${esc(r.r??"")}" data-in="setVal" data-ex="${esc(it.exId)}" data-i="${i}" data-k="r" aria-label="Set ${i+1} reps"><span>reps</span></label>
        <button class="tick ${r.done?"on":""}" data-act="tick" data-ex="${esc(it.exId)}" data-i="${i}" aria-label="Mark set ${i+1} done" aria-pressed="${!!r.done}">${ICON.check}</button></div>`;
      }
      h+=`</div><div class="setbtns"><button class="btn ghost" data-act="addSet" data-ex="${esc(it.exId)}">+ Set</button>${n>0?`<button class="btn ghost" style="color:var(--muted)" data-act="rmSet" data-ex="${esc(it.exId)}">Remove last</button>`:""}</div></div>`;
    }
    if(!(wf.w.items||[]).length) h+=`<div class="empty">This workout has no exercises yet. Add some under Train.</div>`;
  }
  h+=`</section></div>`;
  return h;
}

function vWeek(){
  const start=ui.week, T=S.settings.targets, split=S.settings.split||{};
  const wkTitle = start===monday(TODAY())?"This week":start===addDays(monday(TODAY()),-7)?"Last week":start===addDays(monday(TODAY()),7)?"Next week":"Week of "+fmtDate(start).slice(4);
  let h=head({ eyebrow:fmtDate(start).slice(4)+" – "+fmtDate(addDays(start,6)).slice(4), title:wkTitle,
    left:`<button class="iconbtn" data-act="week" data-n="-7" aria-label="Previous week">${ICON.left}</button>`,
    right:`<button class="iconbtn" data-act="week" data-n="7" aria-label="Next week">${ICON.right}</button>` })+`<div class="stack">`;
  let sess=0, sessPlan=0, sumK=0, sumP=0, nd=0;
  let rows="";
  for(let i=0;i<7;i++){
    const date=addDays(start,i), wf=workoutFor(date), t=totals(date), prog=sessionProgress(date);
    if(wf.w){ sessPlan++; if(prog&&prog.done>0) sess++; }
    if(t.nEat){ sumK+=t.eat.kcal; sumP+=t.eat.p; nd++; }
    const tag = wf.w ? `<span class="pill ${esc(wf.w.tag||"")}">${esc(wf.w.name)}</span>` : `<span class="pill">Rest</span>`;
    rows+=`<button class="wk ${date===TODAY()?"today":""}" data-act="openDay" data-date="${date}">
      <span class="d"><b>${DOW[i]}</b><span>${parse(date).getDate()}</span></span>
      <span style="min-width:0"><span style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${tag}${prog&&prog.done?`<span class="small muted">${prog.done}/${prog.total} sets</span>`:""}</span>
        <div class="mini" aria-hidden="true"><i class="pl" style="width:${Math.min(100,t.plan.kcal/T.kcal*100)}%"></i><i style="width:${Math.min(100,t.eat.kcal/T.kcal*100)}%"></i></div></span>
      <span style="text-align:right;font-family:var(--display);font-variant-numeric:tabular-nums;line-height:1.25">
        <span style="font-size:17px">${t.n?n0(t.nEat?t.eat.kcal:t.plan.kcal):"–"}</span><span class="muted small"> kcal</span><br>
        <span class="small pc">${t.n?n1(t.nEat?t.eat.p:t.plan.p)+" g P":""}</span>${t.n&&!t.nEat?`<span class="small muted"> plan</span>`:""}</span></button>`;
  }
  h+=`<section class="card"><div class="stats">
    <div class="stat"><div class="label">Sessions</div><div class="v">${sess}<span class="muted" style="font-size:16px">/${sessPlan}</span></div></div>
    <div class="stat"><div class="label">Avg kcal</div><div class="v" style="${nd&&Math.abs(sumK/nd-T.kcal)>T.kcal*.08?"color:var(--warn)":""}">${nd?n0(sumK/nd):"–"}</div></div>
    <div class="stat"><div class="label">Avg protein</div><div class="v">${nd?n0(sumP/nd):"–"}<span class="muted" style="font-size:16px"> g</span></div></div></div>
    <div class="small muted">Averages use eaten meals only, across the ${nd||0} day${nd===1?"":"s"} with anything ticked off. Targets: ${n0(T.kcal)} kcal, ${n0(T.protein)} g protein.</div></section>`;
  h+=`<div class="list">${rows}</div>`;
  h+=`<section class="card"><div class="card-h"><h2>Weekly split</h2></div><div class="small muted">The default workout for each weekday. You can still change any single day from Today.</div>`;
  const opts = v => `<option value="rest" ${!v||v==="rest"?"selected":""}>Rest</option>`+sortedBy(S.wo).map(w=>`<option value="${esc(w.id)}" ${v===w.id?"selected":""}>${esc(w.name)}</option>`).join("");
  for(let i=0;i<7;i++) h+=`<label class="splitrow"><span class="label">${DOW[i]}</span><select id="split-${i}" data-in="split" data-i="${i}">${opts(split[i])}</select></label>`;
  h+=`</section></div>`;
  return h;
}

function vTrain(){
  let h=head({ eyebrow:"Workouts & exercises", title:"Train" })+`<div class="stack" style="gap:16px">
  <div class="top-row"><div class="seg" style="flex:1" role="tablist"><button class="${ui.trainSeg==="workouts"?"on":""}" data-act="seg" data-v="workouts">Workouts</button><button class="${ui.trainSeg==="exercises"?"on":""}" data-act="seg" data-v="exercises">Exercises</button><button class="${ui.trainSeg==="muscles"?"on":""}" data-act="seg" data-v="muscles">Muscles</button></div>
  ${ui.trainSeg==="muscles"?"":`<button class="btn primary" data-act="${ui.trainSeg==="workouts"?"newWorkout":"newEx"}">+ New</button>`}</div>`;
  if(ui.trainSeg==="muscles") return h+vMuscles()+`</div>`;
  if(ui.trainSeg==="workouts"){
    const ws=sortedBy(S.wo);
    if(!ws.length) h+=`<div class="card"><div class="empty">No workouts yet. Tap “New workout” and pick exercises from your list.</div></div>`;
    else{ h+=`<div class="list">`+ws.map(w=>`<button class="li" data-act="editWorkout" data-id="${esc(w.id)}"><span class="main"><div class="nm">${esc(w.name)}</div><div class="sub">${(w.items||[]).map(it=>esc((S.ex[it.exId]||{}).name||"?")).join(", ")||"No exercises"}</div></span><span class="pill ${esc(w.tag||"")}">${esc(w.tag||"")}</span></button>`).join("")+`</div>`; }
  } else {
    h+=`<input type="search" id="exq" placeholder="Search exercises" value="${esc(ui.exQ)}" data-in="exQ" autocomplete="off">
    <div class="chips">${["all",...PATTERNS].map(p=>`<button class="chip ${ui.exFilter===p?"on":""}" data-act="exFilter" data-v="${p}">${p==="all"?"All":p[0].toUpperCase()+p.slice(1)}</button>`).join("")}</div>`;
    const lib=window.EX_LIBRARY||[], added=lib.filter(x=>S.ex[x.id]).length;
    h+=`<button class="card libcta" data-act="openLib"><span class="plate sm" aria-hidden="true">${ICON.train}</span><span style="flex:1;min-width:0;text-align:left"><b style="font:500 18px var(--display)">Exercise library</b><div class="small muted">${lib.length} exercises for your rack, barbell, dumbbells, cables, landmine and pull-up bar${added?` · ${added} in your list`:""}</div></span>${ICON.right}</button>`;
    h+=exList(ui.exFilter, ui.exQ, "editEx");
  }
  return h+`</div>`;
}
function exList(filter, q, act){
  q=(q||"").toLowerCase();
  const xs=sortedBy(S.ex).filter(e=>(filter==="all"||e.pattern===filter)&&(!q||(e.name+" "+(e.muscles||[]).join(" ")+" "+(e.equipment||[]).join(" ")).toLowerCase().includes(q)));
  if(!Object.keys(S.ex).length) return `<div class="card"><div class="empty">No exercises yet. Add the first one with “New exercise”.</div></div>`;
  if(!xs.length) return `<div class="empty">No exercises match.</div>`;
  return `<div class="list">`+xs.map(e=>`<button class="li" data-act="${act}" data-id="${esc(e.id)}"><span class="main"><div class="nm">${esc(e.name)}</div><div class="sub">${esc((e.muscles||[]).join(", "))}${(e.equipment||[]).length?" · "+esc(e.equipment.join(", ")):""}</div></span><span class="pill ${esc(e.pattern)}">${esc(e.pattern||"")}</span></button>`).join("")+`</div>`;
}

/* ---------- exercise library ---------- */
const LIB_GROUPS=["Chest","Shoulders","Triceps","Back","Biceps & forearms","Quads","Glutes & hamstrings","Calves","Core","Full body","Mobility"];
const LIB_EQUIP=["Barbell","Dumbbells","Cables","Landmine","Pull-up bar","Bands","Bodyweight"];
function libFind(id){ return (window.EX_LIBRARY||[]).find(x=>x.id===id); }
function libToExercise(x){ return { id:x.id, name:x.n, pattern:x.p, muscles:x.m.slice(), equipment:x.e.slice(), sets:x.s, reps:x.r, rest:x.rt, notes:x.c, lib:true }; }
function libFilter(s, onlyNew){
  const q=(s.q||"").toLowerCase().trim();
  return (window.EX_LIBRARY||[]).filter(x=>(!onlyNew||!S.ex[x.id]) && (!s.group||s.group==="all"||x.g===s.group) && (!s.equip||s.equip==="all"||x.e.includes(s.equip))
    && (!s.noBench||!x.e.includes("Bench")) && (!s.pattern||s.pattern==="all"||x.p===s.pattern)
    && (!q||q.split(/\s+/).every(t=>(x.n+" "+x.m.join(" ")+" "+x.e.join(" ")+" "+x.g).toLowerCase().includes(t))));
}
function libRow(x, s, addAct){
  const have=!!S.ex[x.id], open=s.open===x.id;
  return `<div class="librow ${open?"open":""}"><button class="libmain" data-act="libToggle" data-id="${esc(x.id)}" aria-expanded="${open}">
      <div class="nm">${esc(x.n)}</div><div class="sub">${esc(x.m.join(", "))} · ${esc(x.e.join(", "))}</div>
      ${open?`<div class="libcue">${esc(x.c)}</div><div class="small muted num">${x.s} × ${esc(x.r)} · ${secs(x.rt)} rest</div>`:""}</button>
    ${have&&addAct==="libAdd"?`<span class="pill done" aria-label="In your list">${ICON.check}</span>`:`<button class="btn ${addAct==="libAdd"?"":"primary"} libadd" data-act="${addAct}" data-id="${esc(x.id)}">${addAct==="libAdd"?"Add":"Use"}</button>`}</div>`;
}
function renderLib(s){
  const xs=libFilter(s,false), fresh=xs.filter(x=>!S.ex[x.id]);
  let h=sheetHead("Exercise library")+`<div class="sbody">
    <input type="search" id="lib-q" placeholder="Search exercises or muscles" value="${esc(s.q)}" data-in="libQ" autocomplete="off">
    <div class="chips hscroll">${["all",...LIB_GROUPS].map(g=>`<button class="chip ${s.group===g?"on":""}" data-act="libGroup" data-v="${esc(g)}">${g==="all"?"All muscles":esc(g)}</button>`).join("")}</div>
    <div class="chips hscroll">${["all",...LIB_EQUIP].map(e=>`<button class="chip ${s.equip===e?"on":""}" data-act="libEquip" data-v="${esc(e)}">${e==="all"?"All kit":esc(e)}</button>`).join("")}
      <button class="chip ${s.noBench?"on":""}" data-act="libBench">No bench</button></div>
    <div class="top-row"><span class="small muted" style="flex:1">${xs.length} exercise${xs.length===1?"":"s"}${fresh.length&&fresh.length<xs.length?`, ${fresh.length} not in your list yet`:""}</span>
      ${fresh.length?`<button class="btn" data-act="libAddAll">${ui.confirm==="liball"?`Tap again to add ${fresh.length}`:`Add all ${fresh.length}`}</button>`:""}</div>`;
  if(!xs.length) h+=`<div class="empty">Nothing matches. Try another muscle group or clear the search.</div>`;
  for(const g of LIB_GROUPS){ const gx=xs.filter(x=>x.g===g); if(!gx.length) continue;
    h+=`<div class="label">${esc(g)}</div><div class="list">${gx.map(x=>libRow(x,s,"libAdd")).join("")}</div>`; }
  return h+`<div class="small muted">Added exercises go into your list, where you can change the name, sets, reps or rest.</div></div>`;
}

function vFood(){
  const T=S.settings.targets; const mk=T.protein*4+T.carbs*4+T.fat*9;
  let h=head({ eyebrow:ui.foodSeg==="library"?"Library & targets":ui.foodSeg==="shop"?"Shopping list":"Meal plan", title:"Food" })+`<div class="stack" style="gap:16px">`+foodSegs();
  if(ui.foodSeg==="plan") return h+vPlan()+`</div>`;
  if(ui.foodSeg==="shop") return h+vShop()+`</div>`;
  h+=`
  <button class="card libcta" data-act="openIdeas"><span class="plate sm" aria-hidden="true">🍱</span><span style="flex:1;min-width:0;text-align:left"><b style="font:500 18px var(--display)">Meal ideas</b><div class="small muted">${(window.MEAL_IDEAS||[]).length} high-protein meals for a lean bulk, worked out from the ingredient database</div></span>${ICON.right}</button>
  <div class="setbtns"><button class="btn primary" data-act="newRecipe">Build a recipe</button><button class="btn" data-act="newFood">+ New food</button></div>
  <section class="card"><div class="card-h"><h2>Daily targets</h2></div>
   <div class="grid4">
    <label class="field"><span class="label k">Kcal</span><input id="t-kcal" inputmode="numeric" value="${esc(T.kcal)}" data-in="target" data-k="kcal"></label>
    <label class="field"><span class="label pc">Protein g</span><input id="t-protein" inputmode="numeric" value="${esc(T.protein)}" data-in="target" data-k="protein"></label>
    <label class="field"><span class="label cc">Carbs g</span><input id="t-carbs" inputmode="numeric" value="${esc(T.carbs)}" data-in="target" data-k="carbs"></label>
    <label class="field"><span class="label fc">Fat g</span><input id="t-fat" inputmode="numeric" value="${esc(T.fat)}" data-in="target" data-k="fat"></label>
   </div>
   <div class="small ${Math.abs(mk-T.kcal)>T.kcal*.05?"":"muted"}" style="${Math.abs(mk-T.kcal)>T.kcal*.05?"color:var(--warn)":""}">Protein, carbs and fat add up to <span class="num" style="font-size:15px">${n0(mk)}</span> kcal (4/4/9 per gram)${Math.abs(mk-T.kcal)>T.kcal*.05?", which doesn't match the kcal target.":"."}</div>
  </section>
  <input type="search" id="foodq" placeholder="Search foods" value="${esc(ui.foodQ)}" data-in="foodQ" autocomplete="off">`;
  h+=foodList(ui.foodQ, "editFood", null);
  h+=accountCard();
  return h+`</div>`;
}
function foodList(q, act, sel){
  q=(q||"").toLowerCase();
  const fs=sortedBy(S.foods).filter(f=>!q||f.name.toLowerCase().includes(q));
  if(!Object.keys(S.foods).length) return `<div class="card"><div class="empty">No foods yet. Add the things you actually eat, with macros from the packet.</div></div>`;
  if(!fs.length) return `<div class="empty">No foods match “${esc(q)}”.</div>`;
  return `<div class="list">`+fs.map(f=>`<button class="li ${sel===f.id?"sel":""}" data-act="${act}" data-id="${esc(f.id)}"><span class="plate" aria-hidden="true">${foodEmoji(f)}</span><span class="main"><div class="nm">${esc(f.name)} ${f.starter?`<span class="pill starter">starter</span>`:""}${f.recipe?`<span class="pill starter" style="color:var(--accent)">recipe</span>`:""}</div><div class="sub">per ${n1(f.size)} ${esc(f.unit)} · <span class="pc">P ${n1(f.p)}</span> · <span class="cc">C ${n1(f.c)}</span> · <span class="fc">F ${n1(f.f)}</span></div></span><span class="right">${n0(f.kcal)}<span class="small muted" style="font-weight:500"> cal</span></span></button>`).join("")+`</div>`;
}

/* ---------- sheets ---------- */
const top = () => ui.sheets[ui.sheets.length-1];
function pushSheet(s){ ui.sheets.push(s); ui.confirm=null; render(); requestAnimationFrame(()=>{ const p=$("#panel"); if(p) p.scrollTop=0; }); }
function popSheet(){ ui.sheets.pop(); ui.confirm=null; render(); }
function sheetHead(title, right=""){ const back=ui.sheets.length>1;
  return `<div class="sh"><div class="grab" aria-hidden="true"></div><button class="iconbtn" data-act="closeSheet" aria-label="${back?"Back":"Close"}">${back?ICON.left:ICON.close}</button><h2>${title}</h2>${right}</div>`; }
function preview(m){ return `<div class="preview"><span class="k"><b>${n0(m.kcal)}</b> kcal</span><span class="pc"><b>${n1(m.p)}</b> g P</span><span class="cc"><b>${n1(m.c)}</b> g C</span><span class="fc"><b>${n1(m.f)}</b> g F</span></div>`; }
function delBtn(key, act){ return `<button class="btn danger" data-act="${act}">${ui.confirm===key?"Tap again to delete":"Delete"}</button>`; }

let sheetDepth=0, closingTimer=null;
function renderSheet(){
  const s=top(), el=$("#sheet"), p=$("#panel"), depth=ui.sheets.length, prev=sheetDepth;
  if(!ui.sheets.some(x=>x.type==="live")) keepAwake(false);
  p.classList.toggle("tall", !!s && (s.type==="live"||s.type==="gen"));
  sheetDepth=depth;
  if(!s){
    document.body.style.overflow="";
    if(el.hidden || prev===0){ el.hidden=true; p.innerHTML=""; return; }
    // slide the sheet away, then clear it
    el.classList.remove("opening"); el.classList.add("closing"); p.style.transform="";
    clearTimeout(closingTimer); closingTimer=setTimeout(()=>{ if(!ui.sheets.length){ el.hidden=true; p.innerHTML=""; } el.classList.remove("closing"); }, motionMs(240));
    return;
  }
  clearTimeout(closingTimer); el.classList.remove("closing");
  if(el.hidden || prev===0){ el.hidden=false; el.classList.remove("opening"); void el.offsetWidth; el.classList.add("opening"); }
  else if(depth!==prev){ p.classList.remove("push","pop"); void p.offsetWidth; p.classList.add(depth>prev?"push":"pop"); }
  document.body.style.overflow="hidden";
  let h="";
  if(s.type==="pick"){ h+=renderPick(s); }
  else if(s.type==="list"){ h+=renderList(s); }
  else if(s.type==="mealItem"){
    const d=day(s.date), m=(d.meals||[]).find(x=>x.id===s.id);
    if(!m){ ui.sheets.pop(); return renderSheet(); }
    h+=sheetHead(esc(m.name))+`<div class="sbody">
      <label class="field"><span class="label">Amount</span><span class="unitwrap"><input id="mi-qty" inputmode="decimal" value="${esc(m.qty)}" data-in="mealQty"><span>${esc(m.unit)}</span></span></label>
      <div id="mi-prev">${preview(macrosOf(m))}</div>
      <div class="field"><span class="label">Meal</span><div class="seg">${SLOTS.map(([k,l])=>`<button class="${m.slot===k?"on":""}" data-act="mealSlot" data-v="${k}">${l}</button>`).join("")}</div></div>
      <button class="btn ${m.eaten?"":"primary"}" data-act="eat" data-id="${esc(m.id)}">${m.eaten?"Mark as not eaten":"Mark as eaten"}</button>
      <div class="setbtns"><button class="btn danger" data-act="rmMeal">Remove from day</button><span class="spacer"></span><button class="btn primary" data-act="closeSheet">Done</button></div>
      <div class="small muted">Macros are fixed at the values the food had when you added it, so editing the food later won't change past days.</div></div>`;
  }
  else if(s.type==="copyMeals"){
    const dates=Object.keys(S.days).filter(x=>x!==s.date && (S.days[x].meals||[]).length).sort().reverse().slice(0,21);
    h+=sheetHead("Copy meals from")+`<div class="sbody"><div class="small muted">Adds that day's foods to ${fmtDate(s.date)} as planned, not eaten.</div>`;
    h+= dates.length? `<div class="list">`+dates.map(x=>{ const t=totals(x); return `<button class="li" data-act="doCopy" data-date="${x}"><span class="main"><div class="nm">${fmtDate(x)}</div><div class="sub">${t.n} items · ${n1(t.plan.p)} g protein</div></span><span class="right">${n0(t.plan.kcal)} <span class="small muted">kcal</span></span></button>`; }).join("")+`</div>` : `<div class="empty">No other days have meals yet.</div>`;
    h+=`</div>`;
  }
  else if(s.type==="food"){
    const d=s.draft;
    h+=sheetHead(s.id?"Edit food":"New food")+`<div class="sbody">
     <div class="grid2" style="grid-template-columns:64px 1fr"><label class="field"><span class="label">Icon</span><input id="fd-emoji" value="${esc(d.emoji||"")}" placeholder="${foodEmoji(d)}" data-in="draft" data-k="emoji" style="text-align:center;font-size:24px;padding:4px"></label>
     <label class="field"><span class="label">Name</span><input id="fd-name" value="${esc(d.name)}" data-in="draft" data-k="name" placeholder="e.g. Chicken breast, raw"></label></div>
     ${d.recipe?`<div class="banner">This is a recipe that makes ${esc(d.recipe.servings)} servings. Values below are per serving. <button class="btn ghost" data-act="editRecipeFromFood">Edit ingredients</button></div>`:""}
     <div class="grid2"><label class="field"><span class="label">Serving size</span><input id="fd-size" inputmode="decimal" value="${esc(d.size)}" data-in="draft" data-k="size" data-num="1"></label>
       <label class="field"><span class="label">Unit</span><select id="fd-unit" data-in="draft" data-k="unit">${UNITS.map(u=>`<option ${d.unit===u?"selected":""}>${u}</option>`).join("")}</select></label></div>
     <div class="label" style="margin-top:4px">Per serving</div>
     <div class="grid4">
      <label class="field"><span class="label k">Kcal</span><input id="fd-kcal" inputmode="decimal" value="${esc(d.kcal)}" data-in="draft" data-k="kcal" data-num="1"></label>
      <label class="field"><span class="label pc">Protein</span><input id="fd-p" inputmode="decimal" value="${esc(d.p)}" data-in="draft" data-k="p" data-num="1"></label>
      <label class="field"><span class="label cc">Carbs</span><input id="fd-c" inputmode="decimal" value="${esc(d.c)}" data-in="draft" data-k="c" data-num="1"></label>
      <label class="field"><span class="label fc">Fat</span><input id="fd-f" inputmode="decimal" value="${esc(d.f)}" data-in="draft" data-k="f" data-num="1"></label></div>
     <div class="grid2"><label class="field"><span class="label">Fibre g (optional)</span><input id="fd-fibre" inputmode="decimal" value="${esc(d.fibre??"")}" data-in="draft" data-k="fibre" data-num="1"></label>
       <label class="field"><span class="label">Sodium mg (optional)</span><input id="fd-sodium" inputmode="decimal" value="${esc(d.sodium??"")}" data-in="draft" data-k="sodium" data-num="1"></label></div>
     <div class="small muted" id="fd-check">${foodCheck(d)}</div>
     <div class="setbtns">${s.id?delBtn("food:"+s.id,"delFood"):""}<span class="spacer"></span><button class="btn primary" data-act="saveFood">Save food</button></div></div>`;
  }
  else if(s.type==="exercise"){
    const d=s.draft;
    h+=sheetHead(s.id?"Edit exercise":"New exercise")+`<div class="sbody">
     <label class="field"><span class="label">Name</span><input id="ed-name" value="${esc(d.name)}" data-in="draft" data-k="name" placeholder="e.g. Landmine press"></label>
     <div class="field"><span class="label">Movement pattern</span><div class="seg">${PATTERNS.map(p=>`<button class="${d.pattern===p?"on":""}" data-act="draftSet" data-k="pattern" data-v="${p}">${p[0].toUpperCase()+p.slice(1)}</button>`).join("")}</div></div>
     <label class="field"><span class="label">Muscle groups (comma separated)</span><input id="ed-mus" value="${esc((d.muscles||[]).join(", "))}" data-in="draft" data-k="musclesText" placeholder="Chest, triceps"></label>
     <div class="field"><span class="label">Equipment</span><div class="chips">${EQUIP.map(q=>`<button class="chip ${(d.equipment||[]).includes(q)?"on":""}" data-act="draftEquip" data-v="${q}">${q}</button>`).join("")}</div></div>
     <div class="label" style="margin-top:4px">Defaults</div>
     <div class="grid4" style="grid-template-columns:1fr 1fr 1fr">
      <label class="field"><span class="label">Sets</span><input id="ed-sets" inputmode="numeric" value="${esc(d.sets)}" data-in="draft" data-k="sets" data-num="1"></label>
      <label class="field"><span class="label">Reps</span><input id="ed-reps" value="${esc(d.reps)}" data-in="draft" data-k="reps" placeholder="8-10"></label>
      <label class="field"><span class="label">Rest (s)</span><input id="ed-rest" inputmode="numeric" value="${esc(d.rest)}" data-in="draft" data-k="rest" data-num="1"></label></div>
     <label class="field"><span class="label">Notes</span><textarea id="ed-notes" data-in="draft" data-k="notes" placeholder="Cues, setup, grip">${esc(d.notes||"")}</textarea></label>`;
    if(s.id){ const hs=history(s.id,6);
      h+=`<div class="field"><span class="label">Recent sessions</span>${hs.length?`<div class="list">`+hs.map(x=>`<div class="li"><span class="main"><div class="nm">${fmtDate(x.date)}</div></span><span class="right" style="font-size:15px">${esc(setsText(x.rows))}</span></div>`).join("")+`</div>`:`<div class="empty">Not logged yet.</div>`}</div>`; }
    h+=`<div class="setbtns">${s.id?delBtn("ex:"+s.id,"delEx"):""}<span class="spacer"></span><button class="btn primary" data-act="saveEx">Save exercise</button></div></div>`;
  }
  else if(s.type==="workout"){
    const d=s.draft;
    h+=sheetHead(s.id?"Edit workout":"New workout")+`<div class="sbody">
     <label class="field"><span class="label">Name</span><input id="wd-name" value="${esc(d.name)}" data-in="draft" data-k="name" placeholder="e.g. Push A"></label>
     <div class="field"><span class="label">Type</span><div class="chips">${TAGS.map(t=>`<button class="chip ${d.tag===t?"on":""}" data-act="draftSet" data-k="tag" data-v="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join("")}</div></div>
     <div class="label" style="margin-top:4px">Exercises</div>`;
    (d.items||[]).forEach((it,i)=>{ const e=S.ex[it.exId];
      h+=`<div class="witem"><div class="row"><b>${esc(e?e.name:"Removed exercise")}</b>
        <button class="iconbtn" data-act="wMove" data-i="${i}" data-n="-1" aria-label="Move up" ${i===0?"disabled":""}>${ICON.up}</button>
        <button class="iconbtn" data-act="wMove" data-i="${i}" data-n="1" aria-label="Move down" ${i===d.items.length-1?"disabled":""}>${ICON.down}</button>
        <button class="iconbtn" data-act="wDel" data-i="${i}" aria-label="Remove">${ICON.close}</button></div>
        <div class="grid4">
         <label class="field"><span class="label">Sets</span><input id="wi-${i}-sets" inputmode="numeric" value="${esc(it.sets)}" data-in="witem" data-i="${i}" data-k="sets" data-num="1"></label>
         <label class="field"><span class="label">Reps</span><input id="wi-${i}-reps" value="${esc(it.reps)}" data-in="witem" data-i="${i}" data-k="reps"></label>
         <label class="field"><span class="label">Kg</span><input id="wi-${i}-w" inputmode="decimal" value="${esc(it.weight||"")}" placeholder="–" data-in="witem" data-i="${i}" data-k="weight" data-num="1"></label>
         <label class="field"><span class="label">Rest s</span><input id="wi-${i}-rest" inputmode="numeric" value="${esc(it.rest)}" data-in="witem" data-i="${i}" data-k="rest" data-num="1"></label></div></div>`; });
    h+=`<button class="btn" data-act="wAdd">+ Add exercise</button>
     <label class="field"><span class="label">Notes</span><input id="wd-notes" value="${esc(d.notes||"")}" data-in="draft" data-k="notes" placeholder="e.g. Phase 2, add 2.5 kg when top of range hit"></label>
     <div class="setbtns">${s.id?delBtn("wo:"+s.id,"delWorkout"):""}<span class="spacer"></span><button class="btn primary" data-act="saveWorkout">Save workout</button></div></div>`;
  }
  else if(s.type==="exLib"){ h+=renderLib(s); }
  else if(s.type==="gen"){ h+=renderGen(s); }
  else if(s.type==="genSwap"){ h+=renderGenSwap(s); }
  else if(s.type==="body"){ h+=renderBody(s); }
  else if(s.type==="live"){ h+=renderLive(s); }
  else if(s.type==="liveDone"){ h+=renderLiveDone(s); }
  else if(s.type==="checkin"){ h+=renderCheckin(s); }
  else if(s.type==="run"){ h+=renderRun(s); }
  else if(s.type==="photo"){ h+=renderPhoto(s); }
  else if(s.type==="planMeal"){ h+=renderPlanMeal(s); }
  else if(s.type==="planPick"){ h+=renderPlanPick(s); }
  else if(s.type==="ideas"){ h+=renderIdeas(s); }
  else if(s.type==="exPick"){
    h+=sheetHead("Add exercise", `<button class="btn ghost" data-act="newExFromPick">+ New</button>`)+`<div class="sbody">
     <input type="search" id="xp-q" placeholder="Search exercises" value="${esc(s.q)}" data-in="xpQ" autocomplete="off">
     <div class="chips">${["all",...PATTERNS].map(p=>`<button class="chip ${s.filter===p?"on":""}" data-act="xpFilter" data-v="${p}">${p==="all"?"All":p[0].toUpperCase()+p.slice(1)}</button>`).join("")}</div>
     ${exList(s.filter, s.q, "xpPick")}
     ${(()=>{ const xs=libFilter({q:s.q, pattern:s.filter},true); return xs.length?`<div class="label">From the library · ${xs.length}</div><div class="list">${xs.slice(0,60).map(x=>libRow(x,s,"xpLib")).join("")}</div>${xs.length>60?`<div class="small muted">Search to narrow down the rest.</div>`:""}`:""; })()}</div>`;
  }
  p.innerHTML=h;
}
function foodCheck(d){ const k=num(d.p)*4+num(d.c)*4+num(d.f)*9; if(!num(d.kcal)&&!k) return ""; const off=num(d.kcal)&&Math.abs(k-num(d.kcal))>Math.max(15,num(d.kcal)*.12);
  return `Macros work out to ${n0(k)} kcal${off?", a bit off the label figure. Worth double-checking (fibre and alcohol can explain small gaps).":"."}`; }


/* ---------- sign-in, setup, starter ---------- */
function vSetup(){
  return `<div class="stack" style="padding-top:40px"><div class="brand">Recomp Planner</div><h1>Almost there</h1>
  <div class="card"><div>This copy of the app isn't connected to a database yet. Put your Supabase project URL and anon key into <b>config.js</b>, then redeploy. The README walks through it.</div></div></div>`;
}
function vLogin(){
  return `<div class="stack" style="padding-top:40px;max-width:420px;margin:0 auto">
   <div class="brand">Recomp Planner</div><h1>Sign in</h1>
   <form class="card" id="login" novalidate>
    <label class="field"><span class="label">Email</span><input id="li-email" type="email" autocomplete="username" inputmode="email" value="${esc(ui.loginEmail||"")}" required></label>
    <label class="field"><span class="label">Password</span><input id="li-pw" type="password" autocomplete="current-password" required></label>
    <div class="small" id="li-err" style="color:var(--warn)" ${ui.loginErr?"":"hidden"}>${esc(ui.loginErr||"")}</div>
    <button class="btn primary block" type="submit" ${ui.loginBusy?"disabled":""}>${ui.loginBusy?"Signing in…":"Sign in"}</button>
   </form>
   <div class="small muted">Your data syncs to your own Supabase project. Once signed in, the app keeps working offline.</div></div>`;
}
document.addEventListener("submit", async ev=>{
  if(ev.target.id!=="login") return; ev.preventDefault();
  const email=$("#li-email").value.trim(), pw=$("#li-pw").value;
  ui.loginEmail=email;
  if(!email||!pw){ ui.loginErr="Enter your email and password."; render(); return; }
  ui.loginBusy=true; ui.loginErr=""; render();
  try{ await Sync.signIn(email,pw); }catch(e){ ui.loginErr=e.message||"Couldn't sign in."; }
  ui.loginBusy=false; render();
});
function welcomeCard(){
  return `<section class="card"><div class="card-h"><h2>Set up your library</h2></div>
   <div class="small">Your exercise and food lists are empty. Start from a starter set built for your home gym (26 exercises, Push A / Pull A / Legs A, a Mon–Sat split and 18 common foods), or build your own under Train and Food.</div>
   <div class="setbtns"><button class="btn primary" data-act="seedStarter">Add starter set</button><button class="btn" data-act="tab" data-v="train">Build my own</button></div></section>`;
}
function accountCard(){
  const s=Sync.status();
  return `<section class="card" style="margin-top:8px"><div class="card-h"><h2>Account</h2></div>
   <div class="small">${esc(s.user?s.user.email:"")}<br><span class="muted">${esc(statusText(s)||"")}${s.error?" · "+esc(s.error):""}</span></div>
   ${!Object.keys(S.ex).length||!Object.keys(S.foods).length?`<button class="btn" data-act="seedStarter">Add starter set</button>`:""}
   <div class="setbtns"><button class="btn" data-act="syncNow">Sync now</button><span class="spacer"></span>
   <button class="btn danger" data-act="signOut">${ui.confirm==="signout"?(s.pending?`${s.pending} changes not synced. Tap again`:"Tap again to sign out"):"Sign out"}</button></div></section>`;
}


/* ---------- ingredient picker, recipe builder and meal check (all offline) ---------- */
function guessSlot(){ const h=new Date().getHours(); return h<11?"breakfast":h<15?"lunch":h<17?"snacks":h<22?"dinner":"snacks"; }
function cap(s){ s=String(s||""); return s.charAt(0).toUpperCase()+s.slice(1); }
const r1=v=>Math.round(v*10)/10, r4=v=>Math.round(v*10000)/10000;
function rowsTotal(rows){ const t={kcal:0,p:0,c:0,f:0,fi:0}; let g=0, gKnown=true;
  for(const r of rows){ const x=Ing.rowMacros(r); for(const k in t) t[k]+=x[k]; const gg=Ing.rowGrams(r); if(gg==null) gKnown=false; else g+=gg; }
  return { ...t, grams:gKnown?g:null }; }
function unitText(u){ return u.l; }
function mealFromRow(row, slot, eaten){
  const u=row.units[row.u]||row.units[0], b=row.base;
  return { id:rid("m"), slot, foodId:row.foodId||null, ref:row.ref, name:row.name, emoji:row.emoji||foodEmoji(row), size:1, unit:unitText(u),
    kcal:r4(b.k*u.f), p:r4(b.p*u.f), c:r4(b.c*u.f), f:r4(b.f*u.f), qty:num(row.q), eaten:!!eaten };
}
function ensureFull(){ if(!Ing.fullLoaded()) Ing.loadFull().then(()=>{ if(top()) render(); }).catch(()=>{}); }
function unitOptions(row, i){ return row.units.map((u,k)=>`<option value="${k}" ${k===row.u?"selected":""}>${esc(u.l)}${u.approx?" (approx)":""}</option>`).join(""); }
function amountLine(row){ const u=row.units[row.u]||row.units[0], g=Ing.rowGrams(row);
  return `${n1(row.q)} ${esc(u.l)}${g!=null&&u.l!=="g"&&u.l!=="ml"?` · ${n0(g)} g`:""}`; }
function srcLabel(src){ return src.kind==="food"?(src.note||"Your food"):src.kind==="core"?"Ingredient":"USDA food"; }
function resultRow(src, act, sel){
  const per = src.kind==="food" ? `per ${n1((src.units[0]&&src.defaultQty)||1)} ${esc(src.units[0].l)}` : "per 100 g";
  const k = src.kind==="food" ? src.base.k*(src.units[0].f*(src.defaultQty||1)) : src.base.k;
  return `<button class="li ${sel===src.ref?"sel":""}" data-act="${act}" data-ref="${esc(src.ref)}"><span class="plate" aria-hidden="true">${src.emoji||foodEmoji(src)}</span>
    <span class="main"><div class="nm">${esc(src.name)}</div><div class="sub">${per} · <span class="pc">P ${n1(src.kind==="food"?src.base.p*src.units[0].f*(src.defaultQty||1):src.base.p)}</span></div></span>
    <span class="right">${n0(k)}<span class="small muted" style="font-weight:500"> cal</span></span></button>`;
}
function pickResults(s){
  const q=(s.q||"").trim();
  if(!q){
    const own=sortedBy(S.foods).map(f=>Ing.foodSource(f));
    return `<div class="label">Your foods</div>`+(own.length?`<div class="list">${own.map(x=>resultRow(x,"pickSrc",s.sel)).join("")}</div>`:`<div class="empty">None saved yet.</div>`)
      +`<div class="small muted">Or search ${Ing.coreCount} everyday ingredients and about 5,900 more foods.</div>`;
  }
  ensureFull();
  const res=Ing.search(q, S.foods, 60), groups=[["food","Your foods"],["core","Ingredients"],["usda","More foods (USDA)"]];
  let h=""; for(const [k,l] of groups){ const xs=res.filter(r=>r.kind===k).slice(0, k==="usda"?20:15); if(xs.length) h+=`<div class="label">${l}</div><div class="list">${xs.map(x=>resultRow(x,"pickSrc",s.sel)).join("")}</div>`; }
  if(!Ing.fullLoaded()) h+=`<div class="small muted">Loading more foods…</div>`;
  if(!h) h=`<div class="empty">Nothing matches “${esc(q)}”. Try a simpler word, or add it as a new food.</div>`;
  return h;
}
function renderPick(s){
  const forDay=s.target==="day";
  let h=sheetHead(forDay?`Add to ${SLOTS.find(x=>x[0]===s.slot)[1]}`:(s.rowIdx!=null?"Swap ingredient":"Add ingredient"),
    forDay?`<button class="btn ghost" data-act="newRecipe">Recipe</button><button class="btn ghost" data-act="newFoodFromPick">+ New</button>`:"")+`<div class="sbody">`;
  if(forDay) h+=`<div class="seg">${SLOTS.map(([k,l])=>`<button class="${s.slot===k?"on":""}" data-act="pickSlot" data-v="${k}">${l}</button>`).join("")}</div>`;
  if(s.row){ const x=Ing.rowMacros(s.row);
    h+=`<div class="card"><div class="frow" style="grid-template-columns:56px 1fr;gap:12px"><div class="plate sm" aria-hidden="true">${s.row.emoji||foodEmoji(s.row)}</div>
      <div style="min-width:0"><div class="fname">${esc(s.row.name)}</div><div class="fqty">${esc(srcLabel(s.src||{kind:s.row.kind}))}</div></div></div>
      <div class="ictl"><input id="pk-q" inputmode="decimal" value="${esc(s.row.q)}" data-in="pickRowQ" aria-label="Amount"><select id="pk-u" data-in="pickRowU" aria-label="Unit">${unitOptions(s.row)}</select></div>
      <div id="pk-prev">${preview(x)}</div>
      ${forDay?`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="fp-eaten" data-in="pickEaten" ${s.eaten?"checked":""} style="width:20px;height:20px"> Already eaten</label>`:""}
      <button class="btn primary block" data-act="confirmPick">${forDay?`Add ${esc(s.row.name)}`:(s.rowIdx!=null?"Use this instead":"Add to recipe")}</button></div>`; }
  const parts=Ing.splitMeal(s.q||""); 
  h+=`<input type="search" id="fp-q" placeholder="Search foods and ingredients" value="${esc(s.q)}" data-in="pickQ" autocomplete="off" enterkeyhint="search">`;
  if(forDay && parts.length>1) h+=`<button class="btn block" data-act="pickSplit" style="text-align:left">Split into ${parts.length} foods: ${esc(parts.join(" · "))}</button>`;
  return h+pickResults(s)+`</div>`;
}
function rowEditor(row, i){
  const x=Ing.rowMacros(row);
  return `<div class="irow"><div class="plate" aria-hidden="true">${row.emoji||foodEmoji(row)}</div>
    <div style="min-width:0"><button class="iname" data-act="swapRow" data-i="${i}">${esc(row.name)}${row.approx?` <span class="pill starter" style="color:var(--warn)">check</span>`:""}</button>
      ${row.line?`<div class="fqty">“${esc(row.line.replace(/^[\s\-–•*]+/,""))}”</div>`:""}
      ${fmac(x)}
      <div class="ictl"><input id="ir-q-${i}" inputmode="decimal" value="${esc(row.q)}" data-in="rowQ" data-i="${i}" aria-label="Amount of ${esc(row.name)}">
        <select id="ir-u-${i}" data-in="rowU" data-i="${i}" aria-label="Unit">${unitOptions(row)}</select>
        <button class="iconbtn" data-act="rmRow" data-i="${i}" aria-label="Remove ${esc(row.name)}">${ICON.close}</button></div></div></div>`;
}
function renderList(s){
  const T=rowsTotal(s.rows), rec=s.mode==="recipe", sv=Math.max(0.5,num(s.servings)||1);
  let h=sheetHead(rec?(s.id?"Edit recipe":"New recipe"):"Check your meal")+`<div class="sbody">`;
  if(rec){
    h+=`<div class="grid2" style="grid-template-columns:64px 1fr"><label class="field"><span class="label">Icon</span><input id="rb-emoji" value="${esc(s.emoji||"")}" placeholder="${foodEmoji({name:s.name})}" data-in="listField" data-k="emoji" style="text-align:center;font-size:24px;padding:4px"></label>
      <label class="field"><span class="label">Name</span><input id="rb-name" value="${esc(s.name||"")}" data-in="listField" data-k="name" placeholder="e.g. Harissa chicken traybake"></label></div>
      <label class="field"><span class="label">Servings it makes</span><input id="rb-serv" inputmode="decimal" value="${esc(s.servings)}" data-in="listField" data-k="servings" data-rerender="1"></label>
      <div class="card" style="gap:8px"><div class="label">Per serving</div>${preview({kcal:T.kcal/sv,p:T.p/sv,c:T.c/sv,f:T.f/sv})}
        <div class="small muted">Whole recipe ${n0(T.kcal)} kcal · ${n1(T.p)} g protein${T.grams!=null&&T.grams>0?` · ${n0(T.grams)} g, so a serving is about ${n0(T.grams/sv)} g`:""}</div></div>`;
    const open=s.showPaste||!s.rows.length;
    h+= open ? `<div class="card" style="gap:10px"><div class="label">Paste an ingredient list</div>
        <textarea id="rb-paste" data-in="listPaste" placeholder="One ingredient per line, e.g.&#10;800g chicken thighs&#10;2 tbsp olive oil&#10;1 tin chopped tomatoes">${esc(s.paste||"")}</textarea>
        <div class="setbtns"><button class="btn primary" data-act="listParse">Match ingredients</button><span class="small muted">Copy it from the caption, then paste here.</span></div></div>`
      : `<button class="btn" data-act="listShowPaste">Paste more ingredients</button>`;
  } else {
    h+=`<div class="bubble">${esc(s.text)}</div><div class="card" style="gap:8px"><div class="label">Total</div>${preview(T)}</div>`;
  }
  h+=`<div class="sec-h"><span class="label" style="flex:1">${rec?"Ingredients":"Foods"} · ${s.rows.length}</span><button class="btn ghost" data-act="listAdd">+ Add</button></div>`;
  if(s.rows.length) h+=`<div class="ilist">${s.rows.map(rowEditor).join("")}</div>`;
  else h+=`<div class="empty">${rec?"No ingredients yet. Paste a list above or add them one by one.":"Nothing matched. Add foods one by one."}</div>`;
  if((s.misses||[]).length) h+=`<div class="card" style="gap:8px"><div class="label">Couldn't match</div>${s.misses.map((m,i)=>`<div class="top-row" style="gap:8px"><span style="flex:1;min-width:0">${esc(m.line)}</span><button class="btn" data-act="findMiss" data-i="${i}">Find</button><button class="iconbtn" data-act="dropMiss" data-i="${i}" aria-label="Ignore">${ICON.close}</button></div>`).join("")}</div>`;
  if(s.method) h+=`<div class="card" style="gap:6px"><div class="label">Method</div><div class="note" style="font-size:15px">${esc(s.method)}</div></div>`;
  if(s.skipped) h+=`<div class="small muted">Skipped ${s.skipped} line${s.skipped===1?"":"s"} that ${s.skipped===1?"wasn't an ingredient":"weren't ingredients"} (headings, method, salt and pepper).</div>`;
  h+=`<div class="small muted">Tap a name to swap it for a different food. Anything marked <b style="color:var(--warn);font-weight:600">check</b> was a loose match or a guessed amount.</div>`;
  h+=`<div class="field"><span class="label">${rec?"Add a serving to":"Add to"} ${esc(fmtDate(s.date))}</span><div class="seg">${SLOTS.map(([k,l])=>`<button class="${s.slot===k?"on":""}" data-act="listSlot" data-v="${k}">${l}</button>`).join("")}</div></div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="rb-eaten" data-in="listEaten" ${s.eaten?"checked":""} style="width:20px;height:20px"> Already eaten</label>`;
  if(rec) h+=`<div class="setbtns">${s.id?delBtn("food:"+s.id,"delRecipe"):""}<span class="spacer"></span><button class="btn" data-act="saveRecipe" data-add="0">Save recipe</button><button class="btn primary" data-act="saveRecipe" data-add="1">Save + add 1 serving</button></div>`;
  else h+=`<div class="setbtns"><button class="btn" data-act="mealToRecipe">Save as a recipe</button><span class="spacer"></span><button class="btn primary" data-act="listAddMeal" ${s.rows.length?"":"disabled"}>Add ${s.rows.length} ${s.rows.length===1?"food":"foods"}</button></div>`;
  return h+`</div>`;
}
function parseInto(s, lines){
  let skipped=0; s.misses=s.misses||[];
  for(const l of lines){ const r=Ing.parseLine(l, S.foods); if(!r){ skipped++; continue; } if(r.row) s.rows.push(r.row); else s.misses.push({line:l.trim(), text:r.text}); }
  s.skipped=(s.skipped||0)+skipped;
}
function recipeRows(f){
  const rc=f.recipe||{};
  if(Array.isArray(rc.rows)) return clone(rc.rows);
  if(Array.isArray(rc.items)) return rc.items.map(Ing.legacyItemRow);
  return [];
}
function openRecipe(f, extra){
  pushSheet(Object.assign({type:"list", mode:"recipe", id:f?f.id:null, name:f?f.name:"", emoji:f?f.emoji||"":"", servings:f&&f.recipe?f.recipe.servings:4, method:f&&f.recipe?f.recipe.method||"":"",
    rows:f?recipeRows(f):[], misses:[], paste:"", showPaste:false, date:ui.date, slot:guessSlot(), eaten:false, skipped:0}, extra||{}));
}
/* ---------- meal ideas ---------- */
const IDEA_CATS=["Breakfast","Lunch","Dinner","Snacks & shakes"];
const ideaCache=new Map();
function ideaParsed(m){
  if(ideaCache.has(m.id)) return ideaCache.get(m.id);
  const rows=[], misses=[]; for(const l of m.i){ const r=Ing.parseLine(l,{}); if(r&&r.row){ r.row.line=l; rows.push(r.row); } else if(r) misses.push({line:l,text:r.text}); }
  const T=rowsTotal(rows), sv=m.s||1, out={rows, misses, per:{kcal:T.kcal/sv,p:T.p/sv,c:T.c/sv,f:T.f/sv}};
  ideaCache.set(m.id,out); return out;
}
function renderIdeas(s){
  const all=window.MEAL_IDEAS||[], q=(s.q||"").toLowerCase().trim();
  const xs=all.filter(m=>(s.cat==="all"||m.c===s.cat)&&(!q||(m.n+" "+m.i.join(" ")).toLowerCase().includes(q)));
  let h=sheetHead("Meal ideas")+`<div class="sbody">
    <div class="small muted">High-protein meals for a lean bulk. Tap one to see the ingredients and method, change any amounts, then save it or add it to ${esc(fmtDate(s.date))}.</div>
    <input type="search" id="mi-q" placeholder="Search meals or ingredients" value="${esc(s.q)}" data-in="ideaQ" autocomplete="off">
    <div class="chips hscroll">${["all",...IDEA_CATS].map(c=>`<button class="chip ${s.cat===c?"on":""}" data-act="ideaCat" data-v="${esc(c)}">${c==="all"?"All":esc(c)}</button>`).join("")}</div>`;
  if(!xs.length) h+=`<div class="empty">No meals match.</div>`;
  for(const c of IDEA_CATS){ const cx=xs.filter(m=>m.c===c); if(!cx.length) continue;
    h+=`<div class="label">${esc(c)}</div><div class="list">`+cx.map(m=>{ const P=ideaParsed(m).per, saved=!!S.foods["f-"+m.id];
      return `<button class="li" data-act="openIdea" data-id="${esc(m.id)}"><span class="plate" aria-hidden="true">${m.e}</span><span class="main"><div class="nm">${esc(m.n)}${saved?` <span class="pill starter" style="color:var(--accent)">saved</span>`:""}</div>
        <div class="sub">${esc(m.t)}${m.s>1?` · serves ${m.s}`:""}</div><div class="fmac" style="margin-top:4px"><span class="kc">${n0(P.kcal)}<small>cal</small></span><span class="p">P ${n0(P.p)}</span><span class="c">C ${n0(P.c)}</span><span class="f">F ${n0(P.f)}</span></div></span></button>`; }).join("")+`</div>`; }
  return h+`<div class="small muted">Values are per serving, from the built-in ingredient database. Swap in your own foods or change amounts once a meal is open.</div></div>`;
}

/* ---------- render ---------- */
function render(){
  const a=document.activeElement, fid=a&&a.id, sel=a&&("selectionStart" in a)?[a.selectionStart,a.selectionEnd]:null;
  const panelScroll=$("#panel").scrollTop;
  const st=Sync.status(), gate=!st.configured||!st.user;
  const views={today:vToday, week:vWeek, train:vTrain, food:vFood, progress:vProgress};
  $("#app").innerHTML= !st.configured ? vSetup() : !st.user ? vLogin() : (views[ui.tab]||vToday)();
  $("#dock").hidden=gate; if(gate) ui.sheets=[];
  $("#askform").hidden = ui.tab!=="today"; document.body.classList.toggle("no-ask", ui.tab!=="today");
  $("#tabs").innerHTML=[["today","Today"],["week","Week"],["train","Train"],["food","Food"],["progress","Progress"]].map(([k,l])=>`<button class="${ui.tab===k?"on":""}" data-act="tab" data-v="${k}" aria-label="${l}" aria-current="${ui.tab===k?"page":"false"}">${ICON[k]}<span>${l}</span></button>`).join("");
  renderSheet(); $("#panel").scrollTop=panelScroll;
  if(fid){ const e=document.getElementById(fid); if(e){ e.focus({preventScroll:true}); try{ if(sel&&sel[0]!=null) e.setSelectionRange(sel[0],sel[1]); }catch(_){} } }
  status();
}

/* ---------- actions ---------- */
function ensureLog(date, exId){
  const d=dayMut(date); if(!d.log[exId]){ const wf=workoutFor(date); const it=(wf.w&&wf.w.items||[]).find(x=>x.exId===exId)||{};
    d.log[exId]=Array.from({length:Number(it.sets)||0},()=>({w:"",r:"",rir:"",done:false})); }
  return d.log[exId];
}
function itemFor(date, exId){ const wf=workoutFor(date); return (wf.w&&wf.w.items||[]).find(x=>x.exId===exId)||{}; }
const A = {
  newRecipe(){ const s=top(); openRecipe(null, s&&s.type==="pick"&&s.target==="day"?{date:s.date, slot:s.slot}:{}); },
  editRecipeFromFood(){ const s=top(), f=S.foods[s.id]; if(!f) return; ui.sheets.pop(); openRecipe(f); },
  listShowPaste(){ top().showPaste=true; render(); },
  listParse(){ const s=top(); let lines=Ing.splitRecipe(s.paste||""); const mi=lines.findIndex(l=>/^(method|instructions?|directions?|steps?|how to make)\b/i.test(l.replace(/^[\s\-–•*#]+/,""))); if(mi>0){ s.skipped=(s.skipped||0)+lines.length-mi; lines=lines.slice(0,mi); } if(!lines.length){ toast("Paste the ingredient list first."); return; }
    const before=s.rows.length; parseInto(s, lines); s.paste=""; s.showPaste=false;
    if(!s.name){ const t=lines.find(l=>!/^[\s\-–•*\d½¼¾⅓⅔]/.test(l) && l.length<70 && !/^(ingredients?|method|instructions?|serves|makes|for the)\b/i.test(l));
      if(t){ s.name=cap(t.replace(/\((?:serves|makes)[^)]*\)/ig,"").replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F:#*]/gu,"").replace(/\s+/g," ").trim()); s.misses=s.misses.filter(m=>m.line!==t.trim()); } }
    const sm=lines.join(" ").match(/\b(?:serves|makes|servings?:?)\s*(\d+)/i); if(sm && (!s.id)) s.servings=+sm[1];
    toast(`Matched ${s.rows.length-before} ingredient${s.rows.length-before===1?"":"s"}`); render(); },
  listAdd(){ const s=top(); ensureFull(); pushSheet({type:"pick", target:"list", q:"", sel:null, row:null, rowIdx:null}); },
  swapRow(b){ const s=top(), r=s.rows[+b.dataset.i]; ensureFull(); pushSheet({type:"pick", target:"list", q:r.line?(Ing.parseLine(r.line,S.foods)||{}).text||r.name:r.name, sel:null, row:null, rowIdx:+b.dataset.i}); },
  rmRow(b){ top().rows.splice(+b.dataset.i,1); render(); },
  findMiss(b){ const s=top(), m=s.misses[+b.dataset.i]; ensureFull(); pushSheet({type:"pick", target:"list", q:m.text||m.line, sel:null, row:null, rowIdx:null, missIdx:+b.dataset.i}); },
  dropMiss(b){ top().misses.splice(+b.dataset.i,1); render(); },
  listSlot(b){ top().slot=b.dataset.v; render(); },
  saveRecipe(b){ const s=top(); if(!s.rows.length){ toast("Add at least one ingredient."); return; }
    const name=String(s.name||"").trim(); if(!name){ toast("Give the recipe a name."); const e=$("#rb-name"); if(e) e.focus(); return; }
    const sv=Math.max(0.5,num(s.servings)||1), T=rowsTotal(s.rows), id=s.id||s.saveId||rid("f");
    const food={ id, name, emoji:(s.emoji||"").trim()||foodEmoji({name}), size:1, unit:"serving",
      kcal:Math.round(T.kcal/sv), p:r1(T.p/sv), c:r1(T.c/sv), f:r1(T.f/sv), fibre:r1(T.fi/sv),
      recipe:{ v:2, servings:sv, gramsPerServing:T.grams?Math.round(T.grams/sv):null, rows:s.rows.map(r=>{ const o=clone(r); delete o.line; return o; }), method:s.method||"", idea:s.ideaId||null, updated:TODAY() } };
    Sync.put("foods/"+id, food); loadS();
    if(b.dataset.add==="1"){ const row=Ing.makeRow(Ing.foodSource(food)); row.q=1; row.u=0; dayMut(s.date).meals.push(mealFromRow(row, s.slot, s.eaten)); queueSave("days/"+s.date); }
    ui.sheets=[]; toast(b.dataset.add==="1"?`Saved ${name} and added a serving`:`Saved ${name}`); render(); },
  delRecipe(){ const s=top(), key="food:"+s.id; if(ui.confirm!==key){ ui.confirm=key; render(); return; } Sync.remove("foods/"+s.id); loadS(); ui.sheets=[]; toast("Recipe deleted"); render(); },
  listAddMeal(){ const s=top(); const d=dayMut(s.date); s.rows.forEach(r=>{ if(num(r.q)>0) d.meals.push(mealFromRow(r, s.slot, s.eaten)); });
    queueSave("days/"+s.date); ui.sheets=[]; toast(`Added to ${SLOTS.find(x=>x[0]===s.slot)[1].toLowerCase()}`); render(); },
  mealToRecipe(){ const s=top(); s.mode="recipe"; s.servings=1; s.name=s.name||cap(s.text||""); render(); },
  pickSrc(b){ const s=top(), src=Ing.get(b.dataset.ref, S.foods); if(!src) return; s.sel=src.ref; s.src=src; s.row=Ing.makeRow(src);
    if(s.target==="list"){ const l=ui.sheets[ui.sheets.length-2], old=s.rowIdx!=null?l.rows[s.rowIdx]:null, line=old?old.line:(s.missIdx!=null?l.misses[s.missIdx].line:null);
      const fit=line?Ing.fitLine(src,line):null;
      if(fit) s.row=fit;
      else if(old){ const g=Ing.rowGrams(old), gi=s.row.units.findIndex(u=>u.l==="g"); if(g!=null&&gi>=0){ s.row.u=gi; s.row.q=Math.round(g); } } }
    render(); const p=$("#panel"); if(p) p.scrollTop=0; },
  pickSplit(){ const s=top(); const lines=Ing.splitMeal(s.q); const l={type:"list", mode:"meal", text:s.q, rows:[], misses:[], date:s.date, slot:s.slot, eaten:s.eaten, skipped:0};
    parseInto(l, lines); ui.sheets[ui.sheets.length-1]=l; render(); },
  seedStarter(){ const T=window.STARTER; let n=0;
    T.exercises.forEach(e=>{ if(!S.ex[e.id]){ Sync.put("exercises/"+e.id, clone(e)); n++; } });
    T.foods.forEach(f=>{ if(!S.foods[f.id]){ Sync.put("foods/"+f.id, clone(f)); n++; } });
    T.workouts.forEach(w=>{ if(!S.wo[w.id]){ Sync.put("workouts/"+w.id, clone(w)); n++; } });
    if(!Object.keys(S.settings.split||{}).length){ S.settings.split=clone(T.split); queueSave("settings/main"); }
    loadS(); toast(n?`Added ${n} starter items. Edit or delete any of them.`:"Starter set is already in."); render(); },
  async syncNow(){ await Sync.syncNow(); const s=Sync.status(); toast(s.error||"Up to date"); },
  async signOut(){ if(ui.confirm!=="signout"){ ui.confirm="signout"; render(); return; } ui.confirm=null; await Sync.signOut(); ui.tab="today"; render(); },
  tab(b){ if(ui.tab===b.dataset.v){ window.scrollTo({top:0,behavior:"smooth"}); return; } ui.confirm=null; ui.tab=b.dataset.v; lsSet("rp-tab",ui.tab); ui.sheets=[]; render(); window.scrollTo(0,0); fadeApp(); },
  day(b){ ui.date=addDays(ui.date,Number(b.dataset.n)); render(); fadeApp(Number(b.dataset.n)>0?"next":"prev"); },
  goToday(){ ui.date=TODAY(); render(); },
  week(b){ ui.week=addDays(ui.week,Number(b.dataset.n)); render(); fadeApp(Number(b.dataset.n)>0?"next":"prev"); },
  openDay(b){ ui.date=b.dataset.date; ui.tab="today"; lsSet("rp-tab","today"); render(); window.scrollTo(0,0); fadeApp(); },
  seg(b){ ui.trainSeg=b.dataset.v; lsSet("rp-seg",ui.trainSeg); render(); },
  exFilter(b){ ui.exFilter=b.dataset.v; render(); },
  tick(b){ const {ex,i}=b.dataset, rows=ensureLog(ui.date,ex), r=rows[+i], it=itemFor(ui.date,ex);
    if(!r.done){ if(r.w===""&&Number(it.weight)) r.w=String(it.weight); if(r.r==="") r.r=firstRep(it.reps); }
    r.done=!r.done; queueSave("days/"+ui.date); render(); },
  addSet(b){ const rows=ensureLog(ui.date,b.dataset.ex); const prev=rows[rows.length-1]; rows.push({w:prev?prev.w:"",r:"",done:false}); queueSave("days/"+ui.date); render(); },
  rmSet(b){ const rows=ensureLog(ui.date,b.dataset.ex); rows.pop(); queueSave("days/"+ui.date); render(); },
  addFood(b){ ensureFull(); pushSheet({type:"pick", target:"day", date:ui.date, slot:b.dataset.slot, q:"", sel:null, row:null, eaten:ui.date<=TODAY()}); },
  pickSlot(b){ top().slot=b.dataset.v; render(); },
  confirmPick(){ const s=top(), row=s.row; if(!row||num(row.q)<=0){ toast("Enter an amount above zero."); return; }
    if(s.target==="day"){ dayMut(s.date).meals.push(mealFromRow(row, s.slot, s.eaten)); queueSave("days/"+s.date); toast(`Added ${row.name}`); s.sel=null; s.row=null; s.q=""; render(); return; }
    ui.sheets.pop(); const l=top(); row.approx=false;
    if(s.rowIdx!=null){ const old=l.rows[s.rowIdx]; if(old&&old.line) row.line=old.line; l.rows[s.rowIdx]=row; }
    else { l.rows.push(row); if(s.missIdx!=null){ const m=l.misses.splice(s.missIdx,1)[0]; if(m) row.line=m.line; } }
    render(); },
  newFoodFromPick(){ pushSheet({type:"food", id:null, draft:{name:top().q||"", size:100, unit:"g", kcal:"", p:"", c:"", f:""}, fromPick:true}); },
  mealItem(b){ pushSheet({type:"mealItem", date:ui.date, id:b.dataset.id}); },
  eat(b){ const s=top(); const date=s&&s.type==="mealItem"?s.date:ui.date; const m=dayMut(date).meals.find(x=>x.id===b.dataset.id); if(!m) return; m.eaten=!m.eaten; queueSave("days/"+date); render(); },
  eatAll(){ dayMut(ui.date).meals.forEach(m=>m.eaten=true); queueSave("days/"+ui.date); render(); },
  mealSlot(b){ const s=top(); const m=dayMut(s.date).meals.find(x=>x.id===s.id); m.slot=b.dataset.v; queueSave("days/"+s.date); render(); },
  rmMeal(){ const s=top(); const d=dayMut(s.date); d.meals=d.meals.filter(x=>x.id!==s.id); queueSave("days/"+s.date); popSheet(); },
  copyMeals(){ pushSheet({type:"copyMeals", date:ui.date}); },
  doCopy(b){ const s=top(); const src=day(b.dataset.date).meals||[]; const d=dayMut(s.date);
    src.forEach(m=>d.meals.push({...clone(m), id:rid("m"), eaten:false})); queueSave("days/"+s.date); toast(`Copied ${src.length} items from ${fmtDate(b.dataset.date)}`); popSheet(); },
  closeSheet(){ popSheet(); },
  // library
  newFood(){ pushSheet({type:"food", id:null, draft:{name:"", size:100, unit:"g", kcal:"", p:"", c:"", f:""}}); },
  editFood(b){ const f=S.foods[b.dataset.id]; if(f.recipe){ openRecipe(f); return; } pushSheet({type:"food", id:f.id, draft:clone(f)}); },
  async saveFood(){ const s=top(), d=s.draft;
    if(!String(d.name||"").trim()){ toast("Give the food a name."); return; } if(num(d.size)<=0){ toast("Serving size needs to be above zero."); return; }
    const id=s.id||rid("f"); const body={ id, name:String(d.name).trim(), size:num(d.size), unit:d.unit||"g", kcal:num(d.kcal), p:num(d.p), c:num(d.c), f:num(d.f) };
    if(d.fibre!==""&&d.fibre!=null) body.fibre=num(d.fibre); if(d.sodium!==""&&d.sodium!=null) body.sodium=num(d.sodium);
    if(d.emoji) body.emoji=String(d.emoji).trim(); if(d.recipe) body.recipe=d.recipe;
    if(await saveDoc("foods/"+id, body)){ S.foods[id]=body; ui.sheets.pop(); const under=top();
      if(s.fromPick && under && under.type==="pick"){ const src=Ing.foodSource(body); under.sel=src.ref; under.src=src; under.row=Ing.makeRow(src); }
      toast("Food saved"); render(); } },
  async delFood(){ const s=top(), key="food:"+s.id; if(ui.confirm!==key){ ui.confirm=key; render(); return; }
    if(await delDoc("foods/"+s.id)){ delete S.foods[s.id]; popSheet(); toast("Food deleted"); } },
  newEx(){ pushSheet({type:"exercise", id:null, draft:{name:"", pattern:"push", muscles:[], equipment:[], sets:3, reps:"8-12", rest:90, notes:""}}); },
  editEx(b){ const e=S.ex[b.dataset.id]; pushSheet({type:"exercise", id:e.id, draft:clone(e)}); },
  draftSet(b){ top().draft[b.dataset.k]=b.dataset.v; render(); },
  draftEquip(b){ const d=top().draft; d.equipment=d.equipment||[]; const v=b.dataset.v; d.equipment=d.equipment.includes(v)?d.equipment.filter(x=>x!==v):[...d.equipment,v]; render(); },
  async saveEx(){ const s=top(), d=s.draft; if(!String(d.name||"").trim()){ toast("Give the exercise a name."); return; }
    const id=s.id||rid("x"); const muscles = d.musclesText!=null ? d.musclesText.split(",").map(x=>x.trim()).filter(Boolean) : (d.muscles||[]);
    const body={ id, name:String(d.name).trim(), pattern:d.pattern||"push", muscles, equipment:d.equipment||[], sets:num(d.sets)||3, reps:String(d.reps||""), rest:num(d.rest), notes:d.notes||"" };
    if(await saveDoc("exercises/"+id, body)){ S.ex[id]=body; ui.sheets.pop(); const under=top();
      if(s.fromPick){ if(under&&under.type==="exPick") ui.sheets.pop(); const w=top(); if(w&&w.type==="workout") addToWorkout(w, id); }
      toast("Exercise saved"); render(); } },
  async delEx(){ const s=top(), key="ex:"+s.id; if(ui.confirm!==key){ ui.confirm=key; render(); return; }
    if(await delDoc("exercises/"+s.id)){ delete S.ex[s.id]; popSheet(); toast("Exercise deleted. Past logs keep their sets."); } },
  newWorkout(){ pushSheet({type:"workout", id:null, draft:{name:"", tag:"push", items:[], notes:""}}); },
  editWorkout(b){ const w=S.wo[b.dataset.id]; pushSheet({type:"workout", id:w.id, draft:clone(w)}); },
  wMove(b){ const it=top().draft.items, i=+b.dataset.i, j=i+Number(b.dataset.n); if(j<0||j>=it.length) return; [it[i],it[j]]=[it[j],it[i]]; render(); },
  wDel(b){ top().draft.items.splice(+b.dataset.i,1); render(); },
  wAdd(){ const w=top(); pushSheet({type:"exPick", q:"", filter:["push","pull","legs"].includes(w.draft.tag)?w.draft.tag:"all"}); },
  xpFilter(b){ top().filter=b.dataset.v; render(); },
  openIdeas(){ ensureFull(); pushSheet({type:"ideas", q:"", cat:"all", date:ui.date}); },
  ideaCat(b){ top().cat=b.dataset.v; render(); },
  openIdea(b){ const m=(window.MEAL_IDEAS||[]).find(x=>x.id===b.dataset.id); if(!m) return; const saved=S.foods["f-"+m.id], s=top();
    if(saved){ openRecipe(saved, {date:s.date}); return; }
    const P=ideaParsed(m); openRecipe(null, {name:m.n, emoji:m.e, servings:m.s, rows:clone(P.rows), misses:clone(P.misses), method:m.m, saveId:"f-"+m.id, ideaId:m.id, date:s.date,
      slot:m.c==="Breakfast"?"breakfast":m.c==="Lunch"?"lunch":m.c==="Dinner"?"dinner":"snacks"}); },
  openLib(){ pushSheet({type:"exLib", q:"", group:"all", equip:"all", noBench:false, open:null}); },
  libToggle(b){ const s=top(); s.open=s.open===b.dataset.id?null:b.dataset.id; render(); },
  libGroup(b){ top().group=b.dataset.v; ui.confirm=null; render(); },
  libEquip(b){ top().equip=b.dataset.v; ui.confirm=null; render(); },
  libBench(){ const s=top(); s.noBench=!s.noBench; ui.confirm=null; render(); },
  libAdd(b){ const x=libFind(b.dataset.id); if(!x) return; Sync.put("exercises/"+x.id, libToExercise(x)); loadS(); toast(`Added ${x.n}`); render(); },
  libAddAll(){ const s=top(), fresh=libFilter(s,false).filter(x=>!S.ex[x.id]); if(!fresh.length) return;
    if(ui.confirm!=="liball"){ ui.confirm="liball"; render(); return; }
    ui.confirm=null; fresh.forEach(x=>Sync.put("exercises/"+x.id, libToExercise(x))); loadS(); toast(`Added ${fresh.length} exercises`); render(); },
  xpLib(b){ const x=libFind(b.dataset.id); if(!x) return; Sync.put("exercises/"+x.id, libToExercise(x)); loadS(); ui.sheets.pop(); const w=top(); addToWorkout(w, x.id); render(); },
  xpPick(b){ ui.sheets.pop(); const w=top(); addToWorkout(w, b.dataset.id); render(); },
  newExFromPick(){ const s=top(); pushSheet({type:"exercise", id:null, fromPick:true, draft:{name:s.q||"", pattern:s.filter!=="all"?s.filter:"push", muscles:[], equipment:[], sets:3, reps:"8-12", rest:90, notes:""}}); },
  async saveWorkout(){ const s=top(), d=s.draft; if(!String(d.name||"").trim()){ toast("Give the workout a name."); return; }
    const id=s.id||rid("w"); const body={ id, name:String(d.name).trim(), tag:d.tag||"other", notes:d.notes||"",
      items:(d.items||[]).map(it=>({ exId:it.exId, sets:num(it.sets)||0, reps:String(it.reps||""), weight:num(it.weight), rest:num(it.rest) })) };
    if(await saveDoc("workouts/"+id, body)){ S.wo[id]=body; popSheet(); toast("Workout saved"); } },
  async delWorkout(){ const s=top(), key="wo:"+s.id; if(ui.confirm!==key){ ui.confirm=key; render(); return; }
    if(await delDoc("workouts/"+s.id)){ delete S.wo[s.id]; popSheet(); toast("Workout deleted"); } }
};
function switchUnit(row, ni){ const o=row.units[row.u], n=row.units[ni]; if(!n) return;
  if(o&&o.g!=null&&n.g!=null&&num(row.q)>0){ const g=num(row.q)*o.g; row.q=r1(g/n.g); } else if(o&&n&&o.f&&n.f){ row.q=r1(num(row.q)*o.f/n.f); }
  row.u=ni; }
function addToWorkout(w, exId){ const e=S.ex[exId]; if(!e) return; w.draft.items=w.draft.items||[]; w.draft.items.push({ exId, sets:e.sets||3, reps:e.reps||"", weight:0, rest:e.rest||90 }); }

const IN = {
  listField(el, ev){ const s=top(); s[el.dataset.k]=el.value; if(el.dataset.rerender) render(); },
  listPaste(el){ top().paste=el.value; },
  listEaten(el){ top().eaten=el.checked; },
  rowQ(el){ const r=top().rows[+el.dataset.i]; r.q=el.value; r.approx=false; render(); },
  rowU(el, ev){ if(ev.type!=="change") return; const r=top().rows[+el.dataset.i]; switchUnit(r, +el.value); r.approx=false; render(); },
  pickRowQ(el){ const s=top(); s.row.q=el.value; const p=$("#pk-prev"); if(p) p.innerHTML=preview(Ing.rowMacros(s.row)); },
  pickRowU(el, ev){ if(ev.type!=="change") return; const s=top(); switchUnit(s.row, +el.value); render(); },
  setWorkout(el, ev){ if(ev.type!=="change") return; const d=dayMut(ui.date); if(el.value==="") delete d.workout; else d.workout=el.value; queueSave("days/"+ui.date); render(); },
  setVal(el){ const {ex,i,k}=el.dataset; const rows=ensureLog(ui.date,ex); rows[+i][k]=el.value.trim(); queueSave("days/"+ui.date); },
  split(el, ev){ if(ev.type!=="change") return; S.settings.split=S.settings.split||{}; S.settings.split[el.dataset.i]=el.value; queueSave("settings/main"); render(); },
  target(el, ev){ const v=num(el.value); if(v<0) return; S.settings.targets[el.dataset.k]=v; queueSave("settings/main"); if(ev.type==="change") render(); },
  exQ(el){ ui.exQ=el.value; render(); },
  foodQ(el){ ui.foodQ=el.value; render(); },
  pickQ(el){ top().q=el.value; render(); },
  pickEaten(el){ top().eaten=el.checked; },
  mealQty(el, ev){ const s=top(); const m=dayMut(s.date).meals.find(x=>x.id===s.id); if(!m) return; m.qty=num(el.value); $("#mi-prev").innerHTML=preview(macrosOf(m)); queueSave("days/"+s.date); if(ev.type==="change") render(); },
  draft(el){ const s=top(); s.draft[el.dataset.k]=el.value; if(s.type==="food"){ const c=$("#fd-check"); if(c) c.innerHTML=foodCheck(s.draft); } },
  witem(el){ top().draft.items[+el.dataset.i][el.dataset.k]=el.value; },
  xpQ(el){ top().q=el.value; render(); },
  ideaQ(el){ top().q=el.value; render(); },
  libQ(el){ top().q=el.value; ui.confirm=null; render(); }
};
document.addEventListener("click", ev=>{ const b=ev.target.closest("[data-act]"); if(!b||b.disabled) return; const f=A[b.dataset.act]; if(f){ ev.preventDefault(); f(b); } });
["input","change"].forEach(t=>document.addEventListener(t, ev=>{ const el=ev.target; const k=el.dataset&&el.dataset.in; if(k&&IN[k]){
  if(t==="change" && ["exQ","foodQ","pickQ","xpQ","libQ","ideaQ","setVal","pickRowQ","rowQ","listPaste","draft","witem","pickEaten","listEaten","genQ","genItem","genSwapQ","prof","liveVal","ckWeight","ckBody","runF","goalW","goalWaist"].includes(k)) return; IN[k](el, ev); } }));
document.addEventListener("submit", ev=>{
  if(ev.target.id!=="askform") return; ev.preventDefault();
  const el=$("#ask"), q=el.value.trim(); if(!q) { el.focus(); return; }
  el.value=""; el.blur(); $("#askgo").classList.remove("go"); ensureFull();
  const parts=Ing.splitMeal(q), l={type:"list", mode:"meal", text:q, rows:[], misses:[], date:ui.date, slot:guessSlot(), eaten:ui.date<=TODAY(), skipped:0};
  parseInto(l, parts);
  if(!l.rows.length || (parts.length===1 && l.rows[0].approx)) pushSheet({type:"pick", target:"day", date:ui.date, slot:l.slot, q, sel:null, row:null, eaten:l.eaten});
  else pushSheet(l);
});
document.addEventListener("input", ev=>{ if(ev.target.id==="ask") $("#askgo").classList.toggle("go", !!ev.target.value.trim()); });
document.addEventListener("keydown", ev=>{ if(ev.key==="Escape"&&top()) popSheet(); });

/* ---------- workout generator, live session, muscle map ---------- */
const GOAL_TXT={build:"Muscle building", strength:"Strength", condition:"Conditioning", light:"Light"};
const MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>';
const BODY_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="4.5" r="2.2"/><path d="M7 8.5h10l-1.5 6h-7zM9 14.5 8 21M15 14.5l1 6.5M7 8.5 4.5 14M17 8.5l2.5 5.5"/></svg>';
ui.gen = { text:"", minutes:null, muscles:[], feel:null };
ui.live = { restEnd:null, restTotal:0, beeped:true };
function exInfo(id){ return S.ex[id] || (libFind(id)?libToExercise(libFind(id)):null); }
function exCue(id){ const x=libFind(id); return x?x.c:((S.ex[id]||{}).notes||""); }
function profile(){ return S.settings.profile; }
function genInput(extra){ return Object.assign({ days:S.days, userEx:S.ex, today:ui.date, profile:profile(), favourites:S.settings.favEx||[], dislikes:S.settings.swapOut||{} }, extra||{}); }
function demoUrl(name){ return "https://www.youtube.com/results?search_query="+encodeURIComponent(name+" exercise how to"); }
function runGen(seed, text){
  const R=Coach.parse(text!=null?text:ui.gen.text, {muscles:ui.gen.muscles});
  if(!R.minutes) R.minutes=ui.gen.minutes||profile().typicalMin||45;
  const dc=day(ui.date).checkin||{}, checkin = (ui.gen.feel==="tired"||dc.energy==="low"||dc.sleep==="poor")?{energy:"low"}:null;
  const deload = !!(S.settings.deloadUntil && ui.date>=(S.settings.deloadFrom||"") && ui.date<=S.settings.deloadUntil);
  const g=Coach.generate(genInput({ request:R, checkin, deload, seed: seed || (ui.date+"|"+R.text+"|"+Date.now()) }));
  g.feel=ui.gen.feel; return g;
}
function genItemToWorkout(it){ return { exId:it.exId, sets:it.sets, reps:String(it.reps||""), weight:it.weight||0, rest:it.rest, rir:it.rir, aim:it.aim||it.note||"", last:it.last||null, timed:!!it.timed }; }
function genTarget(it){ return `${it.sets} × ${esc(it.reps)}${Number(it.weight)?` · ${n1(it.weight)} kg`:""}${it.rest?` · ${secs(it.rest)} rest`:""}${it.rir!=null&&it.rir!==""?` · RIR ${esc(it.rir)}`:""}`; }

/* Today: the coach card */
function coachCard(date){
  const d=day(date), g=d.workout==="gen"&&d.gen;
  const mins=ui.gen.minutes||profile().typicalMin||45;
  if(g){
    const prog=sessionProgress(date)||{done:0,total:0};
    return `<section class="card coach"><div class="card-h"><span class="label" style="flex:1">${g.finished?"Session done":"Your session"}</span><span class="pill ${prog.done&&prog.done>=prog.total?"done":""}">${prog.done}/${prog.total} sets</span></div>
      <div><div class="ctitle">${esc(g.title)}</div><div class="small muted">${(g.items||[]).length} exercises · about ${n0(g.est)} min${g.request?` · “${esc(g.request)}”`:""}</div></div>
      <div class="setbtns"><button class="btn primary" data-act="liveOpen">${g.finished?"Review":prog.done?"Continue":"Start"}</button><button class="btn" data-act="genEditSaved">Edit</button><span class="spacer"></span><button class="btn ghost" data-act="genNew">New session</button></div></section>`;
  }
  const sugg=Coach.suggestions(S.days, S.ex, date, profile()).slice(0,3);
  return `<section class="card coach" aria-label="Workout generator"><label class="ctitle" for="gen-q">What do you want to train today?</label>
    <form class="genq" id="genform" autocomplete="off" novalidate>
      <input id="gen-q" type="text" enterkeyhint="go" value="${esc(ui.gen.text)}" data-in="genQ" placeholder="e.g. chest and arms, 45 mins, sore legs">
      <button type="button" class="iconbtn" data-act="genMic" aria-label="Speak your request">${MIC}</button>
    </form>
    <div class="chips">${[30,45,60].map(m=>`<button class="chip ${mins===m?"on":""}" data-act="genMins" data-v="${m}">${m} min</button>`).join("")}
      <button class="chip ${ui.gen.muscles.length?"on":""}" data-act="bodyPick">${ui.gen.muscles.length?`${ui.gen.muscles.length} muscle${ui.gen.muscles.length===1?"":"s"}`:"Pick muscles"}</button>
      <button class="chip ${ui.gen.feel==="tired"?"on":""}" data-act="genFeel" data-v="tired">Feeling tired</button></div>
    ${ui.gen.muscles.length?`<div class="small muted">${esc(Coach.listNames(ui.gen.muscles))} <button class="btn ghost" data-act="genClearMuscles">Clear</button></div>`:""}
    <button class="btn primary block" data-act="genGo">Build my session</button>
    <div class="small muted">Or leave it blank and I'll pick what's most recovered: ${sugg.map(s=>`<button class="linkish" data-act="genSuggest" data-v="${esc(s.n)}">${esc(s.n)}</button>`).join(", ")}.</div></section>`;
}

/* session editor */
function renderGen(s){
  const g=s.session;
  let h=sheetHead(esc(g.title), `<button class="btn ghost" data-act="genRegen">New mix</button>`)+`<div class="sbody">
    <div class="small muted">${(g.items||[]).length} exercises · about ${n0(g.est)} min · ${esc(GOAL_TXT[g.goal]||"")}${g.request?` · “${esc(g.request)}”`:""}</div>`;
  if(g.safety) h+=`<div class="banner warnb">${esc(g.safety)}</div>`;
  for(const w of g.warnings||[]) h+=`<div class="banner warnb">${esc(w.text)}</div>`;
  if((g.warmup||[]).length) h+=`<details class="why"><summary>Warm-up · about 5 min</summary><ul>${g.warmup.map(w=>`<li><b>${esc(w.name)}</b> · ${esc(w.dose)}<br><span class="muted">${esc(w.cue||"")}</span></li>`).join("")}</ul></details>`;
  if((g.reasons||[]).length) h+=`<details class="why" ${s.whyOpen?"open":""}><summary>Why this session</summary><ul>${g.reasons.map(r=>`<li>${esc(r)}</li>`).join("")}</ul></details>`;
  h+=`<div class="glist">`;
  (g.items||[]).forEach((it,i)=>{ const open=s.edit===i;
    h+=`<div class="gitem ${open?"open":""}"><button class="gi-h" data-act="genToggle" data-i="${i}" aria-expanded="${open}"><span class="gi-n">${i+1}</span>
        <span class="main"><span class="fname">${esc(it.name)}</span><span class="tgt">${genTarget(it)}</span></span>${open?ICON.up:ICON.down}</button>
      ${it.aim||it.note?`<div class="gi-aim">${esc(it.aim||it.note)}</div>`:""}
      ${it.last?`<div class="small muted">Last ${fmtDate(it.last.date)} · <span class="num">${esc(it.last.text)}</span></div>`:""}`;
    if(open){
      h+=`<div class="grid4">
        <label class="field"><span class="label">Sets</span><input id="gi-${i}-sets" inputmode="numeric" value="${esc(it.sets)}" data-in="genItem" data-i="${i}" data-k="sets"></label>
        <label class="field"><span class="label">Reps</span><input id="gi-${i}-reps" value="${esc(it.reps)}" data-in="genItem" data-i="${i}" data-k="reps"></label>
        <label class="field"><span class="label">Kg</span><input id="gi-${i}-w" inputmode="decimal" value="${esc(it.weight||"")}" placeholder="–" data-in="genItem" data-i="${i}" data-k="weight"></label>
        <label class="field"><span class="label">Rest s</span><input id="gi-${i}-rest" inputmode="numeric" value="${esc(it.rest)}" data-in="genItem" data-i="${i}" data-k="rest"></label></div>
        ${it.cue?`<div class="small">${esc(it.cue)} <a href="${demoUrl(it.name)}" target="_blank" rel="noopener">Watch a demo</a></div>`:""}
        <div class="setbtns"><button class="btn" data-act="genSwap" data-i="${i}">Swap</button>
          <button class="iconbtn" data-act="genMove" data-i="${i}" data-n="-1" aria-label="Move up" ${i===0?"disabled":""}>${ICON.up}</button>
          <button class="iconbtn" data-act="genMove" data-i="${i}" data-n="1" aria-label="Move down" ${i===g.items.length-1?"disabled":""}>${ICON.down}</button>
          <span class="spacer"></span><button class="btn danger" data-act="genRm" data-i="${i}">Remove</button></div>`;
    }
    h+=`</div>`; });
  h+=`</div><button class="btn" data-act="genAdd">+ Add exercise</button>
    <div class="setbtns">${s.fromDay?`<button class="btn danger" data-act="genDiscard">${ui.confirm==="gendel"?"Tap again to remove":"Remove session"}</button>`:`<button class="btn" data-act="genSave">Save for ${ui.date===TODAY()?"today":fmtDate(s.date)}</button>`}<span class="spacer"></span>
      <button class="btn primary" data-act="genStart">${s.fromDay?"Save":"Start session"}</button></div>
    <div class="small muted">Weights come from what you've logged: up when you hit the top of the rep range, held when you didn't, and worked out from your estimated max when the rep range changes. Tap an exercise to change anything.</div></div>`;
  return h;
}
function renderGenSwap(s){
  const under=ui.sheets[ui.sheets.length-2], g=under.session, it=s.i!=null?g.items[s.i]:null, q=(s.q||"").toLowerCase().trim();
  let xs;
  if(it && !q) xs=Coach.alternatives(it.exId, g, genInput());
  else { const pool=[...Coach.pool(S.ex).values()].filter(x=>!g.items.some(i=>i.exId===x.id) && x.equip.every(e=>profile().equipment.includes(e)));
    xs=pool.filter(x=>!q||(x.name+" "+x.group+" "+x.pm.map(Coach.nameOf).join(" ")+" "+x.equip.join(" ")).toLowerCase().includes(q))
      .sort((a,b)=>(b.pm.some(m=>g.targets.includes(m))?1:0)-(a.pm.some(m=>g.targets.includes(m))?1:0)||a.name.localeCompare(b.name)).slice(0,40); }
  return sheetHead(it?`Swap ${esc(it.name)}`:"Add exercise")+`<div class="sbody">
    <input type="search" id="gs-q" placeholder="Search exercises or muscles" value="${esc(s.q||"")}" data-in="genSwapQ" autocomplete="off">
    ${it&&!q?`<div class="small muted">Same muscles, your equipment. Ones you've done before come first.</div>`:""}
    <div class="list">${xs.map(x=>`<button class="li" data-act="genSwapPick" data-id="${esc(x.id)}"><span class="main"><div class="nm">${esc(x.name)}</div><div class="sub">${esc(x.pm.map(Coach.nameOf).join(", "))} · ${esc(x.equip.join(", ")||"Bodyweight")}</div></span></button>`).join("")||`<div class="empty">Nothing matches.</div>`}</div></div>`;
}

/* body map */
const BODY={
  front:[["frontdelt","ellipse",31,44,6.5,7.5],["frontdelt","ellipse",69,44,6.5,7.5],["sidedelt","ellipse",24.5,48,3.6,7],["sidedelt","ellipse",75.5,48,3.6,7],
    ["chest","ellipse",42,49,8.5,8],["chest","ellipse",58,49,8.5,8],["biceps","ellipse",24,66,4.6,10],["biceps","ellipse",76,66,4.6,10],
    ["forearms","ellipse",21.5,90,4,11],["forearms","ellipse",78.5,90,4,11],["obliques","ellipse",37.5,76,4,12],["obliques","ellipse",62.5,76,4,12],
    ["abs","rect",43,59,14,34,5],["adductors","ellipse",47,116,3,11],["adductors","ellipse",53,116,3,11],
    ["quads","ellipse",40.5,128,7,21],["quads","ellipse",59.5,128,7,21],["calves","ellipse",41.5,170,5,14],["calves","ellipse",58.5,170,5,14]],
  back:[["traps","path","M50 29 L63 40 L50 54 L37 40Z"],["reardelt","ellipse",31,45,6.5,7],["reardelt","ellipse",69,45,6.5,7],
    ["triceps","ellipse",24,66,4.6,10],["triceps","ellipse",76,66,4.6,10],["forearms","ellipse",21.5,90,4,11],["forearms","ellipse",78.5,90,4,11],
    ["upperback","ellipse",50,57,11,6],["lats","ellipse",39,70,7,13],["lats","ellipse",61,70,7,13],["lowback","rect",44,79,12,15,4],
    ["glutes","ellipse",42,105,8.5,9],["glutes","ellipse",58,105,8.5,9],["hams","ellipse",41.5,132,7,18],["hams","ellipse",58.5,132,7,18],
    ["calves","ellipse",41.5,168,5.5,13],["calves","ellipse",58.5,168,5.5,13]]
};
function bodySvg(fill, sel){
  const shape=(p,dx)=>{ const [m,t]=p, a=`data-act="bodyTap" data-m="${m}" fill="${fill(m)}" class="mus ${sel.includes(m)?"sel":""}"`;
    if(t==="ellipse") return `<ellipse ${a} cx="${p[2]+dx}" cy="${p[3]}" rx="${p[4]}" ry="${p[5]}"/>`;
    if(t==="rect") return `<rect ${a} x="${p[2]+dx}" y="${p[3]}" width="${p[4]}" height="${p[5]}" rx="${p[6]}"/>`;
    return `<path ${a} transform="translate(${dx} 0)" d="${p[2]}"/>`; };
  const sil=dx=>`<g class="sil" transform="translate(${dx} 0)"><circle cx="50" cy="16" r="10"/><rect x="45" y="24" width="10" height="9" rx="3"/><rect x="30" y="34" width="40" height="64" rx="14"/>
    <rect x="17" y="40" width="13" height="64" rx="6.5"/><rect x="70" y="40" width="13" height="64" rx="6.5"/><rect x="32" y="92" width="36" height="22" rx="10"/>
    <rect x="32" y="104" width="16" height="84" rx="8"/><rect x="52" y="104" width="16" height="84" rx="8"/></g>`;
  return `<svg class="bodymap" viewBox="0 0 210 200" role="group" aria-label="Muscle map, front and back">${sil(0)}${BODY.front.map(p=>shape(p,0)).join("")}${sil(110)}${BODY.back.map(p=>shape(p,110)).join("")}
    <text x="50" y="198" text-anchor="middle">Front</text><text x="160" y="198" text-anchor="middle">Back</text></svg>`;
}
function weekFill(W){ return m=>{ const w=W[m]; if(!w||!w.sets) return "var(--sunk)"; const r=w.sets/w.range[0]; return r>=1? (w.sets>w.range[1]?"var(--warn)":"var(--accent)") : `color-mix(in srgb, var(--accent) ${Math.round(25+r*55)}%, var(--sunk))`; }; }
function renderBody(s){
  const W=Coach.weekly(S.days, S.ex, ui.date);
  const fill = m => s.sel.includes(m) ? "var(--ink)" : weekFill(W)(m);
  return sheetHead("Pick muscles")+`<div class="sbody"><div class="small muted">Tap the muscles you want to train. Colour shows sets in the last 7 days.</div>
    ${bodySvg(fill, s.sel)}
    <div class="chips">${Coach.ALL.map(m=>`<button class="chip ${s.sel.includes(m)?"on":""}" data-act="bodyTap" data-m="${m}">${esc(Coach.nameOf(m))}</button>`).join("")}</div>
    <div class="setbtns"><button class="btn" data-act="bodyClear">Clear</button><span class="spacer"></span><button class="btn primary" data-act="bodyDone">${s.sel.length?`Use ${s.sel.length} muscle${s.sel.length===1?"":"s"}`:"Done"}</button></div></div>`;
}

/* Train tab: muscles, PBs, equipment */
function vMuscles(){
  const W=Coach.weekly(S.days, S.ex, TODAY());
  let h=`<section class="card"><div class="card-h"><h2>Last 7 days</h2></div>${bodySvg(weekFill(W), [])}
    <div class="legend small muted"><span><i style="background:color-mix(in srgb, var(--accent) 40%, var(--sunk))"></i>Under</span><span><i style="background:var(--accent)"></i>In range</span><span><i style="background:var(--warn)"></i>Above</span></div>
    <div class="mlist">`;
  for(const m of Coach.ALL){ const w=W[m], [lo,hi]=w.range, pct=Math.min(100,w.sets/(hi*1.25)*100);
    h+=`<div class="mrow"><span class="nm">${esc(Coach.nameOf(m))}</span><span class="mbar"><i class="rng" style="left:${lo/(hi*1.25)*100}%;width:${(hi-lo)/(hi*1.25)*100}%"></i><i class="v ${w.sets>hi?"hi":""}" style="width:${pct}%"></i></span>
      <span class="num small">${n1(w.sets)}</span><span class="small muted mrec">${w.last?(w.rec<0.6?"recovering":"ready"):"–"}</span></div>`; }
  h+=`</div><div class="small muted">Sets count fully for the main muscles an exercise works and half for the muscles that help. The shaded band is a useful weekly range for building muscle; “recovering” means trained hard in roughly the last two days.</div></section>`;
  const PB=Coach.personalBests(S.days, S.ex, TODAY()), pool=Coach.pool(S.ex);
  const rows=Object.entries(PB).filter(([,p])=>p.bestE||p.bestReps).sort((a,b)=>(b[1].sessions-a[1].sessions)).slice(0,20);
  h+=`<section class="card"><div class="card-h"><h2>Personal bests</h2></div>${rows.length?`<div class="list">${rows.map(([id,p])=>`<div class="li"><span class="main"><div class="nm">${esc((pool.get(id)||{}).name||id)}</div><div class="sub">${p.sessions} session${p.sessions===1?"":"s"}${p.bestW?` · heaviest ${n1(p.bestW)} kg`:""}</div></span><span class="right" style="color:var(--ink)">${p.bestE?`${n1(p.bestE)} <span class="small muted">kg est. max</span>`:`${p.bestReps} <span class="small muted">reps</span>`}</span></div>`).join("")}</div>
    <div class="small muted">Estimated max uses the Epley formula, counting the reps you had left in reserve when you logged RIR.</div>`:`<div class="empty">Log a few sessions and your bests show up here.</div>`}</section>`;
  const P=profile();
  h+=`<section class="card"><div class="card-h"><h2>Your kit</h2></div><div class="small muted">The generator only picks exercises for kit you have, and won't suggest weights you can't load.</div>
    <div class="chips">${EQUIP.map(q=>`<button class="chip ${P.equipment.includes(q)?"on":""}" data-act="kitEquip" data-v="${q}">${q}</button>`).join("")}</div>
    <div class="grid4">
      <label class="field"><span class="label">Heaviest DB kg</span><input id="pf-db" inputmode="decimal" value="${esc(P.dbMax)}" data-in="prof" data-k="dbMax"></label>
      <label class="field"><span class="label">DB jumps kg</span><input id="pf-dbs" inputmode="decimal" value="${esc(P.dbStep)}" data-in="prof" data-k="dbStep"></label>
      <label class="field"><span class="label">Barbell max kg</span><input id="pf-bb" inputmode="decimal" value="${esc(P.bbMax)}" data-in="prof" data-k="bbMax"></label>
      <label class="field"><span class="label">Bar jumps kg</span><input id="pf-bbs" inputmode="decimal" value="${esc(P.bbStep)}" data-in="prof" data-k="bbStep"></label></div>
    <div class="field"><span class="label">Usual session length</span><div class="seg">${[30,45,60].map(m=>`<button class="${P.typicalMin===m?"on":""}" data-act="profMins" data-v="${m}">${m} min</button>`).join("")}</div></div></section>`;
  return h;
}

/* live session */
function liveItems(date){ const wf=workoutFor(date); return (wf.w&&wf.w.items)||[]; }
function liveTitle(date){ const d=day(date), wf=workoutFor(date); return d.workout==="gen"&&d.gen?d.gen.title:(wf.w?wf.w.name:"Workout"); }
function liveStart(date){ const d=dayMut(date); if(!d.live) { d.live={start:Date.now()}; queueSave("days/"+date); } return d.live; }
const mmss = ms => { const s=Math.max(0,Math.round(ms/1000)); const h=Math.floor(s/3600), m=Math.floor(s%3600/60); return (h?h+":"+pad(m):m)+":"+pad(s%60); };
function renderLive(s){
  const date=s.date, d=day(date), items=liveItems(date), lv=d.live||{start:Date.now()};
  if(!items.length) return sheetHead("Session")+`<div class="sbody"><div class="empty">No exercises in this session.</div></div>`;
  s.idx=Math.max(0,Math.min(items.length-1,s.idx||0));
  const it=items[s.idx], e=exInfo(it.exId)||{name:"Exercise"}, rows=(d.log||{})[it.exId]||Array.from({length:Number(it.sets)||0},()=>({w:"",r:"",rir:"",done:false}));
  const prog=sessionProgress(date)||{done:0,total:0}, last=lastPerf(it.exId,date), resting=ui.live.restEnd&&ui.live.restEnd>Date.now();
  const cue=exCue(it.exId), lib=libFind(it.exId);
  let h=sheetHead(esc(liveTitle(date)), `<span class="lvclock num" id="lv-clock">${lv.end?mmss(lv.end-lv.start):mmss(Date.now()-lv.start)}</span>`)+`<div class="sbody">`;
  h+=`<div class="restcard ${resting?"":"idle"}" id="lv-restcard"><div class="rc-row"><span class="label" style="flex:1">${resting?"Rest":"Rest timer"}</span><b class="num" id="lv-rest">${resting?mmss(ui.live.restEnd-Date.now()):"–"}</b></div>
      <div class="rbar"><i id="lv-restbar" style="width:${resting?Math.max(0,(ui.live.restEnd-Date.now())/(ui.live.restTotal*1000)*100):0}%"></i></div>
      <div class="setbtns">${resting?`<button class="btn" data-act="restAdd" data-n="-15">−15s</button><button class="btn" data-act="restAdd" data-n="30">+30s</button><span class="spacer"></span><button class="btn" data-act="restSkip">Skip</button>`
        :`<span class="small muted" style="flex:1">Starts when you tick a set</span><button class="btn" data-act="restStart">Start ${secs(it.rest||90)}</button>`}</div></div>`;
  if(d.gen&&(d.gen.warmup||[]).length&&!(prog.done)) h+=`<details class="why"><summary>Warm-up first · about 5 min</summary><ul>${d.gen.warmup.map(w=>`<li><b>${esc(w.name)}</b> · ${esc(w.dose)}<br><span class="muted">${esc(w.cue||"")}</span></li>`).join("")}</ul></details>`;
  h+=`<div class="lvdots" role="tablist">${items.map((x,i)=>{ const r=(d.log||{})[x.exId]||[], n=r.length||Number(x.sets)||0, dn=r.filter(y=>y.done).length;
      return `<button class="lvdot ${i===s.idx?"on":""} ${n&&dn>=n?"done":""}" data-act="liveGo" data-i="${i}" aria-label="Exercise ${i+1}: ${esc((exInfo(x.exId)||{}).name||"")}">${n&&dn>=n?ICON.check:i+1}</button>`; }).join("")}</div>`;
  h+=`<div class="card lvex"><div class="small muted">Exercise ${s.idx+1} of ${items.length} · ${prog.done}/${prog.total} sets done</div>
    <div class="ctitle">${esc(e.name)}</div><div class="tgt">${esc(tgtLine(it))}${it.rir!=null&&it.rir!==""?` · stop with ${esc(it.rir)} in reserve`:""}</div>
    ${it.aim?`<div class="gi-aim">${esc(it.aim)}</div>`:""}
    ${last?`<div class="small muted">Last ${fmtDate(last.date)} · <span class="num">${esc(setsText(last.rows))}</span></div>`:""}
    <details class="why"><summary>How to do it</summary><div class="small">${esc(cue||"No notes for this one yet.")}</div><a class="small" href="${demoUrl(e.name)}" target="_blank" rel="noopener">Watch a demo video</a></details>
    <div class="sets lv">`;
  rows.forEach((r,i)=>{
    h+=`<div class="setrow lv"><span class="n">${i+1}</span>
      <label class="unitwrap"><input id="lw-${i}" inputmode="decimal" autocomplete="off" placeholder="${Number(it.weight)?n1(it.weight):"–"}" value="${esc(r.w??"")}" data-in="liveVal" data-i="${i}" data-k="w" aria-label="Set ${i+1} weight"><span>kg</span></label>
      <label class="unitwrap"><input id="lr-${i}" inputmode="numeric" autocomplete="off" placeholder="${esc(firstRep(it.reps)||"–")}" value="${esc(r.r??"")}" data-in="liveVal" data-i="${i}" data-k="r" aria-label="Set ${i+1} reps"><span>reps</span></label>
      <select id="lx-${i}" data-in="liveRir" data-i="${i}" aria-label="Set ${i+1} reps in reserve" class="rir">${["","0","1","2","3","4"].map(v=>`<option value="${v}" ${String(r.rir??"")===v?"selected":""}>${v===""?"RIR":v==="4"?"4+":v}</option>`).join("")}</select>
      <button class="tick ${r.done?"on":""}" data-act="liveTick" data-i="${i}" aria-label="Mark set ${i+1} done" aria-pressed="${!!r.done}">${ICON.check}</button></div>`; });
  h+=`</div><div class="setbtns"><button class="btn ghost" data-act="liveAddSet">+ Set</button>${rows.length?`<button class="btn ghost" style="color:var(--muted)" data-act="liveRmSet">Remove last</button>`:""}<span class="spacer"></span>${d.workout==="gen"?`<button class="btn ghost" data-act="liveSwap">Swap</button>`:""}</div>
    <div class="small muted">RIR is how many more reps you could have done. It's optional, but it makes the next weight suggestion much better.</div></div>
    <div class="setbtns"><button class="btn" data-act="liveGo" data-i="${s.idx-1}" ${s.idx===0?"disabled":""}>${ICON.left} Previous</button><span class="spacer"></span>
      ${s.idx<items.length-1?`<button class="btn primary" data-act="liveGo" data-i="${s.idx+1}">Next ${ICON.right}</button>`:`<button class="btn primary" data-act="liveFinish">Finish workout</button>`}</div>
    ${s.idx<items.length-1?`<button class="btn block" data-act="liveFinish">Finish workout</button>`:""}</div>`;
  return h;
}
function sessionSummary(date){
  const d=day(date), items=liveItems(date), before=Coach.personalBests(S.days, S.ex, addDays(date,-1)), log=d.log||{};
  let sets=0, vol=0; const pbs=[];
  for(const it of items){ const rows=(log[it.exId]||[]).filter(r=>r.done); sets+=rows.length;
    let best=0, bestReps=0; rows.forEach(r=>{ vol+=num(r.w)*num(r.r); best=Math.max(best, Coach.e1rm(num(r.w), num(r.r), r.rir===""?null:num(r.rir))); if(!num(r.w)) bestReps=Math.max(bestReps,num(r.r)); });
    const p=before[it.exId], name=(exInfo(it.exId)||{}).name||"";
    if(best && p && p.bestE && best>p.bestE+0.4) pbs.push(`${name}: ${n1(best)} kg estimated max (was ${n1(p.bestE)})`);
    else if(bestReps && p && p.bestReps && bestReps>p.bestReps) pbs.push(`${name}: ${bestReps} reps (was ${p.bestReps})`); }
  return { sets, vol, pbs, mins: d.live&&d.live.end ? Math.round((d.live.end-d.live.start)/60000) : null };
}
function renderLiveDone(s){
  const x=sessionSummary(s.date);
  return sheetHead("Workout done")+`<div class="sbody"><div class="stats">
      <div class="stat"><div class="label">Time</div><div class="v">${x.mins!=null?x.mins:"–"}<span class="muted" style="font-size:16px"> min</span></div></div>
      <div class="stat"><div class="label">Sets</div><div class="v">${x.sets}</div></div>
      <div class="stat"><div class="label">Volume</div><div class="v">${n0(x.vol)}<span class="muted" style="font-size:16px"> kg</span></div></div></div>
    ${x.pbs.length?`<div class="card" style="gap:8px"><div class="label">New bests</div>${x.pbs.map(p=>`<div>🏆 ${esc(p)}</div>`).join("")}</div>`:`<div class="small muted">No new bests this time. The next session's weights are already worked out from what you logged.</div>`}
    <button class="btn primary block" data-act="closeAll">Done</button></div>`;
}
/* rest timer, beep, wake lock */
let audioCtx=null, wakeLock=null;
function unlockAudio(){ try{ audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==="suspended") audioCtx.resume(); }catch(e){} }
function beep(){ try{ unlockAudio(); const t=audioCtx.currentTime; [0,0.22,0.44].forEach((o,i)=>{ const os=audioCtx.createOscillator(), g=audioCtx.createGain(); os.frequency.value=i===2?1175:880; g.gain.setValueAtTime(0.0001,t+o); g.gain.exponentialRampToValueAtTime(0.35,t+o+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+o+0.18); os.connect(g).connect(audioCtx.destination); os.start(t+o); os.stop(t+o+0.2); }); }catch(e){} try{ navigator.vibrate&&navigator.vibrate([200,100,200]); }catch(e){} }
async function keepAwake(on){ try{ if(on&&!wakeLock&&navigator.wakeLock){ wakeLock=await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release",()=>{ wakeLock=null; }); } else if(!on&&wakeLock){ await wakeLock.release(); wakeLock=null; } }catch(e){} }
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible"&&top()&&top().type==="live") keepAwake(true); });
function startRest(sec){ ui.live.restTotal=sec; ui.live.restEnd=Date.now()+sec*1000; ui.live.beeped=false; }
setInterval(()=>{
  const s=top(); if(!s||s.type!=="live") return;
  const lv=day(s.date).live, c=$("#lv-clock"); if(c&&lv&&!lv.end) c.textContent=mmss(Date.now()-lv.start);
  if(ui.live.restEnd){ const left=ui.live.restEnd-Date.now(), r=$("#lv-rest"), b=$("#lv-restbar");
    if(left>0){ if(r) r.textContent=mmss(left); if(b) b.style.width=Math.max(0,left/(ui.live.restTotal*1000)*100)+"%"; }
    else if(!ui.live.beeped){ ui.live.beeped=true; ui.live.restEnd=null; beep(); toast("Rest done. Next set."); const a=document.activeElement; if(!a||!/INPUT|SELECT|TEXTAREA/.test(a.tagName)) render(); else { if(r) r.textContent="Go"; if(b) b.style.width="0%"; } } }
}, 500);
function startVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition, el=$("#gen-q");
  if(!SR){ if(el) el.focus(); toast("Tap the microphone on your keyboard to speak."); return; }
  try{ const rec=new SR(); rec.lang="en-GB"; rec.interimResults=true; rec.maxAlternatives=1;
    const btn=document.querySelector('[data-act="genMic"]'); if(btn) btn.classList.add("listening");
    rec.onresult=ev=>{ const t=[...ev.results].map(r=>r[0].transcript).join(" "); ui.gen.text=t; const e=$("#gen-q"); if(e) e.value=t; };
    rec.onerror=()=>{ toast("Couldn't hear that. You can type it, or use the keyboard mic."); };
    rec.onend=()=>{ const b=document.querySelector('[data-act="genMic"]'); if(b) b.classList.remove("listening"); if(ui.gen.text.trim()) A.genGo(); };
    rec.start(); }catch(e){ if(el) el.focus(); toast("Tap the microphone on your keyboard to speak."); }
}
function saveGenToDay(s){ const d=dayMut(s.date), g=clone(s.session);
  g.items=g.items.map(it=>Object.assign({}, it, genItemToWorkout(it), {name:it.name, cue:it.cue, pm:it.pm}));
  d.gen=g; d.workout="gen"; if(ui.gen.feel) d.checkin=Object.assign({}, d.checkin||{}, {energy:ui.gen.feel==="tired"?"low":"ok"});
  queueSave("days/"+s.date); }
function recalcEst(g){ g.est=Math.round(5+g.items.reduce((a,it)=>a+(num(it.sets)||0)*(0.75+(num(it.rest)||60)/60),0)); }

Object.assign(A, {
  genMins(b){ ui.gen.minutes=+b.dataset.v; render(); },
  genFeel(b){ ui.gen.feel=ui.gen.feel===b.dataset.v?null:b.dataset.v; render(); },
  genMic(){ unlockAudio(); startVoice(); },
  genClearMuscles(){ ui.gen.muscles=[]; render(); },
  genSuggest(b){ ui.gen.text=b.dataset.v; A.genGo(); },
  genGo(){ unlockAudio(); const el=$("#gen-q"); if(el) ui.gen.text=el.value; if(el) el.blur(); const g=runGen(); pushSheet({type:"gen", date:ui.date, session:g, edit:null, whyOpen:true}); },
  genNew(){ ui.gen.text=""; ui.gen.muscles=[]; pushSheet({type:"gen", date:ui.date, session:runGen(), edit:null, whyOpen:true, replacing:true}); },
  genEditSaved(){ const d=day(ui.date); if(!d.gen) return; pushSheet({type:"gen", date:ui.date, session:clone(d.gen), edit:null, fromDay:true}); },
  genRegen(){ const s=top(); const req=s.session.request; s.session=runGen(ui.date+"|"+Math.random(), s.fromDay?req:null); s.edit=null; toast("New mix of exercises"); render(); },
  genToggle(b){ const s=top(), i=+b.dataset.i; s.edit=s.edit===i?null:i; render(); },
  genMove(b){ const s=top(), it=s.session.items, i=+b.dataset.i, j=i+Number(b.dataset.n); if(j<0||j>=it.length) return; [it[i],it[j]]=[it[j],it[i]]; s.edit=j; render(); },
  genRm(b){ const s=top(); s.session.items.splice(+b.dataset.i,1); s.edit=null; recalcEst(s.session); render(); },
  genSwap(b){ pushSheet({type:"genSwap", i:+b.dataset.i, q:""}); },
  genAdd(){ pushSheet({type:"genSwap", i:null, q:""}); },
  genSwapPick(b){ const s=top(); ui.sheets.pop(); const g=top(), sess=g.session;
    const slot = s.i!=null ? s.i : sess.items.length;
    const it=Coach.prescribeSwap(b.dataset.id, s.i!=null?sess.items[s.i]:null, genInput({goal:sess.goal, slot}));
    if(s.i!=null){ const old=sess.items[s.i].exId; S.settings.swapOut=S.settings.swapOut||{}; S.settings.swapOut[old]=(S.settings.swapOut[old]||0)+1; queueSave("settings/main"); sess.items[s.i]=it; }
    else sess.items.push(it);
    recalcEst(sess); g.edit=null; render(); },
  genSave(){ const s=top(); saveGenToDay(s); ui.sheets=[]; toast("Session saved"); render(); },
  genStart(){ const s=top(); saveGenToDay(s); if(s.fromDay){ ui.sheets.pop(); toast("Session updated"); render(); return; } ui.sheets=[]; A.liveOpen(); },
  genDiscard(){ if(ui.confirm!=="gendel"){ ui.confirm="gendel"; render(); return; } const d=dayMut(top().date); delete d.gen; delete d.workout; queueSave("days/"+top().date); ui.sheets=[]; ui.confirm=null; toast("Session removed"); render(); },
  bodyPick(){ pushSheet({type:"body", sel:ui.gen.muscles.slice()}); },
  bodyTap(b){ const s=top(); if(!s||s.type!=="body") return; const m=b.dataset.m; s.sel=s.sel.includes(m)?s.sel.filter(x=>x!==m):[...s.sel,m]; render(); },
  bodyClear(){ top().sel=[]; render(); },
  bodyDone(){ ui.gen.muscles=top().sel.slice(); popSheet(); },
  kitEquip(b){ const P=profile(), v=b.dataset.v; P.equipment=P.equipment.includes(v)?P.equipment.filter(x=>x!==v):[...P.equipment,v]; queueSave("settings/main"); render(); },
  profMins(b){ profile().typicalMin=+b.dataset.v; queueSave("settings/main"); render(); },
  liveOpen(){ unlockAudio(); const date=ui.date; if(!liveItems(date).length){ toast("Pick a workout for this day first."); return; } liveStart(date);
    const items=liveItems(date), d=day(date); let idx=items.findIndex(it=>{ const r=(d.log||{})[it.exId]; return !r||r.some(x=>!x.done)||r.length<(Number(it.sets)||0); });
    pushSheet({type:"live", date, idx:idx<0?0:idx}); keepAwake(true); },
  liveGo(b){ const s=top(); s.idx=+b.dataset.i; render(); const p=$("#panel"); if(p) p.scrollTop=0; },
  liveTick(b){ unlockAudio(); const s=top(), it=liveItems(s.date)[s.idx], rows=ensureLog(s.date, it.exId), r=rows[+b.dataset.i];
    if(!r.done){ if(r.w===""&&Number(it.weight)) r.w=String(it.weight); if(r.r==="") r.r=firstRep(it.reps); }
    r.done=!r.done; queueSave("days/"+s.date);
    if(r.done){ const left=rows.filter(x=>!x.done).length; const items=liveItems(s.date);
      if(left===0 && s.idx<items.length-1){ startRest(Math.max(60, Number(it.rest)||90)); toast("Exercise done. Rest, then next."); s.idx++; }
      else if(left>0 || s.idx<items.length-1) startRest(Number(it.rest)||90); }
    render(); },
  liveAddSet(){ const s=top(), it=liveItems(s.date)[s.idx], rows=ensureLog(s.date,it.exId), prev=rows[rows.length-1]; rows.push({w:prev?prev.w:"",r:"",rir:"",done:false}); queueSave("days/"+s.date); render(); },
  liveRmSet(){ const s=top(), it=liveItems(s.date)[s.idx], rows=ensureLog(s.date,it.exId); rows.pop(); queueSave("days/"+s.date); render(); },
  liveSwap(){ const s=top(), d=day(s.date); if(!d.gen) return; pushSheet({type:"gen", date:s.date, session:clone(d.gen), edit:s.idx, fromDay:true}); },
  restStart(){ const s=top(), it=liveItems(s.date)[s.idx]; unlockAudio(); startRest(Number(it.rest)||90); render(); },
  restAdd(b){ if(!ui.live.restEnd) return; ui.live.restEnd+=Number(b.dataset.n)*1000; ui.live.restTotal=Math.max(ui.live.restTotal,(ui.live.restEnd-Date.now())/1000); render(); },
  restSkip(){ ui.live.restEnd=null; ui.live.beeped=true; render(); },
  liveFinish(){ const s=top(), d=dayMut(s.date); d.live=d.live||{start:Date.now()}; d.live.end=d.live.end||Date.now(); if(d.gen) d.gen.finished=Date.now();
    queueSave("days/"+s.date); ui.live.restEnd=null; keepAwake(false); ui.sheets[ui.sheets.length-1]={type:"liveDone", date:s.date}; render(); },
  closeAll(){ ui.sheets=[]; keepAwake(false); render(); }
});
Object.assign(IN, {
  genQ(el){ ui.gen.text=el.value; },
  genItem(el){ const s=top(), it=s.session.items[+el.dataset.i], k=el.dataset.k; it[k]= k==="reps"?el.value: el.value===""?"":num(el.value); if(k==="sets"||k==="rest") recalcEst(s.session); },
  genSwapQ(el){ top().q=el.value; render(); },
  prof(el){ const v=num(el.value); if(v>0){ profile()[el.dataset.k]=v; queueSave("settings/main"); } },
  liveVal(el){ const s=top(), it=liveItems(s.date)[s.idx], rows=ensureLog(s.date,it.exId); rows[+el.dataset.i][el.dataset.k]=el.value.trim(); queueSave("days/"+s.date); },
  liveRir(el, ev){ if(ev.type!=="change") return; const s=top(), it=liveItems(s.date)[s.idx], rows=ensureLog(s.date,it.exId); rows[+el.dataset.i].rir=el.value; queueSave("days/"+s.date); }
});
document.addEventListener("submit", ev=>{ if(ev.target.id!=="genform") return; ev.preventDefault(); A.genGo(); });

/* ---------- check-ins, progress dashboard, weekly review ---------- */
ICON.progress='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3.5 19.5h17"/><path d="M5 15.5l4.5-4.5 3.5 3 6-7"/><circle cx="19" cy="7" r="1.4" fill="currentColor"/></svg>';
const LB=0.45359237;
const P_ = () => S.settings.profile;
const stMode = () => (P_().wUnit||"st")==="st";
function fmtW(kg, short){ if(!(kg>0)) return "–"; if(!stMode()) return (Math.round(kg*10)/10).toFixed(1)+(short?"":" kg");
  const lb=kg/LB, st=Math.floor(lb/14), r=Math.round((lb-st*14)*10)/10; return r>=14 ? (st+1)+(short?"st 0":" st 0 lb") : st+(short?"st ":" st ")+(r%1?r.toFixed(1):r)+(short?"":" lb"); }
function fmtDW(kg){ if(!stMode()) return (kg>0?"+":kg<0?"−":"")+Math.abs(Math.round(kg*10)/10).toFixed(1)+" kg"; const lb=kg/LB; return (lb>0?"+":lb<0?"−":"")+Math.abs(Math.round(lb*10)/10).toFixed(1)+" lb"; }
const wUnitVal = kg => stMode()? kg/LB : kg; // chart units: lb or kg
const wAxis = v => stMode()? fmtW(v*LB,true) : (Math.round(v*10)/10).toString();
ui.prRange = lsGet("rp-prr","3M"); ui.revWeek = null; ui.lift = null; ui.photos = null;

/* charts: small SVGs with tap-to-read tooltips */
const CH = {};
function niceTicks(lo, hi, n){ const span=Math.max(hi-lo,1e-9), raw=span/n, mag=Math.pow(10,Math.floor(Math.log10(raw))); const step=[1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw)||10*mag;
  const out=[]; for(let v=Math.ceil(lo/step)*step; v<=hi+1e-9; v+=step) out.push(Math.round(v*1000)/1000); return out; }
const pd2 = s => parse(s).getTime();
function chartLine(o){
  // o: {id, series:[{pts:[{d,y}], kind:'line'|'dots'|'dash', cls}], from, to, fmt, target:{y,label}, tips:[{d,t}]}
  const W=340,H=170,L=44,R=10,T=12,B=22, all=o.series.flatMap(s=>s.pts.map(p=>p.y)).concat(o.target?[o.target.y]:[]);
  if(!all.length) return `<div class="empty">Nothing logged in this period yet.</div>`;
  let lo=Math.min(...all), hi=Math.max(...all); const padY=(hi-lo)*0.12||Math.max(0.5,Math.abs(hi)*0.02); lo-=padY; hi+=padY;
  const firstD=o.series.flatMap(s=>s.pts.map(p=>p.d)).sort()[0]; if(firstD&&firstD>o.from) o.from=firstD;
  const t0=pd2(o.from), t1=Math.max(pd2(o.to), t0+86400000), X=d=>L+(pd2(d)-t0)/(t1-t0)*(W-L-R), Y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
  const ticks=niceTicks(lo,hi,3);
  let g=ticks.map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${L-6}" y="${Y(v)+3.5}" text-anchor="end">${esc((o.fmt||String)(v))}</text>`).join("");
  const mid=addDays(o.from, Math.round((t1-t0)/86400000/2));
  g+=[o.from, mid, o.to].map((d,i)=>`<text x="${X(d)}" y="${H-6}" text-anchor="${["start","middle","end"][i]}">${parse(d).getDate()} ${MON[parse(d).getMonth()]}</text>`).join("");
  if(o.target) g+=`<line x1="${L}" x2="${W-R}" y1="${Y(o.target.y)}" y2="${Y(o.target.y)}" class="tgt"/><text x="${W-R}" y="${Y(o.target.y)-4}" text-anchor="end" class="tl">${esc(o.target.label)}</text>`;
  for(const s of o.series){ if(!s.pts.length) continue;
    if(s.kind==="dots") g+=s.pts.map(p=>`<circle cx="${X(p.d)}" cy="${Y(p.y)}" r="${s.r||2.6}" class="${s.cls||"dot"}"/>`).join("");
    else { const dd=s.pts.map((p,i)=>(i?"L":"M")+X(p.d).toFixed(1)+" "+Y(p.y).toFixed(1)).join(" "); g+=`<path d="${dd}" class="${s.cls||"ln"} ${s.kind==="dash"?"dash":""}"/>`;
      if(s.pts.length===1||s.endDot) { const p=s.pts[s.pts.length-1]; g+=`<circle cx="${X(p.d)}" cy="${Y(p.y)}" r="4" class="${s.cls||"ln"}-end"/>`; } } }
  CH[o.id]={ kind:"line", L, R, W, t0, t1, tips:(o.tips||[]).map(t=>({x:X(t.d), t:t.t})) };
  return `<div class="chart"><div class="ctip" id="${o.id}-tip" aria-live="polite">${esc(o.hint||"Tap the chart to read a value")}</div><svg class="ch" viewBox="0 0 ${W} ${H}" data-chart="${o.id}" role="img" aria-label="${esc(o.label||"")}">${g}<line class="rule" id="${o.id}-rule" x1="0" x2="0" y1="${T}" y2="${H-B}" style="opacity:0"/></svg></div>`;
}
function chartBars(o){
  // o: {id, bars:[{label, v, tip}], target:{y,label}, fmt}
  const W=340,H=150,L=40,R=8,T=12,B=22, vals=o.bars.map(b=>b.v||0).concat(o.target?[o.target.y]:[]);
  if(!o.bars.some(b=>b.v)) return `<div class="empty">Nothing logged in this period yet.</div>`;
  { const f=o.bars.findIndex(b=>b.v); o.bars=o.bars.slice(Math.max(0,Math.min(f,o.bars.length-4))); }
  const hi=Math.max(...vals)*1.12||1, n=o.bars.length, bw=(W-L-R)/n, Y=v=>T+(hi-v)/hi*(H-T-B);
  let g=niceTicks(0,hi,3).map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${L-6}" y="${Y(v)+3.5}" text-anchor="end">${esc((o.fmt||n0)(v))}</text>`).join("");
  o.bars.forEach((b,i)=>{ const x=L+i*bw+2, w=Math.max(2,bw-4), y=Y(b.v||0), h=Math.max(0,H-B-y);
    if(b.v) g+=`<path class="bar ${b.cls||""}" d="M${x} ${H-B}V${y+Math.min(4,h)}Q${x} ${y} ${x+Math.min(4,w/2)} ${y}H${x+w-Math.min(4,w/2)}Q${x+w} ${y} ${x+w} ${y+Math.min(4,h)}V${H-B}Z"/>`;
    if(i%Math.ceil(n/6)===0||i===n-1) g+=`<text x="${x+w/2}" y="${H-6}" text-anchor="middle">${esc(b.label)}</text>`; });
  if(o.target) g+=`<line x1="${L}" x2="${W-R}" y1="${Y(o.target.y)}" y2="${Y(o.target.y)}" class="tgt"/><text x="${W-R}" y="${Y(o.target.y)-4}" text-anchor="end" class="tl">${esc(o.target.label)}</text>`;
  CH[o.id]={ kind:"bar", L, R, W, n, bw, tips:o.bars.map(b=>b.tip) };
  return `<div class="chart"><div class="ctip" id="${o.id}-tip" aria-live="polite">${esc(o.hint||"Tap a bar to read it")}</div><svg class="ch" viewBox="0 0 ${W} ${H}" data-chart="${o.id}" role="img" aria-label="${esc(o.label||"")}">${g}<line class="rule" id="${o.id}-rule" x1="0" x2="0" y1="${T}" y2="${H-B}" style="opacity:0"/></svg></div>`;
}
function chartPoint(ev){
  const svg=ev.target.closest&&ev.target.closest("svg.ch"); if(!svg) return; const c=CH[svg.dataset.chart]; if(!c) return;
  const r=svg.getBoundingClientRect(), x=(ev.clientX-r.left)/r.width*c.W; let tip=null, rx=null;
  if(c.kind==="bar"){ const i=Math.max(0,Math.min(c.n-1,Math.floor((x-c.L)/c.bw))); tip=c.tips[i]; rx=c.L+i*c.bw+c.bw/2; }
  else if(c.tips.length){ let best=c.tips[0]; for(const t of c.tips) if(Math.abs(t.x-x)<Math.abs(best.x-x)) best=t; tip=best.t; rx=best.x; }
  const te=document.getElementById(svg.dataset.chart+"-tip"), ru=document.getElementById(svg.dataset.chart+"-rule");
  if(te&&tip) te.textContent=tip; if(ru&&rx!=null){ ru.setAttribute("x1",rx); ru.setAttribute("x2",rx); ru.style.opacity=1; }
}
document.addEventListener("pointerdown", chartPoint); document.addEventListener("pointermove", ev=>{ if(ev.buttons||ev.pointerType==="mouse") chartPoint(ev); });

/* Today: quick check-in strip */
function checkinStrip(date){
  if(date>TODAY()) return "";
  const d=day(date), b=d.body||{}, c=d.checkin||{}, runs=d.runs||[], km=runs.reduce((a,r)=>a+num(r.km),0);
  const ch=(f,lab,val)=>`<button class="ckchip ${val?"on":""}" data-act="ckOpen" data-f="${f}"><span class="label">${lab}</span><b>${val||"Add"}</b></button>`;
  return `<section class="ckstrip" aria-label="Daily check-in">${ch("weight","Weight",b.weight?fmtW(b.weight,true):"")}${ch("waist","Waist",b.waist?n1(b.waist)+" cm":"")}${ch("feel","How you feel",c.sleep||c.energy?[c.sleep&&{poor:"Poor",ok:"OK",good:"Good"}[c.sleep],c.energy&&{low:"Low",ok:"OK",high:"High"}[c.energy]].filter(Boolean).join(" · "):"")}${ch("run","Run",runs.length?n1(km)+" km":"")}</section>`;
}
function renderCheckin(s){
  const d=day(s.date), b=d.body||{}, c=d.checkin||{};
  let wIn;
  if(stMode()){ const lb=b.weight?b.weight/LB:null, st=lb?Math.floor(lb/14):"", r=lb?Math.round((lb-st*14)*10)/10:"";
    wIn=`<div class="grid2"><label class="field"><span class="label">Stone</span><input id="ck-st" inputmode="numeric" value="${esc(st)}" data-in="ckWeight" placeholder="12"></label><label class="field"><span class="label">Pounds</span><input id="ck-lb" inputmode="decimal" value="${esc(r)}" data-in="ckWeight" placeholder="6"></label></div>`; }
  else wIn=`<label class="field"><span class="label">Kg</span><input id="ck-kg" inputmode="decimal" value="${esc(b.weight?Math.round(b.weight*10)/10:"")}" data-in="ckWeight" placeholder="79.0"></label>`;
  const seg=(k,opts)=>`<div class="seg">${opts.map(([v,l])=>`<button class="${c[k]===v?"on":""}" data-act="ckSet" data-k="${k}" data-v="${v}">${l}</button>`).join("")}</div>`;
  return sheetHead(`Check-in · ${esc(fmtDate(s.date))}`)+`<div class="sbody">
    <div class="field"><span class="label">Body weight <button class="linkish" data-act="ckUnit">${stMode()?"use kg":"use st/lb"}</button></span>${wIn}
      <span class="small muted">Weigh in most mornings, after the loo and before food. Day-to-day changes are mostly water; the trend line is what counts.</span></div>
    <div class="grid2"><label class="field"><span class="label">Waist cm</span><input id="ck-waist" inputmode="decimal" value="${esc(b.waist||"")}" data-in="ckBody" data-k="waist" placeholder="at the navel"></label>
      <label class="field"><span class="label">Body fat % (measured)</span><input id="ck-bf" inputmode="decimal" value="${esc(b.bf||"")}" data-in="ckBody" data-k="bf" placeholder="optional"></label></div>
    <div class="small muted">Only enter body fat from an actual measurement (a scan, callipers or smart scales) and treat smart-scale numbers loosely. The app's own estimate comes from your waist and is labelled as an estimate.</div>
    <div class="field"><span class="label">Sleep last night</span>${seg("sleep",[["poor","Poor"],["ok","OK"],["good","Good"]])}</div>
    <div class="field"><span class="label">Energy</span>${seg("energy",[["low","Low"],["ok","OK"],["high","High"]])}</div>
    <button class="btn primary block" data-act="closeSheet">Done</button></div>`;
}
function renderRun(s){
  const d=day(s.date), runs=d.runs||[], f=s.f;
  const pace = (km,min)=> km>0&&min>0 ? (()=>{ const p=min/km; return Math.floor(p)+":"+pad(Math.round((p%1)*60))+" /km"; })() : "";
  return sheetHead(`Runs · ${esc(fmtDate(s.date))}`)+`<div class="sbody">
    ${runs.length?`<div class="list">${runs.map((r,i)=>`<div class="li"><span class="main"><div class="nm">${n1(r.km)} km · ${esc(r.type||"easy")}</div><div class="sub">${r.min?`${n0(r.min)} min · ${pace(num(r.km),num(r.min))}`:""}${r.rpe?` · effort ${esc(r.rpe)}/10`:""}</div></span><button class="btn ghost danger" data-act="runDel" data-i="${i}">Remove</button></div>`).join("")}</div>`:""}
    <div class="grid2"><label class="field"><span class="label">Distance km</span><input id="rn-km" inputmode="decimal" value="${esc(f.km)}" data-in="runF" data-k="km" placeholder="5"></label>
      <label class="field"><span class="label">Time minutes</span><input id="rn-min" inputmode="decimal" value="${esc(f.min)}" data-in="runF" data-k="min" placeholder="28"></label></div>
    <div class="field"><span class="label">Type</span><div class="seg">${["easy","long","tempo","intervals"].map(t=>`<button class="${f.type===t?"on":""}" data-act="runType" data-v="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join("")}</div></div>
    <div class="field"><span class="label">How hard (1–10, optional)</span><input id="rn-rpe" inputmode="numeric" value="${esc(f.rpe)}" data-in="runF" data-k="rpe" placeholder="6"></div>
    <div class="small muted">Hard runs count towards leg fatigue in the workout generator, so it won't stack a heavy leg session on top.</div>
    <button class="btn primary block" data-act="runSave">Save run</button></div>`;
}

/* Progress tab */
const RANGES=[["1M",30],["3M",91],["6M",182],["1Y",365],["All",null]];
function vProgress(){
  const today=TODAY(), log=Progress.bodyLog(S.days), tr=Progress.trend(log), rd=(RANGES.find(r=>r[0]===ui.prRange)||RANGES[1])[1];
  const first=Object.keys(S.days).sort()[0]||today, from=rd?addDays(today,-rd+1):(first<today?first:addDays(today,-30)), G=S.settings.goal||{}, T=S.settings.targets;
  let h=head({ eyebrow:"Trends, goals and your weekly check-in", title:"Progress" })+`<div class="stack">
    <div class="seg" role="tablist" aria-label="Date range">${RANGES.map(([k])=>`<button class="${ui.prRange===k?"on":""}" data-act="prRange" data-v="${k}">${k}</button>`).join("")}</div>`;
  h+=reviewCard();
  h+=goalCard(log, tr);
  // weight
  const trR=tr.filter(p=>p.date>=from), R=Progress.rate(log, today, 21);
  const nowT=tr.length?tr[tr.length-1].trend:null, startT=trR.length?trR[0].trend:null;
  h+=`<section class="card"><div class="card-h"><h2>Body weight</h2><span class="spacer"></span><button class="btn ghost" data-act="ckOpen" data-f="weight">+ Weigh-in</button></div>
    <div class="stats"><div class="stat"><div class="label">Trend now</div><div class="v sm">${nowT?fmtW(nowT,true):"–"}</div></div>
      <div class="stat"><div class="label">Change (${esc(ui.prRange)})</div><div class="v sm">${nowT&&startT&&trR.length>1?fmtDW(nowT-startT):"–"}</div></div>
      <div class="stat"><div class="label">Per week</div><div class="v sm">${R.ok?fmtDW(R.perWeek):"–"}</div></div></div>`;
  if(trR.length){
    h+=chartLine({ id:"cw", label:"Body weight and trend", from, to:today, fmt:wAxis,
      series:[{pts:trR.map(p=>({d:p.date,y:wUnitVal(p.weight)})), kind:"dots", cls:"dot"},{pts:trR.map(p=>({d:p.date,y:wUnitVal(p.trend)})), kind:"line", cls:"ln", endDot:true}],
      target: G.weight>0 && Math.abs(wUnitVal(G.weight)-wUnitVal(nowT||G.weight)) < (stMode()?30:14) ? {y:wUnitVal(G.weight), label:"Goal "+fmtW(G.weight,true)} : null,
      tips:trR.map(p=>({d:p.date, t:`${fmtDate(p.date)}: ${fmtW(p.weight)} · trend ${fmtW(p.trend)}`})) });
    h+=`<div class="legend small muted"><span><i class="lg-dot"></i>Daily weigh-in</span><span><i class="lg-line"></i>Trend</span>${G.weight>0?`<span><i class="lg-dash"></i>Goal</span>`:""}</div>
      <div class="small muted">${R.ok?`The trend smooths out water and food swings (each weigh-in moves it 10%). Weekly rate is a straight line through ${R.n} weigh-ins over ${R.span} days.`:`Rate needs more data: ${esc(R.why)}.`}</div>`;
  } else h+=`<div class="empty">No weigh-ins yet. Tap “+ Weigh-in” or the Weight chip on Today.</div>`;
  h+=`</section>`;
  h+=weeklyTable(log);
  // waist & composition
  const wa=log.filter(x=>x.waist>0&&x.date>=from), bfm=log.filter(x=>x.bf>0&&x.date>=from), Hc=P_().heightCm;
  h+=`<section class="card"><div class="card-h"><h2>Waist and body fat</h2><span class="spacer"></span><button class="btn ghost" data-act="ckOpen" data-f="waist">+ Measure</button></div>`;
  if(wa.length){ const last=wa[wa.length-1], firstW=wa[0];
    h+=`<div class="stats"><div class="stat"><div class="label">Waist</div><div class="v sm">${n1(last.waist)} cm</div></div><div class="stat"><div class="label">Change</div><div class="v sm">${wa.length>1?(last.waist-firstW.waist>0?"+":"")+n1(last.waist-firstW.waist)+" cm":"–"}</div></div>
      <div class="stat"><div class="label">Est. body fat</div><div class="v sm">${Hc?n1(Progress.rfm(Hc,last.waist))+"%":"–"}</div></div></div>`;
    h+=chartLine({ id:"cwa", label:"Waist measurements", from, to:today, fmt:v=>n1(v), series:[{pts:wa.map(x=>({d:x.date,y:x.waist})), kind:"line", cls:"ln2", endDot:true},{pts:wa.map(x=>({d:x.date,y:x.waist})), kind:"dots", cls:"dot2", r:3.2}],
      target: G.waist>0?{y:G.waist,label:"Goal "+n1(G.waist)+" cm"}:null, tips:wa.map(x=>({d:x.date,t:`${fmtDate(x.date)}: ${n1(x.waist)} cm`})) });
    if(Hc){ const est=wa.map(x=>({d:x.date,y:Progress.rfm(Hc,x.waist)}));
      h+=`<div class="label" style="margin-top:6px">Body fat %: estimated vs measured</div>`+chartLine({ id:"cbf", label:"Estimated and measured body fat", from, to:today, fmt:v=>n1(v)+"%",
        series:[{pts:est, kind:"dash", cls:"est"},{pts:bfm.map(x=>({d:x.date,y:x.bf})), kind:"dots", cls:"meas", r:4}],
        tips:est.map(p=>({d:p.d,t:`${fmtDate(p.d)}: estimate ${n1(p.y)}%`})).concat(bfm.map(x=>({d:x.date,t:`${fmtDate(x.date)}: measured ${n1(x.bf)}%`}))) });
      const lw=Progress.lastOf(log,"weight"), e=Progress.rfm(Hc,last.waist);
      h+=`<div class="legend small muted"><span><i class="lg-dash est"></i>Estimate (from waist)</span><span><i class="lg-dot meas"></i>Measured</span></div>
        <div class="small muted">The estimate uses the relative fat mass formula (64 − 20 × height ÷ waist, for men): about ±4% for an individual, so watch its direction rather than the exact number.${lw?` At ${fmtW(lw.weight)} that's roughly ${n1(lw.weight*e/100)} kg of fat and ${n1(lw.weight*(1-e/100))} kg lean mass (estimated).`:""}</div>`; }
  } else h+=`<div class="empty">No waist measurements yet. Once a week, at the navel, relaxed.</div>`;
  h+=`</section>`;
  h+=strengthCard(from, today)+trainingCard(today)+runningCard(today)+nutritionCard(today)+photosCard()+dataCard();
  return h+`</div>`;
}
function reviewCard(){
  const today=TODAY(), wk=ui.revWeek||addDays(monday(today),-7), r=Progress.review({ days:S.days, settings:S.settings, weekStart:wk, today, userEx:S.ex });
  const ic={good:ICON.check, warn:"!", act:"→", info:"i"};
  const lbl=wk===monday(today)?"This week so far":wk===addDays(monday(today),-7)?"Last week":"Week of "+fmtDate(wk).slice(4);
  let h=`<section class="card review"><div class="card-h"><button class="iconbtn" data-act="revWeek" data-n="-7" aria-label="Previous week">${ICON.left}</button>
    <div style="flex:1;text-align:center"><div class="label">Weekly check-in</div><h2>${esc(lbl)}</h2><div class="small muted">${fmtDate(wk).slice(4)} – ${fmtDate(addDays(wk,6)).slice(4)}</div></div>
    <button class="iconbtn" data-act="revWeek" data-n="7" aria-label="Next week" ${wk>=monday(today)?"disabled":""}>${ICON.right}</button></div><div class="rlist">`;
  for(const it of r.items){
    h+=`<div class="ritem ${it.tone}"><span class="rico" aria-hidden="true">${ic[it.tone]||"i"}</span><div class="rbody"><div class="label">${esc(it.area)}<span class="sr"> (${({good:"on track",warn:"needs attention",act:"suggested change",info:"note"})[it.tone]||""})</span></div><div>${esc(it.text)}</div>
      ${it.calc?`<details><summary>How I worked this out</summary><div class="small muted">${esc(it.calc)}</div></details>`:""}
      ${it.action&&it.action.type==="kcal"?`<div class="setbtns"><button class="btn primary" data-act="prApplyKcal" data-v="${it.action.to}">Set calories to ${n0(it.action.to)}</button></div>`:""}
      ${it.action&&it.action.type==="deload"?`<div class="setbtns"><button class="btn primary" data-act="prDeload">${S.settings.deloadUntil&&S.settings.deloadUntil>=today?"Light week is on":"Make next week a light week"}</button></div>`:""}</div></div>`; }
  return h+`</div><div class="small muted">Suggestions only: nothing changes unless you tap it. Calories are never changed on one weigh-in; I use the trend across at least ten days and need most days' food logged.</div></section>`;
}
function goalCard(log, tr){
  const G=S.settings.goal=S.settings.goal||{phase:"recomp"}, P=P_(), ph=Progress.PHASES[G.phase]||Progress.PHASES.recomp, today=TODAY();
  const nowT=tr.length?tr[tr.length-1].trend:null, E=Progress.eta(log, G, today), M=Progress.maintenance(S.days, log, today), MF=Progress.mifflin(P, nowT||(G.weight||0));
  let gw;
  if(stMode()){ const lb=G.weight?G.weight/LB:null, st=lb?Math.floor(lb/14):"", r=lb?Math.round(lb-st*14):"";
    gw=`<div class="grid2"><input id="g-st" inputmode="numeric" value="${esc(st)}" data-in="goalW" placeholder="st"><input id="g-lb" inputmode="decimal" value="${esc(r)}" data-in="goalW" placeholder="lb"></div>`; }
  else gw=`<input id="g-kg" inputmode="decimal" value="${esc(G.weight?Math.round(G.weight*10)/10:"")}" data-in="goalW" placeholder="kg">`;
  let h=`<section class="card"><div class="card-h"><h2>Goal</h2></div>
    <div class="seg">${Object.entries(Progress.PHASES).map(([k,v])=>`<button class="${(G.phase||"recomp")===k?"on":""}" data-act="prPhase" data-v="${k}">${v.n}</button>`).join("")}</div>
    <div class="small muted">${esc(ph.n)}: ${esc(ph.blurb)}.</div>
    <div class="grid2"><div class="field"><span class="label">Target weight</span>${gw}</div><label class="field"><span class="label">Target waist cm</span><input id="g-waist" inputmode="decimal" value="${esc(G.waist||"")}" data-in="goalWaist" placeholder="e.g. 84"></label></div>`;
  if(E&&G.weight>0){ h+=`<div class="gprog"><div><b>${fmtW(E.now,true)}</b> now</div><div class="gbar"><i style="width:${(()=>{ const st=log.find(x=>x.weight>0); const s0=st?st.weight:E.now; const tot=G.weight-s0; return tot? Math.max(0,Math.min(100,(E.now-s0)/tot*100)) : 100; })()}%"></i></div><div><b>${fmtW(G.weight,true)}</b> goal</div></div>
    <div class="small">${E.done?"You're at your goal weight. Switch to Maintain, or set a new goal.":E.weeks?`${fmtDW(Math.abs(E.left)*(E.left<0?-1:1))} to go. At your current rate that's about ${Math.round(E.weeks)} weeks, around ${fmtDate(E.date).slice(4)}.`:`${fmtDW(E.left)} to go. Not moving towards it yet, so there's no date to show.`}</div>`; }
  // calories
  const P2=S.settings.targets, base = M.ok ? M.kcal : MF ? MF.tdee : null, sugg = base ? Math.round((base+ph.kcalAdj)/50)*50 : null;
  h+=`<div class="label" style="margin-top:6px">Calories</div>`;
  if(M.ok) h+=`<div class="small">Measured maintenance <b>${n0(Math.round(M.kcal/10)*10)} kcal</b> from your own logs: ${esc(M.calc)}.</div>`;
  else if(MF) h+=`<div class="small">Starting estimate <b>${n0(Math.round(MF.tdee/10)*10)} kcal</b>: resting ${n0(MF.bmr)} kcal (Mifflin–St Jeor, using your age, height and weight) × ${MF.factor} for 5–6 training days. Once you've logged 4 weeks of food and weigh-ins, your measured number replaces this. (${esc(M.why)}.)</div>`;
  else h+=`<div class="small muted">Add your age and height for a starting estimate. After about four weeks of logging, the app uses your own data instead.</div>`;
  h+=`<div class="grid2"><label class="field"><span class="label">Age</span><input id="pf-age" inputmode="numeric" value="${esc(P.age||"")}" data-in="prof" data-k="age" placeholder="e.g. 38"></label><label class="field"><span class="label">Height cm</span><input id="pf-h" inputmode="decimal" value="${esc(P.heightCm||"")}" data-in="prof" data-k="heightCm"></label></div>`;
  if(sugg&&Math.abs(sugg-P2.kcal)>=50) h+=`<div class="setbtns"><span class="small" style="flex:1">${esc(ph.n)} target: ${n0(base)} ${ph.kcalAdj>=0?"+":"−"} ${Math.abs(ph.kcalAdj)} = <b>${n0(sugg)} kcal</b> (now ${n0(P2.kcal)})</span><button class="btn" data-act="prApplyKcal" data-v="${sugg}">Use ${n0(sugg)}</button></div>`;
  else if(sugg) h+=`<div class="small muted">Your ${n0(P2.kcal)} kcal target already fits this phase.</div>`;
  return h+`</section>`;
}
function weeksBack(n, today){ const m=monday(today), out=[]; for(let i=n-1;i>=0;i--) out.push(addDays(m,-7*i)); return out; }
function weeklyTable(log){
  const today=TODAY(), wks=weeksBack(8,today).reverse();
  const rows=wks.map(w=>{ const e=addDays(w,6)<today?addDays(w,6):today, ws=log.filter(x=>x.weight>0&&x.date>=w&&x.date<=e).map(x=>x.weight), I=Progress.intake(S.days,w,e), sess=Progress.sessionDays(S.days,w,e).length, km=Progress.runs(S.days,w,e).reduce((a,r)=>a+num(r.km),0);
    return { w, avg:ws.length?ws.reduce((a,b)=>a+b,0)/ws.length:null, n:ws.length, I, sess, km }; });
  if(!rows.some(r=>r.avg||r.I.days||r.sess||r.km)) return "";
  return `<section class="card"><details><summary class="h2like">Week by week</summary><div class="tablewrap"><table class="wt"><thead><tr><th>Week</th><th>Avg weight</th><th>Change</th><th>kcal</th><th>Protein</th><th>Sessions</th><th>Run km</th></tr></thead><tbody>
    ${rows.map((r,i)=>{ const prev=rows[i+1]; return `<tr><td>${fmtDate(r.w).slice(4)}</td><td>${r.avg?fmtW(r.avg,true)+`<span class="muted"> (${r.n})</span>`:"–"}</td><td>${r.avg&&prev&&prev.avg?fmtDW(r.avg-prev.avg):"–"}</td><td>${r.I.days?n0(r.I.kcal):"–"}</td><td>${r.I.days?n0(r.I.protein)+" g":"–"}</td><td>${r.sess}</td><td>${r.km?n1(r.km):"–"}</td></tr>`; }).join("")}
    </tbody></table></div><div class="small muted">Weekly averages of weigh-ins (count in brackets), and average food on fully logged days.</div></details></section>`;
}
function strengthCard(from, today){
  const lifts=Progress.topLifts(S.days, 8), pool=Coach.pool(S.ex); if(!lifts.length) return `<section class="card"><div class="card-h"><h2>Strength</h2></div><div class="empty">Log the same lift in two sessions and its estimated max shows up here.</div></section>`;
  if(!ui.lift||!lifts.includes(ui.lift)) ui.lift=lifts[0];
  const nW=Math.max(6,Math.min(52,Math.ceil((pd2(today)-pd2(from))/604800000)+1)), ws=Progress.bestE1rmByWeek(S.days, ui.lift, nW, today).filter(w=>w.v);
  let h=`<section class="card"><div class="card-h"><h2>Strength</h2></div><div class="chips hscroll">${lifts.map(id=>`<button class="chip ${ui.lift===id?"on":""}" data-act="prLift" data-v="${esc(id)}">${esc((pool.get(id)||{}).name||id)}</button>`).join("")}</div>`;
  if(ws.length){ const a=ws[0].v, b=ws[ws.length-1].v;
    h+=`<div class="small">${esc((pool.get(ui.lift)||{}).name||"")}: best estimated max ${n1(b)} kg${ws.length>1?`, ${b>=a?"up":"down"} ${n1(Math.abs(b-a))} kg (${n1(Math.abs(b-a)/a*100)}%) over the period`:""}.</div>`;
    h+=chartLine({ id:"cs", label:"Estimated max by week", from:ws[0].week, to:ws[ws.length-1].week, fmt:v=>n0(v), series:[{pts:ws.map(w=>({d:w.week,y:w.v})), kind:"line", cls:"ln", endDot:true},{pts:ws.map(w=>({d:w.week,y:w.v})), kind:"dots", cls:"dot3", r:3}], tips:ws.map(w=>({d:w.week,t:`Week of ${fmtDate(w.week).slice(4)}: ${n1(w.v)} kg estimated max`})) });
    h+=`<div class="small muted">Best set each week, converted to an estimated one-rep max with the Epley formula (weight × (1 + reps ÷ 30)), counting reps in reserve when you log RIR.</div>`; }
  // weekly sets by muscle group, last 6 weeks
  const groups=[["Chest",["chest"]],["Back",["lats","upperback"]],["Shoulders",["frontdelt","sidedelt","reardelt"]],["Arms",["biceps","triceps"]],["Legs",["quads","hams","glutes","calves"]],["Core",["abs","obliques"]]];
  const wks=weeksBack(6,today), W=wks.map(w=>Coach.weekly(S.days,S.ex,addDays(w,6)<today?addDays(w,6):today));
  h+=`<div class="label" style="margin-top:6px">Weekly sets by muscle group</div><div class="tablewrap"><table class="wt"><thead><tr><th></th>${wks.map(w=>`<th>${parse(w).getDate()}/${parse(w).getMonth()+1}</th>`).join("")}</tr></thead><tbody>
    ${groups.map(([n,ms])=>`<tr><td>${n}</td>${W.map(x=>{ const v=ms.reduce((a,m)=>a+x[m].sets,0); return `<td class="${v?"":"muted"}">${v?n0(v):"–"}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="small muted">Columns are weeks starting on the date shown (the current week counts the last 7 days). Main muscles count a full set, helping muscles half.</div>`;
  return h+`</section>`;
}
function trainingCard(today){
  const wks=weeksBack(12,today), P=P_();
  const bars=wks.map(w=>{ const e=addDays(w,6), s=Progress.sessionDays(S.days,w,e<today?e:today); return { label:parse(w).getDate()+"/"+(parse(w).getMonth()+1), v:s.length, sets:s.reduce((a,x)=>a+x.sets,0), w }; });
  return `<section class="card"><div class="card-h"><h2>Training</h2></div>
    <div class="label">Resistance sessions per week</div>${chartBars({ id:"ct", label:"Sessions per week", bars:bars.map(b=>({label:b.label, v:b.v, tip:`Week of ${fmtDate(b.w).slice(4)}: ${b.v} session${b.v===1?"":"s"}, ${b.sets} sets`})), target:{y:P.weeklySessions||5,label:"plan "+(P.weeklySessions||5)}, fmt:v=>n0(v) })}
    <div class="label">Working sets per week</div>${chartBars({ id:"ctv", label:"Sets per week", bars:bars.map(b=>({label:b.label, v:b.sets, cls:"b2", tip:`Week of ${fmtDate(b.w).slice(4)}: ${b.sets} sets`})) })}
    <div class="field"><span class="label">Planned sessions a week</span><div class="seg">${[3,4,5,6].map(n=>`<button class="${(P.weeklySessions||5)===n?"on":""}" data-act="profSess" data-v="${n}">${n}</button>`).join("")}</div></div></section>`;
}
function runningCard(today){
  const wks=weeksBack(12,today), all=Progress.runs(S.days, addDays(monday(today),-77), today);
  const bars=wks.map(w=>{ const rs=Progress.runs(S.days,w,addDays(w,6)), km=rs.reduce((a,r)=>a+num(r.km),0); return { label:parse(w).getDate()+"/"+(parse(w).getMonth()+1), v:km, tip:`Week of ${fmtDate(w).slice(4)}: ${n1(km)} km in ${rs.length} run${rs.length===1?"":"s"}`, cls:"b3" }; });
  const recent=all.slice(-5).reverse(), pace=r=>num(r.km)>0&&num(r.min)>0?(()=>{ const p=num(r.min)/num(r.km); return Math.floor(p)+":"+pad(Math.round((p%1)*60))+" /km"; })():"";
  return `<section class="card"><div class="card-h"><h2>Running</h2><span class="spacer"></span><button class="btn ghost" data-act="ckOpen" data-f="run">+ Run</button></div>
    ${all.length?chartBars({ id:"cr", label:"Kilometres per week", bars, fmt:v=>n1(v) })+`<div class="list">${recent.map(r=>`<div class="li"><span class="main"><div class="nm">${n1(r.km)} km ${esc(r.type||"easy")}</div><div class="sub">${fmtDate(r.date)}${r.min?` · ${n0(r.min)} min · ${pace(r)}`:""}</div></span></div>`).join("")}</div>`:`<div class="empty">No runs logged yet. Add them from the Run chip on Today.</div>`}</section>`;
}
function nutritionCard(today){
  const wks=weeksBack(12,today), T=S.settings.targets;
  const W=wks.map(w=>{ const e=addDays(w,6)<today?addDays(w,6):today; return { w, I:Progress.intake(S.days,w,e) }; });
  if(!W.some(x=>x.I.days)) return `<section class="card"><div class="card-h"><h2>Calories and protein</h2></div><div class="empty">Log food for a few days and weekly averages show up here.</div></section>`;
  const lab=w=>parse(w).getDate()+"/"+(parse(w).getMonth()+1);
  return `<section class="card"><div class="card-h"><h2>Calories and protein</h2></div>
    <div class="label">Average kcal on logged days</div>${chartBars({ id:"ck", label:"Average calories per week", bars:W.map(x=>({label:lab(x.w), v:x.I.kcal||0, tip:x.I.days?`Week of ${fmtDate(x.w).slice(4)}: ${n0(x.I.kcal)} kcal average over ${x.I.days} day${x.I.days===1?"":"s"}`:`Week of ${fmtDate(x.w).slice(4)}: not enough logged`})), target:{y:T.kcal,label:"target "+n0(T.kcal)} })}
    <div class="label">Average protein g</div>${chartBars({ id:"cp", label:"Average protein per week", bars:W.map(x=>({label:lab(x.w), v:x.I.protein||0, cls:"b4", tip:x.I.days?`Week of ${fmtDate(x.w).slice(4)}: ${n0(x.I.protein)} g protein average`:`Week of ${fmtDate(x.w).slice(4)}: not enough logged`})), target:{y:T.protein,label:"target "+n0(T.protein)+" g"} })}
    <div class="small muted">Only days with at least 1,200 kcal marked as eaten count, so a half-logged day doesn't drag the average down.</div></section>`;
}
/* progress photos: kept on this phone only (IndexedDB), never uploaded */
function pdb(){ return new Promise((res,rej)=>{ const r=indexedDB.open("rp-photos",1); r.onupgradeneeded=()=>r.result.createObjectStore("photos",{keyPath:"id"}); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function photosAll(){ try{ const db=await pdb(); return await new Promise(res=>{ const q=db.transaction("photos").objectStore("photos").getAll(); q.onsuccess=()=>res(q.result.sort((a,b)=>a.date<b.date?-1:1)); q.onerror=()=>res([]); }); }catch(e){ return []; } }
async function photoPut(p){ const db=await pdb(); await new Promise((res,rej)=>{ const t=db.transaction("photos","readwrite"); t.objectStore("photos").put(p); t.oncomplete=res; t.onerror=()=>rej(t.error); }); }
async function photoDel(id){ const db=await pdb(); await new Promise(res=>{ const t=db.transaction("photos","readwrite"); t.objectStore("photos").delete(id); t.oncomplete=res; }); }
function shrink(file){ return new Promise((res,rej)=>{ const img=new Image(), u=URL.createObjectURL(file); img.onload=()=>{ const k=Math.min(1,1000/Math.max(img.width,img.height)), c=document.createElement("canvas"); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext("2d").drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg",0.8)); }; img.onerror=rej; img.src=u; }); }
function photosCard(){
  if(ui.photos===null){ ui.photos=[]; photosAll().then(p=>{ ui.photos=p; if(ui.tab==="progress") render(); }); }
  const ps=ui.photos||[];
  return `<section class="card"><div class="card-h"><h2>Progress photos</h2><span class="spacer"></span><label class="btn ghost" for="ph-in">+ Photo</label><input id="ph-in" type="file" accept="image/*" data-in="photoAdd" hidden></div>
    ${ps.length?`<div class="phgrid">${ps.slice().reverse().map(p=>`<button class="ph" data-act="photoOpen" data-id="${esc(p.id)}" aria-label="Photo from ${esc(fmtDate(p.date))}"><img src="${p.src}" alt=""><span>${esc(fmtDate(p.date).slice(4))}</span></button>`).join("")}</div>`:`<div class="empty">Same spot, same light, same time of day every 2–4 weeks makes them comparable.</div>`}
    <div class="small muted">Photos stay on this phone only. They aren't uploaded or synced, and they aren't included in the export.</div></section>`;
}
function renderPhoto(s){
  const ps=ui.photos||[], p=ps.find(x=>x.id===s.id), first=ps[0];
  if(!p) return sheetHead("Photo")+`<div class="sbody"><div class="empty">Photo not found.</div></div>`;
  return sheetHead(esc(fmtDate(p.date)))+`<div class="sbody">${first&&first.id!==p.id?`<div class="phcmp"><figure><img src="${first.src}" alt="First photo"><figcaption>${esc(fmtDate(first.date))}</figcaption></figure><figure><img src="${p.src}" alt="This photo"><figcaption>${esc(fmtDate(p.date))}</figcaption></figure></div>`:`<img class="phbig" src="${p.src}" alt="">`}
    <button class="btn danger" data-act="photoDel" data-id="${esc(p.id)}">${ui.confirm==="ph:"+p.id?"Tap again to delete":"Delete photo"}</button></div>`;
}
function dataCard(){
  return `<section class="card"><div class="card-h"><h2>Your data</h2></div>
    <div class="small muted">Everything is stored in your own database and on this phone. To fix a past entry, open that day from the Week tab, or use the arrows on Today.</div>
    <div class="setbtns"><button class="btn" data-act="exportJson">Everything (JSON)</button><button class="btn" data-act="exportCsv" data-v="workouts">Workouts CSV</button><button class="btn" data-act="exportCsv" data-v="body">Body CSV</button><button class="btn" data-act="exportCsv" data-v="food">Food CSV</button><button class="btn" data-act="exportCsv" data-v="runs">Runs CSV</button></div></section>`;
}
function download(name, text, type){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
const csv = rows => rows.map(r=>r.map(v=>{ v=v==null?"":String(v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(",")).join("\n");
function setKcal(v){ const T=S.settings.targets, old=T.kcal, d=v-old; T.kcal=v; T.carbs=Math.max(50,Math.round(T.carbs+d*0.6/4)); T.fat=Math.max(40,Math.round(T.fat+d*0.4/9));
  (S.settings.kcalHistory=S.settings.kcalHistory||[]).push({date:TODAY(), kcal:v, from:old}); queueSave("settings/main"); }

Object.assign(A, {
  prRange(b){ ui.prRange=b.dataset.v; lsSet("rp-prr",ui.prRange); render(); },
  revWeek(b){ const cur=ui.revWeek||addDays(monday(TODAY()),-7), n=addDays(cur,Number(b.dataset.n)); if(n>monday(TODAY())) return; ui.revWeek=n; render(); },
  prApplyKcal(b){ const v=Math.round(num(b.dataset.v)); setKcal(v); toast(`Calorie target set to ${n0(v)}. Protein stays at ${n0(S.settings.targets.protein)} g.`); render(); },
  prDeload(){ const t=TODAY(), from=wd(t)<=1?monday(t):addDays(monday(t),7); S.settings.deloadFrom=from; S.settings.deloadUntil=addDays(from,6); S.settings.lastDeload=from; queueSave("settings/main"); toast(`Light week ${fmtDate(from).slice(4)} – ${fmtDate(addDays(from,6)).slice(4)}: the generator will keep sessions light.`); render(); },
  prPhase(b){ S.settings.goal=Object.assign({}, S.settings.goal||{}, {phase:b.dataset.v}); queueSave("settings/main"); render(); },
  prLift(b){ ui.lift=b.dataset.v; render(); },
  profSess(b){ P_().weeklySessions=+b.dataset.v; queueSave("settings/main"); render(); },
  ckOpen(b){ const f=b.dataset.f; if(f==="run") pushSheet({type:"run", date:ui.tab==="today"?ui.date:TODAY(), f:{km:"",min:"",type:"easy",rpe:""}}); else pushSheet({type:"checkin", date:ui.tab==="today"?ui.date:TODAY(), focus:f});
    setTimeout(()=>{ const id={weight:stMode()?"ck-st":"ck-kg", waist:"ck-waist", run:"rn-km"}[f]; const e=id&&document.getElementById(id); if(e) e.focus(); }, 350); },
  ckSet(b){ const s=top(), d=dayMut(s.date); d.checkin=Object.assign({}, d.checkin||{}); const k=b.dataset.k; d.checkin[k]=d.checkin[k]===b.dataset.v?undefined:b.dataset.v; queueSave("days/"+s.date); render(); },
  ckUnit(){ P_().wUnit=stMode()?"kg":"st"; queueSave("settings/main"); render(); },
  runType(b){ top().f.type=b.dataset.v; render(); },
  runSave(){ const s=top(), f=s.f; if(!(num(f.km)>0)){ toast("Add the distance."); return; } const d=dayMut(s.date); d.runs=d.runs||[]; d.runs.push({ id:rid("r"), km:num(f.km), min:num(f.min)||null, type:f.type||"easy", rpe:num(f.rpe)||null }); queueSave("days/"+s.date); s.f={km:"",min:"",type:"easy",rpe:""}; toast("Run saved"); render(); },
  runDel(b){ const s=top(), d=dayMut(s.date); d.runs.splice(+b.dataset.i,1); queueSave("days/"+s.date); render(); },
  photoOpen(b){ pushSheet({type:"photo", id:b.dataset.id}); },
  async photoDel(b){ const id=b.dataset.id; if(ui.confirm!=="ph:"+id){ ui.confirm="ph:"+id; render(); return; } ui.confirm=null; await photoDel(id); ui.photos=await photosAll(); ui.sheets.pop(); toast("Photo deleted"); render(); },
  exportJson(){ download(`recomp-planner-${TODAY()}.json`, JSON.stringify({ exported:new Date().toISOString(), exercises:S.ex, foods:S.foods, workouts:S.wo, days:S.days, settings:S.settings }, null, 1), "application/json"); },
  exportCsv(b){ const k=b.dataset.v, ds=Object.keys(S.days).sort(), pool=Coach.pool(S.ex); let rows;
    if(k==="workouts"){ rows=[["date","exercise","set","kg","reps","rir","done"]]; for(const d of ds) for(const [ex,rs] of Object.entries(S.days[d].log||{})) (rs||[]).forEach((r,i)=>rows.push([d,(pool.get(ex)||S.ex[ex]||{}).name||ex,i+1,r.w,r.r,r.rir,r.done?1:0])); }
    else if(k==="body"){ rows=[["date","weight_kg","waist_cm","bodyfat_pct_measured","sleep","energy"]]; for(const d of ds){ const b=S.days[d].body||{}, c=S.days[d].checkin||{}; if(b.weight||b.waist||b.bf||c.sleep||c.energy) rows.push([d,b.weight&&Math.round(b.weight*100)/100,b.waist,b.bf,c.sleep,c.energy]); } }
    else if(k==="runs"){ rows=[["date","km","minutes","type","effort"]]; for(const d of ds) for(const r of S.days[d].runs||[]) rows.push([d,r.km,r.min,r.type,r.rpe]); }
    else { rows=[["date","meal","food","qty","unit","kcal","protein_g","carbs_g","fat_g","eaten"]]; for(const d of ds) for(const m of S.days[d].meals||[]){ const x=macrosOf(m); rows.push([d,m.slot,m.name,m.qty,m.unit,Math.round(x.kcal),r1(x.p),r1(x.c),r1(x.f),m.eaten?1:0]); } }
    download(`recomp-${k}-${TODAY()}.csv`, csv(rows), "text/csv"); }
});
Object.assign(IN, {
  ckWeight(el){ const s=top(), d=dayMut(s.date); d.body=Object.assign({}, d.body||{}); let kg;
    if(stMode()){ const st=num($("#ck-st").value), lb=num($("#ck-lb").value); kg=(st||lb)?(st*14+lb)*LB:null; } else kg=num($("#ck-kg").value)||null;
    if(kg && (kg<30||kg>250)) return; if(kg) d.body.weight=Math.round(kg*100)/100; else delete d.body.weight; queueSave("days/"+s.date); },
  ckBody(el){ const s=top(), d=dayMut(s.date); d.body=Object.assign({}, d.body||{}); const v=num(el.value); if(v>0) d.body[el.dataset.k]=v; else delete d.body[el.dataset.k]; queueSave("days/"+s.date); },
  runF(el){ top().f[el.dataset.k]=el.value; },
  goalW(){ const G=S.settings.goal=S.settings.goal||{phase:"recomp"}; let kg; if(stMode()){ const st=num($("#g-st").value), lb=num($("#g-lb").value); kg=(st||lb)?(st*14+lb)*LB:null; } else kg=num($("#g-kg").value)||null; G.weight=kg?Math.round(kg*100)/100:null; queueSave("settings/main"); },
  goalWaist(el){ const G=S.settings.goal=S.settings.goal||{phase:"recomp"}; G.waist=num(el.value)||null; queueSave("settings/main"); },
  async photoAdd(el, ev){ if(ev.type!=="change") return; const f=el.files&&el.files[0]; if(!f) return; try{ const src=await shrink(f); await photoPut({ id:rid("ph"), date:TODAY(), src }); ui.photos=await photosAll(); toast("Photo saved on this phone"); render(); }catch(e){ toast("Couldn't read that photo."); } el.value=""; }
});

/* ---------- weekly meal plan and shopping list ---------- */
ui.foodSeg = lsGet("rp-fseg","plan"); ui.planWeek = monday(TODAY());
const SLOT_TXT={breakfast:"Breakfast",lunch:"Lunch",dinner:"Dinner",snack:"Snack"};
function people(){
  const T=S.settings.targets, pp=S.settings.people||[], me=Object.assign({ id:"me", name:"You", slots:{breakfast:true,lunch:true,dinner:true,snack:true} }, pp.find(p=>p.id==="me")||{}, { kcal:T.kcal, protein:T.protein });
  const two=pp.find(p=>p.id==="p2"); return [me].concat(two&&two.on?[two]:[]);
}
function partner(){ S.settings.people=S.settings.people||[]; let p=S.settings.people.find(x=>x.id==="p2"); if(!p){ p={id:"p2", name:"Partner", kcal:1800, protein:110, on:false, slots:{breakfast:true,lunch:false,dinner:true,snack:false}}; S.settings.people.push(p); } return p; }
function meRec(){ S.settings.people=S.settings.people||[]; let p=S.settings.people.find(x=>x.id==="me"); if(!p){ p={id:"me", name:"You", slots:{breakfast:true,lunch:true,dinner:true,snack:true}}; S.settings.people.push(p); } return p; }
let mealsCache=null, mealsKey="";
function planMeals(){
  const key=Object.keys(S.foods).length+":"+Object.values(S.foods).reduce((a,f)=>a+(f.recipe&&f.recipe.updated||"").length,0);
  if(mealsCache&&mealsKey===key) return mealsCache;
  const M={}, catOf=c=>c==="Snacks & shakes"?"Snack":c, ideas=window.MEAL_IDEAS||[], fromIdea={};
  for(const f of Object.values(S.foods)) if(f.recipe&&f.recipe.idea) fromIdea[f.recipe.idea]=f;
  for(const m of ideas){ const f=fromIdea[m.id];
    if(f){ M["food:"+f.id]={ mid:"food:"+f.id, name:f.name, emoji:f.emoji||m.e, cat:catOf(m.c), serves:f.recipe.servings||m.s, per:{kcal:f.kcal,p:f.p,c:f.c,f:f.f}, batch:(f.recipe.servings||m.s)>=4||/freez|meal prep/.test(m.t), time:m.t, method:f.recipe.method||m.m, rows:()=>f.recipe.rows||[], own:true, ideaId:m.id, foodId:f.id }; continue; }
    const P=ideaParsed(m); M["idea:"+m.id]={ mid:"idea:"+m.id, name:m.n, emoji:m.e, cat:catOf(m.c), serves:m.s, per:P.per, batch:m.s>=4||/freez|meal prep/.test(m.t), time:m.t, method:m.m, rows:()=>P.rows, ideaId:m.id }; }
  for(const f of Object.values(S.foods)){ if(!f.recipe||f.recipe.idea) continue; const k=+f.kcal||0;
    const cat = /breakfast|porridge|oats|pancake|omelette|granola|muesli|weetabix/i.test(f.name) ? "Breakfast" : k<380 ? "Snack" : "Dinner";
    M["food:"+f.id]={ mid:"food:"+f.id, name:f.name, emoji:foodEmoji(f), cat, serves:f.recipe.servings||1, per:{kcal:k,p:+f.p||0,c:+f.c||0,f:+f.f||0}, batch:(f.recipe.servings||1)>=4, time:"", method:f.recipe.method||"", rows:()=>f.recipe.rows||[], own:true, foodId:f.id }; }
  mealsCache=M; mealsKey=key; return M;
}
function planPrefs(){ return Object.assign({ weekdayBreakfast:"idea:m-berries-yog", weekendBreakfast:"idea:m-eggs-toast", batch:true, fav:[], hide:[] }, S.settings.mealPrefs||{}); }
function savePlan(plan){ S.plans[plan.week]=plan; Sync.put("plans/"+plan.week, plan); }
function curPlan(){ return S.plans[ui.planWeek]||null; }
function refreshPlan(plan){ return Planner.recompute(plan, planMeals(), people()); }
/* ingredient amounts */
function rowAmount(row, scale){ const u=row.units[row.u]||row.units[0], g=Ing.rowGrams(row);
  return { g: g!=null? g*scale : null, n: num(row.q)*scale, ul: u?u.l:"", ug: u&&u.g }; }
const niceG = (g, liquid) => g>=1000 ? (Math.round(g/100)/10)+(liquid?" l":" kg") : (g<20?Math.max(1,Math.round(g)):Math.round(g/5)*5)+(liquid?" ml":" g");
const frac = v => { const w=Math.floor(v), r=Math.round((v-w)*4); const f=["","¼","½","¾"][r%4]; const W=w+(r===4?1:0); return (W||!f?String(W||""):"")+f||"0"; };
function amountLabel(a, name){ const liquid=/milk|stock|water|juice|ml\b/i.test(a.ul+" "+name)&&!/powder/i.test(name);
  if(a.ul && !/^(g|ml)$/i.test(a.ul) && a.ug){ const n=Math.round(a.n*2)/2; return `${n%1?n:Math.round(n)} × ${a.ul.replace(/\s*\(.*\)$/,"")}`+(a.g?` (${niceG(a.g,liquid)})`:""); }
  if(a.g!=null) return niceG(a.g, liquid);
  return `${Math.round(a.n*10)/10} ${a.ul}`; }
const AISLE_FIRST=[["Cupboard",/peanut butter|noodle|spice|chilli powder|chilli flakes|curry powder|seasoning|paprika|cumin|oregano/i],["Fruit & veg",/beansprout/i]];
const AISLES=[["Fruit & veg",/\bfrozen\b/i,true],["Fruit & veg",/onion|garlic|pepper(?!corn)|carrot|broccoli|spinach|lettuce|salad|tomato(?!.*(tin|chopped|pur))|potato|banana|berr|apple|lemon|lime|avocado|ginger|herb|coriander|parsley|basil|courgette|mushroom|cucumber|pak choi|leek|kale|chilli|spring onion|celery|green bean|sweetcorn cob|rocket|beetroot|orange|grape/i],
  ["Meat & fish",/chicken(?!.*stock)|turkey|beef|steak|mince|pork|sausage|bacon|ham\b|chorizo|salmon|cod|tuna|prawn|fish|lamb|haddock|mackerel/i],
  ["Dairy & eggs",/milk|yog|cheese|cheddar|mozzarella|parmesan|halloumi|skyr|cream|butter(?! bean)|\begg|cottage|feta|kefir|quark/i],
  ["Bakery",/bread|sourdough|wrap|tortilla|bagel|muffin|pitta|naan|crumpet|roll\b/i],
  ["Tins & jars",/tin|beans|chopped tomatoes|passata|salsa|pesto|houmous|hummus|sauce|stock|curry paste|harissa|honey|peanut butter|jam|syrup|mayo|mustard|pickle|soy|vinegar/i],
  ["Cupboard",/rice|pasta|spaghetti|orzo|noodle|oat|granola|flour|quinoa|lentil|weetabix|cereal|paprika|cumin|spice|seasoning|oil|nut|almond|seed|whey|protein powder|cornflour|sugar|salt|stock cube|cracker|rice cake|chickpea/i]];
const STAPLE=/^(salt|black pepper|olive oil|vegetable|rapeseed|garlic|paprika|ground cumin|cumin|soy sauce|honey|cornflour|chicken stock|stock|dried|mixed herbs|oregano|chilli flakes)/i;
function aisle(name){ for(const [a,re] of AISLE_FIRST) if(re.test(name)) return a; for(const [a,re,fz] of AISLES){ if(fz){ if(re.test(name)) return "Frozen"; continue; } if(re.test(name)) return a; } return "Other"; }
function shoppingList(plan){
  const M=planMeals(), items={};
  plan.days.forEach((d,i)=>{ for(const s of Planner.SLOTS){ const x=d.slots[s]; if(!x||!x.cook) continue; const m=M[x.mid]; if(!m) continue; const sc=x.cook/(m.serves||1);
    for(const r of m.rows()){ const a=rowAmount(r, sc), isEgg=/^(egg\b|eggs\b|scrambled egg|fried egg|boiled egg|egg,)/i.test(r.name)&&!/noodle|white/i.test(r.name);
      if(isEgg&&a.g!=null){ a.ul="egg"; a.n=a.g/58; a.ug=58; }
      const k=isEgg?"eggs":(r.ref||r.name); const it=items[k]=items[k]||{ key:k, name:isEgg?"Eggs":r.name, g:0, n:0, ul:a.ul, ug:a.ug, mixed:false, uses:new Set() };
      if(a.g!=null) it.g+=a.g; if(it.ul===a.ul) it.n+=a.n; else it.mixed=true; it.uses.add(m.name); } } });
  return Object.values(items).map(it=>Object.assign(it,{ aisle: STAPLE.test(it.name)?"Check you have":aisle(it.name), uses:[...it.uses] }));
}
const DRY=[[/^pasta|spaghetti|orzo/i,2.4],[/rice/i,2.5],[/quinoa/i,2.7],[/noodle/i,2.3],[/couscous/i,2.5]];
function itemLabel(it){ if(/cooked/i.test(it.name)&&it.g){ const d=DRY.find(([re])=>re.test(it.name)); if(d) return `about ${niceG(it.g/d[1])} dry <span class="muted">(${niceG(it.g)} cooked)</span>`; }
  if(!it.mixed && it.ul && !/^(g|ml)$/i.test(it.ul) && it.ug){ const n=Math.ceil(it.n-0.15); return `${n} × ${it.ul.replace(/\s*\(.*\)$/,"")}`+(it.g?` <span class="muted">(${niceG(it.g,/milk|stock/i.test(it.name))})</span>`:""); }
  if(it.g) return niceG(it.g, /milk|stock|juice/i.test(it.name)&&!/powder/i.test(it.name)); return `${Math.round(it.n*10)/10} ${esc(it.ul)}`; }

/* Food tab: Plan / Shopping / Library */
function foodSegs(){ return `<div class="seg" role="tablist">${[["plan","Plan"],["shop","Shopping"],["library","Library"]].map(([k,l])=>`<button class="${ui.foodSeg===k?"on":""}" data-act="foodSeg" data-v="${k}">${l}</button>`).join("")}</div>`; }
function weekNav(){ const w=ui.planWeek, t=monday(TODAY()), lbl=w===t?"This week":w===addDays(t,7)?"Next week":w===addDays(t,-7)?"Last week":"Week of "+fmtDate(w).slice(4);
  return `<div class="wnav"><button class="iconbtn" data-act="planWeekNav" data-n="-7" aria-label="Previous week">${ICON.left}</button><div style="flex:1;text-align:center"><b>${lbl}</b><div class="small muted">${fmtDate(w).slice(4)} – ${fmtDate(addDays(w,6)).slice(4)}</div></div><button class="iconbtn" data-act="planWeekNav" data-n="7" aria-label="Next week">${ICON.right}</button></div>`; }
function peopleCard(){
  const me=meRec(), two=partner(), T=S.settings.targets;
  const slotChips=(p,who)=>`<div class="chips">${Planner.SLOTS.map(s=>`<button class="chip ${(p.slots||{})[s]!==false?"on":""}" data-act="planSlot" data-who="${who}" data-v="${s}">${SLOT_TXT[s]}</button>`).join("")}</div>`;
  return `<section class="card"><details ${curPlan()?"":"open"}><summary class="h2like">Who's eating</summary>
    <div class="pp"><div class="field"><span class="label">You · ${n0(T.kcal)} kcal · ${n0(T.protein)} g protein</span>${slotChips(me,"me")}<span class="small muted">Your targets come from the Food targets and the Progress tab.</span></div>
    <div class="field"><label class="tog"><input type="checkbox" ${two.on?"checked":""} data-in="p2On"> <span>Cooking for a second person</span></label></div>
    ${two.on?`<div class="grid3"><label class="field"><span class="label">Name</span><input id="p2-name" value="${esc(two.name)}" data-in="p2" data-k="name"></label><label class="field"><span class="label">Kcal</span><input id="p2-kcal" inputmode="numeric" value="${esc(two.kcal)}" data-in="p2" data-k="kcal"></label><label class="field"><span class="label">Protein g</span><input id="p2-p" inputmode="numeric" value="${esc(two.protein)}" data-in="p2" data-k="protein"></label></div>${slotChips(two,"p2")}<span class="small muted">Tick the meals they eat with you. Portions are scaled so each of you lands near your own target from the same pot.</span>`:""}
    <div class="field"><label class="tog"><input type="checkbox" ${planPrefs().batch?"checked":""} data-in="planBatch"> <span>Batch cook: big dinners cover the next day's lunch</span></label></div></div></details></section>`;
}
function vPlan(){
  const plan=curPlan(), M=planMeals(), ppl=people(); if(plan) refreshPlan(plan);
  let h=weekNav()+peopleCard();
  if(!plan) return h+`<section class="card"><div class="card-h"><h2>No plan for this week yet</h2></div><div class="small muted">I'll build seven days from your meal ideas and saved recipes: your berries and yoghurt on weekdays, eggs on sourdough at weekends, different dinners each night (steak, curry, fajitas, paella and pasta come up more), and leftovers for lunch after batch-cook dinners. Portions are sized to your calorie targets.</div><button class="btn primary block" data-act="planMake">Plan this week</button></section>`;
  // weekly average per person
  h+=`<section class="card"><div class="ppsum">${ppl.map(p=>{ const ts=plan.days.map(d=>(d.tot||{})[p.id]).filter(Boolean), gs=plan.days.map(d=>(d.tgt||{})[p.id]).filter(Boolean), avg=(xs,k)=>xs.reduce((a,t)=>a+t[k],0)/(xs.length||1), part=avg(gs,"kcal")<p.kcal-5;
    return `<div><div class="label">${esc(p.name)}${part?" · meals at home":""}</div><b class="num">${n0(avg(ts,"kcal"))}</b> <span class="small muted">/ ${n0(avg(gs,"kcal"))} kcal</span><br><b class="num">${n0(avg(ts,"p"))}</b> <span class="small muted">/ ${n0(avg(gs,"p"))} g protein</span></div>`; }).join("")}</div>
    <div class="small muted">Daily average from the plan against each person's target. For someone who only eats some meals at home, the target is their share for those meals (breakfast 25%, lunch 30%, dinner 35%, snack 10% of the day).</div>
    <div class="setbtns"><button class="btn" data-act="foodSeg" data-v="shop">Shopping list</button><span class="spacer"></span><button class="btn ghost" data-act="planMake">${ui.confirm==="replan"?"Tap again to replace the week":"New plan"}</button></div></section>`;
  plan.days.forEach((d,i)=>{ const date=addDays(plan.week,i), logged=(day(date).meals||[]).some(m=>m.plan&&m.plan.startsWith(plan.week+":"+i+":"));
    h+=`<section class="card pday ${date===TODAY()?"today":""}"><div class="card-h"><h2>${LONGDOW[i]}</h2><span class="small muted">${parse(date).getDate()} ${MON[parse(date).getMonth()]}</span><span class="spacer"></span>${date>=addDays(TODAY(),-1)?`<button class="btn ghost" data-act="planLogDay" data-i="${i}">${logged?"Added to day":"Add to my day"}</button>`:""}</div>`;
    for(const s of Planner.SLOTS){ const x=d.slots[s]; if(!x) continue; const m=M[x.mid]; if(!m) continue; const pq=x.portions||{};
      if(!Object.keys(pq).length && s==="snack") continue;
      const who=ppl.filter(p=>pq[p.id]).map(p=>`${esc(p.name)} ×${frac(pq[p.id])}`).join(" · ");
      const note = x.leftover ? `Leftovers from ${LONGDOW[i-1]}` : (s==="dinner"&&plan.days[i+1]&&(plan.days[i+1].slots.lunch||{}).leftover&&plan.days[i+1].slots.lunch.mid===x.mid) ? `Cook ${frac(x.cook)} portions, some for tomorrow's lunch` : (x.cook&&ppl.length>1?`Cook ${frac(x.cook)} portion${x.cook===1?"":"s"}`:"");
      h+=`<div class="pmeal"><button class="pm-main" data-act="planOpen" data-i="${i}" data-s="${s}"><span class="plate sm" aria-hidden="true">${m.emoji||"🍽️"}</span><span class="main"><span class="label">${SLOT_TXT[s]}</span><span class="nm">${esc(m.name)}</span><span class="sub">${who||"Not eating at home"}${note?" · "+esc(note):""}</span></span></button>
        ${x.leftover?"":`<button class="iconbtn sm" data-act="planShuffle" data-i="${i}" data-s="${s}" aria-label="Swap ${esc(m.name)} for something else">${ICON.shuffle}</button>`}</div>`; }
    h+=`<div class="ptot">${ppl.map(p=>{ const t=(d.tot||{})[p.id]; return t?`<span><b>${esc(p.name)}</b> ${n0(t.kcal)} kcal · ${n0(t.p)} g P</span>`:""; }).join("")}</div></section>`; });
  return h;
}
function vShop(){
  const plan=curPlan(); if(plan) refreshPlan(plan); let h=weekNav();
  if(!plan) return h+`<section class="card"><div class="empty">Make a meal plan for this week first and the shopping list builds itself.</div><button class="btn primary block" data-act="foodSeg" data-v="plan">Go to the plan</button></section>`;
  const list=shoppingList(plan), have=plan.have||{}, got=plan.got||{}, order=["Fruit & veg","Meat & fish","Dairy & eggs","Bakery","Cupboard","Tins & jars","Frozen","Other","Check you have"];
  const need=list.filter(i=>!have[i.key]), left=need.filter(i=>!got[i.key]).length;
  h+=`<section class="card"><div class="card-h"><h2>Shopping list</h2><span class="spacer"></span><span class="pill">${left} to get</span></div>
    <div class="small muted">Everything the plan needs, merged across meals and scaled to the portions you're cooking (batch-cook dinners include tomorrow's lunch). Tap an item when it's in the trolley; tap “Have it” for things already in the cupboard.</div>
    <div class="setbtns"><button class="btn primary" data-act="shopShare">Share list</button>${Object.keys(got).length?`<button class="btn" data-act="shopReset">Untick all</button>`:""}</div></section>`;
  for(const a of order){ const xs=need.filter(i=>i.aisle===a).sort((x,y)=>x.name.localeCompare(y.name)); if(!xs.length) continue;
    h+=`<section class="card shop"><div class="label">${esc(a)}${a==="Check you have"?" · cupboard staples":""}</div>${xs.map(i=>`<div class="sitem ${got[i.key]?"got":""}"><button class="si-main" data-act="shopGot" data-k="${esc(i.key)}" aria-pressed="${!!got[i.key]}"><span class="sbox">${got[i.key]?ICON.check:""}</span><span class="main"><span class="nm">${esc(i.name)}</span><span class="sub">${itemLabel(i)} · ${esc(i.uses.slice(0,2).join(", "))}${i.uses.length>2?` +${i.uses.length-2}`:""}</span></span></button><button class="btn ghost sm" data-act="shopHave" data-k="${esc(i.key)}">Have it</button></div>`).join("")}</section>`; }
  const owned=list.filter(i=>have[i.key]);
  if(owned.length) h+=`<section class="card"><details><summary class="label">Already have (${owned.length})</summary>${owned.map(i=>`<div class="sitem"><span class="main"><span class="nm">${esc(i.name)}</span><span class="sub">${itemLabel(i)}</span></span><button class="btn ghost sm" data-act="shopHave" data-k="${esc(i.key)}">Need it</button></div>`).join("")}</details></section>`;
  h+=`<div class="small muted" style="padding:0 4px">Amounts are what the recipes use, not pack sizes. No prices: there's no reliable free source of UK supermarket prices, and I'd rather show nothing than a made-up total.</div>`;
  return h;
}
function renderPlanMeal(s){
  const plan=S.plans[s.week], d=plan&&plan.days[s.i], x=d&&d.slots[s.s], M=planMeals(), m=x&&M[x.mid];
  if(!m) return sheetHead("Meal")+`<div class="sbody"><div class="empty">This meal isn't in the plan any more.</div></div>`;
  const ppl=people(), pref=planPrefs(), fav=pref.fav.includes(m.mid), sc=(x.cook||Object.values(x.portions||{}).reduce((a,b)=>a+b,0)||1)/(m.serves||1);
  let h=sheetHead(esc(m.name))+`<div class="sbody"><div class="small muted">${LONGDOW[s.i]} ${SLOT_TXT[s.s].toLowerCase()}${m.time?" · "+esc(m.time):""}${m.own?" · your recipe":""}</div>
    <div class="list">${ppl.map(p=>{ const q=(x.portions||{})[p.id]; return `<div class="li"><span class="main"><div class="nm">${esc(p.name)}</div><div class="sub">${q?`${frac(q)} portion${q===1?"":"s"}`:"Not eating this one"}</div></span>${q?`<span class="right">${n0(m.per.kcal*q)} kcal · ${n0(m.per.p*q)} g P</span>`:""}</div>`; }).join("")}</div>`;
  if(x.leftover) h+=`<div class="banner">Leftovers from ${LONGDOW[s.i-1]}'s dinner: just reheat. The ingredients are already on the shopping list under that dinner.</div>`;
  else { h+=`<div class="label">Ingredients · for ${frac(x.cook)} portion${x.cook===1?"":"s"}${m.serves!==x.cook?` (recipe serves ${m.serves})`:""}</div><ul class="ing">${m.rows().map(r=>`<li><span>${esc(r.name)}</span><span class="num">${amountLabel(rowAmount(r,sc), r.name)}</span></li>`).join("")}</ul>`;
    if(m.method) h+=`<div class="label">Method</div><div class="method">${esc(m.method).replace(/\. /g,".<br>")}</div>`; }
  h+=`<div class="setbtns">${x.leftover?"":`<button class="btn" data-act="planShuffle" data-i="${s.i}" data-s="${s.s}">Swap for another</button><button class="btn" data-act="planChoose">Choose…</button>`}
    <button class="btn ghost" data-act="planFav" data-m="${esc(m.mid)}">${fav?"♥ Favourite":"♡ Favourite"}</button></div>
    <div class="setbtns">${m.ideaId&&!m.foodId?`<button class="btn ghost" data-act="openIdea" data-id="${esc(m.ideaId)}">Edit amounts</button>`:m.foodId?`<button class="btn ghost" data-act="planEditFood" data-id="${esc(m.foodId)}">Edit recipe</button>`:""}<span class="spacer"></span><button class="btn ghost" style="color:var(--muted)" data-act="planHide" data-m="${esc(m.mid)}">Don't suggest this</button></div>
    <div class="small muted">Favourites come up more often. Calories per portion: ${n0(m.per.kcal)} kcal, ${n0(m.per.p)} g protein, ${n0(m.per.c)} g carbs, ${n0(m.per.f)} g fat.</div></div>`;
  return h;
}
function renderPlanPick(s){
  const under=ui.sheets[ui.sheets.length-2], plan=S.plans[under.week], alts=Planner.alternatives(plan, planMeals(), under.i, under.s, planPrefs());
  return sheetHead(`Choose ${SLOT_TXT[under.s].toLowerCase()}`)+`<div class="sbody"><div class="list">${alts.map(m=>`<button class="li" data-act="planPickOne" data-m="${esc(m.mid)}"><span class="plate sm" aria-hidden="true">${m.emoji||"🍽️"}</span><span class="main"><div class="nm">${esc(m.name)}${m.own?` <span class="pill starter">yours</span>`:""}</div><div class="sub">${n0(m.per.kcal)} kcal · ${n0(m.per.p)} g P per portion${m.batch?" · batch cook":""}</div></span></button>`).join("")||`<div class="empty">No other ${SLOT_TXT[under.s].toLowerCase()}s yet. Save recipes and they'll appear here.</div>`}</div></div>`;
}
function planLogDay(plan, i){
  const date=addDays(plan.week,i), d=dayMut(date), M=planMeals(), tag=plan.week+":"+i+":";
  d.meals=(d.meals||[]).filter(m=>!(m.plan&&m.plan.startsWith(tag)&&!m.eaten));
  for(const s of Planner.SLOTS){ const x=plan.days[i].slots[s], q=x&&(x.portions||{}).me; if(!q) continue; const m=M[x.mid]; if(!m) continue;
    d.meals.push({ id:rid("m"), slot:s==="snack"?"snacks":s, name:m.name+(x.leftover?" (leftovers)":""), emoji:m.emoji, foodId:m.foodId||null, size:1, unit:"portion", qty:q, kcal:r4(m.per.kcal), p:r4(m.per.p), c:r4(m.per.c), f:r4(m.per.f), eaten:false, plan:tag+s }); }
  queueSave("days/"+date);
}
async function shareText(t){ try{ if(navigator.share){ await navigator.share({ title:"Shopping list", text:t }); return; } }catch(e){ if(e&&e.name==="AbortError") return; }
  try{ await navigator.clipboard.writeText(t); toast("List copied. Paste it into Notes or a message."); }catch(e){ toast("Couldn't share from this browser."); } }

Object.assign(A, {
  foodSeg(b){ ui.foodSeg=b.dataset.v; lsSet("rp-fseg",ui.foodSeg); ui.confirm=null; render(); window.scrollTo(0,0); },
  planWeekNav(b){ ui.planWeek=addDays(ui.planWeek,Number(b.dataset.n)); ui.confirm=null; render(); },
  planMake(){ if(curPlan()&&ui.confirm!=="replan"){ ui.confirm="replan"; render(); return; } ui.confirm=null;
    const prev=S.plans[addDays(ui.planWeek,-7)], prevMids=prev?prev.days.flatMap(d=>Object.values(d.slots).map(x=>x.mid)):[];
    const pl=Planner.generate({ week:ui.planWeek, meals:planMeals(), people:people(), prefs:planPrefs(), prevMids, seed:ui.planWeek+Date.now() });
    savePlan(pl); toast("Week planned. Swap anything you don't fancy."); render(); },
  planShuffle(b){ const plan=curPlan()||S.plans[top()&&top().week]; if(!plan) return; Planner.shuffle(plan, planMeals(), people(), +b.dataset.i, b.dataset.s, planPrefs()); savePlan(plan); render(); },
  planOpen(b){ pushSheet({type:"planMeal", week:ui.planWeek, i:+b.dataset.i, s:b.dataset.s}); },
  planChoose(){ pushSheet({type:"planPick"}); },
  planPickOne(b){ ui.sheets.pop(); const s=top(), plan=S.plans[s.week]; Planner.setMeal(plan, planMeals(), people(), s.i, s.s, b.dataset.m, planPrefs()); savePlan(plan); render(); },
  planFav(b){ const P=S.settings.mealPrefs=Object.assign({}, planPrefs()), m=b.dataset.m; P.fav=P.fav.includes(m)?P.fav.filter(x=>x!==m):[...P.fav,m]; queueSave("settings/main"); render(); },
  planHide(b){ const P=S.settings.mealPrefs=Object.assign({}, planPrefs()), m=b.dataset.m; P.hide=[...new Set([...P.hide,m])]; P.fav=P.fav.filter(x=>x!==m); queueSave("settings/main");
    const s=top(), plan=S.plans[s.week]; Planner.shuffle(plan, planMeals(), people(), s.i, s.s, P); savePlan(plan); toast("Won't suggest that again. Swapped it out."); render(); },
  planEditFood(b){ const f=S.foods[b.dataset.id]; if(!f) return; ui.sheets=[]; openRecipe(f); },
  planSlot(b){ const p=b.dataset.who==="me"?meRec():partner(); p.slots=Object.assign({breakfast:true,lunch:true,dinner:true,snack:true}, p.slots||{}); p.slots[b.dataset.v]=p.slots[b.dataset.v]===false; queueSave("settings/main"); const pl=curPlan(); if(pl){ refreshPlan(pl); savePlan(pl); } render(); },
  planLogDay(b){ const pl=curPlan(); planLogDay(pl, +b.dataset.i); toast(`Added to ${LONGDOW[+b.dataset.i]} as planned meals. Tick them off as you eat.`); render(); },
  planLogFor(b){ const t=b.dataset.date, pl=S.plans[monday(t)]; if(!pl) return; planLogDay(pl, wd(t)); toast("Planned meals added. Tick them off as you eat."); render(); },
  shopGot(b){ const pl=curPlan(); pl.got=pl.got||{}; const k=b.dataset.k; if(pl.got[k]) delete pl.got[k]; else pl.got[k]=1; savePlan(pl); render(); },
  shopHave(b){ const pl=curPlan(); pl.have=pl.have||{}; const k=b.dataset.k; if(pl.have[k]) delete pl.have[k]; else pl.have[k]=1; savePlan(pl); render(); },
  shopReset(){ const pl=curPlan(); pl.got={}; savePlan(pl); render(); },
  shopShare(){ const pl=curPlan(), list=shoppingList(pl).filter(i=>!(pl.have||{})[i.key]&&!(pl.got||{})[i.key]); const by={};
    list.forEach(i=>(by[i.aisle]=by[i.aisle]||[]).push(i));
    const t=`Shopping · week of ${fmtDate(pl.week).slice(4)}\n`+Object.entries(by).map(([a,xs])=>`\n${a}\n`+xs.map(i=>`- ${i.name}: ${itemLabel(i).replace(/<[^>]+>/g,"")}`).join("\n")).join("\n");
    shareText(t); }
});
Object.assign(IN, {
  p2On(el, ev){ if(ev.type!=="change") return; partner().on=el.checked; queueSave("settings/main"); const pl=curPlan(); if(pl){ refreshPlan(pl); savePlan(pl); } render(); },
  p2(el, ev){ const p=partner(), k=el.dataset.k; p[k]=k==="name"?el.value.slice(0,20):num(el.value)||p[k]; queueSave("settings/main"); if(ev.type==="change"){ const pl=curPlan(); if(pl){ refreshPlan(pl); savePlan(pl); } render(); } },
  planBatch(el, ev){ if(ev.type!=="change") return; S.settings.mealPrefs=Object.assign({}, planPrefs(), {batch:el.checked}); queueSave("settings/main"); render(); }
});

/* ---------- app feel: motion, swipe to dismiss ---------- */
const reduceMotion=()=>{ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
function motionMs(ms){ return reduceMotion()?0:ms; }
function fadeApp(kind){ const el=$("#app"); el.classList.remove("fade","next","prev"); void el.offsetWidth; el.classList.add("fade"); if(kind) el.classList.add(kind); }
(function swipeToDismiss(){
  const panel=$("#panel"); let y0=0, t0=0, dy=0, active=false, decided=false;
  panel.addEventListener("touchstart", e=>{
    if(e.touches.length!==1) return;
    const t=e.target, onHead=!!t.closest(".sh");
    if(t.closest("input,select,textarea")) { active=false; return; }
    if(!onHead && panel.scrollTop>0) { active=false; return; }
    y0=e.touches[0].clientY; t0=Date.now(); dy=0; active=true; decided=false;
  }, {passive:true});
  panel.addEventListener("touchmove", e=>{
    if(!active) return;
    dy=e.touches[0].clientY-y0;
    if(!decided){ if(Math.abs(dy)<6) return; decided=true; if(dy<0){ active=false; return; } }
    if(dy>0){ e.preventDefault(); panel.style.transition="none"; panel.style.transform=`translateY(${dy}px)`; $("#sheet .scrim").style.opacity=String(Math.max(0.2,1-dy/500)); }
  }, {passive:false});
  const end=()=>{
    if(!active) return; active=false;
    const v=dy/Math.max(1,Date.now()-t0), go=dy>120 || (dy>40 && v>0.55);
    panel.style.transition=""; $("#sheet .scrim").style.opacity="";
    if(go){
      if(ui.sheets.length>1){ panel.style.transform=""; popSheet(); }
      else { panel.style.transform=`translateY(${dy}px)`; requestAnimationFrame(()=>{ panel.style.transform=""; ui.sheets=[]; ui.confirm=null; render(); }); }
    } else panel.style.transform="";
  };
  panel.addEventListener("touchend", end); panel.addEventListener("touchcancel", end);
})();

/* ---------- boot ---------- */
Sync.onChange(()=>{ loadS(); render(); });
Sync.onStatus(s=>{ status(); const was=authed; authed=!!s.user; if(was!==authed){ loadS(); render(); } });
let authed=false;
(async ()=>{
  loadS();
  try{ await Sync.init(); }catch(e){ console.error(e); }
  authed=!!Sync.status().user; loadS(); render();
  requestAnimationFrame(()=>{ const sp=$("#splash"); if(sp){ sp.classList.add("gone"); setTimeout(()=>sp.remove(),300); } });
  const idle=window.requestIdleCallback||(f=>setTimeout(f,1500)); idle(()=>Ing.loadFull().catch(()=>{}));
})();
if("serviceWorker" in navigator && location.protocol==="https:") navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
