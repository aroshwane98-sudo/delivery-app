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
  VEHICLES_TABLE: 'vehiclesv2',

  /* دەروازەی پارێزراو — Supabase Edge Function کە هەموو داتاکان بە ئەوەوە تێپەڕ دەبن.
   * پاش جێبەجێکردنی فەنکشنەکە (سەیری SECURITY-GUIDE.md بکە) ئەم بەستانە دابنێ:
   * 'https://gyxfgtoedunvkduslhld.supabase.co/functions/v1/gateway'
   * بەتاڵ بێت = ڕێگای ڕاستەوخۆی کۆن (بێ پاراستنی سێرڤەر) */
  GATEWAY_URL: 'https://gyxfgtoedunvkduslhld.supabase.co/functions/v1/gateway',

  /* زانیاری بەکارهێنەر */
  PROFESSION_DRIVER: 'سایەق',
  PROFESSION_DISTRIBUTOR: 'دابەشکار',
  PROFESSION_DELEGATE: 'مەندوب',
  PROFESSION_SUPERVISOR: 'بەریوبەر',
  PROFESSION_ASSISTANT: 'یاریدەدەر',

  /* زگماکی باری دووەم/سێیەم — ماوەی پێویست (خولەک) پاش گەشتنەوەی پێشوو */
  CARGO_GAP_MINUTES: 5,

  /* زۆرترین ژمارەی بار (گەشت) بۆ هەر شۆفێرێک لە ڕۆژێکدا */
  MAX_CARGOS_PER_DAY: 3,

  /* پاشگرەی ناوی شۆفێر بۆ باری دووەم و سێیەم */
  CARGO_SUFFIXES: ['', ' دوو', ' سێ'],
  CARGO_LABELS: ['باری یەکەم', 'باری دووەم', 'باری سێیەم'],

  /* کۆدی وڵات — بۆ گۆڕینی ژمارەی خۆکەی (٠٧…) بۆ فۆرماتی نێودەوڵەتی (واتسئەپ/تەلەگرام) */
  PHONE_COUNTRY_CODE: '964',

  /* نوێبوونەوەی خۆکار (چرکە) */
  DRIVER_REFRESH_SEC: 45,
  REPORTS_REFRESH_SEC: 60,

  /* پشکنینی گۆڕانی دەسەڵاتەکان لە ئامێرەکانی تر (چرکە) */
  PERMS_POLL_SEC: 60,

  /* ڕەنگە بنەڕەتییەکان */
  DEFAULT_ACCENT: '#10b981',
  ACCENT_PRESETS: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'],

  /* ستوونەکانی خشتەی تۆمارەکان — بۆ پشاندان/شاردنەوەی دانە دانە لە ڕێکخستنەکان
   * (هەمان key لە هەردوو بەشی ڕاپۆرت و تۆمارەکانی بەڕێوبەر بەکاردێت) */
  TABLE_COLUMNS: [
    { key: 'record_date', label: 'بەروار' },
    { key: 'weekday', label: 'ڕۆژی حەفتە' },
    { key: 'driver', label: 'شۆفێر' },
    { key: 'distributor', label: 'دابەشکار' },
    { key: 'delegate', label: 'مەندوب' },
    { key: 'zone', label: 'زۆن' },
    { key: 'vehicle', label: 'سەیارە' },
    { key: 'cargo_weight', label: 'کێش (کگم)' },
    { key: 'pieces_count', label: 'پارچە' },
    { key: 'receipt_number', label: 'وەسڵ' },
    { key: 'record_time', label: 'دەرچوون' },
    { key: 'in_zone_time', label: 'ناو زۆن' },
    { key: 'out_zone_time', label: 'دەرێی زۆن' },
    { key: 'arrival_time', label: 'گەشتنەوە' },
    { key: 'work_time', label: 'کاتی کارکردن' },
    { key: 'collected_money', label: 'پارەی هێنراوە' },
  ],

  /* کارتەکانی ویندۆی تۆتاڵەکان — بۆ پشاندان/شاردنەوەی دانە دانە */
  TOTAL_CARDS: [
    { key: 'trips', label: 'گەشت' },
    { key: 'weight', label: 'کۆی کێش' },
    { key: 'pieces', label: 'کۆی پارچە' },
    { key: 'receipts', label: 'کۆی وەسڵ' },
    { key: 'workTime', label: 'کۆی کاتی کارکردن' },
    { key: 'money', label: 'کۆی پارەی هێنراوە' },
  ],
};
