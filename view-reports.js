/* =========================================================
 *  ڕاپۆرت و ئامارەکان — فلتەری بەروار، کۆیەکان، نوێبوونەوەی خۆکار
 * ========================================================= */

const ReportsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  let refreshTimer = null;
  let state = {
    from: '',
    to: '',
    search: '',
    driverFilter: '',
    dayFilter: '', // فلتەری ڕۆژەکانی حەفتە
    monthFilter: '', // هەڵبژاردەی مانگ (1-12) — مەودای بەروار دەگۆڕێت
    distributorFilter: '', // فلتەری دابەشكار — بە ئایدی یوسەر
    delegateFilter: '', // فلتەری مەندوو — بە ئایدی یوسەر
    vehicleFilter: '', // فلتەری ژمارەی سەیارە
    rows: [],
    driverUsers: [], // لیستی شۆفێرەکان بۆ فلتەری شۆفێر (بە ئایدی)
    allUsers: [], // هەموو بەکارهێنەران بۆ ئاڤاتار
    lastUpdated: null,
    loading: false,
    sort: { key: 'record_date', dir: 'desc' }, // ڕیزکردنی خشتە بە داگرتن لەسەر سەرپەڕە
    initializedDates: false,
    secondOnly: false, // تەنها باری دووەم پیشان بدە (بۆ سایەق/دابەشکار)
    outZoneOnly: false, // تەنها تۆمارەکانی دەرێی زۆن (بۆ بەڕێوەبەر)
    arrivalOnly: false, // تەنها تۆمارەکانی گەشتنەوە (بۆ بەڕێوەبەر)
  };

  const isSupervisor = u => u && (u.profession === CONFIG.PROFESSION_SUPERVISOR || u.profession === 'بەڕێوبەر' || u.profession === 'بەریوبەر');

  // ڕۆژەکانی حەفتە بە ڕیزی کوردی (شەممە دەستپێکە) — ناوەکان هاوتای UI.weekdayKu
  const WEEKDAY_OPTIONS = ['شەممە', 'یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی'];

  // مەودای بەرواری مانگێک — سەرەتا و کۆتایی مانگەکە لە ساڵی ئێستا
  function monthRange(m) {
    const y = Number(String(UI.todayStr()).slice(0, 4));
    const mm = String(m).padStart(2, '0');
    const last = new Date(y, Number(m), 0).getDate();
    return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
  }

  // ئایا تۆمارەکە باری دووەم/سێیەمە؟ — بەپێی پاشگری ناوی شۆفێر («دوو»/«سێ»)
  const cargoIdxOf = r => {
    const d = String((r && r.driver) || '').replace(/\s*\+\s*$/, '').trim();
    if (/(?:^|\s)دوو$/.test(d)) return 1;
    if (/(?:^|\s)سێ$/.test(d)) return 2;
    return 0;
  };

  /* ---------------- فلتەری پێ بەپێی دەسەڵات ---------------- */

  function roleFilter(rows) {
    const u = App.getUser();
    // بینینی هەموو تۆمارەکان — بەپێی دەسەڵات (بنەڕەت: بەڕێوەبەر)
    if (Perms.canView(u, 'rep_view_all')) return rows;
    if (u.profession === CONFIG.PROFESSION_ASSISTANT) {
      const today = UI.todayStr();
      
      const supervisorNames = (state.driverUsers || [])
          .filter(x => x.profession === CONFIG.PROFESSION_SUPERVISOR || x.profession === 'بەڕێوبەر')
          .map(x => x.username);

      return rows.filter(r => {
        const isOwn = UI.recMatchesUser(r, 'driver', u) || UI.recMatchesUser(r, 'distributor', u) || UI.recMatchesUser(r, 'delegate', u);
        if (isOwn) return true;
        if (r.record_date === today) {
            // Exclude if driver is a supervisor
            const dName = String(r.driver || '').replace(/ (دوو|سێ)$/, '');
            if (supervisorNames.includes(dName)) return false;
            return true;
        }
        return false;
      });
    }
    if (u.profession === CONFIG.PROFESSION_DRIVER) {
      return rows.filter(r => UI.recMatchesUser(r, 'driver', u));
    }
    if (u.profession === CONFIG.PROFESSION_DISTRIBUTOR) {
      return rows.filter(r => UI.recMatchesUser(r, 'distributor', u));
    }
    if (u.profession === CONFIG.PROFESSION_DELEGATE) {
      return rows.filter(r => UI.recMatchesUser(r, 'delegate', u));
    }
    return rows;
  }

  /* هاوتاکردنی نەرم — بە ئایدی یان بە ناو: ئەگەر ئایدی تۆمارەکە کۆن/هەڵە بێت
   * (یوسەر سڕدراوەتەوە و دووبارە دروستکراوە)، ناوە هاوشێوەکە هێشتا دەستنیشان دەکات */
  const recMatchesUserSoft = (r, field, user) =>
    UI.recMatchesUser(r, field, user) || UI.userMatches(r[field], user.username);

  function visibleRows() {
    let rows = roleFilter(state.rows);
    if (state.driverFilter) {
      const du = (state.driverUsers || []).find(u => u.username === state.driverFilter);
      rows = rows.filter(r => du
        ? recMatchesUserSoft(r, 'driver', du)
        : String(r.driver || '').replace(/ (دوو|سێ)$/, '').trim() === state.driverFilter);
    }
    // فلتەری ڕۆژەکانی حەفتە — بەپێی ڕۆژی بەرواری تۆمارەکە
    if (state.dayFilter) {
      rows = rows.filter(r => r.record_date && UI.weekdayKu(new Date(r.record_date + 'T00:00:00')) === state.dayFilter);
    }
    // فلتەری دابەشكار — بە ئایدی یان ناوی یوسەر
    if (state.distributorFilter) {
      const du = (state.allUsers || []).find(u => String(u.id) === String(state.distributorFilter));
      if (du) rows = rows.filter(r => recMatchesUserSoft(r, 'distributor', du));
    }
    // فلتەری مەندوو — بە ئایدی یان ناوی یوسەر
    if (state.delegateFilter) {
      const du = (state.allUsers || []).find(u => String(u.id) === String(state.delegateFilter));
      if (du) rows = rows.filter(r => recMatchesUserSoft(r, 'delegate', du));
    }
    // فلتەری ژمارەی سەیارە
    if (state.vehicleFilter) {
      rows = rows.filter(r => String(r.vehicle || '').trim() === state.vehicleFilter);
    }
    if (state.search) {
      const q = UI.norm(state.search);
      rows = rows.filter(r =>
        [r.driver, r.distributor, r.delegate, r.zone, r.vehicle].some(v => UI.norm(v).includes(q)));
    }
    if (state.secondOnly) {
      rows = rows.filter(r => cargoIdxOf(r) >= 1);
    }
    // فلتەری دەرێی زۆن — تۆمارەکانی دەرێی زۆن کردووە بەبێ گەشتنەوە
    if (state.outZoneOnly) {
      rows = rows.filter(r => r.out_zone_time && !r.arrival_time);
    }
    // فلتەری گەشتنەوە — تۆمارەکانی گەشتنەوەیان ئەنجام داوە
    if (state.arrivalOnly) {
      rows = rows.filter(r => !!r.arrival_time);
    }
    // ڕیزکردن بەپێی ستوونی هەڵبژێردراو
    const s = state.sort || { key: 'record_date', dir: 'desc' };
    const dir = s.dir === 'asc' ? 1 : -1;
    const numKeys = ['cargo_weight', 'pieces_count', 'receipt_number', 'collected_money'];
    rows = [...rows].sort((a, b) => {
      if (numKeys.includes(s.key)) return (UI.cleanInt(a[s.key]) - UI.cleanInt(b[s.key])) * dir;
      const c = String(a[s.key] || '').localeCompare(String(b[s.key] || ''), 'ckb');
      if (c !== 0) return c * dir;
      return (Number(a.id || 0) - Number(b.id || 0)) * dir;
    });
    return rows;
  }

  // پاککردنەوەی هەڵبژاردەی مانگ — کاتێک بەروارەکان بە دەست دەگۆڕدرێن
  function clearMonthSel(root) {
    state.monthFilter = '';
    const ms = $('#rep-month-filter', root);
    if (ms) ms.value = '';
  }

  // پڕکردنەوەی لیستی ژمارەی سەیارەکان — لە لیستی سەیارەکان، ئەگینا لە تۆمارە بارکراوەکان
  function refreshVehicleOptions(ls) {
    if (!container || !Perms.canView(App.getUser(), 'rep_filter_driver')) return;
    const sel = $('#rep-veh-filter', container);
    if (!sel || sel.options.length > 1) return; // پێشتر پڕکراوەتەوە
    let list = [];
    const fromLs = (ls && ls.vehicles) || [];
    if (fromLs.length) {
      list = fromLs.map(v => {
        const val = v.vehicle_number || v.plate_number || v.number || v.name || v.vehicle || v.plate || '';
        return String(val).trim();
      }).filter(Boolean);
    } else {
      list = [...new Set((state.rows || []).map(r => String(r.vehicle || '').trim()).filter(Boolean))];
    }
    list = [...new Set(list)].sort((a, b) => a.localeCompare(b, 'ckb'));
    if (!list.length) return;
    const keep = state.vehicleFilter || '';
    sel.innerHTML = '<option value="">هەموو سەیارەکان</option>' +
      list.map(v => `<option value="${UI.esc(v)}"${v === keep ? ' selected' : ''}>${UI.esc(v)}</option>`).join('');
  }

  /* ---------------- بارکردنی داتا ---------------- */

  async function load({ silent = false } = {}) {
    const refBtn = $('#rep-refresh', container);
    if (!silent) {
      state.loading = true;
      $('#rep-totals', container)?.classList.add('loading');
      if (refBtn) UI.btnLoading(refBtn, true, ' ');
    }
    try {
      const params = { select: '*', order: 'record_date.desc,id.desc' };
      const range = [];
      if (state.from) range.push(`gte.${state.from}`);
      if (state.to) range.push(`lte.${state.to}`);
      if (range.length) params.record_date = range;

      state.rows = await API.Records.list(params);
      state.lastUpdated = new Date();
      refreshVehicleOptions();
      renderResults();
    } catch (err) {
      UI.toast('هەڵە لە هێنانی ڕاپۆرت: ' + err.message, 'error', 4200);
    } finally {
      state.loading = false;
      if (refBtn) UI.btnLoading(refBtn, false);
    }
  }

  /* ---------------- ڕێندەر ---------------- */

  function render(el) {
    container = el;
    const u0 = App.getUser();
    // بینینی هەموو تۆمارەکان — بەپێی دەسەڵات
    const seesAll = Perms.canView(u0, 'rep_view_all');
    // دوگمەی «تەنها باری دووەم» — بەپێی دەسەڵات
    const canSecondOnly = Perms.canView(u0, 'rep_filter_second');
    // دوگمەکانی دەرێی زۆن / گەشتنەوە — بەپێی دەسەڵات
    const canOutZone = Perms.canView(u0, 'rep_filter_out_zone');
    const canArrival = Perms.canView(u0, 'rep_filter_arrival');
    const canDriverFilter = Perms.canView(u0, 'rep_filter_driver');
    if (!state.initializedDates) {
      if (seesAll) {
        // بینینی هەموو تۆمارەکان — تەنها بەرواری ئەمڕۆ بە خۆکاری
        state.from = UI.todayStr();
        state.to = UI.todayStr();
      } else {
        // ئەوانیتر — لە یەکی ئەم مانگە تا ئەمڕۆ بە خۆکاری
        state.from = UI.monthStartStr();
        state.to = UI.todayStr();
      }
      state.initializedDates = true;
    }
    if (!state.from) state.from = seesAll ? UI.todayStr() : UI.monthStartStr();
    if (!state.to) state.to = UI.todayStr();

    el.innerHTML = `
      <section class="card filter-card">
        <div class="rep-row1">
          <button type="button" class="field-toggle-btn rep-view-btn" id="rep-view-mode" title="گۆڕینی شێوازی پیشاندان"></button>
          <div class="date-range-compact">
            <div class="field compact-field"><label>لە بەروار</label><input type="date" id="rep-from" value="${state.from}"></div>
            <div class="field compact-field"><label>بۆ بەروار</label><input type="date" id="rep-to" value="${state.to}"></div>
          </div>
          <button class="btn btn-ghost btn-sm" id="rep-print" title="پرێنتکردنی داتای فلتەرکراو">🖨️ پرێنتکردن</button>
          <button class="field-toggle-btn rep-view-btn" id="rep-refresh" title="نوێکردنەوە" type="button">⚡</button>
          ${(canSecondOnly || canOutZone || canArrival) ? `
          <div class="rep-row1-chips">
            ${canSecondOnly ? `<button class="field-toggle-btn rep-view-btn ${state.secondOnly ? 'active' : ''}" id="rep-second-only" type="button" title="تەنها باری دووەم">📦</button>` : ''}
            ${canOutZone ? `<button class="field-toggle-btn rep-view-btn ${state.outZoneOnly ? 'active' : ''}" id="rep-out-zone-only" type="button" title="دەرێی زۆن">🚏</button>` : ''}
            ${canArrival ? `<button class="field-toggle-btn rep-view-btn ${state.arrivalOnly ? 'active' : ''}" id="rep-arrival-only" type="button" title="گەشتنەوە">🏁</button>` : ''}
          </div>` : ''}
        </div>
        <div class="rep-row2">
          <div class="field compact-field" style="flex: 0 0 auto;">
            <button type="button" class="field-toggle-btn rep-view-btn" id="rep-reset-filters" title="پاککردنەوەی هەموو فلتەرەکان و گەڕانەوە بۆ ئەمڕۆ" style="height: 38px;">✖</button>
          </div>
          ${canDriverFilter ? `
          <div class="field compact-field"><label>مانگ</label>
            <select id="rep-month-filter">
              <option value="">هەموو مانگەکان</option>
              ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${String(state.monthFilter) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('')}
            </select>
          </div>
          <div class="field compact-field"><label>ڕۆژی حەفتە</label>
            <select id="rep-day-filter">
              <option value="">هەموو ڕۆژەکان</option>
              ${WEEKDAY_OPTIONS.map(d => `<option value="${UI.esc(d)}" ${state.dayFilter === d ? 'selected' : ''}>${UI.esc(d)}</option>`).join('')}
            </select>
          </div>
          <div class="field compact-field"><label>ناوی سایەق</label>
            <select id="rep-driver-select">
              <option value="">هەموو سایەقەکان</option>
            </select>
          </div>
          <div class="field compact-field"><label>ناوی دابەشكار</label>
            <select id="rep-dist-filter">
              <option value="">هەموو دابەشكارەکان</option>
            </select>
          </div>
          <div class="field compact-field"><label>ناوی مەندوو</label>
            <select id="rep-del-filter">
              <option value="">هەموو مەندووەکان</option>
            </select>
          </div>
          <div class="field compact-field"><label>ژمارەی سەیارە</label>
            <select id="rep-veh-filter">
              <option value="">هەموو سەیارەکان</option>
            </select>
          </div>
          ` : ''}
          <div class="field compact-field rep-f2-search">
            <input type="search" id="rep-search" placeholder="گەڕان بۆ سەرجەم داتاکان..." value="${UI.esc(state.search)}" autocomplete="off">
          </div>
        </div>
      </section>

      <div id="rep-totals" class="totals-grid"></div>
      <div id="rep-table"></div>`;

    Store.loadLists().then(ls => {
      const users = (ls && ls.users) || [];
      state.allUsers = users;
      state.driverUsers = users.filter(u => u.profession === CONFIG.PROFESSION_DRIVER);
      if (!canDriverFilter) return;

      // ناوی سایەق
      const dsel = $('#rep-driver-select', container);
      if (dsel) {
        state.driverUsers.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.username;
          opt.textContent = u.username;
          dsel.appendChild(opt);
        });
        dsel.value = state.driverFilter || '';
      }
      // ناوی دابەشكار — بە ئایدی یوسەر
      const distSel = $('#rep-dist-filter', container);
      if (distSel) {
        users.filter(u => u.profession === CONFIG.PROFESSION_DISTRIBUTOR).forEach(u => {
          const opt = document.createElement('option');
          opt.value = String(u.id);
          opt.textContent = u.username;
          distSel.appendChild(opt);
        });
        distSel.value = state.distributorFilter || '';
      }
      // ناوی مەندوو — بە ئایدی یوسەر
      const delSel = $('#rep-del-filter', container);
      if (delSel) {
        users.filter(u => u.profession === CONFIG.PROFESSION_DELEGATE).forEach(u => {
          const opt = document.createElement('option');
          opt.value = String(u.id);
          opt.textContent = u.username;
          delSel.appendChild(opt);
        });
        delSel.value = state.delegateFilter || '';
      }
      // ژمارەی سەیارە
      refreshVehicleOptions(ls);
    }).catch(() => {});

    // دووگمەی پشاندان وەک ڕاپۆرت / داتابەیس — شێوازی کارت یان خشتە
    const viewBtn = $('#rep-view-mode', el);
    const syncViewBtn = () => {
      const card = Store.getSettings().reportCardLayout;
      // تەنها ئایکۆن — ئایکۆنەکە ئەو شێوازە نیشان دەدات کە بە داگرتن دەگۆڕدرێت بۆی
      viewBtn.textContent = card ? '🗄️' : '📋';
      viewBtn.title = card ? 'پشاندان وەک داتابەیس (خشتە)' : 'پشاندان وەک ڕاپۆرت (کارت)';
      viewBtn.classList.toggle('active', !card);
    };
    syncViewBtn();
    viewBtn.addEventListener('click', () => {
      Store.saveSettings({ reportCardLayout: !Store.getSettings().reportCardLayout });
      syncViewBtn();
      renderResults();
    });

    $('#rep-from', el).addEventListener('change', e => { state.from = e.target.value; clearMonthSel(el); load(); });
    $('#rep-to', el).addEventListener('change', e => { state.to = e.target.value; clearMonthSel(el); load(); });
    $('#rep-search', el).addEventListener('input', e => { state.search = e.target.value; renderResults(); });
    $('#rep-refresh', el).addEventListener('click', () => load());
    $('#rep-print', el).addEventListener('click', () => printReportRecords());

    $('#rep-reset-filters', el)?.addEventListener('click', () => {
      state.monthFilter = '';
      state.dayFilter = '';
      state.driverFilter = '';
      state.distributorFilter = '';
      state.delegateFilter = '';
      state.vehicleFilter = '';
      state.search = '';
      state.from = UI.todayStr();
      state.to = UI.todayStr();
      
      const setVal = (id, val) => { const node = $('#' + id, el); if (node) node.value = val; };
      setVal('rep-month-filter', '');
      setVal('rep-day-filter', '');
      setVal('rep-driver-select', '');
      setVal('rep-dist-filter', '');
      setVal('rep-del-filter', '');
      setVal('rep-veh-filter', '');
      setVal('rep-search', '');
      setVal('rep-from', state.from);
      setVal('rep-to', state.to);
      
      load();
    });

    // مانگ — مەودای بەروار دەگۆڕێت بۆ مانگەکە (ساڵی ئێستا)
    const monthSel = $('#rep-month-filter', el);
    monthSel?.addEventListener('change', () => {
      state.monthFilter = monthSel.value;
      if (!state.monthFilter) return;
      const r = monthRange(Number(state.monthFilter));
      state.from = r.from;
      state.to = r.to;
      $('#rep-from', el).value = state.from;
      $('#rep-to', el).value = state.to;
      load();
    });
    $('#rep-day-filter', el)?.addEventListener('change', e => {
      state.dayFilter = e.target.value;
      if (state.dayFilter && state.from) {
        const parts = state.from.split('-');
        if (parts.length >= 2) {
          const y = Number(parts[0]);
          const m = Number(parts[1]);
          const last = new Date(y, m, 0).getDate();
          const mm = String(m).padStart(2, '0');
          state.from = `${y}-${mm}-01`;
          state.to = `${y}-${mm}-${String(last).padStart(2, '0')}`;
          const nFrom = $('#rep-from', el); if (nFrom) nFrom.value = state.from;
          const nTo = $('#rep-to', el); if (nTo) nTo.value = state.to;
          state.monthFilter = String(m);
          const nMonth = $('#rep-month-filter', el); if (nMonth) nMonth.value = String(m);
        }
        load();
      } else {
        renderResults();
      }
    });
    $('#rep-driver-select', el)?.addEventListener('change', e => { state.driverFilter = e.target.value; renderResults(); });
    $('#rep-dist-filter', el)?.addEventListener('change', e => { state.distributorFilter = e.target.value; renderResults(); });
    $('#rep-del-filter', el)?.addEventListener('change', e => { state.delegateFilter = e.target.value; renderResults(); });
    $('#rep-veh-filter', el)?.addEventListener('change', e => { state.vehicleFilter = e.target.value; renderResults(); });
    $('#rep-second-only', el)?.addEventListener('click', e => {
      state.secondOnly = !state.secondOnly;
      e.currentTarget.classList.toggle('active', state.secondOnly);
      renderResults();
    });
    $('#rep-out-zone-only', el)?.addEventListener('click', e => {
      state.outZoneOnly = !state.outZoneOnly;
      // ئەگەر دەرێی زۆن چالاک بوو، گەشتنەوە غەیری چالاک بکە
      if (state.outZoneOnly) {
        state.arrivalOnly = false;
        $('#rep-arrival-only', el)?.classList.remove('active');
      }
      e.currentTarget.classList.toggle('active', state.outZoneOnly);
      renderResults();
    });
    $('#rep-arrival-only', el)?.addEventListener('click', e => {
      state.arrivalOnly = !state.arrivalOnly;
      // ئەگەر گەشتنەوە چالاک بوو، دەرێی زۆن غەیری چالاک بکە
      if (state.arrivalOnly) {
        state.outZoneOnly = false;
        $('#rep-out-zone-only', el)?.classList.remove('active');
      }
      e.currentTarget.classList.toggle('active', state.arrivalOnly);
      renderResults();
    });
    // تەنها چیپەکانی مەودای خێرا — ئەوانەی data-quick یان هەیە (نەک دوگمەکانی تری وەک «تەنها باری دووەم»)
    el.querySelectorAll('.chip-btn[data-quick]').forEach(b => b.addEventListener('click', () => {
      const q = b.dataset.quick;
      if (q === 'all') { state.from = ''; state.to = ''; }
      else { state.from = UI.daysAgoStr(Number(q)); state.to = UI.todayStr(); }
      clearMonthSel(el);
      $('#rep-from', el).value = state.from;
      $('#rep-to', el).value = state.to;
      load();
    }));

    load();
    start();
  }

  function renderResults() {
    const rows = visibleRows();
    const uR = App.getUser();
    // کرداری دەستکاری و سڕینەوە — بەپێی دەسەڵات
    const canEdit = Perms.canAct(uR, 'rep_edit');
    const canDelete = Perms.canAct(uR, 'rep_delete');

    /* — کۆیەکان — */
    const t = rows.reduce((a, r) => {
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

    const totalsEl = $('#rep-totals', container);
    if (totalsEl) {
      totalsEl.classList.remove('loading');
      const totalCards = {
        trips:    { val: UI.fmtNum(rows.length), lbl: 'گەشت' },
        weight:   { val: UI.fmtNum(t.weight), lbl: 'کۆی کێش (کگم)' },
        pieces:   { val: UI.fmtNum(t.pieces), lbl: 'کۆی پارچە' },
        receipts: { val: UI.fmtNum(t.receipts), lbl: 'کۆی وەسڵ' },
        workTime: { val: UI.fmtDuration(t.workCount ? t.workMins : null), lbl: `کۆی کاتی کارکردن (${t.workCount} گەشت)`, style: 'font-size:0.98rem' },
        money:    { val: UI.fmtNum(t.money), lbl: 'کۆی پارەی هێنراوە (د.ع)', accent: true },
      };
      totalsEl.innerHTML = CONFIG.TOTAL_CARDS
        .filter(c => totalCards[c.key] && !Store.isTotalHidden(c.key))
        .map(c => {
          const d = totalCards[c.key];
          return `<div class="total-card${d.accent ? ' accent' : ''}"><span class="total-val"${d.style ? ` style="${d.style}"` : ''}>${d.val}</span><span class="total-lbl">${d.lbl}</span></div>`;
        }).join('');
    }

    /* — خشتە — */
    const tableEl = $('#rep-table', container);
    if (!tableEl) return;

    // ستوونەکان — هەر ستوونێک بە داگرتنی سەرپەڕە سۆڕت دەکرێت؛ دانە دانە دەشاردرێتەوە
    const COLS = [
      { key: 'record_date', label: 'بەروار', cls: 'nowrap', render: r => UI.esc(r.record_date || '—') },
      { key: 'weekday', label: 'ڕۆژی حەفتە', render: r => r.record_date ? UI.weekdayKu(new Date(r.record_date + 'T00:00:00')) : '—' },
      { key: 'driver', label: 'شۆفێر', render: r => UI.esc(r.driver || '—') },
      { key: 'distributor', label: 'دابەشکار', render: r => UI.esc(r.distributor || '—') },
      { key: 'delegate', label: 'مەندوب', render: r => UI.esc(r.delegate || '—') },
      { key: 'zone', label: 'زۆن', render: r => UI.esc(r.zone || '—') },
      { key: 'vehicle', label: 'سەیارە', render: r => UI.esc(r.vehicle || '—') },
      { key: 'cargo_weight', label: 'کێش (کگم)', render: r => UI.fmtNum(r.cargo_weight) },
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

    if (!rows.length) {
      tableEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-ico">📭</div>
          <p>هیچ تۆمارێک نەدۆزرایەوە بۆ ئەم مەودایە یان فلتەرەکانەوە.</p>
        </div>`;
    } else if (!visCols.length) {
      tableEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-ico">🙈</div>
          <p>هەموو ستوونەکان شاردراونەتەوە — لە ڕێکخستنەکان ستوونێک پیشان بدەرەوە.</p>
        </div>`;
    } else {
      const thHtml = visCols.map(c => {
        const active = state.sort.key === c.key;
        const arrow = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '↕';
        return `<th class="sortable ${active ? 'sorted' : ''}" data-sort="${c.key}" title="بۆ ڕیزکردن داگرتنی بکە">${c.label}<span class="sort-arrow">${arrow}</span></th>`;
      }).join('');
      const rowCells = r => visCols.map(c => {
        const st = c.styleFn ? c.styleFn(r) : '';
        return `<td data-label="${UI.esc(c.label)}"${c.cls ? ` class="${c.cls}"` : ''}${st ? ` style="${st}"` : ''}>${c.render(r)}</td>`;
      }).join('');

      if (Store.getSettings().reportCardLayout) {
        // Card Layout
        const cardsHtml = rows.map(r => {
          let avatarHtml = '';
          const usersToAvatar = [];

          // هەر سێ خانە بە ڕیز: سایەق ← دابەشکار ← مەندووب — هەموو ناوە تۆمارکراوەکان
          // (چەند ناوێک بە «و» یان ئایدی جیاکراونەتەوە) دەبێت لە زاویەکە پیشان بدرێن
          ['driver', 'distributor', 'delegate'].forEach(field => {
            state.allUsers.forEach(user => {
              if (usersToAvatar.some(u => u.id === user.id)) return;
              if (UI.recMatchesUser(r, field, user)) usersToAvatar.push(user);
            });
          });
          
          if (usersToAvatar.length > 0) {
            const avatars = usersToAvatar.map((user, i) =>
              `<div class="rep-card-avatar-item" style="z-index: ${usersToAvatar.length - i}">${UI.avatarHtml(user, 44)}</div>`
            ).join('');
            avatarHtml = `<div class="rep-card-avatars">${avatars}</div>`;
          }
          
          const halfKeys = ['vehicle', 'cargo_weight', 'pieces_count', 'receipt_number', 'record_time', 'in_zone_time', 'out_zone_time', 'arrival_time', 'work_time', 'collected_money'];
          const detailsHtml = visCols.map(c => {
            const st = c.styleFn ? c.styleFn(r) : '';
            const isHalf = halfKeys.includes(c.key);
            const rowClass = isHalf ? 'rep-card-row half' : 'rep-card-row full';
            return `<div class="${rowClass}"><span class="rep-card-lbl">${c.label}</span><span class="rep-card-val"${st ? ` style="${st}"` : ''}>${c.render(r)}</span></div>`;
          }).join('');

          return `<div class="rep-card clickable-row" data-id="${r.id}">
            ${avatarHtml}
            <div class="rep-card-content">${detailsHtml}</div>
          </div>`;
        }).join('');

        tableEl.innerHTML = `<div class="rep-cards-container">${cardsHtml}</div>`;
      } else {
        // Standard Table Layout
        tableEl.innerHTML = `
          <section class="card table-card">
            <div class="table-scroll">
              <table class="data-table">
                <thead><tr>${thHtml}</tr></thead>
                <tbody>
                  ${rows.map(r => `<tr class="clickable-row" data-id="${r.id}">${rowCells(r)}</tr>`).join('')}
                </tbody>
              </table>
            </div>
          </section>`;
      }

      tableEl.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.sort;
          if (state.sort.key === key) {
            state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
          } else {
            state.sort = { key, dir: 'asc' };
          }
          renderResults();
        });
      });

      tableEl.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', e => {
          if (e.target.closest('.btn-action-sm') || e.target.closest('button')) return;
          // ئاڤاتار — داگرتنی ویندۆی زانیاری یوسەرەکە دەکاتەوە، نەک تۆمارەکە
          if (e.target.closest('.avatar[data-uid]')) return;
          if (Store.getSettings().rowClickFullscreen !== false) {
            const id = Number(row.dataset.id);
            const r = state.rows.find(x => x.id === id);
            if (r) {
              UI.openRecordFullscreen(r, {
                ...(canEdit ? {
                  onEdit: rec => DriverView.openEditDataModal(rec, {
                    onSave: () => load({ silent: true })
                  }),
                } : {}),
                ...(canDelete ? {
                  onDelete: async rec => {
                    const ok = await UI.confirmDialog(
                      `دڵنیاییت لە سڕینەوەی ئەم تۆمارە؟\nشۆفێر: ${rec.driver} — زۆن: ${rec.zone} — بەروار: ${rec.record_date}`,
                      { danger: true, okLabel: 'بەڵێ، بسڕەوە', cancelLabel: 'پاشگەزبوونەوە' }
                    );
                    if (!ok) return;
                    try {
                      await API.Records.remove(rec.id);
                      UI.toast('تۆمارەکە سڕدرایەوە ✓', 'success');
                      load({ silent: true });
                    } catch (err) {
                      UI.toast('هەڵە لە سڕینەوە: ' + err.message, 'error', 4200);
                    }
                  }
                } : {}),
              });
            }
          }
        });
      });

    }
  }

  /* ---------------- پرێنتکردنی داتای فلتەرکراو ---------------- */

  function printReportRecords() {
    const rows = visibleRows();
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

    // وەسفی فلتەرەکان — سایەق، دابەشكار، مەندوو، سەیارە، ڕۆژ و فلتەرە چالاکەکان
    const parts = [];
    if (state.driverFilter) parts.push('سایەق: ' + state.driverFilter);
    if (state.distributorFilter) {
      const du = (state.allUsers || []).find(u => String(u.id) === String(state.distributorFilter));
      parts.push('دابەشكار: ' + (du ? du.username : state.distributorFilter));
    }
    if (state.delegateFilter) {
      const du = (state.allUsers || []).find(u => String(u.id) === String(state.delegateFilter));
      parts.push('مەندوو: ' + (du ? du.username : state.delegateFilter));
    }
    if (state.vehicleFilter) parts.push('سەیارە: ' + state.vehicleFilter);
    if (state.dayFilter) parts.push('ڕۆژ: ' + state.dayFilter);
    if (state.monthFilter) parts.push('مانگ: ' + state.monthFilter);
    if (state.secondOnly) parts.push('تەنها باری دووەم');
    if (state.outZoneOnly) parts.push('دەرێی زۆن');
    if (state.arrivalOnly) parts.push('گەشتنەوە');
    const filterText = parts.length ? parts.join(' — ') : 'هەموو تۆمارەکان';
    const searchText = state.search ? state.search : '—';
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
            ${showPrintNote ? `<div style="font-size:calc(8pt * var(--sys-fs));color:#555">چاپکراوە لە فۆڕمی ڕاپۆرت</div>` : ''}
          </div>
        </div>

        ${showMeta ? `<div class="meta-grid">
          <div class="meta-item"><span>مەودای بەروار:</span> <strong>${dateRangeText}</strong></div>
          <div class="meta-item"><span>فلتەرەکان:</span> <strong>${UI.esc(filterText)}</strong></div>
          <div class="meta-item"><span>گەڕان بەدوای:</span> <strong>${UI.esc(searchText)}</strong></div>
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

  /* ---------------- نوێبوونەوەی خۆکار ---------------- */

  function start() {
    stop();
    refreshTimer = setInterval(() => {
      if (!document.hidden && container && container.isConnected) load({ silent: true });
    }, CONFIG.REPORTS_REFRESH_SEC * 1000);
  }

  function stop() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  return { render, stop };
})();



