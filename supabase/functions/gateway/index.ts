/* =========================================================
 *  دەروازەی پارێزراوی سیستەمی گەیاندن — Supabase Edge Function
 *  هەموو داتاکان بەم فەنکشنەوە تێپەڕ دەبن:
 *   ١. چوونەژوورەوە لە سێرڤەر پشکنین دەکرێت — تێپەڕەوشەکان بۆ کڵایەنت نانا
 *   ٢. تۆکنی ژمارەی نەناسراو (HMAC) — بەسەرچوون پشکنین دەکرێت
 *   ٣. هەمان دەسەڵاتەکانی سیستەم (Perms) لە سێرڤەرەوە جێبەجێ دەبن
 *   ٤. دەستڕاگەیشتن بە داتابەیس بە service_role — بەڵام RLS دەروازەی ئاسایی دادەخات
 *
 *  گۆڕاوەکانی ژینگە (Secrets):
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — خۆکاران (پڕۆژەی لیستەکان)
 *   RECORDS_URL         — بەستەری RESTی پڕۆژەی تۆمارەکان
 *   RECORDS_SERVICE_KEY — کلیدی service_roleی پڕۆژەی تۆمارەکان
 *   TOKEN_SECRET        — وشەی نهێنی تۆکن (رشتەیەکی درێژی هەڕەمەکی)
 * ========================================================= */

const USERS_TABLE = 'usersv2';
const ZONES_TABLE = 'zonesv2';
const VEHICLES_TABLE = 'vehiclesv2';
const RECORDS_TABLE = 'delivery_records';
const PERMS_MARKER = '__PERMS__';
const TOKEN_TTL_SEC = 14 * 24 * 3600; // ١٤ ڕۆژ

const LISTS_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '') + '/rest/v1';
const LISTS_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RECORDS_URL = (Deno.env.get('RECORDS_URL') ?? '').replace(/\/+$/, '');
const RECORDS_SERVICE = Deno.env.get('RECORDS_SERVICE_KEY') ?? '';
const TOKEN_SECRET = Deno.env.get('TOKEN_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const ok = (data: unknown) => json({ ok: true, data });
const fail = (error: string, code: string, status = 400) => json({ ok: false, error, code }, status);

/* ---------------- یاریدەدەری داتابەیس (PostgREST بە service_role) ---------------- */

async function pg(
  url: string,
  key: string,
  path: string,
  opts: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<unknown> {
  const headers: Record<string, string> = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (opts.prefer) headers['Prefer'] = opts.prefer;
  const res = await fetch(url + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : null,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!res.ok) {
    const err = data as { message?: string; code?: string } | null;
    const e = new Error(err?.message || `DB error ${res.status}`) as Error & { code?: string };
    e.code = err?.code;
    throw e;
  }
  return data;
}

/* ---------------- تۆکنی سێشن (HMAC-SHA256) ---------------- */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(s: string): string {
  // UTF-8 سەلامەتە — بۆ نووسینی کوردی ناو تۆکنەکە
  const bytes = enc.encode(s);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return dec.decode(bytes);
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  let bin = '';
  new Uint8Array(sig).forEach(b => { bin += String.fromCharCode(b); });
  return b64url(bin);
}

interface TokenPayload {
  uid: string;
  username: string;
  profession: string;
  iat: number;
  exp: number;
}

async function issueToken(u: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    uid: String(u.driver_id ?? u.id ?? ''),
    username: String(u.username ?? ''),
    profession: String(u.profession ?? ''),
    iat: now,
    exp: now + TOKEN_TTL_SEC,
  };
  const p = b64url(JSON.stringify(payload));
  return `${p}.${await hmac(p)}`;
}

async function readToken(req: Request): Promise<TokenPayload | null> {
  if (!TOKEN_SECRET) return null;
  const t = req.headers.get('x-app-token') ?? '';
  const parts = t.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = await hmac(parts[0]);
  if (parts[1] !== expected) return null;
  try {
    const pl = JSON.parse(b64urlDecode(parts[0])) as TokenPayload;
    if (!pl.exp || pl.exp < Math.floor(Date.now() / 1000)) return null;
    return pl;
  } catch {
    return null;
  }
}

/* ---------------- دەسەڵاتەکان — هەمان مۆدێلی Perms ی کڵایەنت ---------------- */

const PROFESSION_SUP = 'بەریوبەر';
const isSup = (p: string | undefined | null) => !!p && (p === PROFESSION_SUP || p === 'بەڕێوبەر' || p === 'بەریوبەر');

// بنەڕەتییەکان — هەمان Perms.DEFAULTS ی کڵایەنت (بە دەستی هاوپێچ ڕابگرە)
const DEFAULTS: Record<string, { view: Record<string, boolean>; act: Record<string, boolean> }> = {
  'سایەق': {
    view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_second: true },
    act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
  },
  'دابەشکار': {
    view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_second: true },
    act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
  },
  'مەندوب': {
    view: { tab_reports: true, tab_contacts: true, tab_settings: true },
    act: {},
  },
  'یاریدەدەر': {
    view: { tab_driver: true, tab_reports: true, tab_contacts: true, tab_settings: true, rep_filter_out_zone: true, rep_filter_arrival: true, notif_bell: true },
    act: { act_exit: true, act_in_zone: true, act_out_zone: true, act_arrival: true, act_money: true, act_edit_data: true },
  },
};
const NEW_DEFAULT = { view: { tab_reports: true, tab_contacts: true, tab_settings: true }, act: {} };

interface PermsCfg {
  users?: Record<string, { view?: Record<string, boolean>; act?: Record<string, boolean>; lockFields?: string[] }>;
  professions?: Record<string, { view?: Record<string, boolean>; act?: Record<string, boolean>; lockFields?: string[] }>;
  fieldLock?: { enabled?: boolean; type?: string; minutes?: number; fields?: string[] };
  deleted?: string[];
}

function can(cfg: PermsCfg, prof: string, uid: string, type: 'view' | 'act', key: string): boolean {
  if (isSup(prof)) return true;
  const uv = cfg.users?.[String(uid)]?.[type]?.[key];
  if (uv !== undefined) return !!uv;
  const pv = cfg.professions?.[prof]?.[type]?.[key];
  if (pv !== undefined) return !!pv;
  return !!((DEFAULTS[prof] ?? NEW_DEFAULT)[type]?.[key]);
}

/* ---------------- قفڵی خانەکان — هەمان مۆدێلی کڵایەنت ---------------- */

const FIELD_LOCK_KEYS = [
  'driver', 'distributor', 'delegate', 'zone', 'vehicle', 'record_time',
  'in_zone_time', 'out_zone_time', 'arrival_time', 'cargo_weight',
  'pieces_count', 'receipt_number', 'collected_money',
];

function lockFieldsFor(cfg: PermsCfg, prof: string, uid: string): string[] {
  const valid = (arr: string[]) => arr.filter(k => FIELD_LOCK_KEYS.includes(k));
  const uc = cfg.users?.[String(uid)];
  if (uc && Array.isArray(uc.lockFields)) return valid(uc.lockFields);
  const pc = cfg.professions?.[prof];
  if (pc && Array.isArray(pc.lockFields)) return valid(pc.lockFields);
  const flc = cfg.fieldLock ?? {};
  return Array.isArray(flc.fields) ? valid(flc.fields) : FIELD_LOCK_KEYS.slice();
}

function lockDue(flc: NonNullable<PermsCfg['fieldLock']>, rec: Record<string, unknown>): boolean {
  if (flc.type === 'immediate') return true;
  if (flc.type === 'timed') {
    const mins = Number(flc.minutes) || 0;
    if (!mins || !rec?.record_time || !rec?.record_date) return false;
    const [hh, mm] = String(rec.record_time).split(':').map(Number);
    const savedAt = new Date(
      `${rec.record_date}T${String(hh || 0).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}:00`,
    );
    return (Date.now() - savedAt.getTime()) / 60000 >= mins;
  }
  return false;
}

/* ---------------- کاشی کۆنفیگی دەسەڵاتەکان و ستوونەکان ---------------- */

let permsCache: { ts: number; cfg: PermsCfg } = { ts: 0, cfg: {} };

async function permsCfg(): Promise<PermsCfg> {
  if (Date.now() - permsCache.ts < 60_000) return permsCache.cfg;
  const rows = (await pg(LISTS_URL, LISTS_SERVICE, '/professions?select=*&order=id')) as Record<string, unknown>[];
  const row = (rows ?? []).find(r => typeof r.profession === 'string' && r.profession.startsWith(PERMS_MARKER));
  let cfg: PermsCfg = {};
  if (row) {
    try { cfg = JSON.parse((row.profession as string).slice(PERMS_MARKER.length)) ?? {}; } catch { cfg = {}; }
  }
  permsCache = { ts: Date.now(), cfg };
  return cfg;
}

const RECORDS_FALLBACK_COLUMNS = [
  'id', 'driver', 'distributor', 'delegate', 'zone', 'vehicle',
  'cargo_weight', 'pieces_count', 'receipt_number',
  'record_date', 'record_time', 'in_zone_time', 'out_zone_time',
  'arrival_time', 'collected_money',
];

let colsCache: string[] | null = null;

async function recordsColumns(): Promise<string[]> {
  if (colsCache) return colsCache;
  try {
    const spec = await pg(RECORDS_URL, RECORDS_SERVICE, '/', {}) as { definitions?: Record<string, { properties?: Record<string, unknown> }> };
    const props = spec?.definitions?.[RECORDS_TABLE]?.properties;
    if (props) {
      colsCache = Object.keys(props);
      return colsCache;
    }
  } catch { /* OpenAPI بەردەست نییە — ڕێگای تر */ }
  try {
    const rows = await pg(RECORDS_URL, RECORDS_SERVICE, `/${RECORDS_TABLE}?select=*&limit=1`) as Record<string, unknown>[];
    if (rows?.[0]) {
      colsCache = Object.keys(rows[0]);
      return colsCache;
    }
  } catch { /* خشتە بەتاڵە */ }
  colsCache = RECORDS_FALLBACK_COLUMNS.slice();
  return colsCache;
}

function sanitizeRow(row: Record<string, unknown>, cols: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(row ?? {}).forEach(([k, v]) => {
    if (cols.includes(k) && k !== 'id') out[k] = v;
  });
  return out;
}

/* ---------------- فلتەری تۆمارەکانی خۆی — بۆ ئەوانەی rep_view_all نییە ---------------- */

function ownRecordsFilter(uid: string, username: string): string {
  const q = (s: string) => s.replace(/"/g, '""');
  const name = q(username);
  return `(driver_id.eq.${uid},distributor_id.eq.${uid},delegate_id.eq.${uid},driver.eq."${name}",distributor.eq."${name}",delegate.eq."${name}")`;
}

function ownsRecord(rec: Record<string, unknown>, uid: string, username: string): boolean {
  const idList = (v: unknown) => String(v ?? '').split(',').map(x => x.trim());
  if (idList(rec.driver_id).includes(uid) || idList(rec.distributor_id).includes(uid) || idList(rec.delegate_id).includes(uid)) return true;
  const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  const un = norm(username);
  return [rec.driver, rec.distributor, rec.delegate].some(v => norm(v) === un);
}

function buildRecordsQuery(params: Record<string, unknown>, pl: TokenPayload): string {
  const p = new URLSearchParams();
  const seesAll = can(permsCache.cfg, pl.profession, pl.uid, 'view', 'rep_view_all');
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (k === 'or' && !seesAll) return; // فلتەری خۆی جێگیر دەکرێت
    (Array.isArray(v) ? v : [v]).forEach(x => p.append(k, String(x)));
  });
  if (!p.get('select')) p.set('select', '*');
  if (!seesAll) p.set('or', ownRecordsFilter(pl.uid, pl.username));
  return `/${RECORDS_TABLE}?${p.toString()}`;
}

/* ---------------- ڕۆوتەری سەرەکی ---------------- */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('تەنها POST ڕێپێدراوە', 'METHOD', 405);

  if (!TOKEN_SECRET) return fail('TOKEN_SECRET دانەنراوە لە Secrets', 'CONFIG', 500);
  if (!LISTS_URL || !LISTS_SERVICE) return fail('پڕۆژەی لیستەکان ڕێک نەخراوە', 'CONFIG', 500);
  if (!RECORDS_URL || !RECORDS_SERVICE) return fail('پڕۆژەی تۆمارەکان ڕێک نەخراوە (RECORDS_URL و RECORDS_SERVICE_KEY)', 'CONFIG', 500);

  let body: { op?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return fail('داواکارییەکە دروست نییە', 'BAD_REQUEST', 400);
  }
  const op = body.op ?? '';
  const p = body.payload ?? {};

  try {
    /* — بێ تۆکن — */
    if (op === 'loginOptions') {
      const rows = await pg(LISTS_URL, LISTS_SERVICE,
        `/usersv2?select=id:driver_id,username,profession,avatar_url&order=driver_id`);
      return ok(rows);
    }

    if (op === 'login') {
      const userId = String(p.userId ?? '');
      const pin = String(p.pin ?? '');
      if (!userId || !/^\d{4}$/.test(pin)) return fail('ناو یان تێپەڕەوشە هەڵەیە', 'BAD_CREDENTIALS', 401);
      const rows = await pg(LISTS_URL, LISTS_SERVICE,
        `/usersv2?select=id:driver_id,username,password,profession,avatar_url,phone_number_1,phone_number_2,location&driver_id=eq.${encodeURIComponent(userId)}&limit=1`) as Record<string, unknown>[];
      const u = rows?.[0];
      if (!u || String(u.password ?? '') !== pin) return fail('ناو یان تێپەڕەوشە هەڵەیە', 'BAD_CREDENTIALS', 401);
      const token = await issueToken(u);
      const { password: _pw, ...user } = u;
      return ok({ token, user });
    }

    /* — لە دوای ئەمە: تۆکنی دروست پێویستە — */
    const pl = await readToken(req);
    if (!pl) return fail('سێشنەکە دروست نییە یان بەسەرچووە — دووبارە بچۆ ژوورەوە', 'AUTH_REQUIRED', 401);
    const cfg = await permsCfg();
    const prof = pl.profession;
    const uid = String(pl.uid);
    const sup = isSup(prof);

    /* — تۆمارەکان — */
    if (op === 'records.list') {
      const rows = await pg(RECORDS_URL, RECORDS_SERVICE, buildRecordsQuery(p.params as Record<string, unknown> ?? {}, pl));
      return ok(rows);
    }

    if (op === 'records.byId') {
      const rows = await pg(RECORDS_URL, RECORDS_SERVICE,
        `/${RECORDS_TABLE}?select=*&id=eq.${encodeURIComponent(String(p.id))}&limit=1`) as Record<string, unknown>[];
      const rec = rows?.[0] ?? null;
      if (rec && !sup && !can(cfg, prof, uid, 'view', 'rep_view_all') && !ownsRecord(rec, uid, pl.username)) {
        return fail('ئەم تۆمارە بۆ تۆ نییە', 'FORBIDDEN', 403);
      }
      return ok(rec);
    }

    if (op === 'records.columns') {
      return ok({ columns: await recordsColumns() });
    }

    if (op === 'records.insert') {
      if (!can(cfg, prof, uid, 'act', 'act_exit') && !can(cfg, prof, uid, 'act', 'rep_edit')) {
        return fail('دەسەڵاتی تۆمارکردنی دەرچوونت نییە', 'FORBIDDEN', 403);
      }
      const row = sanitizeRow((p.row ?? {}) as Record<string, unknown>, await recordsColumns());
      const rows = await pg(RECORDS_URL, RECORDS_SERVICE, `/${RECORDS_TABLE}`, {
        method: 'POST', body: row, prefer: 'return=representation',
      });
      return ok((rows as Record<string, unknown>[] | null)?.[0] ?? null);
    }

    if (op === 'records.update') {
      const anyUpdate = ['act_edit_data', 'rep_edit', 'act_in_zone', 'act_out_zone', 'act_arrival', 'act_money']
        .some(k => can(cfg, prof, uid, 'act', k));
      if (!anyUpdate) return fail('دەسەڵاتی نوێکردنەوەت نییە', 'FORBIDDEN', 403);

      const id = String(p.id);
      const curRows = await pg(RECORDS_URL, RECORDS_SERVICE,
        `/${RECORDS_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`) as Record<string, unknown>[];
      const rec = curRows?.[0];
      if (!rec) return fail('تۆمارەکە نەدۆزرایەوە', 'NOT_FOUND', 404);

      let patch = { ...(p.patch ?? {}) } as Record<string, unknown>;
      const has = (k: string) => k in patch;
      const may = (k: string) => can(cfg, prof, uid, 'act', k);

      // دەسەڵاتی دانەبەدانە بۆ خانە هەستیارەکان
      if (has('collected_money') && !(may('act_money') || may('act_edit_data') || may('rep_edit'))) {
        return fail('دەسەڵاتی گۆڕینی پارەت نییە', 'FORBIDDEN', 403);
      }
      if (has('in_zone_time') && !(may('act_in_zone') || may('act_edit_data') || may('rep_edit'))) {
        return fail('دەسەڵاتی تۆمارکردنی ناو زۆنت نییە', 'FORBIDDEN', 403);
      }
      if (has('out_zone_time') && !(may('act_out_zone') || may('act_edit_data') || may('rep_edit'))) {
        return fail('دەسەڵاتی تۆمارکردنی دەرێی زۆنت نییە', 'FORBIDDEN', 403);
      }
      if (has('arrival_time') && !(may('act_arrival') || may('act_edit_data') || may('rep_edit'))) {
        return fail('دەسەڵاتی تۆمارکردنی گەشتنەوەت نییە', 'FORBIDDEN', 403);
      }

      // قفڵی خانەکان — خانە قفڵکراوەکان لە پاکێجەکە لادەبرێن
      // تێبینی: کاتەکانی گەشت (in_zone_time, out_zone_time, arrival_time) هەرگیز قفڵ ناکرێن —
      // لە کڵایەنتدا دووگمەکانی هەنگاوی گەشت قفڵیان پێکار ناکەوێت و خۆیان بە act_* پارێزراون
      if (!sup && !may('act_bypass_field_lock') && (cfg.fieldLock?.enabled ?? false) && lockDue(cfg.fieldLock!, rec)) {
        const TRIP_TIME_FIELDS = ['in_zone_time', 'out_zone_time', 'arrival_time'];
        lockFieldsFor(cfg, prof, uid)
          .filter(f => !TRIP_TIME_FIELDS.includes(f))
          .forEach(f => { delete patch[f]; });
      }

      patch = sanitizeRow(patch, await recordsColumns());
      if (!Object.keys(patch).length) {
        return fail('هیچ گۆڕانکارییەکە ڕێپێدراو نییە (خانە قفڵکراوەکان)', 'LOCKED', 403);
      }

      try {
        const rows = await pg(RECORDS_URL, RECORDS_SERVICE,
          `/${RECORDS_TABLE}?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH', body: patch, prefer: 'return=representation',
        });
        return ok((rows as Record<string, unknown>[] | null)?.[0] ?? null);
      } catch (err) {
        // تریگەری شکاوی UPDATE (42P01) — وەک کڵایەنت: ڕیزی نوێ + سڕینەوەی کۆن
        if ((err as Error & { code?: string }).code !== '42P01') throw err;
        const { id: _omit, ...rest } = rec;
        const merged = sanitizeRow({ ...rest, ...patch }, await recordsColumns());
        const inserted = await pg(RECORDS_URL, RECORDS_SERVICE, `/${RECORDS_TABLE}`, {
          method: 'POST', body: merged, prefer: 'return=representation',
        });
        await pg(RECORDS_URL, RECORDS_SERVICE, `/${RECORDS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        return ok((inserted as Record<string, unknown>[] | null)?.[0] ?? null);
      }
    }

    if (op === 'records.remove') {
      if (!can(cfg, prof, uid, 'act', 'rep_delete')) {
        return fail('دەسەڵاتی سڕینەوەت نییە', 'FORBIDDEN', 403);
      }
      await pg(RECORDS_URL, RECORDS_SERVICE, `/${RECORDS_TABLE}?id=eq.${encodeURIComponent(String(p.id))}`, { method: 'DELETE' });
      return ok(true);
    }

    /* — لیستەکان — */
    if (op === 'lists.users') {
      const rows = await pg(LISTS_URL, LISTS_SERVICE,
        `/usersv2?select=id:driver_id,username,password,profession,avatar_url,phone_number_1,phone_number_2,location&order=driver_id`) as Record<string, unknown>[];
      if (sup) return ok(rows);
      // تێپەڕەوشەکان هەرگیز بۆ کڵایەنتی ئاسایی نانا
      return ok((rows ?? []).map(u => {
        const { password, ...rest } = u;
        void password;
        return rest;
      }));
    }

    if (op === 'lists.zones') return ok(await pg(LISTS_URL, LISTS_SERVICE, `/zonesv2?select=*&order=id`));
    if (op === 'lists.vehicles') return ok(await pg(LISTS_URL, LISTS_SERVICE, `/vehiclesv2?select=*&order=id`));

    if (op === 'lists.insertUser') {
      if (!can(cfg, prof, uid, 'view', 'admin_users')) return fail('دەسەڵاتی بەڕێوەبردنی بەکارهێنەرانت نییە', 'FORBIDDEN', 403);
      const rows = await pg(LISTS_URL, LISTS_SERVICE, `/usersv2`, {
        method: 'POST', body: p.row, prefer: 'return=representation',
      });
      return ok((rows as Record<string, unknown>[] | null)?.[0] ?? null);
    }

    if (op === 'lists.updateUser') {
      const targetId = String(p.id);
      const patch = { ...(p.patch ?? {}) } as Record<string, unknown>;
      const adminOk = can(cfg, prof, uid, 'view', 'admin_users');
      const selfKeys = ['phone_number_1', 'phone_number_2', 'location', 'avatar_url'];
      const selfOnly = !adminOk && targetId === uid &&
        Object.keys(patch).every(k => selfKeys.includes(k));
      if (!adminOk && !selfOnly) return fail('دەسەڵاتی دەستکاریکردنی ئەم بەکارهێنەرەت نییە', 'FORBIDDEN', 403);
      if ('password' in patch && !sup) return fail('تەنها بەڕێوەبەر دەتوانێت تێپەڕەوشە بگۆڕێت', 'FORBIDDEN', 403);
      const rows = await pg(LISTS_URL, LISTS_SERVICE,
        `/usersv2?driver_id=eq.${encodeURIComponent(targetId)}`, {
        method: 'PATCH', body: patch, prefer: 'return=representation',
      });
      return ok((rows as Record<string, unknown>[] | null)?.[0] ?? null);
    }

    if (op === 'lists.deleteUser') {
      if (!can(cfg, prof, uid, 'view', 'admin_users')) return fail('دەسەڵاتی سڕینەوەی بەکارهێنەرت نییە', 'FORBIDDEN', 403);
      await pg(LISTS_URL, LISTS_SERVICE, `/usersv2?driver_id=eq.${encodeURIComponent(String(p.id))}`, { method: 'DELETE' });
      return ok(true);
    }

    if (op === 'lists.insertZone') {
      if (!can(cfg, prof, uid, 'view', 'admin_zones')) return fail('دەسەڵاتی بەڕێوەبردنی زۆنەکانت نییە', 'FORBIDDEN', 403);
      const rows = await pg(LISTS_URL, LISTS_SERVICE, `/zonesv2`, {
        method: 'POST', body: p.row, prefer: 'return=representation',
      });
      return ok((rows as Record<string, unknown>[] | null)?.[0] ?? null);
    }

    if (op === 'lists.updateZone') {
      if (!can(cfg, prof, uid, 'view', 'admin_zones')) return fail('دەسەڵاتی بەڕێوەبردنی زۆنەکانت نییە', 'FORBIDDEN', 403);
      const rows = await pg(LISTS_URL, LISTS_SERVICE,
        `/zonesv2?id=eq.${encodeURIComponent(String(p.id))}`, {
        method: 'PATCH', body: p.patch, prefer: 'return=representation',
      });
      return ok((rows as Record<string, unknown>[] | null)?.[0] ?? null);
    }

    if (op === 'lists.deleteZone') {
      if (!can(cfg, prof, uid, 'view', 'admin_zones')) return fail('دەسەڵاتی سڕینەوەی زۆنت نییە', 'FORBIDDEN', 403);
      await pg(LISTS_URL, LISTS_SERVICE, `/zonesv2?id=eq.${encodeURIComponent(String(p.id))}`, { method: 'DELETE' });
      return ok(true);
    }

    /* — نۆتیفیکەیشنەکان — */
    if (op === 'notifications.list') {
      return ok(await pg(LISTS_URL, LISTS_SERVICE, `/notifications?select=*&order=created_at.desc&limit=200`));
    }
    if (op === 'notifications.send') {
      const action = String(p.action ?? '');
      if (!action) return ok(null);
      await pg(LISTS_URL, LISTS_SERVICE, `/notifications`, {
        method: 'POST', body: { action }, prefer: 'return=minimal',
      });
      return ok(true);
    }
    if (op === 'notifications.removeOlderThanDays') {
      if (!sup) return fail('تەنها بەڕێوەبەر', 'FORBIDDEN', 403);
      const cutoff = new Date(Date.now() - Math.max(0, Number(p.days) || 0) * 86_400_000).toISOString();
      await pg(LISTS_URL, LISTS_SERVICE, `/notifications?created_at=lt.${encodeURIComponent(cutoff)}`, { method: 'DELETE' });
      return ok(true);
    }
    if (op === 'notifications.removeAll') {
      if (!sup) return fail('تەنها بەڕێوەبەر', 'FORBIDDEN', 403);
      await pg(LISTS_URL, LISTS_SERVICE, `/notifications?id=gte.0`, { method: 'DELETE' });
      return ok(true);
    }

    /* — پیشەکان و کۆنفیگی دەسەڵاتەکان — */
    if (op === 'professions.all') {
      const rows = await pg(LISTS_URL, LISTS_SERVICE, `/professions?select=*&order=id`) as Record<string, unknown>[];
      const names: Record<string, unknown>[] = [];
      let permsRaw: Record<string, unknown> | null = null;
      (rows ?? []).forEach(r => {
        if (typeof r.profession === 'string' && r.profession.startsWith(PERMS_MARKER)) {
          if (!permsRaw) permsRaw = r;
        } else if (r.profession) {
          names.push(r);
        }
      });
      return ok({ names, permsRaw });
    }

    if (op === 'professions.insert') {
      if (!sup) return fail('تەنها بەڕێوەبەر', 'FORBIDDEN', 403);
      const rows = await pg(LISTS_URL, LISTS_SERVICE, `/professions`, {
        method: 'POST', body: { profession: String(p.name ?? '') }, prefer: 'return=representation',
      });
      return ok((rows as Record<string, unknown>[] | null)?.[0] ?? null);
    }

    if (op === 'professions.remove') {
      if (!sup) return fail('تەنها بەڕێوەبەر', 'FORBIDDEN', 403);
      await pg(LISTS_URL, LISTS_SERVICE, `/professions?id=eq.${encodeURIComponent(String(p.id))}`, { method: 'DELETE' });
      return ok(true);
    }

    if (op === 'professions.savePerms') {
      if (!sup) return fail('تەنها بەڕێوەبەر دەتوانێت دەسەڵاتەکان بگۆڕێت', 'FORBIDDEN', 403);
      const val = PERMS_MARKER + JSON.stringify(p.config ?? {});
      const rows = await pg(LISTS_URL, LISTS_SERVICE, `/professions?select=*&order=id`) as Record<string, unknown>[];
      const markerRow = (rows ?? []).find(r => typeof r.profession === 'string' && r.profession.startsWith(PERMS_MARKER));
      if (markerRow?.id) {
        await pg(LISTS_URL, LISTS_SERVICE, `/professions?id=eq.${encodeURIComponent(String(markerRow.id))}`, {
          method: 'PATCH', body: { profession: val }, prefer: 'return=minimal',
        });
      } else {
        await pg(LISTS_URL, LISTS_SERVICE, `/professions`, {
          method: 'POST', body: { profession: val }, prefer: 'return=minimal',
        });
      }
      permsCache = { ts: 0, cfg: {} };
      return ok(true);
    }

    /* — گۆڕینی تێپەڕەوشەی خۆی — */
    if (op === 'users.changeOwnPin') {
      const cur = String(p.currentPin ?? '');
      const nw = String(p.newPin ?? '');
      if (!/^\d{4}$/.test(nw)) return fail('تێپەڕەوشەی نوێ دەبێت ٤ ژمارە بێت', 'BAD_PIN', 400);
      const rows = await pg(LISTS_URL, LISTS_SERVICE,
        `/usersv2?select=id:driver_id,username,password&driver_id=eq.${encodeURIComponent(uid)}&limit=1`) as Record<string, unknown>[];
      const me = rows?.[0];
      if (!me || String(me.password ?? '') !== cur) return fail('تێپەڕەوشەی ئێستا هەڵەیە', 'WRONG_PIN', 403);
      await pg(LISTS_URL, LISTS_SERVICE, `/usersv2?driver_id=eq.${encodeURIComponent(uid)}`, {
        method: 'PATCH', body: { password: nw }, prefer: 'return=minimal',
      });
      return ok(true);
    }

    return fail(`کردارەکە نەزانراوە: ${op}`, 'UNKNOWN_OP', 400);
  } catch (err) {
    console.error('gateway error:', op, err);
    return fail((err as Error).message || 'هەڵەیەکی نەزانراو ڕوویدا', 'SERVER', 500);
  }
});
