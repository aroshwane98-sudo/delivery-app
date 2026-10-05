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
    const pd = Store.PRINT_DEFAULTS;

    el.innerHTML = `
      <div class="settings-view">
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

        <form id="contact-form" novalidate style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)">
          <div class="field-row">
            <div class="field"><label>📞 ژمارەی تەلەفۆن ١</label><input type="tel" id="pf-phone1" dir="ltr" placeholder="07XX XXX XXXX" value="${UI.esc(u.phone_number_1 || '')}"></div>
            <div class="field"><label>📞 ژمارەی تەلەفۆن ٢</label><input type="tel" id="pf-phone2" dir="ltr" placeholder="07XX XXX XXXX" value="${UI.esc(u.phone_number_2 || '')}"></div>
          </div>
          <div class="field"><label>📍 شوێن (لۆکەیشن)</label><input type="text" id="pf-location" placeholder="شوێنەکەت بنووسە" value="${UI.esc(u.location || '')}"></div>
          <button class="btn btn-primary btn-block" type="submit">💾 پاشەکەوتکردنی زانیاری پەیوەندی</button>
          <p class="hint">ژمارەکان و شوێنەکەت لە ویندۆی پڕۆفایلەکەتدا پیشان دەدرێن کاتێک کەسێک لەسەر وێنەکەت دادەگرێت.</p>
        </form>
      </section>

      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('lock')}</span> گۆڕینی تێپەڕەوشە</h3>
        <form id="pass-form" autocomplete="off" novalidate>
          <div class="field"><label>تێپەڕەوشەی ئێستا</label><input id="p-current" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="new-password"></div>
          <div class="field-row">
            <div class="field"><label>تێپەڕەوشەی نوێ</label><input id="p-new" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="new-password"></div>
            <div class="field"><label>دووبارەی نوێ</label><input id="p-confirm" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="new-password"></div>
          </div>
          <p class="hint">تێپەڕەوشە دەبێت ٤ ژمارە بێت.</p>
          <button class="btn btn-primary" type="submit">نوێکردنەوەی تێپەڕەوشە</button>
        </form>
      </section>

      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('palette')}</span> ڕووکار</h3>
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
        <p class="hint" style="margin-top:12px">ڕەنگی سترۆکی پلاتفۆرم:</p>
        <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
          <input type="color" id="border-color-picker" value="${s.borderColor || (s.theme === 'dark' ? '#2a3650' : '#e0e7f0')}" style="width:44px;height:36px;border:none;border-radius:8px;padding:2px;cursor:pointer;background:var(--surface-2)">
          <span style="font-size:0.85rem;color:var(--muted)" id="border-color-label">${s.borderColor ? s.borderColor : 'بنەڕەتی تیم'}</span>
          <button type="button" id="border-color-reset" class="btn btn-sm btn-ghost" style="margin-inline-start:auto">⟲ بنەڕەت</button>
        </div>

        <label class="set-row" for="set-show-icons" style="margin-top:14px;border-bottom:none">
          <input type="checkbox" id="set-show-icons" ${s.showIcons !== false ? 'checked' : ''}>
          <span class="set-row-txt">
            <span class="set-row-title">پشاندانی ئایکۆنەکان</span>
            <span class="set-row-hint">ئایکۆنە مۆدێرنەکانی سەر تایتڵ و بەشەکان پیشان دەدرێن — بە ناچالاککردنی ئەمە هەموویان دەشاردرێنەوە.</span>
          </span>
        </label>
        <label class="set-row" for="set-glow" style="margin-top:14px;border-bottom:none">
          <input type="checkbox" id="set-glow" ${s.glow ? 'checked' : ''}>
          <span class="set-row-txt">
            <span class="set-row-title">💡 گڵۆپ</span>
            <span class="set-row-hint">لایتێک لەچوارچێوەی کارت و ویندۆیەکاندا دەسوڕێتەوە.</span>
          </span>
        </label>
        <div id="glow-extra" ${s.glow ? '' : 'hidden'} style="margin-top:8px">
          <div class="field"><label>🎨 ڕەنگی گڵۆپ</label><input type="color" id="glow-color" value="${s.glowColor || '#10b981'}"></div>
          <div class="field"><label>📏 درێژی گڵۆپ — <b id="glow-len-val">${Math.min(60, Math.max(5, Number(s.glowLen) || 20))}%</b></label><input type="range" id="glow-len" min="5" max="60" step="5" value="${Math.min(60, Math.max(5, Number(s.glowLen) || 20))}"></div>
          <div class="field"><label>⚡ خێرایی سوڕانەوە — <b id="glow-speed-val">${Number(s.glowSpeed) || 4}</b> <span class="muted">(بەرزتر = خێراتر)</span></label><input type="range" id="glow-speed" min="1" max="10" step="1" value="${Number(s.glowSpeed) || 4}"></div>
        </div>
      </section>

      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('monitor')}</span> شێوازی پیشاندانی خشتەکان</h3>
        <div class="set-rows">
          <label class="set-row">
            <input type="checkbox" id="set-row-click-fullscreen" ${s.rowClickFullscreen !== false ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">پەڕەی زانیاریەکان</span>
              <span class="set-row-hint">لەکاتی داگرتنی هەر ڕیزێکی زانیاریەکانت پڕبە شاشە زانیاریەکان دەبینیت</span>
            </span>
          </label>
          <label class="set-row">
            <input type="checkbox" id="set-report-card-layout" ${s.reportCardLayout ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">پیشاندانی ڕاپۆرت وەک کارتی مۆبایل</span>
              <span class="set-row-hint">لەبری خشتە، داتاکان بە شێوەی کارتی سەربەیەک پیشان دەدات بۆ ئاسانکاری لە مۆبایلدا.</span>
            </span>
          </label>
          <label class="set-row">
            <input type="checkbox" id="set-cell-titles" ${s.cellTitles ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">پشاندانی ناونیشانەکان لەناو خانەکانی خۆیان</span>
              <span class="set-row-hint">ناوی هەر ستوونێک لەناو خانەکەی خۆیدا پیشان دەدرێت — بۆ خوێندنەوەی خێراترین بەبێ گەڕان بۆ سەرپەڕەی خشتەکە.</span>
            </span>
          </label>
          <label class="set-row">
            <input type="checkbox" id="set-show-hints" ${s.showHints !== false ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">پشاندانی تێبینی و ڕوونکردنەوەکان</span>
              <span class="set-row-hint">سەرجەم تێبینی و ڕوونکردنەوەکانی ناو سیستەم پیشان دەدرێت — بە ناچالاککردنی ئەمە هەموویان دەشاردرێنەوە.</span>
            </span>
          </label>
        </div>
      </section>

      ${Perms.canView(u, 'set_keypad') ? `
      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('keyboard')}</span> کیبۆردی تایبەتی سیستەم</h3>
        <div class="set-rows">
          <label class="set-row">
            <input type="checkbox" id="set-custom-keypad-text" ${s.customKeypadText ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">کیبۆردی پیتەکان — بۆ خانە نووسینەکان</span>
              <span class="set-row-hint">هەموو پیته کوردییەکان پیشان دەدات بۆ خانەکانی ناو وەک سایەق، دابەشکار، مەندوب و زۆن.</span>
            </span>
          </label>
          <label class="set-row">
            <input type="checkbox" id="set-custom-keypad-num" ${s.customKeypadNum ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">کیبۆردی ژمارەکان — بۆ خانە ژمارەییەکان</span>
              <span class="set-row-hint">ژمارە و ئامرازی (+) و (−) پیشان دەدات بۆ خانەکانی ژمارەی سەیارە، وەسڵ، کێشی بار و پارچەکان — چونکە کیبۆردی ئائیۆس ئەم دوو ئامرازە پیشان نادات.</span>
            </span>
          </label>
        </div>
      </section>` : ''}

      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('columns')}</span> پیشاندان/شاردنەوەی ستوونەکان و کۆیەکان</h3>
        <p class="hint">دانە دانە دیاری بکە کام ستوونی خشتە و کام کارتی تۆتاڵ پیشان بدرێت یان بشاردرێتەوە — لە هەردوو بەشی ڕاپۆرت و تۆمارەکانی بەڕێوبەر جێبەجێ دەبێت.</p>

        <div class="vis-group">
          <div class="vis-group-head">
            <b>ستوونەکانی خشتە</b>
            <div class="vis-group-actions">
              <button type="button" class="btn btn-sm btn-ghost" data-vis-all="cols">هەموو</button>
              <button type="button" class="btn btn-sm btn-ghost" data-vis-none="cols">هیچ</button>
            </div>
          </div>
          <div class="vis-chips" id="cols-toggles">
            ${CONFIG.TABLE_COLUMNS.map(c => `
              <label class="check-chip">
                <input type="checkbox" data-col="${c.key}" ${(s.hiddenCols || []).includes(c.key) ? '' : 'checked'}>
                <span>${UI.esc(c.label)}</span>
              </label>`).join('')}
          </div>
        </div>

        <div class="vis-group">
          <div class="vis-group-head">
            <b>ویندۆی تۆتاڵەکان</b>
            <div class="vis-group-actions">
              <button type="button" class="btn btn-sm btn-ghost" data-vis-all="totals">هەموو</button>
              <button type="button" class="btn btn-sm btn-ghost" data-vis-none="totals">هیچ</button>
            </div>
          </div>
          <div class="vis-chips" id="totals-toggles">
            ${CONFIG.TOTAL_CARDS.map(c => `
              <label class="check-chip">
                <input type="checkbox" data-total="${c.key}" ${(s.hiddenTotals || []).includes(c.key) ? '' : 'checked'}>
                <span>${UI.esc(c.label)}</span>
              </label>`).join('')}
          </div>
        </div>
      </section>

      ${Perms.canView(u, 'set_lockscreen') ? `
      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('smartphone')}</span> کردارەکان لەسەر شاشەی قفڵ (Lock Screen)</h3>
        <div class="set-rows">
          <label class="set-row">
            <input type="checkbox" id="set-lock-screen-actions" ${s.lockScreenActions ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">پیشاندانی کردارەکانی گەشت لەسەر شاشەی قفڵ</span>
              <span class="set-row-hint">لەکاتی دەرچوون، نۆتیفیکەیشنێک دێتە سەر شاشەی قفڵی مۆبایلەکەت و دەتوانیت کردارەکانی (ناو زۆن، دەرێی زۆن، گەشتنەوە) دانە دانە لەوێوە جێبەجێ بکەیت بەبێ کردنەوەی ئەپەکە.</span>
            </span>
          </label>
        </div>
        <div id="lockscreen-perm-alert" style="display:${('Notification' in window && Notification.permission !== 'granted' && s.lockScreenActions) ? 'block' : 'none'};margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:10px;">
          <span style="font-size:0.82rem;color:var(--text)">⚠️ پێویستە مۆڵەتی نۆتیفیکەیشن بە وێبگەڕەکە بدەیت:</span>
          <button type="button" class="btn btn-sm btn-ghost" id="grant-notif-perm-btn" style="margin-top:6px;width:100%">🔔 پێدانی مۆڵەتی نۆتیفیکەیشن</button>
        </div>
      </section>` : ''}

      ${Perms.canView(u, 'set_notif') ? `
      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('bell')}</span> نۆتیفیکەیشنەکانی گۆڕانکاری</h3>
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
      </section>` : ''}

      ${Perms.canView(u, 'set_print') ? `
      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('printer')}</span> ناوەڕۆکی پرێنتکردن</h3>
        <p class="hint">ئەمە شێوەی ڕاستەقینەی پرێنتکردنە. کلیک لەسەر هەر دەقێک بکە و بیگۆڕە، و بە دوگمەی 👁 هەر بەشێک بشارەوە یان پیشانی بدە — دواتر «پاشەکەوتکردن» دابگرە.</p>

        <div class="print-preview-wrap">
          <div class="pp-paper">
            <div class="pp-header">
              <div class="pp-header-right">
                <div class="pp-el ${s.printShowTitle !== false ? '' : 'pp-off'}">
                  <button type="button" class="pp-eye ${s.printShowTitle !== false ? 'on' : ''}" data-pr-toggle="printShowTitle" title="پیشاندان/شاردنەوەی تایتڵ">👁</button>
                  <h1 class="pp-title" contenteditable="true" spellcheck="false" data-pr-text="printTitle">${UI.esc(String(s.printTitle || '').trim() || pd.printTitle)}</h1>
                </div>
                <div class="pp-el ${s.printShowSub !== false ? '' : 'pp-off'}">
                  <button type="button" class="pp-eye ${s.printShowSub !== false ? 'on' : ''}" data-pr-toggle="printShowSub" title="پیشاندان/شاردنەوەی ژێرتایتڵ">👁</button>
                  <div class="pp-sub" contenteditable="true" spellcheck="false" data-pr-text="printSub">${UI.esc(String(s.printSub || '').trim() || pd.printSub)}</div>
                </div>
              </div>
              <div class="pp-header-left">
                <div class="pp-printtime">بەرواری چاپ: ${UI.esc(UI.todayStr())} • ${UI.esc(UI.nowTime())}</div>
                <div class="pp-el ${s.printShowPrintNote !== false ? '' : 'pp-off'}">
                  <button type="button" class="pp-eye ${s.printShowPrintNote !== false ? 'on' : ''}" data-pr-toggle="printShowPrintNote" title="پیشاندان/شاردنەوەی تێبینی چاپ">👁</button>
                  <div class="pp-note-txt">چاپکراوە لە پانێلی بەڕێوبەر</div>
                </div>
              </div>
            </div>

            <div class="pp-el ${s.printShowMeta !== false ? '' : 'pp-off'}">
              <button type="button" class="pp-eye ${s.printShowMeta !== false ? 'on' : ''}" data-pr-toggle="printShowMeta" title="پیشاندان/شاردنەوەی زانیاری فلتەر">👁</button>
              <div class="pp-meta">
                <div><span>مەودای بەروار:</span> <b>تەواوی بەروارەکان</b></div>
                <div><span>بەکارهێنەر:</span> <b>هەموو بەکارهێنەران</b></div>
                <div><span>گەڕان بەدوای:</span> <b>—</b></div>
                <div><span>کۆی تۆمارەکان:</span> <b>٠ گەشت</b></div>
              </div>
            </div>

            <div class="pp-totals">
              <div class="pp-tbox"><div class="v">٠</div><div class="l">کۆی گەشتەکان</div></div>
              <div class="pp-tbox"><div class="v">٠</div><div class="l">کۆی کێش (کگم)</div></div>
              <div class="pp-tbox"><div class="v">٠</div><div class="l">کۆی پارچە</div></div>
              <div class="pp-tbox"><div class="v">٠</div><div class="l">کۆی وەسڵ</div></div>
              <div class="pp-tbox"><div class="v">٠ د.ع</div><div class="l">کۆی پارەی هێنراوە</div></div>
              <div class="pp-tbox"><div class="v">—</div><div class="l">کۆی کاتی کارکردن</div></div>
            </div>

            <div class="pp-table">
              <div class="pp-tr head">
                <div>#</div><div>بەروار</div><div>شۆفێر</div><div>زۆن</div><div>دەرچوون</div><div>گەشتنەوە</div><div>کاتی کار</div><div>پارە</div>
              </div>
              <div class="pp-tr">
                <div>١</div><div>—</div><div>—</div><div>—</div><div>—</div><div>—</div><div>—</div><div>—</div>
              </div>
              <div class="pp-tr">
                <div>٢</div><div>—</div><div>—</div><div>—</div><div>—</div><div>—</div><div>—</div><div>—</div>
              </div>
            </div>

            <div class="pp-el ${s.printShowFooter !== false ? '' : 'pp-off'}">
              <button type="button" class="pp-eye ${s.printShowFooter !== false ? 'on' : ''}" data-pr-toggle="printShowFooter" title="پیشاندان/شاردنەوەی فووتەر">👁</button>
              <div class="pp-footer">
                <span contenteditable="true" spellcheck="false" data-pr-text="printFooterRight">${UI.esc(String(s.printFooterRight || '').trim() || pd.printFooterRight)}</span>
                <span contenteditable="true" spellcheck="false" data-pr-text="printFooterLeft">${UI.esc(String(s.printFooterLeft || '').trim() || pd.printFooterLeft)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="field-row" style="margin-top:12px">
          <button class="btn btn-primary" id="pr-save" type="button" style="flex:1">💾 پاشەکەوتکردن</button>
          <button class="btn btn-ghost" id="pr-reset" type="button" style="flex:1">⟲ گەڕانەوە بۆ بنەڕەت</button>
        </div>
      </section>` : ''}

      ${Perms.canView(u, 'set_font') ? `
      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('type')}</span> فۆنت و قەبارەی نووسین</h3>
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

      ${Perms.canView(u, 'set_backup') ? `
      <section class="card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('database')}</span> باک ئەپ (پاشەکەوتکردنی خۆکار)</h3>
        <p class="hint">
          سیستەم ڕۆژانە (هەر ٦ کاتژمێر جارێک) داتاکانی ئەمڕۆ بە فایلی ئێکسڵ باک ئەپ دەکات.
          <br>ناوی فایل = بەرواری ئەو ڕۆژەی باک ئەپ دەکرێت.
        </p>

        <div class="field-row" style="margin-top:10px">
          <div class="field" style="flex:1">
            <label>شوێنی باک ئەپ</label>
            <div id="backup-dir-display" style="padding:8px 12px;background:var(--card-bg,#1a2332);border:1px solid var(--border,#2a3a4e);border-radius:10px;font-size:0.85rem;word-break:break-all;min-height:38px;display:flex;align-items:center">
              ${s.backupDirName ? '<span style="color:var(--accent)">📁 ' + UI.esc(s.backupDirName) + '</span>' : '<span style="color:var(--muted)">هیچ شوێنێک هەڵنەبژێردراوە</span>'}
            </div>
          </div>
        </div>

        <div class="field-row" style="gap:8px;margin-top:8px">
          <button class="btn btn-primary" id="backup-choose-dir" type="button" style="flex:1">📂 هەڵبژاردنی شوێنی باک ئەپ</button>
          <button class="btn btn-ghost" id="backup-run-now" type="button" style="flex:1" ${s.backupDirName ? '' : 'disabled'}>▶ باک ئەپی ئێستا</button>
        </div>

        <div class="set-rows" style="margin-top:8px">
          <label class="set-row">
            <input type="checkbox" id="set-backup-enabled" ${s.backupEnabled ? 'checked' : ''}>
            <span class="set-row-txt">
              <span class="set-row-title">چالاککردنی باک ئەپی خۆکار</span>
              <span class="set-row-hint">هەر ٦ کاتژمێر جارێک داتاکانی ئەمڕۆ باک ئەپ دەکرێت</span>
            </span>
          </label>
        </div>

        <div id="backup-status" style="margin-top:10px;padding:8px 12px;background:var(--card-bg,#1a2332);border:1px solid var(--border,#2a3a4e);border-radius:10px;font-size:0.82rem">
          <div id="backup-last-info" style="color:var(--muted)">باری باک ئەپ: چاوەڕوان بە...</div>
        </div>
      </section>` : ''}

      <section class="card">
        <button class="btn btn-danger btn-block" id="settings-logout-btn" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
          دەرچوون لە هەژمار
        </button>
      </section>

      <section class="card about-card">
        <h3 class="section-title"><span class="sec-icon">${UI.icon('info')}</span> دەربارەی سیستەم</h3>
        <p class="hint">${UI.esc(CONFIG.APP_NAME)} — نسخە ${CONFIG.APP_VERSION}<br>
        پلاتفۆرمی ڕێکخستن، بەدواداچوون و تۆمارکردنی پرۆسەکانی گەیاندن بۆ شۆفێر، دابەشکار و مەندوب.
        دروستکراوە لەلایان (احمد ڕەمەزان) .</p>
      </section>
      </div>`;

    $('#settings-logout-btn', el).addEventListener('click', () => App.logout && App.logout());

    /* — ئاڤاتار — */
    $('#avatar-btn', el).addEventListener('click', () => $('#avatar-file', el).click());
    $('#avatar-file', el).addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      UI.avatarEditor(file, {
        onSave: async dataUrl => {
          const updated = await API.Lists.updateUser(App.getUser().id, { avatar_url: dataUrl });
          Store.updateSession({ avatar_url: updated ? updated.avatar_url : dataUrl });
          $('#profile-avatar', container).innerHTML = UI.avatarHtml(App.getUser(), 76);
          App.renderHeader();
          UI.toast('وێنەی پڕۆفایل نوێ کرایەوە ✓', 'success');
        },
      });
    });

    /* — زانیاری پەیوەندی (ژمارە تەلەفۆن و شوێن) — */
    $('#contact-form', el).addEventListener('submit', handleContactSave);

    /* — تێپەڕەوشە — */
    UI.maskSecretInputs(el); // بێ type="password" — بۆ نەبوونی پۆپئەپی سەیڤکردنی پاسۆرد لە براوسەر
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

    // ڕەنگی سترۆک — گۆڕینی خۆکار لەکاتی هەڵبژاردن
    $('#border-color-picker', el)?.addEventListener('input', e => {
      Store.saveSettings({ borderColor: e.target.value });
      const lbl = $('#border-color-label', el);
      if (lbl) lbl.textContent = e.target.value;
    });
    $('#border-color-reset', el)?.addEventListener('click', () => {
      Store.saveSettings({ borderColor: null });
      render(container);
    });

    /* — پشاندان/شاردنەوەی ئایکۆنەکان — */
    $('#set-show-icons', el)?.addEventListener('change', e => {
      Store.saveSettings({ showIcons: e.target.checked });
      UI.toast(e.target.checked ? 'ئایکۆنەکان پیشان دەدرێن ✓' : 'ئایکۆنەکان شاردراونەوە', 'info');
    });

    /* — گڵۆپ: لایتێکی سوڕاو لەسەر چوارچێوەی کارت و ویندۆیەکان — */
    $('#set-glow', el)?.addEventListener('change', e => {
      Store.saveSettings({ glow: e.target.checked });
      const extra = $('#glow-extra', el);
      if (extra) extra.hidden = !e.target.checked;
      UI.toast(e.target.checked ? 'گڵۆپ چالاک کرا ✓' : 'گڵۆپ ناچالاک کرا', 'info');
    });
    $('#glow-color', el)?.addEventListener('input', e => Store.saveSettings({ glowColor: e.target.value }));
    $('#glow-len', el)?.addEventListener('input', e => {
      Store.saveSettings({ glowLen: Number(e.target.value) });
      const v = $('#glow-len-val', el);
      if (v) v.textContent = e.target.value + '%';
    });
    $('#glow-speed', el)?.addEventListener('input', e => {
      Store.saveSettings({ glowSpeed: Number(e.target.value) });
      const v = $('#glow-speed-val', el);
      if (v) v.textContent = e.target.value;
    });

    /* — شێوازی پیشاندانی خشتە — */
    $('#set-row-click-fullscreen', el)?.addEventListener('change', e => {
      Store.saveSettings({ rowClickFullscreen: e.target.checked });
      UI.toast(e.target.checked ? 'ئۆپشنی پیشاندانی پڕ بە شاشە چالاک کرا ✓' : 'ئۆپشنی پیشاندانی پڕ بە شاشە ناچالاک کرا', 'info');
    });

    $('#set-report-card-layout', el)?.addEventListener('change', e => {
      Store.saveSettings({ reportCardLayout: e.target.checked });
      UI.toast(e.target.checked ? 'شێوازی پیشاندانی ڕاپۆرت وەک کارت چالاک کرا ✓' : 'شێوازی پیشاندانی ڕاپۆرت وەک کارت ناچالاک کرا', 'info');
    });

    $('#set-cell-titles', el)?.addEventListener('change', e => {
      Store.saveSettings({ cellTitles: e.target.checked });
      UI.toast(e.target.checked ? 'پشاندانی ناونیشانەکان لەناو خانەکان چالاک کرا ✓' : 'پشاندانی ناونیشانەکان لەناو خانەکان ناچالاک کرا', 'info');
    });

    $('#set-show-hints', el)?.addEventListener('change', e => {
      Store.saveSettings({ showHints: e.target.checked });
      UI.toast(e.target.checked ? 'تێبینی و ڕوونکردنەوەکان پیشان دەدرێن ✓' : 'تێبینی و ڕوونکردنەوەکان شاردراونەوە', 'info');
    });

    $('#set-custom-keypad-text', el)?.addEventListener('change', e => {
      Store.saveSettings({ customKeypadText: e.target.checked });
      UI.toast(e.target.checked ? 'کیبۆردی پیتەکان چالاک کرا ✓' : 'کیبۆردی پیتەکان ناچالاک کرا', 'info');
    });

    $('#set-custom-keypad-num', el)?.addEventListener('change', e => {
      Store.saveSettings({ customKeypadNum: e.target.checked });
      UI.toast(e.target.checked ? 'کیبۆردی ژمارەکان چالاک کرا ✓' : 'کیبۆردی ژمارەکان ناچالاک کرا', 'info');
    });

    /* — پشاندان/شاردنەوەی ستوونەکان و کۆیەکان (دانە دانە) — */
    const labelOf = cb => cb.closest('.check-chip')?.querySelector('span')?.textContent || '';

    const bindVisGroup = (attr, storeKey, allKeys, kindWord) => {
      el.querySelectorAll(`input[${attr}]`).forEach(cb => {
        cb.addEventListener('change', () => {
          const key = cb.getAttribute(attr);
          const cur = new Set(Store.getSettings()[storeKey] || []);
          if (cb.checked) cur.delete(key); else cur.add(key);
          Store.saveSettings({ [storeKey]: [...cur] });
          UI.toast(cb.checked ? `${kindWord}ی «${labelOf(cb)}» پیشان دەدرێت ✓` : `${kindWord}ی «${labelOf(cb)}» شاردراوە`, 'info');
        });
      });
      el.querySelector(`[data-vis-all="${attr === 'data-col' ? 'cols' : 'totals'}"]`)?.addEventListener('click', () => {
        Store.saveSettings({ [storeKey]: [] });
        el.querySelectorAll(`input[${attr}]`).forEach(cb => { cb.checked = true; });
        UI.toast(`هەموو ${kindWord}ەکان پیشان دەدرێن ✓`, 'success');
      });
      el.querySelector(`[data-vis-none="${attr === 'data-col' ? 'cols' : 'totals'}"]`)?.addEventListener('click', () => {
        Store.saveSettings({ [storeKey]: [...allKeys] });
        el.querySelectorAll(`input[${attr}]`).forEach(cb => { cb.checked = false; });
        UI.toast(`هەموو ${kindWord}ەکان شاردراونەوە`, 'info');
      });
    };

    bindVisGroup('data-col', 'hiddenCols', CONFIG.TABLE_COLUMNS.map(c => c.key), 'ستوون');
    bindVisGroup('data-total', 'hiddenTotals', CONFIG.TOTAL_CARDS.map(c => c.key), 'کارت');

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
    $('#notif-days-save', el)?.addEventListener('click', async () => {      const days = Math.max(1, Math.floor(Number(UI.toLatinDigits($('#notif-days', el).value)) || 1));
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

    /* — ناوەڕۆکی پرێنتکردن: پێشبینینی شێوەی پرێنت (تەنها بەڕێوەبەر) — */
    el.querySelectorAll('.pp-eye').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('on');
        btn.closest('.pp-el')?.classList.toggle('pp-off', !btn.classList.contains('on'));
      });
    });

    el.querySelectorAll('[data-pr-text]').forEach(node => {
      node.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
      node.addEventListener('paste', e => {
        e.preventDefault();
        const t = (e.clipboardData || window.clipboardData).getData('text') || '';
        document.execCommand('insertText', false, t.replace(/\s+/g, ' '));
      });
    });

    $('#pr-save', el)?.addEventListener('click', () => {
      const txt = key => (el.querySelector(`[data-pr-text="${key}"]`)?.textContent || '').replace(/\s+/g, ' ').trim();
      const on = key => el.querySelector(`[data-pr-toggle="${key}"]`)?.classList.contains('on') ?? true;
      Store.saveSettings({
        printTitle: txt('printTitle'),
        printSub: txt('printSub'),
        printFooterRight: txt('printFooterRight'),
        printFooterLeft: txt('printFooterLeft'),
        printShowTitle: on('printShowTitle'),
        printShowSub: on('printShowSub'),
        printShowMeta: on('printShowMeta'),
        printShowFooter: on('printShowFooter'),
        printShowPrintNote: on('printShowPrintNote'),
      });
      UI.toast('ڕێکخستنی پرێنتکردن پاشەکەوت کرا ✓', 'success');
    });

    $('#pr-reset', el)?.addEventListener('click', () => {
      Store.saveSettings({ ...Store.PRINT_DEFAULTS });
      render(container);
      UI.toast('ناوەڕۆکی پرێنتکردن گەڕایەوە بۆ بنەڕەت ✓', 'info');
    });

    /* — فۆنت و قەبارەی نووسین (بەپێی دەسەڵاتەکان — لە فۆڕمی پیشە بۆ هەر پیشە/یوسەرێک چالاک دەکرێت) — */
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

    /* — باک ئەپ (پاشەکەوتکردنی خۆکار) — */
    $('#backup-choose-dir', el)?.addEventListener('click', async () => {
      if (!isDirPickerAvailable()) {
        UI.toast('ئەم وێبگەڕە پشتگیری هەڵبژاردنی فۆڵدەر ناکات — تکایە بە Chrome یان Edge بیکەرەوە (لەسەر ویندۆز)', 'warning', 6000);
        return;
      }
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        await backupIdbSet(handle);
        Store.saveSettings({ backupDirName: handle.name });
        const disp = $('#backup-dir-display', el);
        if (disp) disp.innerHTML = '<span style="color:var(--accent)">📁 ' + UI.esc(handle.name) + '</span>';
        const runBtn = $('#backup-run-now', el);
        if (runBtn) runBtn.disabled = false;
        UI.toast(`شوێنی باک ئەپ هەڵبژێردرا: ${handle.name} ✓`, 'success');
        if (Store.getSettings().backupEnabled) initAutoBackup();
      } catch (err) {
        if (err && err.name === 'AbortError') return; // بەکارهێنەر هەڵوەشاندەوە
        UI.toast('هەڵە لە هەڵبژاردنی شوێن: ' + (err?.message || err), 'error', 5000);
      }
    });

    $('#backup-run-now', el)?.addEventListener('click', async () => {
      const btn = $('#backup-run-now', el);
      if (!isDirPickerAvailable()) {
        UI.toast('ئەم وێبگەڕە پشتگیری باک ئەپی ناوخۆیی ناکات — تکایە بە Chrome یان Edge بیکەرەوە', 'warning', 6000);
        return;
      }
      let handle = null;
      try { handle = await backupIdbGet(); } catch (_) {}
      if (!handle) { UI.toast('سەرەتا شوێنی باک ئەپ هەڵبژێرە', 'warning'); return; }
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const p = await handle.requestPermission({ mode: 'readwrite' });
        if (p !== 'granted') { UI.toast('مۆڵەتی نووسین بۆ فۆڵدەرەکە نەدرا', 'error', 5000); return; }
      }
      UI.btnLoading(btn, true, 'باک ئەپ دەکرێت...');
      try {
        const allRecords = (await API.Records.list({ select: 'record_date' })) || [];
        const days = [...new Set(allRecords.map(r => r.record_date).filter(Boolean))];
        if (!days.length) {
          UI.toast('هیچ داتایەک نییە بۆ باک ئەپ', 'info', 4500);
        } else {
          let totalCount = 0;
          for (const d of days) {
            const res = await writeDayBackup(handle, d);
            totalCount += res.count || 0;
          }
          UI.toast(`باک ئەپ بۆ هەموو ڕۆژەکان کرا: ${days.length} فایل، ${UI.fmtNum(totalCount)} تۆمار ✓`, 'success', 6000);
        }
      } catch (err) {
        UI.toast('هەڵە لە باک ئەپ: ' + (err?.message || err), 'error', 5000);
      } finally {
        UI.btnLoading(btn, false);
      }
    });

    $('#set-backup-enabled', el)?.addEventListener('change', async e => {
      Store.saveSettings({ backupEnabled: e.target.checked });
      UI.toast(e.target.checked ? 'باک ئەپی خۆکار چالاک کرا ✓' : 'باک ئەپی خۆکار ناچالاک کرا', 'info');
      if (e.target.checked) {
        initAutoBackup();
        try {
          let handle = null;
          try { handle = await backupIdbGet(); } catch (_) {}
          if (handle) {
            let perm = await handle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
              perm = await handle.requestPermission({ mode: 'readwrite' });
            }
            if (perm === 'granted') {
              const res = await writeDayBackup(handle, backupTargetDay());
              if (!res.skipped) UI.toast(`باک ئەپی ئەمڕۆ کرا: «${res.fileName}» ✓`, 'success', 4500);
            }
          }
        } catch (_) {}
      } else {
        stopAutoBackup();
      }
    });

    updateBackupStatusUI();
  }

  /* ---------------- گۆڕینی تێپەڕەوشە ---------------- */

  async function handlePasswordChange(e) {
    e.preventDefault();
    const cur = UI.toLatinDigits($('#p-current', container).value.trim());
    const nw = UI.toLatinDigits($('#p-new', container).value.trim());
    const cf = UI.toLatinDigits($('#p-confirm', container).value.trim());
    // خاوێنکردنەوەی خێرا — بۆ ئەوەی براوسەر پۆپئەپی پاشەکەوت/نوێکردنی پاسۆڕ پیشان نەدات
    ['#p-current', '#p-new', '#p-confirm'].forEach(sel => { const el = $(sel, container); if (el) el.value = ''; });

    if (!/^\d{4}$/.test(cur) || !/^\d{4}$/.test(nw)) { UI.toast('هەردوو تێپەڕەوشە دەبێت ٤ ژمارە بن', 'warning'); return; }
    if (nw !== cf) { UI.toast('دووبارەکردنەوەی تێپەڕەوشەی نوێ یەکسان نییە', 'error'); return; }

    const subBtn = $('#pass-form button[type="submit"]', container);
    UI.btnLoading(subBtn, true, 'نوێ دەکرێتەوە...');
    try {
      // مۆدی دەروازە — پشکنینی تێپەڕەوشەی ئێستا لە سێرڤەر دەکرێت
      if (CONFIG.GATEWAY_URL) {
        await API.changeOwnPin(cur, nw);
        UI.toast('تێپەڕەوشە بە سەرکەوتوویی گۆڕدرا ✓', 'success');
        $('#pass-form', container).reset();
        return;
      }

      const users = await API.Lists.users();
      const me = users.find(x => x.id === App.getUser().id);
      if (!me) { UI.toast('بەکارهێنەر نەدۆزرایەوە', 'error'); return; }
      if (String(me.password) !== cur) { UI.toast('تێپەڕەوشەی ئێستا هەڵەیە', 'error'); return; }

      await API.Lists.updateUser(me.id, { password: nw });
      UI.toast('تێپەڕەوشە بە سەرکەوتوویی گۆڕدرا ✓', 'success');
      $('#pass-form', container).reset();
    } catch (err) {
      UI.toast(err.code === 'WRONG_PIN' ? 'تێپەڕەوشەی ئێستا هەڵەیە' : ('هەڵە لە گۆڕینی تێپەڕەوشە: ' + err.message), 'error', 4200);
    } finally {
      UI.btnLoading(subBtn, false);
    }
  }

  /* ---------------- زانیاری پەیوەندی — ژمارە تەلەفۆن و شوێن ---------------- */

  async function handleContactSave(e) {
    e.preventDefault();
    const phone1 = $('#pf-phone1', container).value.trim();
    const phone2 = $('#pf-phone2', container).value.trim();
    const location = $('#pf-location', container).value.trim();

    const phoneOk = p => !p || /^[+\d][\d\s\-()]{5,19}$/.test(UI.toLatinDigits(p));
    if (!phoneOk(phone1) || !phoneOk(phone2)) {
      UI.toast('ژمارەی تەلەفۆن دروست نییە — تەنها ژمارە و (+) و بۆشایی ڕێپێدراوە', 'warning', 4500);
      return;
    }

    const btn = $('#contact-form button[type="submit"]', container);
    UI.btnLoading(btn, true, 'پاشەکەوت دەکرێت...');
    try {
      const updated = await API.Lists.updateUser(App.getUser().id, {
        phone_number_1: phone1 || null,
        phone_number_2: phone2 || null,
        location: location || null,
      });
      Store.updateSession({
        phone_number_1: updated?.phone_number_1 ?? (phone1 || null),
        phone_number_2: updated?.phone_number_2 ?? (phone2 || null),
        location: updated?.location ?? (location || null),
      });
      UI.toast('زانیاری پەیوەندی پاشەکەوت کرا ✓', 'success');
    } catch (err) {
      UI.toast('هەڵە لە پاشەکەوتکردنی زانیاری پەیوەندی: ' + err.message, 'error', 4200);
    } finally {
      UI.btnLoading(btn, false);
    }
  }

  /* ---------------- باک ئەپ (پاشەکەوتکردنی خۆکار) ----------------
   * شوێنی هەڵبژێردراو (FileSystemDirectoryHandle) لە IndexedDB هەڵدەگیرێت —
   * چونکە localStorage هاندەرەکان ناقڵ دەکات. تەنها لە Chrome/Edge (secure context) کار دەکات. */

  const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // هەر ٦ کاتژمێر
  const isDirPickerAvailable = () => typeof window.showDirectoryPicker === 'function';

  function backupIdbOpen() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open('dlv_backup_db', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('handles');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function backupIdbSet(handle) {
    const db = await backupIdbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'dir');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function backupIdbGet() {
    const db = await backupIdbOpen();
    return new Promise((res, rej) => {
      const rq = db.transaction('handles', 'readonly').objectStore('handles').get('dir');
      rq.onsuccess = () => res(rq.result || null);
      rq.onerror = () => rej(rq.error);
    });
  }

  /** ڕۆژی ئامانج: شەممە هەینی دەوام نییە — داتای پێنجشەممە باک ئەپ دەکرێت */
  function backupTargetDay() {
    // باک ئەپی خۆکار هەمیشە داتاکانی ئەمڕۆ دەگرێتەوە
    return UI.todayStr();
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtTs(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} • ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  async function buildBackupWorkbook(dayStr) {
    const records = (await API.Records.list({ 'record_date': `eq.${dayStr}` })) || [];
    const rows = [
      [`سیستەمی گەیاندن — باک ئەپی ڕۆژی ${dayStr}`],
      ['بەرواری باک ئەپ:', `${UI.todayStr()} ${UI.nowTime()}`, '', 'ژمارەی تۆمارەکان:', records.length],
      [],
      ['#', 'بەروار', 'شۆفێر', 'دابەشکار', 'مەندوب', 'زۆن', 'سەیارە', 'کێش (کگم)', 'پارچەکان', 'وەسڵ',
        'کاتی دەرچوون', 'کاتی ناو زۆن', 'کاتی دەرێی زۆن', 'کاتی گەشتنەوە', 'کاتی کارکردن', 'پارەی هێنراوە (د.ع)'],
    ];

    if (!records.length) {
      rows.push(['هیچ تۆمارێک نەدۆزرایەوە بۆ ئەم ڕۆژە.']);
    } else {
      let tWeight = 0, tPieces = 0, tReceipts = 0, tMoney = 0, tMinutes = 0;
      records.forEach((r, idx) => {
        tWeight += UI.cleanInt(r.cargo_weight);
        tPieces += UI.cleanInt(r.pieces_count);
        tReceipts += UI.cleanInt(r.receipt_number);
        tMoney += UI.cleanInt(r.collected_money);
        const mins = UI.recordDurationMinutes(r);
        tMinutes += mins === null ? 0 : mins;
        rows.push([
          idx + 1,
          r.record_date || '',
          r.driver || '',
          r.distributor || '',
          r.delegate || '',
          r.zone || '',
          r.vehicle || '',
          UI.cleanInt(r.cargo_weight),
          UI.cleanInt(r.pieces_count),
          UI.cleanInt(r.receipt_number),
          r.record_time || '',
          r.in_zone_time || '',
          r.out_zone_time || '',
          r.arrival_time || '',
          r.work_time || UI.calcDuration(r.record_time, r.arrival_time),
          UI.cleanInt(r.collected_money),
        ]);
      });
      rows.push([
        'کۆی گشتی', '', '', '', '', '', '',
        tWeight, tPieces, tReceipts, '', '', '', '', UI.fmtDuration(tMinutes) || '', tMoney,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!views'] = [{ RTL: true }];
    ws['!cols'] = [
      { wch: 6 }, { wch: 13 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 13 },
      { wch: 13 }, { wch: 11 }, { wch: 11 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 19 },
    ];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `باک ${dayStr}`.slice(0, 31));
    return { wb, count: records.length };
  }

  /** نووسینی فایلی باک ئەپی یەک ڕۆژ لە فۆڵدەرەکە — ناوی فایل = بەرواری ئەو ڕۆژە */
  async function writeDayBackup(handle, dayStr, { skipEmpty = false } = {}) {
    const day = dayStr || backupTargetDay();
    const { wb, count } = await buildBackupWorkbook(day);
    if (skipEmpty && !count) return { fileName: null, day, count: 0, skipped: true };
    if (typeof XLSX === 'undefined') throw new Error('کتابخانەی ئێکسڵ بار نەبووە');

    const fileName = `باک_ئەپ_${day}.xlsx`;
    const fh = await handle.getFileHandle(fileName, { create: true });
    const writable = await fh.createWritable();
    await writable.write(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    await writable.close();

    Store.saveSettings({ backupLastAt: Date.now(), backupLastDay: day, backupLastCount: count });
    updateBackupStatusUI();
    return { fileName, day, count, skipped: false };
  }

  function updateBackupStatusUI() {
    const info = document.getElementById('backup-last-info');
    if (!info) return;
    const s = Store.getSettings();
    if (s.backupLastAt) {
      info.innerHTML = `<span style="color:var(--accent)">✓ دوایین باک ئەپ: ${UI.esc(fmtTs(s.backupLastAt))}</span><br>` +
        `<span style="color:var(--muted)">ڕۆژی ${UI.esc(s.backupLastDay || '—')} — ${UI.fmtNum(s.backupLastCount || 0)} تۆمار نوێکرانەوە</span>`;
    } else {
      info.textContent = 'باری باک ئەپ: هێشتا هیچ باک ئەپێک نەکراوە';
    }
  }

  async function runBackupOnce(reason) {
    const u = App.getUser();
    if (!u || !Perms.canView(u, 'set_backup')) { stopAutoBackup(); return; }
    const s = Store.getSettings();
    if (!s.backupEnabled || !isDirPickerAvailable()) return;
    let handle = null;
    try { handle = await backupIdbGet(); } catch (_) { return; }
    if (!handle) return;

    // مۆڵەت بە بێ دەستێوەردانی بەکارهێنەر تەنها ئەگەر پێشتر درابێت —
    // لە دۆخی خۆکاردا نابێت window-ی پرمیشن بکرێتەوە
    let perm = 'granted';
    try { perm = await handle.queryPermission({ mode: 'readwrite' }); } catch (_) { return; }
    if (perm !== 'granted') return;

    const day = backupTargetDay();
    try {
      // باک ئەپی خۆکار — هەمیشە داتاکانی ئەمڕۆ
      await writeDayBackup(handle, day);
    } catch (err) {
      console.warn('هەڵە لە باک ئەپی خۆکار:', err);
    }
  }

  let backupTimer = null;
  function stopAutoBackup() {
    if (backupTimer) { clearInterval(backupTimer); backupTimer = null; }
  }

  /** لە app.js بانگ دەکرێت دوای چوونەژوورەوەی بەڕێوەبەر */
  function initAutoBackup() {
    stopAutoBackup();
    runBackupOnce('auto');
    backupTimer = setInterval(() => runBackupOnce('auto'), BACKUP_INTERVAL_MS);
  }

  return { render, stop: () => {}, initAutoBackup };
})();
