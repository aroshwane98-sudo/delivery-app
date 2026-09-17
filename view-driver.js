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

  // لابردنی نیشانەی دەستکاریکردن (+) لە کۆتایی ناو بۆ ئەوەی حساباتەکان نشکن
  const stripEditMark = name => String(name || '').replace(/\s*\+\s*$/, '').trim();

  const isCargoTwoOrThree = driverName => {
    if (!driverName) return false;
    const n = UI.norm(stripEditMark(driverName));
    return n.endsWith(' دوو') || n.endsWith(' سێ') || /\bدوو\b/.test(n) || /\bسێ\b/.test(n);
  };

  const driverBaseName = driverName => {
    return UI.norm(stripEditMark(driverName)).replace(/\s*(دوو|سێ)$/, '').trim();
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
    const drv = stripEditMark(rec && rec.driver);
    if (!drv) return 0;
    if (drv.endsWith(' دوو')) return 1;
    if (drv.endsWith(' سێ')) return 2;
    return 0;
  };

  const activeRecord = () => records.find(r => !r.arrival_time) || null;

  /* ---------------- دوگمەی ⊞ — زیادکردنی خانەی دووەم (هاوبەش لە نێوان فۆڕمی دەرچوون و دەستکاری) ---------------- */

  const setupSecondFieldToggle = (root, btnId, wrapId, inputId) => {
    const btn = $(btnId, root);
    const wrap = $(wrapId, root);
    const inp = $(inputId, root);
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

  /* ---------------- نیشانەی گۆڕانکاری (^) — تەنها بۆ بەڕێوەبەر ---------------- */

  const MARKS_KEY = 'drv_edit_marks';
  const isSupervisor = () => App.getUser()?.profession === CONFIG.PROFESSION_SUPERVISOR;

  const loadMarks = () => {
    try { return JSON.parse(localStorage.getItem(MARKS_KEY)) || {}; } catch (_) { return {}; }
  };
  const saveMarks = m => { try { localStorage.setItem(MARKS_KEY, JSON.stringify(m)); } catch (_) {} };

  // ناسنامەی جێگیر بۆ تۆمارەکە (id دەگۆڕێت کاتێک update بە INSERT/DELETE جێبەجێ دەبێت)
  const recSig = r => `${r.record_date}|${stripEditMark(r.driver)}|${r.record_time}`;

  function addEditMarks(rec, fields) {
    if (!rec || !fields.length) return;
    const u = App.getUser()?.username || 'نەزانیرا';
    const marks = loadMarks();
    const sig = recSig(rec);
    const m = marks[sig] || {};
    fields.forEach(f => { m[f] = u; });
    marks[sig] = m;
    saveMarks(marks);
  }

  // نیشانەی ^ لەتەنیشت خانە گۆڕدراوەکان — تەنها بەڕێوەبەر دەیبینێت
  const markHtml = (rec, field) => {
    if (!isSupervisor() || !rec) return '';
    const m = loadMarks()[recSig(rec)];
    if (!m || !m[field]) return '';
    return ` <sup class="edit-mark" title="دەستکاریکراوە لەلایەن ${UI.esc(m[field])}">^</sup>`;
  };

  /* ---------------- بارکردنی داتا ---------------- */

  async function load({ silent = false } = {}) {
    // ئەگەر پەڕەی کارەکان ڕێندەر نەکرابێت (بۆ نموونە بانگکردنەوە لە پانێلی بەڕێوەبردن)،
    // هیچ ڕێندەرێک مەکە — تەنها داتاکان نوێ بکەرەوە بۆ بەکارهێنانی مۆدالی دەستکاری
    if (!container || !container.isConnected) return;
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
      checkPendingLockAction();
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

    container.innerHTML = `
      <div id="drv-active"></div>
      <div id="drv-action"></div>
      <div id="drv-history"></div>`;

    renderActive(active);
    renderAction();
    renderHistory();
    syncLockScreenNotification(active);
  }

  function renderActive(active) {
    const el = $('#drv-active', container);
    if (!active) {
      // ویندۆی «هیچ بارێکی چالاک نییە» بەتەواوی لابراوە
      el.innerHTML = '';
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
          <span class="zone-chip">🗺 ${UI.esc(active.zone || '—')}${markHtml(active, 'zone')}</span>
        </div>
        <div class="active-time-edit-bar">
          <button type="button" class="btn-edit-times btn-edit-big" id="active-edit-times-btn">✏️ دەستکاری داتا</button>
        </div>
        <div class="stepper">${stepsHtml}</div>
        <div class="detail-grid">
          <div class="detail"><span>شۆفێر</span><b>${UI.esc(active.driver || '—')}${markHtml(active, 'driver')}</b></div>
          <div class="detail"><span>دابەشکار</span><b>${UI.esc(active.distributor || '—')}${markHtml(active, 'distributor')}</b></div>
          <div class="detail"><span>مەندوب</span><b>${UI.esc(active.delegate || '—')}${markHtml(active, 'delegate')}</b></div>
          <div class="detail"><span>ژمارەی سەیارە</span><b>${UI.esc(active.vehicle || '—')}${markHtml(active, 'vehicle')}</b></div>
          <div class="detail"><span>کێشی بار</span><b>${UI.fmtNum(active.cargo_weight)} کگم${markHtml(active, 'cargo_weight')}</b></div>
          <div class="detail"><span>پارچەکان</span><b>${UI.fmtNum(active.pieces_count)}${markHtml(active, 'pieces_count')}</b></div>
          <div class="detail"><span>وەسڵ</span><b>${UI.fmtNum(active.receipt_number)}${markHtml(active, 'receipt_number')}</b></div>
          <div class="detail"><span>پارەی هێنراوە</span><b class="money-val">${UI.fmtMoney(active.collected_money)}${markHtml(active, 'collected_money')}</b></div>
        </div>
        ${active.arrival_time && !(Number(active.collected_money || 0) > 0) ? `
        <button class="money-row" id="money-btn" type="button">
          <span class="money-lbl">💰 پارەی هێنراوە</span>
          <b class="money-val">—</b>
          <span class="money-edit">➕ تۆمارکردن</span>
        </button>` : ''}
      </section>`;
    $('#money-btn', el)?.addEventListener('click', () => openMoneyModal(active));
    $('#active-edit-times-btn', el)?.addEventListener('click', () => openEditDataModal(active));
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
              <button type="button" class="btn-edit-times btn-edit-big btn-hist-edit" data-id="${r.id}" title="دەستکاریکردنی داتا و پارەی ئەم بارە">✏️ دەستکاری داتا</button>
            </div>
          </div>
          <div class="hist-meta">
            <span>🚚 ${UI.esc(r.record_time || '—')}${markHtml(r, 'record_time')}</span>
            <span>📍 ${UI.esc(r.in_zone_time || '—')}${markHtml(r, 'in_zone_time')}</span>
            <span>🚏 ${UI.esc(r.out_zone_time || '—')}${markHtml(r, 'out_zone_time')}</span>
            <span>🏁 ${UI.esc(r.arrival_time || '—')}${markHtml(r, 'arrival_time')}</span>
          </div>
          <div class="hist-foot">
            <span>${UI.fmtNum(r.cargo_weight)} کگم${markHtml(r, 'cargo_weight')} • ${UI.fmtNum(r.pieces_count)} پارچە${markHtml(r, 'pieces_count')} • ${UI.fmtNum(r.receipt_number)} وەسڵ${markHtml(r, 'receipt_number')}</span>
            <span>سەیارە: <b>${UI.esc(r.vehicle || '—')}${markHtml(r, 'vehicle')}</b></span>
          </div>

          <!-- بەشی پارەی هێنراوە — دوگمەکە تەنها کاتێک دەردەکەوێت کە پارە تۆمار نەکرابێت -->
          <div class="hist-money-row ${!hasMoney ? 'pending' : ''}">
            <div class="hist-money-info">
              <span class="muted" style="font-size:0.82rem">💰 پارەی هێنراوە:</span>
              <b class="money-val" style="font-size:1.02rem">${UI.fmtMoney(r.collected_money)}</b>
              ${!hasMoney
                ? `<span class="badge-unrecorded">⚠️ تۆمار نەکراوە</span>`
                : `<span class="badge-recorded">✓ تۆمارکراوە</span>`}
            </div>
            ${!hasMoney ? `<button type="button" class="btn-hist-money pulse-btn" data-id="${r.id}" title="تۆمارکردنی پارەی ئەم بارە">➕ تۆمارکردنی پارە</button>` : ''}
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
        if (r) openEditDataModal(r);
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

    const actBtn = container ? $('#act-btn', container) : null;
    if (actBtn) UI.btnLoading(actBtn, true, 'تۆمار دەکرێت...');
    try {
      await API.Records.update(active.id, { [field]: UI.nowTime() });
      UI.toast(`${label} بە سەرکەوتوویی تۆمار کرا ✓`, 'success');
      await load({ silent: true });
    } catch (err) {
      UI.toast('هەڵە لە تۆمارکردن: ' + err.message, 'error', 4200);
    } finally {
      if (actBtn) UI.btnLoading(actBtn, false);
    }
  }

  /* ---------------- کردارەکانی سەر شاشەی قفڵ (Lock Screen Notification) ---------------- */

  async function syncLockScreenNotification(active) {
    const s = Store.getSettings();
    if (!s.lockScreenActions) {
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.getNotifications({ tag: 'active-trip-lockscreen' }).then(ns => ns.forEach(n => n.close())).catch(() => {});
        }).catch(() => {});
      }
      return;
    }

    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;

    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg) return;

      if (!active || active.arrival_time) {
        const notifs = await reg.getNotifications({ tag: 'active-trip-lockscreen' });
        notifs.forEach(n => n.close());
        return;
      }

      let nextStage = null;
      let nextLabel = '';
      let nextActionTitle = '';
      let stageIcon = '';

      if (!active.in_zone_time) {
        nextStage = 'in_zone';
        nextLabel = 'لە ڕێگادایت بەرەو ناو زۆن';
        nextActionTitle = '📍 گەیشتمە ناو زۆن';
        stageIcon = '📍';
      } else if (!active.out_zone_time) {
        nextStage = 'out_zone';
        nextLabel = 'لە ناو زۆندایت؛ کاتی دەرچوون لە زۆن تۆمار بکە';
        nextActionTitle = '🚏 دەرچوون لە زۆن';
        stageIcon = '🚏';
      } else if (!active.arrival_time) {
        nextStage = 'arrival';
        nextLabel = 'لە ڕێگای گەڕانەوەدایت بەرەو کۆگا';
        nextActionTitle = '🏁 گەیشتمەوە بۆ خاڵی دەستپێک';
        stageIcon = '🏁';
      }

      if (!nextStage) {
        const notifs = await reg.getNotifications({ tag: 'active-trip-lockscreen' });
        notifs.forEach(n => n.close());
        return;
      }

      const title = `${stageIcon} گەیاندن — ${active.zone || 'زۆن'}`;
      const body = `${nextLabel}\n🚚 ${active.vehicle || '—'} • کاتی دەرچوون: ${active.record_time || '—'}`;

      await reg.showNotification(title, {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'active-trip-lockscreen',
        renotify: true,
        requireInteraction: true,
        silent: false,
        actions: [
          {
            action: nextStage,
            title: nextActionTitle
          }
        ],
        data: {
          recordId: active.id,
          stage: nextStage
        }
      });
    } catch (err) {
      console.warn('syncLockScreenNotification error:', err);
    }
  }

  let pendingLockActionHandled = false;
  function checkPendingLockAction() {
    if (pendingLockActionHandled) return;
    const urlParams = new URLSearchParams(window.location.search);
    const lockAction = urlParams.get('lock_action');
    if (lockAction && ['in_zone', 'out_zone', 'arrival'].includes(lockAction)) {
      pendingLockActionHandled = true;
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => {
        doStage(lockAction);
      }, 300);
    }
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'LOCKSCREEN_ACTION') {
        const act = event.data.action;
        if (['in_zone', 'out_zone', 'arrival'].includes(act)) {
          doStage(act);
        }
      }
    });
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
          <div class="field"><label>کێشی بار (کگم) *</label><input id="f-weight" type="number" min="0" step="1" placeholder="0"></div>
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

    setupSecondFieldToggle(body, '#btn-toggle-distrib2', '#wrap-distrib2', '#f-distributor-2');
    setupSecondFieldToggle(body, '#btn-toggle-delegate2', '#wrap-delegate2', '#f-delegate-2');
    setupSecondFieldToggle(body, '#btn-toggle-zone2', '#wrap-zone2', '#f-zone-2');

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
                cargo_weight:   UI.cleanInt(fields.cargo_weight),
                pieces_count:   UI.cleanInt(fields.pieces_count),
                receipt_number: UI.cleanInt(fields.receipt_number),
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

  /* ---------------- مۆدالی پارەی هێنراوە — دوگمەی جیاوە، دوای تۆمارکردن ون دەبێت ---------------- */

  function openMoneyModal(active) {
    const body = document.createElement('div');
    body.innerHTML = `
      <p class="confirm-msg">بڕی پارەی کۆمکراوی ئەم بارە بنووسە (بە دیناری عێراقی):</p>
      <div class="field">
        <label>پارەی هێنراوە</label>
        <input id="f-money" type="number" min="0" step="1" inputmode="numeric" value="" placeholder="بڕی پارە بنووسە (د.ع)">
      </div>`;

    const { close } = UI.openModal({
      title: '💰 پارەی هێنراوە',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'پاشەکەوتکردن', className: 'btn-primary', onClick: async (backdrop) => {
            const saveBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const raw = $('#f-money', body).value.trim();
            if (raw === '') {
              UI.toast('تکایە بڕێکی ژمارەیی دروست بنووسە', 'warning');
              return;
            }
            const money = UI.cleanInt(raw);
            if (Number.isNaN(money) || money < 0) {
              UI.toast('تکایە بڕێکی ژمارەیی دروست بنووسە', 'warning');
              return;
            }
            UI.btnLoading(saveBtn, true, 'پاشەکەوت دەکرێت...');
            try {
              await API.Records.update(active.id, { collected_money: money });
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

  /* ---------------- مۆدالی دەستکاریکردنی داتا — هەمان فۆرماتی تۆمارکردنی دەرچوون ---------------- */

  async function openEditDataModal(rec, options = {}) {
    if (!rec) return;
    const u = App.getUser();
    const sup = isSupervisor();
    if (!sup && rec.record_date !== UI.todayStr()) {
      UI.toast('ئاگاداری: تەنها دەستکاریکردنی داتای ئەمڕۆ ڕێگەپێدراوە', 'warning');
      return;
    }

    if (!lists) {
      try { lists = await Store.loadLists(); } catch (_) { lists = { users: [], zones: [], vehicles: [] }; }
    }

    const distrib = isDistributor();
    const listsNow = lists || { users: [], zones: [], vehicles: [] };
    const distributors = (listsNow.users || []).filter(x => x.profession === CONFIG.PROFESSION_DISTRIBUTOR).map(x => ({ label: x.username }));
    const driversList  = (listsNow.users || []).filter(x => x.profession === CONFIG.PROFESSION_DRIVER).map(x => ({ label: x.username }));
    const delegates    = (listsNow.users || []).filter(x => x.profession === CONFIG.PROFESSION_DELEGATE).map(x => ({ label: x.username }));
    const zones        = (listsNow.zones || []).map(z => ({ label: z.name }));
    const vehicles     = (listsNow.vehicles || []).map(v => {
      const val = v.vehicle_number || v.plate_number || v.number || v.name || v.vehicle || v.plate || Object.values(v)[1] || Object.values(v)[0];
      return { label: String(val).trim() };
    }).filter(v => v.label && v.label !== '[object Object]');

    // دیاریکردنی خانەی ناوی خۆی — قفڵ دەکرێت وەک فۆڕمی تۆمارکردنی دەرچوون (تەنها بۆ شۆفێر/دابەشکار، نەک بەڕێوەبەر)
    let selfField = null;
    if (!sup) {
      if (UI.userMatches(rec.driver, u?.username) && !isDistributor()) selfField = 'driver';
      else if (UI.userMatches(rec.distributor, u?.username)) selfField = 'distributor';
      else if (UI.userMatches(rec.delegate, u?.username)) selfField = 'delegate';
    }

    // جیاکردنەوەی بەهای «X و Y» بۆ یەکەم + دووەم — وەک فۆڕمی دەرچوون.
    // ئەگەر یەکێک لە بەشەکان ناوی خۆی بێت، ناوی خۆی دەبێتە پێشەوە (چونکە خانە قفڵە)
    const splitCombined = (value, selfName) => {
      const raw = stripEditMark(value);
      const parts = String(raw || '').split(/\s+و\s+/).filter(Boolean);
      if (parts.length <= 1) return { first: raw || '', second: '' };
      if (selfName) {
        const idx = parts.findIndex(p => UI.userMatches(p, selfName));
        if (idx > 0) {
          const me = parts.splice(idx, 1)[0];
          return { first: me, second: parts.join(' و ') };
        }
        if (idx === -1) return { first: parts.join(' و '), second: '' };
      }
      return { first: parts[0], second: parts.slice(1).join(' و ') };
    };

    const distParts = splitCombined(rec.distributor, selfField === 'distributor' ? u?.username : null);
    const delParts  = splitCombined(rec.delegate, selfField === 'delegate' ? u?.username : null);
    const zoneParts = splitCombined(rec.zone, null);

    const lockStyle = 'readonly style="background:var(--bg-2,#f5f5f5);color:var(--text-muted,#888);cursor:not-allowed"';
    const secAttrs = p => p.second ? '' : 'style="display:none"';

    const body = document.createElement('div');
    body.innerHTML = `
      <p class="hint">${sup ? `دەتوانیت کات و زانیارییەکانی باری «${UI.esc(rec.zone || '')}» دەستکاری بکەیت:` : `دەتوانیت کات و زانیارییەکانی ئەمڕۆی باری «${UI.esc(rec.zone || '')}» دەستکاری بکەیت. خانەی ناوی خۆت قفڵە و کاتەکان دەتوانیت بەتاڵیان بکەیتەوە:`}</p>
      <form id="edit-times-form" novalidate>
        ${(distrib || sup)
          ? `<div class="field"><label>ناوی شۆفێر *</label><input id="f-driver-pick" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(stripEditMark(rec.driver || ''))}"></div>`
          : `<div class="field"><label>شۆفێر *</label><input id="f-driver-locked" type="text" value="${UI.esc(stripEditMark(rec.driver || ''))}" ${lockStyle}></div>`
        }

        <div class="field">
          <div class="field-label-row">
            <label>${distrib ? 'دابەشکار *' : 'ناوی دابەشکار *'}</label>
            <button type="button" class="btn-field-add ${distParts.second ? 'active' : ''}" id="btn-toggle-distrib2" title="زیادکردنی دابەشکاری دووەم">${distParts.second ? '✕' : '⊞'}</button>
          </div>
          <input id="f-distributor" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(distParts.first)}" ${selfField === 'distributor' ? lockStyle : ''}>
        </div>
        <div class="field field-second" id="wrap-distrib2" ${secAttrs(distParts)}>
          <label>دابەشکاری دووەم</label>
          <input id="f-distributor-2" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(distParts.second)}">
        </div>

        <div class="field">
          <div class="field-label-row">
            <label>ناوی مەندوب *</label>
            <button type="button" class="btn-field-add ${delParts.second ? 'active' : ''}" id="btn-toggle-delegate2" title="زیادکردنی مەندوبی دووەم">${delParts.second ? '✕' : '⊞'}</button>
          </div>
          <input id="f-delegate" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(delParts.first)}" ${selfField === 'delegate' ? lockStyle : ''}>
        </div>
        <div class="field field-second" id="wrap-delegate2" ${secAttrs(delParts)}>
          <label>مەندوبی دووەم</label>
          <input id="f-delegate-2" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(delParts.second)}">
        </div>

        <div class="field">
          <div class="field-label-row">
            <label>ناوچە / زۆن *</label>
            <button type="button" class="btn-field-add ${zoneParts.second ? 'active' : ''}" id="btn-toggle-zone2" title="زیادکردنی زۆنی دووەم">${zoneParts.second ? '✕' : '⊞'}</button>
          </div>
          <input id="f-zone" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(zoneParts.first)}">
        </div>
        <div class="field field-second" id="wrap-zone2" ${secAttrs(zoneParts)}>
          <label>ناوچە / زۆنی دووەم</label>
          <input id="f-zone-2" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(zoneParts.second)}">
        </div>

        <div class="field-row">
          <div class="field"><label>ژمارەی سەیارە *</label><input id="f-vehicle" type="text" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(rec.vehicle || '')}"></div>
          <div class="field"><label>کاتی دەرچوون *</label><input id="f-time" type="time" value="${rec.record_time || ''}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>کێشی بار (کگم) *</label><input id="f-weight" type="number" min="0" step="1" value="${UI.cleanInt(rec.cargo_weight)}"></div>
          <div class="field"><label>ژمارەی پارچەکان *</label><input id="f-pieces" type="number" min="0" step="1" value="${UI.cleanInt(rec.pieces_count)}"></div>
        </div>
        <div class="field"><label>ژمارەی وەسڵ *</label><input id="f-receipt" type="number" min="0" step="1" value="${UI.cleanInt(rec.receipt_number)}"></div>
        <div class="field"><label>💰 پارەی هێنراوە (د.ع)</label><input id="f-money" type="number" min="0" step="1" inputmode="numeric" value="${Number(rec.collected_money || 0) > 0 ? UI.cleanInt(rec.collected_money) : ''}" placeholder="بەتاڵ = تۆمار نەکراوە"></div>

        <div class="date-range-compact" style="margin-top:10px">
          <div class="field compact-field"><label>📍 کاتی ناو زۆن</label><input type="time" id="f-in-zone" value="${rec.in_zone_time || ''}"></div>
          <div class="field compact-field"><label>🚏 کاتی دەرێی زۆن</label><input type="time" id="f-out-zone" value="${rec.out_zone_time || ''}"></div>
        </div>
        <div class="date-range-compact">
          <div class="field compact-field"><label>🏁 کاتی گەشتنەوە</label><input type="time" id="f-arrival" value="${rec.arrival_time || ''}"></div>
          <div class="field compact-field"></div>
        </div>
      </form>`;

    // ئۆتۆکۆمپلیت — هەمان لیستی فۆڕمی تۆمارکردنی دەرچوون
    if (distrib || sup) {
      UI.autocomplete($('#f-driver-pick', body), () => driversList);
    }
    if (selfField !== 'distributor') {
      UI.autocomplete($('#f-distributor', body), () => distributors);
    }
    UI.autocomplete($('#f-distributor-2', body), () => distributors);
    if (selfField !== 'delegate') {
      UI.autocomplete($('#f-delegate', body), () => delegates);
    }
    UI.autocomplete($('#f-delegate-2', body), () => delegates);
    UI.autocomplete($('#f-zone', body), () => zones);
    UI.autocomplete($('#f-zone-2', body), () => zones);
    UI.autocomplete($('#f-vehicle', body), () => vehicles);

    setupSecondFieldToggle(body, '#btn-toggle-distrib2', '#wrap-distrib2', '#f-distributor-2');
    setupSecondFieldToggle(body, '#btn-toggle-delegate2', '#wrap-delegate2', '#f-delegate-2');
    setupSecondFieldToggle(body, '#btn-toggle-zone2', '#wrap-zone2', '#f-zone-2');

    const { close } = UI.openModal({
      title: sup ? '✏️ دەستکاریکردنی داتا' : '✏️ دەستکاریکردنی داتای ئەمڕۆ',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'پاشەکەوتکردن',
          className: 'btn-primary',
          onClick: async (backdrop) => {
            const saveBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const val = id => $(id, body).value.trim() || null;
            const num = id => {
              const raw = $(id, body).value.trim();
              if (raw === '') return null;
              const n = UI.cleanInt(raw);
              return Number.isNaN(n) || n < 0 ? NaN : n;
            };

            // بەهای کۆتایی — پێکەوەنانەوەی دووەمەکان بە «و» هەروەک فۆڕمی تۆمارکردنی دەرچوون
            const joinSecond = (first, second) => second ? `${first} و ${second}` : first;

            const driverVal = (distrib || sup) ? val('#f-driver-pick') : val('#f-driver-locked');
            const dist1     = val('#f-distributor');
            const dist2     = val('#f-distributor-2');
            const del1      = val('#f-delegate');
            const del2      = val('#f-delegate-2');
            const z1        = val('#f-zone');
            const z2        = val('#f-zone-2');

            const invalid = [];
            if (!driverVal) invalid.push((distrib || sup) ? '#f-driver-pick' : '#f-driver-locked');
            if (!dist1) invalid.push('#f-distributor');
            if (!del1) invalid.push('#f-delegate');
            if (!z1) invalid.push('#f-zone');

            const vehicle = val('#f-vehicle');
            if (!vehicle) invalid.push('#f-vehicle');

            const weight = num('#f-weight');
            const pieces = num('#f-pieces');
            const receipt = num('#f-receipt');
            if (Number.isNaN(weight)) invalid.push('#f-weight');
            if (Number.isNaN(pieces)) invalid.push('#f-pieces');
            if (Number.isNaN(receipt)) invalid.push('#f-receipt');

            // پارەی هێنراوە — بەتاڵ واتە ٠
            const moneyRaw = $('#f-money', body).value.trim();
            const money = moneyRaw === '' ? 0 : UI.cleanInt(moneyRaw);

            if (invalid.length) {
              invalid.forEach(id => $(id, body)?.classList.add('invalid'));
              UI.toast('تکایە خانە ناوی و ژمارەییەکان بە دروستی پڕ بکەرەوە', 'warning');
              return;
            }

            const patch = {
              record_time: val('#f-time'),
              in_zone_time: val('#f-in-zone'),
              out_zone_time: val('#f-out-zone'),
              arrival_time: val('#f-arrival'),
              driver: driverVal,
              distributor: joinSecond(dist1, dist2),
              delegate: joinSecond(del1, del2),
              zone: joinSecond(z1, z2),
              vehicle,
              cargo_weight: weight,
              pieces_count: pieces,
              receipt_number: receipt,
              collected_money: money,
            };

            UI.btnLoading(saveBtn, true, 'پاشەکەوت دەکرێت...');
            try {
              await API.Records.update(rec.id, patch);

              // تۆمارکردنی تەنها ئەو خانەیانەی کە بەڕاستی گۆڕدراون (بۆ نیشانەی ^ ی بەڕێوەبەر)
              const sameVal = (a, b) => {
                if (a === null && (b === null || b === undefined)) return true;
                if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
                return UI.norm(stripEditMark(a)) === UI.norm(stripEditMark(b));
              };
              const changed = Object.keys(patch).filter(k => !sameVal(patch[k], rec[k]));
              if (changed.length) addEditMarks(rec, changed);

              // نۆتیفیکەیشن: تەنها بۆ خانەیەک کە پێشتر نرخێکی تۆمارکراوی هەبوو (نەک لە سفرەوە)
              const FIELD_LABELS = {
                record_time: 'کاتی دەرچوون', in_zone_time: 'کاتی ناو زۆن',
                out_zone_time: 'کاتی دەرێی زۆن', arrival_time: 'کاتی گەشتنەوە',
                driver: 'شۆفێر', distributor: 'دابەشکار', delegate: 'مەندوب',
                zone: 'ناوچە/زۆن', vehicle: 'ژمارەی سەیارە',
                cargo_weight: 'کێشی بار (کگم)', pieces_count: 'ژمارەی پارچەکان', receipt_number: 'ژمارەی وەسڵ',
                collected_money: 'پارەی هێنراوە',
              };
              const isEmptyVal = v => v === null || v === undefined || v === '' || Number(v) === 0;
              const editorName = App.getUser()?.username || 'نەزانیرا';
              changed.forEach(k => {
                if (isEmptyVal(rec[k])) return; // لە سفرەوە تۆمارکراوە — نۆتیفیکەیشن نانێردرێت
                const oldV = typeof rec[k] === 'number' ? UI.fmtNum(rec[k]) : stripEditMark(rec[k]);
                const newV = typeof patch[k] === 'number' ? UI.fmtNum(patch[k]) : (patch[k] ?? '(بەتاڵ)');
                const label = FIELD_LABELS[k] || k;
                API.Notifications.send(
                  `خانەی «${label}» لە «${oldV}» گۆڕا بۆ «${newV}» (لەلایەن ${editorName})`
                ).catch(e => console.warn('هەڵە لە ناردنی نۆتیفیکەیشن:', e));
              });

              UI.toast('داتاکە بە سەرکەوتوویی نوێ کرانەوە ✓', 'success');
              close();
              await load({ silent: true });
              if (typeof options?.onSave === 'function') {
                await options.onSave();
              }
            } catch (err) {
              UI.toast('هەڵە لە نوێکردنەوەی داتاکە: ' + err.message, 'error', 4200);
            } finally {
              UI.btnLoading(saveBtn, false);
            }
          }
        }
      ]
    });
  }

  /* ---------------- تایمەرەکان ---------------- */

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
  }

  /* ---------------- ڕێندەری سەرەتایی ---------------- */

  function render(el) {
    container = el;
    load();
    start();
  }

  return { render, stop, openEditDataModal };
})();
