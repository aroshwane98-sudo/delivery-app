/* =========================================================
 *  کۆگای دۆخی سیستەم — سێشن، ڕووکار، لیستەکان
 * ========================================================= */

const Store = (() => {
  const SESSION_KEY = 'dlv_session';
  const SETTINGS_KEY = 'dlv_settings';
  const LISTS_CACHE_KEY = 'dlv_lists_cache';
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
    const defaults = { theme: 'dark', accent: CONFIG.DEFAULT_ACCENT, borderColor: null, rowClickFullscreen: true, reportCardLayout: true, cellTitles: false, showHints: true, showIcons: true, glow: false, glowColor: '#10b981', glowLen: 20, glowSpeed: 4, btnAnim: true, btnAnimMode: 'truck', lastWeekFill: true, notifDays: 1, lockScreenActions: false, customKeypadText: false, customKeypadNum: false, hiddenCols: [], hiddenTotals: [], ...FONT_DEFAULTS, ...PRINT_DEFAULTS };
    try {
      const s = Object.assign(defaults, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
      /* کۆچکردن: ڕێکخستنی کۆنی customKeypad دابەش دەکرێت بۆ دوو ڕێکخستنی جیا */
      if (s.customKeypadText === undefined) s.customKeypadText = !!s.customKeypad;
      if (s.customKeypadNum === undefined) s.customKeypadNum = !!s.customKeypad;
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

  async function loadLists(force = false) {
    if (memoryLists && !force) return memoryLists;

    try {
      const raw = localStorage.getItem(LISTS_CACHE_KEY);
      if (raw && !force) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < LISTS_TTL_MS && cached.users && cached.zones) {
          memoryLists = cached;
          return cached;
        }
      }
    } catch (_) { /* کاشی خراپ — پشتگوێ بخرێت */ }

    const [users, zones, vehicles, profData] = await Promise.all([
      API.Lists.users(),
      API.Lists.zones(),
      API.Lists.vehicles().catch(err => {
        console.warn('نەتوانرا لیستی سەیارەکان لە vehiclesv2 بهێنرێت:', err);
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

  return { getSession, setSession, updateSession, clearSession, getSettings, saveSettings, applySettings, isColHidden, isTotalHidden, loadLists, invalidateLists, getTabState, saveTabState, getPermsConfig, getCustomProfessions, savePermsConfig, addProfession, removeProfession, getBaseTime, setBaseTime, startPermsPolling, stopPermsPolling, PRINT_DEFAULTS };
})();
