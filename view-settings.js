/* =========================================================
 *  ڕێکخستنەکان — پرۆفایل، ئاڤاتار (زووم و پان)، تێپەڕەوشە، ڕووکار
 * ========================================================= */

const SettingsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;

  function render(el) {
    container = el;
    const u = App.getUser();
    const s = Store.getSettings();

    el.innerHTML = `
      <section class="card profile-card">
        <div class="profile-row">
          <div id="profile-avatar">${UI.avatarHtml(u, 76)}</div>
          <div class="profile-meta">
            <h2>${UI.esc(u.username)}</h2>
            <span class="chip">${UI.esc(u.profession || '—')}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-block" id="avatar-btn">📷 گۆڕینی وێنەی پڕۆفایل</button>
        <input type="file" id="avatar-file" accept="image/*" hidden>
      </section>

      <section class="card">
        <h3 class="section-title">🔒 گۆڕینی تێپەڕەوشە</h3>
        <form id="pass-form" novalidate>
          <div class="field"><label>تێپەڕەوشەی ئێستا</label><input id="p-current" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>
          <div class="field-row">
            <div class="field"><label>تێپەڕەوشەی نوێ</label><input id="p-new" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>
            <div class="field"><label>دووبارەی نوێ</label><input id="p-confirm" type="password" inputmode="numeric" maxlength="4" placeholder="••••"></div>
          </div>
          <p class="hint">تێپەڕەوشە دەبێت ٤ ژمارە بێت.</p>
          <button class="btn btn-primary" type="submit">نوێکردنەوەی تێپەڕەوشە</button>
        </form>
      </section>

      <section class="card">
        <h3 class="section-title">🎨 ڕووکار</h3>
        <div class="seg" id="theme-seg">
          <button type="button" data-theme="dark" class="${s.theme === 'dark' ? 'active' : ''}">🌙 تاریک</button>
          <button type="button" data-theme="light" class="${s.theme === 'light' ? 'active' : ''}">☀ ڕوون</button>
        </div>
        <p class="hint">ڕەنگی سەرەکی پلاتفۆرم:</p>
        <div class="swatches" id="swatches">
          ${CONFIG.ACCENT_PRESETS.map(c => `<button type="button" class="swatch ${c === s.accent ? 'active' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
          <label class="swatch custom" title="ڕەنگی تایبەت">
            <input type="color" id="accent-custom" value="${s.accent}">
            <span>+</span>
          </label>
        </div>
      </section>

      <section class="card">
        <button class="btn btn-danger btn-block" id="settings-logout-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
          دەرچوون لە هەژمار
        </button>
      </section>

      <section class="card about-card">
        <h3 class="section-title">ℹ دەربارەی سیستەم</h3>
        <p class="hint">${UI.esc(CONFIG.APP_NAME)} — نسخە ${CONFIG.APP_VERSION}<br>
        پلاتفۆرمی ڕێکخستن، بەدواداچوون و تۆمارکردنی پرۆسەکانی گەیاندن بۆ شۆفێر، دابەشکار و مەندوب.
        دروستکراوە لەلایان (احمد ڕەمەزان) .</p>
      </section>`;

    $('#settings-logout-btn', el).addEventListener('click', () => App.logout && App.logout());

    /* — ئاڤاتار — */
    $('#avatar-btn', el).addEventListener('click', () => $('#avatar-file', el).click());
    $('#avatar-file', el).addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) openAvatarEditor(file);
    });

    /* — تێپەڕەوشە — */
    ['#p-current', '#p-new', '#p-confirm'].forEach(sel => {
      $(sel, el).addEventListener('input', e => {
        e.target.value = UI.toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4);
      });
    });
    $('#pass-form', el).addEventListener('submit', handlePasswordChange);

    /* — ڕووکار — */
    $('#theme-seg', el).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      Store.saveSettings({ theme: b.dataset.theme });
      render(container);
    }));
    $('#swatches', el).querySelectorAll('.swatch[data-color]').forEach(b => b.addEventListener('click', () => {
      Store.saveSettings({ accent: b.dataset.color });
      render(container);
    }));
    $('#accent-custom', el).addEventListener('input', e => Store.saveSettings({ accent: e.target.value }));
  }

  /* ---------------- گۆڕینی تێپەڕەوشە ---------------- */

  async function handlePasswordChange(e) {
    e.preventDefault();
    const cur = UI.toLatinDigits($('#p-current', container).value.trim());
    const nw = UI.toLatinDigits($('#p-new', container).value.trim());
    const cf = UI.toLatinDigits($('#p-confirm', container).value.trim());

    if (!/^\d{4}$/.test(cur) || !/^\d{4}$/.test(nw)) { UI.toast('هەردوو تێپەڕەوشە دەبێت ٤ ژمارە بن', 'warning'); return; }
    if (nw !== cf) { UI.toast('دووبارەکردنەوەی تێپەڕەوشەی نوێ یەکسان نییە', 'error'); return; }

    const subBtn = $('#pass-form button[type="submit"]', container);
    UI.btnLoading(subBtn, true, 'نوێ دەکرێتەوە...');
    try {
      const users = await API.Lists.users();
      const me = users.find(x => x.id === App.getUser().id);
      if (!me) { UI.toast('بەکارهێنەر نەدۆزرایەوە', 'error'); return; }
      if (String(me.password) !== cur) { UI.toast('تێپەڕەوشەی ئێستا هەڵەیە', 'error'); return; }

      await API.Lists.updateUser(me.id, { password: nw });
      UI.toast('تێپەڕەوشە بە سەرکەوتوویی گۆڕدرا ✓', 'success');
      $('#pass-form', container).reset();
    } catch (err) {
      UI.toast('هەڵە لە گۆڕینی تێپەڕەوشە: ' + err.message, 'error', 4200);
    } finally {
      UI.btnLoading(subBtn, false);
    }
  }

  /* ---------------- ئامرازی بڕینی وێنە (زووم و پان) ---------------- */

  function openAvatarEditor(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => runCropEditor(img);
      img.onerror = () => UI.toast('وێنەکە نەخوێنرایەوە — تکایە وێنەیەکی تر هەڵبژێرە', 'error');
      img.src = reader.result;
    };
    reader.onerror = () => UI.toast('هەڵە لە خوێندنی فایلەکە', 'error');
    reader.readAsDataURL(file);
  }

  function runCropEditor(img) {
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

    const { close } = UI.openModal({
      title: '📷 ڕێکخستنی وێنەی پڕۆفایل',
      body,
      wide: true,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        { label: 'پاشەکەوتکردن', className: 'btn-primary', onClick: (backdrop) => saveCrop(backdrop) },
      ],
    });

    const stage = $('#crop-stage', body);
    const cropImg = $('#crop-img', body);

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

    $('#crop-zin', body).addEventListener('click', () => setZoom(zoom * 1.2));
    $('#crop-zout', body).addEventListener('click', () => setZoom(zoom / 1.2));
    $('#crop-reset', body).addEventListener('click', () => { zoom = 1; tx = 0; ty = 0; apply(); });
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

      UI.btnLoading(saveBtn, true, 'پاشەکەوت دەکرێت...');
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const updated = await API.Lists.updateUser(App.getUser().id, { avatar_url: dataUrl });
        Store.updateSession({ avatar_url: updated ? updated.avatar_url : dataUrl });
        $('#profile-avatar', container).innerHTML = UI.avatarHtml(App.getUser(), 76);
        App.renderHeader();
        UI.toast('وێنەی پڕۆفایل نوێ کرایەوە ✓', 'success');
        close();
      } catch (err) {
        UI.toast('هەڵە لە پاشەکەوتکردنی وێنە: ' + err.message, 'error', 4200);
      } finally {
        UI.btnLoading(saveBtn, false);
      }
    }
  }

  return { render, stop: () => {} };
})();
