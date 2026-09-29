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
    rows: [],
    driverUsers: [], // لیستی شۆفێرەکان بۆ فلتەری شۆفێر (بە ئایدی)
    lastUpdated: null,
    loading: false,
    sort: { key: 'record_date', dir: 'desc' }, // ڕیزکردنی خشتە بە داگرتن لەسەر سەرپەڕە
    initializedDates: false,
    secondOnly: false, // تەنها باری دووەم پیشان بدە (بۆ سایەق/دابەشکار)
  };

  const isSupervisor = u => u && (u.profession === CONFIG.PROFESSION_SUPERVISOR || u.profession === 'بەڕێوبەر' || u.profession === 'بەریوبەر');

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
    if (isSupervisor(u)) return rows;
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

  function visibleRows() {
    let rows = roleFilter(state.rows);
    if (state.driverFilter) {
      // فلتەری شۆفێر بە ئایدی — value ی ئۆپشنەکە ئایدی یوسەرە لە usersv2
      const du = (state.driverUsers || []).find(x => String(x.id) === String(state.driverFilter));
      rows = rows.filter(r => du
        ? UI.recMatchesUser(r, 'driver', du)
        : String(r.driver || '').replace(/ (دوو|سێ)$/, '') === state.driverFilter);
    }
    if (state.search) {
      const q = UI.norm(state.search);
      rows = rows.filter(r =>
        [r.driver, r.distributor, r.delegate, r.zone, r.vehicle].some(v => UI.norm(v).includes(q)));
    }
    if (state.secondOnly) {
      rows = rows.filter(r => cargoIdxOf(r) >= 1);
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

  /* ---------------- بارکردنی داتا ---------------- */

  async function load({ silent = false } = {}) {
    const refBtn = $('#rep-refresh', container);
    if (!silent) {
      state.loading = true;
      $('#rep-totals', container)?.classList.add('loading');
      if (refBtn) UI.btnLoading(refBtn, true, 'دەهێنرێت...');
    }
    try {
      const params = { select: '*', order: 'record_date.desc,id.desc' };
      const range = [];
      if (state.from) range.push(`gte.${state.from}`);
      if (state.to) range.push(`lte.${state.to}`);
      if (range.length) params.record_date = range;

      state.rows = await API.Records.list(params);
      state.lastUpdated = new Date();
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
    const sup = isSupervisor(u0);
    // دوگمەی «تەنها باری دووەم» تەنها بۆ سایەق و دابەشکار
    const canSecondOnly = u0 && (u0.profession === CONFIG.PROFESSION_DRIVER || u0.profession === CONFIG.PROFESSION_DISTRIBUTOR);
    if (!state.initializedDates) {
      if (sup) {
        // بەڕێوەبەر — تەنها بەرواری ئەمڕۆ بە خۆکاری
        state.from = UI.todayStr();
        state.to = UI.todayStr();
      } else {
        // سایەق و دابەشکار — لە یەکی ئەم مانگە تا ئەمڕۆ بە خۆکاری
        state.from = UI.monthStartStr();
        state.to = UI.todayStr();
      }
      state.initializedDates = true;
    }
    if (!state.from) state.from = sup ? UI.todayStr() : UI.monthStartStr();
    if (!state.to) state.to = UI.todayStr();
    const driverOptions = Store.loadLists()
      .then(ls => (ls && ls.users ? ls.users.filter(u => u.profession === CONFIG.PROFESSION_DRIVER) : []))
      .catch(() => []);

    el.innerHTML = `
      <section class="card filter-card">
        <div class="date-range-compact">
          <div class="field compact-field"><label>لە بەروار</label><input type="date" id="rep-from" value="${state.from}"></div>
          <div class="field compact-field"><label>بۆ بەروار</label><input type="date" id="rep-to" value="${state.to}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>گەڕان</label><input type="search" id="rep-search" placeholder="شۆفێر، زۆن، سەیارە..." value="${UI.esc(state.search)}"></div>
          ${sup ? `<div class="field"><label>شۆفێر</label><select id="rep-driver"><option value="">هەموو شۆفێرەکان</option></select></div>` : ''}
        </div>
        <div class="filter-foot" style="justify-content:flex-end;gap:8px">
          ${canSecondOnly ? `<button class="chip-btn ${state.secondOnly ? 'active' : ''}" id="rep-second-only" type="button">تەنها باری دووەم</button>` : ''}
          <button class="btn btn-ghost btn-sm" id="rep-refresh">⟳ نوێکردنەوە</button>
        </div>
      </section>

      <div id="rep-totals" class="totals-grid"></div>
      <div id="rep-table"></div>`;

    if (sup) {
      driverOptions.then(users => {
        state.driverUsers = Array.isArray(users) ? users : [];
        const sel = $('#rep-driver', container);
        if (sel && Array.isArray(users)) {
          sel.innerHTML = '<option value="">هەموو شۆفێرەکان</option>';
          users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = String(u.id); // ئایدی یوسەر لە usersv2 — نەک ناو
            opt.textContent = u.username;
            sel.appendChild(opt);
          });
          sel.value = state.driverFilter;
          sel.addEventListener('change', () => { state.driverFilter = sel.value; renderResults(); });
        }
      }).catch(() => {});
    }

    $('#rep-from', el).addEventListener('change', e => { state.from = e.target.value; load(); });
    $('#rep-to', el).addEventListener('change', e => { state.to = e.target.value; load(); });
    $('#rep-search', el).addEventListener('input', e => { state.search = e.target.value; renderResults(); });
    $('#rep-refresh', el).addEventListener('click', () => load());
    $('#rep-second-only', el)?.addEventListener('click', e => {
      state.secondOnly = !state.secondOnly;
      e.currentTarget.classList.toggle('active', state.secondOnly);
      renderResults();
    });
    // تەنها چیپەکانی مەودای خێرا — ئەوانەی data-quick یان هەیە (نەک دوگمەکانی تری وەک «تەنها باری دووەم»)
    el.querySelectorAll('.chip-btn[data-quick]').forEach(b => b.addEventListener('click', () => {
      const q = b.dataset.quick;
      if (q === 'all') { state.from = ''; state.to = ''; }
      else { state.from = UI.daysAgoStr(Number(q)); state.to = UI.todayStr(); }
      $('#rep-from', el).value = state.from;
      $('#rep-to', el).value = state.to;
      load();
    }));

    load();
    start();
  }

  function renderResults() {
    const rows = visibleRows();
    const sup = isSupervisor(App.getUser());

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
      { key: 'work_time', label: 'کاتی کارکردن', cls: 'nowrap', styleFn: r => r.work_time ? 'color:var(--accent);font-weight:700' : '', render: r => r.work_time ? UI.esc(r.work_time) : UI.calcDuration(r.record_time, r.arrival_time) },
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
        return `<td${c.cls ? ` class="${c.cls}"` : ''}${st ? ` style="${st}"` : ''}>${c.render(r)}</td>`;
      }).join('');

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

      tableEl.querySelectorAll('tbody tr.clickable-row').forEach(row => {
        row.addEventListener('click', e => {
          if (e.target.closest('.btn-action-sm') || e.target.closest('button')) return;
          if (Store.getSettings().rowClickFullscreen !== false) {
            const id = Number(row.dataset.id);
            const r = state.rows.find(x => x.id === id);
            if (r) {
              UI.openRecordFullscreen(r, sup ? {
                onEdit: rec => DriverView.openEditDataModal(rec, {
                  onSave: () => load({ silent: true })
                }),
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
              } : {});
            }
          }
        });
      });

    }
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
