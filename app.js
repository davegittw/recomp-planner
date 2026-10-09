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
const EQUIP = ["Barbell","Squat rack","Dumbbells","Cables","Landmine","Pull-up bar","Bench","Bodyweight"];
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
  down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>'
};

/* ---------- state ---------- */
const S = { ex:{}, foods:{}, wo:{}, days:{}, settings:{ targets:{kcal:2400,protein:160,carbs:260,fat:70}, split:{} } };
function lsGet(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
const ui = { tab: lsGet("rp-tab","today"), date: TODAY(), week: monday(TODAY()), trainSeg: lsGet("rp-seg","workouts"),
  exFilter:"all", exQ:"", foodQ:"", sheets:[], confirm:null };

/* ---------- persistence (local-first, see sync.js) ---------- */
function loadS(){
  S.ex=Sync.all("exercises"); S.foods=Sync.all("foods"); S.wo=Sync.all("workouts"); S.days=Sync.all("days");
  const st=Sync.get("settings/main")||{};
  S.settings={ targets:Object.assign({kcal:2400,protein:160,carbs:260,fat:70}, st.targets||{}), split:Object.assign({}, st.split||{}) };
}
function bodyFor(path){
  if(path==="settings/main") return clone(S.settings);
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
  h+=`<div class="setbtns"><button class="btn" data-act="copyMeals">Copy another day</button><button class="btn" data-act="newRecipe">Build a recipe</button>${t.n&&t.nEat<t.n?`<button class="btn" data-act="eatAll">Mark all eaten</button>`:""}</div></section>`;

  // training
  const woOpts = [`<option value="" ${d.workout==null?"selected":""}>Split: ${(()=>{const s=(S.settings.split||{})[wd(date)]; return s&&s!=="rest"&&S.wo[s]?esc(S.wo[s].name):"Rest";})()}</option>`,
    `<option value="rest" ${d.workout==="rest"?"selected":""}>Rest day</option>`]
    .concat(sortedBy(S.wo).map(w=>`<option value="${esc(w.id)}" ${d.workout===w.id?"selected":""}>${esc(w.name)}</option>`)).join("");
  h+=`<section class="sec" aria-label="Training"><div class="sec-h"><h2>Training</h2>
    ${prog?`<span class="pill ${prog.done&&prog.done>=prog.total?"done":""}">${prog.done}/${prog.total} sets</span>`:""}
    <span class="spacer"></span><select id="wsel" data-in="setWorkout" aria-label="Workout for this day">${woOpts}</select></div>`;
  if(wf.id==="rest") h+=`<div class="empty">Rest day. Pick a workout above to train anyway.</div>`;
  else if(!wf.w) h+=`<div class="empty">That workout has been deleted. Choose another above.</div>`;
  else{
    if(wf.w.notes) h+=`<div class="small muted">${esc(wf.w.notes)}</div>`;
    for(const it of wf.w.items||[]){
      const e=S.ex[it.exId]; const rows=(d.log||{})[it.exId]; const n=rows?rows.length:(Number(it.sets)||0);
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
  <div class="top-row"><div class="seg" style="flex:1" role="tablist"><button class="${ui.trainSeg==="workouts"?"on":""}" data-act="seg" data-v="workouts">Workouts</button><button class="${ui.trainSeg==="exercises"?"on":""}" data-act="seg" data-v="exercises">Exercises</button></div>
  <button class="btn primary" data-act="${ui.trainSeg==="workouts"?"newWorkout":"newEx"}">+ New</button></div>`;
  if(ui.trainSeg==="workouts"){
    const ws=sortedBy(S.wo);
    if(!ws.length) h+=`<div class="card"><div class="empty">No workouts yet. Tap “New workout” and pick exercises from your list.</div></div>`;
    else{ h+=`<div class="list">`+ws.map(w=>`<button class="li" data-act="editWorkout" data-id="${esc(w.id)}"><span class="main"><div class="nm">${esc(w.name)}</div><div class="sub">${(w.items||[]).map(it=>esc((S.ex[it.exId]||{}).name||"?")).join(", ")||"No exercises"}</div></span><span class="pill ${esc(w.tag||"")}">${esc(w.tag||"")}</span></button>`).join("")+`</div>`; }
  } else {
    h+=`<input type="search" id="exq" placeholder="Search exercises" value="${esc(ui.exQ)}" data-in="exQ" autocomplete="off">
    <div class="chips">${["all",...PATTERNS].map(p=>`<button class="chip ${ui.exFilter===p?"on":""}" data-act="exFilter" data-v="${p}">${p==="all"?"All":p[0].toUpperCase()+p.slice(1)}</button>`).join("")}</div>`;
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

function vFood(){
  const T=S.settings.targets; const mk=T.protein*4+T.carbs*4+T.fat*9;
  let h=head({ eyebrow:"Library & targets", title:"Food" })+`<div class="stack" style="gap:16px">
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
  else if(s.type==="exPick"){
    h+=sheetHead("Add exercise", `<button class="btn ghost" data-act="newExFromPick">+ New</button>`)+`<div class="sbody">
     <input type="search" id="xp-q" placeholder="Search exercises" value="${esc(s.q)}" data-in="xpQ" autocomplete="off">
     <div class="chips">${["all",...PATTERNS].map(p=>`<button class="chip ${s.filter===p?"on":""}" data-act="xpFilter" data-v="${p}">${p==="all"?"All":p[0].toUpperCase()+p.slice(1)}</button>`).join("")}</div>
     ${exList(s.filter, s.q, "xpPick")}</div>`;
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
  pushSheet(Object.assign({type:"list", mode:"recipe", id:f?f.id:null, name:f?f.name:"", emoji:f?f.emoji||"":"", servings:f&&f.recipe?f.recipe.servings:4,
    rows:f?recipeRows(f):[], misses:[], paste:"", showPaste:false, date:ui.date, slot:guessSlot(), eaten:false, skipped:0}, extra||{}));
}
/* ---------- render ---------- */
function render(){
  const a=document.activeElement, fid=a&&a.id, sel=a&&("selectionStart" in a)?[a.selectionStart,a.selectionEnd]:null;
  const panelScroll=$("#panel").scrollTop;
  const st=Sync.status(), gate=!st.configured||!st.user;
  const views={today:vToday, week:vWeek, train:vTrain, food:vFood};
  $("#app").innerHTML= !st.configured ? vSetup() : !st.user ? vLogin() : (views[ui.tab]||vToday)();
  $("#dock").hidden=gate; if(gate) ui.sheets=[];
  $("#askform").hidden = ui.tab!=="today"; document.body.classList.toggle("no-ask", ui.tab!=="today");
  $("#tabs").innerHTML=[["today","Today"],["week","Week"],["train","Train"],["food","Food"]].map(([k,l])=>`<button class="${ui.tab===k?"on":""}" data-act="tab" data-v="${k}" aria-label="${l}" aria-current="${ui.tab===k?"page":"false"}">${ICON[k]}<span>${l}</span></button>`).join("");
  renderSheet(); $("#panel").scrollTop=panelScroll;
  if(fid){ const e=document.getElementById(fid); if(e){ e.focus({preventScroll:true}); try{ if(sel&&sel[0]!=null) e.setSelectionRange(sel[0],sel[1]); }catch(_){} } }
  status();
}

/* ---------- actions ---------- */
function ensureLog(date, exId){
  const d=dayMut(date); if(!d.log[exId]){ const wf=workoutFor(date); const it=(wf.w&&wf.w.items||[]).find(x=>x.exId===exId)||{};
    d.log[exId]=Array.from({length:Number(it.sets)||0},()=>({w:"",r:"",done:false})); }
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
    const sv=Math.max(0.5,num(s.servings)||1), T=rowsTotal(s.rows), id=s.id||rid("f");
    const food={ id, name, emoji:(s.emoji||"").trim()||foodEmoji({name}), size:1, unit:"serving",
      kcal:Math.round(T.kcal/sv), p:r1(T.p/sv), c:r1(T.c/sv), f:r1(T.f/sv), fibre:r1(T.fi/sv),
      recipe:{ v:2, servings:sv, gramsPerServing:T.grams?Math.round(T.grams/sv):null, rows:s.rows.map(r=>{ const o=clone(r); delete o.line; return o; }), updated:TODAY() } };
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
  xpQ(el){ top().q=el.value; render(); }
};
document.addEventListener("click", ev=>{ const b=ev.target.closest("[data-act]"); if(!b||b.disabled) return; const f=A[b.dataset.act]; if(f){ ev.preventDefault(); f(b); } });
["input","change"].forEach(t=>document.addEventListener(t, ev=>{ const el=ev.target; const k=el.dataset&&el.dataset.in; if(k&&IN[k]){
  if(t==="change" && ["exQ","foodQ","pickQ","xpQ","setVal","pickRowQ","rowQ","listPaste","draft","witem","pickEaten","listEaten"].includes(k)) return; IN[k](el, ev); } }));
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
