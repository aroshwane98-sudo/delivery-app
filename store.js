/* =========================================================
 *  کۆگای دۆخی سیستەم — سێشن، ڕووکار، لیستەکان
 * ========================================================= */

const Store = (() => {
  const SESSION_KEY = 'dlv_session';
  const SETTINGS_KEY = 'dlv_settings';
  const LISTS_CACHE_KEY = 'dlv_lists_cache';
  const VEHICLES_TTL_MS = 60 * 1000; // ژمارەی سەیارەکان — هەر ٦٠ چرکە جارێک لە Supabase نوێ دەکرێنەوە
  const LISTS_TTL_MS = 30 * 60 * 1000; // ٣٠ خولەک — پاش هەر گۆڕانکارییەک بە خۆکاری بەتاڵ دەکرێتەوە

  /* ---------------- سێشن ---------------- */

  function getSession() {
    // "منی بیربکە" → localStorage، ئەگینا sessionStorage
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function setSession(user, remember) {
    const json = JSON.stringify(user);
    clearSession();
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, json);
  }

  function updateSession(patch) {
    const s = getSession();
    if (!s) return;
    const next = { ...s, ...patch };
    const remembered = !!localStorage.getItem(SESSION_KEY);
    setSession(next, remembered);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }

  /* ---------------- دۆخی تابەکان — ڕیزبەندی و دوا تاب (بۆ هەر بەکارهێنەر) ---------------- */

  const TAB_STATE_PREFIX = 'dlv_tabstate_';
  const tabStateKey = uid => TAB_STATE_PREFIX + uid;

  function getTabState(userId) {
    if (!userId) return {};
    try { return JSON.parse(localStorage.getItem(tabStateKey(userId)) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function saveTabState(userId, patch) {
    if (!userId) return;
    const next = { ...getTabState(userId), ...patch };
    try { localStorage.setItem(tabStateKey(userId), JSON.stringify(next)); } catch (_) {}
  }

  /* ---------------- ڕووکار (ڕوون/تاریک + ڕەنگ) ---------------- */

  const FONT_DEFAULTS = { fontScale: 1, recordsFontScale: 1, totalsFontScale: 1, fontFamily: 'Vazirmatn' };

  // دەق و ئۆپشنەکانی پرێنتکردن — بەڕێوەبەر دەیانگۆڕێت یان دەیانشەوێنێتەوە
  const PRINT_DEFAULTS = {
    printTitle: 'سیستەمی گەیاندن — ڕاپۆرتی بەڕێوەبەر',
    printSub: 'ڕاپۆرتی فەرمی تۆمارەکانی گەیاندن و وردەکارییەکان',
    printFooterRight: 'سیستەمی بەڕێوەبردنی گەیاندن',
    printFooterLeft: 'چاپکراوی فەرمی سیستەم',
    printShowTitle: true,
    printShowSub: true,
    printShowMeta: true,
    printShowFooter: true,
    printShowPrintNote: true,
  };

  function getSettings() {
    const defaults = { theme: 'dark', accent: CONFIG.DEFAULT_ACCENT, borderColor: null, rowClickFullscreen: true, reportCardLayout: true, cellTitles: false, showHints: true, showIcons: true, glow: false, glowColor: '#10b981', glowLen: 20, glowSpeed: 4, btnAnim: true, btnAnimMode: 'truck', lastWeekFill: true, watchDuplicates: true, notifDays: 1, lockScreenActions: false, shortcutsEnabled: false, shortcuts: {}, hiddenCols: [], hiddenTotals: [], ...FONT_DEFAULTS, ...PRINT_DEFAULTS };
    try {
      const s = Object.assign(defaults, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
      /* کیبۆردی تایبەت لابراوە — ڕێکخستنە کۆنەکانیشی دەسڕدرێنەوە */
      delete s.customKeypad;
      delete s.customKeypadText;
      delete s.customKeypadNum;
      /* کۆچکردن: ئەنیمەیشنی دووگمەکان — btnAnim ی کۆن (true/false) دەگوازرێتەوە بۆ btnAnimMode */
      if (s.btnAnimMode === undefined) s.btnAnimMode = (s.btnAnim === false) ? 'off' : 'truck';
      return s;
    } catch (_) {
      return defaults;
    }
  }

  /* — پشاندان/شاردنەوەی ستوونەکان و کارتەکانی تۆتاڵ — */
  const isColHidden = key => (getSettings().hiddenCols || []).includes(key);
  const isTotalHidden = key => (getSettings().hiddenTotals || []).includes(key);

  function saveSettings(patch) {
    const next = { ...getSettings(), ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    applySettings();
    return next;
  }

  function applySettings() {
    const s = getSettings();
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.style.setProperty('--accent', s.accent);
    // ڕەنگی سترۆکی تایبەت — ئەگەر بەکارهێنەر ڕەنگی دیاریکردبێت جێی بگرێت، ئەگینا null بکەیتەوە بۆ ئەوەی CSS-ی تیمەکە کار بکات
    if (s.borderColor) {
      document.documentElement.style.setProperty('--border', s.borderColor);
    } else {
      document.documentElement.style.removeProperty('--border');
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = s.theme === 'dark' ? '#0b1220' : '#eef2f9';

    // شێوازی پیشاندانی خشتەکان — ناونیشانی ستوونەکان لەناو خانەکانی خۆیان
    document.documentElement.classList.toggle('cell-titles', !!s.cellTitles);
    // پشاندان/شاردنەوەی سەرجەم تێبینی و ڕوونکردنەوەکان
    document.documentElement.classList.toggle('hide-hints', s.showHints === false);

    // پشاندان/شاردنەوەی ئایکۆنەکانی تایتڵەکان
    document.documentElement.classList.toggle('hide-icons', s.showIcons === false);

    // گڵۆپ — لایتێکی سوڕاو لەسەر چوارچێوەی کارت و ویندۆیەکان
    // glowSpeed: ١-١٠ (بەرزتر = خێراتر) → ماوەی یەک سوڕ ب چرکە
    document.documentElement.classList.toggle('glow-on', !!s.glow);
    document.documentElement.style.setProperty('--glow-color', s.glowColor || '#10b981');
    document.documentElement.style.setProperty('--glow-len', Math.min(60, Math.max(5, Number(s.glowLen) || 20)) + '%');
    document.documentElement.style.setProperty('--glow-speed', Math.max(0.4, 11 - (Number(s.glowSpeed) || 4)) + 's');

    // فۆنت و قەبارەی نووسین — بەڕێوەبەر دەیانگۆڕێت لە ڕێکخستنەکان
    const scale = v => Math.min(1.5, Math.max(0.8, Number(v) || 1));
    const fontScale = scale(s.fontScale);
    const recScale = scale(s.recordsFontScale);
    const totScale = scale(s.totalsFontScale);
    document.documentElement.style.fontSize = (fontScale * 100) + '%';
    document.documentElement.style.setProperty('--sys-fs', String(fontScale));
    document.documentElement.style.setProperty('--rec-fs', String(recScale));
    document.documentElement.style.setProperty('--tot-fs', String(totScale));
    const fam = ['Vazirmatn', 'Tahoma', 'Segoe UI', 'Arial', 'sans-serif'].includes(s.fontFamily) ? s.fontFamily : 'Vazirmatn';
    document.documentElement.style.setProperty('--font', `'${fam}', 'Segoe UI', Tahoma, sans-serif`);
  }

  /* ---------------- کاشی لیستەکان (بەکارهێنەران و زۆنەکان و سەیارەکان) ---------------- */

  let memoryLists = null;

  /** ناوی/ژمارەی سەیارە لە ڕیزی vehiclesv2 — یەک لۆژیک بۆ هەموو بەشەکانی سیستەم */
  const VEH_KEYS = ['vehicle_number', 'plate_number', 'number', 'name', 'vehicle', 'plate'];
  const VEH_SKIP = ['id', 'created_at', 'updated_at', 'inserted_at'];
  function vehicleLabel(v) {
    if (!v) return '';
    let k = VEH_KEYS.find(x => v[x] !== undefined && v[x] !== null);
    if (!k) k = Object.keys(v).find(x => !VEH_SKIP.includes(x) && v[x] !== null && v[x] !== undefined);
    return k ? String(v[k]).trim() : '';
  }

  /** ئەگەر لیستی سەیارەکان کۆن بوو (>٦٠ چرکە) لە Supabase نوێی دەکاتەوە */
  async function ensureFreshVehicles(lists) {
    if (!lists) return lists;
    if (lists.vehiclesTs && Date.now() - lists.vehiclesTs < VEHICLES_TTL_MS) return lists;
    try {
      const v = await API.Lists.vehicles();
      lists.vehicles = Array.isArray(v) ? v : [];
      lists.vehiclesTs = Date.now();
      if (memoryLists === lists) {
        try { localStorage.setItem(LISTS_CACHE_KEY, JSON.stringify(lists)); } catch (_) {}
      }
    } catch (err) {
      console.warn('نەتوانرا ژمارەی سەیارەکان لە Supabase نوێ بکرێنەوە:', err);
    }
    return lists;
  }

  async function loadLists(force = false) {
    if (memoryLists && !force) return ensureFreshVehicles(memoryLists);

    try {
      const raw = localStorage.getItem(LISTS_CACHE_KEY);
      if (raw && !force) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < LISTS_TTL_MS && cached.users && cached.zones) {
          memoryLists = cached;
          return ensureFreshVehicles(cached);
        }
      }
    } catch (_) { /* کاشی خراپ — پشتگوێ بخرێت */ }

    let vehiclesOk = true;
    const [users, zones, vehicles, profData] = await Promise.all([
      API.Lists.users(),
      API.Lists.zones(),
      API.Lists.vehicles().catch(err => {
        console.warn('نەتوانرا لیستی سەیارەکان لە vehiclesv2 بهێنرێت:', err);
        vehiclesOk = false;
        return [];
      }),
      API.Professions.all().catch(err => {
        console.warn('نەتوانرا لیستی پیشەکان بهێنرێت:', err);
        return { names: [], permsRaw: null };
      }),
    ]);
    memoryLists = {
      ts: Date.now(),
      users: UI.sortUsers(users),
      zones,
      vehicles: vehicles || [],
      vehiclesTs: vehiclesOk ? Date.now() : 0,
      professions: (profData.names || []).map(r => r.profession),
      perms: API.Professions.parsePerms(profData.permsRaw),
    };
    try { localStorage.setItem(LISTS_CACHE_KEY, JSON.stringify(memoryLists)); } catch (_) {}
    return memoryLists;
  }

  function invalidateLists() {
    memoryLists = null;
    localStorage.removeItem(LISTS_CACHE_KEY);
  }

  /* — پیشەکان و دەسەڵاتەکان — خوێندنەوەی خێرا لە کاش — */

  function cachedLists() {
    if (memoryLists) return memoryLists;
    try {
      const raw = localStorage.getItem(LISTS_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  /** کۆنفیگی دەسەڵاتەکان — { professions: {پیشە: {view:{},act:{}}}, users: {ئایدی: {view:{},act:{}}} } */
  function getPermsConfig() {
    const src = cachedLists();
    return (src && src.perms) || {};
  }

  /** پیشە زیادکراوەکان لە خشتەی professions (بێ بنەڕەتییەکان) */
  function getCustomProfessions() {
    const src = cachedLists();
    return (src && Array.isArray(src.professions)) ? src.professions : [];
  }

  function patchListsCache(patch) {
    if (memoryLists) {
      Object.assign(memoryLists, patch);
      try { localStorage.setItem(LISTS_CACHE_KEY, JSON.stringify(memoryLists)); } catch (_) {}
    } else {
      invalidateLists();
    }
  }

  /** پاشەکەوتی کۆنفیگی دەسەڵاتەکان لە Supabase + کاشی ناوخۆ */
  async function savePermsConfig(config) {
    await API.Professions.savePerms(config);
    patchListsCache({ perms: config || {} });
    // ئیمزای ناوخۆیی نوێ بکەرەوە — بۆ ئەوەی پشکنەری خۆکاری خۆی بۆ ئاگادار نەکاتەوە
    lastPermsSig = permsSigOf(getCustomProfessions(), config || {});
    return true;
  }

  /* — کاتی دەستپێکی کار (خانەی دەستپێک) — لە کۆنفیگی ناوەندیدا بۆ هەموو ئامێرەکان — */

  /** کاتی دەستپێک — لە کۆنفیگی ڕەمۆت؛ ئەگەر نەبوو نرخی کۆنی localStorage (بۆ ئامێری کۆن) */
  function getBaseTime() {
    const remote = getPermsConfig().baseTime;
    if (remote) return remote;
    try { return localStorage.getItem('dlv_base_time') || ''; } catch (_) { return ''; }
  }

  /** پاشەکەوتی کاتی دەستپێک بۆ هەموو ئامێرەکان */
  async function setBaseTime(t) {
    if (!t) return false;
    const cfg = JSON.parse(JSON.stringify(getPermsConfig()));
    cfg.baseTime = t;
    await savePermsConfig(cfg);
    return true;
  }

  /* — شاردنەوەی بەکارهێنەر/زۆن/سەیارە لای هەموو یوسەرەکان —
   * لە کۆنفیگی ناوەندی (cfg.hidden) پاشەکەوت دەکرێت: { users: [id], zones: [id], vehicles: [id] } */
  function getHidden(kind) {
    const h = getPermsConfig().hidden;
    return (h && Array.isArray(h[kind])) ? h[kind].map(String) : [];
  }
  const isHidden = (kind, id) => getHidden(kind).includes(String(id));
  /** تەنها ئەو توخمانە دەگەڕێنێتەوە کە نەشاردراون (بە ئایدی) */
  function visible(kind, arr) {
    const hid = getHidden(kind);
    if (!hid.length) return arr || [];
    return (arr || []).filter(x => !hid.includes(String(x && x.id)));
  }
  /** شاردنەوە/پشاندانی توخمێک — لەسەر نوێترین کۆنفیگی سێرڤەر دەنووسرێت */
  async function setHidden(kind, id, hidden) {
    let cfg;
    try {
      const data = await API.Professions.all();
      cfg = JSON.parse(JSON.stringify(API.Professions.parsePerms(data.permsRaw) || {}));
    } catch (_) {
      cfg = JSON.parse(JSON.stringify(getPermsConfig()));
    }
    cfg.hidden = cfg.hidden || {};
    const cur = new Set((Array.isArray(cfg.hidden[kind]) ? cfg.hidden[kind] : []).map(String));
    if (hidden) cur.add(String(id)); else cur.delete(String(id));
    cfg.hidden[kind] = [...cur];
    await savePermsConfig(cfg);
    return true;
  }

  /* — پشکنینی خۆکاری گۆڕانی دەسەڵاتەکان لە ئامێرەکانی تر —
   * هەر ماوەیەک جارێک خشتەی سووکی professions دەپشکنێت؛ ئەگەر گۆڕانکاری هەبوو
   * کاش نوێ دەکاتەوە و ڕووداوی dlv-perms-changed دەنێرێت بۆ نوێکردنەوەی ڕووکار */
  let permsPollTimer = null;
  let lastPermsSig = null;

  function permsSigOf(names, parsedPerms) {
    return JSON.stringify([names || [], parsedPerms || {}]);
  }

  function startPermsPolling() {
    stopPermsPolling();
    const cached = cachedLists();
    lastPermsSig = permsSigOf(
      (cached && Array.isArray(cached.professions)) ? cached.professions : [],
      (cached && cached.perms) ? cached.perms : {},
    );
    const tick = async () => {
      if (document.hidden) return;
      try {
        const data = await API.Professions.all();
        const parsed = API.Professions.parsePerms(data.permsRaw);
        const sig = permsSigOf((data.names || []).map(r => r.profession), parsed);
        if (sig !== lastPermsSig) {
          lastPermsSig = sig;
          patchListsCache({
            professions: (data.names || []).map(r => r.profession),
            perms: parsed,
          });
          document.dispatchEvent(new CustomEvent('dlv-perms-changed'));
        }
      } catch (_) { /* بێ ئینتەرنێت — هەوڵی خولی داهاتوو */ }
    };
    tick();
    const sec = Math.max(5, Number(CONFIG.PERMS_POLL_SEC) || 60);
    permsPollTimer = setInterval(tick, sec * 1000);
  }

  function stopPermsPolling() {
    if (permsPollTimer) { clearInterval(permsPollTimer); permsPollTimer = null; }
    lastPermsSig = null;
  }

  /** زیادکردنی پیشەیەکی نوێ لە خشتەی professions */
  async function addProfession(name) {
    const row = await API.Professions.insert(name);
    const cur = getCustomProfessions();
    patchListsCache({ professions: cur.includes(name) ? cur : [...cur, name] });
    return row;
  }

  /** سڕینەوەی پیشەیەک بە ئایدی ڕیزەکە */
  async function removeProfession(id, name) {
    await API.Professions.remove(id);
    patchListsCache({ professions: getCustomProfessions().filter(n => n !== name) });
    return true;
  }

  /* ---------------- ماڕکێتەکان (public.market_locaetion) ---------------- */
  const MARKETS_CACHE_KEY = 'dlv_markets_cache';
  let memoryMarkets = null;

  function dedupeMarkets(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    for (const m of list) {
      if (!m) continue;
      const code = String(m.account_code || '').trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      result.push(m);
    }
    return result;
  }

  async function loadMarkets(force = false) {
    if (memoryMarkets && !force) return memoryMarkets;
    try {
      if (typeof API !== 'undefined' && API.Markets && API.Markets.list) {
        const rows = await API.Markets.list();
        if (Array.isArray(rows)) {
          if (rows.length > 0) {
            const cleanRows = dedupeMarkets(rows);
            memoryMarkets = cleanRows;
            try { localStorage.setItem(MARKETS_CACHE_KEY, JSON.stringify(cleanRows)); } catch (_) {}
            return cleanRows;
          } else {
            const cached = getCachedMarkets();
            if (cached && cached.length > 0) {
              memoryMarkets = cached;
              return cached;
            }
            memoryMarkets = [];
            return [];
          }
        }
      }
    } catch (err) {
      console.warn('نەتوانرا لیستی ماڕکێتەکان لە Supabase بهێنرێت:', err);
    }
    return getCachedMarkets();
  }

  function getCachedMarkets() {
    try {
      const raw = localStorage.getItem(MARKETS_CACHE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return dedupeMarkets(arr);
      }
    } catch (_) {}
    return [];
  }

  function saveMarketsCache(markets) {
    const clean = dedupeMarkets(markets);
    memoryMarkets = clean;
    try {
      localStorage.setItem(MARKETS_CACHE_KEY, JSON.stringify(clean));
      window.dispatchEvent(new CustomEvent('dlv-markets-changed', { detail: clean }));
      return true;
    } catch (_) {
      return false;
    }
  }

  return { getSession, setSession, updateSession, clearSession, getSettings, saveSettings, applySettings, isColHidden, isTotalHidden, loadLists, vehicleLabel, invalidateLists, getTabState, saveTabState, getPermsConfig, getHidden, isHidden, visible, setHidden, getCustomProfessions, savePermsConfig, addProfession, removeProfession, getBaseTime, setBaseTime, startPermsPolling, stopPermsPolling, PRINT_DEFAULTS, loadMarkets, getCachedMarkets, saveMarketsCache, getMarkets: getCachedMarkets, saveMarkets: saveMarketsCache };
})();


/* =========================================================
 *  ڕەشکراوەکان (Trash) — باک ئەپی هەر داتایەک کە دەسڕدرێتەوە
 *  داتای سڕاوە (تۆمار / بەکارهێنەر / زۆن / سەیارە) بۆ ٣٠ ڕۆژ لێرە دەمێنێتەوە،
 *  دواتر بە خۆکاری بە یەکجاری دەسڕدرێتەوە. لە ناو ئەم ئامێرە/وێبگەڕەدا هەڵدەگیرێت (localStorage).
 * ========================================================= */
const Trash = (() => {
  const KEY = 'dlv_trash_v1';
  const RETENTION_DAYS = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;

  const KINDS = {
    record: { label: 'تۆمار', icon: '🚚' },
    user: { label: 'بەکارهێنەر', icon: '👤' },
    zone: { label: 'زۆن', icon: '🗺️' },
    vehicle: { label: 'سەیارە', icon: '🚐' },
  };

  const read = () => {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (_) { return []; }
  };
  const write = list => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (_) { return false; }
  };

  /** سڕینەوەی یەکجاری ئەوانەی لە ٣٠ ڕۆژ تێپەڕیون */
  function purgeExpired() {
    const all = read();
    const cutoff = Date.now() - RETENTION_DAYS * DAY_MS;
    const keep = all.filter(x => x && x.deletedAt && x.deletedAt >= cutoff);
    if (keep.length !== all.length) write(keep);
    return all.length - keep.length;
  }

  function list() {
    purgeExpired();
    return read().sort((a, b) => b.deletedAt - a.deletedAt);
  }

  /** زیادکردن بۆ ڕەشکراوەکان — tid دەگەڕێنێتەوە، یان null ئەگەر شوێنی ئامێرەکە پڕ بوو */
  function add(kind, data, label) {
    if (!KINDS[kind] || !data) return null;
    const all = read().filter(x => !(x.kind === kind && x.data && data.id !== undefined && x.data.id === data.id));
    const tid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    all.push({ tid, kind, label: String(label || ''), data: JSON.parse(JSON.stringify(data)), deletedAt: Date.now() });
    return write(all) ? tid : null;
  }

  function remove(tid) {
    write(read().filter(x => x.tid !== tid));
  }

  function clear() {
    write([]);
  }

  /** ڕۆژی ماوە تا سڕینەوەی خۆکار */
  function daysLeft(item) {
    const left = Math.ceil((item.deletedAt + RETENTION_DAYS * DAY_MS - Date.now()) / DAY_MS);
    return Math.max(0, left);
  }

  /** باک ئەپ + سڕینەوە: سەرەتا لە ڕەشکراوەکان هەڵدەگیرێت، پاشان doDelete جێبەجێ دەکرێت؛
   *  ئەگەر سڕینەوە شکستی هێنا، لە ڕەشکراوەکان لادەبرێتەوە. false = بەکارهێنەر پاشگەز بووەوە */
  async function guardDelete(kind, data, label, doDelete) {
    const tid = add(kind, data, label);
    if (!tid) {
      const ok = await UI.confirmDialog('شوێنی هەڵگرتن لەم ئامێرەدا پڕە و ناتوانرێت لە «ڕەشکراوەکان» باک ئەپ بکرێت.\nدەتەوێت بەبێ باک ئەپ بیسڕیتەوە؟', {
        danger: true, okLabel: 'بەڵێ، بەبێ باک ئەپ بیسڕەوە', cancelLabel: 'پاشگەزبوونەوە'
      });
      if (!ok) return false;
    }
    try {
      await doDelete();
    } catch (err) {
      if (tid) remove(tid);
      throw err;
    }
    return true;
  }

  return { KINDS, RETENTION_DAYS, list, add, remove, clear, daysLeft, purgeExpired, guardDelete };
})();
try { Trash.purgeExpired(); } catch (_) { /* بێدەنگ */ }
