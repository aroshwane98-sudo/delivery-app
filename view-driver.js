/* =========================================================
 *  پانێلی شۆفێر — قۆناغەکانی گەیاندن، فرە-بار، پارەی هێنراوە
 * ========================================================= */

const DriverView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  let refreshTimer = null;
  let countdownTimer = null;
  let records = [];   // تۆمارەکانی ئەمڕۆی ئەم شۆفێرە
  let allTodayRecords = [];  // هەموو تۆمارەکانی ئەمڕۆ (بۆ ژماردنی ڕاستی گەشتەکانی شۆفێر)
  let lists = null;   // {users, zones}
  let isFirstRender = true;  // بۆ نیشاندانی لوک سکرینی شۆفێر لە یەکەم بار


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

    // بەراوردی شۆفێر — ئەگەر هەردووکیان ئایدیان هەیە تەنها بە ئایدی (وردتر لە ناو)
    const drvIds1 = UI.parseIdList(r1.driver_id), drvIds2 = UI.parseIdList(r2.driver_id);
    const sameDriver = (drvIds1.length && drvIds2.length)
      ? drvIds1.some(x => drvIds2.includes(x))
      : driverBaseName(r1.driver) === driverBaseName(r2.driver);
    if (!sameDriver) return false;

    // بەراوردی دابەشکار — هەمان شێوە ئایدی پێش ناو
    const dstIds1 = UI.parseIdList(r1.distributor_id), dstIds2 = UI.parseIdList(r2.distributor_id);
    const sameDistributor = (dstIds1.length && dstIds2.length)
      ? dstIds1.some(x => dstIds2.includes(x))
      : (UI.userMatches(r1.distributor, r2.distributor) || UI.userMatches(r2.distributor, r1.distributor));
    if (!sameDistributor) return false;

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

  /* ---------------- گرووپی ناو — چەند خانەیەک (تا ٤) لەگەڵ ⊞/✕ و ئۆتۆکۆمپلیت ----------------
   *  هاوبەش لە نێوان فۆڕمی دەرچوون و دەستکاری. تایتڵ وەک placeholder لەناو خانەکەدا. */

  const cargoSuffixFor = index => (index >= 1 ? ' دوو' : '');
  const stripCargoSuffix = name => String(name || '').replace(/\s*(دوو|سێ)\s*$/, '').trim();

  /* ---------------- خانە ژمارەییەکان بە دەقی کۆکردنەوە (10+20+30) ---------------- */
  // بلەر: کۆی گشتی پیشان دەدات؛ فۆکەس: دەقە ڕەسەنەکە دەگەڕێنێتەوە بۆ دەستکاری
  const wireExprField = inp => {
    if (!inp) return;
    inp.addEventListener('blur', () => {
      const raw = inp.value.trim();
      if (UI.hasOperator(raw)) {
        inp.dataset.raw = raw;
        inp.value = String(UI.cleanInt(raw));
      } else {
        delete inp.dataset.raw;
      }
    });
    inp.addEventListener('focus', () => {
      if (inp.dataset.raw) inp.value = inp.dataset.raw;
    });
  };
  const exprValue = inp => {
    if (!inp) return '';
    const raw = (inp.dataset.raw || '').trim();
    return raw || inp.value.trim();
  };
  // ئەگەر ستوونە ژمارەییەکان لە سەپابەیس کرابنە text، دەقەکە دەنێرین؛ ئەگینا کۆی گشتی
  const numericColsAreText = () => (records || []).some(r => typeof r.cargo_weight === 'string');
  const sendNumeric = raw => numericColsAreText() ? raw : UI.cleanInt(raw);

  const createNameGroup = (opts = {}) => {
    const title = opts.title || '';
    const items = opts.items || (() => []);
    const max = opts.max || 4;
    const lockedFirst = !!opts.lockedFirst;
    const lockedValue = opts.lockedValue || '';
    const lockedAll = !!opts.lockedAll; // قفڵی تەواوی گرووپ — بەپێی ڕێکخستنی قفڵی خانەکان
    const addTitle = opts.addTitle || 'زیادکردنی خانەی تر';

    const el = document.createElement('div');
    el.className = 'name-group';

    const rows = [];

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-field-add ng-add';
    addBtn.textContent = '⊞';
    addBtn.title = addTitle;

    const refreshAdd = () => { addBtn.style.display = (rows.length >= max || lockedAll) ? 'none' : ''; };

    const makeRow = (value, isFirst) => {
      const row = document.createElement('div');
      row.className = 'ng-row' + (isFirst ? ' ng-first' : ' ng-extra');

      const field = document.createElement('div');
      field.className = 'ng-field';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'ng-input';
      inp.placeholder = title;
      inp.value = value || '';
      field.appendChild(inp);
      row.appendChild(field);

      const btns = document.createElement('div');
      btns.className = 'ng-btns';
      row.appendChild(btns);

      const rowObj = { row, inp, btns, isFirst };
      rows.push(rowObj);
      el.appendChild(row);

      if (lockedAll || (isFirst && lockedFirst)) {
        inp.readOnly = true;
        if (isFirst && lockedFirst) inp.value = lockedValue;
        inp.style.background = 'var(--bg-2,#f5f5f5)';
        inp.style.color = 'var(--text-muted,#888)';
        inp.style.cursor = 'not-allowed';
        if (isFirst) btns.appendChild(addBtn);
      } else {
        UI.autocomplete(inp, items);
        if (isFirst) {
          btns.appendChild(addBtn);
        } else {
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'btn-field-add ng-remove active';
          rm.textContent = '✕';
          rm.title = 'سڕینەوە';
          rm.addEventListener('click', () => {
            const idx = rows.indexOf(rowObj);
            if (idx >= 0) rows.splice(idx, 1);
            row.remove();
            refreshAdd();
          });
          btns.appendChild(rm);
        }
      }
      refreshAdd();
      return rowObj;
    };

    const initial = Array.isArray(opts.initial) && opts.initial.length ? opts.initial : [''];
    makeRow(initial[0] || (lockedFirst ? lockedValue : ''), true);
    for (let i = 1; i < Math.min(initial.length, max); i++) makeRow(initial[i], false);

    addBtn.addEventListener('click', () => {
      if (rows.length >= max) return;
      const r = makeRow('', false);
      r.inp.focus();
    });

    return {
      el,
      inputs: () => rows.map(r => r.inp),
      getValues: () => rows.map(r => r.inp.value.trim()).filter(Boolean),
      joined: (sep = ' و ') => rows.map(r => r.inp.value.trim()).filter(Boolean).join(sep),
      firstValue: () => (rows[0] ? rows[0].inp.value.trim() : ''),
      clearInvalid: () => rows.forEach(r => r.inp.classList.remove('invalid')),
      hasFirst: () => !!(rows[0] && rows[0].inp.value.trim()),
      markFirstInvalid: () => { if (rows[0]) rows[0].inp.classList.add('invalid'); },
      // ڕێگری: هەموو بەها نابەتاڵەکان دەبێت لە لیستی ڕێگەپێدراودا بن (پاشگر دوو/سێ پشتگوێ دەخرێت)
      validateAllowed: (allowedNames) => {
        if (!allowedNames || !allowedNames.length) return true;
        const set = new Set(allowedNames.map(n => UI.norm(n)));
        let ok = true;
        rows.forEach(r => {
          if (r.inp.readOnly) return;
          const v = r.inp.value.trim();
          if (!v) return;
          const base = UI.norm(stripCargoSuffix(v));
          if (!set.has(base) && !set.has(UI.norm(v))) { r.inp.classList.add('invalid'); ok = false; }
        });
        return ok;
      },
    };
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
      // تەنها بۆ ئەوانەی دەسەڵاتی سڕینەوەیان هەیە — لە مۆدی دەروازەدا سێرڤەر ڕێگە نادات بە سڕینەوەی داتای کەسانی تر
      let cleanedToday;
      if (Perms.canAct(App.getUser(), 'rep_delete')) {
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

        cleanedToday = rows.filter(r => !toDeleteIds.has(r.id));
        allTodayRecords = cleanedToday;
        if (toDeleteIds.size > 0 && !silent) {
          UI.toast('دەرچوونی دووبارەی هەمان گەشت لە سیستەمدا بە خۆکاری سڕدرایەوە ✓', 'info', 4000);
        }
      } else {
        cleanedToday = (allToday || []).slice();
        allTodayRecords = cleanedToday;
      }

      // هاوتاکردنی پێشاندانی دەرچوون بۆ هەردوو پیشەی سایەق و دابەشکار —
      // سەرەتا بە ئایدی usersv2 (ورد)، ئەگەر تۆمارەکە ئایدی نەبوو بە ناو (تۆمارە کۆنەکان)
      if (isDistributor()) {
        records = cleanedToday.filter(r => UI.recMatchesUser(r, 'distributor', u));
      } else {
        records = cleanedToday.filter(r => UI.recMatchesUser(r, 'driver', u));
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

    // دەسەڵاتەکان — دەستکاری و پارە
    const canEditData = Perms.canAct(App.getUser(), 'act_edit_data');
    const canMoney = Perms.canAct(App.getUser(), 'act_money');

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
        ${canEditData ? `
        <div class="active-time-edit-bar">
          ${(() => {
            const u2 = App.getUser();
            const locked = !isSupervisor() && !Perms.canAct(u2, 'act_bypass_field_lock') && Perms.isRecordLocked(active, null, u2);
            return `<button type="button" class="btn-edit-times btn-edit-big" id="active-edit-times-btn">${locked ? '🔒' : '✏️'} دەستکاری داتا${locked ? ' (قفڵکراوە)' : ''}</button>`;
          })()}
        </div>` : ''}
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
        ${active.arrival_time && !(Number(active.collected_money || 0) > 0) && canMoney ? `
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
    const u = App.getUser();
    const act = nextAction();

    // دەسەڵات — ئەگەر کردارەکە بۆ ئەم یوسەرە چالاک نەکرابێت، ئاگاداری پیشان دەدرێت
    const actPermKey = act.type === 'exit' ? 'act_exit' : (['in_zone', 'out_zone', 'arrival'].includes(act.type) ? `act_${act.type}` : null);
    if (actPermKey && !Perms.canAct(u, actPermKey)) {
      el.innerHTML = `<div class="card done-card">🔒 ئەم کردارە بۆ پیشەکەت چالاک نەکراوە — تکایە پەیوەندی بە بەڕێوەبەرەوە بکە.</div>`;
      return;
    }

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
    const canEditData = Perms.canAct(App.getUser(), 'act_edit_data');
    el.innerHTML = `
      <h3 class="section-title"><span class="sec-icon">${UI.icon('package')}</span> بارە تەواوبووەکانی ئەمڕۆ</h3>
      ${done.map(r => {
        const hasMoney = Number(r.collected_money || 0) > 0;
        return `
        <div class="card hist-card clickable-row" data-id="${r.id}">
          <div class="hist-top">
            <b>${UI.esc(CONFIG.CARGO_LABELS[cargoIndex(r)] || 'بار')} — ${UI.esc(r.zone || '—')}</b>
            <div style="display:flex;align-items:center;gap:6px">
              ${canEditData ? (() => {
                const uHist = App.getUser();
                const lockedHist = !isSupervisor() && !Perms.canAct(uHist, 'act_bypass_field_lock') && Perms.isRecordLocked(r, null, uHist);
                return `<button type="button" class="btn-edit-times btn-edit-big btn-hist-edit" data-id="${r.id}" title="دەستکاریکردنی داتا و پارەی ئەم بارە">${lockedHist ? '🔒' : '✏️'} دەستکاری داتا${lockedHist ? ' (قفڵکراوە)' : ''}</button>`;
              })() : ''}
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

  /* ناردنی نۆتیفیکەیشن بۆ هەموو یوسەرە ناوبراوەکانی تۆمار (شۆفێر/دابەشکار/مەندوب) و بەڕێوەبەر —
     هەر یوسەرێک تەنها ئەو نۆتیفیکەیشانە دەبینێت کە ناوی خۆی تێدایە (فلتەر لە کاتی پیشاندان) */
  function notifyTripAction(rec, actionLabel) {
    const actor = App.getUser()?.username || '';
    const msg = `${actionLabel} — شۆفێر: ${rec.driver || '—'}، دابەشکار: ${rec.distributor || '—'}، مەندوب: ${rec.delegate || '—'}، زۆن: ${rec.zone || '—'}` +
      (actor ? ` (لەلایەن ${actor})` : '');
    API.Notifications.send(msg)
      .catch(e => console.warn('هەڵە لە ناردنی نۆتیفیکەیشن:', e));
  }

  async function doStage(type) {
    const active = activeRecord();
    if (!active) return;

    // دەسەڵات — کردارەکانی شاشەی قفڵیش بە هەمان ڕێگە دەپشکنرێن
    if (!Perms.canAct(App.getUser(), 'act_' + type)) {
      UI.toast('ئەم کردارە بۆ پیشەکەت چالاک نەکراوە', 'warning');
      return;
    }

    // ڕێگری لە تێپەڕاندنی قۆناغەکان
    if (type === 'in_zone' && !active.record_time) return;
    if (type === 'out_zone' && !active.in_zone_time) { UI.toast('سەرەتا دەبێت ناو زۆن تۆمار بکەیت', 'warning'); return; }
    if (type === 'arrival' && !active.out_zone_time) { UI.toast('سەرەتا دەبێت دەرێی زۆن تۆمار بکەیت', 'warning'); return; }

    const field = { in_zone: 'in_zone_time', out_zone: 'out_zone_time', arrival: 'arrival_time' }[type];
    const label = { in_zone: 'گەیشتن بە ناو زۆن', out_zone: 'دەرچوون لە زۆن', arrival: 'گەشتنەوە' }[type];
    const icon = { in_zone: '📍', out_zone: '🚏', arrival: '🏁' }[type];

    const actBtn = container ? $('#act-btn', container) : null;
    if (actBtn) UI.btnLoading(actBtn, true, 'تۆمار دەکرێت...');
    try {
      const patch = { [field]: UI.nowTime() };
      // کاتی کارکردن — لە کاتی گەشتنەوەدا حیساب و کۆگا دەکرێت لە average_time
      if (type === 'arrival') {
        const start = Store.getBaseTime() || active.record_time;
        const mins = UI.durationMinutes(start, patch.arrival_time);
        patch.average_time = UI.durationToHMM(mins);
      }
      await API.Records.update(active.id, patch);
      UI.toast(`${label} بە سەرکەوتوویی تۆمار کرا ✓`, 'success');
      notifyTripAction(active, `${icon} ${label} تۆمارکرا`);
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
      let nextActionTitle = '';
      let stageIcon = '';

      if (!active.in_zone_time) {
        nextStage = 'in_zone';
        nextActionTitle = '📍 گەیشتمە ناو زۆن';
        stageIcon = '📍';
      } else if (!active.out_zone_time) {
        nextStage = 'out_zone';
        nextActionTitle = '🚏 دەرچوون لە زۆن';
        stageIcon = '🚏';
      } else if (!active.arrival_time) {
        nextStage = 'arrival';
        nextActionTitle = '🏁 گەیشتمەوە بۆ خاڵی دەستپێک';
        stageIcon = '🏁';
      }

      if (!nextStage) {
        const notifs = await reg.getNotifications({ tag: 'active-trip-lockscreen' });
        notifs.forEach(n => n.close());
        return;
      }

      // تەنها یەک دووگمە لەناو کارتی نۆتیفیکەیشن — بێ هیچ داتای زیادە
      const title = `${stageIcon} گەیاندن`;

      const existing = await reg.getNotifications({ tag: 'active-trip-lockscreen' });
      const current = existing[0];
      if (current && current.data && current.data.recordId === active.id && current.data.stage === nextStage) {
        return; // ڕێگری لە دووبارە دەنگدانەوە لەگەڵ هەر ڕیفرێشێک
      }

      await reg.showNotification(title, {
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
    const drivers     = (lists?.users || []).filter(x => x.profession === CONFIG.PROFESSION_DRIVER || x.profession === CONFIG.PROFESSION_ASSISTANT).map(x => ({ label: x.username }));
    const delegates   = (lists?.users || []).filter(x => x.profession === CONFIG.PROFESSION_DELEGATE).map(x => ({ label: x.username }));
    const zones       = (lists?.zones || []).map(z => ({ label: z.name }));
    const vehicles    = (lists?.vehicles || []).map(v => {
      const val = v.vehicle_number || v.plate_number || v.number || v.name || v.vehicle || v.plate || Object.values(v)[1] || Object.values(v)[0];
      return { label: String(val).trim() };
    }).filter(v => v.label && v.label !== '[object Object]');

    const count = records.length;
    const cargoLabel = CONFIG.CARGO_LABELS[count] || 'باری نوێ';

    const driverUsernames = drivers.map(d => d.label);
    const distribUsernames = distributors.map(d => d.label);

    const body = document.createElement('div');
    body.innerHTML = `
      <form id="exit-form" novalidate>
        <div id="grp-driver"></div>
        <div id="grp-distributor"></div>
        <div id="grp-delegate"></div>
        <div id="grp-zone"></div>

        <div class="field-row">
          <div class="field"><label>ژمارەی سەیارە *</label><input id="f-vehicle" type="text" inputmode="numeric" placeholder="هەڵبژێرە یان بنووسە"></div>
          <div class="field"><label>کاتی دەرچوون *</label><input id="f-time" type="time" value="${UI.nowTime()}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>کێشی بار (کگم) *</label><input id="f-weight" type="text" inputmode="numeric" placeholder="3+2-1"></div>
          <div class="field"><label>ژمارەی پارچەکان *</label><input id="f-pieces" type="text" inputmode="numeric" placeholder="3+2-1"></div>
        </div>
        <div class="field"><label>ژمارەی وەسڵ *</label><input id="f-receipt" type="text" inputmode="numeric" placeholder="3+2-1"></div>
        <p class="hint"></p>
      </form>`;

    // گرووپی ناوەکان — هەر یەکێک تا ٤ خانە، تایتڵ لەناو خانەکەدا (placeholder)
    const driverGroup = createNameGroup({
      title: 'ناوی سایەق *',
      items: () => drivers,
      max: 4,
      lockedFirst: !distrib,
      lockedValue: distrib ? '' : u.username,
      addTitle: 'زیادکردنی سایەقی تر',
    });
    const distribGroup = createNameGroup({
      title: 'ناوی دابەشکار *',
      items: () => distributors,
      max: 4,
      lockedFirst: distrib,
      lockedValue: distrib ? u.username : '',
      addTitle: 'زیادکردنی دابەشکاری تر',
    });
    const delegateGroup = createNameGroup({
      title: 'ناوی مەندوب *',
      items: () => delegates,
      max: 4,
      addTitle: 'زیادکردنی مەندوبی تر',
    });
    const zoneGroup = createNameGroup({
      title: 'ناوچە / زۆن *',
      items: () => zones,
      max: 4,
      addTitle: 'زیادکردنی زۆنی تر',
    });

    $('#grp-driver', body).appendChild(driverGroup.el);
    $('#grp-distributor', body).appendChild(distribGroup.el);
    $('#grp-delegate', body).appendChild(delegateGroup.el);
    $('#grp-zone', body).appendChild(zoneGroup.el);

    UI.autocomplete($('#f-vehicle', body), () => vehicles);
    ['#f-weight', '#f-pieces', '#f-receipt'].forEach(id => wireExprField($(id, body)));

    const { close } = UI.openModal({
      title: `🚚 تۆمارکردنی دەرچوون — ${cargoLabel}`,
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'تۆمارکردن', className: 'btn-primary', onClick: async (backdrop) => {
            const submitBtn = backdrop.querySelector('.modal-foot .btn-primary');
            const val = id => $(id, body)?.value.trim() || '';

            driverGroup.clearInvalid(); distribGroup.clearInvalid();
            delegateGroup.clearInvalid(); zoneGroup.clearInvalid();
            ['#f-vehicle', '#f-time', '#f-weight', '#f-pieces', '#f-receipt']
              .forEach(id => $(id, body)?.classList.remove('invalid'));

            const driverVals   = driverGroup.getValues();
            const distribVals  = distribGroup.getValues();
            const delegateVals = delegateGroup.getValues();
            const zoneVals     = zoneGroup.getValues();

            // پێویستبوونی خانە سەرەکییەکان
            let missing = false;
            if (!driverVals.length)   { driverGroup.markFirstInvalid();   missing = true; }
            if (!distribVals.length)  { distribGroup.markFirstInvalid();  missing = true; }
            if (!delegateVals.length) { delegateGroup.markFirstInvalid(); missing = true; }
            if (!zoneVals.length)     { zoneGroup.markFirstInvalid();     missing = true; }

            const vehicle  = val('#f-vehicle');
            const recTime  = val('#f-time');
            const weightRaw  = exprValue($('#f-weight', body));
            const piecesRaw  = exprValue($('#f-pieces', body));
            const receiptRaw = exprValue($('#f-receipt', body));
            if (!vehicle)     { $('#f-vehicle', body)?.classList.add('invalid'); missing = true; }
            if (!recTime)     { $('#f-time', body)?.classList.add('invalid'); missing = true; }
            if (weightRaw === '' || UI.cleanInt(weightRaw) < 0)  { $('#f-weight', body)?.classList.add('invalid'); missing = true; }
            if (piecesRaw === '' || UI.cleanInt(piecesRaw) < 0)  { $('#f-pieces', body)?.classList.add('invalid'); missing = true; }
            if (receiptRaw === '' || UI.cleanInt(receiptRaw) < 0) { $('#f-receipt', body)?.classList.add('invalid'); missing = true; }

            if (missing) { UI.toast('تکایە هەموو خانە سەرەکییەکان پڕ بکەرەوە', 'warning'); return; }

            // ڕێگری: ناوی سایەق و دابەشکار دەبێت لە یوسەرە تۆمارکراوەکانی سەپابەیس بن
            const driverListed  = driverGroup.validateAllowed(driverUsernames);
            const distribListed = distribGroup.validateAllowed(distribUsernames);
            if (!driverListed || !distribListed) {
              UI.toast('ناوی سایەق/دابەشکار دەبێت لە لیستی یوسەرە تۆمارکراوەکان بێت — ناتوانرێت ناوی نوێ تۆمار بکرێت', 'error', 5000);
              return;
            }

            const driverBase     = driverVals[0] || (distrib ? '' : u.username);
            const finalDriver    = driverVals.join(' و ');
            const finalDistrib   = distribVals.join(' و ');
            const finalDelegate  = delegateVals.join(' و ');
            const finalZone      = zoneVals.join(' و ');

            // پشکنینی دەرچوونی دووبارە لە هەمان ڕۆژ پێش ناردن
            const candidateRecord = {
              record_date: UI.todayStr(),
              driver: driverBase,
              distributor: finalDistrib,
              vehicle,
              record_time: recTime,
            };
            const hasDuplicate = records.some(r => areDuplicateDepartures(r, candidateRecord));
            if (hasDuplicate) {
              UI.toast('ئەم دەرچوونە پێشتر لە ئەمڕۆدا بە هەمان زانیاری لەم ماوەیەدا تۆمارکراوە! بۆ ڕێگری لە دووبارەبوونەوە دووبارە تۆمار نەکرا.', 'warning', 5000);
              close();
              await load({ silent: true });
              return;
            }

            // دیاریکردنی ژمارەی بار بۆ ئەم شۆفێرە — بە ئایدی ئەگەر هەبێت.
            // هەموو تۆمارەکانی ئەمڕۆ دەژمێرین (نەک تەنها تۆمارەکانی ئەم یوسەرە) بۆ ئەوەی
            // دەرچوونی دووەمی هەمان ڕۆژ بە دروستی پاشگری «دوو» وەربگرێت.
            const drvUser = (lists?.users || []).find(x => UI.norm(x.username) === UI.norm(driverBase));
            const pool = allTodayRecords.length ? allTodayRecords : records;
            const driverTodayTrips = pool.filter(r => drvUser
              ? UI.recMatchesUser(r, 'driver', drvUser)
              : UI.userMatches(r.driver, driverBase));
            const finalCargoIndex = driverTodayTrips.length;
            // پاشگر تەنها «دوو» ـە (بۆ باری دووەم و هەر بارێکی دواتر) و بۆ سایەق و دابەشکار هەردووکیان
            const suffix = cargoSuffixFor(finalCargoIndex);

            UI.btnLoading(submitBtn, true, 'تۆمار دەکرێت...');
            try {
              await API.Records.insert({
                driver:       finalDriver + suffix,
                distributor:  finalDistrib + suffix,
                delegate:     finalDelegate,
                zone:         finalZone,
                vehicle,
                record_time:  recTime,
                record_date:  UI.todayStr(),
                cargo_weight:   sendNumeric(weightRaw),
                pieces_count:   sendNumeric(piecesRaw),
                receipt_number: sendNumeric(receiptRaw),
                in_zone_time: null, out_zone_time: null, arrival_time: null, collected_money: 0,
              });
              UI.toast('دەرچوون بە سەرکەوتوویی تۆمار کرا 🚚', 'success');
              notifyTripAction(
                { driver: finalDriver + suffix, distributor: finalDistrib + suffix, delegate: finalDelegate, zone: finalZone },
                '🚚 دەرچوون تۆمارکرا'
              );
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
    // قفڵی خانەی پارەی هێنراوە — ئەگەر قفڵکراوە، تۆمارکردن/گۆڕین ڕێگەپێدراو نییە
    const uMoney = App.getUser();
    if (!isSupervisor() && !Perms.canAct(uMoney, 'act_bypass_field_lock') && Perms.isRecordLocked(active, 'collected_money', uMoney)) {
      UI.toast('🔒 خانەی «پارەی هێنراوە» قفڵکراوە — ناتوانیت بیگۆڕیت', 'warning', 5000);
      return;
    }
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

    // پشکنینی قفڵی خانەکان — خانەکان دانە بە دانە قفڵ دەبن بەپێی ڕێکخستن
    // تەنها کاتێک مۆدال دەخرێتەوە کە هەموو خانەکانی فۆڕم قفڵکراون
    const canBypassLock = sup || Perms.canAct(u, 'act_bypass_field_lock');
    const lockedFields = canBypassLock ? [] : Perms.lockedFieldsOf(rec, u);
    if (!canBypassLock && Perms.FIELD_LOCK_FIELDS.every(f => lockedFields.includes(f.key))) {
      const flc = (Store.getPermsConfig() || {}).fieldLock || {};
      const reason = flc.type === 'timed'
        ? `دوای ${UI.esc(String(flc.minutes || 0))} خولەک لە تۆمارکردنەوە`
        : 'دوای تۆمارکردن';
      UI.toast(`🔒 هەموو خانەکانی ئەم تۆمارە قفڵکراون (${reason}) — چیتر ناتوانیت داتاکانی دەستکاری بکەیت`, 'warning', 5000);
      return;
    }

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
    const driversList  = (listsNow.users || []).filter(x => x.profession === CONFIG.PROFESSION_DRIVER || x.profession === CONFIG.PROFESSION_ASSISTANT).map(x => ({ label: x.username }));
    const delegates    = (listsNow.users || []).filter(x => x.profession === CONFIG.PROFESSION_DELEGATE).map(x => ({ label: x.username }));
    const zones        = (listsNow.zones || []).map(z => ({ label: z.name }));
    const vehicles     = (listsNow.vehicles || []).map(v => {
      const val = v.vehicle_number || v.plate_number || v.number || v.name || v.vehicle || v.plate || Object.values(v)[1] || Object.values(v)[0];
      return { label: String(val).trim() };
    }).filter(v => v.label && v.label !== '[object Object]');

    // دیاریکردنی خانەی ناوی خۆی — قفڵ دەکرێت وەک فۆڕمی تۆمارکردنی دەرچوون (تەنها بۆ شۆفێر/دابەشکار، نەک بەڕێوەبەر)
    // بە ئایدی usersv2 ئەگەر تۆمارەکە هەیبێت، ئەگینا بە ناو
    let selfField = null;
    if (!sup) {
      if (!isDistributor() && UI.recMatchesUser(rec, 'driver', u)) selfField = 'driver';
      else if (UI.recMatchesUser(rec, 'distributor', u)) selfField = 'distributor';
      else if (UI.recMatchesUser(rec, 'delegate', u)) selfField = 'delegate';
    }

    // جیاکردنەوەی بەهای «X و Y و Z» بۆ لیست — وەک فۆڕمی دەرچوون.
    // ئەگەر یەکێک لە بەشەکان ناوی خۆی بێت، ناوی خۆی دەبێتە پێشەوە (چونکە خانە قفڵە)
    const splitList = (value, selfName) => {
      const raw = stripEditMark(value);
      const parts = String(raw || '').split(/\s+و\s+/).map(s => s.trim()).filter(Boolean);
      if (!parts.length) return [];
      if (selfName) {
        const idx = parts.findIndex(p => UI.userMatches(p, selfName));
        if (idx > 0) {
          const me = parts.splice(idx, 1)[0];
          return [me, ...parts];
        }
        if (idx === -1) return parts;
      }
      return parts;
    };

    const driverParts  = splitList(rec.driver, selfField === 'driver' ? u?.username : null);
    const distParts    = splitList(rec.distributor, selfField === 'distributor' ? u?.username : null);
    const delParts     = splitList(rec.delegate, selfField === 'delegate' ? u?.username : null);
    const zoneParts    = splitList(rec.zone, null);

    const driverUsernames  = driversList.map(d => d.label);
    const distribUsernames = distributors.map(d => d.label);

    const body = document.createElement('div');
    body.innerHTML = `
      <p class="hint">${sup ? `دەتوانیت کات و زانیارییەکانی باری «${UI.esc(rec.zone || '')}» دەستکاری بکەیت:` : `دەتوانیت کات و زانیارییەکانی ئەمڕۆی باری «${UI.esc(rec.zone || '')}» دەستکاری بکەیت. خانەی ناوی خۆت قفڵە و کاتەکان دەتوانیت بەتاڵیان بکەیتەوە:`}</p>
      <form id="edit-times-form" novalidate>
        <div id="grp-driver"></div>
        <div id="grp-distributor"></div>
        <div id="grp-delegate"></div>
        <div id="grp-zone"></div>

        <div class="field-row">
          <div class="field"><label>ژمارەی سەیارە *</label><input id="f-vehicle" type="text" inputmode="numeric" placeholder="هەڵبژێرە یان بنووسە" value="${UI.esc(rec.vehicle || '')}"></div>
          <div class="field"><label>کاتی دەرچوون *</label><input id="f-time" type="time" value="${rec.record_time || ''}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label>کێشی بار (کگم) *</label><input id="f-weight" type="text" inputmode="numeric" value="${UI.esc(rec.cargo_weight ?? '')}"></div>
          <div class="field"><label>ژمارەی پارچەکان *</label><input id="f-pieces" type="text" inputmode="numeric" value="${UI.esc(rec.pieces_count ?? '')}"></div>
        </div>
        <div class="field"><label>ژمارەی وەسڵ *</label><input id="f-receipt" type="text" inputmode="numeric" value="${UI.esc(rec.receipt_number ?? '')}"></div>
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

    // گرووپی ناوەکان — هەر یەکێک تا ٤ خانە، تایتڵ لەناو خانەکەدا (placeholder)
    // خانەی یەکەم قفڵە ئەگەر ناوی خۆی بێت (بۆ شۆفێر/دابەشکار/مەندوب، نەک بەڕێوەبەر)
    const driverGroup = createNameGroup({
      title: 'ناوی سایەق *',
      items: () => driversList,
      max: 4,
      initial: driverParts,
      lockedFirst: selfField === 'driver',
      lockedValue: selfField === 'driver' ? (driverParts[0] || u?.username || '') : '',
      lockedAll: lockedFields.includes('driver'),
      addTitle: 'زیادکردنی سایەقی تر',
    });
    const distribGroup = createNameGroup({
      title: 'ناوی دابەشکار *',
      items: () => distributors,
      max: 4,
      initial: distParts,
      lockedFirst: selfField === 'distributor',
      lockedValue: selfField === 'distributor' ? (distParts[0] || u?.username || '') : '',
      lockedAll: lockedFields.includes('distributor'),
      addTitle: 'زیادکردنی دابەشکاری تر',
    });
    const delegateGroup = createNameGroup({
      title: 'ناوی مەندوب *',
      items: () => delegates,
      max: 4,
      initial: delParts,
      lockedFirst: selfField === 'delegate',
      lockedValue: selfField === 'delegate' ? (delParts[0] || u?.username || '') : '',
      lockedAll: lockedFields.includes('delegate'),
      addTitle: 'زیادکردنی مەندوبی تر',
    });
    const zoneGroup = createNameGroup({
      title: 'ناوچە / زۆن *',
      items: () => zones,
      max: 4,
      initial: zoneParts,
      lockedAll: lockedFields.includes('zone'),
      addTitle: 'زیادکردنی زۆنی تر',
    });

    $('#grp-driver', body).appendChild(driverGroup.el);
    $('#grp-distributor', body).appendChild(distribGroup.el);
    $('#grp-delegate', body).appendChild(delegateGroup.el);
    $('#grp-zone', body).appendChild(zoneGroup.el);

    // قفڵکردنی خانە ساکارەکان — تەنها ئەوانەی لە ڕێکخستنی قفڵدا هەڵبژێردران
    const lockSimpleField = (el, key) => {
      if (!el || !lockedFields.includes(key)) return;
      el.readOnly = true;
      el.style.background = 'var(--bg-2,#f5f5f5)';
      el.style.color = 'var(--text-muted,#888)';
      el.style.cursor = 'not-allowed';
    };
    lockSimpleField($('#f-vehicle', body), 'vehicle');
    lockSimpleField($('#f-time', body), 'record_time');
    lockSimpleField($('#f-weight', body), 'cargo_weight');
    lockSimpleField($('#f-pieces', body), 'pieces_count');
    lockSimpleField($('#f-receipt', body), 'receipt_number');
    lockSimpleField($('#f-money', body), 'collected_money');
    lockSimpleField($('#f-in-zone', body), 'in_zone_time');
    lockSimpleField($('#f-out-zone', body), 'out_zone_time');
    lockSimpleField($('#f-arrival', body), 'arrival_time');

    if (!lockedFields.includes('vehicle')) UI.autocomplete($('#f-vehicle', body), () => vehicles);
    ['#f-weight', '#f-pieces', '#f-receipt'].forEach(id => wireExprField($(id, body)));

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

            driverGroup.clearInvalid(); distribGroup.clearInvalid();
            delegateGroup.clearInvalid(); zoneGroup.clearInvalid();
            ['#f-vehicle', '#f-weight', '#f-pieces', '#f-receipt']
              .forEach(id => $(id, body)?.classList.remove('invalid'));

            const driverVals   = driverGroup.getValues();
            const distribVals  = distribGroup.getValues();
            const delegateVals = delegateGroup.getValues();
            const zoneVals     = zoneGroup.getValues();

            if (!driverVals.length && !lockedFields.includes('driver'))       driverGroup.markFirstInvalid();
            if (!distribVals.length && !lockedFields.includes('distributor')) distribGroup.markFirstInvalid();
            if (!delegateVals.length && !lockedFields.includes('delegate'))   delegateGroup.markFirstInvalid();
            if (!zoneVals.length && !lockedFields.includes('zone'))           zoneGroup.markFirstInvalid();

            const invalid = [];
            const vehicle = val('#f-vehicle');
            if (!vehicle && !lockedFields.includes('vehicle')) invalid.push('#f-vehicle');

            const weightRaw  = exprValue($('#f-weight', body));
            const piecesRaw  = exprValue($('#f-pieces', body));
            const receiptRaw = exprValue($('#f-receipt', body));
            if (!lockedFields.includes('cargo_weight') && (weightRaw === '' || UI.cleanInt(weightRaw) < 0)) invalid.push('#f-weight');
            if (!lockedFields.includes('pieces_count') && (piecesRaw === '' || UI.cleanInt(piecesRaw) < 0)) invalid.push('#f-pieces');
            if (!lockedFields.includes('receipt_number') && (receiptRaw === '' || UI.cleanInt(receiptRaw) < 0)) invalid.push('#f-receipt');

            // پارەی هێنراوە — بەتاڵ واتە ٠
            const moneyRaw = $('#f-money', body).value.trim();
            const money = moneyRaw === '' ? 0 : UI.cleanInt(moneyRaw);

            const missingName = (!driverVals.length && !lockedFields.includes('driver'))
              || (!distribVals.length && !lockedFields.includes('distributor'))
              || (!delegateVals.length && !lockedFields.includes('delegate'))
              || (!zoneVals.length && !lockedFields.includes('zone'));
            if (invalid.length || missingName) {
              invalid.forEach(id => $(id, body)?.classList.add('invalid'));
              UI.toast('تکایە خانە ناوی و ژمارەییەکان بە دروستی پڕ بکەرەوە', 'warning');
              return;
            }

            // ڕێگری: ناوی سایەق و دابەشکار دەبێت لە یوسەرە تۆمارکراوەکانی سەپابەیس بن
            const driverListed  = driverGroup.validateAllowed(driverUsernames);
            const distribListed = distribGroup.validateAllowed(distribUsernames);
            if (!driverListed || !distribListed) {
              UI.toast('ناوی سایەق/دابەشکار دەبێت لە لیستی یوسەرە تۆمارکراوەکان بێت — ناتوانرێت ناوی نوێ تۆمار بکرێت', 'error', 5000);
              return;
            }

            const patch = {
              record_time: val('#f-time'),
              in_zone_time: val('#f-in-zone'),
              out_zone_time: val('#f-out-zone'),
              arrival_time: val('#f-arrival'),
              driver: driverVals.join(' و '),
              distributor: distribVals.join(' و '),
              delegate: delegateVals.join(' و '),
              zone: zoneVals.join(' و '),
              vehicle,
              cargo_weight: sendNumeric(weightRaw),
              pieces_count: sendNumeric(piecesRaw),
              receipt_number: sendNumeric(receiptRaw),
              collected_money: money,
            };

            // کاتی کارکردن — دووبارە حیساب دەکرێت لەگەڵ کاتی دەستپێک (بۆ هەر ڕۆژێک) و کۆگا دەکرێت
            const wtStart = Store.getBaseTime() || patch.record_time || rec.record_time;
            patch.average_time = patch.arrival_time ? UI.durationToHMM(UI.durationMinutes(wtStart, patch.arrival_time)) : null;

            // خانە قفڵکراوەکان لە پاشەکەوتکردن دەردەبرێن — بەهای کۆنیان دەمێنێتەوە
            lockedFields.forEach(k => delete patch[k]);

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
                  `خانەی «${label}» لە «${oldV}» گۆڕا بۆ «${newV}» (لەلایەن ${editorName}) — شۆفێر: ${rec.driver || '—'}، دابەشکار: ${rec.distributor || '—'}، مەندوب: ${rec.delegate || '—'}، زۆن: ${rec.zone || '—'}، بەروار: ${rec.record_date || '—'}`
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
