/* =========================================================
 *  کۆگای دۆخی سیستەم — سێشن، ڕووکار، لیستەکان
 * ========================================================= */

const Store = (() => {
  const SESSION_KEY = 'dlv_session';
  const SETTINGS_KEY = 'dlv_settings';
  const LISTS_CACHE_KEY = 'dlv_lists_cache';
  const LISTS_TTL_MS = 10 * 60 * 1000; // ١٠ خولەک

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

  /* ---------------- ڕووکار (ڕوون/تاریک + ڕەنگ) ---------------- */

  function getSettings() {
    try {
      return Object.assign(
        { theme: 'dark', accent: CONFIG.DEFAULT_ACCENT },
        JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
      );
    } catch (_) {
      return { theme: 'dark', accent: CONFIG.DEFAULT_ACCENT };
    }
  }

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
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = s.theme === 'dark' ? '#0b1220' : '#eef2f9';
  }

  /* ---------------- کاشی لیستەکان (بەکارهێنەران و زۆنەکان) ---------------- */

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

    const [users, zones] = await Promise.all([API.Lists.users(), API.Lists.zones()]);
    memoryLists = { ts: Date.now(), users, zones };
    try { localStorage.setItem(LISTS_CACHE_KEY, JSON.stringify(memoryLists)); } catch (_) {}
    return memoryLists;
  }

  function invalidateLists() {
    memoryLists = null;
    localStorage.removeItem(LISTS_CACHE_KEY);
  }

  return { getSession, setSession, updateSession, clearSession, getSettings, saveSettings, applySettings, loadLists, invalidateLists };
})();
