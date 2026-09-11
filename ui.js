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

  function fmtNum(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return esc(v);
    return n.toLocaleString('en-US');
  }

  function fmtMoney(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (Number.isNaN(n)) return esc(v);
    return n.toLocaleString('en-US') + ' د.ع';
  }

  /* ---------------- بەروار و کات (کاتی ناوخۆیی) ---------------- */

  function pad2(n) { return String(n).padStart(2, '0'); }

  function todayStr(d = new Date()) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

  /** چاوەڕوانی ماکڕۆتاسک */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { esc, toLatinDigits, fmtNum, fmtMoney, todayStr, nowTime, timeToMinutes, daysAgoStr, fmtDateHuman, toast, openModal, confirmDialog, autocomplete, avatarHtml, setLoading, btnLoading, sleep };
})();
