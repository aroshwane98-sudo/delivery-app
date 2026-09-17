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
        <h3 class="section-title">🖥️ شێوازی پیشاندانی خشتەکان</h3>
        <label class="check-row" style="cursor:pointer">
          <input type="checkbox" id="set-row-click-fullscreen" ${s.rowClickFullscreen !== false ? 'checked' : ''}>
          <span>پەڕەی زانیاریەکان</span>
        </label>
        <p class="hint">لەکاتی داگرتنی هەر ڕیزێکی زانیاریەکانت پڕبە شاشە زانیاریەکان دەبینیت</p>
      </section>

      ${(u.profession === CONFIG.PROFESSION_DRIVER || u.profession === CONFIG.PROFESSION_DISTRIBUTOR || u.profession === CONFIG.PROFESSION_SUPERVISOR) ? `
      <section class="card">
        <h3 class="section-title">📱 کردارەکان لەسەر شاشەی قفڵ (Lock Screen)</h3>
        <label class="check-row" style="cursor:pointer">
          <input type="checkbox" id="set-lock-screen-actions" ${s.lockScreenActions ? 'checked' : ''}>
          <span>پیشاندانی کردارەکانی گەشت لەسەر شاشەی قفڵ</span>
        </label>
        <p class="hint">لەکاتی دەرچوون، نۆتیفیکەیشنێک دێتە سەر شاشەی قفڵی مۆبایلەکەت و دەتوانیت کردارەکانی (ناو زۆن، دەرێی زۆن، گەشتنەوە) دانە دانە لەوێوە جێبەجێ بکەیت بەبێ کردنەوەی ئەپەکە.</p>
        <div id="lockscreen-perm-alert" style="display:${('Notification' in window && Notification.permission !== 'granted' && s.lockScreenActions) ? 'block' : 'none'};margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:10px;">
          <span style="font-size:0.82rem;color:var(--text)">⚠️ پێویستە مۆڵەتی نۆتیفیکەیشن بە وێبگەڕەکە بدەیت:</span>
          <button type="button" class="btn btn-sm btn-ghost" id="grant-notif-perm-btn" style="margin-top:6px;width:100%">🔔 پێدانی مۆڵەتی نۆتیفیکەیشن</button>
        </div>
      </section>` : ''}

      ${u.profession === CONFIG.PROFESSION_SUPERVISOR ? `
      <section class="card">
        <h3 class="section-title">🔔 نۆتیفیکەیشنەکانی گۆڕانکاری</h3>
        <div class="field-row">
          <div class="field">
            <label>سڕینەوەی نۆتیفیکەیشنەکان دوای (ڕۆژ)</label>
            <input id="notif-days" type="number" min="1" step="1" value="${Math.max(1, Number(s.notifDays) || 1)}">
          </div>
          <div class="field" style="display:flex;align-items:flex-end">
            <button class="btn btn-primary" id="notif-days-save" type="button" style="width:100%">پاشەکەوتکردن</button>
          </div>
        </div>
        <p class="hint">نۆتیفیکەیشنی هەر گۆڕانکارییەک بۆ خشتەی public.notifications دەنێردرێت و لە دوای ئەم ژمارە ڕۆژە خۆکاری دەسڕدرێتەوە (بنەڕەت: ١ ڕۆژ). سڕینەوەی خۆکار لە کاتی چوونە ژوورەوە جێبەجێ دەبێت.</p>
        <button class="btn btn-danger btn-block" id="notif-delete-all" type="button">🗑 سڕینەوەی هەموو نۆتیفیکەیشنەکان</button>
      </section>

      <section class="card">
        <h3 class="section-title">🔠 فۆنت و قەبارەی نووسین</h3>
        <div class="font-ctl">
          <div class="font-ctl-info">
            <b>فۆنتی سیستەم</b>
            <span class="font-ctl-val" data-val="fontScale">${Math.round((Number(s.fontScale) || 1) * 100)}%</span>
          </div>
          <div class="font-ctl-btns">
            <button type="button" class="icon-btn fs-btn" data-key="fontScale" data-step="-1" title="بچوککردنەوە">－</button>
            <button type="button" class="icon-btn fs-btn" data-key="fontScale" data-step="1" title="گەورەکردن">＋</button>
          </div>
        </div>
        <div class="font-ctl">
          <div class="font-ctl-info">
            <b>فۆنتی تۆمارەکان</b>
            <span class="font-ctl-val" data-val="recordsFontScale">${Math.round((Number(s.recordsFontScale) || 1) * 100)}%</span>
          </div>
          <div class="font-ctl-btns">
            <button type="button" class="icon-btn fs-btn" data-key="recordsFontScale" data-step="-1" title="بچوککردنەوە">－</button>
            <button type="button" class="icon-btn fs-btn" data-key="recordsFontScale" data-step="1" title="گەورەکردن">＋</button>
          </div>
        </div>
        <div class="font-ctl">
          <div class="font-ctl-info">
            <b>فۆنتی تۆتاڵەکان</b>
            <span class="font-ctl-val" data-val="totalsFontScale">${Math.round((Number(s.totalsFontScale) || 1) * 100)}%</span>
          </div>
          <div class="font-ctl-btns">
            <button type="button" class="icon-btn fs-btn" data-key="totalsFontScale" data-step="-1" title="بچوککردنەوە">－</button>
            <button type="button" class="icon-btn fs-btn" data-key="totalsFontScale" data-step="1" title="گەورەکردن">＋</button>
          </div>
        </div>
        <div class="field">
          <label>جۆری فۆنتی سیستەم</label>
          <select id="font-family-select">
            <option value="Vazirmatn" ${s.fontFamily === 'Vazirmatn' ? 'selected' : ''}>Vazirmatn (بنەڕەت)</option>
            <option value="Tahoma" ${s.fontFamily === 'Tahoma' ? 'selected' : ''}>Tahoma</option>
            <option value="Segoe UI" ${s.fontFamily === 'Segoe UI' ? 'selected' : ''}>Segoe UI</option>
            <option value="Arial" ${s.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
            <option value="sans-serif" ${s.fontFamily === 'sans-serif' ? 'selected' : ''}>فۆنتی سیستەم</option>
          </select>
        </div>
        <button class="btn btn-ghost btn-block" id="font-reset-btn" type="button">⟲ گەڕانەوە بۆ بنەڕەت</button>
      </section>` : ''}

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

    /* — شێوازی پیشاندانی خشتە — */
    $('#set-row-click-fullscreen', el)?.addEventListener('change', e => {
      Store.saveSettings({ rowClickFullscreen: e.target.checked });
      UI.toast(e.target.checked ? 'ئۆپشنی پیشاندانی پڕ بە شاشە چالاک کرا ✓' : 'ئۆپشنی پیشاندانی پڕ بە شاشە ناچالاک کرا', 'info');
    });

    /* — کردارەکان لەسەر شاشەی قفڵ (سایەق، دابەشکار و بەڕێوەبەر) — */
    const lockCheck = $('#set-lock-screen-actions', el);
    const permAlert = $('#lockscreen-perm-alert', el);

    async function handleLockScreenToggle(checked) {
      if (checked) {
        if (!('Notification' in window)) {
          UI.toast('ئەم وێبگەڕە پشتگیری نۆتیفیکەیشنی شاشەی قفڵ ناکات', 'warning');
          if (lockCheck) lockCheck.checked = false;
          return;
        }
        let perm = Notification.permission;
        if (perm !== 'granted') {
          perm = await Notification.requestPermission();
        }
        if (perm !== 'granted') {
          UI.toast('پێویستە مۆڵەتی نۆتیفیکەیشن لە وێبگەڕدا پەسەند بکەیت', 'warning', 4500);
          if (lockCheck) lockCheck.checked = false;
          if (permAlert) permAlert.style.display = 'block';
          return;
        }
        Store.saveSettings({ lockScreenActions: true });
        if (permAlert) permAlert.style.display = 'none';
        UI.toast('کردارەکانی سەر شاشەی قفڵ چالاک کران ✓', 'success');
      } else {
        Store.saveSettings({ lockScreenActions: false });
        if (permAlert) permAlert.style.display = 'none';
        if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.getNotifications({ tag: 'active-trip-lockscreen' }).then(ns => ns.forEach(n => n.close())).catch(() => {});
          }).catch(() => {});
        }
        UI.toast('کردارەکانی سەر شاشەی قفڵ ناچالاک کران', 'info');
      }
    }

    lockCheck?.addEventListener('change', e => handleLockScreenToggle(e.target.checked));
    $('#grant-notif-perm-btn', el)?.addEventListener('click', async () => {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        Store.saveSettings({ lockScreenActions: true });
        if (lockCheck) lockCheck.checked = true;
        if (permAlert) permAlert.style.display = 'none';
        UI.toast('مۆڵەت درا و کردارەکانی شاشەی قفڵ چالاک کران ✓', 'success');
      } else {
        UI.toast('مۆڵەت ڕەتکرایەوە لە ڕێکخستنی وێبگەڕ', 'error');
      }
    });

    /* — نۆتیفیکەیشنەکان (تەنها بەڕێوەبەر) — */
    $('#notif-days-save', el)?.addEventListener('click', async () => {
      const days = Math.max(1, Math.floor(Number(UI.toLatinDigits($('#notif-days', el).value)) || 1));
      Store.saveSettings({ notifDays: days });
      const btn = $('#notif-days-save', el);
      UI.btnLoading(btn, true, 'پاشەکەوت دەکرێت...');
      try {
        await API.Notifications.removeOlderThanDays(days);
        UI.toast(`ڕێکخستن پاشەکەوت کرا — نۆتیفیکەیشنەکان دوای ${UI.fmtNum(days)} ڕۆژ دەسڕدرێنەوە ✓`, 'success');
      } catch (err) {
        UI.toast('هەڵە لە سڕینەوەی نۆتیفیکەیشنە کۆنەکان: ' + err.message, 'error', 4200);
      } finally {
        UI.btnLoading(btn, false);
      }
    });

    /* — فۆنت و قەبارەی نووسین (تەنها بەڕێوەبەر) — */
    const FS_MIN = 0.8, FS_MAX = 1.5, FS_STEP = 0.05;
    el.querySelectorAll('.fs-btn').forEach(b => {
      b.addEventListener('click', () => {
        const key = b.dataset.key;
        const step = Number(b.dataset.step) * FS_STEP;
        const cur = Number(Store.getSettings()[key]) || 1;
        const next = Math.min(FS_MAX, Math.max(FS_MIN, Math.round((cur + step) * 100) / 100));
        Store.saveSettings({ [key]: next });
        const valEl = el.querySelector(`.font-ctl-val[data-val="${key}"]`);
        if (valEl) valEl.textContent = Math.round(next * 100) + '%';
      });
    });

    $('#font-family-select', el)?.addEventListener('change', e => {
      Store.saveSettings({ fontFamily: e.target.value });
      UI.toast('فۆنتی سیستەم گۆڕدرا ✓', 'success');
    });

    $('#font-reset-btn', el)?.addEventListener('click', () => {
      Store.saveSettings({ fontScale: 1, recordsFontScale: 1, totalsFontScale: 1, fontFamily: 'Vazirmatn' });
      render(container);
      UI.toast('گەڕایەوە بۆ ڕێکخستنی بنەڕەت ✓', 'info');
    });

    $('#notif-delete-all', el)?.addEventListener('click', async () => {
      const ok = await UI.confirmDialog('دڵنیاییت لە سڕینەوەی هەموو نۆتیفیکەیشنەکان؟ ئەم کردارە ناگەڕێتەوە!', { danger: true, okLabel: 'بەڵێ، بیسڕەوە', cancelLabel: 'پاشگەزبوونەوە' });
      if (!ok) return;
      const btn = $('#notif-delete-all', el);
      UI.btnLoading(btn, true, 'دەسڕدرێتەوە...');
      try {
        await API.Notifications.removeAll();
        UI.toast('هەموو نۆتیفیکەیشنەکان سڕدرانەوە ✓', 'success');
      } catch (err) {
        UI.toast('هەڵە لە سڕینەوە: ' + err.message, 'error', 4200);
      } finally {
        UI.btnLoading(btn, false);
      }
    });
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
