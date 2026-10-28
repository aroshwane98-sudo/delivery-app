/* =========================================================
 *  فۆڕمی ماڕکێتەکان — بەستراوە بە خشتەی public.market_locaetion
 *  ستوونە سەرەکییەکان: account_code (ناوازە), account_name, neighborhood, latitude, longitude, phone
 *  ڕووکار:
 *   - لە سەرەوە: گەڕانی خێرا بۆ کۆد (account_code) و ناو
 *   - لە ناوەڕاست: لیستی ناوی ماڕکێتەکان، کۆد و لۆکەیشن
 *   - لە خوارەوە: دوو دوگمەی سەرەکی (کامێرا 📸 و ماڕکێتی نوێ ➕)
 *   - کامێرا: گرتنی وێنە، دەرهێنانی کۆدەکان، دروستکردنی گرووپ و ناردن بۆ بەرنامەی ماپسمی (MAPS.ME)
 * ========================================================= */

const MarketsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  let container = null;
  const state = {
    search: '',
    neighborhoodFilter: '',
    onlyWithLocation: false,
    markets: [],
    neighborhoods: [],
    activeGroup: [], // گرووپی هەڵبژێردراو بۆ بەرنامەی ماپسمی (MAPS.ME)
    loading: false
  };

  /* ---------------- دەرهێنانی پۆوتان لە بەستەری Google Maps ---------------- */

  function parseCoordsFromUrl(url) {
    if (!url) return null;
    const str = String(url).trim();

    const qMatch = str.match(/[?&](?:q|query|ll)=([+-]?\d+\.?\d*)[, ]+([+-]?\d+\.?\d*)/i);
    if (qMatch) {
      const lat = parseFloat(qMatch[1]);
      const lon = parseFloat(qMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    const atMatch = str.match(/@([+-]?\d+\.?\d*)[, ]+([+-]?\d+\.?\d*)/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lon = parseFloat(atMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    const plainMatch = str.match(/^([+-]?\d+\.?\d*)[, ]+([+-]?\d+\.?\d*)$/);
    if (plainMatch) {
      const lat = parseFloat(plainMatch[1]);
      const lon = parseFloat(plainMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    return null;
  }

  /* ---------------- هێنانی داتاکان لە Supabase ---------------- */

  async function loadData(force = false) {
    state.loading = true;
    try {
      const rows = await Store.loadMarkets(force);
      state.markets = Array.isArray(rows) ? rows : [];

      // ڕیزبەندی ماڕکێتەکان بەپێی ژمارەی کۆد (Numeric Sort)
      state.markets.sort((a, b) => {
        const na = parseInt(UI.toLatinDigits(a.account_code), 10) || 0;
        const nb = parseInt(UI.toLatinDigits(b.account_code), 10) || 0;
        return na - nb;
      });

      // ڕیزبەندی گەڕەکەکان
      const mktNh = state.markets.map(m => (m.neighborhood || '').trim()).filter(Boolean);
      let listZones = [];
      try {
        const ls = await Store.loadLists();
        listZones = (ls.zones || []).map(z => typeof z === 'string' ? z : (z.zone || z.name || '')).filter(Boolean);
      } catch (_) {}

      state.neighborhoods = [...new Set([...mktNh, ...listZones])].sort((a, b) => a.localeCompare(b, 'ckb'));
    } catch (err) {
      console.error('هەڵە لە هێنانی ماڕکێتەکان:', err);
      state.markets = Store.getCachedMarkets() || [];
    } finally {
      state.loading = false;
    }
  }

  /* ---------------- فلتەرکردنی ماڕکێتەکان ---------------- */

  function filteredMarkets() {
    const rawSearch = (state.search || '').trim();
    const q = UI.norm(rawSearch);
    const qDigits = UI.toLatinDigits(rawSearch).replace(/\D/g, '');
    const nhf = state.neighborhoodFilter ? UI.norm(state.neighborhoodFilter) : '';

    return state.markets.filter(m => {
      const hasLoc = m.latitude !== null && m.latitude !== undefined &&
                     m.longitude !== null && m.longitude !== undefined;

      if (state.onlyWithLocation && !hasLoc) return false;
      if (nhf && UI.norm(m.neighborhood) !== nhf) return false;
      if (!rawSearch) return true;

      // ئەگەر گەڕانەکە ژمارە بێت، بەراوردی کۆدی ژمارەیی دەکات
      const codeDigits = UI.toLatinDigits(m.account_code || '').replace(/\D/g, '');
      if (qDigits && codeDigits.includes(qDigits)) return true;

      return [
        m.account_code,
        m.account_name,
        m.neighborhood,
        m.phone
      ].some(v => UI.norm(v).includes(q));
    });
  }

  /* ---------------- دروستکردنی فایلی KML بۆ بەرنامەی ماپسمی (MAPS.ME) ---------------- */

  function generateMapsMeKml(marketsList, title = 'گرووپی گەیاندن') {
    const valid = marketsList.filter(m => m.latitude !== null && m.latitude !== undefined &&
                                          m.longitude !== null && m.longitude !== undefined);

    const placemarks = valid.map((m, idx) => `
    <Placemark>
      <name>${idx + 1}. [${UI.esc(m.account_code)}] ${UI.esc(m.account_name || 'ماڕکێت')}</name>
      <description><![CDATA[کۆدی ئەکاونت: ${UI.esc(m.account_code)}<br>گەڕەک: ${UI.esc(m.neighborhood || '—')}<br>تەلەفۆن: ${UI.esc(m.phone || '—')}]]></description>
      <Point>
        <coordinates>${Number(m.longitude)},${Number(m.latitude)},0</coordinates>
      </Point>
    </Placemark>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${UI.esc(title)}</name>
    <visibility>1</visibility>
    <open>1</open>
    ${placemarks}
  </Document>
</kml>`;
  }

  /* ---------------- ناردن بۆ بەرنامەی ماپسمی ---------------- */

  async function sendGroupToMapsMe(marketsGroup) {
    const valid = (marketsGroup || []).filter(m => m.latitude !== null && m.latitude !== undefined &&
                                                  m.longitude !== null && m.longitude !== undefined);

    if (!valid.length) {
      UI.toast('هیچ کام لە ماڕکێتە هەڵبژێردراوەکان پۆوتانی GPS یان نییە بۆ ماپسمی', 'warning', 3500);
      return;
    }

    const title = `ماڕکێتەکان_${UI.todayStr()}`;
    const kmlText = generateMapsMeKml(valid, title);
    const blob = new Blob([kmlText], { type: 'application/vnd.google-earth.kml+xml' });
    const filename = `${title}.kml`;
    const file = new File([blob], filename, { type: 'application/vnd.google-earth.kml+xml' });

    let shared = false;
    // ١. بەکارهێنانی Web Share API لەسەر مۆبایل (ئەگەر پشتگیری بکرێت)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: 'گرووپی ماڕکێتەکان بۆ بەرنامەی ماپسمی (MAPS.ME)'
        });
        shared = true;
        UI.toast('فایلی ماڕکێتەکان بە سەرکەوتوویی بۆ بەرنامەی ماپسمی نێردرا ✓', 'success');
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Share error:', err);
      }
    }

    // ٢. دابەزاندنی فایلەکە (.kml) کە لە مۆبایل و کۆمپیوتەر ڕاستەوخۆ بە بەرنامەی MAPS.ME دەکرێتەوە
    if (!shared) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 1200);
      UI.toast('فایلی ماپسمی (.kml) دابەزێنرا — کلیک لەسەر فایلەکە بکە بۆ کردنەوەی لە MAPS.ME ✓', 'success', 4000);
    }
  }

  /* ---------------- ڕێندەری سەرەکی ---------------- */

  async function render(el) {
    container = el;
    await loadData();
    renderLayout();
  }

  function renderLayout() {
    if (!container) return;

    const list = filteredMarkets();
    const totalCount = state.markets.length;
    const withLocCount = state.markets.filter(m => m.latitude !== null && m.latitude !== undefined && m.longitude !== null && m.longitude !== undefined).length;
    const groupCount = state.activeGroup.length;

    container.innerHTML = `
      <div class="settings-view markets-view mkt-custom-page">

        <!-- ١. لەبەشی سەرەوە: گەڕان بۆ کۆد (account_code) و ناو -->
        <div class="card mkt-top-search-card">
          <div class="mkt-search-header-row">
            <div class="mkt-search-title">
              <span class="mkt-search-icon">${UI.icon('search', 20)}</span>
              <h3>گەڕان بۆ کۆدی ماڕکێت (account_code)</h3>
            </div>
            <div class="mkt-top-counts">
              <span class="chip">کۆی ماڕکێتەکان: <b>${UI.fmtNum(totalCount)}</b></span>
              <span class="chip chip-ok">خاوەن لۆکەیشن: <b>${UI.fmtNum(withLocCount)}</b></span>
            </div>
          </div>

          <div class="mkt-search-input-wrap">
            <span class="mkt-input-search-ico">${UI.icon('search', 18)}</span>
            <input type="search" id="mkt-code-search" class="mkt-code-search-input"
                   inputmode="numeric"
                   placeholder="کۆدی ژمارەیی ماڕکێت بنووسە... بۆ نموونە: 101، 102، 105"
                   autocomplete="off" value="${UI.esc(state.search)}" autofocus>
            ${state.search ? `<button type="button" class="mkt-clear-search-btn" id="mkt-clear-search" title="پاککردنەوە">✕</button>` : ''}
          </div>

          <div class="mkt-quick-filters">
            <div class="field" style="margin-bottom:0;flex:1;min-width:140px">
              <select id="mkt-nh-filter">
                <option value="">هەموو گەڕەکەکان (${state.neighborhoods.length})</option>
                ${state.neighborhoods.map(n => `<option value="${UI.esc(n)}" ${state.neighborhoodFilter === n ? 'selected' : ''}>${UI.esc(n)}</option>`).join('')}
              </select>
            </div>
            <label class="check-row" for="mkt-loc-only" style="margin-bottom:0">
              <input type="checkbox" id="mkt-loc-only" ${state.onlyWithLocation ? 'checked' : ''}>
              <span>تەنها خاوەن لۆکەیشن 📍</span>
            </label>
            <button type="button" class="btn btn-ghost btn-sm" id="mkt-refresh-btn" title="نوێکردنەوە لە Supabase">
              ⟲ نوێکردنەوە
            </button>
            <button type="button" class="btn btn-ghost btn-sm" id="mkt-export-btn" title="دەرهێنان بۆ ئێکسڵ">
              ${UI.icon('download', 14)} ئێکسڵ
            </button>
          </div>
        </div>

        <!-- باڕی ئاگاداری گرووپی ماپسمی (ئەگەر ماڕکێت لە گرووپدا هەبێت) -->
        ${groupCount > 0 ? `
          <div class="card mkt-group-banner">
            <div class="mkt-group-banner-info">
              <span class="mkt-group-banner-icon">${UI.icon('compass', 20)}</span>
              <div>
                <strong>گرووپی چالاکی ماپسمی (MAPS.ME):</strong>
                <span>${UI.fmtNum(groupCount)} ماڕکێت هەڵبژێردراوە</span>
              </div>
            </div>
            <div class="mkt-group-banner-actions">
              <button type="button" class="btn btn-sm btn-success" id="mkt-send-group-btn">
                🗺️ ناردن بۆ ماپسمی
              </button>
              <button type="button" class="btn btn-sm btn-ghost" id="mkt-open-cam-btn">
                📸 کامێرا
              </button>
              <button type="button" class="btn btn-sm btn-ghost text-danger" id="mkt-clear-group-btn" title="خاوێنکردنەوەی گرووپ">
                ✕
              </button>
            </div>
          </div>` : ''}

        <!-- ٢. لەخوارەوە: لیستی ناوی ماڕکێتەکان -->
        <div class="mkt-list-container" id="mkt-list-container">
          ${renderMarketsList(list)}
        </div>

        <!-- ٣. لەخوارەوە سەر باڕەکە: دوو دووگمە هەیە (کامێرا و ماڕکێتی نوێ) -->
        <div class="mkt-bottom-bar">
          <button type="button" class="mkt-bbar-btn mkt-cam-btn" id="mkt-bbar-camera">
            <span class="mkt-bbar-ico">${UI.icon('camera', 22)}</span>
            <span class="mkt-bbar-txt">کامێرا</span>
            ${groupCount > 0 ? `<span class="mkt-bbar-badge">${groupCount}</span>` : ''}
          </button>
          <button type="button" class="mkt-bbar-btn mkt-new-btn" id="mkt-bbar-new">
            <span class="mkt-bbar-ico">${UI.icon('plus', 22)}</span>
            <span class="mkt-bbar-txt">ماڕکێتی نوێ</span>
          </button>
        </div>

      </div>
    `;

    bindEvents();
  }

  /* ---------------- لیستی ماڕکێتەکان ---------------- */

  function renderMarketsList(list) {
    if (!list.length) {
      const hasFilters = !!(state.search || state.neighborhoodFilter || state.onlyWithLocation);
      return `
        <div class="card empty-state mkt-empty">
          <div class="empty-ico">🏪</div>
          <h3>${hasFilters ? 'هیچ ماڕکێتێک بەم کۆد یان ناوە نەدۆزرایەوە' : 'هیچ ماڕکێتێک لە سەب بەیس نییە'}</h3>
          <p class="muted">${hasFilters ? 'کۆدێکی تر بنووسە یان فلتەرەکان پاک بکەرەوە.' : 'دوگمەی «ماڕکێتی نوێ» لە خوارەوە داگرە بۆ زیادکردن.'}</p>
          ${!state.markets.length ? `
            <button type="button" class="btn btn-ghost" id="mkt-seed-sample-btn" style="margin-top:8px">
              📍 دانانی چەند ماڕکێتێکی نموونەیی لە سەب بەیس
            </button>` : ''}
        </div>`;
    }

    return `
      <div class="mkt-rows-list">
        ${list.map(m => renderMarketRow(m)).join('')}
      </div>`;
  }

  function renderMarketRow(m) {
    const hasCoords = m.latitude !== null && m.latitude !== undefined &&
                      m.longitude !== null && m.longitude !== undefined;

    const mapsUrl = hasCoords
      ? `https://www.google.com/maps?q=${m.latitude},${m.longitude}`
      : `https://maps.google.com/?q=${encodeURIComponent((m.account_name || '') + ' ' + (m.neighborhood || ''))}`;

    const isInGroup = state.activeGroup.some(x => String(x.account_code) === String(m.account_code));

    const phoneChip = m.phone
      ? UI.phoneChipHtml(m.phone)
      : '<span class="mkt-no-phone">بێ تەلەفۆن</span>';

    return `
      <article class="card mkt-row-item ${isInGroup ? 'in-group' : ''}" data-code="${UI.esc(m.account_code)}">
        <div class="mkt-row-main">

          <!-- کۆدی ماڕکێت (account_code) — بە گەورەیی و بەرچاوی -->
          <div class="mkt-code-box">
            <span class="mkt-code-lbl">کۆد</span>
            <strong class="mkt-code-val">${UI.esc(m.account_code)}</strong>
          </div>

          <!-- ناوی ماڕکێت و گەڕەک -->
          <div class="mkt-details-box">
            <div class="mkt-name-title-row">
              <h3 class="mkt-account-name">${UI.esc(m.account_name || 'بێ ناو')}</h3>
              ${hasCoords
                ? `<span class="mkt-gps-badge ok" title="پۆوتانی GPS هەیە">📍 لۆکەیشن هەیە</span>`
                : `<span class="mkt-gps-badge missing" title="پۆوتانی GPS نییە">⚠️ بێ پۆوتان</span>`}
            </div>

            <div class="mkt-sub-info-row">
              ${m.neighborhood ? `<span class="mkt-nh-item">${UI.icon('pin', 13)} <b>${UI.esc(m.neighborhood)}</b></span>` : ''}
              ${hasCoords ? `<span class="mkt-coords-text">(${Number(m.latitude).toFixed(4)}, ${Number(m.longitude).toFixed(4)})</span>` : ''}
              <div class="mkt-phone-wrap">${phoneChip}</div>
            </div>
          </div>

          <!-- کردارەکان -->
          <div class="mkt-row-actions">
            <!-- دوگمەی خستنە ناو گرووپی ماپسمی -->
            <button type="button" class="btn btn-sm ${isInGroup ? 'btn-success' : 'btn-ghost'} mkt-toggle-group-btn"
                    data-toggle-group="${UI.esc(m.account_code)}"
                    title="${isInGroup ? 'لە گرووپ لایببە' : 'زیادکردن بۆ گرووپی ماپسمی'}">
              ${isInGroup ? '✓ لە ماپسمیدایە' : '＋ ماپسمی'}
            </button>

            <!-- کردنەوە لە نەخشە -->
            <a href="${UI.esc(mapsUrl)}" target="_blank" rel="noopener noreferrer"
               class="btn btn-sm btn-ghost icon-btn" title="کردنەوەی لۆکەیشن لە نەخشە">
              ${UI.icon('pin', 16)}
            </a>

            <!-- دەستکاری -->
            <button type="button" class="btn btn-sm btn-ghost icon-btn" data-mkt-edit="${UI.esc(m.account_code)}" title="دەستکاری">
              ${UI.icon('edit', 15)}
            </button>

            <!-- سڕینەوە -->
            <button type="button" class="btn btn-sm btn-ghost icon-btn text-danger" data-mkt-del="${UI.esc(m.account_code)}" title="سڕینەوە">
              ${UI.icon('trash', 15)}
            </button>
          </div>

        </div>
      </article>
    `;
  }

  /* ---------------- بەستنەوەی ڕووداوەکان ---------------- */

  function bindEvents() {
    if (!container) return;

    // گەڕان بە کۆد (account_code)
    const searchInput = $('#mkt-code-search', container);
    searchInput?.addEventListener('input', e => {
      state.search = e.target.value;
      updateListOnly();
    });

    $('#mkt-clear-search', container)?.addEventListener('click', () => {
      state.search = '';
      renderLayout();
    });

    // فلتەری گەڕەک
    $('#mkt-nh-filter', container)?.addEventListener('change', e => {
      state.neighborhoodFilter = e.target.value;
      renderLayout();
    });

    // چەکبۆکسی تەنها لۆکەیشن
    $('#mkt-loc-only', container)?.addEventListener('change', e => {
      state.onlyWithLocation = e.target.checked;
      renderLayout();
    });

    // نوێکردنەوە
    $('#mkt-refresh-btn', container)?.addEventListener('click', async () => {
      const btn = $('#mkt-refresh-btn', container);
      UI.btnLoading(btn, true, '...');
      try {
        await loadData(true);
        renderLayout();
        UI.toast('داتاکان لە سەب بەیسەوە نوێکرانەوە ✓', 'success', 1800);
      } catch (err) {
        UI.toast('هەڵە لە نوێکردنەوە: ' + err.message, 'error');
      } finally {
        UI.btnLoading(btn, false);
      }
    });

    // ئێکسڵ
    $('#mkt-export-btn', container)?.addEventListener('click', exportToExcel);

    // نموونە لە سەب بەیس
    $('#mkt-seed-sample-btn', container)?.addEventListener('click', seedSampleMarkets);

    // دوو دوگمەی خوارەوە لەسەر باڕەکە:
    // ١. کامێرا
    $('#mkt-bbar-camera', container)?.addEventListener('click', openCameraModal);
    $('#mkt-open-cam-btn', container)?.addEventListener('click', openCameraModal);

    // ٢. ماڕکێتی نوێ
    $('#mkt-bbar-new', container)?.addEventListener('click', () => openMarketModal(null));

    // کرداری باڕی گرووپ: ناردن بۆ ماپسمی
    $('#mkt-send-group-btn', container)?.addEventListener('click', () => sendGroupToMapsMe(state.activeGroup));
    $('#mkt-clear-group-btn', container)?.addEventListener('click', () => {
      state.activeGroup = [];
      renderLayout();
      UI.toast('گرووپی ماپسمی خاوێنکرایەوە', 'info');
    });

    bindRowActions(container);
  }

  function updateListOnly() {
    const listWrap = $('#mkt-list-container', container);
    if (!listWrap) return;
    const list = filteredMarkets();
    listWrap.innerHTML = renderMarketsList(list);
    bindRowActions(listWrap);
  }

  function bindRowActions(root) {
    // پەیوەندی تەلەفۆن
    root.querySelectorAll('.phone-chip[data-phone]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        UI.openPhoneOptions(btn.dataset.phone);
      });
    });

    // خستنە ناو گرووپی ماپسمی
    root.querySelectorAll('[data-toggle-group]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const code = btn.dataset.toggleGroup;
        const target = state.markets.find(m => String(m.account_code) === String(code));
        if (!target) return;

        const idx = state.activeGroup.findIndex(x => String(x.account_code) === String(code));
        if (idx !== -1) {
          state.activeGroup.splice(idx, 1);
          UI.toast(`ماڕکێتی [${code}] لە گرووپ لادرا`, 'info');
        } else {
          state.activeGroup.push(target);
          UI.toast(`ماڕکێتی [${code}] زیادکرا بۆ گرووپی ماپسمی ✓`, 'success');
        }
        renderLayout();
      });
    });

    // دەستکاری
    root.querySelectorAll('[data-mkt-edit]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const code = btn.dataset.mktEdit;
        const target = state.markets.find(m => String(m.account_code) === String(code));
        if (target) openMarketModal(target);
      });
    });

    // سڕینەوە
    root.querySelectorAll('[data-mkt-del]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const code = btn.dataset.mktDel;
        const target = state.markets.find(m => String(m.account_code) === String(code));
        if (!target) return;

        const ok = await UI.confirmDialog(`ئایا دڵنیایت لە سڕینەوەی ماڕکێتی «${target.account_name || target.account_code}» (کۆد: ${target.account_code}) لە سەب بەیس؟`, {
          danger: true,
          okLabel: 'بەڵێ، بیسڕەوە',
          cancelLabel: 'پاشگەزبوونەوە'
        });

        if (ok) {
          try {
            await API.Markets.delete(code);
            state.markets = state.markets.filter(m => String(m.account_code) !== String(code));
            state.activeGroup = state.activeGroup.filter(m => String(m.account_code) !== String(code));
            Store.saveMarketsCache(state.markets);
            renderLayout();
            UI.toast('ماڕکێتەکە لە سەب بەیس سڕدرایەوە ✓', 'info');
          } catch (err) {
            UI.toast('هەڵە لە سڕینەوە: ' + err.message, 'error');
          }
        }
      });
    });
  }

  /* =========================================================
   *  مۆدالی کامێرا و دروستکردنی گرووپ بۆ بەرنامەی ماپسمی (MAPS.ME)
   * ========================================================= */

  function openCameraModal() {
    const modalBody = document.createElement('div');
    modalBody.className = 'mkt-cam-modal-body';

    modalBody.innerHTML = `
      <div class="mkt-cam-intro">
        <p class="muted" style="margin-top:0">وێنەی پسوولە یان کۆدەکان بگرە، کۆدەکان وەربگرە و گرووپەکە ڕاستەوخۆ بنێرە بۆ بەرنامەی <b>ماپسمی (MAPS.ME)</b>.</p>
      </div>

      <!-- دووگمەکانی وێنەگرتن و سکان -->
      <div class="mkt-cam-actions-box">
        <input type="file" id="mkt-cam-file-input" accept="image/*" capture="environment" multiple style="display:none">

        <button type="button" class="btn btn-primary btn-block mkt-cam-capture-btn" id="mkt-cam-take-photo-btn">
          <span>${UI.icon('camera', 22)}</span>
          <span>گرتنی وێنەی پسوولەکان (کامێرا)</span>
        </button>

        <div class="mkt-cam-input-manual-row">
          <input type="text" id="mkt-manual-code-input" inputmode="numeric" placeholder="یان کۆدی ماڕکێتەکان بنووسە: بۆ نموونە 101 102 105" autocomplete="off">
          <button type="button" class="btn btn-ghost" id="mkt-add-manual-code-btn">＋ زیادکردن</button>
        </div>
      </div>

      <!-- شوێنی نیشاندانی وێنە گیراوەکان -->
      <div class="mkt-thumbs-preview" id="mkt-thumbs-preview" style="display:none"></div>

      <!-- گرووپی ماڕکێتە هەڵبژێردراوەکان -->
      <div class="mkt-scanned-group-wrap">
        <div class="mkt-group-head-row">
          <h4>📍 گرووپی ماڕکێتەکان بۆ ماپسمی (<span id="mkt-group-count">${state.activeGroup.length}</span> ماڕکێت)</h4>
          ${state.activeGroup.length ? `<button type="button" class="btn btn-xs btn-ghost text-danger" id="mkt-clear-group-inner">خاوێنکردنەوە</button>` : ''}
        </div>

        <div class="mkt-group-items-list" id="mkt-group-items-list">
          ${renderGroupItemsHtml()}
        </div>
      </div>
    `;

    const { close, backdrop } = UI.openModal({
      title: '📸 کامێرا و گرووپی بەرنامەی ماپسمی (MAPS.ME)',
      body: modalBody,
      wide: true,
      actions: [
        { label: 'داخستن', className: 'btn-ghost', onClick: () => close() },
        {
          label: '🗺️ ناردن بۆ بەرنامەی ماپسمی (MAPS.ME)',
          className: 'btn-success',
          onClick: async () => {
            if (!state.activeGroup.length) {
              UI.toast('تکایە سەرەتا چەند ماڕکێتێک زیاد بکە بۆ گرووپەکە', 'warning');
              return;
            }
            await sendGroupToMapsMe(state.activeGroup);
            close();
            renderLayout();
          }
        }
      ]
    });

    const fileInput = modalBody.querySelector('#mkt-cam-file-input');
    const photoBtn = modalBody.querySelector('#mkt-cam-take-photo-btn');
    const thumbsWrap = modalBody.querySelector('#mkt-thumbs-preview');
    const manualInput = modalBody.querySelector('#mkt-manual-code-input');
    const manualBtn = modalBody.querySelector('#mkt-add-manual-code-btn');

    // کلیک لە دوگمەی کامێرا
    photoBtn?.addEventListener('click', () => fileInput?.click());

    // وەرگرتنی وێنەکان
    fileInput?.addEventListener('change', async e => {
      const files = [...(e.target.files || [])];
      if (!files.length) return;

      thumbsWrap.style.display = 'flex';
      thumbsWrap.innerHTML = '<div class="muted">خەریکی خوێندنەوەی وێنەکانە...</div>';

      for (const file of files) {
        await processCapturedImage(file, thumbsWrap);
      }
      refreshGroupList();
    });

    // زیادکردنی دەستی بە کۆدی ژمارەیی
    const addManual = () => {
      const val = manualInput.value.trim();
      if (!val) return;
      const latin = UI.toLatinDigits(val);
      const codes = latin.split(/[,،\s]+/).map(c => c.replace(/\D/g, '').trim()).filter(Boolean);
      let addedCount = 0;

      codes.forEach(code => {
        const target = state.markets.find(m => UI.toLatinDigits(m.account_code).replace(/\D/g, '').trim() === code);
        if (target) {
          const targetCode = UI.toLatinDigits(target.account_code).replace(/\D/g, '').trim();
          if (!state.activeGroup.some(x => UI.toLatinDigits(x.account_code).replace(/\D/g, '').trim() === targetCode)) {
            state.activeGroup.push(target);
            addedCount++;
          }
        } else {
          UI.toast(`کۆدی ژمارە «${code}» لە خشتەی ماڕکێتەکاندا نەدۆزرایەوە`, 'warning');
        }
      });

      if (addedCount > 0) {
        UI.toast(`${addedCount} ماڕکێت زیادکرا بۆ گرووپەکە ✓`, 'success');
      }
      manualInput.value = '';
      refreshGroupList();
    };

    manualBtn?.addEventListener('click', addManual);
    manualInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addManual();
      }
    });

    // خاوێنکردنەوە لە ناو مۆدال
    modalBody.querySelector('#mkt-clear-group-inner')?.addEventListener('click', () => {
      state.activeGroup = [];
      refreshGroupList();
    });

    function refreshGroupList() {
      const countEl = modalBody.querySelector('#mkt-group-count');
      const listEl = modalBody.querySelector('#mkt-group-items-list');
      if (countEl) countEl.textContent = state.activeGroup.length;
      if (listEl) listEl.innerHTML = renderGroupItemsHtml();
      bindGroupItemDeletes();
    }

    function bindGroupItemDeletes() {
      modalBody.querySelectorAll('[data-drop-code]').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.dropCode;
          state.activeGroup = state.activeGroup.filter(x => String(x.account_code) !== String(code));
          refreshGroupList();
        });
      });
    }

    bindGroupItemDeletes();
  }

  function renderGroupItemsHtml() {
    if (!state.activeGroup.length) {
      return `<div class="mkt-group-empty muted">هێشتا هیچ ماڕکێتێک لە گرووپەکەدا نییە. بە کامێرا وێنە بگرە یان کۆد بنووسە.</div>`;
    }

    return state.activeGroup.map((m, idx) => {
      const hasCoords = m.latitude !== null && m.latitude !== undefined &&
                        m.longitude !== null && m.longitude !== undefined;

      return `
        <div class="mkt-group-card-item">
          <span class="mkt-g-index">#${idx + 1}</span>
          <div class="mkt-g-info">
            <div class="mkt-g-code-row">
              <span class="mkt-g-code-chip">${UI.esc(m.account_code)}</span>
              <strong>${UI.esc(m.account_name || 'ماڕکێت')}</strong>
            </div>
            <div class="mkt-g-sub">
              <span>${m.neighborhood ? '📍 ' + UI.esc(m.neighborhood) : ''}</span>
              ${hasCoords
                ? `<span class="text-success" style="font-size:0.78rem">✓ لۆکەیشن هەیە</span>`
                : `<span class="text-danger" style="font-size:0.78rem">⚠️ بێ لۆکەیشن</span>`}
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-xs text-danger" data-drop-code="${UI.esc(m.account_code)}" title="سڕینەوە لە گرووپ">✕</button>
        </div>`;
    }).join('');
  }

  /* خوێندنەوەی وێنە بە کامێرا و پشکنینی بارکۆد یان کۆدەکان */
  async function processCapturedImage(file, previewWrap) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;

        // دروستکردنی تەمبنیڵ لە پێشبینین
        const imgBox = document.createElement('div');
        imgBox.className = 'mkt-thumb-box';
        imgBox.innerHTML = `
          <img src="${dataUrl}" alt="پسوولە">
          <span class="mkt-thumb-status">خوێندنەوە...</span>`;
        previewWrap.appendChild(imgBox);

        let foundCodes = [];

        // ١. ئەگەر براوسەرەکە BarcodeDetector ی هەبێت (Chrome / Android)
        if ('BarcodeDetector' in window) {
          try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a'] });
            const img = new Image();
            img.src = dataUrl;
            await img.decode();
            const barcodes = await detector.detect(img);
            barcodes.forEach(b => {
              if (b.rawValue) foundCodes.push(b.rawValue.trim());
            });
          } catch (_) {}
        }

        // ٢. پشکنینی کۆدەکان لەگەڵ داتابەیسی ماڕکێتەکان
        let matched = 0;
        foundCodes.forEach(code => {
          const target = state.markets.find(m => String(m.account_code).trim().toLowerCase() === code.toLowerCase());
          if (target && !state.activeGroup.some(x => String(x.account_code) === String(target.account_code))) {
            state.activeGroup.push(target);
            matched++;
          }
        });

        const statusSpan = imgBox.querySelector('.mkt-thumb-status');
        if (matched > 0) {
          if (statusSpan) statusSpan.textContent = `✓ ${matched} ماڕکێت دۆزرایەوە`;
          statusSpan.classList.add('ok');
          UI.toast(`لە وێنەکەدا ${matched} ماڕکێت ناسرایەوە و خرایە ناو گرووپی ماپسمی ✓`, 'success');
        } else {
          if (statusSpan) statusSpan.textContent = 'کۆد نەخوێنرایەوە';
          // پێشنیارکردنی نووسینی کۆدی دەستی
          UI.toast('کۆد بە ئۆتۆماتیکی لە وێنەکەدا نەدۆزرایەوە — دەتوانیت کۆدەکەی لە خوارەوە بنووسیت', 'info', 3000);
        }

        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  /* =========================================================
   *  مۆدالی زیادکردن و دەستکاریکردنی ماڕکێت
   * ========================================================= */

  function openMarketModal(market = null) {
    const isEdit = !!market;
    const data = market || {
      account_code: '',
      account_name: '',
      neighborhood: '',
      latitude: '',
      longitude: '',
      phone: ''
    };

    const modalBody = document.createElement('div');
    modalBody.className = 'mkt-modal-body';
    modalBody.innerHTML = `
      <form id="mkt-form" autocomplete="off" class="mkt-form">

        <!-- گرنگترین ڕیز: account_code (کۆدی ماڕکێت تەنها ژمارەیە و نابێت دووماڕکێت هەمان کۆدبن) -->
        <div class="field mkt-code-field-highlight">
          <label for="mkt-f-code">
            <span>کۆدی ماڕکێت (account_code)</span>
            <span class="text-danger">* تەنها ژمارە و پێویستە ناوازە بێت</span>
          </label>
          <input id="mkt-f-code" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="بۆ نموونە: 101" required
                 value="${UI.esc(data.account_code)}" ${isEdit ? 'readonly style="background:var(--surface-2);opacity:0.85"' : 'autofocus'}>
          <small class="muted">کۆدی ماڕکێتەکان تەنها ژمارەن و نابێت دووبارە بێتەوە.</small>
        </div>

        <div class="field">
          <label for="mkt-f-name">ناوی ماڕکێت (account_name) <span class="text-danger">*</span></label>
          <input id="mkt-f-name" type="text" placeholder="بۆ نموونە: مارکێتی شاهانە" required value="${UI.esc(data.account_name || '')}">
        </div>

        <div class="mkt-form-row">
          <div class="field">
            <label for="mkt-f-nh">گەڕەک / زۆن (neighborhood)</label>
            <input id="mkt-f-nh" list="mkt-nh-datalist" type="text" placeholder="گەڕەک بنووسە یان هەڵبژێرە..." value="${UI.esc(data.neighborhood || '')}">
            <datalist id="mkt-nh-datalist">
              ${state.neighborhoods.map(n => `<option value="${UI.esc(n)}">`).join('')}
            </datalist>
          </div>

          <div class="field">
            <label for="mkt-f-phone">ژمارەی تەلەفۆن (phone)</label>
            <input id="mkt-f-phone" type="tel" inputmode="tel" placeholder="0770..." value="${UI.esc(data.phone || '')}">
          </div>
        </div>

        <!-- لۆکەیشن (latitude & longitude) -->
        <div class="field mkt-loc-fieldset card" style="padding:12px;margin-bottom:8px">
          <div class="mkt-loc-label-row">
            <strong>📍 لۆکەیشنی ماڕکێت بۆ بەرنامەی ماپسمی و گووگڵ ماپ</strong>
            <button type="button" class="btn btn-ghost btn-xs mkt-gps-btn" id="mkt-f-gps-btn" title="وەرگرتنی خۆکاری پۆوتانی ئێستام">
              📍 لۆکەیشنی ئێستام (GPS)
            </button>
          </div>

          <div class="mkt-form-row">
            <div class="field" style="margin-bottom:0">
              <label for="mkt-f-lat" style="font-size:0.75rem">هێڵی پانی (Latitude)</label>
              <input id="mkt-f-lat" type="text" inputmode="decimal" placeholder="35.5650"
                     value="${data.latitude !== null && data.latitude !== undefined ? data.latitude : ''}">
            </div>
            <div class="field" style="margin-bottom:0">
              <label for="mkt-f-lon" style="font-size:0.75rem">هێڵی درێژی (Longitude)</label>
              <input id="mkt-f-lon" type="text" inputmode="decimal" placeholder="45.4200"
                     value="${data.longitude !== null && data.longitude !== undefined ? data.longitude : ''}">
            </div>
          </div>

          <div style="margin-top:10px">
            <input id="mkt-f-paste-url" type="url" placeholder="یان بەستەری Google Maps لێرە پەیست بکە: https://maps.google.com/?q=..." style="font-size:0.8rem">
          </div>
        </div>

      </form>
    `;

    // پەیستکردنی بەستەری Google Maps
    modalBody.querySelector('#mkt-f-paste-url')?.addEventListener('input', e => {
      const parsed = parseCoordsFromUrl(e.target.value);
      if (parsed) {
        modalBody.querySelector('#mkt-f-lat').value = parsed.lat;
        modalBody.querySelector('#mkt-f-lon').value = parsed.lon;
        UI.toast(`پۆوتانەکان وەرگیران: ${parsed.lat}, ${parsed.lon} ✓`, 'success');
      }
    });

    // دوگمەی GPS بۆ وەرگرتنی شوێنی ئێستا
    modalBody.querySelector('#mkt-f-gps-btn')?.addEventListener('click', () => {
      const btn = modalBody.querySelector('#mkt-f-gps-btn');
      if (!navigator.geolocation) {
        UI.toast('ئەم ئامێرە پشتگیری GPS ناکات', 'error');
        return;
      }
      btn.textContent = '⏳ وەرگرتن...';
      btn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        pos => {
          btn.textContent = '✓ وەرگیرا';
          btn.disabled = false;
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lon = parseFloat(pos.coords.longitude.toFixed(6));
          modalBody.querySelector('#mkt-f-lat').value = lat;
          modalBody.querySelector('#mkt-f-lon').value = lon;
          UI.toast(`لۆکەیشن وەرگیرا: ${lat}, ${lon}`, 'success', 2500);
        },
        err => {
          btn.textContent = '📍 لۆکەیشنی ئێستام (GPS)';
          btn.disabled = false;
          UI.toast('نەتوانرا لۆکەیشن دیاریبکرێت: ' + (err.message || 'دەستڕاگەیشتن ڕەتکرایەوە'), 'error');
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });

    const { close } = UI.openModal({
      title: isEdit ? '✏️ دەستکاریکردنی ماڕکێت' : '🏪 ماڕکێتی نوێ',
      body: modalBody,
      wide: true,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: isEdit ? 'پاشەکەوتکردن لە سەب بەیس' : 'زیادکردن بۆ سەب بەیس',
          className: 'btn-primary',
          onClick: async () => {
            const rawCode = modalBody.querySelector('#mkt-f-code').value.trim();
            const account_code = UI.toLatinDigits(rawCode).replace(/\D/g, '');
            const account_name = modalBody.querySelector('#mkt-f-name').value.trim();
            const neighborhood = modalBody.querySelector('#mkt-f-nh').value.trim() || null;
            const phone = UI.toLatinDigits(modalBody.querySelector('#mkt-f-phone').value.trim()) || null;

            const latStr = UI.toLatinDigits(modalBody.querySelector('#mkt-f-lat').value.trim());
            const lonStr = UI.toLatinDigits(modalBody.querySelector('#mkt-f-lon').value.trim());
            const latitude = latStr ? parseFloat(latStr) : null;
            const longitude = lonStr ? parseFloat(lonStr) : null;

            if (!account_code) {
              UI.toast('تکایە کۆدی ژمارەیی ماڕکێت (account_code) بنووسە', 'error');
              modalBody.querySelector('#mkt-f-code').focus();
              return;
            }
            if (!account_name) {
              UI.toast('تکایە ناوی ماڕکێت (account_name) بنووسە', 'error');
              modalBody.querySelector('#mkt-f-name').focus();
              return;
            }

            // مەرجی سەرەکی بەکارهێنەر: نابێت دووماڕکێت هەمان کۆدیان هەبێت!
            const duplicate = state.markets.find(m => UI.toLatinDigits(m.account_code).replace(/\D/g, '').trim() === account_code);
            if (duplicate && (!isEdit || UI.toLatinDigits(duplicate.account_code).replace(/\D/g, '').trim() !== UI.toLatinDigits(data.account_code).replace(/\D/g, '').trim())) {
              UI.toast(`کۆدی ژمارە «${account_code}» پێشتر تۆمارکراوە — نابێت دوو ماڕکێت هەمان کۆدیان هەبێت!`, 'error', 4500);
              modalBody.querySelector('#mkt-f-code').focus();
              return;
            }

            const payload = {
              account_code,
              account_name,
              neighborhood,
              latitude: Number.isFinite(latitude) ? latitude : null,
              longitude: Number.isFinite(longitude) ? longitude : null,
              phone
            };

            try {
              if (isEdit) {
                await API.Markets.update(account_code, payload);
                const idx = state.markets.findIndex(m => String(m.account_code) === String(account_code));
                if (idx !== -1) state.markets[idx] = { ...state.markets[idx], ...payload };
                // ئەگەر لەناو گرووپی ماپسمیدا بوو، ئەویش نوێبکەرەوە
                const gIdx = state.activeGroup.findIndex(x => String(x.account_code) === String(account_code));
                if (gIdx !== -1) state.activeGroup[gIdx] = { ...state.activeGroup[gIdx], ...payload };
                UI.toast('ماڕکێتەکە لە سەب بەیس نوێکرایەوە ✓', 'success');
              } else {
                await API.Markets.insert(payload);
                state.markets.unshift(payload);
                UI.toast('ماڕکێتەکە بە سەرکەوتوویی لە سەب بەیس تۆمارکرا ✓', 'success');
              }

              Store.saveMarketsCache(state.markets);
              close();
              renderLayout();
            } catch (err) {
              UI.toast('هەڵە لە پاشەکەوتکردن لە سەب بەیس: ' + err.message, 'error', 4500);
            }
          }
        }
      ]
    });
  }

  /* ---------------- دانانی داتای نموونەیی ---------------- */

  async function seedSampleMarkets() {
    const ok = await UI.confirmDialog('ئایا دەتەوێت چەند ماڕکێتێکی نموونەیی کوردی لەگەڵ کۆد و لۆکەیشن لە خشتەی market_locaetion لە سەب بەیس تۆمار بکەیت؟', {
      okLabel: 'بەڵێ، تۆماریان بکە',
      cancelLabel: 'پاشگەزبوونەوە'
    });
    if (!ok) return;

    const samples = [
      {
        account_code: '101',
        account_name: 'مارکێتی شاهانە',
        neighborhood: 'ڕاپەڕین',
        latitude: 35.5612,
        longitude: 45.4123,
        phone: '07701234567'
      },
      {
        account_code: '102',
        account_name: 'سوپەرمارکێتی بەختیاری',
        neighborhood: 'بەختیاری',
        latitude: 35.5550,
        longitude: 45.4320,
        phone: '07709876543'
      },
      {
        account_code: '103',
        account_name: 'هایپەرمارکێتی ڕۆژ',
        neighborhood: 'سەرچنار',
        latitude: 35.5780,
        longitude: 45.3900,
        phone: '07504567890'
      },
      {
        account_code: '104',
        account_name: 'مینی مارکێتی چوارچرا',
        neighborhood: 'چوارچرا',
        latitude: 35.5680,
        longitude: 45.4410,
        phone: '07723456789'
      },
      {
        account_code: '105',
        account_name: 'کۆگای فرۆشتنی تاسڵوجە',
        neighborhood: 'تاسڵوجە',
        latitude: 35.6020,
        longitude: 45.3210,
        phone: '07512349876'
      }
    ];

    try {
      for (const s of samples) {
        await API.Markets.insert(s).catch(() => {});
      }
      UI.toast('داتاکان لە سەب بەیس تۆمارکران ✓', 'success');
      await loadData(true);
      renderLayout();
    } catch (err) {
      UI.toast('هەڵە لە تۆمارکردن: ' + err.message, 'error');
    }
  }

  /* ---------------- دەرهێنان بۆ ئێکسڵ ---------------- */

  async function exportToExcel() {
    const list = filteredMarkets();
    if (!list.length) {
      UI.toast('هیچ ماڕکێتێک نییە بۆ دەرهێنان', 'error');
      return;
    }

    try {
      await UI.ensureXlsx();
      const rows = list.map((m, idx) => ({
        '#': idx + 1,
        'کۆدی ئەکاونت (account_code)': m.account_code || '',
        'ناوی ماڕکێت (account_name)': m.account_name || '',
        'گەڕەک / زۆن (neighborhood)': m.neighborhood || '',
        'هێڵی پانی (latitude)': m.latitude ?? '',
        'هێڵی درێژی (longitude)': m.longitude ?? '',
        'تەلەفۆن (phone)': m.phone || '',
        'بەستەری نەخشە': (m.latitude && m.longitude) ? `https://www.google.com/maps?q=${m.latitude},${m.longitude}` : ''
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'market_locaetion');
      XLSX.writeFile(wb, `ماڕکێتەکان_market_locaetion_${UI.todayStr()}.xlsx`);
      UI.toast('فایلی ئێکسڵ بە سەرکەوتوویی دابەزێنرا ✓', 'success');
    } catch (err) {
      UI.toast('هەڵە لە دەرهێنانی ئێکسڵ: ' + err.message, 'error');
    }
  }

  function stop() {}

  return {
    render,
    stop,
    openMarketModal,
    openCameraModal,
    exportToExcel,
    sendGroupToMapsMe
  };
})();
