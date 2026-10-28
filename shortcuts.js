/* =========================================================
 *  شۆڕت کەتەکانی کیبۆرد (Keyboard Shortcuts)
 *  تایبەت بە بەکارهێنەرانی دیسکتۆپ
 * ========================================================= */

const Shortcuts = (() => {

  /* ---------------- دیاریکردنی دیسکتۆپ ---------------- */
  // تەنها لەو یوسەرانە کاربکاتن کە بە دیسکتۆپ دەچنە نێو سیستەمەکە
  function isDesktop() {
    if (typeof window === 'undefined') return true;
    const ua = (navigator.userAgent || '').toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    if (isMobileUA) return false;

    // ئەگەر ڕووبەری شاشە کەمتر بێت لە 992px وەک مۆبایل هەژمار دەکرێت
    if (window.innerWidth < 992) {
      return false;
    }

    // ئەگەر تاچ سکریین بێت
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      return false;
    }
    return true;
  }

  /* ---------------- پێناسەی سەرجەم کردارەکانی سیستەم ---------------- */
  const ACTION_DEFS = [
    // --- ١. گواستنەوەی نێوان تابەکان ---
    { id: 'tab_driver', label: 'تابی کارەکان / باری ئەمڕۆ', category: 'tabs', icon: 'truck', defaultKey: 'F1', permission: 'tab_driver' },
    { id: 'tab_reports', label: 'تابی ڕاپۆرت', category: 'tabs', icon: 'chart', defaultKey: 'F2', permission: 'tab_reports' },
    { id: 'tab_target', label: 'تابی تارگێت', category: 'tabs', icon: 'target', defaultKey: 'F3', permission: 'tab_target' },
    { id: 'tab_markets', label: 'تابی ماڕکێتەکان', category: 'tabs', icon: 'market', defaultKey: 'F5', permission: 'tab_markets' },
    { id: 'tab_contacts', label: 'تابی پەیوەندی', category: 'tabs', icon: 'phone', defaultKey: 'F4', permission: 'tab_contacts' },
    { id: 'tab_admin', label: 'تابی بەڕێوەبردن', category: 'tabs', icon: 'shield', defaultKey: 'F6', permission: 'tab_admin' },
    { id: 'tab_settings', label: 'تابی ڕێکخستن', category: 'tabs', icon: 'gear', defaultKey: 'F9', permission: 'tab_settings' },
    { id: 'tab_professions', label: 'تابی پیشەکان', category: 'tabs', icon: 'badge', defaultKey: 'F10', permission: 'tab_professions' },

    // --- ٢. کردارەکانی گەیاندن و کارەکان ---
    { id: 'act_new_trip', label: 'تۆمارکردنی دەرچوون / باری نوێ', category: 'trip', icon: 'plusSquare', defaultKey: 'Alt + N' },
    { id: 'act_next_stage', label: 'قۆناغی دواتری گەشت (ناو زۆن / دەرێ / گەشتنەوە)', category: 'trip', icon: 'play', defaultKey: 'Alt + S' },
    { id: 'act_record_money', label: 'تۆمارکردنی پارەی هێنراوە', category: 'trip', icon: 'money', defaultKey: 'Alt + M' },
    { id: 'act_edit_data', label: 'دەستکاریکردنی داتای باری کارا', category: 'trip', icon: 'edit', defaultKey: 'Alt + E' },

    // --- ٣. کردارەکانی بەڕێوەبردن و ڕاپۆرت ---
    { id: 'act_admin_new_record', label: 'زیادکردنی بار لە پانێلی بەڕێوەبردن', category: 'admin', icon: 'plus', defaultKey: 'Alt + A' },
    { id: 'act_reload_data', label: 'نوێکردنەوەی داتاکان (Refresh)', category: 'admin', icon: 'rotate', defaultKey: 'Alt + R' },
    { id: 'act_export_excel', label: 'دەرهێنانی داتاکان بۆ ئێکسڵ', category: 'admin', icon: 'download', defaultKey: 'Alt + X' },
    { id: 'act_print', label: 'پرێنتکردنی خشتە و ڕاپۆرت', category: 'admin', icon: 'printer', defaultKey: 'Alt + P' },
    { id: 'act_focus_search', label: 'فۆکەس لەسەر خانەی گەڕان', category: 'admin', icon: 'search', defaultKey: 'Alt + F' },
    { id: 'act_manage_zones', label: 'بەڕێوەبردنی زۆنەکان', category: 'admin', icon: 'map', defaultKey: 'Alt + Z' },
    { id: 'act_manage_users', label: 'بەڕێوەبردنی بەکارهێنەران', category: 'admin', icon: 'users', defaultKey: 'Alt + U' },
    { id: 'act_manage_vehicles', label: 'بەڕێوەبردنی سەیارەکان', category: 'admin', icon: 'truck', defaultKey: 'Alt + V' },
    { id: 'act_field_lock', label: 'ڕێکخستنی قفڵی خانەکان', category: 'admin', icon: 'lock', defaultKey: 'Alt + L' },

    // --- ٤. کردارە گشتییەکانی سیستەم ---
    { id: 'act_toggle_theme', label: 'گۆڕینی ڕووکار (تاریک / ڕوون)', category: 'general', icon: 'moon', defaultKey: 'Alt + T' },
    { id: 'act_open_notif', label: 'نۆتیفیکەیشنەکان', category: 'general', icon: 'bell', defaultKey: 'Alt + B' },
    { id: 'act_user_profile', label: 'پڕۆفایلی بەکارهێنەر', category: 'general', icon: 'user', defaultKey: 'Alt + O' },
    { id: 'act_close_modal', label: 'داخستنی مۆدال و پەنجەرەی کراوە', category: 'general', icon: 'x', defaultKey: 'Escape' },
    { id: 'act_logout', label: 'دەرچوون لە هەژمار', category: 'general', icon: 'logout', defaultKey: 'Alt + Q' },
  ];

  const CATEGORY_NAMES = {
    tabs: 'گواستنەوەی نێوان تابەکان',
    trip: 'کردارەکانی گەیاندن و کارەکان',
    admin: 'کردارەکانی بەڕێوەبردن و ڕاپۆرت',
    general: 'کردارە گشتییەکانی سیستەم',
  };

  const DEFAULT_SHORTCUTS = ACTION_DEFS.reduce((acc, act) => {
    acc[act.id] = act.defaultKey || '';
    return acc;
  }, {});

  /* ---------------- وەرگرتن و پاشەکەوتکردن ---------------- */

  function getShortcuts() {
    const s = Store.getSettings();
    const custom = s.shortcuts || {};
    const merged = {};
    ACTION_DEFS.forEach(act => {
      merged[act.id] = custom[act.id] !== undefined ? custom[act.id] : act.defaultKey;
    });
    return merged;
  }

  function getShortcut(actionId) {
    const all = getShortcuts();
    return all[actionId] || '';
  }

  function setShortcut(actionId, keyCombo) {
    const current = getShortcuts();
    current[actionId] = (keyCombo || '').trim();
    Store.saveSettings({ shortcuts: current });
  }

  function resetDefaults() {
    Store.saveSettings({ shortcuts: { ...DEFAULT_SHORTCUTS } });
  }

  /* ---------------- نۆرمالایزکردنی ڕووداوی کیبۆرد ---------------- */
  // پشتگیری لە کیبۆردی ئینگلیزی و کوردی/عەرەبی بە هەمان شێوە (لە ڕێگەی e.code)
  function normalizeEvent(e) {
    // ئەگەر تەنها دووگمەی کۆنترۆڵ یان شیفت داگیرابێت جارێ چاوەڕوان بە
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      return null;
    }

    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    let key = e.key;

    // ئەگەر دووگمەی پیت بێت، بەپێی e.code وەریگرە تا ئەگەر کیبۆردەکە لەسەر کوردی بێت هێشتا N بناسێتەوە
    if (e.code && e.code.startsWith('Key')) {
      key = e.code.slice(3); // KeyN -> N
    } else if (e.code && e.code.startsWith('Digit')) {
      key = e.code.slice(5); // Digit1 -> 1
    } else if (e.code === 'Space' || key === ' ') {
      key = 'Space';
    } else if (key && key.length === 1) {
      key = key.toUpperCase();
    }

    parts.push(key);
    return parts.join(' + ');
  }

  /* دۆزینەوەی کردار بەپێی کلیل */
  function findActionByCombo(combo) {
    if (!combo) return null;
    const all = getShortcuts();
    const normSearch = combo.toLowerCase().replace(/\s+/g, '');
    for (const [id, assigned] of Object.entries(all)) {
      if (assigned && assigned.toLowerCase().replace(/\s+/g, '') === normSearch) {
        return id;
      }
    }
    return null;
  }

  /* ---------------- جێبەجێکردنی کردارەکان ---------------- */

  const ACTION_HANDLERS = {
    tab_driver: () => App.switchTab('driver'),
    tab_reports: () => App.switchTab('reports'),
    tab_target: () => App.switchTab('target'),
    tab_markets: () => App.switchTab('markets'),
    tab_contacts: () => App.switchTab('contacts'),
    tab_admin: () => App.switchTab('admin'),
    tab_settings: () => App.switchTab('settings'),
    tab_professions: () => App.switchTab('professions'),

    act_new_trip: () => {
      const cur = App.getCurrentTab ? App.getCurrentTab() : null;
      if (cur?.id === 'admin') {
        const btn = document.querySelector('#admin-add-rec');
        if (btn) btn.click();
        else if (typeof AdminView !== 'undefined' && AdminView.openRecordModal) AdminView.openRecordModal(null);
      } else {
        const btn = document.querySelector('#act-btn');
        if (btn && btn.textContent.includes('دەرچوون')) btn.click();
        else if (typeof DriverView !== 'undefined' && DriverView.openExitModal) DriverView.openExitModal();
      }
    },

    act_next_stage: () => {
      const btn = document.querySelector('#act-btn');
      if (btn && !btn.disabled) {
        btn.click();
        UI.toast('قۆناغی گەشت جێبەجێکرا ✓', 'info', 1600);
      } else {
        UI.toast('هیچ کردارێکی گەشت لەم ساتەدا بەردەست نییە', 'warning', 2000);
      }
    },

    act_record_money: () => {
      const moneyBtn = document.querySelector('#money-btn') || document.querySelector('.btn-hist-money');
      if (moneyBtn) {
        moneyBtn.click();
      } else {
        UI.toast('دووگمەی پارەی هێنراوە لەم بەشەدا بەردەست نییە', 'warning', 2000);
      }
    },

    act_edit_data: () => {
      const editBtn = document.querySelector('#active-edit-times-btn') || document.querySelector('.btn-edit-times');
      if (editBtn) editBtn.click();
      else UI.toast('دووگمەی دەستکاری داتا بەردەست نییە', 'warning', 2000);
    },

    act_admin_new_record: () => {
      const btn = document.querySelector('#admin-add-rec');
      if (btn) btn.click();
      else if (typeof AdminView !== 'undefined' && AdminView.openRecordModal) AdminView.openRecordModal(null);
      else {
        App.switchTab('admin');
        setTimeout(() => {
          const b2 = document.querySelector('#admin-add-rec');
          if (b2) b2.click();
        }, 150);
      }
    },

    act_reload_data: () => {
      const btn = document.querySelector('#admin-reload') || document.querySelector('#rep-refresh');
      if (btn) btn.click();
      else if (typeof DriverView !== 'undefined' && DriverView.load) DriverView.load();
      UI.toast('داتاکان نوێ کرانەوە ✓', 'info', 1600);
    },

    act_export_excel: () => {
      const btn = document.querySelector('#admin-export-excel') || document.querySelector('#rep-export') || document.querySelector('#tg-export-excel');
      if (btn) btn.click();
      else UI.toast('دووگمەی دەرهێنانی ئێکسڵ لەم پەڕەیەدا نییە', 'warning', 2000);
    },

    act_print: () => {
      const btn = document.querySelector('#admin-print') || document.querySelector('#rep-print');
      if (btn) btn.click();
      else window.print();
    },

    act_focus_search: () => {
      const s = document.querySelector('#admin-search') || document.querySelector('#rep-search') || document.querySelector('input[type="search"]') || document.querySelector('.search-input');
      if (s) {
        s.focus();
        s.select();
      } else {
        UI.toast('خانەی گەڕان لەم پەڕەیەدا نییە', 'warning', 2000);
      }
    },

    act_manage_zones: () => {
      const btn = document.querySelector('#admin-open-zones');
      if (btn) btn.click();
      else if (typeof AdminView !== 'undefined' && AdminView.openZonesModal) AdminView.openZonesModal();
    },

    act_manage_users: () => {
      const btn = document.querySelector('#admin-open-users');
      if (btn) btn.click();
      else if (typeof AdminView !== 'undefined' && AdminView.openUsersModal) AdminView.openUsersModal();
    },

    act_manage_vehicles: () => {
      const btn = document.querySelector('#admin-open-vehicles');
      if (btn) btn.click();
      else if (typeof AdminView !== 'undefined' && AdminView.openVehiclesModal) AdminView.openVehiclesModal();
    },

    act_field_lock: () => {
      const btn = document.querySelector('#admin-field-lock');
      if (btn) btn.click();
      else if (typeof AdminView !== 'undefined' && AdminView.openFieldLockModal) AdminView.openFieldLockModal();
    },

    act_toggle_theme: () => {
      const s = Store.getSettings();
      const nextTheme = s.theme === 'dark' ? 'light' : 'dark';
      Store.saveSettings({ theme: nextTheme });
      UI.toast(nextTheme === 'dark' ? 'مۆدی تاریک چالاک کرا 🌙' : 'مۆدی ڕوون چالاک کرا ☀️', 'info', 1800);
      const cur = App.getCurrentTab ? App.getCurrentTab() : null;
      if (cur?.id === 'settings' && typeof SettingsView !== 'undefined') {
        SettingsView.render(document.querySelector('#page'));
      }
    },

    act_open_notif: () => {
      UI.openNotificationsPanel();
    },

    act_user_profile: () => {
      const u = App.getUser();
      if (u) UI.openUserProfile(u);
    },

    act_close_modal: () => {
      const backdrops = [...document.querySelectorAll('.modal-backdrop.open')];
      if (backdrops.length) {
        const top = backdrops[backdrops.length - 1];
        const closeBtn = top.querySelector('.modal-close') || top.querySelector('.btn-ghost');
        if (closeBtn) closeBtn.click();
        else top.classList.remove('open');
      }
    },

    act_logout: () => {
      if (App.logout) App.logout();
    },
  };

  function execute(actionId) {
    const fn = ACTION_HANDLERS[actionId];
    if (typeof fn === 'function') {
      try {
        fn();
      } catch (err) {
        console.error('Error executing shortcut action:', actionId, err);
      }
    }
  }

  /* ---------------- گوێگرتنی سەرەکی لە کلیلەکان ---------------- */

  let initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;

    window.addEventListener('keydown', (e) => {
      // ١. تەنها ئەگەر یوسەر لۆگین بووبێت
      if (!App.getUser()) return;

      // ٢. تەنها بۆ بەکارهێنەرانی دیسکتۆپ
      if (!isDesktop()) return;

      // ٣. ئایا شۆڕتکەتەکان چالاککراون؟ (بنەڕەت داخراوە تا بەکارهێنەر چالاکی دەکات)
      const s = Store.getSettings();
      if (!s.shortcutsEnabled) return;

      // ٤. ئەگەر بەکارهێنەر لەناو خانەی نووسیندابێت (input, textarea, select):
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        activeEl.isContentEditable
      );

      const combo = normalizeEvent(e);
      if (!combo) return;

      // لەناو خانەی نووسین، تەنها Escape، دووگمەکانی فانکشن (F1-F12)، یان ئەو شۆڕتکەتانەی Alt/Ctrl لەگەڵدایە کار دەکەن
      // تا پیت و ژمارە ئاساییەکان لە کاتی نووسیندا تێکنەچن
      const hasModifier = e.altKey || e.ctrlKey || e.metaKey;
      const isFunctionKey = /^F\d+$/i.test(e.key);
      if (isInput && !hasModifier && !isFunctionKey && combo !== 'Escape') {
        return;
      }

      const actionId = findActionByCombo(combo);
      if (!actionId) return;

      // کرداری هاوتا دۆزرایەوە — پێشگری لە کرداری بنەڕەتی براوسەر و جێبەجێکردن
      e.preventDefault();
      e.stopPropagation();
      execute(actionId);
    }, true);
  }

  // دەستپێکردنی خۆکار لە کاتی لۆدبوونی وێبگەڕ
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    isDesktop,
    getActions: () => ACTION_DEFS,
    getAction: id => ACTION_DEFS.find(a => a.id === id) || null,
    getCategories: () => CATEGORY_NAMES,
    getShortcuts,
    getShortcut,
    setShortcut,
    resetDefaults,
    normalizeEvent,
    findActionByCombo,
    execute,
    init,
  };
})();
