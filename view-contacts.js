/* =========================================================
 *  پەیوەندییەکان — لیستی هەموو یوسەرەکان بەسۆرتی پیشە
 *  لەگەڵ وێنەی پڕۆفایل، ناو و ژمارە تەلەفۆنەکان
 * ========================================================= */

const ContactsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  const state = { search: '', users: [] };

  // ڕیزی پیشەکان: سایەق ← دابەشکار ← یاریدەدەر ← مەندوب ← بەڕێوەبەر
  const GROUP_ORDER = [
    CONFIG.PROFESSION_DRIVER,
    CONFIG.PROFESSION_DISTRIBUTOR,
    CONFIG.PROFESSION_ASSISTANT,
    CONFIG.PROFESSION_DELEGATE,
    CONFIG.PROFESSION_SUPERVISOR,
    'بەڕێوبەر',
    'بەریوبەر',
  ];
  const groupRank = p => {
    const i = GROUP_ORDER.indexOf(p);
    return i === -1 ? 99 : i;
  };

  function userPhones(u) {
    return [u.phone_number_1, u.phone_number_2].map(p => String(p || '').trim()).filter(Boolean);
  }

  function matches(u, q) {
    if (!q) return true;
    return [u.username, u.profession, u.location, u.phone_number_1, u.phone_number_2]
      .some(v => UI.norm(v).includes(q));
  }

  function render(el) {
    container = el;
    el.innerHTML = `
      <div class="settings-view">
        <section class="card filter-card">
          <div class="admin-header-row" style="margin-bottom:6px">
            <h3 style="font-size:0.96rem"><span class="sec-icon">${UI.icon('phone')}</span> پەیوەندییەکان</h3>
            <button type="button" class="btn btn-ghost btn-sm" id="ct-refresh" title="نوێکردنەوەی لیست">⟲ نوێکردنەوە</button>
          </div>
          <div class="field" style="margin-bottom:0">
            <input type="search" id="ct-search" placeholder="گەڕان بۆ ناو، پیشە، شوێن یان ژمارەی تەلەفۆن..." autocomplete="off" value="${UI.esc(state.search)}">
          </div>
        </section>
        <div id="ct-groups" class="ct-groups"><div class="empty-state"><p>بارکردن...</p></div></div>
      </div>`;

    $('#ct-search', el).addEventListener('input', e => {
      state.search = e.target.value;
      renderGroups();
    });
    $('#ct-refresh', el).addEventListener('click', async btn => {
      const b = $('#ct-refresh', el);
      UI.btnLoading(b, true, '...');
      try {
        await Store.loadLists(true);
        renderGroups();
        UI.toast('لیستەکە نوێکرایەوە ✓', 'success');
      } catch (err) {
        UI.toast('هەڵە لە نوێکردنەوەی لیست: ' + err.message, 'error', 4200);
      } finally {
        UI.btnLoading(b, false);
      }
    });

    renderGroups();
  }

  function renderGroups() {
    const wrap = $('#ct-groups', container);
    if (!wrap) return;

    Store.loadLists()
      .then(ls => {
        state.users = ls.users || [];
        const q = UI.norm(state.search);
        const users = state.users.filter(u => matches(u, q));

        if (!users.length) {
          wrap.innerHTML = `
            <div class="empty-state">
              <div class="empty-ico">📵</div>
              <p>${q ? 'هیچ یوسەرێک نەدۆزرایەوە بۆ ئەم گەڕانە.' : 'هیچ یوسەرێک تۆمار نەکراوە.'}</p>
            </div>`;
          return;
        }

        // گرووپکردن بەپێی پیشە بە ڕیزی GROUP_ORDER
        const groups = [];
        users.forEach(u => {
          const p = u.profession || 'تر';
          const last = groups[groups.length - 1];
          if (last && last.prof === p) last.list.push(u);
          else groups.push({ prof: p, list: [u] });
        });
        groups.sort((a, b) => groupRank(a.prof) - groupRank(b.prof));

        wrap.innerHTML = groups.map(g => `
          <section class="ct-group">
            <div class="ct-group-head">
              <h4>${UI.esc(g.prof)}</h4>
              <span class="ct-group-count">${UI.fmtNum(g.list.length)}</span>
            </div>
            <div class="ct-group-list">
              ${g.list.map(userRowHtml).join('')}
            </div>
          </section>`).join('');

        bindRows(wrap);
      })
      .catch(err => {
        wrap.innerHTML = `
          <div class="empty-state">
            <div class="empty-ico">⚠️</div>
            <p>هەڵە لە هێنانی لیستی یوسەران: ${UI.esc(err.message)}</p>
          </div>`;
      });
  }

  function userRowHtml(u) {
    const phones = userPhones(u);
    return `
      <div class="ct-row" data-uid="${UI.esc(String(u.id))}">
        ${UI.avatarHtml(u, 56)}
        <div class="ct-info">
          <strong class="ct-name">${UI.esc(u.username)}</strong>
          <span class="chip ct-prof">${UI.esc(u.profession || '—')}</span>
          ${u.location ? `<span class="ct-loc">📍 ${UI.esc(u.location)}</span>` : ''}
        </div>
        <div class="ct-phones">
          ${phones.length
            ? phones.map(p => UI.phoneChipHtml(p)).join('')
            : '<span class="ct-nophone">بێ ژمارە</span>'}
        </div>
      </div>`;
  }

  function bindRows(wrap) {
    wrap.querySelectorAll('.ct-row').forEach(row => {
      row.addEventListener('click', e => {
        // ژمارە و ئاڤاتار — هاندەرەکانی خۆیان هەیە
        if (e.target.closest('.phone-chip') || e.target.closest('.avatar')) return;
        const u = state.users.find(x => String(x.id) === row.dataset.uid);
        if (u) UI.openUserProfile(u);
      });
    });
    wrap.querySelectorAll('.phone-chip[data-phone]').forEach(btn => {
      btn.addEventListener('click', () => UI.openPhoneOptions(btn.dataset.phone));
    });
  }

  return { render, stop: () => {} };
})();
