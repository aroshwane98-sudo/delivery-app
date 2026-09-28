/* =========================================================
 *  ئامرازەکانی ڕووکار — Toast, Modal, Autocomplete, بەکارهێنانە گشتییەکان
 * ========================================================= */

const UI = (() => {

  /* ---------------- نووسین و ژمارە ---------------- */

  function esc(v) {
    return String(v ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  // گۆڕینی ژمارە عەرەبی/فارسی بۆ لاتینی بۆ خوێندنەوەی دروست
  function toLatinDigits(v) {
    return String(v ?? '')
      .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  }

  // گۆڕینی ژمارە بۆ ژمارەی تەواو و لابردنی پۆینت و ژمارەکانی دوای پۆینت
  /* ---------------- ژمارە و دەقی کۆکردنەوە (10+20+30) ---------------- */

  // هەڵسەنگاندنی دەقی ژمارەیی بە + - * / بە شێوەیەکی سەلامەت (بێ eval)
  function evalArith(s) {
    const tokens = s.match(/(\d+(\.\d+)?|[+\-*/])/g);
    if (!tokens || !/^\d/.test(tokens[0])) return NaN;
    let cur = parseFloat(tokens[0]);
    const out = [];
    const ops = [];
    let i = 1;
    while (i < tokens.length) {
      const op = tokens[i];
      const num = parseFloat(tokens[i + 1]);
      if (!Number.isFinite(num)) return NaN;
      if (op === '*') cur *= num;
      else if (op === '/') cur /= num;
      else { out.push(cur); ops.push(op); cur = num; }
      i += 2;
    }
    out.push(cur);
    let total = out[0];
    for (let k = 0; k < ops.length; k++) total = ops[k] === '+' ? total + out[k + 1] : total - out[k + 1];
    return total;
  }

  const hasOperator = v => /[+\-*/]/.test(String(v).replace(/^[-+]/, ''));

  function cleanInt(v) {
    if (v === null || v === undefined || v === '') return 0;
    const str = toLatinDigits(String(v)).trim();
    // ئەگەر دەقی کۆکردنەوە/کەمکردنەوە بێت (10+20+30) کۆی گشتی هەڵبسەنگێنە
    if (hasOperator(str)) {
      let s = str.replace(/[\s,]/g, '').replace(/٫/g, '.');
      s = s.replace(/^\+/, '');
      if (s.startsWith('-')) s = '0' + s;
      if (/^\d+(\.\d+)?([+\-*/]\d+(\.\d+)?)*$/.test(s)) {
        const r = evalArith(s);
        if (Number.isFinite(r)) return Math.round(r);
      }
    }
    const withoutDecimals = str.split(/[\.,٫]/)[0];
    const cleaned = withoutDecimals.replace(/[^\d-]/g, '');
    if (cleaned === '' || cleaned === '-') return 0;
    const n = parseInt(cleaned, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function fmtNum(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = cleanInt(v);
    return n.toLocaleString('en-US');
  }

  function fmtMoney(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = cleanInt(v);
    return n.toLocaleString('en-US') + ' د.ع';
  }

  /* ---------------- بەروار و کات (کاتی ناوخۆیی) ---------------- */

  function pad2(n) { return String(n).padStart(2, '0'); }

  function todayStr(d = new Date()) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function monthStartStr(d = new Date()) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  }

  function monthEndStr(d = new Date()) {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(lastDay)}`;
  }

  function nowTime(d = new Date()) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function timeToMinutes(t) {
    if (!t) return null;
    const m = /^(\d{1,2}):(\d{2})/.exec(String(t).trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  function daysAgoStr(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return todayStr(d);
  }

  /** ڕۆژەکانی حەفتە بە کوردی — بەپێی getDay() (یەکشەممە = ٠) */
  const KU_WEEKDAYS = ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'];
  function weekdayKu(d = new Date()) {
    return KU_WEEKDAYS[d.getDay()] || '';
  }

  /** بەروار بە شێوەی خوێندنی کوردی: ١٠ ئەیلوول ٢٠٢٦ */
  const KU_MONTHS = ['کانوونی دووەم', 'شوبات', 'ئازار', 'نیسان', 'ئایار', 'حوزەیران', 'تەمموز', 'ئاب', 'ئەیلوول', 'تشرینی یەکەم', 'تشرینی دووەم', 'کانوونی یەکەم'];
  function fmtDateHuman(dateStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
    if (!m) return esc(dateStr);
    return `${Number(m[3])} ${KU_MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  }

  /* ---------------- ئاگادارکردنەوە (Toast) ---------------- */

  const TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ', warning: '!' };

  function toast(message, type = 'success', duration = 3200) {
    let wrap = document.getElementById('toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'toast-wrap';
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-ico">${TOAST_ICONS[type] || 'ℹ'}</span><span class="toast-msg">${esc(message)}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  /* ---------------- مۆدال ---------------- */

  function openModal({ title, body, actions = [], wide = false, size = '', onClose = null }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const sizeClass = size ? `modal-${size}` : (wide ? 'modal-wide' : '');
    backdrop.innerHTML = `
      <div class="modal ${sizeClass}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${esc(title)}</h3>
          <button class="icon-btn modal-close" type="button" aria-label="داخستن">✕</button>
        </div>
        <div class="modal-body"></div>
        ${actions.length ? '<div class="modal-foot"></div>' : ''}
      </div>`;

    const bodyEl = backdrop.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);

    const foot = backdrop.querySelector('.modal-foot');
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${a.className || 'btn-primary'}`;
      btn.innerHTML = a.label;
      btn.addEventListener('click', () => a.onClick && a.onClick(backdrop));
      foot.appendChild(btn);
    });

    const close = () => {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 220);
      if (onClose) onClose();
    };
    backdrop.querySelector('.modal-close').addEventListener('click', close);
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    });

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));
    return { backdrop, close, body: bodyEl };
  }

  function confirmDialog(message, { danger = false, okLabel = 'بەڵێ', cancelLabel = 'نەخێر' } = {}) {
    return new Promise(resolve => {
      let settled = false;
      const doResolve = val => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };
      const { close } = openModal({
        title: 'دڵنیاییت؟',
        body: `<p class="confirm-msg">${esc(message)}</p>`,
        actions: [
          { label: cancelLabel, className: 'btn-ghost', onClick: () => { doResolve(false); close(); } },
          { label: okLabel, className: danger ? 'btn-danger' : 'btn-primary', onClick: () => { doResolve(true); close(); } },
        ],
        onClose: () => doResolve(false),
      });
    });
  }

  /* ---------------- ئۆتۆکۆمپلیت ---------------- */

  /**
   * autocomplete(inputEl, getItems, { onSelect })
   * getItems: ()=>[{label, search}] — لیستی پێشنیارەکان
   */
  function autocomplete(inputEl, getItems, { onSelect = null, minChars = 0 } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'ac-wrap';
    inputEl.parentNode.insertBefore(wrap, inputEl);
    wrap.appendChild(inputEl);

    const list = document.createElement('div');
    list.className = 'ac-list';
    list.setAttribute('role', 'listbox');
    wrap.appendChild(list);

    let items = [], filtered = [], active = -1;

    const norm = s => toLatinDigits(String(s || ''))
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ی').replace(/ك/g, 'ک')
      .replace(/\s+/g, ' ').trim().toLowerCase();

    function hide() { list.classList.remove('open'); active = -1; }

    function render() {
      if (!filtered.length) { hide(); return; }
      list.innerHTML = filtered.map((it, i) =>
        `<button type="button" class="ac-item ${i === active ? 'active' : ''}" role="option">${esc(it.label)}</button>`).join('');
      list.classList.add('open');
      list.querySelectorAll('.ac-item').forEach((btn, i) => {
        btn.addEventListener('mousedown', e => { e.preventDefault(); pick(i); });
      });
    }

    function pick(i) {
      const it = filtered[i];
      if (!it) return;
      inputEl.value = it.label;
      hide();
      if (onSelect) onSelect(it);
    }

    function update() {
      const q = norm(inputEl.value);
      items = getItems() || [];
      filtered = (q.length > minChars
        ? items.filter(it => norm(it.search ?? it.label).includes(q))
        : items);
      active = -1;
      render();
    }

    inputEl.addEventListener('input', update);
    inputEl.addEventListener('focus', update);
    inputEl.addEventListener('blur', () => setTimeout(hide, 140));
    inputEl.addEventListener('keydown', e => {
      if (!list.classList.contains('open')) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
      else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); pick(active); } }
      else if (e.key === 'Escape') hide();
    });
  }

  /* ---------------- هەمەجۆر ---------------- */

  function avatarHtml(user, size = 44) {
    const initial = esc((user?.username || '؟').trim().charAt(0));
    if (user?.avatar_url) {
      return `<img class="avatar" src="${user.avatar_url}" alt="${esc(user.username)}" style="width:${size}px;height:${size}px">`;
    }
    return `<div class="avatar avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px">${initial}</div>`;
  }

  function setLoading(el, on) { el.classList.toggle('loading', !!on); }

  function btnLoading(btn, on, text = 'چاوەڕوان بە...') {
    if (!btn) return;
    if (on) {
      if (!btn.dataset.originalHtml) {
        btn.dataset.originalHtml = btn.innerHTML;
      }
      btn.disabled = true;
      btn.classList.add('btn-loading');
      btn.innerHTML = `<span class="btn-spinner"></span> <span>${esc(text)}</span>`;
    } else {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  /* ---------------- هاوتاکردن و نۆرمالایز ---------------- */

  function norm(s) {
    return toLatinDigits(String(s || ''))
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ىي]/g, 'ی')
      .replace(/[ك]/g, 'ک')
      .replace(/[\u064B-\u065F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function userMatches(fieldValue, username) {
    if (!fieldValue || !username) return false;
    const fNorm = norm(fieldValue);
    const target = norm(username);
    if (fNorm === target) return true;
    if (fNorm.replace(/\s*(دوو|سێ)$/, '').trim() === target.replace(/\s*(دوو|سێ)$/, '').trim()) return true;

    const parts = String(fieldValue).split(/(?:\s+و\s+|\s*\(\s*و\s*\)\s*|\s*[,،&+/]\s*)/).filter(Boolean);
    const targetParts = String(username).split(/(?:\s+و\s+|\s*\(\s*و\s*\)\s*|\s*[,،&+/]\s*)/).filter(Boolean);

    return parts.some(p => {
      const pNorm = norm(p);
      const base = pNorm.replace(/\s*(دوو|سێ)$/, '').trim();
      return targetParts.some(t => {
        const tNorm = norm(t);
        const tBase = tNorm.replace(/\s*(دوو|سێ)$/, '').trim();
        return pNorm === tNorm || base === tNorm || pNorm === tBase || base === tBase;
      });
    });
  }

  /* ---------------- ئایدی بەکارهێنەران (usersv2) ---------------- */

  /** خوێندنەوەی «12,34» یان ١٢ → [12, 34] — بۆ ستوونەکانی *_id لە تۆمارەکاندا */
  function parseIdList(v) {
    if (v === null || v === undefined) return [];
    const s = toLatinDigits(String(v)).trim();
    if (!s) return [];
    return s.split(/[,،\s]+/).map(x => Number(x)).filter(n => Number.isFinite(n) && n > 0);
  }

  /**
   * هاوتاکردنی تۆمارێک لەگەڵ بەکارهێنەرێک بەپێی خانە (driver / distributor / delegate).
   * ئەگەر تۆمارەکە ئایدی هەیە (ستوونی *_id) تەنها بە ئایدی بەراورد دەکرێت — ئەمە
   * ڕێگری لە هەڵە دەکات کاتێک دوو بەکارهێنەر ناوی هاوشێوەیان هەیە یان ناوێک دەگۆڕدرێت.
   * تۆمارە کۆنەکان کە ئایدیان نییە بە ناو بەراورد دەکرێن (هاوتاکردنی کۆن).
   */
  function recMatchesUser(rec, field, user) {
    if (!rec || !field || !user) return false;
    const ids = parseIdList(rec[field + '_id']);
    const uid = Number(user.id);
    if (ids.length && Number.isFinite(uid)) return ids.includes(uid);
    return userMatches(rec[field], user.username);
  }

  function calcDuration(startTime, endTime) {
    const m = durationMinutes(startTime, endTime);
    if (m === null) return '—';
    return fmtDuration(m);
  }

  /** جیاوازی دوو کات بە خولەک — null ئەگەر یەکێکیان نەبوو */
  function durationMinutes(startTime, endTime) {
    const s = timeToMinutes(startTime);
    const e = timeToMinutes(endTime);
    if (s === null || e === null) return null;
    let diff = e - s;
    if (diff < 0) diff += 24 * 60;
    return diff;
  }

  /** خوێندنەوەی "8:30" وەک ماوە → خولەک */
  function parseDurationMin(t) {
    const m = /^(\d{1,3}):(\d{1,2})$/.exec(String(t || '').trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }

  /** کاتی کارکردنی تۆمار — work_time ئەگەر دانراوە، ئەگینا دەرچوون → گەشتنەوە */
  function recordDurationMinutes(r) {
    if (!r) return null;
    const w = parseDurationMin(r.work_time);
    if (w !== null) return w;
    return durationMinutes(r.record_time, r.arrival_time);
  }

  /** خولەک → "X کاتژمێر و Y خولەک" */
  function fmtDuration(mins) {
    if (mins === null || mins === undefined || Number.isNaN(mins)) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h} کاتژمێر و ${m} خولەک`;
    return `${m} خولەک`;
  }

  /** ڕیزکردنی بەکارهێنەران بەپێی پیشە پاشان بەپێی ناو (ئەلفوبێ) */
  function sortUsers(users) {
    const order = [CONFIG.PROFESSION_DRIVER, CONFIG.PROFESSION_DISTRIBUTOR, CONFIG.PROFESSION_DELEGATE, CONFIG.PROFESSION_SUPERVISOR];
    return [...(users || [])].sort((a, b) => {
      const ia = order.indexOf(a.profession), ib = order.indexOf(b.profession);
      const pa = ia === -1 ? 99 : ia, pb = ib === -1 ? 99 : ib;
      if (pa !== pb) return pa - pb;
      return String(a.username || '').localeCompare(String(b.username || ''), 'ckb');
    });
  }

  /* ---------------- ویندۆی پڕ بە شاشەی وردەکاریی ڕیز — تەنها دەق، بێ سکڕۆڵ ---------------- */

  function openRecordFullscreen(rec, { onEdit = null, onDelete = null } = {}) {
    if (!rec) return null;

    const isDone = !!rec.arrival_time;

    const body = document.createElement('div');
    body.className = 'rec-fullscreen-body';
    body.innerHTML = `
      <div class="fs-plain-list">
        <div class="fs-plain-item"><span class="lbl">دۆخ</span><b class="val ${isDone ? 'ok' : 'warn'}">${isDone ? 'گەشت تەواوبوو' : 'لە کاردایە'}</b></div>
        <div class="fs-plain-item"><span class="lbl">بەروار</span><b class="val">${esc(rec.record_date || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">ڕۆژی حەفتە</span><b class="val">${esc(weekdayKu(rec.record_date ? new Date(rec.record_date + 'T00:00:00') : new Date()))}</b></div>
        <div class="fs-plain-item"><span class="lbl">ناوچە / زۆن</span><b class="val hl">${esc(rec.zone || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">شۆفێر</span><b class="val hl">${esc(rec.driver || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">دابەشکار</span><b class="val">${esc(rec.distributor || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">مەندوب</span><b class="val">${esc(rec.delegate || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">ژمارەی سەیارە</span><b class="val">${esc(rec.vehicle || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">کێشی بار</span><b class="val">${fmtNum(rec.cargo_weight)} کگم</b></div>
        <div class="fs-plain-item"><span class="lbl">پارچەکان</span><b class="val">${fmtNum(rec.pieces_count)}</b></div>
        <div class="fs-plain-item"><span class="lbl">ژمارەی وەسڵ</span><b class="val">${fmtNum(rec.receipt_number)}</b></div>
        <div class="fs-plain-item"><span class="lbl">کاتی دەرچوون</span><b class="val">${esc(rec.record_time || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">کاتی ناو زۆن</span><b class="val">${esc(rec.in_zone_time || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">کاتی دەرێی زۆن</span><b class="val">${esc(rec.out_zone_time || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">کاتی گەشتنەوە</span><b class="val">${esc(rec.arrival_time || '—')}</b></div>
        <div class="fs-plain-item"><span class="lbl">کاتی کارکردن</span><b class="val ${rec.work_time ? 'ok' : ''}">${rec.work_time ? esc(rec.work_time) : calcDuration(rec.record_time, rec.arrival_time)}</b></div>
        <div class="fs-plain-item"><span class="lbl">پارەی هێنراوە</span><b class="val money">${fmtMoney(rec.collected_money)}</b></div>
      </div>
    `;

    const actions = [];
    const hasCustom = typeof onEdit === 'function' || typeof onDelete === 'function';
    if (typeof onEdit === 'function') {
      actions.push({
        label: '✏️ دەستکاری داتا',
        className: 'btn-primary',
        onClick: backdrop => {
          backdrop.classList.remove('open');
          setTimeout(() => backdrop.remove(), 220);
          onEdit(rec);
        }
      });
    }
    actions.push({
      label: 'داخستن',
      className: hasCustom ? 'btn-ghost' : 'btn-primary',
      onClick: backdrop => {
        backdrop.classList.remove('open');
        setTimeout(() => backdrop.remove(), 220);
      }
    });
    if (typeof onDelete === 'function') {
      actions.push({
        label: '🗑️ سڕینەوە',
        className: 'btn-danger',
        onClick: backdrop => {
          backdrop.classList.remove('open');
          setTimeout(() => backdrop.remove(), 220);
          onDelete(rec);
        }
      });
    }

    return openModal({
      title: `وردەکاریی تۆمار — ${rec.zone || 'گەشت'}`,
      size: 'wide',
      body,
      actions
    });
  }

  /** چاوەڕوانی ماکڕۆتاسک */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ---------------- لابردنی خۆکاری پۆینت و ژمارەی دوای پۆینت لە تەواوی سیستەمدا ---------------- */
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;
    if (target.type === 'number' || target.inputMode === 'numeric' || target.classList?.contains('num-only')) {
      if (e.key === '.' || e.key === ',' || e.key === '٫' || e.key === 'Decimal' || e.keyCode === 190 || e.keyCode === 110 || e.keyCode === 188) {
        e.preventDefault();
      }
    }
  }, true);

  document.addEventListener('input', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;
    if (target.type === 'number' || target.inputMode === 'numeric' || target.classList?.contains('num-only')) {
      if (target.value && /[\.,٫]/.test(target.value)) {
        target.value = target.value.split(/[\.,٫]/)[0];
      }
    }
  }, true);

  document.addEventListener('paste', (e) => {
    const target = e.target;
    if (!target || target.tagName !== 'INPUT') return;
    if (target.type === 'number' || target.inputMode === 'numeric' || target.classList?.contains('num-only')) {
      const text = (e.clipboardData || window.clipboardData)?.getData('text');
      if (text && /[\.,٫]/.test(text)) {
        e.preventDefault();
        const clean = toLatinDigits(text).split(/[\.,٫]/)[0].replace(/[^\d-]/g, '');
        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
          document.execCommand('insertText', false, clean);
        } else {
          target.value = clean;
        }
      }
    }
  }, true);

  /* ---------------- کیبۆردی تایبەتی سیستەم ---------------- */

  const keypad = { el: null, input: null, layout: null };
  const KURDISH_KEY_ROWS = [
    ['ئ', 'ا', 'ب', 'پ', 'ت', 'ج', 'چ', 'ح', 'خ'],
    ['د', 'ر', 'ڕ', 'ز', 'ژ', 'س', 'ش', 'ع', 'غ'],
    ['ف', 'ڤ', 'ق', 'ک', 'گ', 'ل', 'ڵ', 'م', 'ن'],
    ['ه', 'ە', 'و', 'ۆ', 'ۇ', 'ی', 'ێ', 'ء', 'ؤ'],
  ];

  const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

  /* هەر جۆرێکی کیبۆرد ڕێکخستنی جیای خۆی هەیە — پیت و ژمارە بە جیا ئۆن/ئۆف دەکرێن */
  const keypadEnabledFor = t => {
    try {
      if (!coarsePointer()) return false;
      const s = Store.getSettings();
      return isNumericKeypadField(t) ? !!s.customKeypadNum : !!s.customKeypadText;
    } catch (_) { return false; }
  };

  const isNumericKeypadField = t =>
    t instanceof HTMLInputElement && (t.type === 'number' || t.inputMode === 'numeric' || t.classList.contains('num-only'));

  const isKeypadField = t => {
    if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) || t.disabled) return false;
    if (t instanceof HTMLInputElement && ['button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden', 'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week'].includes(t.type)) return false;
    return !t.readOnly || t.dataset.kpReadonly === '1';
  };

  function updateKeypadInput(inp, value, caret) {
    inp.value = value;
    try { inp.setSelectionRange(caret, caret); } catch (_) {}
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertKeypadText(inp, text) {
    const start = inp.selectionStart ?? inp.value.length;
    const end = inp.selectionEnd ?? start;
    updateKeypadInput(inp, inp.value.slice(0, start) + text + inp.value.slice(end), start + text.length);
  }

  function deleteKeypadText(inp) {
    const start = inp.selectionStart ?? inp.value.length;
    const end = inp.selectionEnd ?? start;
    if (start !== end) updateKeypadInput(inp, inp.value.slice(0, start) + inp.value.slice(end), start);
    else if (start > 0) updateKeypadInput(inp, inp.value.slice(0, start - 1) + inp.value.slice(end), start - 1);
  }

  function keypadMarkup(layout) {
    const key = (k, label, cls = '') => `<button type="button" class="${cls}" data-k="${k}" tabindex="-1">${label}</button>`;
    const charKey = char => `<button type="button" class="kp-letter" data-k="char" data-char="${char}" tabindex="-1">${char}</button>`;
    /* کیبۆردی پیت — تەنها بۆ خانەکانی دەق */
    if (layout === 'text') {
      return `
        <div class="kp-text-layout">
          ${KURDISH_KEY_ROWS.map(row => `<div class="kp-row">${row.map(charKey).join('')}</div>`).join('')}
          <div class="kp-row kp-controls">
            ${key('space', 'بۆشایی', 'kp-space')}${key('del', '⌫', 'kp-del')}${key('done', '✓', 'kp-done')}
          </div>
        </div>`;
    }
    /* کیبۆردی ژمارە — + و − تێدایە چونکە کیبۆردی ڕەسەنی iOS لە کاتی نووسینی ژمارەدا پیشانی نادات */
    return `
      <div class="kp-number-layout">
        ${key('7', '7')}${key('8', '8')}${key('9', '9')}${key('del', '⌫', 'kp-del')}
        ${key('4', '4')}${key('5', '5')}${key('6', '6')}${key('+', '+', 'kp-op')}
        ${key('1', '1')}${key('2', '2')}${key('3', '3')}${key('minus', '−', 'kp-op')}
        ${key('0', '0', 'kp-zero')}${key('clear', 'C', 'kp-clear')}${key('done', '✓', 'kp-done')}
      </div>`;
  }

  function renderKeypad(layout) {
    if (!keypad.el) return;
    keypad.layout = layout;
    keypad.el.dataset.layout = layout;
    keypad.el.innerHTML = keypadMarkup(layout);
    syncKeypadSpace();
  }

  /* ڕادەگەیەنێت کیبۆردەکە کراوەتەوە + بەرزی ڕاستەقینەی دەنێرێت بۆ CSS بۆ دروستکردنی شوێنی سکڕۆڵ */
  function syncKeypadSpace() {
    if (!keypad.el) return;
    document.body.classList.add('keypad-open');
    document.body.style.setProperty('--kp-h', `${Math.round(keypad.el.offsetHeight)}px`);
  }

  function buildKeypadEl() {
    const el = document.createElement('div');
    el.className = 'num-keypad';
    el.addEventListener('pointerdown', e => e.preventDefault());
    el.addEventListener('click', e => {
      const btn = e.target.closest('button[data-k]');
      if (!btn) return;
      const inp = keypad.input;
      if (!inp || !inp.isConnected) { closeKeypad(); return; }
      const k = btn.dataset.k;
      if (k === 'done') { closeKeypad(); inp.blur(); return; }
      if (k === 'del') { deleteKeypadText(inp); return; }
      if (k === 'clear') { updateKeypadInput(inp, '', 0); return; }
      if (k === 'space') { insertKeypadText(inp, ' '); return; }
      if (k === 'char') { insertKeypadText(inp, btn.dataset.char); return; }
      insertKeypadText(inp, k === 'minus' ? '-' : k);
    });
    document.body.appendChild(el);
    return el;
  }

  function keepKeypadFieldVisible(inp) {
    const pass = behavior => () => {
      if (keypad.input !== inp || !keypad.el?.classList.contains('open') || !inp.isConnected) return;
      /* خانەکە لەگەڵ ناونیشانەکەی (label) بۆ سەرەوە بچێت — لیست بۆکسەکەی ژێری بەتەواوەتی ببینرێت */
      const anchor = inp.closest('.field') || inp;
      const anchorRect = anchor.getBoundingClientRect();
      const keypadTop = keypad.el.getBoundingClientRect().top;
      const modalBody = inp.closest('.modal-body');
      const topGap = 12;
      /* 5px بۆشایی + 230px بەرزی لیستی ئۆتۆکۆمپلیت لە ژێر خانەکەوە */
      const listRoom = 240;
      const bottomLimit = keypadTop - 16;

      if (modalBody) {
        const bodyTop = modalBody.getBoundingClientRect().top + topGap;
        const delta = Math.max(anchorRect.top - bodyTop, anchorRect.bottom + listRoom > bottomLimit ? anchorRect.bottom + listRoom - bottomLimit : 0);
        if (delta > 2) modalBody.scrollBy({ top: delta, behavior });
        return;
      }

      /* 84px = لە ژێر توپبارەکە */
      const delta = Math.max(anchorRect.top - 84, anchorRect.bottom + listRoom > bottomLimit ? anchorRect.bottom + listRoom - bottomLimit : 0);
      if (delta > 2) window.scrollBy({ top: delta, behavior });
    };
    /* دوو هەنگاو: یەکەم بە سکڕۆڵی نەرم، دووەم ڕاستەوخۆ بۆ جێگیری کۆتایی */
    setTimeout(pass('smooth'), 240);
    setTimeout(pass('auto'), 700);
  }

  function openKeypad(inp) {
    if (!keypad.el) keypad.el = buildKeypadEl();
    const changedField = keypad.input !== inp;
    keypad.input = inp;
    if (!inp.dataset.kpReadonly) {
      inp.dataset.kpReadonly = '1';
      inp.readOnly = true;
    }
    if (changedField || !keypad.el.classList.contains('open')) {
      renderKeypad(isNumericKeypadField(inp) ? 'numeric' : 'text');
    }
    keypad.el.classList.add('open');
    syncKeypadSpace();
    keepKeypadFieldVisible(inp);
  }

  function closeKeypad() {
    if (keypad.input) {
      if (keypad.input.dataset.kpReadonly) {
        keypad.input.readOnly = false;
        delete keypad.input.dataset.kpReadonly;
      }
      keypad.input = null;
      keypad.layout = null;
    }
    if (keypad.el) keypad.el.classList.remove('open');
    document.body.classList.remove('keypad-open');
    document.body.style.removeProperty('--kp-h');
  }

  document.addEventListener('focusin', e => {
    const t = e.target;
    if (keypad.input && keypad.input !== t) closeKeypad();
    if (isKeypadField(t) && keypadEnabledFor(t)) openKeypad(t);
  });

  document.addEventListener('focusout', e => {
    if (keypad.input === e.target) closeKeypad();
  });

  document.addEventListener('pointerdown', e => {
    const t = e.target;
    if (isKeypadField(t) && keypadEnabledFor(t)) {
      openKeypad(t);
      return;
    }
    if (keypad.input && keypad.el && !keypad.el.contains(t)) closeKeypad();
  }, true);

  /* ---------------- بردنی خانەی هەڵبژێردراو بۆ سەرەوەی شاشە لەسەر مۆبایل ---------------- */

  document.addEventListener('focusin', e => {
    const t = e.target;
    if (!(t instanceof HTMLElement) || !t.matches('input, select, textarea')) return;
    if (['checkbox', 'radio', 'button', 'submit', 'file', 'color', 'range'].includes(t.type)) return;
    if (!coarsePointer() || (isKeypadField(t) && keypadEnabledFor(t))) return;
    setTimeout(() => {
      if (!t.isConnected) return;
      const modalBody = t.closest('.modal-body');
      if (modalBody) {
        const top = t.getBoundingClientRect().top - modalBody.getBoundingClientRect().top + modalBody.scrollTop - 12;
        modalBody.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      } else {
        const y = t.getBoundingClientRect().top + window.scrollY - 84;
        if (y > window.scrollY + 4) window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 350);
  });

  /* ---------------- نۆتیفیکەیشنی گشتی — هەر یوسەرێک تەنها ئەوانەی ناوی خۆی تێدایە دەبینێت؛ بەڕێوەبەر هەمووی ---------------- */

  const isSupervisorUser = u => u && (u.profession === CONFIG.PROFESSION_SUPERVISOR || u.profession === 'بەڕێوبەر' || u.profession === 'بەریوبەر');

  function notifMatchesUser(text, user) {
    if (!user) return false;
    const name = norm(user.username || '');
    return !!name && norm(text || '').includes(name);
  }

  async function fetchVisibleNotifications() {
    const rows = await API.Notifications.list() || [];
    const u = App.getUser();
    if (isSupervisorUser(u)) return rows;
    return rows.filter(n => notifMatchesUser(n.action, u));
  }

  function fmtNotifTs(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${date} • ${time}`;
  }

  /** نوێکردنەوەی باجی زەنگ — ژمارەی ئەو نۆتیفیکەیشانەی دوای دواین بینین هاتوون */
  async function refreshNotifBadge(badgeEl) {
    if (!badgeEl) return;
    try {
      const mine = await fetchVisibleNotifications();
      const seen = Number(localStorage.getItem(notifSeenKey()) || 0);
      const newNotifs = mine.filter(n => new Date(n.created_at).getTime() > seen);
      const unread = newNotifs.length;
      badgeEl.textContent = unread > 99 ? '99+' : String(unread);
      badgeEl.style.display = unread > 0 ? '' : 'none';

      // سیستەمی ئاگادارکردنەوەی سەر شاشە بۆ نۆتیفیکەیشنی نوێ
      const lastAlertTs = Number(localStorage.getItem('dlv_sys_alert_ts') || 0);
      const toAlert = mine.filter(n => new Date(n.created_at).getTime() > Math.max(seen, lastAlertTs));
      
      if (toAlert.length > 0) {
        localStorage.setItem('dlv_sys_alert_ts', String(new Date(toAlert[0].created_at).getTime()));
        if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            toAlert.reverse().forEach(n => {
              let shortMsg = n.action;
              const actionMatch = n.action.match(/^(.*?)\s*—/);
              const actorMatch = n.action.match(/\(لەلایەن\s*(.*?)\)$/);
              if (actionMatch && actorMatch) {
                shortMsg = `${actorMatch[1]} : ${actionMatch[1]}`;
              } else if (actionMatch) {
                shortMsg = actionMatch[1];
              }
              reg.showNotification('نۆتیفیکەیشن', {
                body: shortMsg,
                icon: './icon-192.png',
                badge: './icon-192.png',
                tag: 'sys-alert-' + n.id,
                renotify: true,
                silent: false
              });
            });
          }).catch(() => {});
        }
      }
    } catch (_) { /* بێدەنگ */ }
  }

  const notifSeenKey = () => `dlv_notif_seen_ts_${App.getUser()?.id || 'x'}`;

  async function openNotificationsPanel() {
    const overlay = document.createElement('div');
    overlay.className = 'notif-panel-overlay';
    overlay.innerHTML = `
      <div class="notif-panel-backdrop"></div>
      <div class="notif-drawer">
        <div class="notif-drawer-head">
          <h3>🔔 نۆتیفیکەیشنەکان</h3>
          <button class="btn btn-ghost btn-sm" data-notif-close type="button">✕ داخستن</button>
        </div>
        <div class="notif-drawer-body">
          <div class="notif-empty"><span class="notif-empty-ico">⏳</span>بارکردن...</div>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.notif-panel-backdrop').addEventListener('click', close);
    overlay.querySelector('[data-notif-close]').addEventListener('click', close);

    const bodyEl = overlay.querySelector('.notif-drawer-body');
    let notifs = [];
    try {
      notifs = await fetchVisibleNotifications();
    } catch (err) {
      bodyEl.innerHTML = `<div class="notif-empty"><span class="notif-empty-ico">⚠️</span>هەڵە لە هێنانی نۆتیفیکەیشنەکان: ${esc(err.message)}</div>`;
      return;
    }

    // نیشانکردنی وەک بینراو — باجی زەنگ سفر دەبێتەوە
    try { localStorage.setItem(notifSeenKey(), String(Date.now())); } catch (_) {}
    document.dispatchEvent(new CustomEvent('dlv-notif-seen'));

    if (!notifs.length) {
      bodyEl.innerHTML = `<div class="notif-empty"><span class="notif-empty-ico">🔔</span>هیچ نۆتیفیکەیشنێک نییە</div>`;
      return;
    }

    bodyEl.innerHTML = notifs.map(n => `
      <div class="notif-item read">
        <div class="notif-item-meta"><span>${esc(fmtNotifTs(n.created_at))}</span></div>
        <div class="notif-item-msg">${esc(n.action || '')}</div>
      </div>`).join('');
  }

  return {
    esc, toLatinDigits, cleanInt, hasOperator, fmtNum, fmtMoney, todayStr, monthStartStr, monthEndStr, nowTime, timeToMinutes, daysAgoStr, fmtDateHuman,
    weekdayKu, toast, openModal, confirmDialog, autocomplete, avatarHtml, setLoading, btnLoading, sleep,
    norm, userMatches, parseIdList, recMatchesUser, calcDuration, durationMinutes, parseDurationMin, recordDurationMinutes, fmtDuration,
    sortUsers, openRecordFullscreen,
    fetchVisibleNotifications, openNotificationsPanel, refreshNotifBadge
  };
})();
