/* =========================================================
 *  لایەری پەیوەندی بە Supabase — REST API Layer
 * ========================================================= */

const API = (() => {

  async function request(base, key, path, { method = 'GET', body = null, prefer = null } = {}) {
    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    if (prefer) headers['Prefer'] = prefer;

    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : null });

    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (_) { data = null; } }

    if (!res.ok) {
      const msg = data && data.message ? data.message : `هەڵەیەکی ڕایەڵە ڕوویدا (${res.status})`;
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

  /* ---------------- خشتەی تۆمارەکانی گەیاندن ---------------- */

  const Records = {
    async list(params = {}) {
      return request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
        `/${CONFIG.RECORDS_TABLE}${qs({ select: '*', order: 'record_date.desc,id.desc', ...params })}`);
    },

    async byId(id) {
      const rows = await request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
        `/${CONFIG.RECORDS_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
      return rows && rows[0] ? rows[0] : null;
    },

    async insert(row) {
      const rows = await request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
        `/${CONFIG.RECORDS_TABLE}`, { method: 'POST', body: row, prefer: 'return=representation' });
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
      try {
        const rows = await request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
          `/${CONFIG.RECORDS_TABLE}?id=eq.${encodeURIComponent(id)}`,
          { method: 'PATCH', body: patch, prefer: 'return=representation' });
        return rows && rows[0] ? rows[0] : null;
      } catch (err) {
        if (err.code !== '42P01') throw err;

        const current = await Records.byId(id);
        if (!current) throw new Error('تۆمارەکە نەدۆزرایەوە بۆ نوێکردنەوە');
        const { id: _omit, ...rest } = current;
        const inserted = await Records.insert({ ...rest, ...patch });
        await Records.remove(id).catch(() => {
          UI.toast('ئاگاداری: تۆمارە کۆنەکە نەسڕدرایەوە — دووبارەیەکەوت دروست بوو', 'warning', 5000);
        });
        return inserted;
      }
    },

    async remove(id) {
      return request(CONFIG.RECORDS_URL, CONFIG.RECORDS_KEY,
        `/${CONFIG.RECORDS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };

  /* ---------------- خشتەی لیست بۆکسەکان ---------------- */

  const Lists = {
    async users() {
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.USERS_TABLE}?select=id,username,password,profession,avatar_url&order=id`);
    },

    async zones() {
      return request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.ZONES_TABLE}?select=*&order=id`);
    },

    async insertUser(row) {
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.USERS_TABLE}`, { method: 'POST', body: row, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async updateUser(id, patch) {
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.USERS_TABLE}?id=eq.${encodeURIComponent(id)}`,
        { method: 'PATCH', body: patch, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async deleteUser(id) {
      const res = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.USERS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return res;
    },

    async insertZone(row) {
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.ZONES_TABLE}`, { method: 'POST', body: row, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async updateZone(id, patch) {
      const rows = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.ZONES_TABLE}?id=eq.${encodeURIComponent(id)}`,
        { method: 'PATCH', body: patch, prefer: 'return=representation' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return rows && rows[0] ? rows[0] : null;
    },

    async deleteZone(id) {
      const res = await request(CONFIG.LISTS_URL, CONFIG.LISTS_KEY,
        `/${CONFIG.ZONES_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (typeof Store !== 'undefined' && Store.invalidateLists) Store.invalidateLists();
      return res;
    },
  };

  return { Records, Lists };
})();
