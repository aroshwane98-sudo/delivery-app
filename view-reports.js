/* =========================================================
 *  ڕاپۆرت و ئامارەکان — فلتەری بەروار، کۆیەکان، نوێبوونەوەی خۆکار
 * ========================================================= */

const ReportsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  let refreshTimer = null;
  // بنەڕەتی مەودای بەروار: لە سەرەتای ئەم مانگە بۆ ئەمڕۆ
  const monthStartStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  let state = {
    from: monthStartStr(),
    to: UI.todayStr(),
    search: '',
    driverFilter: '',
    rows: [],
    lastUpdated: null,
    loading: false,
    sort: { key: 'record_date', dir: 'desc' }, // ڕیزکردنی خشتە بە داگرتن لەسەر سەرپەڕە
  };

  const isSupervisor = u => u && (u.profession === CONFIG.PROFESSION_SUPERVISOR || u.profession === 'بەڕێوبەر' || u.profession === 'بەریوبەر');

  /* ---------------- فلتەری پێ بەپێی دەسەڵات ---------------- */

  function roleFilter(rows) {
    const u = App.getUser();
    if (isSupervisor(u)) return rows;
    if (u.profession === CONFIG.PROFESSION_DRIVER) {
      return rows.filter(r => UI.userMatches(r.driver, u.username));
    }
    if (u.profession === CONFIG.PROFESSION_DISTRIBUTOR) {
      return rows.filter(r => UI.userMatches(r.distributor, u.username));
    }
    if (u.profession === CONFIG.PROFESSION_DELEGATE) {
      return rows.filter(r => UI.userMatches(r.delegate, u.username));
    }
    return rows;
  }

  function visibleRows() {
    let rows = roleFilter(state.rows);
    if (state.driverFilter) rows = rows.filter(r => {
      const base = String(r.driver || '').replace(/ (دوو|سێ)$/, '');
      return base === state.driverFilter;
    });
    if (state.search) {
      const q = UI.norm(state.search);
      rows = rows.filter(r =>
        [r.driver, r.distributor, r.delegate, r.zone, r.vehicle].some(v => UI.norm(v).includes(q)));
    }
    // ڕیزکردن بەپێی ستوونی هەڵبژێردراو
    const s = state.sort || { key: 'record_date', dir: 'desc' };
    const dir = s.dir === 'asc' ? 1 : -1;
    const numKeys = ['cargo_weight', 'pieces_count', 'receipt_number', 'collected_money'];
    rows = [...rows].sort((a, b) => {
      if (numKeys.includes(s.key)) return (Number(a[s.key] || 0) - Number(b[s.key] || 0)) * dir;
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
    if (!state.from) state.from = monthStartStr();
    if (!state.to) state.to = UI.todayStr();
    const sup = isSupervisor(App.getUser());
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
        <div class="filter-foot" style="justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" id="rep-refresh">⟳ نوێکردنەوە</button>
        </div>
      </section>

      <div id="rep-totals" class="totals-grid"></div>
      <div id="rep-table"></div>`;

    if (sup) {
      driverOptions.then(users => {
        const sel = $('#rep-driver', container);
        if (sel && Array.isArray(users)) {
          sel.innerHTML = '<option value="">هەموو شۆفێرەکان</option>';
          users.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.username;
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
    el.querySelectorAll('.chip-btn').forEach(b => b.addEventListener('click', () => {
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
        weight: a.weight + Number(r.cargo_weight || 0),
        pieces: a.pieces + Number(r.pieces_count || 0),
        receipts: a.receipts + Number(r.receipt_number || 0),
        money: a.money + Number(r.collected_money || 0),
        workMins: a.workMins + (d === null ? 0 : d),
        workCount: a.workCount + (d === null ? 0 : 1),
      };
    }, { weight: 0, pieces: 0, receipts: 0, money: 0, workMins: 0, workCount: 0 });

    const totalsEl = $('#rep-totals', container);
    if (totalsEl) {
      totalsEl.classList.remove('loading');
      totalsEl.innerHTML = `
        <div class="total-card"><span class="total-val">${UI.fmtNum(rows.length)}</span><span class="total-lbl">گەشت</span></div>
        <div class="total-card"><span class="total-val">${UI.fmtNum(t.weight)}</span><span class="total-lbl">کۆی کێش (کگم)</span></div>
        <div class="total-card"><span class="total-val">${UI.fmtNum(t.pieces)}</span><span class="total-lbl">کۆی پارچە</span></div>
        <div class="total-card"><span class="total-val">${UI.fmtNum(t.receipts)}</span><span class="total-lbl">کۆی وەسڵ</span></div>
        <div class="total-card"><span class="total-val" style="font-size:0.98rem">${UI.fmtDuration(t.workCount ? t.workMins : null)}</span><span class="total-lbl">کۆی کاتی کارکردن (${t.workCount} گەشت)</span></div>
        <div class="total-card accent"><span class="total-val">${UI.fmtNum(t.money)}</span><span class="total-lbl">کۆی پارەی هێنراوە (د.ع)</span></div>`;
    }

    /* — خشتە — */
    const tableEl = $('#rep-table', container);
    if (!tableEl) return;

    if (!rows.length) {
      tableEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-ico">📭</div>
          <p>هیچ تۆمارێک نەدۆزرایەوە بۆ ئەم مەودایە یان فلتەرەکانەوە.</p>
        </div>`;
    } else {
      tableEl.innerHTML = `
        <section class="card table-card">
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  ${[
                    { label: 'کردارەکان', key: null },
                    { label: 'بەروار', key: 'record_date' },
                    { label: 'شۆفێر', key: 'driver' },
                    { label: 'دابەشکار', key: 'distributor' },
                    { label: 'مەندوب', key: 'delegate' },
                    { label: 'زۆن', key: 'zone' },
                    { label: 'سەیارە', key: 'vehicle' },
                    { label: 'کێش (کگم)', key: 'cargo_weight' },
                    { label: 'پارچە', key: 'pieces_count' },
                    { label: 'وەسڵ', key: 'receipt_number' },
                    { label: 'دەرچوون', key: 'record_time' },
                    { label: 'ناو زۆن', key: 'in_zone_time' },
                    { label: 'دەرێی زۆن', key: 'out_zone_time' },
                    { label: 'گەشتنەوە', key: 'arrival_time' },
                    { label: 'کاتی کارکردن', key: 'work_time' },
                    { label: 'پارەی هێنراوە', key: 'collected_money' },
                  ].map(c => {
                    if (!c.key) return sup ? '<th>کردارەکان</th>' : '';
                    const active = state.sort.key === c.key;
                    const arrow = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '↕';
                    return `<th class="sortable ${active ? 'sorted' : ''}" data-sort="${c.key}" title="بۆ ڕیزکردن داگرتنی بکە">${c.label}<span class="sort-arrow">${arrow}</span></th>`;
                  }).join('')}
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr class="clickable-row" data-id="${r.id}">
                    ${sup ? `
                    <td class="table-actions-cell">
                      <button type="button" class="btn-action-sm btn-edit rep-edit-btn" data-id="${r.id}" title="دەستکاری">✏️</button>
                      <button type="button" class="btn-action-sm btn-del rep-del-btn" data-id="${r.id}" title="سڕینەوە">🗑️</button>
                    </td>` : ''}
                    <td class="nowrap">${UI.esc(r.record_date || '—')}</td>
                    <td>${UI.esc(r.driver || '—')}</td>
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
                    <td class="nowrap" style="${r.work_time ? 'color:var(--accent);font-weight:700' : ''}">${r.work_time ? UI.esc(r.work_time) : UI.calcDuration(r.record_time, r.arrival_time)}</td>
                    <td class="money-cell">${UI.fmtNum(r.collected_money)}</td>
                  </tr>`).join('')}
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
            if (r) UI.openRecordFullscreen(r);
          }
        });
      });

      if (sup) {
        tableEl.querySelectorAll('.rep-edit-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = Number(btn.dataset.id);
            const r = state.rows.find(x => x.id === id);
            if (r) openEditRecordModal(r);
          });
        });
        tableEl.querySelectorAll('.rep-del-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = Number(btn.dataset.id);
            const r = state.rows.find(x => x.id === id);
            if (r) deleteRecord(r);
          });
        });
      }
    }
  }

  /* ---------------- نوێبوونەوەی خۆکار ---------------- */

  /* ---------------- کردارەکانی بەڕێوبەر (دەستکاری و سڕینەوەی بار) ---------------- */

  async function deleteRecord(rec) {
    const ok = await UI.confirmDialog(`دڵنیاییت لە سڕینەوەی ئەم تۆمارە؟\nشۆفێر: ${rec.driver || '—'} | زۆن: ${rec.zone || '—'} | بەروار: ${rec.record_date || '—'}`, {
      danger: true,
      okLabel: 'بەڵێ، بسڕەوە',
      cancelLabel: 'پاشگەزبوونەوە',
    });
    if (!ok) return;

    try {
      await API.Records.remove(rec.id);
      UI.toast('تۆمارەکە بە سەرکەوتوویی سڕدرایەوە ✓', 'success');
      await load({ silent: true });
    } catch (err) {
      UI.toast('هەڵە لە سڕینەوەی تۆمار: ' + err.message, 'error', 4200);
    }
  }

  function openEditRecordModal(rec) {
    const body = document.createElement('div');
    body.innerHTML = `
      <form id="rep-edit-form" novalidate>
        <div class="field-row date-range-compact">
          <div class="field compact-field"><label>بەروار</label><input type="date" id="ef-date" value="${rec.record_date || ''}"></div>
          <div class="field compact-field"><label>سەیارە</label><input type="text" id="ef-vehicle" value="${UI.esc(rec.vehicle || '')}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>شۆفێر</label><input type="text" id="ef-driver" value="${UI.esc(rec.driver || '')}"></div>
          <div class="field"><label>زۆن</label><input type="text" id="ef-zone" value="${UI.esc(rec.zone || '')}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>دابەشکار</label><input type="text" id="ef-distributor" value="${UI.esc(rec.distributor || '')}"></div>
          <div class="field"><label>مەندوب</label><input type="text" id="ef-delegate" value="${UI.esc(rec.delegate || '')}"></div>
        </div>
        <div class="field-row date-range-compact">
          <div class="field compact-field"><label>کێش (کگم)</label><input type="number" step="any" id="ef-weight" value="${rec.cargo_weight ?? 0}"></div>
          <div class="field compact-field"><label>پارچە</label><input type="number" id="ef-pieces" value="${rec.pieces_count ?? 0}"></div>
          <div class="field compact-field"><label>وەسڵ</label><input type="number" id="ef-receipt" value="${rec.receipt_number ?? 0}"></div>
        </div>
        <div class="date-range-compact">
          <div class="field compact-field"><label>🚚 کاتی دەرچوون</label><input type="time" id="ef-t-rec" value="${rec.record_time || ''}"></div>
          <div class="field compact-field"><label>📍 کاتی ناو زۆن</label><input type="time" id="ef-t-in" value="${rec.in_zone_time || ''}"></div>
        </div>
        <div class="date-range-compact">
          <div class="field compact-field"><label>🚏 کاتی دەرێی زۆن</label><input type="time" id="ef-t-out" value="${rec.out_zone_time || ''}"></div>
          <div class="field compact-field"><label>🏁 کاتی گەشتنەوە</label><input type="time" id="ef-t-arr" value="${rec.arrival_time || ''}"></div>
        </div>
        <div class="field compact-field">
          <label>⏱️ کاتی کارکردن (ئارەزوومەندانە)</label>
          <input type="text" id="ef-wtime" placeholder="کاتژمێر:خولەک — بۆ نموونە 8:30" value="${UI.esc(rec.work_time || '')}">
        </div>
        <div class="field">
          <label>💰 پارەی هێنراوە (د.ع)</label>
          <input type="number" id="ef-money" value="${rec.collected_money ?? 0}">
        </div>
      </form>`;

    Store.loadLists().then(ls => {
      const vList = (ls?.vehicles || []).map(v => {
        const val = v.vehicle_number || v.plate_number || v.number || v.name || v.vehicle || v.plate || Object.values(v)[1] || Object.values(v)[0];
        return { label: String(val).trim() };
      }).filter(v => v.label && v.label !== '[object Object]');
      UI.autocomplete($('#ef-vehicle', body), () => vList);
    }).catch(() => {});

    const { close } = UI.openModal({
      title: '✏️ دەستکاریکردنی تۆماری گەیاندن',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'پاشەکەوتکردن',
          className: 'btn-primary',
          onClick: async (backdrop) => {
            const saveBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const val = id => $(id, body).value.trim();
            const patch = {
              record_date: val('#ef-date') || rec.record_date,
              vehicle: val('#ef-vehicle'),
              driver: val('#ef-driver'),
              zone: val('#ef-zone'),
              distributor: val('#ef-distributor'),
              delegate: val('#ef-delegate'),
              cargo_weight: Number(val('#ef-weight') || 0),
              pieces_count: Number(val('#ef-pieces') || 0),
              receipt_number: Number(val('#ef-receipt') || 0),
              record_time: val('#ef-t-rec') || null,
              in_zone_time: val('#ef-t-in') || null,
              out_zone_time: val('#ef-t-out') || null,
              arrival_time: val('#ef-t-arr') || null,
              collected_money: Number(val('#ef-money') || 0),
            };

            const wtimeRaw = val('#ef-wtime');
            if (wtimeRaw) {
              if (UI.parseDurationMin(wtimeRaw) === null) {
                UI.toast('کاتی کارکردن دەبێت بە شێوەی «کاتژمێر:خولەک» بێت — بۆ نموونە 8:30', 'warning', 4500);
                return;
              }
              patch.work_time = wtimeRaw;
            } else {
              patch.work_time = null;
            }

            UI.btnLoading(saveBtn, true, 'پاشەکەوت دەکرێت...');
            try {
              await API.Records.update(rec.id, patch);
              UI.toast('تۆمارەکە بە سەرکەوتوویی نوێ کرایەوە ✓', 'success');
              close();
              await load({ silent: true });
            } catch (err) {
              UI.toast('هەڵە لە نوێکردنەوەی تۆمار: ' + err.message, 'error', 4200);
            } finally {
              UI.btnLoading(saveBtn, false);
            }
          }
        }
      ]
    });
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
