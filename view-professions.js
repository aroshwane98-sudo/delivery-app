/* =========================================================
 *  فۆڕمی پیشە — دروستکردنی پیشەی نوێ و کۆنترۆڵی دەسەڵاتەکان
 *  دوو بەش: پیشەکان + یوسەرەکان
 *  هەر تایبەتمەندییەکی سیستەم بە ئۆپشنە بۆ هەر پیشەیەک و هەر یوسەرێک
 * ========================================================= */

const ProfessionsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  let refreshTimer = null;
  const state = { subtab: 'professions', userSearch: '' };

  const BUILTIN = [
    CONFIG.PROFESSION_DRIVER,
    CONFIG.PROFESSION_DISTRIBUTOR,
    CONFIG.PROFESSION_DELEGATE,
    CONFIG.PROFESSION_SUPERVISOR,
    CONFIG.PROFESSION_ASSISTANT,
  ];

  /* ---------------- ڕێندەری سەرەکی ---------------- */

  function render(el) {
    container = el;
    el.innerHTML = `
      <section class="card" style="padding:14px 18px 12px">
        <div class="admin-header-row">
          <div>
            <h2 class="hero-title"><span class="sec-icon">${UI.icon('badge', 20)}</span> پیشەکان و دەسەڵاتەکان</h2>
            <p class="hero-sub">دروستکردنی پیشەی نوێ و دیاریکردنی ئەوەی هەر پیشەیەک و هەر یوسەرێک چی ببینێت و چ ئەنجام بدات</p>
          </div>
          <button class="btn btn-ghost btn-sm" id="prf-refresh">⟳ نوێکردنەوە</button>
        </div>

        <div class="admin-tabs" id="prf-subtabs">
          <button type="button" class="admin-tab-btn ${state.subtab === 'professions' ? 'active' : ''}" data-sub="professions">
            <span class="sec-icon">${UI.icon('badge', 15)}</span> پیشەکان
          </button>
          <button type="button" class="admin-tab-btn ${state.subtab === 'users' ? 'active' : ''}" data-sub="users">
            <span class="sec-icon">${UI.icon('user', 15)}</span> یوسەرەکان
          </button>
        </div>
      </section>

      <div id="prf-content"></div>`;

    el.querySelectorAll('.admin-tab-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.subtab = b.dataset.sub;
        el.querySelectorAll('.admin-tab-btn').forEach(x => x.classList.toggle('active', x.dataset.sub === state.subtab));
        renderContent();
      });
    });
    $('#prf-refresh', el).addEventListener('click', async e => {
      const btn = e.currentTarget;
      UI.btnLoading(btn, true, '...');
      try {
        await Store.loadLists(true);
        renderContent();
        UI.toast('لیستەکە نوێکرایەوە ✓', 'success');
      } catch (err) {
        UI.toast('هەڵە لە نوێکردنەوە: ' + err.message, 'error', 4200);
      } finally {
        UI.btnLoading(btn, false);
      }
    });

    renderContent();
  }

  function stop() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }

  function renderContent() {
    const wrap = $('#prf-content', container);
    if (!wrap) return;
    wrap.innerHTML = `<div class="skeleton-block"><div class="sk sk-card"></div><div class="sk sk-card"></div></div>`;
    Store.loadLists()
      .then(ls => {
        if (state.subtab === 'professions') renderProfessionsTab(wrap, ls);
        else renderUsersTab(wrap, ls);
      })
      .catch(err => {
        wrap.innerHTML = `<div class="empty-state"><div class="empty-ico">⚠️</div><p>هەڵە لە هێنانی داتا: ${UI.esc(err.message)}</p></div>`;
      });
  }

  /* ---------------- بەشی پیشەکان ---------------- */

  function renderProfessionsTab(wrap, ls) {
    const users = ls.users || [];
    const customs = Store.getCustomProfessions();
    const profs = Perms.allProfessions(users);
    const countOf = p => users.filter(u => u.profession === p).length;

    wrap.innerHTML = `
      <section class="card" style="padding:14px 18px 12px">
        <div class="admin-header-row" style="margin-bottom:4px">
          <h3 style="font-size:0.96rem"><span class="sec-icon">${UI.icon('badge')}</span> لیستی پیشەکان</h3>
          <button type="button" class="btn btn-primary btn-sm" id="prf-add-btn">➕ پیشەی نوێ</button>
        </div>
        <p class="hint" style="margin:0">کلیک لەسەر «دەسەڵاتەکان» بکە بۆ دیاریکردنی ئەوەی ئەم پیشەیە چی ببینێت و چ کردار ئەنجام بدات. بە دوگمەی 🗑 پیشەیەک دەسڕدرێتەوە یان دەشاردرێتەوە — بە هەمان ناو لە «پیشەی نوێ» دەگەڕێتەوە. گۆڕانکارییەکان بۆ هەموو مۆبایلەکان جێبەجێ دەبن پاش نوێبوونەوەی سیستەم.</p>
      </section>

      <section class="card" style="padding:14px 18px 12px">
        <div class="admin-header-row" style="margin-bottom:6px">
          <div>
            <h3 style="font-size:0.95rem;margin:0"><span class="sec-icon">🔒</span> ڕێکخستنی قفڵی خانەکانی فۆڕمی دەرچوون (بنەڕەت — گشتی)</h3>
            <p class="hint" style="margin:4px 0 0">ئەمە <b>بنەڕەتی گشتی</b>یە بۆ هەموو پیشە و یوسەرەکان. بۆ دابەشکردنی دانە بە دانە، بۆ هەر پیشەیەک و یوسەرێک ڕێکخستنی تایبەتی خۆی دابنێ لە دوگمەی 🔐 دەسەڵاتەکان.</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="prf-field-lock-btn">⚙️ ڕێکخستن</button>
        </div>
        <div id="prf-field-lock-status" style="font-size:0.85rem;color:var(--muted)"></div>
      </section>

      <div class="prf-list">
        ${profs.map(p => professionCardHtml(p, customs, countOf(p))).join('')}
      </div>`;

    // --- ستاتوسی قفڵ ---
    function renderFieldLockStatus() {
      const statusEl = wrap.querySelector('#prf-field-lock-status');
      if (!statusEl) return;
      const flc = (Store.getPermsConfig() || {}).fieldLock;
      if (!flc || !flc.enabled) {
        statusEl.innerHTML = `<span style="color:var(--muted)">⭕ قفڵ ناچالاکە — هەموو یوسەرانی مۆڵەتدار دەتوانن داتاکان دەستکاری بکەن</span>`;
        return;
      }
      const names = (Array.isArray(flc.fields) && flc.fields.length)
        ? Perms.FIELD_LOCK_FIELDS.filter(f => flc.fields.includes(f.key))
        : Perms.FIELD_LOCK_FIELDS;
      const when = flc.type === 'timed'
        ? `دوای <b>${UI.esc(String(flc.minutes || 0))} خولەک</b> لە تۆمارکردنەوە`
        : 'دوای تۆمارکردن بە دەستەکان';
      statusEl.innerHTML = `
        <div style="color:var(--accent);margin-bottom:6px">${flc.type === 'timed' ? '⏱' : '🔒'} چالاک — <b>${when}</b> ئەم ${UI.fmtNum(names.length)} خانەیە قفڵ دەبن (بۆ پیشە/یوسەرەکانی بێ ڕێکخستنی تایبەت):</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${names.map(f => `<span class="chip">${f.icon} ${UI.esc(f.label)}</span>`).join('')}
        </div>
        <div style="color:var(--muted);margin-top:6px">هەر پیشەیەک و یوسەرێک دەتوانێت لیستی جیاوازی خۆی هەبێت — لە 🔐 دەسەڵاتەکانەوە.</div>`;
    }
    renderFieldLockStatus();

    // --- مۆدالی ڕێکخستنی قفڵ ---
    wrap.querySelector('#prf-field-lock-btn')?.addEventListener('click', () => {
      const currentCfg = (Store.getPermsConfig() || {}).fieldLock || {};
      const isEnabled = !!currentCfg.enabled;
      const curType = currentCfg.type || 'immediate';
      const curMins = Number(currentCfg.minutes) || 30;
      // ئەگەر لیستی خانەکان هەڵنەبژێردرابێت (کۆنفیگی کۆن) — هەموو خانەکان هەڵبژێردراون
      const preSelected = Array.isArray(currentCfg.fields) ? currentCfg.fields : Perms.FIELD_LOCK_FIELDS.map(f => f.key);

      const body = document.createElement('div');
      body.innerHTML = `
        <div class="set-rows">
          <label class="set-row" for="fl-enabled">
            <input type="checkbox" id="fl-enabled" ${isEnabled ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">🔒 چالاککردنی قفڵی خانەکان</span>
              <span class="set-row-hint">دوای تۆمارکردنی دەرچوون، تەنها خانە هەڵبژێردراوەکان قفڵ دەبن بۆ یوسەرانی ئاسایی (جگە لە بەڕێوەبەر و مۆڵەتدارەکان)</span>
            </span>
          </label>
        </div>
        <div id="fl-type-wrap" style="margin-top:14px;padding-top:10px;border-top:1px dashed var(--border);${isEnabled ? '' : 'opacity:0.4;pointer-events:none'}">
          <p style="font-size:0.85rem;font-weight:600;margin:0 0 10px">جۆری قفڵبوون:</p>
          <label class="set-row" style="padding:8px 0;border-bottom:none">
            <input type="radio" name="fl-type" id="fl-type-immediate" value="immediate" ${curType === 'immediate' ? 'checked' : ''} style="width:16px;height:16px;flex-shrink:0">
            <span class="set-row-txt">
              <span class="set-row-title">⚡ یەکەم: دوای تۆمارکردن بە دەستەکان قفڵ دەبێت</span>
              <span class="set-row-hint">کاتێک تۆمارکردنی دەرچوون تەواو بوو، خانە هەڵبژێردراوەکان بۆ هەمیشە قفڵ دەبن</span>
            </span>
          </label>
          <label class="set-row" style="padding:8px 0;border-bottom:none">
            <input type="radio" name="fl-type" id="fl-type-timed" value="timed" ${curType === 'timed' ? 'checked' : ''} style="width:16px;height:16px;flex-shrink:0">
            <span class="set-row-txt">
              <span class="set-row-title">⏱ دووەم: دوای کاتێکی دیاریکراو (بە خولەک) قفڵ دەبێت</span>
              <span class="set-row-hint">بۆ نموونە دوای ٣٠ خولەک لە کاتی تۆمارکردنی دەرچوون، خانە هەڵبژێردراوەکان قفڵ دەبن</span>
            </span>
          </label>
          <div id="fl-minutes-wrap" style="margin-top:8px;display:${curType === 'timed' ? 'block' : 'none'}">
            <div class="field" style="max-width:200px">
              <label>ژمارەی خولەک *</label>
              <input type="number" id="fl-minutes" min="1" step="1" value="${curMins}" placeholder="30">
            </div>
            <p class="hint" style="margin-top:4px">بۆ نموونە: 30 واتا دوای ٣٠ خولەک قفڵ دەبێت</p>
          </div>
        </div>
        <div id="fl-fields-wrap" style="margin-top:14px;padding-top:10px;border-top:1px dashed var(--border);${isEnabled ? '' : 'opacity:0.4;pointer-events:none'}">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
            <p style="font-size:0.85rem;font-weight:600;margin:0">کام خانە قفڵ بکرێت؟ (دانە بە دانە)</p>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;flex-shrink:0">
              <input type="checkbox" id="fl-all" style="width:16px;height:16px" ${preSelected.length === Perms.FIELD_LOCK_FIELDS.length ? 'checked' : ''}>
              <span style="font-size:0.78rem;font-weight:700">هەموو خانەکان</span>
            </label>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px">
            ${Perms.FIELD_LOCK_FIELDS.map(f => `
              <label style="display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid var(--border);border-radius:8px;cursor:pointer">
                <input type="checkbox" class="fl-field-cb" value="${f.key}" ${preSelected.includes(f.key) ? 'checked' : ''} style="width:15px;height:15px;flex-shrink:0">
                <span style="font-size:0.78rem">${f.icon} ${UI.esc(f.label)}</span>
              </label>`).join('')}
          </div>
          <p class="hint" style="margin-top:6px">تەنها خانە نیشانەکراوەکان قفڵ دەبن — خانەکانی تر بە ئاسایی دەمێننەوە و دەستکاری دەکرێن.</p>
        </div>`;

      // چالاک/ناچالاک کردنی بەشی جۆر و خانەکان بەپێی چێکباکسی سەرەکی
      const enabledCb = body.querySelector('#fl-enabled');
      const typeWrap = body.querySelector('#fl-type-wrap');
      const fieldsWrap = body.querySelector('#fl-fields-wrap');
      const setSectionsEnabled = () => {
        const on = enabledCb.checked ? '1' : '0.4';
        const pe = enabledCb.checked ? '' : 'none';
        typeWrap.style.opacity = on; typeWrap.style.pointerEvents = pe;
        fieldsWrap.style.opacity = on; fieldsWrap.style.pointerEvents = pe;
      };
      enabledCb.addEventListener('change', setSectionsEnabled);
      // پشاندان/شاردنەوەی خانەی خولەک
      body.querySelectorAll('input[name="fl-type"]').forEach(r => {
        r.addEventListener('change', () => {
          const mw = body.querySelector('#fl-minutes-wrap');
          if (mw) mw.style.display = body.querySelector('#fl-type-timed').checked ? 'block' : 'none';
        });
      });
      // دوگمەی «هەموو خانەکان» — هەموو چێکباوکسەکان یەکجاری نیشانە دەدا/لادەدا
      const allCb = body.querySelector('#fl-all');
      allCb.addEventListener('change', () => {
        body.querySelectorAll('.fl-field-cb').forEach(cb => { cb.checked = allCb.checked; });
      });
      body.querySelectorAll('.fl-field-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          const cbs = [...body.querySelectorAll('.fl-field-cb')];
          allCb.checked = cbs.every(x => x.checked);
        });
      });

      const modal = UI.openModal({
        title: '🔒 ڕێکخستنی قفڵی خانەکانی فۆڕمی دەرچوون',
        body,
        actions: [
          { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => modal.close() },
          {
            label: '💾 پاشەکەوتکردن', className: 'btn-primary', onClick: async () => {
              const enabled = body.querySelector('#fl-enabled').checked;
              const type = body.querySelector('#fl-type-timed').checked ? 'timed' : 'immediate';
              const minutes = Number(body.querySelector('#fl-minutes')?.value) || 30;
              const fields = [...body.querySelectorAll('.fl-field-cb')].filter(cb => cb.checked).map(cb => cb.value);
              if (enabled && !fields.length) {
                UI.toast('تکایە لانیکەم یەک خانە هەڵبژێرە بۆ قفڵکردن', 'warning');
                return;
              }
              if (enabled && type === 'timed' && minutes < 1) {
                UI.toast('تکایە ژمارەیەکی دروستی خولەک بنووسە', 'warning');
                return;
              }
              try {
                const cfg = JSON.parse(JSON.stringify(Store.getPermsConfig() || {}));
                cfg.fieldLock = { enabled, type, minutes, fields };
                await Store.savePermsConfig(cfg);
                UI.toast('ڕێکخستنی قفڵ پاشەکەوت کرا ✓', 'success');
                modal.close();
                renderFieldLockStatus();
              } catch (err) {
                UI.toast('هەڵە لە پاشەکەوتکردن: ' + err.message, 'error', 4200);
              }
            }
          },
        ],
      });
    });

    $('#prf-add-btn', wrap).addEventListener('click', openAddProfessionModal);
    wrap.querySelectorAll('.prf-card').forEach(card => {
      const prof = card.dataset.prof;
      card.querySelector('.prf-perms-btn')?.addEventListener('click', () => openPermsEditor({ prof }));
      card.querySelector('.prf-del-btn')?.addEventListener('click', () => deleteProfession(prof));
    });
  }

  function professionCardHtml(prof, customs, userCount) {
    const isSup = Perms.isSup({ profession: prof });
    const isCustom = customs.includes(prof);
    // ئایا پیشەکە ڕێکخستنی تایبەتی قفڵی خانەکانی هەیە؟
    const pCfg = (Store.getPermsConfig().professions || {})[prof];
    const hasLock = !isSup && pCfg && Array.isArray(pCfg.lockFields);
    return `
      <div class="card prf-card" data-prof="${UI.esc(prof)}">
        <div class="prf-card-head">
          <div class="prf-card-info">
            <b>${UI.esc(prof)}</b>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
              ${isSup ? '<span class="chip" style="background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent)">دەسەڵاتی تەواو — نەگۆڕاو</span>' : ''}
              ${isCustom ? '<span class="chip">زیادکراو</span>' : ''}
              ${hasLock ? '<span class="chip" style="background:color-mix(in srgb,#f59e0b 18%,transparent);color:#f59e0b">🔒 قفڵی تایبەت</span>' : ''}
              <span class="chip">${UI.fmtNum(userCount)} یوسەر</span>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            ${isSup ? '' : `
              <button type="button" class="btn btn-ghost btn-sm prf-perms-btn">🔐 دەسەڵاتەکان</button>
              <button type="button" class="btn btn-ghost btn-sm prf-del-btn" title="${isCustom ? 'سڕینەوەی پیشەکە' : 'شاردنەوەی پیشە بنەڕەتییەکە'}">🗑</button>`}
          </div>
        </div>
      </div>`;
  }

  function openAddProfessionModal() {
    const body = document.createElement('div');
    body.innerHTML = `
      <form novalidate>
        <div class="field">
          <label>ناوی پیشەی نوێ *</label>
          <input type="text" id="npf-name" placeholder="بۆ نموونە: ژمێریار" autocomplete="off">
        </div>
        <p class="hint">پیشەی نوێ بنەڕەتی مینیمالی هەیە (ڕاپۆرتی خۆی، پەیوەندی و ڕێکخستن). پاش دروستکردن دەتوانیت دەسەڵاتەکانی زیاد بکەیت و لە پانێلی بەڕێوەبردن پیشەکە بدەیت بە یوسەر. <b>ئەگەر ناوێک بنووسیت کە پێشتر سڕدراوەتەوە، پیشەکە دەگەڕێتەوە.</b></p>
      </form>`;
    const modal = UI.openModal({
      title: '➕ پیشەی نوێ',
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => modal.close() },
        {
          label: 'دروستکردن', className: 'btn-primary', onClick: async () => {
            const input = $('#npf-name', body);
            const name = (input.value || '').trim();
            if (!name) { input.classList.add('invalid'); return; }
            let users = [];
            try { users = (await Store.loadLists()).users || []; } catch (_) {}
            const existing = Perms.allProfessions(users);
            if (existing.some(p => UI.norm(p) === UI.norm(name))) {
              UI.toast('پیشەیەک بەم ناوە پێشتر هەیە', 'warning');
              return;
            }
            try {
              // ئەگەر پیشەیەکی سڕدراوە بە هەمان ناو بوو — تەنها بگەڕێنرێتەوە
              const deleted = Perms.getDeletedProfessions();
              if (deleted.some(p => UI.norm(p) === UI.norm(name))) {
                const cfg = JSON.parse(JSON.stringify(Store.getPermsConfig()));
                cfg.deleted = (cfg.deleted || []).filter(p => UI.norm(p) !== UI.norm(name));
                await Store.savePermsConfig(cfg);
                UI.toast(`پیشەی «${name}» گەڕایەوە لیستەکە ✓`, 'success');
                modal.close();
                renderContent();
                return;
              }
              await Store.addProfession(name);
              UI.toast(`پیشەی «${name}» دروستکرا ✓`, 'success');
              modal.close();
              renderContent();
            } catch (err) {
              UI.toast('هەڵە لە دروستکردنی پیشە: ' + err.message, 'error', 4200);
            }
          }
        },
      ],
    });
    setTimeout(() => $('#npf-name', body)?.focus(), 60);
  }

  async function deleteProfession(prof) {
    try {
      const ls = await Store.loadLists();
      const used = (ls.users || []).some(u => u.profession === prof);
      if (used) {
        UI.toast('ناتوانرێت پیشەیەک بسڕدرێتەوە کە هێشتا یوسەری تێدایە — سەرەتا پیشەی یوسەرەکان بگۆڕە', 'warning', 4500);
        return;
      }
      const isCustom = Store.getCustomProfessions().includes(prof);
      const ok = await UI.confirmDialog(
        isCustom
          ? `دڵنیاییت لە سڕینەوەی پیشەی «${prof}»؟`
          : `«${prof}» پیشەیەکی بنەڕەتی سیستەمە — دەشاردرێتەوە لە هەموو لیستەکاندا. دواتر بە هەمان ناو لە «پیشەی نوێ» دەگەڕێتەوە. دڵنیاییت؟`,
        { danger: true, okLabel: 'بەڵێ، بسڕەوە', cancelLabel: 'پاشگەزبوونەوە' }
      );
      if (!ok) return;

      const cfg = JSON.parse(JSON.stringify(Store.getPermsConfig()));
      if (isCustom) {
        // پیشەی زیادکراو — ڕیزەکە لە خشتەی professions دەسڕدرێتەوە
        const { names } = await API.Professions.all();
        const row = (names || []).find(r => r.profession === prof);
        if (!row) { UI.toast('ئەم پیشەیە لە خشتەکەدا نییە', 'warning'); renderContent(); return; }
        await Store.removeProfession(row.id, prof);
      } else {
        // پیشەی بنەڕەتی — لە کۆنفیگەکەدا دەشاودەکرێت (دووبارە گەڕانەوە بە هەمان ناو)
        cfg.deleted = cfg.deleted || [];
        if (!cfg.deleted.includes(prof)) cfg.deleted.push(prof);
      }
      // سڕینەوەی دەسەڵاتەکانییش ئەم پیشەیە
      if (cfg.professions && cfg.professions[prof]) delete cfg.professions[prof];
      await Store.savePermsConfig(cfg);
      UI.toast(isCustom ? `پیشەی «${prof}» سڕدرایەوە ✓` : `پیشەی «${prof}» شاردرایەوە ✓`, 'success');
      renderContent();
    } catch (err) {
      UI.toast('هەڵە لە سڕینەوە: ' + err.message, 'error', 4200);
    }
  }

  /* ---------------- بەشی یوسەرەکان ---------------- */

  function renderUsersTab(wrap, ls) {
    const users = ls.users || [];

    wrap.innerHTML = `
      <section class="card" style="padding:14px 18px 12px">
        <h3 style="font-size:0.96rem;margin-bottom:8px"><span class="sec-icon">${UI.icon('users')}</span> یوسەرەکان</h3>
        <div class="field" style="margin-bottom:0">
          <input type="search" id="prf-user-search" placeholder="گەڕان بۆ ناو یان پیشە..." value="${UI.esc(state.userSearch)}" autocomplete="off">
        </div>
        <p class="hint" style="margin:6px 0 0">بە دووگمەی 🔐 دەسەڵاتەکان بۆ هەر یوسەرێک دەتوانیت دیاری بکەیت چی ببینێت و چ کردار ئەنجام بدات — لەوانەش بینینی داتای هەموو یوسەرانی تر لە ڕاپۆرتدا.</p>
      </section>
      <div class="prf-list" id="prf-user-list"></div>`;

    // ڕیزکردن بەپێی پیشە: سایەق ← دابەشکار ← مەندوب ← پیشەکانی تر — بەڕێوەبەر لە خوارەوەترین شوێن
    const rankOf = u => {
      if (Perms.isSup(u)) return 4; // بەڕێوەبەر/بەریوبەر — هەمیشە لە خوارەوە
      const i = [CONFIG.PROFESSION_DRIVER, CONFIG.PROFESSION_DISTRIBUTOR, CONFIG.PROFESSION_DELEGATE].indexOf(u.profession);
      return i === -1 ? 3 : i;
    };
    const byName = (a, b) => String(a.username || '').localeCompare(String(b.username || ''), 'ckb');

    // تەنها لیستەکە ڕێندەر دەکرێتەوە — خانەی گەڕانەکە لە DOM دەمێنێتەوە، فوکەس و سلێکتەکەی نامێنێت
    function renderList() {
      const listEl = $('#prf-user-list', wrap);
      if (!listEl) return;
      const q = UI.norm(state.userSearch);
      const list = users
        .filter(u => !q || [u.username, u.profession].some(v => UI.norm(v).includes(q)))
        .sort((a, b) => (rankOf(a) - rankOf(b)) || byName(a, b));

      listEl.innerHTML = list.map(u => {
        const uCfg = (Store.getPermsConfig().users || {})[String(u.id)];
        const hasLock = uCfg && Array.isArray(uCfg.lockFields);
        return `
        <div class="card prf-card prf-user-card clickable-row" data-uid="${UI.esc(String(u.id))}">
          ${UI.avatarHtml(u, 44)}
          <div class="prf-card-info" style="flex:1">
            <b>${UI.esc(u.username)}</b>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
              <span class="chip">${UI.esc(u.profession || '—')}</span>
              ${hasLock ? '<span class="chip" style="background:color-mix(in srgb,#f59e0b 18%,transparent);color:#f59e0b">🔒 قفڵی تایبەت</span>' : ''}
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm prf-perms-btn">🔐 دەسەڵاتەکان</button>
        </div>`;
      }).join('') || '<div class="empty-state"><p>هیچ یوسەرێک نەدۆزرایەوە.</p></div>';

      listEl.querySelectorAll('.prf-user-card').forEach(card => {
        card.querySelector('.prf-perms-btn').addEventListener('click', () => {
          const u = users.find(x => String(x.id) === card.dataset.uid);
          if (u) openPermsEditor({ user: u });
        });
      });
    }

    $('#prf-user-search', wrap).addEventListener('input', e => {
      state.userSearch = e.target.value;
      renderList();
    });

    renderList();
  }

  /* ---------------- ئێدیتەری دەسەڵاتەکان ---------------- */

  // ئێدیتەر بۆ پیشە: { prof } — بۆ یوسەر: { user }
  function openPermsEditor({ prof = null, user = null }) {
    const isUserMode = !!user;
    const targetProf = isUserMode ? user.profession : prof;
    const title = isUserMode ? `🔐 دەسەڵاتەکانی ${user.username}` : `🔐 دەسەڵاتەکانی پیشەی ${prof}`;

    // قفڵی خانەکان — سەرچاوەی ئێستا (یوسەر ← پیشە ← بنەڕەتی گشتی)
    const lockNow = Perms.lockFieldsFor(targetProf, isUserMode ? user.id : undefined);
    const hasCustomLock = lockNow.source === 'user' || lockNow.source === 'profession';
    const lockSrcText = lockNow.source === 'user' ? 'ڕێکخستنی تایبەتی ئەم یوسەرە'
      : lockNow.source === 'profession' ? 'ڕێکخستنی پیشەکەی'
      : 'بنەڕەتی گشتی';

    const body = document.createElement('div');
    body.innerHTML = `
      ${isUserMode ? `<p class="hint" style="margin-top:0">پیشە: <b>${UI.esc(targetProf || '—')}</b> — نرخەکانی ئێرە لەسەر دەسەڵاتی پیشەکە جێبەجێ دەبن.</p>` : ''}
      <div class="prf-perms-grid">
        ${Perms.GROUPS.map(g => `
          <div class="prf-perm-group">
            <div class="prf-perm-group-head">
              <b>${g.label}</b>
              <span style="font-size:0.68rem;color:var(--muted)">بینین = 👁 • کردار = ⚡</span>
            </div>
            <div class="prf-perm-rows">
              ${Perms.FEATURES.filter(f => f.group === g.key).map(f => {
                const val = Perms.effective(targetProf, isUserMode ? user.id : undefined, f.type, f.key);
                const tag = f.type === 'view' ? '👁' : '⚡';
                return `
                <label class="prf-perm-row">
                  <input type="checkbox" data-type="${f.type}" data-key="${f.key}" ${val ? 'checked' : ''}>
                  <span class="prf-perm-label"><span class="prf-perm-tag">${tag}</span> ${UI.esc(f.label)}</span>
                </label>`;
              }).join('')}
            </div>
          </div>`).join('')}

        <!-- 🔒 قفڵی خانەکانی فۆڕمی دەرچوون — دانە بە دانە بۆ ئەم پیشەیە/یوسەرە -->
        <div class="prf-perm-group">
          <div class="prf-perm-group-head">
            <b>🔒 قفڵی خانەکانی فۆڕمی دەرچوون</b>
            <span style="font-size:0.68rem;color:var(--muted)">دابەشکردنی دانە بە دانە</span>
          </div>
          <p class="hint" style="margin:0 0 8px">کاتێک قفڵی خانەکان چالاک بێت، تەنها ئەم خانانە قفڵ دەبن بۆ ${isUserMode ? 'ئەم یوسەرە' : 'ئەم پیشەیە'}. ئێستا: <b>${lockSrcText}</b> — ${UI.fmtNum(lockNow.fields.length)} خانە.</p>
          <div class="prf-perm-rows">
            <label class="prf-perm-row">
              <input type="radio" name="plf-mode" value="inherit" ${hasCustomLock ? '' : 'checked'}>
              <span class="prf-perm-label"><span class="prf-perm-tag">↳</span> ${isUserMode
                ? 'بەدوای پیشەکەیدا بڕۆ — ئەگەر پیشەکەی تایبەتی نەبوو، بنەڕەتی گشتی جێبەجێ دەبێت'
                : 'بەدوای بنەڕەتی گشتیدا بڕۆ — ڕێکخستنی گشتی قفڵ (دوگمەی ⚙️ ڕێکخستن لە سەرەوە)'}</span>
            </label>
            <label class="prf-perm-row">
              <input type="radio" name="plf-mode" value="custom" ${hasCustomLock ? 'checked' : ''}>
              <span class="prf-perm-label"><span class="prf-perm-tag">★</span> ڕێکخستنی تایبەت — دانە بە دانە دیاری بکە</span>
            </label>
          </div>
          <div id="plf-fields-wrap" style="display:${hasCustomLock ? 'block' : 'none'};margin-top:8px;padding:10px;border:1px dashed var(--border);border-radius:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
              <p style="font-size:0.82rem;font-weight:700;margin:0">کام خانە قفڵ ببن؟</p>
              <label style="display:flex;align-items:center;gap:5px;cursor:pointer;flex-shrink:0">
                <input type="checkbox" id="plf-all" style="width:15px;height:15px">
                <span style="font-size:0.75rem;font-weight:700">هەموو خانەکان</span>
              </label>
            </div>
            <div class="plf-fields-grid">
              ${Perms.FIELD_LOCK_FIELDS.map(f => `
                <label class="plf-field-item">
                  <input type="checkbox" class="plf-cb" value="${f.key}" ${lockNow.fields.includes(f.key) ? 'checked' : ''}>
                  <span>${f.icon} ${UI.esc(f.label)}</span>
                </label>`).join('')}
            </div>
            <p class="hint" style="margin:6px 0 0">ئەگەر هیچ خانەیەک نەنیشانە بکەیت، هیچ شتێک قفڵ نابێت بۆ ${isUserMode ? 'ئەم یوسەرە' : 'ئەم پیشەیە'} — تەنانەت ئەگەر بنەڕەتی گشتی چالاک بێت.</p>
          </div>
        </div>
      </div>`;

    // --- قفڵی خانەکان: گۆڕینی مۆد + دوگمەی «هەموو خانەکان» ---
    const plfWrap = body.querySelector('#plf-fields-wrap');
    const plfModeRadios = () => [...body.querySelectorAll('input[name="plf-mode"]')];
    const isCustomMode = () => !!body.querySelector('input[name="plf-mode"][value="custom"]').checked;
    plfModeRadios().forEach(r => r.addEventListener('change', () => {
      plfWrap.style.display = isCustomMode() ? 'block' : 'none';
    }));
    const plfCbs = () => [...body.querySelectorAll('.plf-cb')];
    const plfAll = body.querySelector('#plf-all');
    const syncPlfAll = () => { plfAll.checked = plfCbs().length > 0 && plfCbs().every(x => x.checked); };
    plfAll.addEventListener('change', () => plfCbs().forEach(cb => { cb.checked = plfAll.checked; }));
    plfCbs().forEach(cb => cb.addEventListener('change', syncPlfAll));
    syncPlfAll();

    const modal = UI.openModal({
      title,
      wide: true,
      body,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => modal.close() },
        {
          label: isUserMode ? '🗑 سڕینەوەی جیاوازی' : '⟲ گەڕانەوە بۆ بنەڕەت', className: 'btn-ghost', onClick: async () => {
            const ok = await UI.confirmDialog(
              isUserMode
                ? 'جیاوازییە تایبەتییەکانی ئەم یوسەرە دەسڕدرێنەوە — دەسەڵاتەکان و ڕێکخستنی قفڵی خانەکانیش دەگەڕێنەوە بۆ پیشەکەی. دڵنیاییت؟'
                : `هەموو دەسەڵاتەکان و ڕێکخستنی تایبەتی قفڵی خانەکانی پیشەی «${prof}» دەگەڕێنەوە بنەڕەتی سیستەم. دڵنیاییت؟`,
              { danger: true, okLabel: 'بەڵێ', cancelLabel: 'نەخێر' }
            );
            if (!ok) return;
            try {
              const cfg = Store.getPermsConfig();
              if (isUserMode) {
                if (cfg.users) delete cfg.users[String(user.id)];
              } else {
                if (cfg.professions) delete cfg.professions[prof];
              }
              await Store.savePermsConfig(cfg);
              UI.toast('گەڕایەوە بنەڕەت ✓', 'success');
              modal.close();
              renderContent();
            } catch (err) {
              UI.toast('هەڵە: ' + err.message, 'error', 4200);
            }
          }
        },
        {
          label: '💾 پاشەکەوتکردن', className: 'btn-primary', onClick: async () => {
            const view = {}, act = {};
            body.querySelectorAll('input[data-type]').forEach(cb => {
              const t = cb.dataset.type, k = cb.dataset.key;
              if (t === 'view') view[k] = cb.checked;
              else if (t === 'act') act[k] = cb.checked;
            });
            const entry = { view, act };
            // قفڵی خانەکان — تەنها لە مۆدی تایبەتدا پاشەکەوت دەکرێت؛ لە مۆدی بەدوای بنەڕەتدا نانووسرێت
            if (isCustomMode()) {
              entry.lockFields = plfCbs().filter(cb => cb.checked).map(cb => cb.value);
            }
            try {
              const cfg = JSON.parse(JSON.stringify(Store.getPermsConfig()));
              if (isUserMode) {
                cfg.users = cfg.users || {};
                cfg.users[String(user.id)] = entry;
              } else {
                cfg.professions = cfg.professions || {};
                cfg.professions[prof] = entry;
              }
              await Store.savePermsConfig(cfg);
              UI.toast('دەسەڵاتەکان پاشەکەوت کران ✓', 'success');
              modal.close();
              renderContent();
            } catch (err) {
              UI.toast('هەڵە لە پاشەکەوتکردن: ' + err.message, 'error', 4200);
            }
          }
        },
      ],
    });
  }

  return { render, stop };
})();
