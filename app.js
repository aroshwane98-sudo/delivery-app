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
  };

  function defineTabs() {
    TABS.length = 0;
    if (currentUser?.profession === CONFIG.PROFESSION_DRIVER || currentUser?.profession === CONFIG.PROFESSION_DISTRIBUTOR) {
      TABS.push({
        id: 'driver', label: 'کارەکان', icon: ICONS.truck, roles: [CONFIG.PROFESSION_DRIVER, CONFIG.PROFESSION_DISTRIBUTOR],
        render: el => DriverView.render(el),
        onDeactivate: () => DriverView.stop(),
      });
    }
    TABS.push({
      id: 'reports', label: 'ڕاپۆرت', icon: ICONS.chart, roles: 'ALL',
      render: el => ReportsView.render(el),
      onDeactivate: () => ReportsView.stop(),
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
  }

  function visibleTabs() {
    return TABS.filter(t => t.roles === 'ALL' || (Array.isArray(t.roles) && t.roles.includes(currentUser?.profession)));
  }

  /* ---------------- تابەکان ---------------- */

  function switchTab(id) {
    const tab = visibleTabs().find(t => t.id === id);
    if (!tab) return;
    if (currentTab && currentTab.onDeactivate) currentTab.onDeactivate();
    currentTab = tab;

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
    nav.innerHTML = visibleTabs().map(t => `
      <button class="nav-btn" data-tab="${t.id}" role="tab">
        <span class="nav-ico">${t.icon}</span>
        <span class="nav-label">${UI.esc(t.label)}</span>
      </button>`).join('');
    nav.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  /* ---------------- سەرپەڕ ---------------- */

  function renderHeader() {
    const roleClass = { [CONFIG.PROFESSION_DRIVER]: 'chip-driver', [CONFIG.PROFESSION_DISTRIBUTOR]: 'chip-dist', [CONFIG.PROFESSION_DELEGATE]: 'chip-del', [CONFIG.PROFESSION_SUPERVISOR]: 'chip-sup' };
    $('#topbar-user').innerHTML = `
      ${UI.avatarHtml(currentUser, 42)}
      <div class="topbar-meta">
        <strong>${UI.esc(currentUser.username)}</strong>
        <span class="chip ${roleClass[currentUser.profession] || ''}">${UI.esc(currentUser.profession || '—')}</span>
      </div>`;
    $('#theme-toggle-ico').textContent = Store.getSettings().theme === 'dark' ? '☀' : '☾';
  }

  /* ---------------- لۆگین / دەرچوون ---------------- */

  async function handleLogin(e) {
    e.preventDefault();
    const btn = $('#login-btn');
    const username = $('#login-username').value.trim();
    const password = UI.toLatinDigits($('#login-password').value.trim());
    const remember = $('#login-remember').checked;

    if (!username) { UI.toast('تکایە بەکارهێنەرێک هەڵبژێرە', 'warning'); return; }
    if (!/^\d{4}$/.test(password)) { UI.toast('تێپەڕەوشە دەبێت ٤ ژمارە بێت', 'warning'); return; }

    UI.btnLoading(btn, true, 'چاوەڕوان بە...');
    try {
      const { users } = await Store.loadLists();
      const user = (users || []).find(u => String(u.username).trim() === username);
      if (!user) { UI.toast('ئەم بەکارهێنەرە نییە لە سیستەمدا', 'error'); return; }
      if (String(user.password) !== password) { UI.toast('تێپەڕەوشە هەڵەیە', 'error'); return; }

      Store.setSession(
        { id: user.id, username: user.username, profession: user.profession, avatar_url: user.avatar_url },
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
    ['driver', 'reports', 'admin', 'settings'].forEach(id => {
      try {
        const t = TABS.find(x => x.id === id);
        if (t && t.onDeactivate) t.onDeactivate();
      } catch (e) {
        console.warn('Deactivate error:', id, e);
      }
    });
    Store.clearSession();
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
        // گروپکردن بەپێی پیشە
        const groups = {};
        (users || []).forEach(u => {
          const p = u.profession || 'تر';
          (groups[p] = groups[p] || []).push(u);
        });

        const order = [CONFIG.PROFESSION_DRIVER, CONFIG.PROFESSION_DISTRIBUTOR, CONFIG.PROFESSION_DELEGATE, CONFIG.PROFESSION_SUPERVISOR];
        order.concat(Object.keys(groups).filter(g => !order.includes(g))).forEach(prof => {
          const list = groups[prof];
          if (!list) return;
          const og = document.createElement('optgroup');
          og.label = prof;
          list.sort((a, b) => a.username.localeCompare(b.username, 'ckb'));
          list.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.username;
            opt.textContent = u.username;
            og.appendChild(opt);
          });
          sel.appendChild(og);
        });
      })
      .catch(() => UI.toast('نەتوانرا لیستی بەکارهێنەران بهێنرێت — پەیوەندی بە ڕایەڵەوە پشکنین بکە', 'error', 5000));
  }

  function enterApp() {
    currentUser = Store.getSession();
    if (!currentUser) { showLogin(); return; }

    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    document.body.classList.toggle('role-supervisor', isSupervisor(currentUser));
    renderHeader();
    defineTabs();
    renderNav();
    const first = visibleTabs()[0];
    switchTab(first.id);

    // نوێکردنەوەی زانیاری بەکارهێنەر لە پاشبنەما (ئاڤاتار و هتد)
    Store.loadLists().then(({ users }) => {
      const fresh = (users || []).find(u => u.id === currentUser.id);
      if (fresh) {
        Store.updateSession({ username: fresh.username, profession: fresh.profession, avatar_url: fresh.avatar_url });
        currentUser = Store.getSession();
        renderHeader();
        const t = currentTab;
        if (t && t.id === 'settings') switchTab('settings');
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

    $('#login-form').addEventListener('submit', handleLogin);
    $('#login-password').addEventListener('input', e => {
      e.target.value = UI.toLatinDigits(e.target.value).replace(/\D/g, '').slice(0, 4);
    });
    $('#theme-toggle').addEventListener('click', () => {
      const s = Store.getSettings();
      Store.saveSettings({ theme: s.theme === 'dark' ? 'light' : 'dark' });
      $('#theme-toggle-ico').textContent = s.theme === 'dark' ? '☾' : '☀';
    });
    $('#logout-btn').addEventListener('click', logout);

    if (Store.getSession()) enterApp(); else showLogin();

    // PWA — تەنها لەسەر http/https کار دەکات
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  return { switchTab, getUser: () => currentUser, renderHeader, logout };
})();
