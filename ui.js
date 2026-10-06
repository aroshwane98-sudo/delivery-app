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

  /* ناوی ئایکۆنەکان تەنها — SVG لە کاتی پیشاندان دروست دەکرێت (ICON_PATHS دواتر ڕادەگەیەندرێت، بۆیە لێرە بانگ ناکرێت) */
  const TOAST_ICON_NAMES = { success: 'check', error: 'x', info: 'info', warning: 'alert' };

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
    el.innerHTML = `<span class="toast-ico">${TOAST_ICON_NAMES[type] ? icon(TOAST_ICON_NAMES[type], 14) : icon('info', 14)}</span><span class="toast-msg">${esc(message)}</span>`;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    }, duration);
  }

  /* ---------------- دوگمەی گەڕانەوەی مووبایل ----------------
   *  هەر ویندۆ/ئۆڤەرلەێک (مۆدال، کیبۆردی تایبەت، نۆتیفیکەیشن، وێنەی گەورە، تابی ناوەکی...)
   *  یەک State لە مێژووی براوسەردا دەگرێت — بۆ ئەوەی دوگمەی گەڕانەوەی مووبایل
   *  ئەو چینە دابخات نەک ئەپەکە دەربکات.
   *
   *  armedDepth  = ژمارەی State ـەکانی ئێمە لە مێژوودا
   *  pendingBack = ژمارەی history.back() ـە خۆکارەکان کە popstateـیان هێشتا نەهاتووە (پشتگوێ دەخرێن) */

  const backLayers = [];   // LIFO — { close }
  let armedDepth = 0;
  let pendingBack = 0;
  let popClosing = false;  // true کاتێک چینێک بە دوگمەی گەڕانەوەی بەکارهێنەر دادەخرێت (State ـەکەی پێشتر بردراوە)
  let reconcileTimer = null;

  function backArm() {
    try { history.pushState({ dlvLayer: true }, ''); armedDepth++; } catch (_) {}
  }

  /* State ی زیادە (چینەکە داخراوە) دوای ساتێک لە مێژوو دەسڕدرێتەوە — نەک یەکسەر.
   * history.back() ئامانجی ڕەهای هەیە، بۆیە ئەگەر لەو ساتەدا ویندۆیەکی نوێ بکرێتەوە (confirm → مۆدالی داهاتوو)
   * مێژووەکە تێک دەچوو. ئێستا ویندۆی نوێ هەمان State ی زیادە بەکاردەهێنێت. */
  function scheduleReconcile() {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(() => {
      const extra = armedDepth - backLayers.length;
      if (extra <= 0) return;
      armedDepth -= extra;
      pendingBack++;
      try { history.go(-extra); } catch (_) { pendingBack--; }
    }, 40);
  }

  /** تۆمارکردنی چینێکی گەڕانەوە — closeFn دابخەری چینەکەیە؛ unregister ی دەگەڕێنێت */
  function backRegister(closeFn) {
    const layer = { close: closeFn };
    backLayers.push(layer);
    if (armedDepth < backLayers.length) backArm();   // State ی زیادەی چینێکی تازە-داخراو دووبارە بەکاردێت
    let done = false;
    return function unregister() {
      if (done) return;
      done = true;
      const i = backLayers.indexOf(layer);
      if (i !== -1) backLayers.splice(i, 1);
      // کاتێک بە دوگمەی گەڕانەوە دادەخرێت State ـەکەی خۆی چووە؛ لە دۆخی تردا دواتر دەیسڕینەوە
      if (!popClosing) scheduleReconcile();
    };
  }

  window.addEventListener('popstate', () => {
    if (pendingBack > 0) { pendingBack--; return; }  // گەڕانەوەی خۆکار — پشتگوێ
    const hadSpare = armedDepth > backLayers.length; // State ی زیادە هەبوو — بەکارهێنەر ئەوەی خواردووە، چینێک دانەخرێت
    if (armedDepth > 0) armedDepth--;
    if (hadSpare) return;
    const top = backLayers.pop();
    if (!top) return;                                 // هیچ چینێک نەماوە — گەڕانەوەی ئاسایی
    popClosing = true;
    try { top.close(); } finally { popClosing = false; }
  });

  /* Escape — تەنها سەرووترین چین دادەخات */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || !backLayers.length) return;
    if (document.querySelector('.ac-list.open')) return; // Escape ی ئۆتۆکۆمپلیت
    try { history.back(); } catch (_) {}
  });

  /* دوای هەڵبژاردنی ناو لە لیستی <select> — خانەکە لە focus دەرچێت (هێڵی هەڵبژاردن نەمێنێت) */
  document.addEventListener('change', e => {
    const t = e.target;
    if (t instanceof HTMLSelectElement) setTimeout(() => { try { t.blur(); } catch (_) {} }, 0);
  });

  /* ---------------- مۆدال ---------------- */

  function openModal({ title, titleHtml, body, actions = [], wide = false, size = '', onClose = null }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const sizeClass = size ? `modal-${size}` : (wide ? 'modal-wide' : '');
    backdrop.innerHTML = `
      <div class="modal ${sizeClass}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${titleHtml ? titleHtml : esc(title)}</h3>
          <button class="icon-btn modal-close" type="button" aria-label="داخستن">${icon('x', 18)}</button>
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

    let unregisterBack = null;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      if (unregisterBack) { const u = unregisterBack; unregisterBack = null; u(); }
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 220);
      if (onClose) onClose();
    };
    unregisterBack = backRegister(close);
    backdrop.querySelector('.modal-close').addEventListener('click', close);
    /* داخستن بە کلیک لەسەر پشتەوە — تەنها ئەگەر پەنجە/ماوس لەسەر پشتەوە دابەزیبێت و هەر لەوێش هەڵگیرابێتەوە.
       (پێشتر mousedown ی دروستکراوی دوای tap کاتێک کیبۆرد دەکرایەوە و ویندۆکە دەجوڵا، فۆڕمەکەی دادەخست) */
    let downOnBackdrop = false;
    backdrop.addEventListener('pointerdown', e => { downOnBackdrop = e.target === backdrop; });
    backdrop.addEventListener('click', e => {
      const ok = downOnBackdrop && e.target === backdrop;
      downOnBackdrop = false;
      if (ok) close();
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
      /* دوای هەڵبژاردن خانەکە لە focus دەردەچێت — هێڵی سلێکت/کەرێتەکە و کیبۆردەکەش نامێنن */
      try { window.getSelection && window.getSelection().removeAllRanges(); } catch (_) {}
      inputEl.blur();
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

  // وێنەی ئاڤاتاری شێواو (بەستەری هەڵە یان نەگەیشتوو) — لە جیاتی نیشانەی وێنەی شێواو،
  // پیتە یەکەمی ناوی یوسەرەکە پیشان دەدرێت (هەمان شێوەی فۆڵباکی بنەڕەتی)
  document.addEventListener('error', e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('avatar')) return;
    const fallback = document.createElement('div');
    fallback.className = 'avatar avatar-fallback';
    fallback.setAttribute('style', img.getAttribute('style') || '');
    const size = parseInt(img.style.width, 10) || 44;
    fallback.style.fontSize = Math.round(size * 0.42) + 'px';
    ['data-uid', 'data-uname', 'data-uprof'].forEach(a => {
      const v = img.getAttribute(a);
      if (v !== null) fallback.setAttribute(a, v);
    });
    fallback.textContent = (img.getAttribute('alt') || '؟').trim().charAt(0);
    img.replaceWith(fallback);
  }, true);

  /* ---------------- ئەنیمەیشنی دووگمەکانی کردار ----------------
   * بۆ هەر کردارێکی فۆڕمی کارەکان ئەنیمەیشنێکی تایبەت — لە شوێنی لۆدینگی ئاسایی
   * پیشان دەدرێت و دەقە کوردییەکەی دووگمەکە بە شێوەیەکی سروشتی دەمێنێتەوە. */

  const ANIM_LAYERS = {
    /* سەیارە — لۆدینگی هەموو دووگمەکان: لایەک دەچێتەوە، دەڕوات و لە کۆتاییدا لایەکی تر دەردەچێت */
    truck: '<span class="a-road"><i></i><i></i><i></i></span><span class="a-lorry"><i class="t-back"></i><i class="t-front"></i><i class="t-window"></i><i class="t-beam"></i><i class="t-wheel w1"></i><i class="t-wheel w2"></i></span><i class="sp s1"></i><i class="sp s2"></i><i class="sp s3"></i>',
    /* دەرچوون — سەیارە بە درێژایی دووگمەکە لەگەڵ ڕووناکی و ڕێگا */
    exit: '<span class="a-road"><i></i><i></i><i></i></span><span class="a-truck"><i class="t-back"></i><i class="t-front"></i><i class="t-window"></i><i class="t-beam"></i><i class="t-wheel w1"></i><i class="t-wheel w2"></i></span>',
    /* ناو زۆن — پین دادەبەزێت و ڕادار بەربڵاو دەبێت */
    in_zone: '<span class="a-pin"><i class="p-body"></i><i class="p-hole"></i></span><span class="a-radar"></span>',
    /* دەرێی زۆن — خێرایی دەرچوون بە هێڵی با و تیری ئاراستە */
    out_zone: '<i class="st s1"></i><i class="st s2"></i><i class="st s3"></i><i class="a-chev"></i>',
    /* گەشتنەوە — ئاڵای شطرنجی لەڕێگەوە دەڕوات */
    arrival: '<span class="a-flag"><i class="f-pole"></i><i class="f-cloth"></i></span>',
    /* پارە — دراو دادەبەزێتە ناو خانەکە */
    money: '<i class="coin c1"></i><i class="coin c2"></i><i class="coin c3"></i><i class="coin c4"></i><i class="slot"></i>',
  };

  function animLayerHtml(type) {
    return ANIM_LAYERS[type] ? `<span class="anim-layer a-${type}" aria-hidden="true">${ANIM_LAYERS[type]}</span>` : '';
  }

  /** چالاک/ناچالاککردنی ئەنیمەیشن لەسەر دووگمە — دەقی ئەسلی دووگمەکە پاشەکەوت و بەرز دەکرێتەوە.
   * بۆ شێوازی سەیارە: لە کاتی ناچالاککردندا سەیارەکە بە خێرایی لە لایەکی تر دەردەچێت پاشان دووگمەکە دەگەڕێتەوە. */
  function btnScene(btn, type, on) {
    if (!btn) return;
    const finish = () => {
      btn.disabled = false;
      btn.classList.remove('anim-on', 'anim-done');
      if (btn.dataset.sceneHtml) {
        btn.innerHTML = btn.dataset.sceneHtml;
        delete btn.dataset.sceneHtml;
      }
    };
    if (on) {
      if (!btn.dataset.sceneHtml) btn.dataset.sceneHtml = btn.innerHTML;
      btn.disabled = true;
      btn.classList.remove('anim-done');
      btn.classList.add('anim-on');
      btn.innerHTML = `${animLayerHtml(type)}<span class="btn-anim-label">${btn.dataset.sceneHtml}</span>`;
    } else if (type === 'truck' && btn.classList.contains('anim-on')) {
      // کۆتایی لۆدینگ — سەیارەکە بە خێرایی لە لایەکی تر دەردەچێت
      btn.classList.add('anim-done');
      setTimeout(finish, 620);
    } else finish();
  }

  /** ئەگەر ئەنیمەیشن لە ڕێکخستنەکان چالاک بێت scene پیشان دەدرێت، ئەگینا لۆدینگی ئاسایی.
   * شێوازەکان: 'truck' = سەیارە بۆ هەموو دووگمەکان | 'scene' = ئەنیمەیشنی تایبەت بە هەر دووگمە | 'off' = لۆدینگی ئاسایی */
  function btnBusy(btn, type, on, text) {
    let mode = 'truck';
    try { mode = Store.getSettings().btnAnimMode || 'truck'; } catch (_) {}
    if (mode === 'truck' && type) btnScene(btn, 'truck', on);
    else if (mode === 'scene' && type && ANIM_LAYERS[type]) btnScene(btn, type, on);
    else btnLoading(btn, on, text || 'چاوەڕوان بە...');
  }

  /* ---------------- بارکردنی خاوەنکاری کتێبخانەی ئێکسڵ ----------------
   * xlsx.full.min.js (~٨٨٠KB) لە دەستپێکی سیستەمدا بار ناکرێت — تەنها کاتێک
   * هەناردەی ئێکسڵ یان باک ئەپ داوا بکرێت، بۆ ئەوەی دەستپێک خێرا بێت. */
  let _xlsxPromise = null;

  function ensureXlsx() {
    if (typeof XLSX !== 'undefined') return Promise.resolve();
    if (_xlsxPromise) return _xlsxPromise;
    _xlsxPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'xlsx.full.min.js';
      s.onload = () => resolve();
      s.onerror = () => { _xlsxPromise = null; reject(new Error('کتابخانەی ئێکسڵ بار نەبووە — پەیوەندی بە ڕایەڵەوە پشکنین بکە')); };
      document.head.appendChild(s);
    });
    return _xlsxPromise;
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
    let unregLb = null;
    const closeLb = () => {
      if (unregLb) { const u = unregLb; unregLb = null; u(); }
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 200);
    };
    wrap.addEventListener('click', closeLb);
    unregLb = backRegister(closeLb);
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
    /* — ئایکۆنە زیادەکان — هەموو ئایکۆنەکانی سیستەم بە یەک ستایل (SVG) — */
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    money: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
    edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
    type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
    phoneOff: '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" x2="2" y1="2" y2="22"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    backspace: '<path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><line x1="18" x2="12" y1="9" y2="15"/><line x1="12" x2="18" y1="9" y2="15"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    signpost: '<path d="M12 13v8"/><path d="M12 3v3"/><path d="M18 6a2 2 0 0 1 1.387.56l2.307 2.22a1 1 0 0 1 0 1.44l-2.307 2.22A2 2 0 0 1 18 13H6a2 2 0 0 1-1.387-.56l-2.306-2.22a1 1 0 0 1 0-1.44l2.306-2.22A2 2 0 0 1 6 6z"/>',
    plusSquare: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  };

  /** ئایکۆنی SVG بە ناو — بۆ تایتڵ و دووگمەکان؛ ڕەنگەکەی لە دەقی دەوروبەری دەگرێت
   *  کلاسی lic — بۆ ئەوەی ئۆپشنی «پشاندانی ئایکۆنەکان» هەموویان بە یەکجار بشارێتەوە */
  function icon(name, size = 17) {
    const p = ICON_PATHS[name] || ICON_PATHS.info;
    return `<svg class="lic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
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

  /* ---------------- کیبۆردی تایبەتی سیستەم ----------------
   *  - بە inputmode="none" کیبۆردی ڕەسەنی مۆبایل ناکرێتەوە (بێ readOnly — کەرێت و هەڵبژاردن وەک خۆیان دەمێننەوە)
   *  - تەنها بە tap (focus/click) دەکرێتەوە — دەست لێدان بۆ سکڕۆڵکردن نە دەیکاتەوە نە دەیشارێتەوە
   *  - دوگمەی گەڕانەوەی مووبایل پێش هەموو شتێک کیبۆردەکە دادەخات (backRegister) */

  const keypad = { el: null, input: null, layout: null, forceNum: false, unreg: null, repeatT: null, repeatI: null };
  const KURDISH_KEY_ROWS = [
    ['ئ', 'ا', 'ب', 'پ', 'ت', 'ج', 'چ', 'ح', 'خ'],
    ['د', 'ر', 'ڕ', 'ز', 'ژ', 'س', 'ش', 'ع', 'غ'],
    ['ف', 'ڤ', 'ق', 'ک', 'گ', 'ل', 'ڵ', 'م', 'ن'],
    ['ه', 'ە', 'و', 'ۆ', 'ۇ', 'ی', 'ێ', 'ء', 'ؤ'],
  ];

  const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;

  /* inputmode ی ڕەسەن — دوای ئەوەی خۆمان کردمانە "none" لە dataset دەمێنێتەوە */
  const originalInputMode = t => (t.dataset.kpIm !== undefined ? t.dataset.kpIm : (t.getAttribute('inputmode') || ''));

  const isNumericKeypadField = t =>
    t instanceof HTMLInputElement &&
    (t.type === 'number' || ['numeric', 'decimal', 'tel'].includes(originalInputMode(t)) || t.classList.contains('num-only'));

  /* هەر جۆرێکی کیبۆرد ڕێکخستنی جیای خۆی هەیە — پیت و ژمارە بە جیا ئۆن/ئۆف دەکرێن */
  const keypadEnabledFor = t => {
    try {
      if (!coarsePointer()) return false;
      const s = Store.getSettings();
      return isNumericKeypadField(t) ? !!s.customKeypadNum : !!s.customKeypadText;
    } catch (_) { return false; }
  };

  const isKeypadField = t => {
    if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) || t.disabled || t.readOnly) return false;
    if (t instanceof HTMLInputElement && ['button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden', 'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week'].includes(t.type)) return false;
    return true;
  };

  const isActiveKeypadField = t => isKeypadField(t) && keypadEnabledFor(t);

  /* پێش focus — کیبۆردی ڕەسەنی مۆبایل دەکوژێنێتەوە */
  function prepareField(t) {
    if (!isActiveKeypadField(t)) return;
    if (t.dataset.kpIm === undefined) t.dataset.kpIm = t.getAttribute('inputmode') || '';
    t.setAttribute('inputmode', 'none');
  }

  /* دوای blur — inputmode ی ڕەسەن دەگەڕێتەوە */
  function restoreField(t) {
    if (!t || !t.dataset || t.dataset.kpIm === undefined) return;
    const v = t.dataset.kpIm;
    delete t.dataset.kpIm;
    if (v === '') t.removeAttribute('inputmode'); else t.setAttribute('inputmode', v);
  }

  function updateKeypadInput(inp, value, caret) {
    inp.value = value;
    try { inp.setSelectionRange(caret, caret); } catch (_) {}
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertKeypadText(inp, text) {
    const start = inp.selectionStart ?? inp.value.length;
    const end = inp.selectionEnd ?? start;
    const max = inp.maxLength > 0 ? inp.maxLength : Infinity;
    if (start === end && inp.value.length + text.length > max) return;
    updateKeypadInput(inp, inp.value.slice(0, start) + text + inp.value.slice(end), start + text.length);
  }

  function deleteKeypadText(inp) {
    const start = inp.selectionStart ?? inp.value.length;
    const end = inp.selectionEnd ?? start;
    if (start !== end) updateKeypadInput(inp, inp.value.slice(0, start) + inp.value.slice(end), start);
    else if (start > 0) updateKeypadInput(inp, inp.value.slice(0, start - 1) + inp.value.slice(end), start - 1);
  }

  function keypadMarkup(layout, canToggle) {
    const key = (k, label, cls = '') => `<button type="button" class="${cls}" data-k="${k}" tabindex="-1">${label}</button>`;
    const charKey = char => `<button type="button" class="kp-letter" data-k="char" data-char="${char}" tabindex="-1">${char}</button>`;
    const icoDel = icon('backspace', 22), icoDone = icon('check', 24), icoNext = icon('arrowRight', 22);

    /* کیبۆردی پیت — تەنها بۆ خانەکانی دەق */
    if (layout === 'text') {
      return `
        <div class="kp-text-layout">
          ${KURDISH_KEY_ROWS.map(row => `<div class="kp-row">${row.map(charKey).join('')}</div>`).join('')}
          <div class="kp-row kp-controls">
            ${key('num', '123', 'kp-fn')}${key('space', 'بۆشایی', 'kp-space')}${key('del', icoDel, 'kp-del')}${key('next', icoNext, 'kp-next')}${key('done', icoDone, 'kp-done')}
          </div>
        </div>`;
    }
    /* کیبۆردی ژمارە — + و − تێدایە چونکە کیبۆردی ڕەسەنی iOS لە کاتی نووسینی ژمارەدا پیشانی نادات */
    return `
      <div class="kp-number-layout">
        ${key('7', '7')}${key('8', '8')}${key('9', '9')}${key('del', icoDel, 'kp-del')}
        ${key('4', '4')}${key('5', '5')}${key('6', '6')}${key('+', icon('plus', 22), 'kp-op')}
        ${key('1', '1')}${key('2', '2')}${key('3', '3')}${key('minus', icon('minus', 22), 'kp-op')}
        ${key('0', '0')}${canToggle ? key('num', 'ابج', 'kp-fn') : key('clear', 'C', 'kp-clear')}${key('next', icoNext, 'kp-next')}${key('done', icoDone, 'kp-done')}
      </div>`;
  }

  function renderKeypad() {
    if (!keypad.el || !keypad.input) return;
    const numericField = isNumericKeypadField(keypad.input);
    const layout = (numericField || keypad.forceNum) ? 'numeric' : 'text';
    keypad.layout = layout;
    keypad.el.dataset.layout = layout;
    keypad.el.innerHTML = keypadMarkup(layout, !numericField);
    syncKeypadSpace();
  }

  /* ڕادەگەیەنێت کیبۆردەکە کراوەتەوە + بەرزی ڕاستەقینەی دەنێرێت بۆ CSS بۆ دروستکردنی شوێنی سکڕۆڵ */
  function syncKeypadSpace() {
    if (!keypad.el) return;
    document.body.classList.add('keypad-open');
    document.body.style.setProperty('--kp-h', `${Math.round(keypad.el.offsetHeight)}px`);
  }

  function goNextField(inp) {
    const scope = inp.closest('.modal-body, form, .login-view, .page') || document.body;
    const all = [...scope.querySelectorAll('input, textarea')].filter(el => isActiveKeypadField(el) && el.offsetParent !== null);
    const next = all[all.indexOf(inp) + 1];
    if (!next) { closeKeypad(true); return; }
    prepareField(next);
    next.focus();
  }

  function stopKeyRepeat() {
    clearTimeout(keypad.repeatT); clearInterval(keypad.repeatI);
    keypad.repeatT = keypad.repeatI = null;
  }

  function pressKey(btn) {
    const inp = keypad.input;
    if (!inp || !inp.isConnected) { closeKeypad(); return false; }
    try { navigator.vibrate && navigator.vibrate(6); } catch (_) {}
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 90);
    const k = btn.dataset.k;
    if (k === 'done') { closeKeypad(true); return false; }
    if (k === 'next') { goNextField(inp); return false; }
    if (k === 'num') { keypad.forceNum = !keypad.forceNum; renderKeypad(); return false; }
    if (k === 'del') { deleteKeypadText(inp); return true; }
    if (k === 'clear') { updateKeypadInput(inp, '', 0); return false; }
    if (k === 'space') { insertKeypadText(inp, ' '); return false; }
    if (k === 'char') { insertKeypadText(inp, btn.dataset.char); return false; }
    insertKeypadText(inp, k === 'minus' ? '-' : k);
    return false;
  }

  function buildKeypadEl() {
    const el = document.createElement('div');
    el.className = 'num-keypad';
    el.setAttribute('dir', 'ltr');
    /* لەسەر pointerdown کار دەکات (خێراتر) و focus ی خانەکە ناگۆڕێت */
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      const btn = e.target.closest('button[data-k]');
      if (!btn) return;
      stopKeyRepeat();
      const repeatable = pressKey(btn);
      /* ڕاگرتنی ⌫ — بە دووبارەبوونەوە دەسڕێتەوە */
      if (repeatable) {
        keypad.repeatT = setTimeout(() => {
          keypad.repeatI = setInterval(() => {
            if (!keypad.input || !keypad.input.isConnected) { stopKeyRepeat(); return; }
            deleteKeypadText(keypad.input);
          }, 55);
        }, 380);
      }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => el.addEventListener(ev, stopKeyRepeat));
    el.addEventListener('click', e => e.preventDefault());
    el.addEventListener('contextmenu', e => e.preventDefault());
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
    const wasOpen = keypad.el.classList.contains('open');
    keypad.input = inp;
    if (changedField) keypad.forceNum = false;
    if (changedField || !wasOpen) renderKeypad();
    keypad.el.classList.add('open');
    /* دوگمەی گەڕانەوەی مووبایل = داخستنی کیبۆردەکە (نەک ویندۆکە یان ئەپەکە) */
    if (!keypad.unreg) keypad.unreg = backRegister(() => { keypad.unreg = null; closeKeypad(true); });
    syncKeypadSpace();
    keepKeypadFieldVisible(inp);
  }

  function closeKeypad(blur) {
    const inp = keypad.input;
    keypad.input = null;
    keypad.layout = null;
    keypad.forceNum = false;
    stopKeyRepeat();
    if (keypad.el) keypad.el.classList.remove('open');
    document.body.classList.remove('keypad-open');
    document.body.style.removeProperty('--kp-h');
    if (keypad.unreg) { const u = keypad.unreg; keypad.unreg = null; u(); }
    if (blur && inp && inp.isConnected && document.activeElement === inp) inp.blur();
  }

  /* — پێش tap: کیبۆردی ڕەسەنی دەکوژێنێتەوە (کردنەوەی کیبۆرد دەکەوێتە دوای tap، نەک دەست لێدان) — */
  let lastDownTarget = null; // شوێنی دەستلێدانی یەکەم — بۆ ئەوەی جووڵەی ویندۆکە (کاتی کردنەوەی کیبۆرد) وەک tap ی دەرەوە حیساب نەکرێت
  document.addEventListener('pointerdown', e => { lastDownTarget = e.target; prepareField(e.target); }, true);

  /* — focus ی ڕاستەقینە (tap) — */
  document.addEventListener('focusin', e => {
    const t = e.target;
    if (isActiveKeypadField(t)) { prepareField(t); openKeypad(t); }
    else if (keypad.input) closeKeypad();
  });

  document.addEventListener('focusout', e => {
    const t = e.target;
    restoreField(t);
    if (keypad.input === t) {
      /* دواکەوتن بۆ ئەوەی گواستنەوە بۆ خانەیەکی تر کیبۆردەکە نەپەڕێنێت */
      setTimeout(() => {
        if (keypad.input === t && document.activeElement !== t) closeKeypad();
      }, 60);
    }
  });

  /* — tap: خانەی focus کراو کە کیبۆردەکەی داخراوە دووبارە دەکرێتەوە؛ tap لە دەرەوە دایدەخات (سکڕۆڵ نا) — */
  document.addEventListener('click', e => {
    const t = e.target;
    const down = lastDownTarget;
    lastDownTarget = null;
    if (isActiveKeypadField(t)) {
      if (keypad.input !== t || !keypad.el?.classList.contains('open')) { prepareField(t); openKeypad(t); }
      return;
    }
    /* دەستلێدانەکە لەسەر خانەیەکی کیبۆرد/خودی کیبۆرد/لیستی پێشنیار دەستی پێکردووە — ئەو click ی دوای جووڵەی ڕووکارە، دەرەوە نییە */
    if (down instanceof Element && (isActiveKeypadField(down) || keypad.el?.contains(down) || down.closest('.ac-list'))) return;
    if (keypad.input && keypad.el && !keypad.el.contains(t) && !t.closest('.ac-list')) closeKeypad(true);
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
          navigator.serviceWorker.ready.then(async reg => {
            // وێنەی یوسەرەکەی ئەنجامدەری کردارەکە — لە لیستی یوسەرانەوە بە ناوەکەی دەدۆزرێتەوە
            let users = [];
            try { users = (await Store.loadLists()).users || []; } catch (_) { users = []; }
            const avatarOf = name => {
              if (!name) return null;
              const target = norm(name);
              const u = users.find(x => norm(x.username) === target);
              return (u && u.avatar_url) ? u.avatar_url : null;
            };
            for (const n of toAlert.reverse()) {
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
                icon: avatarOf(actorMatch ? actorMatch[1] : null) || './icon-192.png',
                badge: './icon-192.png',
                tag: 'sys-alert-' + n.id,
                renotify: true,
                silent: false
              });
            }
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
    let unregNp = null;
    const close = () => {
      if (unregNp) { const u = unregNp; unregNp = null; u(); }
      overlay.remove();
    };
    unregNp = backRegister(close);
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

  /* ---------------- ئایکۆنی مۆدێرن بۆ هەموو ئیمۆجییەکانی سیستەم ----------------
   *  هەر ئیمۆجییەک لە هەر شوێنێکدا (تایتڵ، دووگمە، تۆست، خشتە، فۆڕم...) خۆکار دەگۆڕدرێت بۆ ئایکۆنی SVG
   *  بە کلاسی .lic — بۆیە ئۆپشنی «پشاندانی ئایکۆنەکان» (hide-icons) هەموویان بەیەکجار دەشارێتەوە. */

  const EMOJI_ICON = {
    '✓': 'check', '✔': 'check', '✕': 'x', '✖': 'x', '❌': 'x', '✅': 'checkCircle',
    '📍': 'pin', '🚚': 'truck', '✏': 'edit', '🚏': 'signpost', '🏁': 'flag', '➕': 'plus',
    '👁': 'eye', '🙈': 'eyeOff', '⚠': 'alert', '⊞': 'plusSquare', '🔔': 'bell', '⟲': 'rotate',
    '💰': 'money', '🗑': 'trash', '📞': 'phone', '☎': 'phone', '📵': 'phoneOff', '🔐': 'lock', '🔒': 'lock',
    '📊': 'chart', '💾': 'save', '📷': 'camera', '🖨': 'printer', '⚡': 'zap', '⌫': 'backspace',
    '🔗': 'link', '↕': 'sort', '🗺': 'map', '🎉': 'sparkles', '📁': 'folder', '📂': 'folder', '🗂': 'folder',
    '🛡': 'shield', '⚙': 'gear', '👋': 'smile', 'ℹ': 'info', '👤': 'user', '\u{1F9D1}\u200D\u2708': 'user',
    '👥': 'users', '⏳': 'hourglass', '⏱': 'clock', '📥': 'download', '📋': 'clipboard', '🖼': 'image',
    '📭': 'inbox', '🌙': 'moon', '☀': 'sun', '💡': 'bulb', '🎨': 'palette', '📏': 'ruler', '▶': 'play',
    '📦': 'package', '🔠': 'type', '⌨': 'keyboard', '📱': 'smartphone', '🧭': 'compass', '🔍': 'search',
  };
  const EMOJI_RE = /\u{1F9D1}\u200D\u2708\uFE0F?|[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B50\u23E9-\u23FF\u232B\u229E\u2195\u2139\u25B6\u27F2]\uFE0F?/gu;
  const EMOJI_TEST = new RegExp(EMOJI_RE.source, 'u');
  const emojiKey = m => m.replace(/\uFE0F/g, '');
  const ICONIZE_SKIP = 'script, style, textarea, svg, [data-noicon]';

  function makeInlineIcon(name) {
    const tpl = document.createElement('template');
    tpl.innerHTML = icon(name, '1.15em');
    const svg = tpl.content.firstElementChild;
    svg.classList.add('lic-inline');
    return svg;
  }

  function iconizeTextNode(node) {
    const txt = node.nodeValue;
    if (!txt || !EMOJI_TEST.test(txt)) return;
    const p = node.parentElement;
    if (!p || p.closest(ICONIZE_SKIP)) return;

    /* <option> و <title> ناتوانن SVG هەڵگرن — ئیمۆجییەکە لادەبرێت */
    if (p.closest('option, title')) {
      node.nodeValue = txt.replace(EMOJI_RE, m => (EMOJI_ICON[emojiKey(m)] ? '' : m)).replace(/^\s+/, '');
      return;
    }

    const frag = document.createDocumentFragment();
    let last = 0, any = false;
    txt.replace(EMOJI_RE, (m, off) => {
      const name = EMOJI_ICON[emojiKey(m)];
      if (!name) return m;
      if (off > last) frag.append(txt.slice(last, off));
      frag.append(makeInlineIcon(name));
      last = off + m.length;
      any = true;
      return m;
    });
    if (!any) return;
    if (last < txt.length) frag.append(txt.slice(last));
    const icons = [...frag.querySelectorAll('svg')];
    node.replaceWith(frag);
    /* دووگمەی بێ دەق (تەنها ئایکۆن) — لە دۆخی hide-icons نابێت بشاردرێتەوە */
    if (/^(BUTTON|A)$/.test(p.tagName) && !p.textContent.trim()) icons.forEach(s => s.classList.add('lic-keep'));
  }

  function stripEmojiAttrs(el) {
    ['title', 'placeholder', 'aria-label'].forEach(a => {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && EMOJI_TEST.test(v)) {
        el.setAttribute(a, v.replace(EMOJI_RE, m => (EMOJI_ICON[emojiKey(m)] ? '' : m)).replace(/\s+/g, ' ').trim());
      }
    });
  }

  function iconizeTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { iconizeTextNode(root); return; }
    if (root.nodeType !== 1 || root.matches(ICONIZE_SKIP) || root.closest('svg')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(iconizeTextNode);
    stripEmojiAttrs(root);
    root.querySelectorAll('[title], [placeholder], [aria-label]').forEach(stripEmojiAttrs);
  }

  function initIconize() {
    if (!document.body) return;
    iconizeTree(document.body);
    /* لە callback ی MutationObserver دا ڕاستەوخۆ جێبەجێ دەبێت — پێش paint، بۆیە ئیمۆجی ناپەڕێتەوە */
    new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'characterData') iconizeTree(r.target);
        else r.addedNodes.forEach(iconizeTree);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initIconize);
  else initIconize();


  return {
    esc, toLatinDigits, cleanInt, hasOperator, fmtNum, fmtMoney, todayStr, monthStartStr, monthEndStr, nowTime, timeToMinutes, daysAgoStr, fmtDateHuman,
    weekdayKu, toast, openModal, confirmDialog, autocomplete, avatarHtml, setLoading, btnLoading, sleep,
    norm, userMatches, parseIdList, recMatchesUser, calcDuration, durationMinutes, parseDurationMin, recordDurationMinutes, workTimeDisplay, fmtDuration, durationToHMM,
    sortUsers, openRecordFullscreen, openUserProfile, openPhoneOptions, avatarEditor, intlPhoneDigits, phoneChipHtml, maskSecretInputs, icon, backRegister, iconize: iconizeTree,
    ensureXlsx, animLayerHtml, btnScene, btnBusy,
    fetchVisibleNotifications, openNotificationsPanel, refreshNotifBadge
  };
})();
