/* =========================================================
 *  پانێلی بەڕێوبەر — Admin Dashboard
 *  بینین، گەڕان و تەواوی کردارەکانی (CRUD) لەسەر هەردوو سەب بەیسەکە:
 *  ١. تۆمارەکانی گەیاندن (delivery_records)
 *  ٢. بەکارهێنەران (usersv2)
 *  ٣. زۆنەکان (zonesv2)
 * ========================================================= */

/* =========================================================
 *  کۆگای نۆتیفیکەیشن — لوکالستۆریج، ٣٠ ڕۆژ، ئاگادارکردنەوەی دووەم
 * ========================================================= */
const NotifStore = (() => {
  const KEY = 'dlv_notifications';
  const MAX_DAYS = 30;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; }
  }
  function save(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (_) {}
  }
  function purge() {
    const cutoff = Date.now() - MAX_DAYS * 864e5;
    const arr = load().filter(n => n.ts >= cutoff);
    save(arr);
    return arr;
  }
  function getAll() { return purge(); }
  function push(notif) {
    const arr = purge();
    arr.unshift({
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      ts: Date.now(),
      read: false,
      ...notif,
    });
    save(arr);
    _updateBadge();
  }
  function unreadCount() { return purge().filter(n => !n.read).length; }
  function markAllRead() {
    const arr = load().map(n => ({ ...n, read: true }));
    save(arr);
    _updateBadge();
  }
  function _updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const count = unreadCount();
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count > 0 ? '' : 'none';
  }
  function init() { _updateBadge(); }
  return { push, getAll, unreadCount, markAllRead, init, _updateBadge };
})();

/* =========================================================
 *  کۆگای کاتی دەوام — پاشەکەوتکردنی کاتی بنەڕەت لە لوکالستۆریج
 * ========================================================= */
const BaseTimeStore = {
  KEY: 'dlv_base_time',
  get() { return localStorage.getItem(this.KEY) || ''; },
  set(t) { if (t) localStorage.setItem(this.KEY, t); },
};

const AdminView = (() => {

  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  let refreshTimer = null;

  let state = {
    subtab: 'records', // 'records' | 'users' | 'zones'
    loading: false,

    // خشتەی تۆمارەکان
    records: [],
    from: '',
    to: '',
    recordSearch: '',
    selectedUser: '', // دانە بەدانەی یوسەرەکان

    // خشتەی بەکارهێنەران
    users: [],
    userSearch: '',
    userProfFilter: '',

    // خشتەی زۆنەکان
    zones: [],
    zoneSearch: '',
  };

  const norm = s => UI.toLatinDigits(String(s || ''))
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ی').replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  function userMatchesRecord(username, r) {
    if (!username || !r) return false;
    const u = String(username).trim();
    const uVariants = CONFIG.CARGO_SUFFIXES.map(s => u + s);
    return (
      uVariants.includes(r.driver) ||
      r.driver === u ||
      r.distributor === u ||
      r.delegate === u
    );
  }

  /* ---------------- بارکردنی داتا ---------------- */

  async function loadData({ silent = false } = {}) {
    if (!silent) {
      state.loading = true;
      if (container) {
        const wrap = $('#admin-content', container);
        if (wrap) wrap.classList.add('loading');
      }
    }

    try {
      // هێنانی لیستەکان (usersv2 + zonesv2)
      const ls = await Store.loadLists(true);
      state.users = ls.users || [];
      state.zones = ls.zones || [];

      // هێنانی تۆمارەکان (delivery_records) بەپێی بەروار
      const params = { select: '*', order: 'record_date.desc,id.desc' };
      const range = [];
      if (state.from) range.push(`gte.${state.from}`);
      if (state.to) range.push(`lte.${state.to}`);
      if (range.length) params.record_date = range;

      state.records = await API.Records.list(params);

      renderContent();
    } catch (err) {
      UI.toast('هەڵە لە بارکردنی زانیارییەکان: ' + err.message, 'error', 4200);
    } finally {
      state.loading = false;
      if (container) {
        const wrap = $('#admin-content', container);
        if (wrap) wrap.classList.remove('loading');
      }
    }
  }

  /* ---------------- فلتەرکردنی داتاکان ---------------- */

  function filteredRecords() {
    let rows = state.records || [];

    // فلتەری دانە بەدانەی یوسەرەکان
    if (state.selectedUser) {
      rows = rows.filter(r => userMatchesRecord(state.selectedUser, r));
    }

    // گەڕان
    if (state.recordSearch) {
      const q = norm(state.recordSearch);
      rows = rows.filter(r =>
        [r.driver, r.distributor, r.delegate, r.zone, r.vehicle, r.receipt_number]
          .some(v => norm(v).includes(q))
      );
    }
    return rows;
  }

  function filteredUsers() {
    let rows = state.users || [];
    if (state.userProfFilter) {
      rows = rows.filter(u => u.profession === state.userProfFilter);
    }
    if (state.userSearch) {
      const q = norm(state.userSearch);
      rows = rows.filter(u =>
        [u.username, u.profession, u.password].some(v => norm(v).includes(q))
      );
    }
    return rows;
  }

  function filteredZones() {
    let rows = state.zones || [];
    if (state.zoneSearch) {
      const q = norm(state.zoneSearch);
      rows = rows.filter(z => norm(z.name).includes(q));
    }
    return rows;
  }

  /* ---------------- ڕێندەری سەرەکی ---------------- */

  function render(el) {
    container = el;
    el.classList.add('page-admin');
    if (!state.from) state.from = UI.daysAgoStr(6);
    if (!state.to) state.to = UI.todayStr();

    el.innerHTML = `
      <section class="card" style="padding:14px 18px 12px">
        <div class="admin-header-row">
          <div>
            <h2 class="hero-title">🛡️ پانێلی بەڕێوەبردن</h2>
            <p class="hero-sub">تەواوی داتاکانی هەر دوو پڕۆژەی Supabase و کۆنتڕۆڵی CRUD</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="notif-bell-wrap">
              <button class="btn btn-ghost btn-sm" id="notif-bell-btn" title="نۆتیفیکەیشنەکان">🔔</button>
              <span class="notif-badge" id="notif-badge" style="display:none"></span>
            </div>
            <button class="btn btn-ghost btn-sm" id="admin-refresh-btn">⟳ نوێکردنەوە</button>
          </div>
        </div>

        <!-- بەشەکان (Subtabs) -->
        <div class="admin-tabs" id="admin-subtabs">
          <button type="button" class="admin-tab-btn ${state.subtab === 'records' ? 'active' : ''}" data-sub="records">
            <span>🚚</span> تۆمارەکان <span class="badge-count" id="badge-records-count">${state.records.length}</span>
          </button>
          <button type="button" class="admin-tab-btn ${state.subtab === 'users' ? 'active' : ''}" data-sub="users">
            <span>👥</span> بەکارهێنەران <span class="badge-count" id="badge-users-count">${state.users.length}</span>
          </button>
          <button type="button" class="admin-tab-btn ${state.subtab === 'zones' ? 'active' : ''}" data-sub="zones">
            <span>🗺️</span> زۆنەکان <span class="badge-count" id="badge-zones-count">${state.zones.length}</span>
          </button>
        </div>
      </section>

      <div id="admin-content"></div>`;

    // گۆڕینی بەشەکان
    el.querySelectorAll('.admin-tab-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.subtab = b.dataset.sub;
        el.querySelectorAll('.admin-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.sub === state.subtab));
        renderContent();
      });
    });

    $('#admin-refresh-btn', el).addEventListener('click', () => loadData());
    $('#notif-bell-btn', el)?.addEventListener('click', openNotifPanel);

    NotifStore.init(); // نوێکردنەوەی بەلکەی نۆتیفیکەیشن

    loadData();
    start();
  }


  function renderContent() {
    const wrap = $('#admin-content', container);
    if (!wrap) return;

    // نوێکردنەوەی ژمارەی باجەکان
    const br = $('#badge-records-count', container);
    if (br) br.textContent = state.records.length;
    const bu = $('#badge-users-count', container);
    if (bu) bu.textContent = state.users.length;
    const bz = $('#badge-zones-count', container);
    if (bz) bz.textContent = state.zones.length;

    if (state.subtab === 'records') renderRecordsTab(wrap);
    else if (state.subtab === 'users') renderUsersTab(wrap);
    else if (state.subtab === 'zones') renderZonesTab(wrap);
  }

  /* =========================================================
   *  پانێلی نۆتیفیکەیشنەکان
   * ========================================================= */

  function openNotifPanel() {
    const notifs = NotifStore.getAll();
    NotifStore.markAllRead();

    function fmtTs(ts) {
      const d = new Date(ts);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `${date} • ${time}`;
    }

    const overlay = document.createElement('div');
    overlay.className = 'notif-panel-overlay';
    overlay.innerHTML = `
      <div class="notif-panel-backdrop"></div>
      <div class="notif-drawer">
        <div class="notif-drawer-head">
          <h3>🔔 نۆتیفیکەیشنەکان</h3>
          <button class="btn btn-ghost btn-sm" id="notif-close-btn">✕ داخستن</button>
        </div>
        <div class="notif-drawer-body">
          ${!notifs.length
            ? `<div class="notif-empty"><span class="notif-empty-ico">🔔</span>هیچ نۆتیفیکەیشنێک نییە</div>`
            : notifs.map(n => `
              <div class="notif-item ${n.read ? 'read' : ''}">
                <div class="notif-item-meta">
                  <span class="notif-item-who">👤 ${UI.esc(n.who || '—')}</span>
                  <span>${UI.esc(fmtTs(n.ts))}</span>
                </div>
                <div class="notif-item-msg">${UI.esc(n.msg)}</div>
              </div>`).join('')}
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.notif-panel-backdrop').addEventListener('click', close);
    overlay.querySelector('#notif-close-btn').addEventListener('click', close);
  }



  function renderRecordsTab(wrap) {
    const rows = filteredRecords();

    // کۆیەکان
    const totals = rows.reduce((a, r) => ({
      weight: a.weight + Number(r.cargo_weight || 0),
      pieces: a.pieces + Number(r.pieces_count || 0),
      receipts: a.receipts + Number(r.receipt_number || 0),
      money: a.money + Number(r.collected_money || 0),
    }), { weight: 0, pieces: 0, receipts: 0, money: 0 });

    wrap.innerHTML = `
      <section class="card filter-card">
        <div class="admin-header-row" style="margin-bottom:8px">
          <div>
            <h3 style="font-size:1.02rem;font-weight:800">🚚 تۆمارەکانی گەیاندن</h3>
            <p class="muted" style="font-size:0.8rem">بینین، فلتەرکردن، پرێنتکردن و هەناردەی فرە-شیتی ئێکسڵ</p>
          </div>
          <div class="admin-actions-bar">
            <button type="button" class="btn btn-ghost btn-sm" id="admin-print-btn" title="پرێنتکردنی داتای فلتەرکراو">
              🖨️ پرێنتکردن
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="admin-excel-btn" title="هەناردەکردنی بەکارهێنەران بۆ ئێکسڵ">
              📊 بەئێکسڵکردن
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="admin-add-rec-btn">
              ➕ زیادکردنی باری نوێ
            </button>
          </div>
        </div>

        <div class="date-range-compact">
          <div class="field compact-field"><label>لە بەروار</label><input type="date" id="adm-from" value="${state.from}"></div>
          <div class="field compact-field"><label>بۆ بەروار</label><input type="date" id="adm-to" value="${state.to}"></div>
        </div>

        <div class="field-row">
          <div class="field" style="flex:1.2">
            <label>فلتەری بەکارهێنەر (دانە بەدانەی یوسەرەکان)</label>
            <select id="adm-user-filter">
              <option value="">هەموو بەکارهێنەران</option>
              ${state.users.map(u => `
                <option value="${UI.esc(u.username)}" ${state.selectedUser === u.username ? 'selected' : ''}>
                  ${UI.esc(u.username)} (${UI.esc(u.profession || 'تر')})
                </option>`).join('')}
            </select>
          </div>
          <div class="field" style="flex:1.8">
            <label>گەڕان</label>
            <input type="search" id="adm-rec-search" placeholder="شۆفێر، دابەشکار، مەندوب، زۆن، سەیارە..." value="${UI.esc(state.recordSearch)}">
          </div>
        </div>
      </section>

      <div class="totals-grid">
        <div class="total-card"><span class="total-val">${UI.fmtNum(rows.length)}</span><span class="total-lbl">گەشت</span></div>
        <div class="total-card"><span class="total-val">${UI.fmtNum(totals.weight)}</span><span class="total-lbl">کۆی کێش (کگم)</span></div>
        <div class="total-card"><span class="total-val">${UI.fmtNum(totals.pieces)}</span><span class="total-lbl">کۆی پارچە</span></div>
        <div class="total-card"><span class="total-val">${UI.fmtNum(totals.receipts)}</span><span class="total-lbl">کۆی وەسڵ</span></div>
        <div class="total-card accent"><span class="total-val">${UI.fmtNum(totals.money)}</span><span class="total-lbl">کۆی پارە (د.ع)</span></div>
      </div>

      <div class="card table-card">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th class="actions-col">کردارەکان</th>
                <th>بەروار</th>
                <th>شۆفێر</th>
                <th>دابەشکار</th>
                <th>مەندوب</th>
                <th>زۆن</th>
                <th>سەیارە</th>
                <th>کێش</th>
                <th>پارچە</th>
                <th>وەسڵ</th>
                <th>دەرچوون</th>
                <th>ناو زۆن</th>
                <th>دەرێی زۆن</th>
                <th>گەشتنەوە</th>
                <th>پارەی هێنراوە</th>
              </tr>
            </thead>
            <tbody>
              ${!rows.length ? `<tr><td colspan="15" style="text-align:center;padding:30px;color:var(--muted)">هیچ تۆمارێک بەردەست نییە.</td></tr>` :
                rows.map(r => `
                  <tr>
                    <td class="table-actions-cell">
                      <button type="button" class="btn-action-sm btn-edit adm-rec-edit" data-id="${r.id}" title="دەستکاری">✏️ دەستکاری</button>
                      <button type="button" class="btn-action-sm btn-del adm-rec-del" data-id="${r.id}" title="سڕینەوە">🗑️</button>
                    </td>
                    <td class="nowrap">${UI.esc(r.record_date || '—')}</td>
                    <td><b>${UI.esc(r.driver || '—')}</b></td>
                    <td>${UI.esc(r.distributor || '—')}</td>
                    <td>${UI.esc(r.delegate || '—')}</td>
                    <td>${UI.esc(r.zone || '—')}</td>
                    <td>${UI.esc(r.vehicle || '—')}</td>
                    <td>${UI.fmtNum(r.cargo_weight)}</td>
                    <td>${UI.fmtNum(r.pieces_count)}</td>
                    <td>${UI.fmtNum(r.receipt_number)}</td>
                    <td>${UI.esc(r.record_time || '—')}</td>
                    <td>${UI.esc(r.in_zone_time || '—')}</td>
                    <td>${UI.esc(r.out_zone_time || '—')}</td>
                    <td>${UI.esc(r.arrival_time || '—')}</td>
                    <td class="money-cell">${UI.fmtNum(r.collected_money)}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    // ئیڤێنتەکان
    $('#adm-from', wrap).addEventListener('change', e => { state.from = e.target.value; loadData(); });
    $('#adm-to', wrap).addEventListener('change', e => { state.to = e.target.value; loadData(); });
    $('#adm-user-filter', wrap).addEventListener('change', e => { state.selectedUser = e.target.value; renderContent(); });
    $('#adm-rec-search', wrap).addEventListener('input', e => { state.recordSearch = e.target.value; renderContent(); });
    $('#admin-print-btn', wrap).addEventListener('click', () => printRecords());
    $('#admin-excel-btn', wrap).addEventListener('click', () => openExcelExportModal());
    $('#admin-add-rec-btn', wrap).addEventListener('click', () => openRecordModal());

    wrap.querySelectorAll('.adm-rec-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const r = state.records.find(x => x.id === id);
        if (r) openRecordModal(r);
      });
    });

    wrap.querySelectorAll('.adm-rec-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const r = state.records.find(x => x.id === id);
        if (r) deleteRecord(r);
      });
    });
  }

  function openRecordModal(rec = null) {
    const isEdit = !!rec;
    const distributors = state.users.filter(u => u.profession === CONFIG.PROFESSION_DISTRIBUTOR).map(u => ({ label: u.username }));
    const delegates = state.users.filter(u => u.profession === CONFIG.PROFESSION_DELEGATE).map(u => ({ label: u.username }));
    const drivers = state.users.filter(u => u.profession === CONFIG.PROFESSION_DRIVER).map(u => ({ label: u.username }));
    const zones = state.zones.map(z => ({ label: z.name }));

    const body = document.createElement('div');
    body.innerHTML = `
      <form id="adm-rec-form" novalidate>
        <div class="form-grid-2">
          <div class="field compact-field"><label>بەروار *</label><input type="date" id="m-rec-date" value="${rec ? rec.record_date : UI.todayStr()}"></div>
          <div class="field compact-field"><label>سەیارە *</label><input type="text" id="m-rec-veh" value="${rec ? UI.esc(rec.vehicle || '') : ''}"></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label>ناوی شۆفێر *</label><input type="text" id="m-rec-drv" value="${rec ? UI.esc(rec.driver || '') : ''}"></div>
          <div class="field"><label>ناوچە / زۆن *</label><input type="text" id="m-rec-zn" value="${rec ? UI.esc(rec.zone || '') : ''}"></div>
        </div>
        <div class="form-grid-2">
          <div class="field"><label>ناوی دابەشکار *</label><input type="text" id="m-rec-dist" value="${rec ? UI.esc(rec.distributor || '') : ''}"></div>
          <div class="field"><label>ناوی مەندوب *</label><input type="text" id="m-rec-del" value="${rec ? UI.esc(rec.delegate || '') : ''}"></div>
        </div>
        <div class="form-grid-3">
          <div class="field compact-field"><label>کێشی بار (کگم) *</label><input type="number" step="any" id="m-rec-wt" value="${rec ? rec.cargo_weight : ''}"></div>
          <div class="field compact-field"><label>پارچەکان *</label><input type="number" id="m-rec-pcs" value="${rec ? rec.pieces_count : ''}"></div>
          <div class="field compact-field"><label>وەسڵ *</label><input type="number" id="m-rec-rcp" value="${rec ? rec.receipt_number : ''}"></div>
        </div>
        <div class="form-grid-4">
          <div class="field compact-field"><label>🚚 کاتی دەرچوون</label><input type="time" id="m-rec-trec" value="${rec ? rec.record_time || '' : UI.nowTime()}"></div>
          <div class="field compact-field"><label>📍 کاتی ناو زۆن</label><input type="time" id="m-rec-tin" value="${rec ? rec.in_zone_time || '' : ''}"></div>
          <div class="field compact-field"><label>🚏 کاتی دەرێی زۆن</label><input type="time" id="m-rec-tout" value="${rec ? rec.out_zone_time || '' : ''}"></div>
          <div class="field compact-field"><label>🏁 کاتی گەشتنەوە</label><input type="time" id="m-rec-tarr" value="${rec ? rec.arrival_time || '' : ''}"></div>
        </div>
        <div class="field">
          <label>💰 پارەی هێنراوە (د.ع)</label>
          <input type="number" id="m-rec-mny" value="${rec ? rec.collected_money : 0}">
        </div>
      </form>`;

    UI.autocomplete($('#m-rec-drv', body), () => drivers);
    UI.autocomplete($('#m-rec-dist', body), () => distributors);
    UI.autocomplete($('#m-rec-del', body), () => delegates);
    UI.autocomplete($('#m-rec-zn', body), () => zones);

    const { close } = UI.openModal({
      title: isEdit ? '✏️ دەستکاریکردنی تۆماری گەیاندن' : '➕ زیادکردنی تۆماری نوێ',
      size: 'lg',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: isEdit ? 'پاشەکەوتکردن' : 'تۆمارکردن',
          className: 'btn-primary',
          onClick: async (backdrop) => {
            const subBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const val = id => $(id, body).value.trim();
            const data = {
              record_date: val('#m-rec-date') || UI.todayStr(),
              driver: val('#m-rec-drv'),
              distributor: val('#m-rec-dist'),
              delegate: val('#m-rec-del'),
              zone: val('#m-rec-zn'),
              vehicle: val('#m-rec-veh'),
              cargo_weight: Number(val('#m-rec-wt') || 0),
              pieces_count: Number(val('#m-rec-pcs') || 0),
              receipt_number: Number(val('#m-rec-rcp') || 0),
              record_time: val('#m-rec-trec') || null,
              in_zone_time: val('#m-rec-tin') || null,
              out_zone_time: val('#m-rec-tout') || null,
              arrival_time: val('#m-rec-tarr') || null,
              collected_money: Number(val('#m-rec-mny') || 0),
            };

            if (!data.driver || !data.zone || !data.vehicle) {
              UI.toast('تکایە خانە سەرەکییەکان (شۆفێر، زۆن، سەیارە) پڕ بکەرەوە', 'warning');
              return;
            }

            UI.btnLoading(subBtn, true, isEdit ? 'پاشەکەوت دەکرێت...' : 'تۆمار دەکرێت...');
            try {
              if (isEdit) {
                await API.Records.update(rec.id, data);
                UI.toast('تۆمارەکە بە سەرکەوتوویی نوێ کرایەوە ✓', 'success');
              } else {
                await API.Records.insert(data);
                UI.toast('تۆمارەکە بە سەرکەوتوویی زیادکرا ✓', 'success');
              }
              close();
              await loadData({ silent: true });
            } catch (err) {
              UI.toast('هەڵە: ' + err.message, 'error', 4200);
            } finally {
              UI.btnLoading(subBtn, false);
            }
          }
        }
      ]
    });
  }

  /* ---------------- پرێنتکردنی داتای فلتەرکراو ---------------- */

  function printRecords() {
    const rows = filteredRecords();
    if (!rows.length) {
      UI.toast('هیچ تۆمارێک بەردەست نییە بۆ پرێنتکردن لەم فلتەرەدا!', 'warning');
      return;
    }

    const totals = rows.reduce((a, r) => ({
      weight: a.weight + Number(r.cargo_weight || 0),
      pieces: a.pieces + Number(r.pieces_count || 0),
      receipts: a.receipts + Number(r.receipt_number || 0),
      money: a.money + Number(r.collected_money || 0),
    }), { weight: 0, pieces: 0, receipts: 0, money: 0 });

    const dateRangeText = (state.from && state.to)
      ? `لە ${state.from} بۆ ${state.to}`
      : (state.from ? `لە ${state.from} بەرەو سەرەوە` : (state.to ? `تا بەرواری ${state.to}` : 'تەواوی بەروارەکان'));

    const userFilterText = state.selectedUser ? state.selectedUser : 'هەموو بەکارهێنەران';
    const searchText = state.recordSearch ? state.recordSearch : '—';
    const printTime = `${UI.todayStr()} • ${UI.nowTime()}`;

    const html = `
      <!DOCTYPE html>
      <html lang="ckb" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>ڕاپۆرتی بەڕێوەبەر - سیستەمی گەیاندن</title>
        <style>
          @page { size: landscape; margin: 10mm 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Vazirmatn', 'Segoe UI', Tahoma, sans-serif;
            direction: rtl;
            color: #111;
            background: #fff;
            padding: 12px;
            font-size: 9.5pt;
            line-height: 1.5;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .print-title { font-size: 16pt; font-weight: 800; }
          .print-sub { font-size: 9pt; color: #444; }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            background: #f4f6f8;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: 8.5pt;
          }
          .meta-item strong { color: #000; }
          .totals-bar {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            margin-bottom: 12px;
          }
          .total-box {
            border: 1px solid #999;
            background: #fafafa;
            padding: 6px 10px;
            border-radius: 6px;
            text-align: right;
          }
          .total-box .val { font-size: 11.5pt; font-weight: 800; color: #000; direction: ltr; }
          .total-box .lbl { font-size: 7.5pt; color: #555; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
          }
          th, td {
            border: 1px solid #999;
            padding: 5px 6px;
            text-align: right;
          }
          th {
            background: #e9ecef;
            font-weight: 800;
            color: #000;
          }
          tr:nth-child(even) td { background: #fbfbfb; }
          .money { font-weight: 700; direction: ltr; text-align: right; white-space: nowrap; }
          .nowrap { white-space: nowrap; }
          .print-footer {
            margin-top: 14px;
            padding-top: 6px;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1 class="print-title">سیستەمی گەیاندن — ڕاپۆرتی بەڕێوەبەر</h1>
            <div class="print-sub">ڕاپۆرتی فەرمی تۆمارەکانی گەیاندن و وردەکارییەکان</div>
          </div>
          <div style="text-align:left">
            <div style="font-weight:700">بەرواری چاپ: ${printTime}</div>
            <div style="font-size:8pt;color:#555">چاپکراوە لە پانێلی بەڕێوبەر</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><span>مەودای بەروار:</span> <strong>${dateRangeText}</strong></div>
          <div class="meta-item"><span>بەکارهێنەر:</span> <strong>${userFilterText}</strong></div>
          <div class="meta-item"><span>گەڕان بەدوای:</span> <strong>${searchText}</strong></div>
          <div class="meta-item"><span>کۆی تۆمارەکان:</span> <strong>${rows.length} گەشت</strong></div>
        </div>

        <div class="totals-bar">
          <div class="total-box"><div class="val">${UI.fmtNum(rows.length)}</div><div class="lbl">کۆی گەشتەکان</div></div>
          <div class="total-box"><div class="val">${UI.fmtNum(totals.weight)}</div><div class="lbl">کۆی کێش (کگم)</div></div>
          <div class="total-box"><div class="val">${UI.fmtNum(totals.pieces)}</div><div class="lbl">کۆی پارچە</div></div>
          <div class="total-box"><div class="val">${UI.fmtNum(totals.receipts)}</div><div class="lbl">کۆی وەسڵ</div></div>
          <div class="total-box"><div class="val">${UI.fmtMoney(totals.money)}</div><div class="lbl">کۆی پارەی هێنراوە</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>بەروار</th>
              <th>شۆفێر</th>
              <th>دابەشکار</th>
              <th>مەندوب</th>
              <th>زۆن</th>
              <th>سەیارە</th>
              <th>کێش</th>
              <th>پارچە</th>
              <th>وەسڵ</th>
              <th>دەرچوون</th>
              <th>ناو زۆن</th>
              <th>دەرێی زۆن</th>
              <th>گەشتنەوە</th>
              <th>پارەی هێنراوە</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td style="text-align:center;font-weight:700">${i + 1}</td>
                <td class="nowrap">${UI.esc(r.record_date || '—')}</td>
                <td><b>${UI.esc(r.driver || '—')}</b></td>
                <td>${UI.esc(r.distributor || '—')}</td>
                <td>${UI.esc(r.delegate || '—')}</td>
                <td>${UI.esc(r.zone || '—')}</td>
                <td>${UI.esc(r.vehicle || '—')}</td>
                <td>${UI.fmtNum(r.cargo_weight)}</td>
                <td>${UI.fmtNum(r.pieces_count)}</td>
                <td>${UI.fmtNum(r.receipt_number)}</td>
                <td class="nowrap">${UI.esc(r.record_time || '—')}</td>
                <td class="nowrap">${UI.esc(r.in_zone_time || '—')}</td>
                <td class="nowrap">${UI.esc(r.out_zone_time || '—')}</td>
                <td class="nowrap">${UI.esc(r.arrival_time || '—')}</td>
                <td class="money">${UI.fmtMoney(r.collected_money)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#eaeaea;font-weight:800">
              <td colspan="7" style="text-align:center">کۆی گشتی</td>
              <td>${UI.fmtNum(totals.weight)}</td>
              <td>${UI.fmtNum(totals.pieces)}</td>
              <td>${UI.fmtNum(totals.receipts)}</td>
              <td colspan="4"></td>
              <td class="money">${UI.fmtMoney(totals.money)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="print-footer">
          <span>سیستەمی بەڕێوەبردنی گەیاندن</span>
          <span>چاپکراوی فەرمی سیستەم</span>
        </div>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 2500);
    }, 400);
  }

  /* ---------------- بەئێکسڵکردن بەپێی بەکارهێنەران (فرە-شیت) ---------------- */

  function openExcelExportModal() {
    if (typeof XLSX === 'undefined') {
      UI.toast('کتێبخانەی ئێکسڵ بەردەست نییە، تکایە لاپەڕەکە نوێ بکەرەوە', 'error');
      return;
    }

    let exportFrom = state.from || UI.daysAgoStr(6);
    let exportTo = state.to || UI.todayStr();
    let userSearch = '';

    // کۆمەڵەی یوسەرە هەڵبژێردراوەکان — لە سەرەتادا هەموویان هەڵبژێردراون
    const selectedUsers = new Set(state.users.map(u => u.username));

    const body = document.createElement('div');

    function renderModalContent() {
      // ژماردنی تۆمارەکانی هەر بەکارهێنەرێک لە داتای بەردەستدا
      const userCounts = {};
      state.users.forEach(u => {
        userCounts[u.username] = state.records.filter(r => userMatchesRecord(u.username, r)).length;
      });

      const q = norm(userSearch);
      const filteredList = state.users.filter(u => {
        if (!q) return true;
        return norm(u.username).includes(q) || norm(u.profession).includes(q);
      });

      body.innerHTML = `
        <div class="excel-modal-desc">
          دیاریکردنی ئەو بەکارهێنەرانەی دەتەوێت هەناردەی فایلی ئێکسڵ (.xlsx) بکرێن. بۆ هەر بەکارهێنەرێک <b>شیتێکی سەربەخۆ</b> بە خشتەی مۆدێرن بە ئاراستەی ڕاست بۆ چەپ (RTL) دروست دەکرێت.
        </div>

        <div class="excel-date-box">
          <div class="excel-date-grid">
            <div class="field compact-field">
              <label>لە بەروار</label>
              <input type="date" id="ex-from" value="${exportFrom}">
            </div>
            <div class="field compact-field">
              <label>بۆ بەروار</label>
              <input type="date" id="ex-to" value="${exportTo}">
            </div>
          </div>
        </div>

        <div class="excel-filter-bar">
          <div class="field" style="margin-bottom:0;flex:1;min-width:180px">
            <input type="search" id="ex-user-search" placeholder="گەڕان بەدوای یوسەر..." value="${UI.esc(userSearch)}">
          </div>
          <div class="excel-quick-btns">
            <button type="button" class="btn btn-ghost btn-sm" id="ex-select-all">✓ هەمووان</button>
            <button type="button" class="btn btn-ghost btn-sm" id="ex-deselect-all">✕ هیچ</button>
            <button type="button" class="btn btn-ghost btn-sm" id="ex-only-active" title="تەنها ئەوانەی تۆماریان هەیە">🚚 چالاکەکان</button>
          </div>
        </div>

        <div style="font-size:0.8rem;color:var(--muted);margin-bottom:6px;display:flex;justify-content:space-between">
          <span>لیستی بەکارهێنەران (${filteredList.length})</span>
          <span>دیاریکراو: <b id="ex-selected-count" style="color:var(--accent)">${selectedUsers.size}</b> لە ${state.users.length}</span>
        </div>

        <div class="excel-users-grid" id="ex-users-container">
          ${!filteredList.length ? `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--muted)">هیچ بەکارهێنەرێک نەدۆزرایەوە</div>` :
            filteredList.map(u => {
              const isChecked = selectedUsers.has(u.username);
              const count = userCounts[u.username] || 0;
              return `
                <label class="excel-user-card ${isChecked ? 'selected' : ''}" data-username="${UI.esc(u.username)}">
                  <input type="checkbox" class="ex-user-chk" value="${UI.esc(u.username)}" ${isChecked ? 'checked' : ''}>
                  ${UI.avatarHtml(u, 32)}
                  <div class="excel-user-info">
                    <span class="excel-user-name">${UI.esc(u.username)}</span>
                    <div class="excel-user-meta">
                      <span class="chip" style="font-size:0.68rem;padding:1px 6px">${UI.esc(u.profession || 'تر')}</span>
                      <span class="excel-user-badge ${count > 0 ? 'has-records' : ''}">${count} گەشت</span>
                    </div>
                  </div>
                </label>`;
            }).join('')}
        </div>

        <div class="excel-options-box">
          <label class="excel-option-row">
            <input type="checkbox" id="ex-include-summary" checked>
            <span>زیادکردنی شیتێکی سەرەکی (پوختەی گشتی هەموو یوسەرەکان لە یەک شیتدا)</span>
          </label>
        </div>
      `;

      // ئیڤێنتەکانی ناو مۆدال
      const searchInp = $('#ex-user-search', body);
      if (searchInp) {
        searchInp.addEventListener('input', e => {
          userSearch = e.target.value;
          renderModalContent();
          const newInp = $('#ex-user-search', body);
          if (newInp) {
            newInp.focus();
            newInp.selectionStart = newInp.selectionEnd = newInp.value.length;
          }
        });
      }

      $('#ex-from', body)?.addEventListener('change', e => { exportFrom = e.target.value; });
      $('#ex-to', body)?.addEventListener('change', e => { exportTo = e.target.value; });

      $('#ex-select-all', body)?.addEventListener('click', () => {
        state.users.forEach(u => selectedUsers.add(u.username));
        renderModalContent();
      });

      $('#ex-deselect-all', body)?.addEventListener('click', () => {
        selectedUsers.clear();
        renderModalContent();
      });

      $('#ex-only-active', body)?.addEventListener('click', () => {
        selectedUsers.clear();
        state.users.forEach(u => {
          if ((userCounts[u.username] || 0) > 0) selectedUsers.add(u.username);
        });
        renderModalContent();
      });

      body.querySelectorAll('.ex-user-chk').forEach(chk => {
        chk.addEventListener('change', () => {
          const uName = chk.value;
          if (chk.checked) selectedUsers.add(uName);
          else selectedUsers.delete(uName);
          const card = chk.closest('.excel-user-card');
          if (card) card.classList.toggle('selected', chk.checked);
          const sc = $('#ex-selected-count', body);
          if (sc) sc.textContent = selectedUsers.size;
        });
      });
    }

    renderModalContent();

    const { close } = UI.openModal({
      title: '📊 هەناردەکردنی تۆمارەکان بۆ ئێکسڵ (Excel)',
      size: 'lg',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: '📥 دروستکردنی فایلی ئێکسڵ',
          className: 'btn-primary',
          onClick: async (backdrop) => {
            if (!selectedUsers.size) {
              UI.toast('تکایە بەلایەنی کەم یەک بەکارهێنەر هەڵبژێرە!', 'warning');
              return;
            }

            const subBtn = backdrop.querySelector('.modal-foot .btn-primary');
            UI.btnLoading(subBtn, true, 'فایلی ئێکسڵ دروست دەکرێت...');

            try {
              // هێنانی تۆمارەکانی مەودای بەروار
              let exportRecords = [];
              if (exportFrom === state.from && exportTo === state.to && state.records.length) {
                exportRecords = state.records;
              } else {
                const params = { select: '*', order: 'record_date.desc,id.desc' };
                const range = [];
                if (exportFrom) range.push(`gte.${exportFrom}`);
                if (exportTo) range.push(`lte.${exportTo}`);
                if (range.length) params.record_date = range;
                exportRecords = await API.Records.list(params);
              }

              const wb = XLSX.utils.book_new();
              const dateRangeStr = (exportFrom && exportTo)
                ? `لە ${exportFrom} بۆ ${exportTo}`
                : (exportFrom ? `لە ${exportFrom} بەرەو سەرەوە` : (exportTo ? `تا ${exportTo}` : 'هەموو بەروارەکان'));

              const includeSummary = $('#ex-include-summary', body)?.checked ?? true;

              // ١. شیتی پوختەی گشتی
              if (includeSummary) {
                const summaryRows = [
                  ['سیستەمی گەیاندن — پوختەی گشتی بەکارهێنەران'],
                  ['مەودای بەروار:', dateRangeStr, '', 'بەرواری دەرهێنان:', `${UI.todayStr()} ${UI.nowTime()}`],
                  [],
                  ['#', 'ناوی بەکارهێنەر', 'پیشە', 'ژمارەی گەشت', 'کۆی کێش (کگم)', 'کۆی پارچە', 'کۆی وەسڵ', 'کۆی پارەی هێنراوە (د.ع)']
                ];

                let grandTrips = 0, grandWeight = 0, grandPieces = 0, grandReceipts = 0, grandMoney = 0;

                const sortedSelectedUsers = state.users.filter(u => selectedUsers.has(u.username));
                sortedSelectedUsers.forEach((u, idx) => {
                  const uRecs = exportRecords.filter(r => userMatchesRecord(u.username, r));
                  const uWeight = uRecs.reduce((s, r) => s + Number(r.cargo_weight || 0), 0);
                  const uPieces = uRecs.reduce((s, r) => s + Number(r.pieces_count || 0), 0);
                  const uReceipts = uRecs.reduce((s, r) => s + Number(r.receipt_number || 0), 0);
                  const uMoney = uRecs.reduce((s, r) => s + Number(r.collected_money || 0), 0);

                  grandTrips += uRecs.length;
                  grandWeight += uWeight;
                  grandPieces += uPieces;
                  grandReceipts += uReceipts;
                  grandMoney += uMoney;

                  summaryRows.push([
                    idx + 1,
                    u.username,
                    u.profession || '—',
                    uRecs.length,
                    uWeight,
                    uPieces,
                    uReceipts,
                    uMoney
                  ]);
                });

                summaryRows.push([
                  'کۆی گشتی',
                  '',
                  '',
                  grandTrips,
                  grandWeight,
                  grandPieces,
                  grandReceipts,
                  grandMoney
                ]);

                const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
                wsSummary['!views'] = [{ RTL: true }];
                wsSummary['!cols'] = [
                  { wch: 6 },
                  { wch: 22 },
                  { wch: 18 },
                  { wch: 14 },
                  { wch: 16 },
                  { wch: 14 },
                  { wch: 14 },
                  { wch: 24 }
                ];
                wsSummary['!merges'] = [
                  { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
                  { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }
                ];

                XLSX.utils.book_append_sheet(wb, wsSummary, 'پوختەی گشتی');
              }

              // ٢. شیتێکی سەربەخۆ بۆ هەر بەکارهێنەرێکی هەڵبژێردراو
              const selectedUsersList = state.users.filter(u => selectedUsers.has(u.username));
              let sheetsCreated = 0;

              for (const u of selectedUsersList) {
                const uRecs = exportRecords.filter(r => userMatchesRecord(u.username, r));
                const totalWeight = uRecs.reduce((s, r) => s + Number(r.cargo_weight || 0), 0);
                const totalPieces = uRecs.reduce((s, r) => s + Number(r.pieces_count || 0), 0);
                const totalReceipts = uRecs.reduce((s, r) => s + Number(r.receipt_number || 0), 0);
                const totalMoney = uRecs.reduce((s, r) => s + Number(r.collected_money || 0), 0);

                const sheetRows = [
                  ['سیستەمی بەڕێوەبردنی گەیاندن — ڕاپۆرتی تۆمارەکانی گەیاندن'],
                  ['ناوی بەکارهێنەر:', u.username, '', '', 'پیشە:', u.profession || '—'],
                  ['مەودای بەروار:', dateRangeStr, '', '', 'بەرواری دەرکردن:', `${UI.todayStr()} ${UI.nowTime()}`],
                  [`کۆی گەشت: ${uRecs.length} | کۆی کێش: ${totalWeight} کگم | کۆی پارچە: ${totalPieces} | کۆی وەسڵ: ${totalReceipts} | کۆی پارە: ${totalMoney.toLocaleString('en-US')} د.ع`],
                  [],
                  [
                    '#',
                    'بەروار',
                    'شۆفێر',
                    'دابەشکار',
                    'مەندوب',
                    'زۆن',
                    'سەیارە',
                    'کێشی بار (کگم)',
                    'پارچەکان',
                    'وەسڵ',
                    'کاتی دەرچوون',
                    'کاتی ناو زۆن',
                    'کاتی دەرێی زۆن',
                    'کاتی گەشتنەوە',
                    'پارەی هێنراوە (د.ع)'
                  ]
                ];

                if (!uRecs.length) {
                  sheetRows.push(['هیچ تۆمارێک نەدۆزرایەوە بۆ ئەم بەکارهێنەرە لەم بەروارەدا.']);
                } else {
                  uRecs.forEach((r, idx) => {
                    sheetRows.push([
                      idx + 1,
                      r.record_date || '',
                      r.driver || '',
                      r.distributor || '',
                      r.delegate || '',
                      r.zone || '',
                      r.vehicle || '',
                      Number(r.cargo_weight || 0),
                      Number(r.pieces_count || 0),
                      Number(r.receipt_number || 0),
                      r.record_time || '',
                      r.in_zone_time || '',
                      r.out_zone_time || '',
                      r.arrival_time || '',
                      Number(r.collected_money || 0)
                    ]);
                  });

                  sheetRows.push([
                    'کۆی گشتی',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    totalWeight,
                    totalPieces,
                    totalReceipts,
                    '',
                    '',
                    '',
                    '',
                    totalMoney
                  ]);
                }

                const ws = XLSX.utils.aoa_to_sheet(sheetRows);
                ws['!views'] = [{ RTL: true }];
                ws['!cols'] = [
                  { wch: 6 },
                  { wch: 14 },
                  { wch: 18 },
                  { wch: 18 },
                  { wch: 18 },
                  { wch: 20 },
                  { wch: 14 },
                  { wch: 15 },
                  { wch: 12 },
                  { wch: 12 },
                  { wch: 14 },
                  { wch: 14 },
                  { wch: 14 },
                  { wch: 14 },
                  { wch: 20 }
                ];
                ws['!merges'] = [
                  { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
                  { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
                  { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
                  { s: { r: 3, c: 0 }, e: { r: 3, c: 14 } }
                ];

                // ناوی شیتەکە دەبێت تا ٣١ پیت بێت و هێما نایاساییەکانی تێدا نەبێت
                let cleanName = String(u.username || 'یوسەر')
                  .replace(/[\\/?*:[\]]/g, '')
                  .trim()
                  .slice(0, 27);
                if (!cleanName) cleanName = 'یوسەر';

                let finalSheetName = cleanName;
                let c = 2;
                while (wb.SheetNames.includes(finalSheetName)) {
                  finalSheetName = `${cleanName.slice(0, 24)} (${c++})`;
                }

                XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
                sheetsCreated++;
              }

              const cleanDate = (exportFrom || UI.todayStr()).replace(/[^0-9-]/g, '');
              const fileName = `ڕاپۆرتی_گەیاندن_${cleanDate}.xlsx`;
              try {
                XLSX.writeFile(wb, fileName);
              } catch (e) {
                const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 300);
              }

              UI.toast(`فایلی ئێکسڵ بە سەرکەوتوویی دروستکرا (${sheetsCreated} شیت) ✓`, 'success', 4000);
              close();
            } catch (err) {
              UI.toast('هەڵە لە دروستکردنی فایلی ئێکسڵ: ' + err.message, 'error', 5000);
            } finally {
              UI.btnLoading(subBtn, false);
            }
          }
        }
      ]
    });
  }

  async function deleteRecord(rec) {
    const ok = await UI.confirmDialog(`دڵنیاییت لە سڕینەوەی ئەم تۆمارە؟\nشۆفێر: ${rec.driver} — زۆن: ${rec.zone} — بەروار: ${rec.record_date}`, {
      danger: true, okLabel: 'بەڵێ، بسڕەوە', cancelLabel: 'پاشگەزبوونەوە'
    });
    if (!ok) return;

    try {
      await API.Records.remove(rec.id);
      UI.toast('تۆمارەکە سڕدرایەوە ✓', 'success');
      await loadData({ silent: true });
    } catch (err) {
      UI.toast('هەڵە لە سڕینەوە: ' + err.message, 'error', 4200);
    }
  }

  /* =========================================================
   *  ٢. بەشی بەکارهێنەران (usersv2)
   * ========================================================= */

  function renderUsersTab(wrap) {
    const rows = filteredUsers();
    const professions = [
      CONFIG.PROFESSION_DRIVER,
      CONFIG.PROFESSION_DISTRIBUTOR,
      CONFIG.PROFESSION_DELEGATE,
      CONFIG.PROFESSION_SUPERVISOR,
      'بەڕێوبەر'
    ];

    wrap.innerHTML = `
      <section class="card filter-card">
        <div class="admin-header-row" style="margin-bottom:6px">
          <h3 style="font-size:0.96rem">بەڕێوەبردنی بەکارهێنەران (خشتەی usersv2)</h3>
          <button type="button" class="btn btn-primary btn-sm" id="admin-add-user-btn">➕ بەکارهێنەری نوێ</button>
        </div>

        <div class="field-row">
          <div class="field">
            <label>پیشە</label>
            <select id="adm-user-prof">
              <option value="">هەموو پیشەکان</option>
              ${[...new Set(professions)].map(p => `
                <option value="${UI.esc(p)}" ${state.userProfFilter === p ? 'selected' : ''}>${UI.esc(p)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>گەڕان لە بەکارهێنەران</label>
            <input type="search" id="adm-user-search" placeholder="ناو، پیشە، تێپەڕەوشە..." value="${UI.esc(state.userSearch)}">
          </div>
        </div>
      </section>

      <div class="user-cards-grid">
        ${!rows.length ? `<div class="empty-state" style="grid-column:1/-1"><p>هیچ بەکارهێنەرێک نەدۆزرایەوە.</p></div>` :
          rows.map(u => `
            <div class="user-card">
              <div class="user-card-top">
                ${UI.avatarHtml(u, 46)}
                <div class="user-card-info">
                  <strong>${UI.esc(u.username)}</strong>
                  <span class="chip">${UI.esc(u.profession || '—')}</span>
                </div>
              </div>
              <div class="user-card-meta">
                <span>تێپەڕەوشە (PIN):</span>
                <span class="pin-code">${UI.esc(u.password || '••••')}</span>
              </div>
              <div class="user-card-actions">
                <button type="button" class="btn btn-ghost btn-sm adm-usr-view" data-username="${UI.esc(u.username)}" title="بینینی کارەکان">📋 کارەکانی</button>
                <button type="button" class="btn btn-ghost btn-sm adm-usr-edit" data-id="${u.id}">✏️ دەستکاری</button>
                <button type="button" class="btn btn-danger btn-sm adm-usr-del" data-id="${u.id}">🗑️</button>
              </div>
            </div>`).join('')}
      </div>`;

    // ئیڤێنتەکان
    $('#adm-user-prof', wrap).addEventListener('change', e => { state.userProfFilter = e.target.value; renderContent(); });
    $('#adm-user-search', wrap).addEventListener('input', e => { state.userSearch = e.target.value; renderContent(); });
    $('#admin-add-user-btn', wrap).addEventListener('click', () => openUserModal());

    // بینینی کارەکانی بەکارهێنەر ڕاستەوخۆ
    wrap.querySelectorAll('.adm-usr-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const username = btn.dataset.username;
        state.subtab = 'records';
        state.selectedUser = username;
        // ڕێکخستنی بەروارەکان بۆ هەموو کات بۆ ئەوەی داتاکانی بە تەواوی ببینرێت
        state.from = '';
        state.to = '';
        container.querySelectorAll('.admin-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.sub === 'records'));
        loadData();
      });
    });

    wrap.querySelectorAll('.adm-usr-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const u = state.users.find(x => x.id === id);
        if (u) openUserModal(u);
      });
    });

    wrap.querySelectorAll('.adm-usr-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const u = state.users.find(x => x.id === id);
        if (u) deleteUser(u);
      });
    });
  }

  function openUserModal(user = null) {
    const isEdit = !!user;
    const body = document.createElement('div');
    body.innerHTML = `
      <form id="adm-user-form" novalidate>
        <div class="field">
          <label>ناوی بەکارهێنەر *</label>
          <input type="text" id="mu-username" value="${user ? UI.esc(user.username) : ''}">
        </div>
        <div class="field">
          <label>پیشە *</label>
          <select id="mu-prof">
            <option value="${CONFIG.PROFESSION_DRIVER}" ${user?.profession === CONFIG.PROFESSION_DRIVER ? 'selected' : ''}>${CONFIG.PROFESSION_DRIVER}</option>
            <option value="${CONFIG.PROFESSION_DISTRIBUTOR}" ${user?.profession === CONFIG.PROFESSION_DISTRIBUTOR ? 'selected' : ''}>${CONFIG.PROFESSION_DISTRIBUTOR}</option>
            <option value="${CONFIG.PROFESSION_DELEGATE}" ${user?.profession === CONFIG.PROFESSION_DELEGATE ? 'selected' : ''}>${CONFIG.PROFESSION_DELEGATE}</option>
            <option value="${CONFIG.PROFESSION_SUPERVISOR}" ${user?.profession === CONFIG.PROFESSION_SUPERVISOR || user?.profession === 'بەڕێوبەر' ? 'selected' : ''}>بەڕێوبەر</option>
          </select>
        </div>
        <div class="field">
          <label>تێپەڕەوشە (٤ ژمارە) *</label>
          <input type="text" id="mu-pass" inputmode="numeric" maxlength="4" value="${user ? UI.esc(user.password || '') : ''}" placeholder="1234" class="pin-input">
        </div>
      </form>`;

    $('#mu-pass', body).addEventListener('input', e => {
      e.target.value = UI.toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4);
    });

    const { close } = UI.openModal({
      title: isEdit ? '✏️ دەستکاریکردنی بەکارهێنەر' : '➕ زیادکردنی بەکارهێنەری نوێ',
      size: 'wide',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: isEdit ? 'پاشەکەوتکردن' : 'تۆمارکردن',
          className: 'btn-primary',
          onClick: async (backdrop) => {
            const subBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const username = $('#mu-username', body).value.trim();
            const profession = $('#mu-prof', body).value;
            const password = UI.toLatinDigits($('#mu-pass', body).value.trim());

            if (!username) { UI.toast('تکایە ناوی بەکارهێنەر بنووسە', 'warning'); return; }
            if (!/^\d{4}$/.test(password)) { UI.toast('تێپەڕەوشە دەبێت ٤ ژمارە بێت', 'warning'); return; }

            UI.btnLoading(subBtn, true, 'پاشەکەوت دەکرێت...');
            try {
              if (isEdit) {
                await API.Lists.updateUser(user.id, { username, profession, password });
                UI.toast('بەکارهێنەر نوێ کرایەوە ✓', 'success');
              } else {
                await API.Lists.insertUser({ username, profession, password, avatar_url: null });
                UI.toast('بەکارهێنەری نوێ زیادکرا ✓', 'success');
              }
              close();
              await loadData({ silent: true });
            } catch (err) {
              UI.toast('هەڵە لە پاشەکەوتکردن: ' + err.message, 'error', 4200);
            } finally {
              UI.btnLoading(subBtn, false);
            }
          }
        }
      ]
    });
  }

  async function deleteUser(user) {
    if (user.id === App.getUser().id) {
      UI.toast('ناتوانیت هەژماری خۆت بسڕیتەوە!', 'error');
      return;
    }

    const ok = await UI.confirmDialog(`دڵنیاییت لە سڕینەوەی بەکارهێنەر «${user.username}»؟\nپیشە: ${user.profession}`, {
      danger: true, okLabel: 'بەڵێ، بسڕەوە', cancelLabel: 'پاشگەزبوونەوە'
    });
    if (!ok) return;

    try {
      await API.Lists.deleteUser(user.id);
      UI.toast('بەکارهێنەر سڕدرایەوە ✓', 'success');
      await loadData({ silent: true });
    } catch (err) {
      UI.toast('هەڵە لە سڕینەوە: ' + err.message, 'error', 4200);
    }
  }

  /* =========================================================
   *  ٣. بەشی زۆنەکان (zonesv2)
   * ========================================================= */

  function renderZonesTab(wrap) {
    const rows = filteredZones();

    wrap.innerHTML = `
      <section class="card filter-card">
        <div class="admin-header-row" style="margin-bottom:6px">
          <h3 style="font-size:0.96rem">بەڕێوەبردنی زۆنەکان (خشتەی zonesv2)</h3>
          <button type="button" class="btn btn-primary btn-sm" id="admin-add-zone-btn">➕ زۆنی نوێ</button>
        </div>

        <div class="field">
          <label>گەڕان لە زۆنەکان</label>
          <input type="search" id="adm-zone-search" placeholder="ناوی زۆن بنووسە..." value="${UI.esc(state.zoneSearch)}">
        </div>
      </section>

      <div class="zone-cards-grid">
        ${!rows.length ? `<div class="empty-state" style="grid-column:1/-1"><p>هیچ زۆنێک نەدۆزرایەوە.</p></div>` :
          rows.map(z => `
            <div class="zone-card">
              <span class="zone-name">🗺️ ${UI.esc(z.name)}</span>
              <div class="zone-actions">
                <button type="button" class="btn-action-sm btn-edit adm-zn-edit" data-id="${z.id}">✏️</button>
                <button type="button" class="btn-action-sm btn-del adm-zn-del" data-id="${z.id}">🗑️</button>
              </div>
            </div>`).join('')}
      </div>`;

    $('#adm-zone-search', wrap).addEventListener('input', e => { state.zoneSearch = e.target.value; renderContent(); });
    $('#admin-add-zone-btn', wrap).addEventListener('click', () => openZoneModal());

    wrap.querySelectorAll('.adm-zn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const z = state.zones.find(x => x.id === id);
        if (z) openZoneModal(z);
      });
    });

    wrap.querySelectorAll('.adm-zn-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const z = state.zones.find(x => x.id === id);
        if (z) deleteZone(z);
      });
    });
  }

  function openZoneModal(zone = null) {
    const isEdit = !!zone;
    const body = document.createElement('div');
    body.innerHTML = `
      <form id="adm-zone-form" novalidate>
        <div class="field">
          <label>ناوی زۆن / ناوچە *</label>
          <input type="text" id="mz-name" value="${zone ? UI.esc(zone.name) : ''}" placeholder="بۆ نموونە: هەولێر - بەختیاری">
        </div>
      </form>`;

    const { close } = UI.openModal({
      title: isEdit ? '✏️ دەستکاریکردنی زۆن' : '➕ زیادکردنی زۆنی نوێ',
      size: 'wide',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: isEdit ? 'پاشەکەوتکردن' : 'تۆمارکردن',
          className: 'btn-primary',
          onClick: async (backdrop) => {
            const subBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const name = $('#mz-name', body).value.trim();
            if (!name) { UI.toast('تکایە ناوی زۆن بنووسە', 'warning'); return; }

            UI.btnLoading(subBtn, true, 'پاشەکەوت دەکرێت...');
            try {
              if (isEdit) {
                await API.Lists.updateZone(zone.id, { name });
                UI.toast('ناوی زۆن نوێ کرایەوە ✓', 'success');
              } else {
                await API.Lists.insertZone({ name });
                UI.toast('زۆنی نوێ زیادکرا ✓', 'success');
              }
              close();
              await loadData({ silent: true });
            } catch (err) {
              UI.toast('هەڵە لە پاشەکەوتکردن: ' + err.message, 'error', 4200);
            } finally {
              UI.btnLoading(subBtn, false);
            }
          }
        }
      ]
    });
  }

  async function deleteZone(zone) {
    const ok = await UI.confirmDialog(`دڵنیاییت لە سڕینەوەی زۆنی «${zone.name}»؟`, {
      danger: true, okLabel: 'بەڵێ، بسڕەوە', cancelLabel: 'پاشگەزبوونەوە'
    });
    if (!ok) return;

    try {
      await API.Lists.deleteZone(zone.id);
      UI.toast('زۆن سڕدرایەوە ✓', 'success');
      await loadData({ silent: true });
    } catch (err) {
      UI.toast('هەڵە لە سڕینەوە: ' + err.message, 'error', 4200);
    }
  }

  /* ---------------- نوێبوونەوەی خۆکار ---------------- */

  function start() {
    stop();
    refreshTimer = setInterval(() => {
      if (!document.hidden && container && container.isConnected) loadData({ silent: true });
    }, CONFIG.REPORTS_REFRESH_SEC * 1000);
  }

  function stop() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  return { render, stop };
})();
