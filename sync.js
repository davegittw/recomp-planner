// Local-first store. Every change is written to the phone first (so the app works with
// no signal in the gym), then pushed to Supabase in the background. Pulls fetch only
// rows changed since the last sync. One table, `records`, holds every kind of document.
window.Sync = (function () {
  "use strict";
  const KEY = "rp-store-v1";
  const OVERLAP_MS = 2 * 60 * 1000; // re-read a little behind the cursor so nothing is missed
  const cfg = window.RECOMP_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !/YOUR-/.test(cfg.supabaseUrl + cfg.supabaseAnonKey));

  let st = load();
  let sb = null, user = null, rev = 0;
  let pushing = false, pulling = false, lastError = null;
  let persistTimer = null, pushTimer = null;
  const changeFns = [], statusFns = [];

  function blank() { return { rec: {}, pending: {}, cursor: null, lastSync: null, userId: null }; }
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.rec) return Object.assign(blank(), v); } catch (e) {}
    return blank();
  }
  function persistNow() {
    clearTimeout(persistTimer); persistTimer = null;
    try { localStorage.setItem(KEY, JSON.stringify(st)); }
    catch (e) { lastError = "The phone's storage for this app is full, so recent changes may not be kept."; emitStatus(); }
  }
  function persistSoon() { if (!persistTimer) persistTimer = setTimeout(persistNow, 250); }
  function emitChange() { changeFns.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }
  function emitStatus() { const s = status(); statusFns.forEach(fn => { try { fn(s); } catch (e) { console.error(e); } }); }

  /* ----- reads ----- */
  function all(kind) {
    const out = {}, pre = kind + "/";
    for (const p in st.rec) if (p.startsWith(pre)) out[p.slice(pre.length)] = st.rec[p];
    return out;
  }
  function get(path) { return st.rec[path] || null; }

  /* ----- writes (local first) ----- */
  function put(path, data) {
    st.rec[path] = data; st.pending[path] = ++rev + ":" + Date.now();
    persistSoon(); schedulePush(); emitStatus();
  }
  function remove(path) {
    delete st.rec[path]; st.pending[path] = ++rev + ":" + Date.now() + ":del";
    persistSoon(); schedulePush(); emitStatus();
  }
  function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(() => { push(); }, 1200); }

  /* ----- network ----- */
  function split(path) { const i = path.indexOf("/"); return [path.slice(0, i), path.slice(i + 1)]; }
  async function push() {
    if (!sb || !user || pushing) return;
    const snap = Object.assign({}, st.pending); const paths = Object.keys(snap);
    if (!paths.length) return;
    if (navigator.onLine === false) { emitStatus(); return; }
    pushing = true; emitStatus();
    try {
      for (let i = 0; i < paths.length; i += 200) {
        const rows = paths.slice(i, i + 200).map(p => {
          const [kind, id] = split(p); const del = !(p in st.rec);
          return { user_id: user.id, kind, id, data: del ? null : st.rec[p], deleted: del };
        });
        const { error } = await sb.from("records").upsert(rows, { onConflict: "user_id,kind,id" });
        if (error) throw error;
      }
      for (const p of paths) if (st.pending[p] === snap[p]) delete st.pending[p];
      lastError = null; persistNow();
    } catch (e) {
      lastError = friendly(e);
    } finally { pushing = false; emitStatus(); }
    if (Object.keys(st.pending).length && !lastError) schedulePush();
  }
  async function pull() {
    if (!sb || !user || pulling) return false;
    if (navigator.onLine === false) return false;
    pulling = true; let changed = false;
    try {
      let since = st.cursor ? new Date(new Date(st.cursor).getTime() - OVERLAP_MS).toISOString() : null;
      for (let page = 0; page < 50; page++) {
        let q = sb.from("records").select("kind,id,data,deleted,updated_at").order("updated_at", { ascending: true }).limit(1000);
        if (since) q = q.gt("updated_at", since);
        const { data, error } = await q;
        if (error) throw error;
        for (const r of data) {
          const p = r.kind + "/" + r.id;
          if (!st.cursor || r.updated_at > st.cursor) st.cursor = r.updated_at;
          if (p in st.pending) continue; // local edit not yet pushed wins
          if (r.deleted) { if (p in st.rec) { delete st.rec[p]; changed = true; } }
          else if (JSON.stringify(st.rec[p]) !== JSON.stringify(r.data)) { st.rec[p] = r.data; changed = true; }
        }
        if (data.length < 1000) break;
        since = data[data.length - 1].updated_at;
      }
      lastError = null; st.lastSync = new Date().toISOString(); persistNow();
    } catch (e) { lastError = friendly(e); }
    finally { pulling = false; emitStatus(); }
    if (changed) emitChange();
    return changed;
  }
  async function syncNow() { await push(); await pull(); await push(); }
  function friendly(e) {
    const m = (e && (e.message || e.error_description)) || "";
    if (/JWT|token|auth/i.test(m)) return "Your sign-in has expired. Sign out and back in to keep syncing.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "No connection. Changes are saved on this phone and will sync later.";
    return "Sync failed" + (m ? ": " + m : "") + ". It will try again.";
  }

  /* ----- status ----- */
  function status() {
    return { configured, user: user ? { email: user.email } : null, pending: Object.keys(st.pending).length,
      online: navigator.onLine !== false, busy: pushing || pulling, lastSync: st.lastSync, error: lastError };
  }

  /* ----- auth ----- */
  async function init() {
    if (!configured || !window.supabase) { emitStatus(); return null; }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "rp-auth" } });
    const { data } = await sb.auth.getSession();
    setUser(data && data.session ? data.session.user : null);
    sb.auth.onAuthStateChange((_evt, session) => { const had = !!user; setUser(session ? session.user : null); if (!had && user) syncNow(); emitStatus(); });
    window.addEventListener("online", () => syncNow());
    window.addEventListener("offline", () => emitStatus());
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(); else persistNow(); });
    window.addEventListener("pagehide", persistNow);
    setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 60000);
    if (user) syncNow();
    return user;
  }
  function setUser(u) {
    user = u;
    if (u && st.userId && st.userId !== u.id) { st = blank(); emitChange(); } // different account: start clean
    if (u) { st.userId = u.id; persistSoon(); }
  }
  async function signIn(email, password) {
    if (!sb) throw new Error("The app isn't connected to Supabase yet. Fill in config.js.");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid/i.test(error.message) ? "Email or password is wrong." : error.message);
  }
  async function signOut() {
    await push();
    if (sb) await sb.auth.signOut();
    st = blank(); persistNow(); user = null; emitChange(); emitStatus();
  }

  async function token() {
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  }

  return { all, get, put, remove, syncNow, status, init, signIn, signOut, token,
    onChange: fn => changeFns.push(fn), onStatus: fn => statusFns.push(fn), get configured() { return configured; } };
})();
