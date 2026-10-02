/* =========================================================
 *  دەستپێکی سیستەم — لۆگین، ڕاوتەر، سەرپەڕ
 * ========================================================= */

const App = (() => {
  const $ = sel => document.querySelector(sel);

  let currentUser = null;
  let currentTab = null;
  const TABS = []; // {id, label, icon, render, roles}

  const isSupervisor = u => u && (u.profession === CONFIG.PROFESSION_SUPERVISOR || u.profession === 'بەڕێوبەر' || u.profession === 'بەریوبەر');

  /* ---------------- ئایکۆنەکانی تاب ---------------- */

  const ICONS = {
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h13v13H1z"/><path d="M14 8h4.6l2.4 3.2V16H14z"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3v18h18"/><path d="m7 13 3-4 4 3 5-7"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1 2.83-2.83l.06-.06a1.65 1.65 0  0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    badge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M15 8h4"/><path d="M15 12h4"/><path d="M6 18c.6-1.8 1.8-2.6 3-2.6s2.4.8 3 2.6"/></svg>',
  };

  function defineTabs() {
    TABS.length = 0;
    // تابی کارەکان هەمیشە دروست دەکرێت — بینینی بە دەسەڵاتەکان دیاری دەکرێت
    // (بنەڕەت: سایەق، دابەشکار و یاریدەدەر؛ دەکرێت بۆ پیشەی تر چالاک بکرێت لە فۆڕمی پیشە)
    TABS.push({
      id: 'driver', label: 'کارەکان', icon: ICONS.truck, roles: 'ALL',
      render: el => DriverView.render(el),
      onDeactivate: () => DriverView.stop(),
    });
    TABS.push({
      id: 'reports', label: 'ڕاپۆرت', icon: ICONS.chart, roles: 'ALL',
      render: el => ReportsView.render(el),
      onDeactivate: () => ReportsView.stop(),
    });
    TABS.push({
      id: 'contacts', label: 'پەیوەندی', icon: ICONS.phone, roles: 'ALL',
      render: el => ContactsView.render(el),
      onDeactivate: () => ContactsView.stop && ContactsView.stop(),
    });
    if (isSupervisor(currentUser)) {
      TABS.push({
        id: 'admin', label: 'بەڕێوەبردن', icon: ICONS.shield, roles: 'ALL',
        render: el => AdminView.render(el),
        onDeactivate: () => AdminView.stop(),
      });
    }
    TABS.push({
      id: 'settings', label: 'ڕێکخستن', icon: ICONS.gear, roles: 'ALL',
      render: el => SettingsView.render(el),
      onDeactivate: () => SettingsView.stop(),
    });
    if (isSupervisor(currentUser)) {
      TABS.push({
        id: 'professions', label: 'پیشە', icon: ICONS.badge, roles: 'ALL',
        // لە دیسکتۆپ لە باڕی خوارەوەیە — لە مۆبایل لە پانێلی بەڕێوەبردنەوە دەکرێتەوە (تەنیشت زۆنەکان)
        desktopOnly: true,
        render: el => ProfessionsView.render(el),
        onDeactivate: () => ProfessionsView.stop && ProfessionsView.stop(),
      });
    }
  }

  function visibleTabs() {
    // بینینی تابەکان بەپێی دەسەڵاتەکان — بەڕێوەبەر هەمیشە هەموو شتێک دەبینێت (Perms خۆی bypass دەکات)
    const u = currentUser;
    const keyById = { driver: 'tab_driver', reports: 'tab_reports', contacts: 'tab_contacts', admin: 'tab_admin', settings: 'tab_settings' };
    return TABS.filter(t => {
      if (t.id === 'professions') return isSupervisor(u);
      const k = keyById[t.id];
      return k ? Perms.canView(u, k) : true;
    });
  }

  /* ---------------- تابەکان ---------------- */

  // ڕیزبەندی پاشەکەوتکراوی تابەکان بۆ بەکارهێنەری ئێستا جێبەجێ دەکرێت
  function orderedTabs() {
    const tabs = visibleTabs();
    const st = Store.getTabState(currentUser?.id);
    const order = Array.isArray(st.order) ? st.order : null;
    if (!order || !order.length) return tabs;
    const byId = new Map(tabs.map(t => [t.id, t]));
    const out = order.map(id => byId.get(id)).filter(Boolean);
    tabs.forEach(t => { if (!out.includes(t)) out.push(t); }); // تابە نوێیەکان لە کۆتایی دادەنرێن
    return out;
  }

  function switchTab(id) {
    const tab = visibleTabs().find(t => t.id === id);
    if (!tab) return;
    if (currentTab && currentTab.onDeactivate) currentTab.onDeactivate();
    currentTab = tab;
    if (currentUser) Store.saveTabState(currentUser.id, { last: id });

    const page = $('#page');
    page.className = 'page' + (id === 'admin' ? ' page-admin' : '');
    page.innerHTML = '';
    tab.render(page);

    document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === id);
    });
    window.scrollTo({ top: 0 });
  }

  function renderNav() {
    const nav = $('#bottom-nav');
    nav.innerHTML = orderedTabs().map(t => `
      <button class="nav-btn ${t.desktopOnly ? 'nav-desktop-only' : ''}" data-tab="${t.id}" role="tab">
        <span class="nav-ico">${t.icon}</span>
        <span class="nav-label">${UI.esc(t.label)}</span>
      </button>`).join('');
    nav.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (navDrag.suppressClick) { navDrag.suppressClick = false; return; }
        switchTab(btn.dataset.tab);
      });
      attachNavDrag(btn, nav);
    });
  }

  /* — گۆڕینی شوێنی تابەکان بە دەست لەسەر ڕاگرتن و ڕاکێشان — */

  const navDrag = { ctx: null, suppressClick: false };

  function attachNavDrag(btn, nav) {
    btn.addEventListener('pointerdown', e => startNavPress(e, btn, nav));
    btn.addEventListener('contextmenu', e => { if (navDrag.ctx) e.preventDefault(); });
  }

  function startNavPress(e, btn, nav) {
    if (e.button && e.button !== 0) return; // تەنها کلیکی چەپ
    if (navDrag.ctx) return;
    const btns = [...nav.querySelectorAll('.nav-btn')];
    if (btns.length < 2) return;
    const ctx = {
      btn, nav, id: btn.dataset.tab,
      order: btns.map(b => b.dataset.tab),
      rects: new Map(btns.map(b => {
        const r = b.getBoundingClientRect();
        return [b.dataset.tab, { left: r.left, center: r.left + r.width / 2 }];
      })),
      startX: e.clientX, startY: e.clientY,
      timer: setTimeout(() => enterNavDrag(ctx), 380),
      active: false, targetIdx: 0,
    };
    navDrag.ctx = ctx;
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    btn.addEventListener('pointermove', onNavMove);
    btn.addEventListener('pointerup', endNavPress);
    btn.addEventListener('pointercancel', cancelNavDrag);
  }

  function enterNavDrag(ctx) {
    ctx.active = true;
    ctx.targetIdx = ctx.order.indexOf(ctx.id);
    ctx.btn.classList.add('dragging');
    try { navigator.vibrate && navigator.vibrate(30); } catch (_) {}
  }

  function onNavMove(e) {
    const ctx = navDrag.ctx;
    if (!ctx) return;
    const dx = e.clientX - ctx.startX;
    const dy = e.clientY - ctx.startY;
    if (!ctx.active) {
      if (Math.hypot(dx, dy) > 12) cancelNavDrag(); // جوڵەی زوو — سکرۆڵ یان کلیکی ئاساییە
      return;
    }
    const r = ctx.rects.get(ctx.id);
    const dragCenter = r.center + dx;
    ctx.btn.style.transform = `translateX(${dx}px) scale(1.12)`;
    // لە RTL مەرەکەبی DOM پێچەوانەی تەوەری xـە — لە ڕاستەوە دەست پێدەکات
    const rtlFirst = ctx.rects.get(ctx.order[0]).center > ctx.rects.get(ctx.order[ctx.order.length - 1]).center;
    const others = ctx.order.filter(id => id !== ctx.id);
    let idx = 0;
    others.forEach(id => {
      const c = ctx.rects.get(id).center;
      if (rtlFirst ? c > dragCenter : c < dragCenter) idx++;
    });
    ctx.targetIdx = idx;
    // هاوسێکان بە نەرمی بۆ لای خۆیان شێفت دەبن
    others.forEach((id, i) => {
      const b = ctx.nav.querySelector(`.nav-btn[data-tab="${id}"]`);
      if (!b) return;
      const slot = i < idx ? i : i + 1;
      const shift = ctx.rects.get(ctx.order[slot]).left - ctx.rects.get(id).left;
      b.style.transform = shift ? `translateX(${shift}px)` : '';
    });
  }

  function endNavPress() {
    const ctx = navDrag.ctx;
    if (!ctx) return;
    const wasActive = ctx.active;
    const others = ctx.order.filter(id => id !== ctx.id);
    const idx = Math.max(0, Math.min(ctx.targetIdx, others.length));
    const newOrder = [...others.slice(0, idx), ctx.id, ...others.slice(idx)];
    const changed = wasActive && newOrder.join('|') !== ctx.order.join('|');
    cleanupNavDrag(ctx);
    if (wasActive) {
      // دوای ڕاکێشان کلیکەکە پشتگوێ بخرێت — ئەمە ڕاکێشان بوو نەک گۆڕینی تاب
      navDrag.suppressClick = true;
      setTimeout(() => { navDrag.suppressClick = false; }, 0);
    }
    if (changed && currentUser) {
      Store.saveTabState(currentUser.id, { order: newOrder });
      renderNav();
      document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === currentTab?.id);
      });
      UI.toast('ڕیزبەندی تابەکان پاشەکەوت کرا ✓', 'success', 1800);
    }
  }

  function cancelNavDrag() {
    const ctx = navDrag.ctx;
    if (ctx) cleanupNavDrag(ctx);
  }

  function cleanupNavDrag(ctx) {
    clearTimeout(ctx.timer);
    ctx.btn.removeEventListener('pointermove', onNavMove);
    ctx.btn.removeEventListener('pointerup', endNavPress);
    ctx.btn.removeEventListener('pointercancel', cancelNavDrag);
    ctx.btn.classList.remove('dragging');
    ctx.nav.querySelectorAll('.nav-btn').forEach(b => { b.style.transform = ''; });
    navDrag.ctx = null;
  }

  /* ---------------- سەرپەڕ ---------------- */

  function renderHeader() {
    stopNotifPolling();
    const roleClass = { [CONFIG.PROFESSION_DRIVER]: 'chip-driver', [CONFIG.PROFESSION_DISTRIBUTOR]: 'chip-dist', [CONFIG.PROFESSION_DELEGATE]: 'chip-del', [CONFIG.PROFESSION_SUPERVISOR]: 'chip-sup', [CONFIG.PROFESSION_ASSISTANT]: 'chip-driver' };
    $('#topbar-user').innerHTML = `
      ${UI.avatarHtml(currentUser, 42)}
      <div class="topbar-meta">
        <strong>${UI.esc(currentUser.username)}</strong>
        <span class="chip ${roleClass[currentUser.profession] || ''}">${UI.esc(currentUser.profession || '—')}</span>
      </div>`;
    const dateEl = $('#topbar-date');
    if (dateEl) {
      const showNotifications = Perms.canView(currentUser, 'notif_bell');
      dateEl.innerHTML = `
        <span class="tb-date">${UI.esc(UI.todayStr())}</span>
        <span class="tb-weekday">${UI.esc(UI.weekdayKu())}</span>
        ${showNotifications ? `
          <div class="notif-bell-wrap">
            <button class="btn btn-ghost btn-sm" id="topbar-notif-btn" type="button" title="نۆتیفیکەیشنەکان">🔔</button>
            <span class="notif-badge" id="topbar-notif-badge" style="display:none"></span>
          </div>` : ''}`;
      if (showNotifications) {
        $('#topbar-notif-btn').addEventListener('click', () => UI.openNotificationsPanel());
        startNotifPolling();
      }
    }
  }

  /* ---------------- نۆتیفیکەیشن — باجی زەنگی سەرپەڕ ---------------- */

  let notifTimer = null;

  function updateTopbarNotifBadge() {
    if (!Perms.canView(currentUser, 'notif_bell')) return;
    UI.refreshNotifBadge($('#topbar-notif-badge')).catch(() => {});
  }

  function startNotifPolling() {
    if (notifTimer) clearInterval(notifTimer);
    updateTopbarNotifBadge();
    notifTimer = setInterval(() => {
      if (currentUser) updateTopbarNotifBadge();
    }, 45 * 1000);
  }

  function stopNotifPolling() {
    if (notifTimer) { clearInterval(notifTimer); notifTimer = null; }
  }

  document.addEventListener('dlv-notif-seen', updateTopbarNotifBadge);

  /* — گۆڕانی دەسەڵاتەکان لە ئامێرەکانی تر — ئاگادارکردنەوە لە Store — */
  let permsUiSig = null;

  document.addEventListener('dlv-perms-changed', () => {
    if (!currentUser) return;
    renderNav(); // بینینی تابەکان و ڕیزبەندییەکەیان لەوانەیە گۆڕابن
    const tabs = visibleTabs();
    if (currentTab && !tabs.find(t => t.id === currentTab.id)) {
      // تابی ئێستا ئیتر بۆ ئەم یوسەرە نییە — بگەڕێ بۆ یەکەم تابی بینراو
      switchTab(tabs[0].id);
    } else {
      document.querySelectorAll('.bottom-nav .nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === currentTab?.id);
      });
    }
    renderHeader(); // زەنگی نۆتیفیکەیشن لەوانەیە گۆڕابێت
    // ئەگەر دەسەڵاتەکانی خۆی یان کاتی دەستپێک گۆڕاون — ڤیوی ئێستا نوێ بکەرەوە
    const newSig = Perms.signatureFor(currentUser) + '|' + (Store.getBaseTime() || '');
    if (newSig !== permsUiSig && currentTab) switchTab(currentTab.id);
    permsUiSig = newSig;
  });

  /* ---------------- لۆگین / دەرچوون ---------------- */

  async function handleLogin(e) {
    e.preventDefault();
    const btn = $('#login-btn');
    const username = $('#login-username').value.trim();
    const password = UI.toLatinDigits($('#login-password').value.trim());
    const remember = $('#login-remember').checked;
    // خاوێنکردنەوەی خێرای خانەکە — بۆ ئەوەی براوسەر پاسۆڕکە تۆمار نەکات و پۆپئەپ پیشان نەدات
    $('#login-password').value = '';

    if (!username) { UI.toast('تکایە بەکارهێنەرێک هەڵبژێرە', 'warning'); return; }
    if (!/^\d{4}$/.test(password)) { UI.toast('تێپەڕەوشە دەبێت ٤ ژمارە بێت', 'warning'); return; }

    UI.btnLoading(btn, true, 'چاوەڕوان بە...');
    try {
      const { users } = await Store.loadLists();
      // هەڵبژاردن بە ئایدی usersv2 — نەک ناو، چونکە دوو بەکارهێنەر دەتوانن ناوی هاوشێوە هەبن
      const selectedId = String($('#login-username').value || '');
      const user = (users || []).find(u => String(u.id) === selectedId);
      if (!user) { UI.toast('ئەم بەکارهێنەرە نییە لە سیستەمدا', 'error'); return; }
      if (String(user.password) !== password) { UI.toast('تێپەڕەوشە هەڵەیە', 'error'); return; }

      Store.setSession(
        { id: user.id, username: user.username, profession: user.profession, avatar_url: user.avatar_url, phone_number_1: user.phone_number_1, phone_number_2: user.phone_number_2, location: user.location },
        remember
      );
      UI.toast(`بەخێربێیت ${user.username} 👋`, 'success');
      enterApp();
    } catch (err) {
      UI.toast('پەیوەندی بە ڕایەڵەوە نەکرا: ' + err.message, 'error', 4200);
    } finally {
      UI.btnLoading(btn, false);
    }
  }

  async function logout() {
    const ok = await UI.confirmDialog('دڵنیاییت لە دەرچوون لە هەژمار؟', { danger: true, okLabel: 'بەڵێ، دەربچم', cancelLabel: 'پاشگەزبوونەوە' });
    if (!ok) return;
    ['driver', 'reports', 'contacts', 'admin', 'settings', 'professions'].forEach(id => {
      try {
        const t = TABS.find(x => x.id === id);
        if (t && t.onDeactivate) t.onDeactivate();
      } catch (e) {
        console.warn('Deactivate error:', id, e);
      }
    });
    Store.clearSession();
    stopNotifPolling();
    Store.stopPermsPolling();
    if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => {
        reg.getNotifications({ tag: 'active-trip-lockscreen' }).then(ns => ns.forEach(n => n.close())).catch(() => {});
      }).catch(() => {});
    }
    document.body.classList.remove('role-supervisor');
    currentUser = null;
    currentTab = null;
    showLogin();
    const pw = $('#login-password');
    if (pw) pw.value = '';
    const un = $('#login-username');
    if (un) un.focus();
    UI.toast('بە سەرکەوتوویی لە هەژمار دەرباز بوویت', 'info');
  }

  /* ---------------- دەستپێک ---------------- */

  function initLoginSelect() {
    const sel = $('#login-username');
    Store.loadLists()
      .then(({ users }) => {
        // ژماردنی ناوە دووبارەکان — بۆ نیشاندانی جیاوازی لە لیستەکەدا
        const nameCounts = {};
        (users || []).forEach(u => {
          const k = UI.norm(u.username);
          nameCounts[k] = (nameCounts[k] || 0) + 1;
        });

        // گروپکردن بەپێی پیشە
        const groups = {};
        (users || []).forEach(u => {
          const p = u.profession || 'تر';
          (groups[p] = groups[p] || []).push(u);
        });

        const order = [CONFIG.PROFESSION_DRIVER, CONFIG.PROFESSION_DISTRIBUTOR, CONFIG.PROFESSION_ASSISTANT, CONFIG.PROFESSION_DELEGATE, CONFIG.PROFESSION_SUPERVISOR];
        order.concat(Object.keys(groups).filter(g => !order.includes(g))).forEach(prof => {
          const list = groups[prof];
          if (!list) return;
          const og = document.createElement('optgroup');
          og.label = prof;
          list.sort((a, b) => a.username.localeCompare(b.username, 'ckb'));
          list.forEach(u => {
            const opt = document.createElement('option');
            opt.value = String(u.id); // ئایدی یوسەر لە usersv2 — نەک ناو
            // ئەگەر دوو بەکارهێنەر ناوی هاوشێوە هەبن، ئایدیەکەیان لەگەڵ ناوەکە دەنووسرێت
            opt.textContent = nameCounts[UI.norm(u.username)] > 1
              ? `${u.username} (#${u.id})`
              : u.username;
            og.appendChild(opt);
          });
          sel.appendChild(og);
        });
      })
      .catch(() => UI.toast('نەتوانرا لیستی بەکارهێنەران بهێنرێت — پەیوەندی بە ڕایەڵەوە پشکنین بکە', 'error', 5000));
  }

  async function enterApp() {
    currentUser = Store.getSession();
    if (!currentUser) { showLogin(); return; }

    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    document.body.classList.toggle('role-supervisor', isSupervisor(currentUser));
    // لیستەکان و دەسەڵاتەکان پێش ڕێندەر — بۆ ئەوەی تابەکان بەپێی دەسەڵاتە ڕاستەکان دەربکەون
    try { await Store.loadLists(); } catch (_) { /* کاش/بنەڕەت بەکاردەهێنرێت */ }
    renderHeader();
    defineTabs();
    renderNav();
    // گەڕانەوە بۆ دواین شوێن — ڕیفرێش یان دەرچوون و گەڕانەوە: هەر لەو تابەی جێت هێشتبوو دەکرێتەوە
    // ئەگەر هیچ مێژوویەک نەبوو → یەکەم تابی ڕیزبەندیەکە (ئەوەی بۆ یەکەم هێنراوە) دەکرێتەوە
    const tabs = orderedTabs();
    const st = Store.getTabState(currentUser.id);
    const target = (st.last && tabs.find(t => t.id === st.last)) || tabs[0];
    switchTab(target.id);
    permsUiSig = Perms.signatureFor(currentUser) + '|' + (Store.getBaseTime() || '');
    // پشکنینی خۆکاری گۆڕانی دەسەڵاتەکان بۆ ئامێرەکانی تر
    Store.startPermsPolling();

    // باک ئەپی خۆکار — تەنها بۆ بەڕێوەبەر
    if (isSupervisor(currentUser)) SettingsView.initAutoBackup?.();

    // سڕینەوەی نۆتیفیکەیشنە کۆنەکان بەپێی ڕێکخستنی ڕۆژەکان (بێ ڕاوەستان)
    API.Notifications.removeOlderThanDays(Store.getSettings().notifDays)
      .catch(e => console.warn('هەڵە لە سڕینەوەی نۆتیفیکەیشنە کۆنەکان:', e));

    // نوێکردنەوەی زانیاری بەکارهێنەر لە پاشبنەما (ئاڤاتار و هتد)
    Store.loadLists().then(({ users }) => {
      const fresh = (users || []).find(u => u.id === currentUser.id);
      if (fresh) {
        Store.updateSession({ username: fresh.username, profession: fresh.profession, avatar_url: fresh.avatar_url, phone_number_1: fresh.phone_number_1, phone_number_2: fresh.phone_number_2, location: fresh.location });
        currentUser = Store.getSession();
        renderHeader();
        const t = currentTab;
        if (t && (t.id === 'settings' || t.id === 'contacts')) switchTab(t.id);
      }
    }).catch(() => {});
  }

  function showLogin() {
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    $('#login-foot').textContent = `${CONFIG.APP_NAME} • نسخە ${CONFIG.APP_VERSION}`;
  }

  function boot() {
    Store.applySettings();
    initLoginSelect();
    // خانەی تێپەڕەوشە بێ type="password" بکە (لە براوسەرانی پشتگیریکراو) — بۆ نەبوونی پۆپئەپی سەیڤکردنی پاسۆرد
    UI.maskSecretInputs(document);

    $('#login-form').addEventListener('submit', handleLogin);
    $('#login-password').addEventListener('input', e => {
      e.target.value = UI.toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4);
    });

    if (Store.getSession()) enterApp(); else showLogin();

    // PWA — تەنها لەسەر http/https کار دەکات
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  return { switchTab, getUser: () => currentUser, renderHeader, logout };
})();
