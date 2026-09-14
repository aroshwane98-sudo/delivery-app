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

  const isDistributor = () => App.getUser()?.profession === CONFIG.PROFESSION_DISTRIBUTOR;

  const isCargoTwoOrThree = driverName => {
    if (!driverName) return false;
    const n = UI.norm(driverName);
    return n.endsWith(' دوو') || n.endsWith(' سێ') || /\bدوو\b/.test(n) || /\bسێ\b/.test(n);
  };

  const driverBaseName = driverName => {
    return UI.norm(driverName).replace(/\s*(دوو|سێ)$/, '').trim();
  };

  const areDuplicateDepartures = (r1, r2) => {
    if (!r1 || !r2) return false;
    if (r1.id && r2.id && r1.id === r2.id) return false;
    if (r1.record_date !== r2.record_date) return false;

    // تەنها ئەوکاتە نەبێت ئەگەر نوسرابوو سایەق دوو واتا پاشگریی دووی لەگەڵبوو ئەوە مەسڕەوە
    if (isCargoTwoOrThree(r1.driver) || isCargoTwoOrThree(r2.driver)) {
      return false;
    }

    if (driverBaseName(r1.driver) !== driverBaseName(r2.driver)) return false;
    if (!UI.userMatches(r1.distributor, r2.distributor) && !UI.userMatches(r2.distributor, r1.distributor)) return false;
    if (UI.norm(r1.vehicle) !== UI.norm(r2.vehicle)) return false;

    const t1 = UI.timeToMinutes(r1.record_time);
    const t2 = UI.timeToMinutes(r2.record_time);
    if (t1 === null || t2 === null) return false;

    return Math.abs(t1 - t2) <= 10;
  };

  const cargoIndex = rec => {
    if (!rec || !rec.driver) return 0;
    if (rec.driver.endsWith(' دوو')) return 1;
    if (rec.driver.endsWith(' سێ')) return 2;
    return 0;
  };

  const activeRecord = () => records.find(r => !r.arrival_time) || null;

  /* ---------------- بارکردنی داتا ---------------- */

  async function load({ silent = false } = {}) {
    if (!silent) container.innerHTML = `<div class="skeleton-block"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-line"></div></div>`;
    try {
      const today = UI.todayStr();
      const u = App.getUser();
      const [ls, allToday] = await Promise.all([
        lists ? Promise.resolve(lists) : Store.loadLists(),
        API.Records.list({ 'record_date': `eq.${today}` }),
      ]);
      lists = ls;

      // سڕینەوەی دەرچوونی دووبارە لە هەمان ڕۆژ لە مەودای <= ١٠ خولەک (جگە لە سایەق دوو)
      const toDeleteIds = new Set();
      const rows = allToday || [];
      for (let i = 0; i < rows.length; i++) {
        const r1 = rows[i];
        if (toDeleteIds.has(r1.id)) continue;
        for (let j = i + 1; j < rows.length; j++) {
          const r2 = rows[j];
          if (toDeleteIds.has(r2.id)) continue;
          if (areDuplicateDepartures(r1, r2)) {
            const r1Progress = (r1.arrival_time ? 4 : (r1.out_zone_time ? 3 : (r1.in_zone_time ? 2 : 1)));
            const r2Progress = (r2.arrival_time ? 4 : (r2.out_zone_time ? 3 : (r2.in_zone_time ? 2 : 1)));
            const dupToRemove = r2Progress > r1Progress ? r1 : r2;
            toDeleteIds.add(dupToRemove.id);
            API.Records.remove(dupToRemove.id).catch(e => console.warn('هەڵە لە سڕینەوەی تۆماری دووبارە:', e));
          }
        }
      }

      const cleanedToday = rows.filter(r => !toDeleteIds.has(r.id));
      if (toDeleteIds.size > 0 && !silent) {
        UI.toast('دەرچوونی دووبارەی هەمان گەشت لە سیستەمدا بە خۆکاری سڕدرایەوە ✓', 'info', 4000);
      }

      // هاوتاکردنی پێشاندانی دەرچوون بۆ هەردوو پیشەی سایەق و دابەشکار
      if (isDistributor()) {
        records = cleanedToday.filter(r => UI.userMatches(r.distributor, u.username));
      } else {
        records = cleanedToday.filter(r => UI.userMatches(r.driver, u.username));
      }
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

    const unrecordedTrips = records.filter(r => r.arrival_time && (!r.collected_money || Number(r.collected_money) === 0));
    const roleClass = { [CONFIG.PROFESSION_DRIVER]: 'chip-driver', [CONFIG.PROFESSION_DISTRIBUTOR]: 'chip-dist', [CONFIG.PROFESSION_DELEGATE]: 'chip-del', [CONFIG.PROFESSION_SUPERVISOR]: 'chip-sup' };
    const u = App.getUser();
    const today = UI.todayStr();

    container.innerHTML = `
      <section class="card hero-card">
        <div class="hero-top">
          <div>
            <h2 class="hero-title">📅 ${UI.weekdayKu(new Date(today + 'T00:00:00'))}</h2>
            <p class="hero-sub"><span class="chip ${roleClass[u?.profession] || ''}" dir="ltr">${today}</span></p>
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

      ${unrecordedTrips.length ? `
        <button type="button" class="btn btn-primary btn-alert-record-money" data-id="${unrecordedTrips[0].id}">💰 تۆمارکردنی پارە${unrecordedTrips.length > 1 ? ` — ${UI.toLatinDigits(unrecordedTrips.length)} بار` : ''}</button>` : ''}

      <div id="drv-active"></div>
      <div id="drv-action"></div>
      <div id="drv-history"></div>`;

    renderActive(active);
    renderAction();
    renderHistory();

    $('#drv-refresh', container).addEventListener('click', () => load());
    container.querySelectorAll('.btn-alert-record-money').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const r = records.find(x => x.id === id);
        if (r) openMoneyModal(r);
      });
    });
    startClock();
  }

  function renderActive(active) {
    const el = $('#drv-active', container);
    if (!active) {
      el.innerHTML = `
        <div class="card idle-card">
          <div class="idle-ico"></div>
          <p>${records.length ? 'هیچ باری چالاکێک نییە — لە خوارەوە بارێکی نوێ دەست پێبکە.' : ' هیچ بارێک تۆمار نەکراوە   .'}</p>
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
          <div class="detail"><span>شۆفێر</span><b>${UI.esc(active.driver || '—')}</b></div>
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
          <span class="money-edit">${Number(active.collected_money || 0) > 0 ? 'دەستکاری' : '➕ تۆمارکردن'}</span>
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
      ${done.map(r => {
        const hasMoney = Number(r.collected_money || 0) > 0;
        return `
        <div class="card hist-card clickable-row" data-id="${r.id}">
          <div class="hist-top">
            <b>${UI.esc(CONFIG.CARGO_LABELS[cargoIndex(r)] || 'بار')} — ${UI.esc(r.zone || '—')}</b>
            <div style="display:flex;align-items:center;gap:6px">
              <button type="button" class="btn-edit-times btn-hist-edit" data-id="${r.id}" title="دەستکاری کاتەکانی ئەم بارە">⏱️ دەستکاری کاتەکان</button>
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
            <span>سەیارە: <b>${UI.esc(r.vehicle || '—')}</b></span>
          </div>

          <!-- بەشی پارەی هێنراوە — دوای گەشتنەوەش لەهەمان ڕۆژ قفڵ نابێت -->
          <div class="hist-money-row ${!hasMoney ? 'pending' : ''}">
            <div class="hist-money-info">
              <span class="muted" style="font-size:0.82rem">💰 پارەی هێنراوە:</span>
              <b class="money-val" style="font-size:1.02rem">${UI.fmtMoney(r.collected_money)}</b>
              ${!hasMoney 
                ? `<span class="badge-unrecorded">⚠️ تۆمار نەکراوە</span>` 
                : `<span class="badge-recorded">✓ تۆمارکراوە</span>`}
            </div>
            <button type="button" class="btn-hist-money ${!hasMoney ? 'pulse-btn' : ''}" data-id="${r.id}" title="تۆمارکردن یان دەستکاریکردنی پارەی ئەم بارە">
              ${!hasMoney ? '➕ تۆمارکردنی پارە' : '✏️ دەستکاری پارە'}
            </button>
          </div>
        </div>`;
      }).join('')}`;

    el.querySelectorAll('.hist-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        if (Store.getSettings().rowClickFullscreen !== false) {
          const id = Number(card.dataset.id);
          const r = records.find(x => x.id === id);
          if (r) UI.openRecordFullscreen(r);
        }
      });
    });

    el.querySelectorAll('.btn-hist-edit').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(b.dataset.id);
        const r = records.find(x => x.id === id);
        if (r) openEditTimesModal(r);
      });
    });

    el.querySelectorAll('.btn-hist-money').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(b.dataset.id);
        const r = records.find(x => x.id === id);
        if (r) openMoneyModal(r);
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
    const u = App.getUser();
    const distrib = isDistributor();

    const distributors = (lists?.users || []).filter(x => x.profession === CONFIG.PROFESSION_DISTRIBUTOR).map(x => ({ label: x.username }));
    const drivers     = (lists?.users || []).filter(x => x.profession === CONFIG.PROFESSION_DRIVER).map(x => ({ label: x.username }));
    const delegates   = (lists?.users || []).filter(x => x.profession === CONFIG.PROFESSION_DELEGATE).map(x => ({ label: x.username }));
    const zones       = (lists?.zones || []).map(z => ({ label: z.name }));
    const vehicles    = (lists?.vehicles || []).map(v => {
      const val = v.vehicle_number || v.plate_number || v.number || v.name || v.vehicle || v.plate || Object.values(v)[1] || Object.values(v)[0];
      return { label: String(val).trim() };
    }).filter(v => v.label && v.label !== '[object Object]');

    const count = records.length;
    const cargoLabel = CONFIG.CARGO_LABELS[count] || 'باری نوێ';

    const body = document.createElement('div');
    body.innerHTML = `
      <form id="exit-form" novalidate>
        ${distrib
          ? `<div class="field"><label>ناوی شۆفێر *</label><input id="f-driver-pick" type="text" placeholder="هەڵبژێرە یان بنووسە"></div>
             <div class="field">
               <div class="field-label-row">
                 <label>دابەشکار *</label>
                 <button type="button" class="btn-field-add" id="btn-toggle-distrib2" title="زیادکردنی دابەشکاری دووەم">⊞</button>
               </div>
               <input id="f-distributor" type="text" value="${UI.esc(u.username)}" readonly style="background:var(--bg-2,#f5f5f5);color:var(--text-muted,#888)">
             </div>`
          : `<div class="field">
               <div class="field-label-row">
                 <label>ناوی دابەشکار *</label>
                 <button type="button" class="btn-field-add" id="btn-toggle-distrib2" title="زیادکردنی دابەشکاری دووەم">⊞</button>
               </div>
               <input id="f-distributor" type="text" placeholder="هەڵبژێرە یان بنووسە">
             </div>`
        }
        <div class="field field-second" id="wrap-distrib2" style="display:none">
          <label>دابەشکاری دووەم</label>
          <input id="f-distributor-2" type="text" placeholder="هەڵبژێرە یان بنووسە">
        </div>

        <div class="field">
          <div class="field-label-row">
            <label>ناوی مەندوب *</label>
            <button type="button" class="btn-field-add" id="btn-toggle-delegate2" title="زیادکردنی مەندوبی دووەم">⊞</button>
          </div>
          <input id="f-delegate" type="text" placeholder="هەڵبژێرە یان بنووسە">
        </div>
        <div class="field field-second" id="wrap-delegate2" style="display:none">
          <label>مەندوبی دووەم</label>
          <input id="f-delegate-2" type="text" placeholder="هەڵبژێرە یان بنووسە">
        </div>

        <div class="field">
          <div class="field-label-row">
            <label>ناوچە / زۆن *</label>
            <button type="button" class="btn-field-add" id="btn-toggle-zone2" title="زیادکردنی زۆنی دووەم">⊞</button>
          </div>
          <input id="f-zone" type="text" placeholder="هەڵبژێرە یان بنووسە">
        </div>
        <div class="field field-second" id="wrap-zone2" style="display:none">
          <label>ناوچە / زۆنی دووەم</label>
          <input id="f-zone-2" type="text" placeholder="هەڵبژێرە یان بنووسە">
        </div>

        <div class="field-row">
          <div class="field"><label>ژمارەی سەیارە *</label><input id="f-vehicle" type="text" placeholder="هەڵبژێرە یان بنووسە"></div>
          <div class="field"><label>کاتی دەرچوون *</label><input id="f-time" type="time" value="${UI.nowTime()}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>کێشی بار (کگم) *</label><input id="f-weight" type="number" min="0" step="any" placeholder="0"></div>
          <div class="field"><label>ژمارەی پارچەکان *</label><input id="f-pieces" type="number" min="0" step="1" placeholder="0"></div>
        </div>
        <div class="field"><label>ژمارەی وەسڵ *</label><input id="f-receipt" type="number" min="0" step="1" placeholder="0"></div>
      </form>`;

    if (distrib) {
      UI.autocomplete($('#f-driver-pick', body), () => drivers);
    } else {
      UI.autocomplete($('#f-distributor', body), () => distributors);
    }
    UI.autocomplete($('#f-distributor-2', body), () => distributors);
    UI.autocomplete($('#f-delegate', body), () => delegates);
    UI.autocomplete($('#f-delegate-2', body), () => delegates);
    UI.autocomplete($('#f-zone', body), () => zones);
    UI.autocomplete($('#f-zone-2', body), () => zones);
    UI.autocomplete($('#f-vehicle', body), () => vehicles);

    const setupToggle = (btnId, wrapId, inputId) => {
      const btn = $(btnId, body);
      const wrap = $(wrapId, body);
      const inp = $(inputId, body);
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
    setupToggle('#btn-toggle-distrib2', '#wrap-distrib2', '#f-distributor-2');
    setupToggle('#btn-toggle-delegate2', '#wrap-delegate2', '#f-delegate-2');
    setupToggle('#btn-toggle-zone2', '#wrap-zone2', '#f-zone-2');

    const { close } = UI.openModal({
      title: `🚚 تۆمارکردنی دەرچوون — ${cargoLabel}`,
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'تۆمارکردن', className: 'btn-primary', onClick: async (backdrop) => {
            const submitBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const val = id => $(id, body)?.value.trim() || '';

            const driverBase     = distrib ? val('#f-driver-pick') : u.username;
            const dist1          = distrib ? u.username : val('#f-distributor');
            const dist2          = val('#f-distributor-2');
            const finalDistrib   = dist2 ? `${dist1} و ${dist2}` : dist1;

            const del1           = val('#f-delegate');
            const del2           = val('#f-delegate-2');
            const finalDelegate  = del2 ? `${del1} و ${del2}` : del1;

            const z1             = val('#f-zone');
            const z2             = val('#f-zone-2');
            const finalZone      = z2 ? `${z1} و ${z2}` : z1;

            const fields = {
              distributor:    finalDistrib,
              delegate:       finalDelegate,
              zone:           finalZone,
              vehicle:        val('#f-vehicle'),
              record_time:    val('#f-time'),
              cargo_weight:   val('#f-weight'),
              pieces_count:   val('#f-pieces'),
              receipt_number: val('#f-receipt'),
            };

            const missingDriver = distrib && !driverBase;
            const missing = Object.entries(fields).filter(([k, v]) => {
              if (k === 'distributor' && !dist1) return true;
              if (k === 'delegate' && !del1) return true;
              if (k === 'zone' && !z1) return true;
              return v === '';
            });

            if (missingDriver || missing.length) {
              UI.toast('تکایە هەموو خانە سەرەکییەکان پڕ بکەرەوە', 'warning');
              if (missingDriver) $('#f-driver-pick', body)?.classList.add('invalid');
              missing.forEach(([k]) => {
                const map = {
                  distributor: distrib ? null : '#f-distributor',
                  delegate: '#f-delegate', zone: '#f-zone', vehicle: '#f-vehicle',
                  record_time: '#f-time', cargo_weight: '#f-weight',
                  pieces_count: '#f-pieces', receipt_number: '#f-receipt',
                };
                if (map[k]) $(map[k], body)?.classList.add('invalid');
              });
              return;
            }

            // پشکنینی دەرچوونی دووبارە لە هەمان ڕۆژ پێش ناردن
            const candidateRecord = {
              record_date: UI.todayStr(),
              driver: driverBase,
              distributor: finalDistrib,
              vehicle: fields.vehicle,
              record_time: fields.record_time,
            };
            const hasDuplicate = records.some(r => areDuplicateDepartures(r, candidateRecord));
            if (hasDuplicate) {
              UI.toast('ئەم دەرچوونە پێشتر لە ئەمڕۆدا بە هەمان زانیاری لەم ماوەیەدا تۆمارکراوە! بۆ ڕێگری لە دووبارەبوونەوە دووبارە تۆمار نەکرا.', 'warning', 5000);
              close();
              await load({ silent: true });
              return;
            }

            // دیاریکردنی بارەکانی شۆفێر بۆ باری یەکەم/دووەم/سێیەم
            const driverTodayTrips = records.filter(r => UI.userMatches(r.driver, driverBase));
            const finalCargoIndex = distrib ? driverTodayTrips.length : count;
            const suffix = CONFIG.CARGO_SUFFIXES[finalCargoIndex] || '';

            UI.btnLoading(submitBtn, true, 'تۆمار دەکرێت...');
            try {
              await API.Records.insert({
                driver: driverBase + suffix,
                ...fields,
                record_date:    UI.todayStr(),
                cargo_weight:   Number(fields.cargo_weight),
                pieces_count:   Number(fields.pieces_count),
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
