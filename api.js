/* =========================================================
 *  لایەری پەیوەندی بە Supabase — REST API Layer
 * ========================================================= */

const API = (() => {

  async function request(base, key, path, { method = 'GET', body = null, prefer = null, timeoutMs = 15000 } = {}) {
    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    if (prefer) headers['Prefer'] = prefer;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch(base + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal
      });
    } catch (netErr) {
      clearTimeout(timer);
      if (netErr.name === 'AbortError') {
        throw new Error('کاتی پەیوەندی بەسەرچوو بەهۆی خاوی هێڵی ئینتەرنێت — تکایە دووبارە هەوڵبدەرەوە');
      }
      throw new Error('پەیوەندی بە سێرڤەرەوە نەکرا — تکایە هێڵی ئینتەرنێتەکەت پشکنین بکە');
    } finally {
      clearTimeout(timer);
    }

    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (_) { data = null; } }

    if (!res.ok) {
      let msg = data && data.message ? data.message : `هەڵەیەکی ڕایەڵە ڕوویدا (${res.status})`;
      if (res.status === 409 || (data && data.code === '23505')) {
        msg = 'ئەم تۆمارە یان بەکارهێنەرە پێشتر لە سیستەمدا بوونی هەیە (دووبارەیە)';
      }
      const err = new Error(msg);
      err.code = data && data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function qs(params) {
    const p = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      // ئەگەر نرخەکە ئەرەیە بێت (بۆ نموونە مەودای بەروار)، هەمووی زیاد دەکات
      (Array.isArray(v) ? v : [v]).forEach(x => p.append(k, x));
    });
    return p.toString() ? '?' + p.toString() : '';
  }

  /* ---------------- دەروازەی پارێزراو (Supabase Edge Function) ----------------
   * کاتێک CONFIG.GATEWAY_URL دانراوە، هەموو داتاکان بە دەروازەکەوە تێپەڕ دەبن:
   * چوونەژوورەوە لە سێرڤەر پشکنین دەکرێت، تێپەڕەوشەکان بۆ کڵایەنت نانێردران،
   * و دەسەڵاتەکان لە سێرڤەرەوە جێبەجێ دەبن — نەک تەنها لە ڕووکارەکەدا. */

  const gwOn = () => !!CONFIG.GATEWAY_URL;

  function appToken() {
    try {
      if (typeof Store !== 'undefined' && Store.getSession) {
        const s = Store.getSession();
        return s && s.token ? s.token : null;
      }
    } catch (_) {}
    return null;
  }

  async function gw(op, payload = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': CONFIG.LISTS_KEY,
      'Authorization': `Bearer ${CONFIG.LISTS_KEY}`,
    };
    const tk = appToken();
    if (tk) headers['X-App-Token'] = tk;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res;
    try {
      res = await fetch(CONFIG.GATEWAY_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ op, payload }),
        signal: controller.signal,
      });
    } catch (netErr) {
      clearTimeout(timer);
      if (netErr.name === 'AbortError') {
        throw new Error('کاتی پەیوەندی بەسەرچوو بەهۆی خاوی هێڵی ئینتەرنێت — تکایە دووبارە هەوڵبدەرەوە');
      }
      throw new Error('پەیوەندی بە دەروازەی سیستەمەوە نەکرا — تکایە هێڵی ئینتەرنێتەکەت پشکنین بکە');
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch (_) { data = null; } }

    if (!res.ok || !data || data.ok !== true) {
      const code = data && data.code;
      const err = new Error((data && data.error) || `هەڵەیەکی ڕایەڵە ڕوویدا (${res.status})`);
      err.code = code;
      err.status = res.status;
      // سێشنەکە بەسەرچووە یان دروست نییە — گەڕانەوە بۆ شاشەی چوونەژوورەوە
      // (تێبینی: BAD_CREDENTIALS ی چوونەژوورەوە ناگرێتەوە — تەنها سێشنی کۆن)
      if (code === 'AUTH_REQUIRED' || code === 'TOKEN_INVALID' || code === 'TOKEN_EXPIRED') {
        const hadSession = !!appToken();
        try { if (typeof Store !== 'undefined') Store.clearSession(); } catch (_) {}
        if (hadSession) setTimeout(() => location.reload(), 60);
      }
      throw err;
    }
    return data.data;
  }

  /* ---------------- خشتەی تۆمارەکانی گەیاندن ---------------- */

  // ستوونە زگماکییەکانی delivery_records — تەنها ئەگەر نەتوانرا ستوونەکان
  // لە داتای زیندووەوە ببینرێن بەکاردەهێنرێن (خشتە بەتاڵ بێت)
  const RECORDS_FALLBACK_COLUMNS = [
    'id', 'driver', 'distributor', 'delegate', 'zone', 'vehicle',
    'cargo_weight', 'pieces_count', 'receipt_number',
    'record_date', 'record_time', 'in_zone_time', 'out_zone_time',
    'arrival_time', 'collected_money',
  ];

  let _recordsColumnsPromise = null;

  /** دۆزینەوەی ستوونە ڕاستەقینەکانی خشتەکە لە یەک ڕیزی نموونەوە (کاشکراو بۆ سێشن) */
  function detectRecordsColumns() {
    if (!_recordsColumnsPromise) {
      _recordsColumnsPromise = gwOn()
        ? gw('records.columns', {})
          .then(d => (d && Array.isArray(d.columns) && d.columns.length) ? d.columns : RECORDS_FALLBACK_COLUMNS.slice())
          .catch(() => RECORDS_FALLBACK_COLUMNS.slice())
        : request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
          `/${CONFIG.RECORDS_TABLE}?select=*&limit=1`)
          .then(rows => (rows && rows[0] && Object.keys(rows[0]).length)
            ? Object.keys(rows[0])
            : RECORDS_FALLBACK_COLUMNS.slice())
          .catch(() => RECORDS_FALLBACK_COLUMNS.slice());
    }
    return _recordsColumnsPromise;
  }

  /**
   * پاککردنەوەی پاکێجی نووسین: لابردنی ستوونەکانی نیەبوو لە خشتەکەدا.
   * تێبینی گرنگ: ستوونی work_time لە خشتەی ئێستای delivery_records دا نییە —
   * ناردنی ئەو ستوونە دەبێتە هۆی هەڵەی PGRST204 و پاشەکەوتکردن بەتەواوی شکست دەهێنێت.
   */
  async function sanitizeRecordPayload(row) {
    const cols = await detectRecordsColumns();
    const out = {};
    Object.entries(row || {}).forEach(([k, v]) => {
      if (cols.includes(k)) out[k] = v;
      else console.warn(`ئاگاداری: ستوونی «${k}» لە خشتەی ${CONFIG.RECORDS_TABLE} دا نییە — لە پاکێجەکەدا پشتگوێ خرا`);
    });
    return out;
  }

  /* ---------------- ئایدی بەکارهێنەران (usersv2) لە تۆمارەکاندا ---------------- */

  const USER_ID_COLUMNS = {
    driver:      'driver_id',
    distributor: 'distributor_id',
    delegate:    'delegate_id',
  };
  const FIELD_PROFESSIONS = {
    driver:      CONFIG.PROFESSION_DRIVER,
    distributor: CONFIG.PROFESSION_DISTRIBUTOR,
    delegate:    CONFIG.PROFESSION_DELEGATE,
  };

  // نۆرمالایزی ناو — وەک UI.norm بەڵام بە سەربەخۆیی (api.js پێش ui.js بار دەکرێت)
  function normName(s) {
    return String(s ?? '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ىي]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/[\u064B-\u065F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * دۆزینەوەی بەکارهێنەر بەپێی ناو لە usersv2.
   * لابردنی نیشانەی دەستکاری (+) و پاشگری باری دووەم/سێیەم (دوو/سێ) پێش بەراورد.
   * ئەگەر دوو بەکارهێنەر هەمان ناویان هەبێت، تەنها کاتێک یەکێکیان دەدۆزرێتەوە کە
   * بە پیشەی خانەکە جیابکرێتەوە — ئەگینا نەزانراوە و ئایدی بەتاڵ دەدرێتەوە.
   */
  function resolveNameToUser(users, name, profession) {
    const clean = String(name || '')
      .replace(/\s*\+\s*$/, '')
      .replace(/\s*(دوو|سێ)\s*$/, '')
      .trim();
    if (!clean) return null;
    const target = normName(clean);
    if (!target) return null;
    const all = (users || []).filter(u => normName(u.username) === target);
    if (!all.length) return null;
    if (all.length === 1) return all[0];
    const byProf = all.filter(u => u.profession === profession);
    return byProf.length === 1 ? byProf[0] : null;
  }

  /**
   * گۆڕینی ناو (یان «X و Y») بۆ ئایدی: «5» یان «5,12».
   * بەتاڵ دەگەڕێتەوە ئەگەر هیچ بەشێک نەدۆزرێتەوە.
   */
  function resolveIdsForField(users, value, profession) {
    const parts = String(value || '').split(/\s+و\s+/).map(p => p.trim()).filter(Boolean);
    if (!parts.length) return '';
    const ids = parts
      .map(p => { const u = resolveNameToUser(users, p, profession); return u ? String(u.id) : ''; })
      .filter(Boolean);
    return ids.join(',');
  }

  /** ئایا خشتەی تۆمارەکان ستوونەکانی ئایدی (driver_id و هتد) هەیە */
  async function recordsHaveUserIdColumns() {
    const cols = await detectRecordsColumns();
    return Object.values(USER_ID_COLUMNS).every(c => cols.includes(c));
  }

  /**
   * زیادکردنی ئایدییەکان (driver_id, distributor_id, delegate_id) بۆ پاکێجی نووسین
   * بە حلکردنی ناوەکان لە usersv2. ئەگەر ستوونەکان لە خشتەکەدا نەبن، هیچ زیاد ناکرێت.
   */
  async function attachUserIds(row) {
    try {
      if (!await recordsHaveUserIdColumns()) return row;
      let users = [];
      if (typeof Store !== 'undefined' && Store.loadLists) {
        const ls = await Store.loadLists();
        users = ls.users || [];
      }
      const out = { ...row };
      Object.entries(USER_ID_COLUMNS).forEach(([field, idCol]) => {
        if (out[field] !== undefined && out[field] !== null) {
          out[idCol] = resolveIdsForField(users, out[field], FIELD_PROFESSIONS[field]);
        }
      });
      return out;
    } catch (_) {
      return row; // هەڵەی هێنانی لیستی بەکارهێنەران نابێتە ڕێگر لە تۆمارکردن
    }
  }

  const Records = {
    async list(params = {}) {
      if (gwOn()) return gw('records.list', { params });
      return request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
        `/${CONFIG.RECORDS_TABLE}${qs({ select: '*', order: 'record_date.desc,id.desc', ...params })}`);
    },

    async byId(id) {
      if (gwOn()) return gw('records.byId', { id });
      const rows = await request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
        `/${CONFIG.RECORDS_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
      return rows && rows[0] ? rows[0] : null;
    },

    async insert(row) {
      if (gwOn()) return gw('records.insert', { row });
      // ئایدی بەکارهێنەران (usersv2) لەگەڵ ناوەکان تۆمار دەکرێن بۆ هاوتاکردنی ورد
      const clean = await sanitizeRecordPayload(await attachUserIds(row));
      const rows = await request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
        `/${CONFIG.RECORDS_TABLE}`, { method: 'POST', body: clean, prefer: 'return=representation' });
      return rows && rows[0] ? rows[0] : null;
    },

    /**
     * نوێکردنەوەی تۆمار.
     * تێبینی: لە داتابەیسەکەدا تریگەرێکی UPDATE هەیە کە ئاماژە بە خشتەی نیەبووی
     * "driver_audit_logs" دەدات، بۆیە PATCH لەسەر ستوونەکانی کات/پارە شکاوە (کۆد 42P01).
     * لەو حالەتەدا چارەسەری لەبەرچاوگراو: سەرەتا ڕیزی نوێ بە نرخە نوێیەکان تۆمار دەکرێت
     * (INSERT)، پاشان ڕیزی کۆن دەسڕدرێتەوە — بەم شێوەیە ئەگەر هەنگاوێک شکست بخوات
     * هیچ داتایەک وونی نابێت. (INSERT و DELETE بە ئازادی کار دەکەن)
     */
    async update(id, patch) {
      if (gwOn()) return gw('records.update', { id, patch });
      // سەرەتا ستوونە نیەبووەکان (وەک work_time) لادەبرێن — ئەگینا PGRST204
      // دەگەڕێتەوە و چارەسەری لەبەرچاوگراوەکەی خوارەوە هەرگیز کار ناکات.
      // هەروەها ئەگەر ناوی شۆفێر/دابەشکار/مەندوب گۆڕدرابێت ئایدیەکەی نوێ دەکرێتەوە.
      const clean = await sanitizeRecordPayload(await attachUserIds(patch));
      try {
        const rows = await request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
          `/${CONFIG.RECORDS_TABLE}?id=eq.${encodeURIComponent(id)}`,
          { method: 'PATCH', body: clean, prefer: 'return=representation' });
        return rows && rows[0] ? rows[0] : null;
      } catch (err) {
        if (err.code !== '42P01') throw err;

        const current = await Records.byId(id);
        if (!current) throw new Error('تۆمارەکە نەدۆزرایەوە بۆ نوێکردنەوە');
        const { id: _omit, ...rest } = current;
        const inserted = await Records.insert({ ...rest, ...clean });
        await Records.remove(id).catch(() => {
          UI.toast('ئاگاداری: تۆمارە کۆنەکە نەسڕدرایەوە — دووبارەیەکەوت دروست بوو', 'warning', 5000);
        });
        return inserted;
      }
    },

    /** ئایا ستوونێک بوونی هەیە لە خشتەی تۆمارەکاندا (بۆ نموونە work_time) */
    async hasColumn(name) {
      const cols = await detectRecordsColumns();
      return cols.includes(name);
    },

    /** ئایا خشتەی تۆمارەکان ستوونەکانی ئایدی بەکارهێنەانی تێدایە */
    async hasUserIds() {
      return recordsHaveUserIdColumns();
    },

    /**
     * پڕکردنەوەی ئایدیی تۆمارە کۆنەکان: هەموو تۆمارێکی بێ ئایدی دەهێنرێت و
     * ناوەکانی بە usersv2 بەراورد دەکرێن و ئایدییەکانی پاشەکەوت دەکرێن.
     * onProgress(done, updated) بۆ نیشاندانی پێشکەوتن.
     */
    async backfillUserIds({ onProgress } = {}) {
      if (!(await recordsHaveUserIdColumns())) {
        throw new Error('ستوونەکانی ئایدی (driver_id, distributor_id, delegate_id) لە خشتەی delivery_records دا زیاد نەکراون');
      }

      let users = [];
      if (typeof Store !== 'undefined' && Store.loadLists) {
        users = (await Store.loadLists(true)).users || [];
      }

      let lastId = 0, done = 0, updated = 0, failed = 0;
      // خوێندنەوە بە کێرسۆری id (نەک offset) چونکە ڕیزە پڕکراوەکان لە فلتەرەکە دەردەکەون
      while (true) {
        const rows = await Records.list({
          select: '*',
          or: '(driver_id.is.null,distributor_id.is.null,delegate_id.is.null)',
          id: `gt.${lastId}`,
          order: 'id.asc',
          limit: 100,
        });
        if (!rows.length) break;

        for (const r of rows) {
          if (r.id > lastId) lastId = r.id;
          const patch = {};
          Object.entries(USER_ID_COLUMNS).forEach(([field, idCol]) => {
            if (r[idCol] === null || r[idCol] === undefined || r[idCol] === '') {
              const ids = resolveIdsForField(users, r[field], FIELD_PROFESSIONS[field]);
              if (ids) patch[idCol] = ids;
            }
          });
          if (Object.keys(patch).length) {
            try {
              if (gwOn()) {
                await gw('records.update', { id: r.id, patch });
              } else {
                await request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
                  `/${CONFIG.RECORDS_TABLE}?id=eq.${encodeURIComponent(r.id)}`,
                  { method: 'PATCH', body: patch, prefer: 'return=minimal' });
              }
              updated++;
            } catch (_) {
              failed++;
            }
          }
          done++;
          if (onProgress && (done % 10 === 0 || rows.length < 100)) onProgress(done, updated);
        }
        if (rows.length < 100) break;
      }
      return { done, updated, failed };
    },

    async remove(id) {
      if (gwOn()) return gw('records.remove', { id });
      return request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
        `/${CONFIG.RECORDS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };

  /* ---------------- خشتەی لیست بۆکسەکان ---------------- */

  const Lists = {
    /**
     * ستوونی کلیلی usersv2 ناوی driver_id یە (نەک id) — بە alias ی PostgREST
     * وەک id دەخوێنرێتەوە بۆ ئەوەی تەواوی سیستەم بە user.id کار بکات.
     * لە مۆدی دەروازەدا تێپەڕەوشە (password) تەنها بۆ بەڕێوەبەر دەگەڕێتەوە.
     */
    async users() {
      if (gwOn()) return gw('lists.users', {});
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.USERS_TABLE}?select=id:driver_id,username,password,profession,avatar_url,phone_number_1,phone_number_2,location&order=driver_id`);
    },

    async zones() {
      if (gwOn()) return gw('lists.zones', {});
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.ZONES_TABLE}?select=*&order=id`);
    },

    async vehicles() {
      if (gwOn()) return gw('lists.vehicles', {});
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.VEHICLES_TABLE}?select=*&order=id`);
    },

    async insertUser(row) {
      if (gwOn()) return gw('lists.insertUser', { row });
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.USERS_TABLE}`, { method: 'POST', body: row, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async updateUser(id, patch) {
      if (gwOn()) return gw('lists.updateUser', { id, patch });
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.USERS_TABLE}?driver_id=eq.${encodeURIComponent(id)}`,
        { method: 'PATCH', body: patch, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async deleteUser(id) {
      if (gwOn()) return gw('lists.deleteUser', { id });
      const res = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.USERS_TABLE}?driver_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return res;
    },

    async insertZone(row) {
      if (gwOn()) return gw('lists.insertZone', { row });
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.ZONES_TABLE}`, { method: 'POST', body: row, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async updateZone(id, patch) {
      if (gwOn()) return gw('lists.updateZone', { id, patch });
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.ZONES_TABLE}?id=eq.${encodeURIComponent(id)}`,
        { method: 'PATCH', body: patch, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async deleteZone(id) {
      if (gwOn()) return gw('lists.deleteZone', { id });
      const res = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.ZONES_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return res;
    },
  };

  /* ---------------- خشتەی نۆتیفیکەیشنەکان (public.notifications) ---------------- */

  const Notifications = {
    /** هێنانی نۆتیفیکەیشنەکان (نوێترین لە سەرەتا) */
    async list() {
      if (gwOn()) return gw('notifications.list', {});
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        '/notifications?select=*&order=created_at.desc&limit=200');
    },

    /** ناردنی نۆتیفیکەیشن — action دەقی تەواوی گۆڕانکارییەکەیە */
    async send(action) {
      if (!action) return null;
      if (gwOn()) return gw('notifications.send', { action });
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        '/notifications', { method: 'POST', body: { action }, prefer: 'return=minimal' });
    },

    /** سڕینەوەی نۆتیفیکەیشنەکانیش کە لە N ڕۆژ پێشتر بوون */
    async removeOlderThanDays(days) {
      const n = Math.max(0, Number(days) || 0);
      if (!n) return null;
      if (gwOn()) return gw('notifications.removeOlderThanDays', { days: n });
      const cutoff = new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/notifications?created_at=lt.${encodeURIComponent(cutoff)}`, { method: 'DELETE' });
    },

    /** سڕینەوەی هەموو نۆتیفیکەیشنەکان */
    async removeAll() {
      if (gwOn()) return gw('notifications.removeAll', {});
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        '/notifications?id=gte.0', { method: 'DELETE' });
    },
  };

  /* ---------------- خشتەی پیشەکان (professions) ---------------- */

  // کۆنفیگی دەسەڵاتەکان وەک ڕیزی تایبەت لە هەمان خشتەدا پاشەکەوت دەکرێت
  // (خشتەکە تەنها ستوونی id و profession هەیە) — لێرەدا تەنها لەلایەن ئەم سیستەمەوە بەکاردێت
  const PERMS_MARKER = '__PERMS__';

  async function professionsRaw() {
    return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
      '/professions?select=*&order=id');
  }

  function splitProfessionRows(rows) {
    const out = { names: [], permsRaw: null };
    (rows || []).forEach(r => {
      if (typeof r.profession === 'string' && r.profession.startsWith(PERMS_MARKER)) {
        if (!out.permsRaw) out.permsRaw = r;
      } else if (r.profession) {
        out.names.push(r);
      }
    });
    return out;
  }

  const Professions = {
    /** هەموو ڕیزەکان — ناوی پیشەکان + ڕیزی کۆنفیگی دەسەڵاتەکان جیا دەکرێنەوە */
    async all() {
      if (gwOn()) return gw('professions.all', {});
      const rows = await professionsRaw();
      return splitProfessionRows(rows);
    },

    /** پارسکردنی ڕیزی marker بۆ ئۆبجێکتی کۆنفیگ */
    parsePerms(permsRaw) {
      if (!permsRaw || typeof permsRaw.profession !== 'string') return {};
      try { return JSON.parse(permsRaw.profession.slice(PERMS_MARKER.length)) || {}; }
      catch (_) { return {}; }
    },

    async insert(name) {
      if (gwOn()) return gw('professions.insert', { name });
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        '/professions', { method: 'POST', body: { profession: name }, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async remove(id) {
      if (gwOn()) return gw('professions.remove', { id });
      const res = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/professions?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return res;
    },

    /** پاشەکەوتی کۆنفیگی دەسەڵاتەکان — ڕیزی marker نوێ دەکرێتەوە یان دروست دەکرێت */
    async savePerms(config) {
      if (gwOn()) return gw('professions.savePerms', { config });
      const rows = await professionsRaw();
      const { permsRaw } = splitProfessionRows(rows);
      const val = PERMS_MARKER + JSON.stringify(config || {});
      if (permsRaw && permsRaw.id) {
        await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
          `/professions?id=eq.${encodeURIComponent(permsRaw.id)}`,
          { method: 'PATCH', body: { profession: val }, prefer: 'return=minimal' });
      } else {
        await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
          '/professions', { method: 'POST', body: { profession: val }, prefer: 'return=minimal' });
      }
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return true;
    },
  };

  /* ---------------- چوونەژوورەوە و هەژماری کەسی — بە دەروازەوە ---------------- */

  /** چوونەژوورەوە لە سێرڤەر — تێپەڕەوشە لە سێرڤەر پشکنین دەکرێت و تۆکنی بۆ دەگەڕێتەوە */
  function login(userId, pin) {
    return gw('login', { userId, pin });
  }

  /** لیستی یوسەران بۆ شاشەی چوونەژوورەوە — بێ زانیاری هەستیار (بێ تێپەڕەوشە و تەلەفۆن) */
  function loginOptions() {
    return gw('loginOptions', {});
  }

  /** گۆڕینی تێپەڕەوشەی خۆی — تێپەڕەوشەی ئێستا لە سێرڤەر پشکنین دەکرێت */
  function changeOwnPin(currentPin, newPin) {
    return gw('users.changeOwnPin', { currentPin, newPin });
  }

  return { Records, Lists, Notifications, Professions, login, loginOptions, changeOwnPin, gatewayActive: gwOn };
})();
