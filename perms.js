/* =========================================================
 *  دەسەڵاتەکان — بینین و کردارەکان بەپێی پیشە و یوسەر
 *  هەر تایبەتمەندییەکی سیستەم ئۆپشنە بۆ هەر پیشەیەک و هەر یوسەرێک
 * ========================================================= */

const Perms = (() => {

  const isSup = u => !!u && (u.profession === CONFIG.PROFESSION_SUPERVISOR || u.profession === 'بەڕێوبەر' || u.profession === 'بەریوبەر');

  /* ---------------- لیستی تایبەتمەندییەکان ----------------
   * type: 'view' = دەیبینێت — 'act' = دەتوانێت ئەنجامی بدات
   * group: بۆ ڕێکخستنی لە فۆڕمی پیشەکاندا
   * -------------------------------------------------------- */
  const FEATURES = [
    // بینینی فۆڕمەکان (تابەکان)
    { group: 'tabs', key: 'tab_driver',    icon: '🚚', label: 'فۆڕمی کارەکان',          type: 'view' },
    { group: 'tabs', key: 'tab_reports',   icon: '📊', label: 'فۆڕمی ڕاپۆرت',           type: 'view' },
    { group: 'tabs', key: 'tab_contacts',  icon: '📞', label: 'فۆڕمی پەیوەندی',         type: 'view' },
    { group: 'tabs', key: 'tab_admin',     icon: '🛡️', label: 'پانێلی بەڕێوەبردن',      type: 'view' },
    { group: 'tabs', key: 'tab_settings',  icon: '⚙️', label: 'فۆڕمی ڕێکخستن',          type: 'view' },

    // کردارەکانی گەشت
    { group: 'trip', key: 'act_exit',      icon: '🚚', label: 'تۆمارکردنی دەرچوون (فۆڕمی دەرچوون)', type: 'act' },
    { group: 'trip', key: 'act_in_zone',   icon: '📍', label: 'کرداری گەیشتن بە ناو زۆن', type: 'act' },
    { group: 'trip', key: 'act_out_zone',  icon: '🚏', label: 'کرداری دەرچوون لە زۆن',   type: 'act' },
    { group: 'trip', key: 'act_arrival',   icon: '🏁', label: 'کرداری گەشتنەوە',        type: 'act' },
    { group: 'trip', key: 'act_money',     icon: '💰', label: 'تۆمارکردنی پارەی هێنراوە', type: 'act' },
    { group: 'trip', key: 'act_edit_data',           icon: '✏️', label: 'دەستکاریکردنی داتاکان',                           type: 'act' },
    { group: 'trip', key: 'act_bypass_field_lock',   icon: '🔓', label: 'تێپەڕاندنی قفڵی خانەکان (دەستکاری داتا دوای قفڵبوون)', type: 'act' },

    // ڕاپۆرت
    { group: 'reports', key: 'rep_view_all',       icon: '🗂', label: 'بینینی هەموو تۆمارەکان (نەک تەنها تۆمارەکانی خۆی)', type: 'view' },
    { group: 'reports', key: 'rep_filter_driver',  icon: '🧑‍✈️', label: 'فلتەری شۆفێر',           type: 'view' },
    { group: 'reports', key: 'rep_filter_out_zone', icon: '🚏', label: 'فلتەری دەرێی زۆن',       type: 'view' },
    { group: 'reports', key: 'rep_filter_arrival', icon: '🏁', label: 'فلتەری گەشتنەوە',        type: 'view' },
    { group: 'reports', key: 'rep_filter_second',  icon: '📦', label: 'فلتەری تەنها باری دووەم', type: 'view' },
    { group: 'reports', key: 'rep_edit',           icon: '✏️', label: 'دەستکاریکردنی تۆمار',    type: 'act' },
    { group: 'reports', key: 'rep_delete',         icon: '🗑', label: 'سڕینەوەی تۆمار',         type: 'act' },

    // پانێلی بەڕێوەبردن — بەشەکان
    { group: 'admin', key: 'admin_records', icon: '🚚', label: 'بەشی تۆمارەکان',   type: 'view' },
    { group: 'admin', key: 'admin_users',   icon: '👥', label: 'بەشی بەکارهێنەران', type: 'view' },
    { group: 'admin', key: 'admin_zones',   icon: '🗺️', label: 'بەشی زۆنەکان',     type: 'view' },

    // ڕێکخستن و ئەوانیتر
    { group: 'settings', key: 'set_font',      icon: '🔠', label: 'ڕێکخستنی فۆنت و قەبارەی نووسین', type: 'view' },
    { group: 'settings', key: 'set_keypad',    icon: '⌨️', label: 'ڕێکخستنی کیبۆردی تایبەتی',  type: 'view' },
    { group: 'settings', key: 'set_lockscreen', icon: '📱', label: 'ڕێکخستنی شاشەی قفڵ',       type: 'view' },
    { group: 'settings', key: 'set_notif',     icon: '🔔', label: 'ڕێکخستنی نۆتیفیکەیشنەکان', type: 'view' },
    { group: 'settings', key: 'set_print',     icon: '🖨️', label: 'ناوەڕۆکی پرێنتکردن',       type: 'view' },
    { group: 'settings', key: 'set_backup',    icon: '💾', label: 'باکئەپی خۆکار',            type: 'view' },
    { group: 'settings', key: 'notif_bell',    icon: '🔔', label: 'زەنگی نۆتیفیکەیشن لە سەرپەڕ', type: 'view' },
  ];

  const GROUPS = [
    { key: 'tabs',     label: '🧭 بینینی فۆڕمەکان' },
    { key: 'trip',     label: '🚚 کردارەکانی گەشت' },
    { key: 'reports',  label: '📊 ڕاپۆرت' },
    { key: 'admin',    label: '🛡️ پانێلی بەڕێوەبردن' },
    { key: 'settings', label: '⚙️ ڕێکخستن و ئەوانیتر' },
  ];

  /* ---------------- بنەڕەتەکان — هەمان ڕەفتاری ئێستای سیستەم ---------------- */

  const P = CONFIG.PROFESSION_DRIVER;
  const D = CONFIG.PROFESSION_DISTRIBUTOR;
  const DL = CONFIG.PROFESSION_DELEGATE;
  const A = CONFIG.PROFESSION_ASSISTANT;

  const DEFAULTS = {
    [P]: {
      view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_second: true },
      act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
    },
    [D]: {
      view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_second: true },
      act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
    },
    // مەندوب — تەنها ڕاپۆرتی خۆی و پەیوەندی و ڕێکخستن (دەکرێت لە فۆڕمی پیشە چالاک بکرێت بۆ زیاتر)
    [DL]: {
      view: { tab_reports: true, tab_contacts: true, tab_settings: true },
      act: {},
    },
    // یاریدەدەر — وەک سایەق + فلتەرەکانی گەشت + زەنگی نۆتیفیکەیشن
    [A]: {
      view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_out_zone: true, rep_filter_arrival: true, notif_bell: true },
      act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
    },
  };

  // بنەڕەت بۆ پیشەی نوێ دروستکراو — مینیمال، بەڕێوەبەر خۆی زیاد دەکات
  const NEW_DEFAULT = {
    view: { tab_reports: true, tab_contacts: true, tab_settings: true },
    act: {},
  };

  const defaultsFor = prof => DEFAULTS[prof] || NEW_DEFAULT;

  /* ---------------- پشکنینی دەسەڵات ----------------
   * ڕیزبەندی: بەڕێوەبەر (هەمیشە هەموو شت) ← یوسەر override ← پیشە override ← بنەڕەت
   * ------------------------------------------------ */
  function can(u, type, key) {
    if (!u) return false;
    if (isSup(u)) return true;
    const cfg = Store.getPermsConfig();
    const uv = cfg.users && cfg.users[String(u.id)] && cfg.users[String(u.id)][type];
    if (uv && uv[key] !== undefined) return !!uv[key];
    const pv = cfg.professions && cfg.professions[u.profession] && cfg.professions[u.profession][type];
    if (pv && pv[key] !== undefined) return !!pv[key];
    return !!(defaultsFor(u.profession)[type] && defaultsFor(u.profession)[type][key]);
  }

  const canView = (u, key) => can(u, 'view', key);
  const canAct = (u, key) => can(u, 'act', key);

  /** نرخە کۆتایییەکە کە لە ئێدیتەردا پیشان دەدرێت */
  function effective(prof, userId, type, key) {
    const cfg = Store.getPermsConfig();
    if (userId !== undefined && userId !== null) {
      const uc = cfg.users && cfg.users[String(userId)];
      if (uc && uc[type] && uc[type][key] !== undefined) return !!uc[type][key];
    }
    const pc = cfg.professions && cfg.professions[prof];
    if (pc && pc[type] && pc[type][key] !== undefined) return !!pc[type][key];
    return !!(defaultsFor(prof)[type] && defaultsFor(prof)[type][key]);
  }

  /** پیشە سڕدراوەکان (بنەڕەتییە شاردراوەکان) لە کۆنفیگەکەوە */
  function getDeletedProfessions() {
    const cfg = Store.getPermsConfig();
    return Array.isArray(cfg.deleted) ? cfg.deleted : [];
  }

  /** هەموو پیشەکان — بنەڕەتی + خشتەی professions + ئەوانەی لە یوسەرەکاندا هەن — جگە لە سڕدراوەکان */
  function allProfessions(users) {
    const deleted = getDeletedProfessions();
    const set = [];
    const push = p => { if (p && !set.includes(p) && !deleted.includes(p)) set.push(p); };
    [P, D, DL, CONFIG.PROFESSION_SUPERVISOR, A].forEach(push);
    (Store.getCustomProfessions() || []).forEach(push);
    (users || []).forEach(u => push(u.profession));
    return set;
  }

  /** ئیمزای دەسەڵاتەکانی یوسەرێک — بۆ دۆزینەوەی ئەوەی ئایا دەسەڵاتەکانی گۆڕاون */
  const signatureFor = u => FEATURES.map(f => (can(u, f.type, f.key) ? 1 : 0)).join('');

  /* ---------------- خانەکانی فۆڕمی دەرچوون — بۆ قفڵکردنی دانە بە دانە ---------------- */

  const FIELD_LOCK_FIELDS = [
    { key: 'driver',          label: 'ناوی سایەق',       icon: '🚚' },
    { key: 'distributor',     label: 'ناوی دابەشکار',     icon: '🧑‍💼' },
    { key: 'delegate',        label: 'ناوی مەندوب',       icon: '🙋' },
    { key: 'zone',            label: 'ناوچە / زۆن',       icon: '🗺️' },
    { key: 'vehicle',         label: 'ژمارەی سەیارە',     icon: '🚐' },
    { key: 'record_time',     label: 'کاتی دەرچوون',      icon: '🕐' },
    { key: 'in_zone_time',    label: 'کاتی ناو زۆن',      icon: '📍' },
    { key: 'out_zone_time',   label: 'کاتی دەرێی زۆن',    icon: '🚏' },
    { key: 'arrival_time',    label: 'کاتی گەشتنەوە',     icon: '🏁' },
    { key: 'cargo_weight',    label: 'کێشی بار (کگم)',    icon: '⚖️' },
    { key: 'pieces_count',    label: 'ژمارەی پارچەکان',   icon: '📦' },
    { key: 'receipt_number',  label: 'ژمارەی وەسڵ',       icon: '🧾' },
    { key: 'collected_money', label: 'پارەی هێنراوە',     icon: '💰' },
  ];

  /** لیستی خانە قفڵکراوەکان بۆ پیشەیەک/یوسەرێک — بەبێ پشکنینی کات (بۆ فۆڕمی دەسەڵاتەکان)
   *  ڕیزبەندی: یوسەر override ← پیشە override ← ڕێکخستنی گشتی (fieldLock.fields) */
  function lockFieldsFor(prof, userId) {
    const cfg = Store.getPermsConfig();
    const allKeys = FIELD_LOCK_FIELDS.map(f => f.key);
    const valid = arr => arr.filter(k => allKeys.includes(k));
    if (userId !== undefined && userId !== null) {
      const uc = cfg.users && cfg.users[String(userId)];
      if (uc && Array.isArray(uc.lockFields)) return { source: 'user', fields: valid(uc.lockFields) };
    }
    const pc = cfg.professions && cfg.professions[prof];
    if (pc && Array.isArray(pc.lockFields)) return { source: 'profession', fields: valid(pc.lockFields) };
    const flc = cfg.fieldLock || {};
    // کۆنفیگی کۆن (بێ لیستی خانەکان) → هەموو خانەکان قفڵن
    const g = Array.isArray(flc.fields) ? valid(flc.fields) : allKeys;
    return { source: 'global', fields: g };
  }

  /** ئایا کاتی قفڵبوون گەیشتووە؟ (بەپێی جۆری قفڵ: یەکسەر یان دوای خولەک) */
  function lockDue(flc, rec) {
    if (flc.type === 'immediate') return true;
    if (flc.type === 'timed') {
      const mins = Number(flc.minutes) || 0;
      if (!mins || !rec || !rec.record_time || !rec.record_date) return false;
      // کاتی تۆمارکردن: record_date + record_time
      const [hh, mm] = String(rec.record_time).split(':').map(Number);
      const savedAt = new Date(rec.record_date + 'T' + String(hh || 0).padStart(2, '0') + ':' + String(mm || 0).padStart(2, '0') + ':00');
      const elapsedMin = (Date.now() - savedAt.getTime()) / 60000;
      return elapsedMin >= mins;
    }
    return false;
  }

  /** لیستی خانە قفڵکراوەکانی تۆمارێک بۆ یوسەرێکی دیاریکراو — کات + دابەشکردنی خانەکان بەپێی پیشە/یوسەر */
  function lockedFieldsOf(rec, user) {
    const cfg = Store.getPermsConfig();
    const flc = cfg && cfg.fieldLock;
    if (!flc || !flc.enabled) return [];
    if (user && isSup(user)) return [];
    if (!lockDue(flc, rec)) return [];
    return lockFieldsFor(user ? user.profession : undefined, user ? user.id : null).fields.slice();
  }

  /** پشکنینی قفڵبوونی تۆمارێک — بە ناوی خانە: تەنها ئەو خانەیە؛ بەبێ ناوی خانە: ئەگەر هەر خانەیەک قفڵبێت */
  function isRecordLocked(rec, field, user) {
    const locked = lockedFieldsOf(rec, user);
    if (field !== undefined && field !== null) return locked.includes(field);
    return locked.length > 0;
  }

  return { FEATURES, GROUPS, isSup, canView, canAct, can, defaultsFor, effective, allProfessions, getDeletedProfessions, signatureFor, NEW_DEFAULT, FIELD_LOCK_FIELDS, lockFieldsFor, lockedFieldsOf, isRecordLocked };
})();
