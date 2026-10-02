/* =========================================================
 *  پانێلی بەڕێوبەر — Admin Dashboard
 *  بینین، گەڕان و تەواوی کردارەکانی (CRUD) لەسەر هەردوو سەب بەیسەکە:
 *  ١. تۆمارەکانی گەیاندن (delivery_records)
 *  ٢. بەکارهێنەران (usersv2)
 *  ٣. زۆنەکان (zonesv2)
 * ========================================================= */

const AdminView = (() => {

  const $ = (sel, root) => (root || document).querySelector(sel);

  // ڕۆژەکانی حەفتە بە ڕیزی کوردی (شەممە دەستپێکە) — ناوەکان هاوتای UI.weekdayKu
  const WEEKDAY_OPTIONS = ['شەممە', 'یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی'];

  let container = null;
  let refreshTimer = null;

  let state = {
    subtab: 'records', // 'records' | 'users' | 'zones'
    loading: false,

    // خشتەی تۆمارەکان
    records: [],
    // لە یەکی ئەم مانگە تا ئەمڕۆ بە خۆکاری
    from: UI.monthStartStr(),
    to: UI.todayStr(),
    recordSearch: '',
    selectedUser: '', // دانە بەدانەی یوسەرەکان
    dayFilter: '', // فلتەری ڕۆژەکانی حەفتە
    recSort: { key: 'record_date', dir: 'desc' }, // ڕیزکردنی خشتە بە داگرتن لەسەر سەرپەڕە

    // خشتەی بەکارهێنەران
    users: [],
    userSearch: '',
    userProfFilter: '',
    showAllPass: false, // پشاندانی هەموو تێپەڕەوشەکان

    // خشتەی زۆنەکان
    zones: [],
    zoneSearch: '',

    secondOnly: false, // تەنها باری دووەم پیشان بدە
    outZoneOnly: false, // تەنها تۆمارەکانی دەرێی زۆن (هەمان فلتەری فۆڕمی ڕاپۆرت)
    arrivalOnly: false, // تەنها تۆمارەکانی گەشتنەوە (هەمان فلتەری فۆڕمی ڕاپۆرت)
  };

  const norm = s => UI.toLatinDigits(String(s || ''))
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ی').replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  // ئایا تۆمارەکە باری دووەم/سێیەمە؟ — بەپێی پاشگری ناوی شۆفێر («دوو»/«سێ»)
  const cargoIdxOf = r => {
    const d = String((r && r.driver) || '').replace(/\s*\+\s*$/, '').trim();
    if (/(?:^|\s)دوو$/.test(d)) return 1;
    if (/(?:^|\s)سێ$/.test(d)) return 2;
    return 0;
  };

  // هەڵبژاردەی فلتەری بەکارهێنەر ئایدی یوسەرە لە usersv2 — نەک ناو
  function selectedUserObj() {
    if (!state.selectedUser) return null;
    return state.users.find(u => String(u.id) === String(state.selectedUser)) || null;
  }

  // هاوتاکردنی تۆمار لەگەڵ بەکارهێنەر — بە ئایدی ئەگەر هەبێت، ئەگینا بە ناو
  function userMatchesRecord(user, r) {
    if (!user || !r) return false;
    return (
      UI.recMatchesUser(r, 'driver', user) ||
      UI.recMatchesUser(r, 'distributor', user) ||
      UI.recMatchesUser(r, 'delegate', user)
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

    // فلتەری دانە بەدانەی یوسەرەکان — بە ئایدی
    if (state.selectedUser) {
      const su = selectedUserObj();
      if (su) rows = rows.filter(r => userMatchesRecord(su, r));
    }

    // فلتەری ڕۆژەکانی حەفتە — بەپێی ڕۆژی بەرواری تۆمارەکە
    if (state.dayFilter) {
      rows = rows.filter(r => r.record_date && UI.weekdayKu(new Date(r.record_date + 'T00:00:00')) === state.dayFilter);
    }

    // گەڕان
    if (state.recordSearch) {
      const q = norm(state.recordSearch);
      rows = rows.filter(r =>
        [r.driver, r.distributor, r.delegate, r.zone, r.vehicle, r.receipt_number]
          .some(v => norm(v).includes(q))
      );
    }

    // تەنها باری دووەم — ئەو بارانەی دوای دەرچوونی یەکەم تۆمارکراون (پاشگری دوو/سێ)
    if (state.secondOnly) {
      rows = rows.filter(r => cargoIdxOf(r) >= 1);
    }

    // فلتەری دەرێی زۆن — تۆمارەکانی دەرێی زۆن کردووە بەبێ گەشتنەوە (وەک فۆڕمی ڕاپۆرت)
    if (state.outZoneOnly) {
      rows = rows.filter(r => r.out_zone_time && !r.arrival_time);
    }
    // فلتەری گەشتنەوە — تۆمارەکانی گەشتنەوەیان ئەنجام داوە
    if (state.arrivalOnly) {
      rows = rows.filter(r => !!r.arrival_time);
    }

    // ڕیزکردن بەپێی ستوونی هەڵبژێردراو (بە داگرتن لەسەر سەرپەڕە)
    const s = state.recSort || { key: 'record_date', dir: 'desc' };
    const dir = s.dir === 'asc' ? 1 : -1;
    const numKeys = ['cargo_weight', 'pieces_count', 'receipt_number', 'collected_money'];
    rows = [...rows].sort((a, b) => {
      if (numKeys.includes(s.key)) {
        return (Number(a[s.key] || 0) - Number(b[s.key] || 0)) * dir;
      }
      const c = String(a[s.key] || '').localeCompare(String(b[s.key] || ''), 'ckb');
      if (c !== 0) return c * dir;
      return (Number(a.id || 0) - Number(b.id || 0)) * dir;
    });
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
        [u.username, u.profession, u.password, u.phone_number_1, u.phone_number_2, u.location].some(v => norm(v).includes(q))
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
    if (!state.from) state.from = UI.monthStartStr();
    if (!state.to) state.to = UI.todayStr();

    el.innerHTML = `
      <section class="card" style="padding:14px 18px 12px">
        <div class="admin-header-row">
          <div>
            <h2 class="hero-title"><span class="sec-icon">${UI.icon('shield', 20)}</span> پانێلی بەڕێوەبردن</h2>
            <p class="hero-sub">تەواوی داتاکانی هەر دوو پڕۆژەی Supabase و کۆنتڕۆڵی CRUD</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <button type="button" class="chip-btn ${state.outZoneOnly ? 'active' : ''}" id="admin-out-zone-only" title="تەنها ئەو گەشتانە پیشان بدە کە دەرێی زۆنیان تۆمارکردووە">🚏 دەرێی زۆن</button>
            <button type="button" class="chip-btn ${state.arrivalOnly ? 'active' : ''}" id="admin-arrival-only" title="تەنها ئەو گەشتانە پیشان بدە کە گەشتنەوەیان تۆمارکردووە">🏁 گەشتنەوە</button>
            <button class="btn btn-ghost btn-sm" id="admin-refresh-btn">⟳ نوێکردنەوە</button>
          </div>
        </div>

        <!-- بەشەکان (Subtabs) — بەپێی دەسەڵاتەکان -->
        <div class="admin-tabs" id="admin-subtabs">
          ${Perms.canView(App.getUser(), 'admin_records') ? `
          <button type="button" class="admin-tab-btn ${state.subtab === 'records' ? 'active' : ''}" data-sub="records">
            <span class="sec-icon">${UI.icon('truck', 15)}</span> تۆمارەکان <span class="badge-count" id="badge-records-count">${state.records.length}</span>
          </button>` : ''}
          ${Perms.canView(App.getUser(), 'admin_users') ? `
          <button type="button" class="admin-tab-btn ${state.subtab === 'users' ? 'active' : ''}" data-sub="users">
            <span class="sec-icon">${UI.icon('users', 15)}</span> بەکارهێنەران <span class="badge-count" id="badge-users-count">${state.users.length}</span>
          </button>` : ''}
          ${Perms.canView(App.getUser(), 'admin_zones') ? `
          <button type="button" class="admin-tab-btn ${state.subtab === 'zones' ? 'active' : ''}" data-sub="zones">
            <span class="sec-icon">${UI.icon('map', 15)}</span> زۆنەکان <span class="badge-count" id="badge-zones-count">${state.zones.length}</span>
          </button>` : ''}
          <!-- فۆڕمی پیشە — تەنها لە مۆبایل لێرە دەردەکەوێت (لە دیسکتۆپ لە باڕی خوارەوەیە) -->
          <button type="button" class="admin-tab-btn admin-mobile-only" id="admin-professions-btn" title="فۆڕمی پیشە و دەسەڵاتەکان">
            <span class="sec-icon">${UI.icon('badge', 15)}</span> پیشەکان
          </button>
        </div>
      </section>

      <div id="admin-content"></div>`;

    // دووگمەی «پیشەکان» — لە مۆبایل فۆڕمی پیشە دەکاتەوە (لە دیسکتۆپ تابی باڕی خوارەوەیە)
    $('#admin-professions-btn', el)?.addEventListener('click', () => App.switchTab('professions'));

    // ئەگەر بەشی چالاک بەپێی دەسەڵاتەکان نەبینرێت، بگەڕێ بۆ یەکەم بەشی بینراو
    const visibleSubs = [...el.querySelectorAll('.admin-tab-btn[data-sub]')].map(b => b.dataset.sub);
    if (!visibleSubs.includes(state.subtab) && visibleSubs.length) {
      state.subtab = visibleSubs[0];
      el.querySelectorAll('.admin-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.sub === state.subtab));
    }
    if (!visibleSubs.length) {
      $('#admin-content', el).innerHTML = `<div class="empty-state"><div class="empty-ico">🔒</div><p>هیچ بەشێک لە پانێلی بەڕێوەبردن بۆ پیشەکەت چالاک نەکراوە.</p></div>`;
      $('#admin-refresh-btn', el)?.addEventListener('click', () => loadData());
      return;
    }

    // گۆڕینی بەشەکان
    el.querySelectorAll('.admin-tab-btn[data-sub]').forEach(b => {
      b.addEventListener('click', () => {
        state.subtab = b.dataset.sub;
        el.querySelectorAll('.admin-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.sub === state.subtab));
        renderContent();
      });
    });

    $('#admin-refresh-btn', el).addEventListener('click', () => loadData());

    // فلتەری دەرێی زۆن / گەشتنەوە — هەمان تایبەتی فۆڕمی ڕاپۆرت:
    // تەنها ئەو گەشتانە پیشان دەدات کە دەرێی زۆن یان گەشتنەوەیان تۆمارکراوە
    const tripFilterHandler = (key, otherKey) => () => {
      state[key] = !state[key];
      if (state[key]) state[otherKey] = false;
      $('#admin-out-zone-only', el)?.classList.toggle('active', state.outZoneOnly);
      $('#admin-arrival-only', el)?.classList.toggle('active', state.arrivalOnly);
      if (state.subtab !== 'records') {
        // ئەگەر لە بەشێکی تری پانێلەکە بێت، بگەڕێتەوە بۆ تۆمارەکان
        state.subtab = 'records';
        el.querySelectorAll('.admin-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.sub === 'records'));
        renderContent();
      } else {
        renderRecordsResults($('#admin-content', container));
      }
    };
    $('#admin-out-zone-only', el).addEventListener('click', tripFilterHandler('outZoneOnly', 'arrivalOnly'));
    $('#admin-arrival-only', el).addEventListener('click', tripFilterHandler('arrivalOnly', 'outZoneOnly'));

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

  function renderRecordsTab(wrap) {
    wrap.innerHTML = `
      <section class="card filter-card">
        <div class="admin-header-row" style="margin-bottom:8px">
          <div>
            <h3 style="font-size:1.02rem;font-weight:800"><span class="sec-icon">${UI.icon('truck')}</span> تۆمارەکانی گەیاندن</h3>
            <p class="muted" style="font-size:0.8rem">بینین، فلتەرکردن، ڕیزکردن، پرێنتکردن و هەناردەی فرە-شیتی ئێکسڵ</p>
          </div>
          <div class="admin-actions-bar">
            <button type="button" class="btn btn-ghost btn-sm" id="admin-print-btn" title="پرێنتکردنی داتای فلتەرکراو">
              🖨️ پرێنتکردن
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="admin-excel-btn" title="هەناردەکردنی بەکارهێنەران بۆ ئێکسڵ">
              📊 بەئێکسڵکردن
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="admin-fix-ids-btn" title="پڕکردنەوەی ئایدی تۆمارە کۆنەکان لە usersv2">
              🔗 ئایدیەکان ڕێکبخە
            </button>
            <button type="button" class="btn btn-primary btn-sm" id="admin-add-rec-btn">
              ➕ زیادکردنی باری نوێ
            </button>
          </div>
        </div>

        <div class="date-range-compact with-toggle">
          <div class="field compact-field"><label>لە بەروار</label><input type="date" id="adm-from" value="${state.from}"></div>
          <div class="field compact-field"><label>بۆ بەروار</label><input type="date" id="adm-to" value="${state.to}"></div>
          <button type="button" class="field-toggle-btn ${state.secondOnly ? 'active' : ''}" id="adm-second-only" title="تەنها تۆمارەکانی باری دووەم پیشان بدە">تەنها باری دووەم</button>
        </div>

        <div class="field-row">
          <div class="field" style="flex:1.2">
            <label>فلتەری بەکارهێنەر (دانە بەدانەی یوسەرەکان)</label>
            <select id="adm-user-filter">
              <option value="">هەموو بەکارهێنەران</option>
              ${state.users.map(u => `
                <option value="${UI.esc(String(u.id))}" ${String(state.selectedUser) === String(u.id) ? 'selected' : ''}>
                  ${UI.esc(u.username)} (${UI.esc(u.profession || 'تر')})
                </option>`).join('')}
            </select>
          </div>
          <div class="field" style="flex:1">
            <label>ڕۆژەکانی حەفتە</label>
            <select id="adm-day-filter">
              <option value="">هەموو ڕۆژەکان</option>
              ${WEEKDAY_OPTIONS.map(d => `<option value="${UI.esc(d)}" ${state.dayFilter === d ? 'selected' : ''}>${UI.esc(d)}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="flex:1.8">
            <label>گەڕان</label>
            <input type="search" id="adm-rec-search" placeholder="شۆفێر، دابەشکار، مەندوب، زۆن، سەیارە..." value="${UI.esc(state.recordSearch)}">
          </div>
          <div class="field" style="flex:0.8">
            <label>خانەی دەستپێک</label>
            <input type="time" id="adm-base-time" value="${UI.esc(Store.getBaseTime())}" title="کاتی دەستپێکی گشت تۆمارەکان — کاتی کارکردن = گەشتنەوە − ئەم کاتە. گۆڕانکاری پێویستی بە دڵنیایی هەیە و بۆ هەموو ئامێرەکان دەگات">
          </div>
        </div>
      </section>

      <div id="adm-rec-results"></div>`;

    // ئیڤێنتەکان
    $('#adm-from', wrap).addEventListener('change', e => { state.from = e.target.value; loadData(); });
    $('#adm-to', wrap).addEventListener('change', e => { state.to = e.target.value; loadData(); });
    $('#adm-user-filter', wrap).addEventListener('change', e => { state.selectedUser = e.target.value; renderRecordsResults(wrap); });
    $('#adm-day-filter', wrap).addEventListener('change', e => { state.dayFilter = e.target.value; renderRecordsResults(wrap); });
    $('#adm-rec-search', wrap).addEventListener('input', e => { state.recordSearch = e.target.value; renderRecordsResults(wrap); });
    $('#adm-second-only', wrap).addEventListener('click', e => {
      state.secondOnly = !state.secondOnly;
      e.currentTarget.classList.toggle('active', state.secondOnly);
      renderRecordsResults(wrap);
    });

    // خانەی دەستپێک — کاتی دەستپێکی کار بۆ تۆمارەکانی ئەمڕۆ بەدواوە؛ لە کۆنفیگی ناوەندیدا پاشەکەوت دەکرێت
    $('#adm-base-time', wrap).addEventListener('change', async e => {
      const newVal = e.target.value;
      const oldVal = Store.getBaseTime();
      if (newVal === oldVal) return;
      const ok = await UI.confirmDialog(
        `دڵنیایت لە گۆڕینی کاتی دەستپێک بۆ «${newVal || '—'}»؟ (کاتی ئێستا: ${oldVal || '—'})\nتەنها تۆمارەکانی ئەمڕۆ بەدواوە بەپێی کاتی نوێ حیساب دەکرێنەوە — داتاکانی ڕابردوو بێگوێرانەوە دەمێننەوە.`,
        { okLabel: 'بەڵێ، بیگۆڕە', cancelLabel: 'نەخێر' }
      );
      if (ok) {
        try {
          await Store.setBaseTime(newVal);
          // نوێکردنەوەی average_time بۆ تۆمارەکانی ئەمڕۆ بەدواوە (کاتی نوێ) — ڕابردوو دەست ناڵێدرێت
          UI.btnLoading(e.target, true, '...');
          let updated = 0;
          try {
            const today = UI.todayStr();
            const rows = (await API.Records.list({ 'record_date': `gte.${today}` })) || [];
            for (const r of rows) {
              if (!r.arrival_time) continue;
              const mins = UI.durationMinutes(newVal || r.record_time, r.arrival_time);
              const av = UI.durationToHMM(mins);
              if (av && av !== (r.average_time || null)) {
                await API.Records.update(r.id, { average_time: av });
                updated++;
              }
            }
          } catch (err) {
            console.warn('هەڵە لە نوێکردنەوەی average_time:', err);
          } finally {
            UI.btnLoading(e.target, false);
          }
          UI.toast(`کاتی دەستپێک نوێکرایەوە ✓ — ${UI.fmtNum(updated)} تۆماری ئەمڕۆ بە کاتی نوێ حیسابکرانەوە (ڕابردوو بێگوێرانەوە)`, 'success', 5000);
          renderRecordsResults(wrap);
        } catch (err) {
          UI.toast('هەڵە لە پاشەکەوتکردن: ' + err.message, 'error', 4200);
          e.target.value = oldVal;
        }
      } else {
        e.target.value = oldVal;
      }
    });
    $('#admin-print-btn', wrap).addEventListener('click', () => printRecords());
    $('#admin-excel-btn', wrap).addEventListener('click', () => openExcelExportModal());
    $('#admin-fix-ids-btn', wrap).addEventListener('click', () => runUserIdBackfill());
    $('#admin-add-rec-btn', wrap).addEventListener('click', () => openRecordModal());

    renderRecordsResults(wrap);
  }

  // تەنها بەشە ئەنجامەکان (کۆیەکان + خشتە) نوێ دەکاتەوە، بێ دەستکاری خانەی گەڕان
  function renderRecordsResults(wrap) {
    const resultsEl = $('#adm-rec-results', wrap);
    if (!resultsEl) return;

    const rows = filteredRecords();

    // جیاکردنەوەی بارەکان بەپێی پاشگری ناوی شۆفێر («دوو»/«سێ» = باری دووەم/سێیەم)
    const firstRows = rows.filter(r => cargoIdxOf(r) === 0);
    const secondRows = rows.filter(r => cargoIdxOf(r) >= 1);

    // کۆیەکان — بۆ لیستێکی دیاریکراوی تۆمارەکان
    const computeTotals = list => list.reduce((a, r) => {
      const d = UI.recordDurationMinutes(r);
      return {
        weight: a.weight + UI.cleanInt(r.cargo_weight),
        pieces: a.pieces + UI.cleanInt(r.pieces_count),
        receipts: a.receipts + UI.cleanInt(r.receipt_number),
        money: a.money + UI.cleanInt(r.collected_money),
        workMins: a.workMins + (d === null ? 0 : d),
        workCount: a.workCount + (d === null ? 0 : 1),
      };
    }, { weight: 0, pieces: 0, receipts: 0, money: 0, workMins: 0, workCount: 0 });

    const totalsCardsHtml = (list, totals) => {
      const totalCards = {
        trips:    { val: UI.fmtNum(list.length), lbl: 'گەشت' },
        weight:   { val: UI.fmtNum(totals.weight), lbl: 'کۆی کێش (کگم)' },
        pieces:   { val: UI.fmtNum(totals.pieces), lbl: 'کۆی پارچە' },
        receipts: { val: UI.fmtNum(totals.receipts), lbl: 'کۆی وەسڵ' },
        workTime: { val: UI.fmtDuration(totals.workCount ? totals.workMins : null), lbl: `کۆی کاتی کارکردن (${totals.workCount} گەشت)`, style: 'font-size:0.98rem' },
        money:    { val: UI.fmtNum(totals.money), lbl: 'کۆی پارە (د.ع)', accent: true },
      };
      return CONFIG.TOTAL_CARDS
        .filter(c => totalCards[c.key] && !Store.isTotalHidden(c.key))
        .map(c => {
          const d = totalCards[c.key];
          return `<div class="total-card${d.accent ? ' accent' : ''}"><span class="total-val"${d.style ? ` style="${d.style}"` : ''}>${d.val}</span><span class="total-lbl">${d.lbl}</span></div>`;
        }).join('');
    };

    // ستوونەکانی خشتە — هەر ستوونێک دانە دانە دەشاردرێتەوە
    const COLS = [
      { key: 'record_date', label: 'بەروار', cls: 'nowrap', render: r => UI.esc(r.record_date || '—') },
      { key: 'weekday', label: 'ڕۆژی حەفتە', render: r => r.record_date ? UI.weekdayKu(new Date(r.record_date + 'T00:00:00')) : '—' },
      { key: 'driver', label: 'شۆفێر', render: r => `<b>${UI.esc(r.driver || '—')}</b>` },
      { key: 'distributor', label: 'دابەشکار', render: r => UI.esc(r.distributor || '—') },
      { key: 'delegate', label: 'مەندوب', render: r => UI.esc(r.delegate || '—') },
      { key: 'zone', label: 'زۆن', render: r => UI.esc(r.zone || '—') },
      { key: 'vehicle', label: 'سەیارە', render: r => UI.esc(r.vehicle || '—') },
      { key: 'cargo_weight', label: 'کێش', render: r => UI.fmtNum(r.cargo_weight) },
      { key: 'pieces_count', label: 'پارچە', render: r => UI.fmtNum(r.pieces_count) },
      { key: 'receipt_number', label: 'وەسڵ', render: r => UI.fmtNum(r.receipt_number) },
      { key: 'record_time', label: 'دەرچوون', render: r => UI.esc(r.record_time || '—') },
      { key: 'in_zone_time', label: 'ناو زۆن', render: r => UI.esc(r.in_zone_time || '—') },
      { key: 'out_zone_time', label: 'دەرێی زۆن', render: r => UI.esc(r.out_zone_time || '—') },
      { key: 'arrival_time', label: 'گەشتنەوە', render: r => UI.esc(r.arrival_time || '—') },
      { key: 'work_time', label: 'کاتی کارکردن', cls: 'nowrap', styleFn: r => ((r.record_time && r.arrival_time) || r.work_time) ? 'color:var(--accent);font-weight:700' : '', render: r => UI.workTimeDisplay(r) },
      { key: 'collected_money', label: 'پارەی هێنراوە', cls: 'money-cell', render: r => UI.fmtNum(r.collected_money) },
    ];
    const visCols = COLS.filter(c => !Store.isColHidden(c.key));
    const colCount = visCols.length;

    const thHtml = visCols.map(c => {
      const active = state.recSort.key === c.key;
      const arrow = active ? (state.recSort.dir === 'asc' ? '▲' : '▼') : '↕';
      return `<th class="sortable ${active ? 'sorted' : ''}" data-sort="${c.key}" title="بۆ ڕیزکردن داگرتنی بکە">${c.label}<span class="sort-arrow">${arrow}</span></th>`;
    }).join('');

    const rowCells = r => visCols.map(c => {
      const st = c.styleFn ? c.styleFn(r) : '';
      return `<td data-label="${UI.esc(c.label)}"${c.cls ? ` class="${c.cls}"` : ''}${st ? ` style="${st}"` : ''}>${c.render(r)}</td>`;
    }).join('');

    // تۆتاڵەکان — بە ئاسایی تەنها باری یەکەم؛ کاتێک دوگمەی «تەنها باری دووەم» چالاکە تەنها باری دووەم پیشان دەدرێت
    const totalsHtml = state.secondOnly ? `
      <div class="totals-section">
        <div class="totals-section-head second">🚚 کۆیەکان — باری دووەم <span class="totals-count">${UI.fmtNum(secondRows.length)} گەشت</span></div>
        <div class="totals-grid">${totalsCardsHtml(secondRows, computeTotals(secondRows))}</div>
      </div>` : `
      <div class="totals-section">
        <div class="totals-section-head">🚚 کۆیەکان — باری یەکەم <span class="totals-count">${UI.fmtNum(firstRows.length)} گەشت</span></div>
        <div class="totals-grid">${totalsCardsHtml(firstRows, computeTotals(firstRows))}</div>
      </div>`;

    resultsEl.innerHTML = `
      ${totalsHtml}

      <div class="card table-card">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>${thHtml}</tr>
            </thead>
            <tbody>
              ${!rows.length ? `<tr><td colspan="${colCount}" style="text-align:center;padding:30px;color:var(--muted)">هیچ تۆمارێک بەردەست نییە.</td></tr>` :
                rows.map(r => `<tr class="clickable-row" data-id="${r.id}">${rowCells(r)}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    // ڕیزکردن بە داگرتن لەسەر ناوی ستوونەکان
    resultsEl.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.recSort.key === key) {
          state.recSort.dir = state.recSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          state.recSort = { key, dir: 'asc' };
        }
        renderRecordsResults(wrap);
      });
    });

    resultsEl.querySelectorAll('tbody tr.clickable-row').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        if (Store.getSettings().rowClickFullscreen !== false) {
          const id = Number(row.dataset.id);
          const r = state.records.find(x => x.id === id);
          if (r) UI.openRecordFullscreen(r, {
            onEdit: rec => DriverView.openEditDataModal(rec, {
              onSave: () => loadData({ silent: true })
            }),
            onDelete: rec => deleteRecord(rec)
          });
        }
      });
    });
  }

  // هەمان دوگمەی ⊞ ی فۆڕمی دەستکاری داتا — زیادکردنی خانەی دووەم
  const setupSecondFieldToggle = (root, btnId, wrapId, inputId) => {
    const btn = root.querySelector(btnId);
    const wrap = root.querySelector(wrapId);
    const inp = root.querySelector(inputId);
    if (!btn || !wrap) return;
    btn.addEventListener('click', () => {
      const isHidden = wrap.style.display === 'none';
      wrap.style.display = isHidden ? '' : 'none';
      btn.classList.toggle('active', isHidden);
      btn.textContent = isHidden ? '✕' : '⊞';
      if (isHidden && inp) inp.focus();
      else if (!isHidden && inp) inp.value = '';
    });
  };

  async function openRecordModal(rec = null) {
    const isEdit = !!rec;
    // ستوونی average_time — کۆگای کاتی کارکردن؛ خانەی دەستی تەنها کاتێک پیشان دەدرێت
    // کە ستوونەکە لە داتابەیسەکەدا بێت (ئەگینا پاشەکەوتکردن بە PGRST204 شکست دەهێنێت)
    const supportsWorkTime = await API.Records.hasColumn('average_time').catch(() => false);
    const distributors = state.users.filter(u => u.profession === CONFIG.PROFESSION_DISTRIBUTOR).map(u => ({ label: u.username }));
    const delegates = state.users.filter(u => u.profession === CONFIG.PROFESSION_DELEGATE).map(u => ({ label: u.username }));
    const drivers = state.users.filter(u => u.profession === CONFIG.PROFESSION_DRIVER).map(u => ({ label: u.username }));
    const zones = state.zones.map(z => ({ label: z.name }));

    // جیاکردنەوەی بەهای «X و Y» — هەمان شێوازی فۆڕمی دەستکاری داتا
    const splitCombined = value => {
      const parts = String(value || '').split(/\s+و\s+/).filter(Boolean);
      if (parts.length <= 1) return { first: value || '', second: '' };
      return { first: parts[0], second: parts.slice(1).join(' و ') };
    };
    const distParts = splitCombined(rec?.distributor);
    const delParts  = splitCombined(rec?.delegate);
    const zoneParts = splitCombined(rec?.zone);
    const secAttrs = p => p.second ? '' : 'style="display:none"';

    const body = document.createElement('div');
    body.innerHTML = `
      <form id="adm-rec-form" novalidate>
        <div class="field"><label>بەروار *</label><input type="date" id="m-rec-date" value="${rec ? rec.record_date || UI.todayStr() : UI.todayStr()}"></div>

        <div class="field"><label>ناوی شۆفێر *</label><input type="text" id="m-rec-drv" placeholder="هەڵبژێرە یان بنووسە" value="${rec ? UI.esc(rec.driver || '') : ''}"></div>

        <div class="field">
          <div class="field-label-row">
            <label>ناوی دابەشکار *</label>
            <button type="button" class="btn-field-add ${distParts.second ? 'active' : ''}" id="btn-toggle-dist2" title="زیادکردنی دابەشکاری دووەم">${distParts.second ? '✕' : '⊞'}</button>
          </div>
          <input id="m-rec-dist" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(distParts.first)}">
        </div>
        <div class="field field-second" id="wrap-dist2" ${secAttrs(distParts)}>
          <label>دابەشکاری دووەم</label>
          <input id="m-rec-dist-2" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(distParts.second)}">
        </div>

        <div class="field">
          <div class="field-label-row">
            <label>ناوی مەندوب *</label>
            <button type="button" class="btn-field-add ${delParts.second ? 'active' : ''}" id="btn-toggle-del2" title="زیادکردنی مەندوبی دووەم">${delParts.second ? '✕' : '⊞'}</button>
          </div>
          <input id="m-rec-del" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(delParts.first)}">
        </div>
        <div class="field field-second" id="wrap-del2" ${secAttrs(delParts)}>
          <label>مەندوبی دووەم</label>
          <input id="m-rec-del-2" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(delParts.second)}">
        </div>

        <div class="field">
          <div class="field-label-row">
            <label>ناوچە / زۆن *</label>
            <button type="button" class="btn-field-add ${zoneParts.second ? 'active' : ''}" id="btn-toggle-zone2" title="زیادکردنی زۆنی دووەم">${zoneParts.second ? '✕' : '⊞'}</button>
          </div>
          <input id="m-rec-zn" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(zoneParts.first)}">
        </div>
        <div class="field field-second" id="wrap-zone2" ${secAttrs(zoneParts)}>
          <label>ناوچە / زۆنی دووەم</label>
          <input id="m-rec-zn-2" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(zoneParts.second)}">
        </div>

        <div class="field-row">
          <div class="field"><label>ژمارەی سەیارە *</label><input id="m-rec-veh" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${rec ? UI.esc(rec.vehicle || '') : ''}"></div>
          <div class="field"><label>کاتی دەرچوون *</label><input id="m-rec-trec" type="time" value="${rec ? rec.record_time || '' : UI.nowTime()}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>کێشی بار (کگم) *</label><input id="m-rec-wt" type="number" min="0" step="1" value="${rec ? UI.cleanInt(rec.cargo_weight) : ''}" placeholder="0"></div>
          <div class="field"><label>ژمارەی پارچەکان *</label><input id="m-rec-pcs" type="number" min="0" step="1" value="${rec ? UI.cleanInt(rec.pieces_count) : ''}" placeholder="0"></div>
        </div>
        <div class="field"><label>ژمارەی وەسڵ *</label><input id="m-rec-rcp" type="number" min="0" step="1" value="${rec ? UI.cleanInt(rec.receipt_number) : ''}" placeholder="0"></div>
        <div class="field"><label>💰 پارەی هێنراوە (د.ع)</label><input id="m-rec-mny" type="number" min="0" step="1" inputmode="numeric" value="${rec && Number(rec.collected_money || 0) > 0 ? UI.cleanInt(rec.collected_money) : ''}" placeholder="بەتاڵ = تۆمار نەکراوە"></div>

        <div class="date-range-compact" style="margin-top:10px">
          <div class="field compact-field"><label>📍 کاتی ناو زۆن</label><input type="time" id="m-rec-tin" value="${rec ? rec.in_zone_time || '' : ''}"></div>
          <div class="field compact-field"><label>🚏 کاتی دەرێی زۆن</label><input type="time" id="m-rec-tout" value="${rec ? rec.out_zone_time || '' : ''}"></div>
        </div>
        <div class="date-range-compact">
          <div class="field compact-field"><label>🏁 کاتی گەشتنەوە</label><input type="time" id="m-rec-tarr" value="${rec ? rec.arrival_time || '' : ''}"></div>
          <div class="field compact-field"></div>
        </div>
        ${supportsWorkTime ? `
        <div class="field compact-field">
          <label>⏱️ کاتی کارکردن (ئارەزوومەندانە — بۆ ڕۆژانی داهاتوو)</label>
          <input type="text" id="m-rec-wtime" placeholder="کاتژمێر:خولەک — بۆ نموونە 8:30" value="${rec ? UI.esc(rec.average_time || '') : ''}">
          <p class="hint" style="margin:4px 0 0">ئەگەر بۆ ڕۆژی داهاتوو کاتی کارکردن دابنێیت، پێویست ناکات کاتی گەشتنەوە تۆمار بکەیت — لە ستوونی «کاتی کارکردن»ی خشتەکەدا دەردەکەوێت. ئەگەر کاتی گەشتنەوە هەبێت، لە خۆی حیساب دەکرێت (گەشتنەوە − کاتی دەستپێک).</p>
        </div>` : ''}
      </form>`;

    UI.autocomplete($('#m-rec-drv', body), () => drivers);
    UI.autocomplete($('#m-rec-dist', body), () => distributors);
    UI.autocomplete($('#m-rec-dist-2', body), () => distributors);
    UI.autocomplete($('#m-rec-del', body), () => delegates);
    UI.autocomplete($('#m-rec-del-2', body), () => delegates);
    UI.autocomplete($('#m-rec-zn', body), () => zones);
    UI.autocomplete($('#m-rec-zn-2', body), () => zones);

    Store.loadLists().then(ls => {
      const vList = (ls?.vehicles || []).map(v => {
        const val = v.vehicle_number || v.plate_number || v.number || v.name || v.vehicle || v.plate || Object.values(v)[1] || Object.values(v)[0];
        return { label: String(val).trim() };
      }).filter(v => v.label && v.label !== '[object Object]');
      UI.autocomplete($('#m-rec-veh', body), () => vList);
    }).catch(() => {});

    setupSecondFieldToggle(body, '#btn-toggle-dist2', '#wrap-dist2', '#m-rec-dist-2');
    setupSecondFieldToggle(body, '#btn-toggle-del2', '#wrap-del2', '#m-rec-del-2');
    setupSecondFieldToggle(body, '#btn-toggle-zone2', '#wrap-zone2', '#m-rec-zn-2');

    const { close } = UI.openModal({
      title: isEdit ? '✏️ دەستکاریکردنی تۆماری گەیاندن' : '➕ زیادکردنی باری نوێ',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: isEdit ? 'پاشەکەوتکردن' : 'تۆمارکردن',
          className: 'btn-primary',
          onClick: async (backdrop) => {
            const subBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const val = id => $(id, body).value.trim();

            // پێکەوەنانەوەی دووەمەکان بە «و» — هەمان شێوازی فۆڕمی دەستکاری داتا
            const joinSecond = (first, second) => second ? `${first} و ${second}` : first;
            const dist1 = val('#m-rec-dist');
            const del1  = val('#m-rec-del');
            const z1    = val('#m-rec-zn');

            const data = {
              record_date: val('#m-rec-date') || UI.todayStr(),
              driver: val('#m-rec-drv'),
              distributor: joinSecond(dist1, val('#m-rec-dist-2')),
              delegate: joinSecond(del1, val('#m-rec-del-2')),
              zone: joinSecond(z1, val('#m-rec-zn-2')),
              vehicle: val('#m-rec-veh'),
              cargo_weight: UI.cleanInt(val('#m-rec-wt')),
              pieces_count: UI.cleanInt(val('#m-rec-pcs')),
              receipt_number: UI.cleanInt(val('#m-rec-rcp')),
              record_time: val('#m-rec-trec') || null,
              in_zone_time: val('#m-rec-tin') || null,
              out_zone_time: val('#m-rec-tout') || null,
              arrival_time: val('#m-rec-tarr') || null,
              collected_money: UI.cleanInt(val('#m-rec-mny')),
            };

            // کاتی کارکردن — کۆگا دەکرێت لە average_time
            if (supportsWorkTime) {
              const wtimeRaw = val('#m-rec-wtime');
              if (wtimeRaw) {
                if (UI.parseDurationMin(wtimeRaw) === null) {
                  UI.toast('کاتی کارکردن دەبێت بە شێوەی «کاتژمێر:خولەک» بێت — بۆ نموونە 8:30', 'warning', 4500);
                  return;
                }
                // نرخی دەستی — بۆ ڕۆژانی داهاتوو بێ گەشتنەوە
                data.average_time = data.arrival_time ? null : wtimeRaw;
              }
              if (data.arrival_time) {
                // لە گەشتنەوەوە حیساب دەکرێت: گەشتنەوە − کاتی دەستپێک (یان کاتی دەرچوون)
                const start = Store.getBaseTime() || data.record_time;
                data.average_time = UI.durationToHMM(UI.durationMinutes(start, data.arrival_time));
              }
            }

            const invalid = [];
            if (!data.driver) invalid.push('#m-rec-drv');
            if (!dist1) invalid.push('#m-rec-dist');
            if (!del1) invalid.push('#m-rec-del');
            if (!z1) invalid.push('#m-rec-zn');
            if (!data.vehicle) invalid.push('#m-rec-veh');
            if (invalid.length) {
              invalid.forEach(id => $(id, body)?.classList.add('invalid'));
              UI.toast('تکایە هەموو خانە سەرەکییەکان پڕ بکەرەوە', 'warning');
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

    const totals = rows.reduce((a, r) => {
      const d = UI.recordDurationMinutes(r);
      return {
        weight: a.weight + Number(r.cargo_weight || 0),
        pieces: a.pieces + Number(r.pieces_count || 0),
        receipts: a.receipts + Number(r.receipt_number || 0),
        money: a.money + Number(r.collected_money || 0),
        workMins: a.workMins + (d === null ? 0 : d),
      };
    }, { weight: 0, pieces: 0, receipts: 0, money: 0, workMins: 0 });

    const dateRangeText = (state.from && state.to)
      ? `لە ${state.from} بۆ ${state.to}`
      : (state.from ? `لە ${state.from} بەرەو سەرەوە` : (state.to ? `تا بەرواری ${state.to}` : 'تەواوی بەروارەکان'));

    const selUser = selectedUserObj();
    const userFilterText = selUser ? selUser.username : 'هەموو بەکارهێنەران';
    const searchText = state.recordSearch ? state.recordSearch : '—';
    const printTime = `${UI.todayStr()} • ${UI.nowTime()}`;

    const s = Store.getSettings();
    const scale = v => Math.min(1.5, Math.max(0.8, Number(v) || 1));
    const fontScale = scale(s.fontScale);
    const recScale = scale(s.recordsFontScale);
    const totScale = scale(s.totalsFontScale);
    const fam = ['Vazirmatn', 'Tahoma', 'Segoe UI', 'Arial', 'sans-serif'].includes(s.fontFamily) ? s.fontFamily : 'Vazirmatn';

    // دەقەکانی پرێنت — لە ڕێکخستنەکانەوە دەگۆڕدرێن/دەشاردرێنەوە (کارتی 🖨️ ناوەڕۆکی پرێنتکردن)
    const pd = Store.PRINT_DEFAULTS;
    const pTitle = String(s.printTitle ?? '').trim() || pd.printTitle;
    const pSub = String(s.printSub ?? '').trim() || pd.printSub;
    const pFootR = String(s.printFooterRight ?? '').trim() || pd.printFooterRight;
    const pFootL = String(s.printFooterLeft ?? '').trim() || pd.printFooterLeft;
    const showTitle = s.printShowTitle !== false;
    const showSub = s.printShowSub !== false;
    const showMeta = s.printShowMeta !== false;
    const showFooter = s.printShowFooter !== false;
    const showPrintNote = s.printShowPrintNote !== false;

    const html = `
      <!DOCTYPE html>
      <html lang="ckb" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${UI.esc(pTitle)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: landscape; margin: 10mm 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --font: '${fam}', 'Segoe UI', Tahoma, sans-serif;
            --sys-fs: ${fontScale};
            --rec-fs: ${recScale};
            --tot-fs: ${totScale};
          }
          body {
            font-family: var(--font);
            direction: rtl;
            color: #111;
            background: #fff;
            padding: 12px;
            font-size: calc(9.5pt * var(--sys-fs));
            line-height: 1.5;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .print-title { font-size: calc(16pt * var(--sys-fs)); font-weight: 800; }
          .print-sub { font-size: calc(9pt * var(--sys-fs)); color: #444; }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            background: #f4f6f8;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 12px;
            font-size: calc(8.5pt * var(--sys-fs));
          }
          .meta-item strong { color: #000; }
          .totals-bar {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
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
          .total-box .val { font-size: calc(11.5pt * var(--tot-fs) * var(--sys-fs)); font-weight: 800; color: #000; direction: ltr; }
          .total-box .val.val-duration { font-size: calc(9.5pt * var(--tot-fs) * var(--sys-fs)); }
          .total-box .lbl { font-size: calc(7.5pt * var(--tot-fs) * var(--sys-fs)); color: #555; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: calc(8.5pt * var(--rec-fs) * var(--sys-fs));
          }
          th, td {
            border: 1px solid #999;
            padding: calc(5px * var(--rec-fs)) calc(6px * var(--rec-fs));
            text-align: right;
            font-size: calc(8.5pt * var(--rec-fs) * var(--sys-fs));
          }
          th {
            background: #e9ecef;
            font-weight: 800;
            color: #000;
          }
          tr:nth-child(even) td { background: #fbfbfb; }
          .money { font-weight: 700; direction: ltr; text-align: right; white-space: nowrap; }
          .nowrap { white-space: nowrap; }
          tfoot tr td {
            font-size: calc(8.5pt * var(--tot-fs) * var(--sys-fs));
            font-weight: 800;
          }
          .print-footer {
            margin-top: 14px;
            padding-top: 6px;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            font-size: calc(8pt * var(--sys-fs));
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            ${showTitle ? `<h1 class="print-title">${UI.esc(pTitle)}</h1>` : ''}
            ${showSub ? `<div class="print-sub">${UI.esc(pSub)}</div>` : ''}
          </div>
          <div style="text-align:left">
            <div style="font-weight:700">بەرواری چاپ: ${printTime}</div>
            ${showPrintNote ? `<div style="font-size:calc(8pt * var(--sys-fs));color:#555">چاپکراوە لە پانێلی بەڕێوبەر</div>` : ''}
          </div>
        </div>

        ${showMeta ? `<div class="meta-grid">
          <div class="meta-item"><span>مەودای بەروار:</span> <strong>${dateRangeText}</strong></div>
          <div class="meta-item"><span>بەکارهێنەر:</span> <strong>${userFilterText}</strong></div>
          <div class="meta-item"><span>گەڕان بەدوای:</span> <strong>${searchText}</strong></div>
          <div class="meta-item"><span>کۆی تۆمارەکان:</span> <strong>${rows.length} گەشت</strong></div>
        </div>` : ''}

        <div class="totals-bar">
          <div class="total-box"><div class="val">${UI.fmtNum(rows.length)}</div><div class="lbl">کۆی گەشتەکان</div></div>
          <div class="total-box"><div class="val">${UI.fmtNum(totals.weight)}</div><div class="lbl">کۆی کێش (کگم)</div></div>
          <div class="total-box"><div class="val">${UI.fmtNum(totals.pieces)}</div><div class="lbl">کۆی پارچە</div></div>
          <div class="total-box"><div class="val">${UI.fmtNum(totals.receipts)}</div><div class="lbl">کۆی وەسڵ</div></div>
          <div class="total-box"><div class="val">${UI.fmtMoney(totals.money)}</div><div class="lbl">کۆی پارەی هێنراوە</div></div>
          <div class="total-box"><div class="val val-duration">${UI.fmtDuration(totals.workMins || null)}</div><div class="lbl">کۆی کاتی کارکردن</div></div>
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
              <th>کاتی کارکردن</th>
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
                <td class="nowrap" style="white-space:nowrap">${UI.workTimeDisplay(r)}</td>
                <td class="money">${UI.fmtMoney(r.collected_money)}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#eaeaea;font-weight:800">
              <td colspan="7" style="text-align:center">کۆی گشتی</td>
              <td>${UI.fmtNum(totals.weight)}</td>
              <td>${UI.fmtNum(totals.pieces)}</td>
              <td>${UI.fmtNum(totals.receipts)}</td>
              <td colspan="5"></td>
              <td class="money">${UI.fmtMoney(totals.money)}</td>
            </tr>
          </tfoot>
        </table>

        ${showFooter ? `<div class="print-footer">
          <span>${UI.esc(pFootR)}</span>
          <span>${UI.esc(pFootL)}</span>
        </div>` : ''}
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

  /* ---------------- پڕکردنەوەی ئایدی تۆمارە کۆنەکان (backfill) ---------------- */

  async function runUserIdBackfill() {
    // پشکنینی ستوونەکان — ئەگەر نەبن، ڕێنمایی زیادکردنیان دەدرێت
    const hasIds = await API.Records.hasUserIds().catch(() => false);
    if (!hasIds) {
      UI.openModal({
        title: '⚠️ ستوونەکانی ئایدی نییە',
        body: `<p class="confirm-msg">ستوونەکانی <b>driver_id</b>، <b>distributor_id</b> و <b>delegate_id</b> لە خشتەی <b>delivery_records</b> دا زیاد نەکراون.<br><br>تکایە لە داتابەیسی Supabase ئەم ستوونانە وەک <b>text</b> زیاد بکە پاشان ئەم دوگمەیە دووبارە بەکاربهێنە:</p>
        <pre style="background:var(--bg-2,#f5f5f5);padding:10px;border-radius:8px;direction:ltr;text-align:left;font-size:0.78rem">alter table delivery_records
  add column driver_id text,
  add column distributor_id text,
  add column delegate_id text;</pre>`,
        actions: [{ label: 'باشە', className: 'btn-primary', onClick: b => b.classList.remove('open') || setTimeout(() => b.remove(), 220) }],
      });
      return;
    }

    const ok = await UI.confirmDialog('ئەم کردارە ئایدی بەکارهێنەرانی usersv2 بۆ هەموو تۆمارە کۆنەکان پڕ دەکاتەوە (تۆمارە نوێیەکان پێشتر ئایدییان لەگەڵدایە). بەردەوام دەبیت؟', {
      okLabel: 'بەڵێ، پڕی بکەرەوە', cancelLabel: 'پاشگەزبوونەوە'
    });
    if (!ok) return;

    let progressModal = null;
    const onProgress = (done, updated) => {
      const el = document.getElementById('backfill-progress-txt');
      if (el) el.textContent = `${done} تۆمار پشکنرا — ${updated} نوێکرانەوە...`;
    };

    try {
      progressModal = UI.openModal({
        title: '🔗 پڕکردنەوەی ئایدیەکان',
        body: `<p class="confirm-msg" id="backfill-progress-txt">دەستپێدەکات...</p>`,
        actions: [],
      });
      const res = await API.Records.backfillUserIds({ onProgress });
      progressModal.backdrop.classList.remove('open');
      setTimeout(() => progressModal.backdrop.remove(), 220);
      UI.toast(`تەواو بوو ✓ — ${res.updated} تۆمار ئایدییان پێدرا${res.failed ? ` (${res.failed} شکستی هێنا)` : ''}`, res.failed ? 'warning' : 'success', 5000);
      await loadData({ silent: true });
    } catch (err) {
      if (progressModal) {
        progressModal.backdrop.classList.remove('open');
        setTimeout(() => progressModal.backdrop.remove(), 220);
      }
      UI.toast('هەڵە لە پڕکردنەوەی ئایدیەکان: ' + err.message, 'error', 6000);
    }
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
        userCounts[u.username] = state.records.filter(r => userMatchesRecord(u, r)).length;
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
                  const uRecs = exportRecords.filter(r => userMatchesRecord(u, r));
                  const uWeight = uRecs.reduce((s, r) => s + UI.cleanInt(r.cargo_weight), 0);
                  const uPieces = uRecs.reduce((s, r) => s + UI.cleanInt(r.pieces_count), 0);
                  const uReceipts = uRecs.reduce((s, r) => s + UI.cleanInt(r.receipt_number), 0);
                  const uMoney = uRecs.reduce((s, r) => s + UI.cleanInt(r.collected_money), 0);

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
                const uRecs = exportRecords.filter(r => userMatchesRecord(u, r));
                const totalWeight = uRecs.reduce((s, r) => s + UI.cleanInt(r.cargo_weight), 0);
                const totalPieces = uRecs.reduce((s, r) => s + UI.cleanInt(r.pieces_count), 0);
                const totalReceipts = uRecs.reduce((s, r) => s + UI.cleanInt(r.receipt_number), 0);
                const totalMoney = uRecs.reduce((s, r) => s + UI.cleanInt(r.collected_money), 0);

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
                    'کاتی کارکردن',
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
                      UI.cleanInt(r.cargo_weight),
                      UI.cleanInt(r.pieces_count),
                      UI.cleanInt(r.receipt_number),
                      r.record_time || '',
                      r.in_zone_time || '',
                      r.out_zone_time || '',
                      r.arrival_time || '',
                      UI.workTimeDisplay(r),
                      UI.cleanInt(r.collected_money)
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
                    UI.fmtDuration(uRecs.reduce((s, r) => {
                      const d = UI.recordDurationMinutes(r);
                      return s + (d === null ? 0 : d);
                    }, 0) || null),
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
                  { wch: 14 },
                  { wch: 20 }
                ];
                ws['!merges'] = [
                  { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
                  { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } },
                  { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
                  { s: { r: 3, c: 0 }, e: { r: 3, c: 15 } }
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
    // هەموو پیشەکان — بنەڕەتی + ئەوانەی لە فۆڕمی پیشە زیادکراون
    const professions = [
      ...new Set([
        CONFIG.PROFESSION_DRIVER,
        CONFIG.PROFESSION_DISTRIBUTOR,
        CONFIG.PROFESSION_DELEGATE,
        CONFIG.PROFESSION_SUPERVISOR,
        CONFIG.PROFESSION_ASSISTANT,
        'بەڕێوبەر',
        ...Perms.allProfessions(state.users || []),
      ]),
    ];

    wrap.innerHTML = `
      <section class="card filter-card">
        <div class="admin-header-row" style="margin-bottom:6px">
          <h3 style="font-size:0.96rem"><span class="sec-icon">${UI.icon('users')}</span> بەڕێوەبردنی بەکارهێنەران (خشتەی usersv2)</h3>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn btn-ghost btn-sm" id="adm-toggle-pass">👁️ پشاندانی هەموو پاسۆڕدەکان</button>
            <button type="button" class="btn btn-primary btn-sm" id="admin-add-user-btn">➕ بەکارهێنەری نوێ</button>
          </div>
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

      <div class="user-cards-grid" id="adm-user-cards-grid"></div>`;

    function updateUserCardsGrid() {
      const grid = $('#adm-user-cards-grid', wrap);
      if (!grid) return;
      grid.classList.toggle('show-all-pass', state.showAllPass);
      const rows = filteredUsers();
      grid.innerHTML = !rows.length ? `<div class="empty-state" style="grid-column:1/-1"><p>هیچ بەکارهێنەرێک نەدۆزرایەوە.</p></div>` :
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
              <span class="pin-code" title="بۆ پشاندان ماوس بهێنە سەر کارتەکە"><span class="pin-masked">••••</span><span class="pin-real">${UI.esc(u.password || '—')}</span></span>
            </div>
            ${(String(u.phone_number_1 || '').trim() || String(u.phone_number_2 || '').trim()) ? `
            <div class="user-card-meta">
              <span>تەلەفۆن:</span>
              <span dir="ltr">${UI.esc([u.phone_number_1, u.phone_number_2].map(p => String(p || '').trim()).filter(Boolean).join(' • '))}</span>
            </div>` : ''}
            ${String(u.location || '').trim() ? `
            <div class="user-card-meta">
              <span>شوێن:</span>
              <span>${UI.esc(u.location)}</span>
            </div>` : ''}
            <div class="user-card-actions">
              <button type="button" class="btn btn-ghost btn-sm adm-usr-view" data-user-id="${UI.esc(String(u.id))}" title="بینینی کارەکان">📋 کارەکانی</button>
              <button type="button" class="btn btn-ghost btn-sm adm-usr-edit" data-id="${u.id}">✏️ دەستکاری</button>
              <button type="button" class="btn btn-danger btn-sm adm-usr-del" data-id="${u.id}">🗑️</button>
            </div>
          </div>`).join('');

      // بینینی کارەکانی بەکارهێنەر ڕاستەوخۆ — بە ئایدی یوسەر
      grid.querySelectorAll('.adm-usr-view').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.userId;
          state.subtab = 'records';
          state.selectedUser = id;
          state.from = '';
          state.to = '';
          container.querySelectorAll('.admin-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.sub === 'records'));
          loadData();
        });
      });

      grid.querySelectorAll('.adm-usr-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const u = state.users.find(x => x.id === id);
          if (u) openUserModal(u, updateUserCardsGrid);
        });
      });

      grid.querySelectorAll('.adm-usr-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const u = state.users.find(x => x.id === id);
          if (u) deleteUser(u, updateUserCardsGrid);
        });
      });
    }

    // پشاندان/شاردنەوەی هەموو تێپەڕەوشەکان
    $('#adm-toggle-pass', wrap).addEventListener('click', () => {
      state.showAllPass = !state.showAllPass;
      const btn = $('#adm-toggle-pass', wrap);
      btn.textContent = state.showAllPass ? '🙈 شاردنەوەی هەموو پاسۆڕدەکان' : '👁️ پشاندانی هەموو پاسۆڕدەکان';
      const grid = $('#adm-user-cards-grid', wrap);
      if (grid) grid.classList.toggle('show-all-pass', state.showAllPass);
    });

    $('#adm-user-prof', wrap).addEventListener('change', e => {
      state.userProfFilter = e.target.value;
      updateUserCardsGrid();
    });
    $('#adm-user-search', wrap).addEventListener('input', e => {
      state.userSearch = e.target.value;
      updateUserCardsGrid();
    });
    $('#admin-add-user-btn', wrap).addEventListener('click', () => openUserModal(null, updateUserCardsGrid));

    updateUserCardsGrid();
  }

  function openUserModal(user = null, onSaved = null) {
    const isEdit = !!user;
    let newAvatar; // undefined = نەگۆڕاو، null = سڕدراوە، string = وێنەی نوێ (dataURL)
    const body = document.createElement('div');
    body.innerHTML = `
      <form id="adm-user-form" autocomplete="off" novalidate>
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
            <option value="${CONFIG.PROFESSION_ASSISTANT}" ${user?.profession === CONFIG.PROFESSION_ASSISTANT ? 'selected' : ''}>${CONFIG.PROFESSION_ASSISTANT}</option>
            <option value="${CONFIG.PROFESSION_SUPERVISOR}" ${user?.profession === CONFIG.PROFESSION_SUPERVISOR || user?.profession === 'بەڕێوبەر' ? 'selected' : ''}>بەڕێوبەر</option>
            ${Perms.allProfessions(state.users || []).filter(p => ![CONFIG.PROFESSION_DRIVER, CONFIG.PROFESSION_DISTRIBUTOR, CONFIG.PROFESSION_DELEGATE, CONFIG.PROFESSION_SUPERVISOR, CONFIG.PROFESSION_ASSISTANT, 'بەڕێوبەر', 'بەریوبەر'].includes(p)).map(p => `
              <option value="${UI.esc(p)}" ${user?.profession === p ? 'selected' : ''}>${UI.esc(p)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>تێپەڕەوشە (٤ ژمارە) *</label>
          <input type="text" id="mu-pass" inputmode="numeric" maxlength="4" value="${user ? UI.esc(user.password || '') : ''}" placeholder="1234" class="pin-input">
        </div>
        <div class="field-row">
          <div class="field"><label>📞 ژمارەی تەلەفۆن ١</label><input type="tel" id="mu-phone1" dir="ltr" placeholder="07XX XXX XXXX" value="${user ? UI.esc(user.phone_number_1 || '') : ''}"></div>
          <div class="field"><label>📞 ژمارەی تەلەفۆن ٢</label><input type="tel" id="mu-phone2" dir="ltr" placeholder="07XX XXX XXXX" value="${user ? UI.esc(user.phone_number_2 || '') : ''}"></div>
        </div>
        <div class="field"><label>📍 شوێن (لۆکەیشن)</label><input type="text" id="mu-location" placeholder="شوێنی بەکارهێنەر" value="${user ? UI.esc(user.location || '') : ''}"></div>
        <div class="field">
          <label>📷 وێنەی پڕۆفایل</label>
          <div class="mu-avatar-row">
            <div id="mu-avatar-preview"></div>
            <div class="mu-avatar-actions">
              <button type="button" class="btn btn-ghost btn-sm" id="mu-avatar-btn">🖼 هەڵبژاردنی وێنە</button>
              <button type="button" class="btn btn-ghost btn-sm" id="mu-avatar-clear">🗑 لابردنی وێنە</button>
            </div>
          </div>
          <input type="file" id="mu-avatar-file" accept="image/*" hidden>
        </div>
      </form>`;

    const renderPreview = () => {
      const box = $('#mu-avatar-preview', body);
      if (!box) return;
      const cur = newAvatar !== undefined
        ? (newAvatar ? { username: user?.username || '', avatar_url: newAvatar } : null)
        : (user?.avatar_url ? { username: user.username, avatar_url: user.avatar_url } : null);
      box.innerHTML = cur
        ? `<img class="avatar" src="${UI.esc(cur.avatar_url)}" alt="" style="width:64px;height:64px">`
        : `<div class="avatar avatar-fallback" style="width:64px;height:64px;font-size:26px">${UI.esc((user?.username || '؟').trim().charAt(0))}</div>`;
    };
    renderPreview();

    $('#mu-pass', body).addEventListener('input', e => {
      e.target.value = UI.toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4);
    });

    $('#mu-avatar-btn', body).addEventListener('click', () => $('#mu-avatar-file', body).click());
    $('#mu-avatar-file', body).addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      UI.avatarEditor(file, {
        onSave: async dataUrl => {
          newAvatar = dataUrl;
          renderPreview();
          UI.toast('وێنەکە ئامادەیە — بۆ پاشەکەوتکردن «پاشەکەوتکردن» دابگرە', 'info', 4000);
        },
      });
    });
    $('#mu-avatar-clear', body).addEventListener('click', () => {
      newAvatar = null;
      renderPreview();
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
            const phone1 = $('#mu-phone1', body).value.trim();
            const phone2 = $('#mu-phone2', body).value.trim();
            const location = $('#mu-location', body).value.trim();

            if (!username) { UI.toast('تکایە ناوی بەکارهێنەر بنووسە', 'warning'); return; }
            if (!/^\d{4}$/.test(password)) { UI.toast('تێپەڕەوشە دەبێت ٤ ژمارە بێت', 'warning'); return; }
            const phoneOk = p => !p || /^[+\d][\d\s\-()]{5,19}$/.test(UI.toLatinDigits(p));
            if (!phoneOk(phone1) || !phoneOk(phone2)) { UI.toast('ژمارەی تەلەفۆن دروست نییە — تەنها ژمارە و (+) و بۆشایی ڕێپێدراوە', 'warning', 4500); return; }

            // پشکنینی ناوی دووبارە لە لیستی بەکارهێنەران
            const exists = state.users.some(u => UI.norm(u.username) === UI.norm(username) && (!isEdit || u.id !== user.id));
            if (exists) {
              UI.toast('ئەم ناوی بەکارهێنەرە پێشتر تۆمارکراوە! تکایە ناوێکی جیاواز بنووسە.', 'warning', 4500);
              return;
            }

            UI.btnLoading(subBtn, true, 'پاشەکەوت دەکرێت...');
            try {
              if (isEdit) {
                const patch = {
                  username, profession, password,
                  phone_number_1: phone1 || null,
                  phone_number_2: phone2 || null,
                  location: location || null,
                };
                if (newAvatar !== undefined) patch.avatar_url = newAvatar;
                await API.Lists.updateUser(user.id, patch);
                const idx = state.users.findIndex(x => x.id === user.id);
                if (idx !== -1) state.users[idx] = { ...state.users[idx], ...patch };
                UI.toast('بەکارهێنەر نوێ کرایەوە ✓', 'success');
              } else {
                const row = {
                  username, profession, password,
                  phone_number_1: phone1 || null,
                  phone_number_2: phone2 || null,
                  location: location || null,
                };
                if (newAvatar) row.avatar_url = newAvatar;
                const inserted = await API.Lists.insertUser(row);
                state.users.unshift(inserted || { id: Date.now(), ...row });
                UI.toast('بەکارهێنەری نوێ زیادکرا ✓', 'success');
              }
              close();
              if (onSaved) onSaved();
              await loadData({ silent: true });
            } catch (err) {
              UI.toast('هەڵە لە پاشەکەوتکردن: ' + err.message, 'error', 4500);
            } finally {
              UI.btnLoading(subBtn, false);
            }
          }
        }
      ]
    });
  }

  async function deleteUser(user, onDeleted = null) {
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
      state.users = state.users.filter(x => x.id !== user.id);
      if (onDeleted) onDeleted();
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
    wrap.innerHTML = `
      <section class="card filter-card">
        <div class="admin-header-row" style="margin-bottom:6px">
          <h3 style="font-size:0.96rem"><span class="sec-icon">${UI.icon('map')}</span> بەڕێوەبردنی زۆنەکان (خشتەی zonesv2)</h3>
          <button type="button" class="btn btn-primary btn-sm" id="admin-add-zone-btn">➕ زۆنی نوێ</button>
        </div>

        <div class="field">
          <label>گەڕان لە زۆنەکان</label>
          <input type="search" id="adm-zone-search" placeholder="ناوی زۆن بنووسە..." value="${UI.esc(state.zoneSearch)}">
        </div>
      </section>

      <div class="zone-cards-grid" id="adm-zone-cards-grid"></div>`;

    function updateZoneCardsGrid() {
      const grid = $('#adm-zone-cards-grid', wrap);
      if (!grid) return;
      const rows = filteredZones();
      grid.innerHTML = !rows.length ? `<div class="empty-state" style="grid-column:1/-1"><p>هیچ زۆنێک نەدۆزرایەوە.</p></div>` :
        rows.map(z => `
          <div class="zone-card">
            <span class="zone-name">🗺️ ${UI.esc(z.name)}</span>
            <div class="zone-actions">
              <button type="button" class="btn-action-sm btn-edit adm-zn-edit" data-id="${z.id}">✏️</button>
              <button type="button" class="btn-action-sm btn-del adm-zn-del" data-id="${z.id}">🗑️</button>
            </div>
          </div>`).join('');

      grid.querySelectorAll('.adm-zn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const z = state.zones.find(x => x.id === id);
          if (z) openZoneModal(z, updateZoneCardsGrid);
        });
      });

      grid.querySelectorAll('.adm-zn-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const z = state.zones.find(x => x.id === id);
          if (z) deleteZone(z, updateZoneCardsGrid);
        });
      });
    }

    $('#adm-zone-search', wrap).addEventListener('input', e => {
      state.zoneSearch = e.target.value;
      updateZoneCardsGrid();
    });
    $('#admin-add-zone-btn', wrap).addEventListener('click', () => openZoneModal(null, updateZoneCardsGrid));

    updateZoneCardsGrid();
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
