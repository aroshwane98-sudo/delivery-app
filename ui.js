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

    // سکڕۆڵی ماوس لەسەر خانەکە — گۆڕینی نرخەکە بە دانە دانەی وشەکانی لیست بۆکسەکە
    // (تەنها کاتێک ماوس لەسەر خانەکە بێت کار دەکات — wheel تەنها بۆ ئەو ئەلێمێنتە دێت)
    inputEl.addEventListener('wheel', e => {
      const all = getItems() || [];
      if (!all.length) return; // لیست بەتاڵە — سکڕۆڵی ئاسایی پەڕەکە
      e.preventDefault();
      const cur = norm(inputEl.value);
      let idx = all.findIndex(it => norm(it.label) === cur);
      const dir = e.deltaY > 0 ? 1 : -1; // سکڕۆڵ بەرەو خوارەوە → دانەی داهاتوو
      idx = idx === -1
        ? (dir > 0 ? 0 : all.length - 1) // نرخی ئێستا لە لیستەکەدا نییە — لە سەرەتا/کۆتاییوە دەست پێبکە
        : (idx + dir + all.length) % all.length;
      inputEl.value = all[idx].label;
      hide();
      if (onSelect) onSelect(all[idx]);
    }, { passive: false });
  }

  /* ---------------- هەمەجۆر ---------------- */

  function avatarHtml(user, size = 44) {
    const initial = esc((user?.username || '؟').trim().charAt(0));
    // data-uid — داگرتنی ئاڤاتار لە هەر شوێنێک ویندۆی زانیاری یوسەرەکە دەکاتەوە
    const attrs = user?.id !== undefined && user?.id !== null
      ? ` data-uid="${esc(String(user.id))}" data-uname="${esc(user.username || '')}" data-uprof="${esc(user.profession || '')}"`
      : '';
    if (user?.avatar_url) {
      return `<img class="avatar" src="${user.avatar_url}" alt="${esc(user.username)}" style="width:${size}px;height:${size}px"${attrs}>`;
    }
    return `<div class="avatar avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px"${attrs}>${initial}</div>`;
  }

  /* ---------------- پەیوەندی — ویندۆی یوسەر و ئۆپشنەکانی ژمارە تەلەفۆن ---------------- */

  // ئایکۆنەکانی ئەپ — شێوەی squircle ی تاریک بە ئایکۆنی سپی (One UI)
  const PHONE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>';
  const WHATSAPP_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>';
  const TELEGRAM_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.53 11.72 22.2 3.09c.86-.38 1.79.44 1.55 1.36l-3.1 12.02c-.2.78-1.1 1.12-1.76.68l-3.95-2.63-1.98 1.94c-.5.5-1.36.29-1.57-.38l-1.24-3.98-3.99-1.25c-.73-.23-.75-1.28-.03-1.55z"/></svg>';

  /** دوگمەی ژمارە تەلەفۆن — بە ئایکۆنی تەلەفۆن (بۆ لیستی پەیوەندی و ویندۆی یوسەر) */
  function phoneChipHtml(number) {
    const raw = String(number || '').trim();
    if (!raw) return '';
    return `<button type="button" class="phone-chip" data-phone="${esc(raw)}"><span class="chip-ico">${PHONE_SVG}</span><span dir="ltr">${esc(raw)}</span></button>`;
  }

  /** ژمارە بۆ فۆرماتی نێودەوڵەتی — بۆ واتسئەپ و تەلەگرام (٠٧٧٠… → ٩٦٤٧٧٠…) */
  function intlPhoneDigits(raw) {
    let d = toLatinDigits(String(raw || '')).replace(/[^\d]/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    const cc = String(CONFIG.PHONE_COUNTRY_CODE || '').replace(/\D/g, '');
    if (d.startsWith('0') && cc) d = cc + d.slice(1);
    return d;
  }

  /** سێ ئۆپشنی ژمارە تەلەفۆن: تەلەفۆن / واتسئەپ / تەلەگرام — بە ئایکۆنی ئەپەکان */
  function openPhoneOptions(number) {
    const raw = String(number || '').trim();
    if (!raw) return;
    const telHref = 'tel:' + toLatinDigits(raw).replace(/[^\d+]/g, '');
    const waHref = 'https://wa.me/' + intlPhoneDigits(raw);
    const tgHref = 'tg://resolve?phone=' + intlPhoneDigits(raw);
    const body = `
      <div class="phone-actions">
        <a class="phone-opt" href="${esc(telHref)}">
          <span class="app-ico ico-phone">${PHONE_SVG}</span>
          <span class="phone-opt-txt"><b>تەلەفۆنکردن</b><span>لە ڕێگەی تەلەفۆنی مۆبایلەوە</span></span>
        </a>
        <a class="phone-opt" href="${esc(waHref)}" target="_blank" rel="noopener">
          <span class="app-ico ico-whatsapp">${WHATSAPP_SVG}</span>
          <span class="phone-opt-txt"><b>واتسئەپ</b><span>لە ڕێگەی ئەپی واتسئەپەوە</span></span>
        </a>
        <a class="phone-opt" href="${esc(tgHref)}">
          <span class="app-ico ico-telegram">${TELEGRAM_SVG}</span>
          <span class="phone-opt-txt"><b>تەلەگرام</b><span>لە ڕێگەی ئەپی تەلەگرامەوە</span></span>
        </a>
      </div>`;
    const { close } = openModal({
      title: '☎️ ' + toLatinDigits(raw),
      body,
      actions: [{ label: 'داخستن', className: 'btn-ghost', onClick: () => close() }],
    });
  }

  /** ویندۆی زانیاری یوسەر — وێنە، ناو، پیشە، شوێن و ژمارە تەلەفۆنەکان */
  async function openUserProfile(userRef) {
    let user = null;
    try {
      const ls = await Store.loadLists();
      user = (ls.users || []).find(u => String(u.id) === String(userRef?.id)) || null;
    } catch (_) { /* لەگەڵ نەبوونی ڕایەڵە — داتای ئاڤاتارەکە بەکاردێت */ }
    if (!user) user = userRef;
    if (!user) return;

    const phones = [user.phone_number_1, user.phone_number_2].map(p => String(p || '').trim()).filter(Boolean);
    const phoneBtns = phones.length
      ? phones.map(p => phoneChipHtml(p)).join('')
      : '<p class="hint" style="margin:0">هیچ ژمارەیەکی تەلەفۆن تۆمار نەکراوە</p>';
    const loc = String(user.location || '').trim();

    const body = `
      <div class="user-profile-sheet">
        <div class="ups-head">
          ${avatarHtml(user, 92)}
          <div class="ups-meta">
            <h3>${esc(user.username)}</h3>
            <span class="chip">${esc(user.profession || '—')}</span>
            ${loc ? `<span class="ups-loc">📍 ${esc(loc)}</span>` : ''}
          </div>
        </div>
        <div class="ups-phones">${phoneBtns}</div>
      </div>`;

    const { close, backdrop } = openModal({
      title: '👤 زانیاری بەکارهێنەر',
      body,
      actions: [{ label: 'داخستن', className: 'btn-ghost', onClick: () => close() }],
    });
    backdrop.querySelectorAll('.phone-chip[data-phone]').forEach(btn => {
      btn.addEventListener('click', () => openPhoneOptions(btn.dataset.phone));
    });
    // کلیک لەسەر وێنەکە لەناو ویندۆکە — پیشاندانی وێنەکە بە پڕی شاشە
    const sheetAvatar = backdrop.querySelector('.ups-head .avatar');
    if (sheetAvatar && user.avatar_url) {
      sheetAvatar.style.cursor = 'zoom-in';
      sheetAvatar.addEventListener('click', e => {
        e.stopPropagation(); // ڕێگری لە کردنەوەی دووبارەی ویندۆی زانیارییەکە
        openAvatarLightbox(user);
      });
    }
  }

  /** پیشاندانی وێنەی یوسەر بە پڕی شاشە — کلیک لەسەر هەر شوێنێک دادەخات */
  function openAvatarLightbox(user) {
    const wrap = document.createElement('div');
    wrap.className = 'avatar-lightbox';
    wrap.innerHTML = `
      <div class="avatar-lightbox-inner">
        <img src="${esc(user.avatar_url)}" alt="${esc(user.username || '')}">
        ${user.username ? `<div class="avatar-lightbox-name">${esc(user.username)}</div>` : ''}
      </div>`;
    const closeLb = () => {
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 200);
      document.removeEventListener('keydown', onKey);
    };
    const onKey = e => { if (e.key === 'Escape') closeLb(); };
    wrap.addEventListener('click', closeLb);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
  }

  // داگرتنی هەر ئاڤاتارێک لە هەموو سیستەمەکە — ڕاستەوخۆ ویندۆی یوسەرەکە دەکاتەوە
  document.addEventListener('click', e => {
    const av = e.target.closest('.avatar[data-uid]');
    if (!av) return;
    openUserProfile({ id: av.dataset.uid, username: av.dataset.uname, profession: av.dataset.uprof });
  });

  function setLoading(el, on) { el.classList.toggle('loading', !!on); }

  /* ---------------- دەستکاریکەری وێنەی پڕۆفایل (زووم و پان) ----------------
   * avatarEditor(file, { onSave }) — onSave(dataUrl) لە کاتی پاشەکەوتکردن بانگ دەکرێت.
   * هاوبەشە لە نێوان فۆڕمی ڕێکخستن و فۆڕمی بەڕێوەبردنی بەکارهێنەران. */
  function avatarEditor(file, { onSave }) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => runCropEditor(img, { onSave });
      img.onerror = () => toast('وێنەکە نەخوێنرایەوە — تکایە وێنەیەکی تر هەڵبژێرە', 'error');
      img.src = reader.result;
    };
    reader.onerror = () => toast('هەڵە لە خوێندنی فایلەکە', 'error');
    reader.readAsDataURL(file);
  }

  function runCropEditor(img, { onSave }) {
    const S = Math.min(320, Math.max(240, Math.min(window.innerWidth - 96, 340)));
    let zoom = 1;
    let tx = 0, ty = 0;
    const baseScale = Math.max(S / img.naturalWidth, S / img.naturalHeight); // cover

    const body = document.createElement('div');
    body.innerHTML = `
      <div class="crop-stage" id="crop-stage" style="width:${S}px;height:${S}px">
        <img id="crop-img" src="${img.src}" alt="" draggable="false">
        <div class="crop-grid"></div>
      </div>
      <div class="crop-tools">
        <button type="button" class="icon-btn" id="crop-zin" title="نزیککردنەوە">＋</button>
        <button type="button" class="icon-btn" id="crop-zout" title="دوورخستنەوە">－</button>
        <button type="button" class="icon-btn" id="crop-reset" title="گەڕانەوە">⟲</button>
      </div>
      <p class="hint">بە بارکردن و ڕاکێشان جێگۆڕکێ بکە — بە دوو پەنجە یان چەرخی ماوس زووم بکە.</p>`;

    const { close } = openModal({
      title: '📷 ڕێکخستنی وێنەی پڕۆفایل',
      body,
      wide: true,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        { label: 'پاشەکەوتکردن', className: 'btn-primary', onClick: (backdrop) => saveCrop(backdrop) },
      ],
    });

    const stage = body.querySelector('#crop-stage');
    const cropImg = body.querySelector('#crop-img');

    const clampPan = () => {
      const dw = img.naturalWidth * baseScale * zoom;
      const dh = img.naturalHeight * baseScale * zoom;
      const mx = Math.max(0, (dw - S) / 2);
      const my = Math.max(0, (dh - S) / 2);
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
    };

    const apply = () => {
      clampPan();
      cropImg.style.transform =
        `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${baseScale * zoom})`;
    };

    const setZoom = z => { zoom = Math.min(8, Math.max(1, z)); apply(); };

    /* — چەرخی ماوس — */
    stage.addEventListener('wheel', e => {
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.12 : 0.89));
    }, { passive: false });

    /* — ڕاکێشان و پینچ — */
    const pointers = new Map();
    let lastDist = 0;

    stage.addEventListener('pointerdown', e => {
      stage.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    stage.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        tx += e.clientX - prev.x;
        ty += e.clientY - prev.y;
        apply();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastDist > 0) setZoom(zoom * (d / lastDist));
        lastDist = d;
      }
    });
    const release = e => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastDist = 0;
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    body.querySelector('#crop-zin').addEventListener('click', () => setZoom(zoom * 1.2));
    body.querySelector('#crop-zout').addEventListener('click', () => setZoom(zoom / 1.2));
    body.querySelector('#crop-reset').addEventListener('click', () => { zoom = 1; tx = 0; ty = 0; apply(); });
    apply();

    /* — بڕین و پاشەکەوت — */
    async function saveCrop(backdrop) {
      const saveBtn = backdrop ? backdrop.querySelector('.modal-foot .btn-primary') : null;
      const OUT = 256;
      const canvas = document.createElement('canvas');
      canvas.width = OUT; canvas.height = OUT;
      const ctx = canvas.getContext('2d');
      const k = OUT / S;
      const dw = img.naturalWidth * baseScale * zoom;
      const dh = img.naturalHeight * baseScale * zoom;
      const dx = S / 2 + tx - dw / 2;
      const dy = S / 2 + ty - dh / 2;
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(img, dx * k, dy * k, dw * k, dh * k);

      btnLoading(saveBtn, true, 'پاشەکەوت دەکرێت...');
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (onSave) await onSave(dataUrl);
        close();
      } catch (err) {
        toast('هەڵە لە پاشەکەوتکردنی وێنە: ' + err.message, 'error', 4200);
      } finally {
        btnLoading(saveBtn, false);
      }
    }
  }

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

  /** خانە تێپەڕەوشەییەکان دەگۆڕێت بۆ type="text" + کلاسی pin-secret
   *  — بۆ ئەوەی براوسەر خانەکە وەک خانەی پاسۆرد نەبینێت و پۆپئەپی سەیڤکردنی پاسۆرد
   *  یان پێشنیاری خۆپڕکردن پیشان نەدات. تەنها لە براوسەرانی پشتگیری -webkit-text-security
   *  (Chrome, Edge, Safari) — لە Firefox دەمێنێتەوە type="password" چونکە autocomplete="off" تێیدا کاردەکات */
  function maskSecretInputs(root) {
    try {
      if (!(window.CSS && CSS.supports && CSS.supports('-webkit-text-security', 'disc'))) return;
      (root || document).querySelectorAll('input[type="password"]').forEach(inp => {
        inp.type = 'text';
        inp.classList.add('pin-secret');
        inp.setAttribute('autocomplete', 'off');
      });
    } catch (_) { /* هەر کێشەیەک — خانەکان وەک خۆیان بمێننەوە */ }
  }

  /* — ئایکۆنە مۆدێرنەکانی سیستەم (هەمان ستایلی ئایکۆنەکانی باڕی خوارەوە — SVG) — */
  const ICON_PATHS = {
    truck: '<path d="M1 3h13v13H1z"/><path d="M14 8h4.6l2.4 3.2V16H14z"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 13 3-4 4 3 5-7"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    badge: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h4"/><path d="M15 12h4"/><path d="M6 18c.6-1.8 1.8-2.6 3-2.6s2.4.8 3 2.6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1 2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2" ry="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
    keyboard: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 18"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    columns: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="12" x2="12" y1="3" y2="21"/>',
  };

  /** ئایکۆنی SVG بە ناو — بۆ تایتڵ و دووگمەکان؛ ڕەنگەکەی لە دەقی دەوروبەری دەگرێت */
  function icon(name, size = 17) {
    const p = ICON_PATHS[name] || ICON_PATHS.info;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }

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

  /** خولەک → "H:MM" — بۆ کۆگاکردنی کاتی کارکردن لە average_time */
  function durationToHMM(mins) {
    if (mins === null || mins === undefined || Number.isNaN(mins)) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  /** کاتی کارکردنی تۆمار — نرخی هەڵگرتووی average_time بۆ ڕۆژانی ڕابردوو (جێگیر)
   * بۆ ئەوەی گۆڕینی کاتی دەستپێک کاریگەری نەکاتە سەر داتاکانی ڕابردوو.
   * بۆ ئەمڕۆ بەدواوە — حیسابی زیندوو: گەشتنەوە − کاتی دەستپێک (یان کاتی دەرچوون) */
  function recordDurationMinutes(r) {
    if (!r) return null;
    const isPast = r.record_date && r.record_date < todayStr();
    if (isPast) {
      const stored = parseDurationMin(r.average_time);
      if (stored !== null) return stored;
      const dPast = durationMinutes(r.record_time, r.arrival_time);
      if (dPast !== null) return dPast;
      return parseDurationMin(r.work_time);
    }
    const start = Store.getBaseTime() || r.record_time;
    const d = durationMinutes(start, r.arrival_time);
    if (d !== null) return d;
    const stored = parseDurationMin(r.average_time);
    if (stored !== null) return stored;
    return parseDurationMin(r.work_time);
  }

  /** پیشاندانی کاتی کارکردن — هەمان لۆژیکی recordDurationMinutes بۆ دەق */
  function workTimeDisplay(r) {
    if (!r) return '—';
    const m = recordDurationMinutes(r);
    return m !== null ? fmtDuration(m) : '—';
  }

  /** خولەک → "X ک و Y خ" */
  function fmtDuration(mins) {
    if (mins === null || mins === undefined || Number.isNaN(mins)) return '—';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h} ک و ${m} خ`;
    return `${m} خ`;
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
        <div class="fs-plain-item"><span class="lbl">کاتی کارکردن</span><b class="val ${(rec.record_time && rec.arrival_time) || rec.work_time ? 'ok' : ''}">${workTimeDisplay(rec)}</b></div>
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

  /* ---- ئامرازی + / − لەسەر ئایۆئێس بۆ کاتێک کیبۆردی ژمارەیی سیستەم کراوەیە ---- */
  /* بەتەنها کار دەکات لەسەر ئایۆئێس (webkit-touch-callout) و customKeypadNum ناچالاکە */
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let iosToolbar = null;
  let iosToolbarTarget = null;
  let iosToolbarTimer = null;

  function buildIOSToolbar() {
    if (iosToolbar) return;
    const bar = document.createElement('div');
    bar.id = 'ios-num-toolbar';
    bar.innerHTML = `
      <button type="button" data-op="minus" tabindex="-1">−</button>
      <button type="button" data-op="plus"  tabindex="-1">+</button>
      <button type="button" data-op="done"  tabindex="-1">✓</button>`;
    bar.addEventListener('pointerdown', e => e.preventDefault());
    bar.addEventListener('click', e => {
      const btn = e.target.closest('button[data-op]');
      if (!btn || !iosToolbarTarget || !iosToolbarTarget.isConnected) return;
      const op = btn.dataset.op;
      const inp = iosToolbarTarget;
      if (op === 'done') { inp.blur(); return; }
      const cur = parseFloat(inp.value) || 0;
      const step = parseFloat(inp.step) || 1;
      const next = op === 'plus' ? cur + step : cur - step;
      const min = inp.min !== '' ? parseFloat(inp.min) : -Infinity;
      inp.value = String(Math.max(min, next));
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.body.appendChild(bar);
    iosToolbar = bar;
  }

  function openIOSToolbar(inp) {
    if (!isIOS() || !coarsePointer()) return;
    if (!isNumericKeypadField(inp)) return;
    try { if (Store.getSettings().customKeypadNum) return; } catch (_) {}
    buildIOSToolbar();
    iosToolbarTarget = inp;
    iosToolbar.classList.add('open');
  }

  function closeIOSToolbar() {
    if (iosToolbar) iosToolbar.classList.remove('open');
    iosToolbarTarget = null;
    clearTimeout(iosToolbarTimer);
  }

  document.addEventListener('focusin', e => {
    const t = e.target;
    if (isNumericKeypadField(t) && !keypadEnabledFor(t)) {
      clearTimeout(iosToolbarTimer);
      iosToolbarTimer = setTimeout(() => openIOSToolbar(t), 120);
    } else {
      closeIOSToolbar();
    }
  });

  document.addEventListener('focusout', e => {
    if (iosToolbarTarget === e.target) {
      // کچووکەکانی toolbar دواخستنی blur ئەکەن بۆ ئەوەی click جێبەجێ بکرێت
      iosToolbarTimer = setTimeout(closeIOSToolbar, 200);
    }
  });

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
    
    if (u.profession === CONFIG.PROFESSION_ASSISTANT) {
      let supervisorNames = [];
      try {
        const ls = await Store.loadLists();
        supervisorNames = (ls.users || [])
            .filter(isSupervisorUser)
            .map(x => norm(x.username || ''));
      } catch (e) {}

      return rows.filter(n => {
        const actionNorm = norm(n.action || '');
        const triggeredBySupervisor = supervisorNames.some(name => name && actionNorm.includes('لەلایەن ' + name));
        return !triggeredBySupervisor;
      });
    }

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
    norm, userMatches, parseIdList, recMatchesUser, calcDuration, durationMinutes, parseDurationMin, recordDurationMinutes, workTimeDisplay, fmtDuration, durationToHMM,
    sortUsers, openRecordFullscreen, openUserProfile, openPhoneOptions, avatarEditor, intlPhoneDigits, phoneChipHtml, maskSecretInputs, icon,
    fetchVisibleNotifications, openNotificationsPanel, refreshNotifBadge
  };
})();
