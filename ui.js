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
  function cleanInt(v) {
    if (v === null || v === undefined || v === '') return 0;
    const str = toLatinDigits(String(v)).trim();
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

  function openRecordFullscreen(rec) {
    if (!rec) return;

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

    openModal({
      title: `وردەکاریی تۆمار — ${rec.zone || 'گەشت'}`,
      size: 'fullscreen',
      body,
      actions: [
        {
          label: 'داخستن',
          className: 'btn-primary',
          onClick: backdrop => {
            backdrop.classList.remove('open');
            setTimeout(() => backdrop.remove(), 220);
          }
        }
      ]
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

  return {
    esc, toLatinDigits, cleanInt, fmtNum, fmtMoney, todayStr, monthStartStr, monthEndStr, nowTime, timeToMinutes, daysAgoStr, fmtDateHuman,
    weekdayKu, toast, openModal, confirmDialog, autocomplete, avatarHtml, setLoading, btnLoading, sleep,
    norm, userMatches, parseIdList, recMatchesUser, calcDuration, durationMinutes, parseDurationMin, recordDurationMinutes, fmtDuration,
    sortUsers, openRecordFullscreen
  };
})();
