/* =========================================================
 *  پانێلی شۆفێر — قۆناغەکانی گەیاندن، فرە-بار، پارەی هێنراوە
 * ========================================================= */

const DriverView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  let refreshTimer = null;
  let countdownTimer = null;
  let records = [];   // تۆمارەکانی ئەمڕۆی ئەم شۆفێرە
  let lists = null;   // {users, zones}

  const variants = () => CONFIG.CARGO_SUFFIXES.map(s => App.getUser().username + s);

  const cargoIndex = rec => {
    const u = App.getUser().username;
    if (rec.driver === u + ' دوو') return 1;
    if (rec.driver === u + ' سێ') return 2;
    return 0;
  };

  const activeRecord = () => records.find(r => !r.arrival_time) || null;

  /* ---------------- بارکردنی داتا ---------------- */

  async function load({ silent = false } = {}) {
    if (!silent) container.innerHTML = `<div class="skeleton-block"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-line"></div></div>`;
    try {
      const today = UI.todayStr();
      const [ls, allToday] = await Promise.all([
        lists ? Promise.resolve(lists) : Store.loadLists(),
        API.Records.list({ 'record_date': `eq.${today}` }),
      ]);
      lists = ls;
      records = (allToday || []).filter(r => variants().includes(r.driver));
      renderAll();
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-ico">⚠️</div>
          <p>هەڵە لە هێنانی داتا: ${UI.esc(err.message)}</p>
          <button class="btn btn-primary" id="retry-btn">دووبارە هەوڵبدە</button>
        </div>`;
      $('#retry-btn', container).addEventListener('click', () => load());
    }
  }

  /* ---------------- دۆزینەوەی هەنگاوی داهاتوو ---------------- */

  function nextAction() {
    const active = activeRecord();
    if (active) {
      if (!active.in_zone_time) return { type: 'in_zone', label: 'گەیشتمە ناو زۆن', icon: '📍' };
      if (!active.out_zone_time) return { type: 'out_zone', label: 'دەرچوون لە زۆن', icon: '🚏' };
      return { type: 'arrival', label: 'گەیشتمەوە بۆ خاڵی دەستپێک', icon: '🏁' };
    }
    const count = records.length;
    if (count >= CONFIG.MAX_CARGOS_PER_DAY) return { type: 'done', label: 'ئەمڕۆ هەر سێ بار تەواو بوون ✅', icon: '🎉' };

    // پشکنینی ماوەی پێویست پاش گەشتنەوەی پێشوو
    if (count > 0) {
      const last = records[0];
      const arrived = UI.timeToMinutes(last.arrival_time);
      if (arrived !== null) {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const elapsed = nowMin - arrived;
        const need = CONFIG.CARGO_GAP_MINUTES;
        if (elapsed < need) {
          return { type: 'wait', remainMin: need - elapsed, label: `${CONFIG.CARGO_LABELS[count]} — بارێکی نوێ`, icon: '➕' };
        }
      }
    }
    return { type: 'exit', label: `تۆمارکردنی دەرچوون — ${CONFIG.CARGO_LABELS[count] || 'باری نوێ'}`, icon: '🚚' };
  }

  /* ---------------- ڕێندەری سەرەکی ---------------- */

  function renderAll() {
    const active = activeRecord();
    const totals = records.reduce((a, r) => ({
      weight: a.weight + Number(r.cargo_weight || 0),
      pieces: a.pieces + Number(r.pieces_count || 0),
      money: a.money + Number(r.collected_money || 0),
    }), { weight: 0, pieces: 0, money: 0 });

    container.innerHTML = `
      <section class="card hero-card">
        <div class="hero-top">
          <div>
            <h2 class="hero-title">${UI.fmtDateHuman(UI.todayStr())}</h2>
            <p class="hero-sub">کاتی ئێستا: <b id="drv-clock">${UI.nowTime()}</b></p>
          </div>
          <button class="icon-btn" id="drv-refresh" title="نوێکردنەوە">⟳</button>
        </div>
        <div class="stat-row">
          <div class="stat"><span class="stat-val">${records.length}</span><span class="stat-lbl">بار</span></div>
          <div class="stat"><span class="stat-val">${UI.fmtNum(totals.weight)}</span><span class="stat-lbl">کگم</span></div>
          <div class="stat"><span class="stat-val">${UI.fmtNum(totals.pieces)}</span><span class="stat-lbl">پارچە</span></div>
          <div class="stat"><span class="stat-val">${UI.fmtNum(totals.money)}</span><span class="stat-lbl">د.ع</span></div>
        </div>
      </section>

      <div id="drv-active"></div>
      <div id="drv-action"></div>
      <div id="drv-history"></div>`;

    renderActive(active);
    renderAction();
    renderHistory();

    $('#drv-refresh', container).addEventListener('click', () => load());
    startClock();
  }

  function renderActive(active) {
    const el = $('#drv-active', container);
    if (!active) {
      el.innerHTML = `
        <div class="card idle-card">
          <div class="idle-ico">🚚</div>
          <p>${records.length ? 'هیچ باری چالاکێک نییە — لە خوارەوە بارێکی نوێ دەست پێبکە.' : 'هێشتا هیچ بارێک ئەمڕۆ تۆمار نەکراوە — سەرەوە دەست پێبکە.'}</p>
        </div>`;
      return;
    }

    const stages = [
      { key: 'record_time', label: 'دەرچوون', icon: '🚚' },
      { key: 'in_zone_time', label: 'ناو زۆن', icon: '📍' },
      { key: 'out_zone_time', label: 'دەرێی زۆن', icon: '🚏' },
      { key: 'arrival_time', label: 'گەشتنەوە', icon: '🏁' },
    ];
    const firstUndone = stages.findIndex(s => !active[s.key]);

    const stepsHtml = stages.map((s, i) => {
      const done = !!active[s.key];
      const isNow = i === firstUndone;
      return `
        <div class="step ${done ? 'done' : ''} ${isNow ? 'now' : ''}">
          <div class="step-dot">${done ? '✓' : s.icon}</div>
          <div class="step-time">${done ? UI.esc(active[s.key]) : '—'}</div>
          <div class="step-label">${s.label}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <section class="card active-card">
        <div class="active-head">
          <span class="cargo-badge">${UI.esc(CONFIG.CARGO_LABELS[cargoIndex(active)] || 'بار')}</span>
          <span class="zone-chip">🗺 ${UI.esc(active.zone || '—')}</span>
        </div>
        <div class="active-time-edit-bar">
          <button type="button" class="btn-edit-times" id="active-edit-times-btn">⏱️ دەستکاری کاتەکان</button>
        </div>
        <div class="stepper">${stepsHtml}</div>
        <div class="detail-grid">
          <div class="detail"><span>دابەشکار</span><b>${UI.esc(active.distributor || '—')}</b></div>
          <div class="detail"><span>مەندوب</span><b>${UI.esc(active.delegate || '—')}</b></div>
          <div class="detail"><span>ژمارەی سەیارە</span><b>${UI.esc(active.vehicle || '—')}</b></div>
          <div class="detail"><span>کێشی بار</span><b>${UI.fmtNum(active.cargo_weight)} کگم</b></div>
          <div class="detail"><span>پارچەکان</span><b>${UI.fmtNum(active.pieces_count)}</b></div>
          <div class="detail"><span>وەسڵ</span><b>${UI.fmtNum(active.receipt_number)}</b></div>
        </div>
        <button class="money-row" id="money-btn" type="button">
          <span class="money-lbl">💰 پارەی هێنراوە</span>
          <b class="money-val">${UI.fmtMoney(active.collected_money)}</b>
          <span class="money-edit">دەستکاری</span>
        </button>
      </section>`;
    $('#money-btn', el).addEventListener('click', () => openMoneyModal(active));
    $('#active-edit-times-btn', el)?.addEventListener('click', () => openEditTimesModal(active));
  }

  function renderAction() {
    const el = $('#drv-action', container);
    const act = nextAction();

    if (act.type === 'wait') {
      el.innerHTML = `
        <button class="btn btn-primary btn-block btn-big" disabled>
          ${act.icon} ${UI.esc(act.label)} — دوای ${act.remainMin} خولەکی تر
        </button>
        <p class="hint">ماوەی پێویست نێوان هەر دوو بار: ${CONFIG.CARGO_GAP_MINUTES} خولەک پاش گەشتنەوە</p>`;
    } else if (act.type === 'done') {
      el.innerHTML = `<div class="card done-card">🎉 ${UI.esc(act.label)}</div>`;
    } else if (act.type === 'exit') {
      el.innerHTML = `<button class="btn btn-primary btn-block btn-big" id="act-btn">${act.icon} ${UI.esc(act.label)}</button>`;
      $('#act-btn', el).addEventListener('click', openExitModal);
    } else {
      el.innerHTML = `<button class="btn btn-primary btn-block btn-big" id="act-btn">${act.icon} ${UI.esc(act.label)}</button>`;
      $('#act-btn', el).addEventListener('click', () => doStage(act.type));
    }
  }

  function renderHistory() {
    const el = $('#drv-history', container);
    const done = records.filter(r => r.arrival_time);
    if (!done.length) { el.innerHTML = ''; return; }
    el.innerHTML = `
      <h3 class="section-title">بارە تەواوبووەکانی ئەمڕۆ</h3>
      ${done.map(r => `
        <div class="card hist-card">
          <div class="hist-top">
            <b>${UI.esc(CONFIG.CARGO_LABELS[cargoIndex(r)] || 'بار')}</b>
            <div style="display:flex;align-items:center;gap:6px">
              <button type="button" class="btn-edit-times btn-hist-edit" data-id="${r.id}">⏱️ دەستکاری کاتەکان</button>
              <span class="zone-chip sm">🗺 ${UI.esc(r.zone || '—')}</span>
            </div>
          </div>
          <div class="hist-meta">
            <span>🚚 ${UI.esc(r.record_time || '—')}</span>
            <span>📍 ${UI.esc(r.in_zone_time || '—')}</span>
            <span>🚏 ${UI.esc(r.out_zone_time || '—')}</span>
            <span>🏁 ${UI.esc(r.arrival_time || '—')}</span>
          </div>
          <div class="hist-foot">
            <span>${UI.fmtNum(r.cargo_weight)} کگم • ${UI.fmtNum(r.pieces_count)} پارچە • ${UI.fmtNum(r.receipt_number)} وەسڵ</span>
            <b class="money-val">${UI.fmtMoney(r.collected_money)}</b>
          </div>
        </div>`).join('')}`;

    el.querySelectorAll('.btn-hist-edit').forEach(b => {
      b.addEventListener('click', () => {
        const id = Number(b.dataset.id);
        const r = records.find(x => x.id === id);
        if (r) openEditTimesModal(r);
      });
    });
  }

  /* ---------------- کردارەکان ---------------- */

  async function doStage(type) {
    const active = activeRecord();
    if (!active) return;

    // ڕێگری لە تێپەڕاندنی قۆناغەکان
    if (type === 'in_zone' && !active.record_time) return;
    if (type === 'out_zone' && !active.in_zone_time) { UI.toast('سەرەتا دەبێت ناو زۆن تۆمار بکەیت', 'warning'); return; }
    if (type === 'arrival' && !active.out_zone_time) { UI.toast('سەرەتا دەبێت دەرێی زۆن تۆمار بکەیت', 'warning'); return; }

    const field = { in_zone: 'in_zone_time', out_zone: 'out_zone_time', arrival: 'arrival_time' }[type];
    const label = { in_zone: 'گەیشتن بە ناو زۆن', out_zone: 'دەرچوون لە زۆن', arrival: 'گەشتنەوە' }[type];

    const actBtn = $('#act-btn', container);
    UI.btnLoading(actBtn, true, 'تۆمار دەکرێت...');
    try {
      await API.Records.update(active.id, { [field]: UI.nowTime() });
      UI.toast(`${label} بە سەرکەوتوویی تۆمار کرا ✓`, 'success');
      await load({ silent: true });
    } catch (err) {
      UI.toast('هەڵە لە تۆمارکردن: ' + err.message, 'error', 4200);
    } finally {
      UI.btnLoading(actBtn, false);
    }
  }

  /* ---------------- مۆدالی دەرچوون ---------------- */

  function openExitModal() {
    const count = records.length;
    const cargoLabel = CONFIG.CARGO_LABELS[count] || 'باری نوێ';
    const distributors = (lists?.users || []).filter(u => u.profession === CONFIG.PROFESSION_DISTRIBUTOR).map(u => ({ label: u.username }));
    const delegates = (lists?.users || []).filter(u => u.profession === CONFIG.PROFESSION_DELEGATE).map(u => ({ label: u.username }));
    const zones = (lists?.zones || []).map(z => ({ label: z.name }));

    const body = document.createElement('div');
    body.innerHTML = `
      <form id="exit-form" novalidate>
        <div class="field"><label>ناوی دابەشکار *</label><input id="f-distributor" type="text" placeholder="هەڵبژێرە یان بنووسە"></div>
        <div class="field"><label>ناوی مەندوب *</label><input id="f-delegate" type="text" placeholder="هەڵبژێرە یان بنووسە"></div>
        <div class="field"><label>ناوچە / زۆن *</label><input id="f-zone" type="text" placeholder="هەڵبژێرە یان بنووسە"></div>
        <div class="field-row">
          <div class="field"><label>ژمارەی سەیارە *</label><input id="f-vehicle" type="text" inputmode="numeric" placeholder="بۆ نموونە: 28756"></div>
          <div class="field"><label>کاتی دەرچوون *</label><input id="f-time" type="time" value="${UI.nowTime()}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>کێشی بار (کگم) *</label><input id="f-weight" type="number" min="0" step="any" placeholder="0"></div>
          <div class="field"><label>ژمارەی پارچەکان *</label><input id="f-pieces" type="number" min="0" step="1" placeholder="0"></div>
        </div>
        <div class="field"><label>ژمارەی وەسڵ *</label><input id="f-receipt" type="number" min="0" step="1" placeholder="0"></div>
      </form>`;

    UI.autocomplete($('#f-distributor', body), () => distributors);
    UI.autocomplete($('#f-delegate', body), () => delegates);
    UI.autocomplete($('#f-zone', body), () => zones);

    const { close } = UI.openModal({
      title: `🚚 تۆمارکردنی دەرچوون — ${cargoLabel}`,
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'تۆمارکردن', className: 'btn-primary', onClick: async (backdrop) => {
            const submitBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const val = id => $(id, body).value.trim();
            const fields = {
              distributor: val('#f-distributor'), delegate: val('#f-delegate'), zone: val('#f-zone'),
              vehicle: val('#f-vehicle'), record_time: val('#f-time'),
              cargo_weight: val('#f-weight'), pieces_count: val('#f-pieces'), receipt_number: val('#f-receipt'),
            };
            const missing = Object.entries(fields).filter(([, v]) => v === '');
            if (missing.length) {
              UI.toast('تکایە هەموو خانەکان پڕ بکەرەوە', 'warning');
              missing.forEach(([k]) => {
                const map = { distributor: '#f-distributor', delegate: '#f-delegate', zone: '#f-zone', vehicle: '#f-vehicle', record_time: '#f-time', cargo_weight: '#f-weight', pieces_count: '#f-pieces', receipt_number: '#f-receipt' };
                $(map[k], body).classList.add('invalid');
              });
              return;
            }

            UI.btnLoading(submitBtn, true, 'تۆمار دەکرێت...');
            try {
              await API.Records.insert({
                driver: App.getUser().username + (CONFIG.CARGO_SUFFIXES[count] || ''),
                ...fields,
                record_date: UI.todayStr(),
                cargo_weight: Number(fields.cargo_weight),
                pieces_count: Number(fields.pieces_count),
                receipt_number: Number(fields.receipt_number),
                in_zone_time: null, out_zone_time: null, arrival_time: null, collected_money: 0,
              });
              UI.toast('دەرچوون بە سەرکەوتوویی تۆمار کرا 🚚', 'success');
              close();
              await load({ silent: true });
            } catch (err) {
              UI.toast('هەڵە لە تۆمارکردنی دەرچوون: ' + err.message, 'error', 4200);
            } finally {
              UI.btnLoading(submitBtn, false);
            }
          }
        },
      ],
    });
  }

  /* ---------------- مۆدالی پارەی هێنراوە ---------------- */

  function openMoneyModal(active) {
    const body = document.createElement('div');
    body.innerHTML = `
      <p class="confirm-msg">بڕی پارەی کۆمکراوی ئەم بارە بنووسە (بە دیناری عێراقی):</p>
      <div class="field">
        <label>پارەی هێنراوە</label>
        <input id="f-money" type="number" min="0" step="1" inputmode="numeric" value="${Number(active.collected_money || 0)}">
      </div>
      <p class="hint">ئەم نرخە بۆ باری «${UI.esc(CONFIG.CARGO_LABELS[cargoIndex(active)] || '')}» — ${UI.esc(active.zone || '')} تۆمار دەکرێت.</p>`;

    const { close } = UI.openModal({
      title: '💰 پارەی هێنراوە',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'پاشەکەوتکردن', className: 'btn-primary', onClick: async (backdrop) => {
            const saveBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const raw = UI.toLatinDigits($('#f-money', body).value.trim());
            const money = Number(raw);
            if (raw === '' || Number.isNaN(money) || money < 0) {
              UI.toast('تکایە بڕێکی ژمارەیی دروست بنووسە', 'warning');
              return;
            }
            UI.btnLoading(saveBtn, true, 'پاشەکەوت دەکرێت...');
            try {
              await API.Records.update(active.id, { collected_money: Math.round(money) });
              UI.toast('پارەی هێنراوە تۆمار کرا ✓', 'success');
              close();
              await load({ silent: true });
            } catch (err) {
              UI.toast('هەڵە لە تۆمارکردنی پارە: ' + err.message, 'error', 4200);
            } finally {
              UI.btnLoading(saveBtn, false);
            }
          }
        },
      ],
    });
    $('#f-money', body).focus();
  }

  /* ---------------- مۆدالی دەستکاریکردنی کاتەکان (تەنها ئەمڕۆ) ---------------- */

  function openEditTimesModal(rec) {
    if (!rec) return;
    if (rec.record_date !== UI.todayStr()) {
      UI.toast('ئاگاداری: تەنها دەستکاریکردنی کاتەکانی ئەمڕۆ ڕێگەپێدراوە', 'warning');
      return;
    }

    const body = document.createElement('div');
    body.innerHTML = `
      <p class="hint">دەتوانیت کاتەکانی ئەمڕۆی باری «${UI.esc(rec.zone || '')}» دەستکاری بکەیت، یان خانەیەک بەتاڵ بکەیتەوە ئەگەر پێویست بکات:</p>
      <form id="edit-times-form" novalidate>
        <div class="date-range-compact">
          <div class="field compact-field">
            <label>🚚 کاتی دەرچوون</label>
            <input type="time" id="f-rec-time" value="${rec.record_time || ''}">
          </div>
          <div class="field compact-field">
            <label>📍 کاتی ناو زۆن</label>
            <input type="time" id="f-in-zone" value="${rec.in_zone_time || ''}">
          </div>
        </div>
        <div class="date-range-compact">
          <div class="field compact-field">
            <label>🚏 کاتی دەرێی زۆن</label>
            <input type="time" id="f-out-zone" value="${rec.out_zone_time || ''}">
          </div>
          <div class="field compact-field">
            <label>🏁 کاتی گەشتنەوە</label>
            <input type="time" id="f-arrival" value="${rec.arrival_time || ''}">
          </div>
        </div>
      </form>`;

    const { close } = UI.openModal({
      title: '⏱️ دەستکاریکردنی کاتەکانی ئەمڕۆ',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'پاشەکەوتکردن',
          className: 'btn-primary',
          onClick: async (backdrop) => {
            const saveBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const val = id => $(id, body).value.trim() || null;
            const patch = {
              record_time: val('#f-rec-time'),
              in_zone_time: val('#f-in-zone'),
              out_zone_time: val('#f-out-zone'),
              arrival_time: val('#f-arrival'),
            };

            UI.btnLoading(saveBtn, true, 'پاشەکەوت دەکرێت...');
            try {
              await API.Records.update(rec.id, patch);
              UI.toast('کاتەکان بە سەرکەوتوویی نوێ کرانەوە ✓', 'success');
              close();
              await load({ silent: true });
            } catch (err) {
              UI.toast('هەڵە لە نوێکردنەوەی کاتەکان: ' + err.message, 'error', 4200);
            } finally {
              UI.btnLoading(saveBtn, false);
            }
          }
        }
      ]
    });
  }

  /* ---------------- کاتژمێر و تایمەرەکان ---------------- */

  let clockTimer = null;

  function startClock() {
    stopClock();
    clockTimer = setInterval(() => {
      const el = $('#drv-clock', container);
      if (el) el.textContent = UI.nowTime();
    }, 15000);
  }
  function stopClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }

  function start() {
    refreshTimer = setInterval(() => {
      if (!document.hidden && container && container.isConnected) load({ silent: true });
    }, CONFIG.DRIVER_REFRESH_SEC * 1000);
    countdownTimer = setInterval(() => {
      if (document.hidden || !container || !container.isConnected) return;
      const act = nextAction();
      if (act.type === 'wait') renderAction();
    }, 20000);
  }

  function stop() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    stopClock();
  }

  /* ---------------- ڕێندەری سەرەتایی ---------------- */

  function render(el) {
    container = el;
    load();
    start();
  }

  return { render, stop };
})();
