/* =========================================================
 *  ڕێکخستنە گشتییەکانی سیستەم — Delivery System Config
 * ========================================================= */

const CONFIG = {
  APP_NAME: 'سیستەمی گەیاندن',
  APP_VERSION: '1.0.0',

  /* پڕۆژەی یەکەم — خشتەی تۆمارەکانی گەیاندن */
  RECORDS_URL: 'https://rivwvzdjfotkjhpuwuaf.supabase.co/rest/v1',
  RECORDS_KEY: 'sb_publishable_Chpd_Xgyls9HJQJl3TPV3A_UMojpoGA',
  RECORDS_TABLE: 'delivery_records',

  /* پڕۆژەی دووەم — خشتەی لیست بۆکسەکان (بەکارهێنەران و زۆنەکان) */
  LISTS_URL: 'https://gyxfgtoedunvkduslhld.supabase.co/rest/v1',
  LISTS_KEY: 'sb_publishable_BTTzGtfcBPzeX6Byx3tX1Q_eDVfGp12',
  USERS_TABLE: 'usersv2',
  ZONES_TABLE: 'zonesv2',

  /* زانیاری بەکارهێنەر */
  PROFESSION_DRIVER: 'سایەق',
  PROFESSION_DISTRIBUTOR: 'دابەشکار',
  PROFESSION_DELEGATE: 'مەندوب',
  PROFESSION_SUPERVISOR: 'بەریوبەر',

  /* زگماکی باری دووەم/سێیەم — ماوەی پێویست (خولەک) پاش گەشتنەوەی پێشوو */
  CARGO_GAP_MINUTES: 5,

  /* زۆرترین ژمارەی بار (گەشت) بۆ هەر شۆفێرێک لە ڕۆژێکدا */
  MAX_CARGOS_PER_DAY: 3,

  /* پاشگرەی ناوی شۆفێر بۆ باری دووەم و سێیەم */
  CARGO_SUFFIXES: ['', ' دوو', ' سێ'],
  CARGO_LABELS: ['باری یەکەم', 'باری دووەم', 'باری سێیەم'],

  /* نوێبوونەوەی خۆکار (چرکە) */
  DRIVER_REFRESH_SEC: 45,
  REPORTS_REFRESH_SEC: 60,

  /* ڕەنگە بنەڕەتییەکان */
  DEFAULT_ACCENT: '#10b981',
  ACCENT_PRESETS: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'],
};
