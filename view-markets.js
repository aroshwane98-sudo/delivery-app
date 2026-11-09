/* =========================================================
 *  فۆڕمی ماڕکێتەکان — Markets View
 *  هێنانی کۆدی ماڕکێت لەگەڵ ناوەکان لە سەب بەیس (Supabase) بەسۆڕتی کۆدەکان
 * ========================================================= */

const MarketsView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let container = null;

  const state = {
    searchResults: [],
    hasSearched: false,
    search: '',
    searching: false,
    sortMode: 'code-asc', // 'code-asc' | 'code-desc' | 'name-asc'
    localMarkets: new Map(), // ماڕکێتە نوێکراوەکان یان دەستکاریکراوەکانی ئەم دانیشتنە
    activeGroup: [] // گرووپی ماڕکێتە هەڵبژێردراوەکان بۆ کامێرا و دروستکردنی فایلی KMZ
  };

  /* ---------------- سۆڕتکردنی ماڕکێتەکان (بەسۆڕتی کۆدەکان) ---------------- */

  function sortMarketsList(list, mode = state.sortMode) {
    const seen = new Set();
    const unique = [];
    for (const m of (list || [])) {
      if (!m) continue;
      const code = String(m.account_code || '').trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      unique.push(m);
    }

    return unique.sort((a, b) => {
      const codeAStr = String(a.account_code || '').trim();
      const codeBStr = String(b.account_code || '').trim();

      // وەرگرتنی ژمارەی کۆدەکان بە ژمارەی ئینگلیزی
      const numA = parseInt(UI.toLatinDigits(codeAStr).replace(/\D/g, ''), 10);
      const numB = parseInt(UI.toLatinDigits(codeBStr).replace(/\D/g, ''), 10);

      if (mode === 'code-desc') {
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numB - numA;
        return codeBStr.localeCompare(codeAStr, 'ckb', { numeric: true });
      }

      if (mode === 'name-asc') {
        const nameA = String(a.account_name || '').trim();
        const nameB = String(b.account_name || '').trim();
        return nameA.localeCompare(nameB, 'ckb');
      }

      // بنەڕەت: code-asc (لە کەمەوە بۆ زۆر: 1، 2، 3 ... 10، 11 ...)
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
      return codeAStr.localeCompare(codeBStr, 'ckb', { numeric: true });
    });
  }

  /* ---------------- پشکنینی هاوشێوەیی لەگەڵ گەڕان (بۆ ماڕکێتە لۆکاڵییەکان) ---------------- */

  function matchesQuery(m, query) {
    if (!m || !query) return false;
    const rawSearch = query.trim();
    const cleanSearch = rawSearch.replace(/^[#＃]/, '').trim();
    const cleanLatin = UI.toLatinDigits(cleanSearch);
    const latinDigitsOnly = cleanLatin.replace(/\D/g, '');
    const isPureNumber = latinDigitsOnly.length > 0 && latinDigitsOnly === cleanLatin;

    if (isPureNumber) {
      const mCodeDigits = UI.toLatinDigits(m.account_code || '').replace(/\D/g, '');
      const mCodeStr = String(m.account_code || '').trim();
      if (latinDigitsOnly.length < 8) {
        return mCodeDigits === latinDigitsOnly || mCodeStr === cleanSearch;
      }
      const mPhoneDigits = UI.toLatinDigits(m.phone || '').replace(/\D/g, '');
      return mCodeDigits === latinDigitsOnly || mPhoneDigits.includes(latinDigitsOnly);
    }

    const q = UI.norm(rawSearch);
    return [
      m.account_name,
      m.neighborhood,
      m.phone
    ].some(v => UI.norm(v).includes(q));
  }

  /* ---------------- گەڕانی ئامانجدار لە سەب بەیس (تەنها لە کاتی گەڕاندا دێت) ---------------- */

  async function performSearch(query) {
    const raw = (query || '').trim();
    if (!raw) {
      state.search = '';
      state.hasSearched = false;
      state.searching = false;
      state.searchResults = [];
      updateListDisplay();
      return;
    }

    state.search = raw;
    state.hasSearched = true;
    state.searching = true;
    updateListDisplay();

    try {
      let results = [];
      if (typeof API !== 'undefined' && API.Markets && API.Markets.search) {
        results = await API.Markets.search(raw);
      } else {
        // Fallback ئەگەر پێویست بوو
        const clean = raw.replace(/^[#＃]/, '').trim();
        const latin = UI.toLatinDigits(clean).trim();
        const digits = latin.replace(/\D/g, '');
        const isNum = digits.length > 0 && digits === latin;
        const table = (typeof CONFIG !== 'undefined' && CONFIG.MARKETS_TABLE) || 'market_locaetion';
        const url = (typeof CONFIG !== 'undefined' && CONFIG.RECORDS_URL) || '';
        const key = (typeof CONFIG !== 'undefined' && CONFIG.RECORDS_KEY) || '';

        if (url && key) {
          const path = isNum && digits.length < 8
            ? `/${table}?select=*&account_code=eq.${encodeURIComponent(digits)}`
            : `/${table}?select=*&or=(account_name.ilike.*${encodeURIComponent(clean)}*,neighborhood.ilike.*${encodeURIComponent(clean)}*)&order=account_code.asc&limit=50`;
          const res = await fetch(url + path, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
          });
          if (res.ok) results = await res.json();
        }
      }

      if (!Array.isArray(results)) results = [];

      // هاوتاکردنی لەگەڵ هەر ماڕکێتێکی دەستکاریکراو یان نوێکراوە لە کۆگای لۆکاڵدا
      if (state.localMarkets.size > 0) {
        for (const [code, m] of state.localMarkets.entries()) {
          const match = matchesQuery(m, raw);
          const existingIdx = results.findIndex(r => String(r.account_code) === String(code));
          if (match) {
            if (existingIdx !== -1) results[existingIdx] = m;
            else results.unshift(m);
          } else if (existingIdx !== -1) {
            results.splice(existingIdx, 1);
          }
        }
      }

      state.searchResults = sortMarketsList(results);
    } catch (err) {
      console.warn('هەڵە لە گەڕانی ماڕکێت:', err);
      state.searchResults = [];
    } finally {
      state.searching = false;
      updateListDisplay();
    }
  }

  function updateListDisplay() {
    if (!container) return;
    const listEl = $('#mkt-page-list-container', container);
    if (!listEl) return;
    listEl.innerHTML = renderPageListHtml(state.searchResults);
    bindPageListActions(listEl);
    const clrBtn = $('#mkt-page-search-clear', container);
    if (clrBtn) clrBtn.style.display = state.search ? 'flex' : 'none';
  }

  /* =========================================================
   *  مۆدالی زیادکردن و دەستکاریکردنی ماڕکێت (Supabase)
   * ========================================================= */

  /* ---------------- وەرگرتنی هەموو زۆنەکان (لە ماڕکێتەکان و سەب بەیس) ---------------- */

  async function getMergedZones() {
    const set = new Set();
    // زۆنەکان لە ماڕکێتە دۆزراوەکان
    (state.searchResults || []).forEach(m => {
      const z = (m.neighborhood || '').trim();
      if (z) set.add(z);
    });
    for (const m of state.localMarkets.values()) {
      const z = (m.neighborhood || '').trim();
      if (z) set.add(z);
    }
    // زۆنەکان لە خشتەی زۆنەکانی سەب بەیس
    try {
      const cached = Store.getListsCache();
      if (cached && cached.zones && cached.zones.length) {
        cached.zones.forEach(z => {
          const name = (z.name || '').trim();
          if (name) set.add(name);
        });
      } else if (typeof API !== 'undefined' && API.Lists && API.Lists.zones) {
        const rows = await API.Lists.zones();
        if (Array.isArray(rows)) {
          rows.forEach(z => {
            const name = (z.name || '').trim();
            if (name) set.add(name);
          });
        }
      }
    } catch (_) {}
    return [...set].sort((a, b) => a.localeCompare(b, 'ckb'));
  }

  /* ---------------- ویندۆی نەخشە بۆ نیشانکردنی ماڕکێت (Map Picker) ---------------- */

  function openMapPickerModal({ initialLat, initialLon, onSelect }) {
    const modalWrap = document.createElement('div');
    modalWrap.className = 'mkt-picker-modal-content';

    const hasInit = Number.isFinite(initialLat) && Number.isFinite(initialLon);
    let currentLat = hasInit ? initialLat : 35.5668;
    let currentLon = hasInit ? initialLon : 45.4161;

    modalWrap.innerHTML = `
      <div class="mkt-picker-map-wrap">
        <div id="mkt-leaflet-picker-map"></div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; gap:8px; flex-wrap:wrap;">
        <div style="font-size:0.84rem; color:var(--text); font-weight:700;">
          پۆوتان: <strong id="mkt-picker-coords-text" style="direction:ltr; display:inline-block; font-family:monospace; color:var(--accent);">
            ${hasInit ? `${currentLat.toFixed(6)}, ${currentLon.toFixed(6)}` : 'دیاری نەکراوە'}
          </strong>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="mkt-picker-gps-now-btn" style="padding:4px 10px; font-size:0.78rem;">
          📍 شوێنی ئێستام (GPS)
        </button>
      </div>
      <div class="mkt-map-hint-box">
        👆 دەتوانیت <span>نەخشەکە بجوڵێنیت</span> یان پەنجە لەسەر <span>هەر شوێنێک دابنێیت</span> بۆ نیشانکردنی ماڕکێتەکە.
      </div>
    `;

    let map = null;
    let marker = null;

    const { close } = UI.openModal({
      title: '📍 نیشانکردنی ماڕکێت لەسەر نەخشە',
      body: modalWrap,
      wide: true,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'هەڵبژاردن',
          className: 'btn-primary',
          onClick: () => {
            if (onSelect) onSelect(currentLat, currentLon);
            close();
          }
        }
      ]
    });

    // دروستکردنی نەخشە لەگەڵ دڵنیابوون لە دەرکەوتنی تەواوی تایلەکان
    setTimeout(() => {
      if (typeof L === 'undefined') return;

      const mapContainer = modalWrap.querySelector('#mkt-leaflet-picker-map');
      if (!mapContainer) return;

      map = L.map(mapContainer, {
        zoomControl: true,
        attributionControl: false
      }).setView([currentLat, currentLon], hasInit ? 16 : 13);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // ئایکۆنی ڕەنگ سوور و سەرنجڕاکێشی نیشانەی ماڕکێت
      const pinIcon = L.divIcon({
        className: 'mkt-custom-map-pin',
        html: `<div style="
          width: 36px;
          height: 36px;
          background: #dc2626;
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        "><span style="transform: rotate(45deg); font-size: 16px;">🏪</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      marker = L.marker([currentLat, currentLon], {
        icon: pinIcon,
        draggable: true
      }).addTo(map);

      const updatePin = (lat, lon, pan = false) => {
        currentLat = parseFloat(lat.toFixed(6));
        currentLon = parseFloat(lon.toFixed(6));
        marker.setLatLng([currentLat, currentLon]);
        if (pan) map.setView([currentLat, currentLon], 16);
        const textEl = modalWrap.querySelector('#mkt-picker-coords-text');
        if (textEl) textEl.textContent = `${currentLat}, ${currentLon}`;
      };

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        updatePin(p.lat, p.lng);
      });

      map.on('click', e => {
        updatePin(e.latlng.lat, e.latlng.lng);
      });

      const gpsBtn = modalWrap.querySelector('#mkt-picker-gps-now-btn');
      const fetchGps = (pan = true) => {
        if (!navigator.geolocation) return;
        if (gpsBtn) {
          gpsBtn.textContent = 'چاوەڕوانبە...';
          gpsBtn.disabled = true;
        }
        navigator.geolocation.getCurrentPosition(
          pos => {
            if (gpsBtn) {
              gpsBtn.textContent = '📍 شوێنی ئێستام (GPS)';
              gpsBtn.disabled = false;
            }
            updatePin(pos.coords.latitude, pos.coords.longitude, pan);
          },
          err => {
            if (gpsBtn) {
              gpsBtn.textContent = '📍 شوێنی ئێستام (GPS)';
              gpsBtn.disabled = false;
            }
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      };

      if (gpsBtn) {
        gpsBtn.addEventListener('click', () => fetchGps(true));
      }

      // ئەگەر پێشتر لۆکەیشن نەبوو و لۆکەیشنی مۆبایل کرابێتەوە، دەچێتە شوێنی بەکارهێنەر
      if (!hasInit && navigator.geolocation) {
        fetchGps(true);
      }

      map.invalidateSize();
    }, 200);
  }

  /* ---------------- کردنەوەی فۆڕمی دەستکاری / زیادکردنی ماڕکێت ---------------- */

  async function openAddEditModal(market = null) {
    const isEdit = !!market;
    const modalBody = document.createElement('div');
    modalBody.className = 'mkt-modal-body';

    const currentCode = market ? String(market.account_code || '') : '';
    const currentName = market ? String(market.account_name || '') : '';
    const currentNh = market ? String(market.neighborhood || '') : '';
    const currentPhone = market ? String(market.phone || '') : '';
    let selectedLat = market && market.latitude !== null && market.latitude !== undefined ? parseFloat(market.latitude) : null;
    let selectedLon = market && market.longitude !== null && market.longitude !== undefined ? parseFloat(market.longitude) : null;

    // هێنانی هەموو زۆنەکانی سەب بەیس و ماڕکێتەکان بۆ ناو لیست بۆکس
    const allZones = await getMergedZones();

    modalBody.innerHTML = `
      <form class="mkt-form" id="mkt-edit-form" autocomplete="off">
        
        <!-- خانەی کۆدی ماڕکێت: #کۆدی ماڕکێت قفڵە ناتوانرێت دەستکاری بکرێت -->
        <div class="mkt-code-field-highlight">
          <label for="mkt-f-code">
            <span>کۆدی ماڕکێت ${isEdit ? '🔒' : '<span class="text-danger">*</span>'}</span>
            ${isEdit ? '<span class="muted" style="font-size:0.75rem">قفڵە و ناتوانرێت دەستکاری بکرێت</span>' : ''}
          </label>
          <input type="text" id="mkt-f-code"
                 value="${isEdit ? '#' + UI.esc(currentCode) : ''}"
                 ${isEdit ? 'readonly disabled style="opacity:0.85; background:var(--surface-2); cursor:not-allowed; font-weight:800; color:var(--accent);"' : 'inputmode="numeric" placeholder="نموونە: 101، 102، 105" autofocus required'}>
        </div>

        <!-- خانەی ناوی ماڕکێت -->
        <div class="field">
          <label for="mkt-f-name">ناوی ماڕکێت <span class="text-danger">*</span></label>
          <input type="text" id="mkt-f-name" placeholder="ناوی ماڕکێت بنووسە..."
                 value="${UI.esc(currentName)}" required>
        </div>

        <div class="mkt-form-row">
          <!-- خانەی زۆنی ماڕکێت: لیست بۆکسە هەر زۆنێکی نوێ بنوسرێت پاشەکەوت دەبێت لە سەب بەیس -->
          <div class="field">
            <label for="mkt-f-nh">زۆنی ماڕکێت</label>
            <input type="text" id="mkt-f-nh" list="mkt-zones-datalist" placeholder="زۆنێک هەڵبژێرە یان زۆنی نوێ بنووسە..."
                   value="${UI.esc(currentNh)}" autocomplete="off">
            <datalist id="mkt-zones-datalist">
              ${allZones.map(z => `<option value="${UI.esc(z)}">`).join('')}
            </datalist>
          </div>

          <!-- خانەی ژمارەی تەلەفۆن: یازدە ژمارەیە -->
          <div class="field">
            <label for="mkt-f-phone">
              <span>ژمارەی تەلەفۆن</span>
              <span class="muted" style="font-size:0.75rem">(١١ ژمارە)</span>
            </label>
            <input type="tel" id="mkt-f-phone" inputmode="numeric" maxlength="11" placeholder="07XXXXXXXXX"
                   value="${UI.esc(currentPhone)}">
          </div>
        </div>

        <!-- دووگمەی نیشانکردنی ماڕکێت -->
        <div class="field" style="margin-bottom:0">
          <label>شوێنی ماڕکێت لەسەر نەخشە</label>
          <button type="button" class="mkt-pin-map-btn" id="mkt-f-open-map-btn">
            📍 نیشانکردنی ماڕکێت لەسەر نەخشە
          </button>
          
          <div class="mkt-map-coords-badge" id="mkt-f-coords-badge">
            <span>پۆوتانی دیاریکراو:</span>
            <strong id="mkt-f-coords-val">
              ${selectedLat && selectedLon ? `${selectedLat}, ${selectedLon}` : 'دیاری نەکراوە'}
            </strong>
          </div>
        </div>

      </form>
    `;

    // یازدە ژمارە تەنها بۆ تەلەفۆن
    const phoneInput = modalBody.querySelector('#mkt-f-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        phoneInput.value = UI.toLatinDigits(phoneInput.value).replace(/\D/g, '').slice(0, 11);
      });
    }

    // کلیک لە دوگمەی نیشانکردنی ماڕکێت
    const openMapBtn = modalBody.querySelector('#mkt-f-open-map-btn');
    if (openMapBtn) {
      openMapBtn.addEventListener('click', () => {
        openMapPickerModal({
          initialLat: selectedLat,
          initialLon: selectedLon,
          onSelect: (lat, lon) => {
            selectedLat = lat;
            selectedLon = lon;
            const badgeVal = modalBody.querySelector('#mkt-f-coords-val');
            if (badgeVal) badgeVal.textContent = `${lat}, ${lon}`;
          }
        });
      });
    }

    const { close } = UI.openModal({
      title: isEdit ? '✏️ دەستکاریکردنی ماڕکێت' : '🏪 زیادکردنی ماڕکێتی نوێ',
      body: modalBody,
      wide: true,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'پاشەکەوت',
          className: 'btn-primary',
          onClick: async () => {
            const rawCode = isEdit ? currentCode : modalBody.querySelector('#mkt-f-code').value.trim();
            const account_code = UI.toLatinDigits(rawCode).replace(/\D/g, '');
            const account_name = modalBody.querySelector('#mkt-f-name').value.trim();
            const neighborhood = modalBody.querySelector('#mkt-f-nh').value.trim() || null;
            const phone = UI.toLatinDigits(modalBody.querySelector('#mkt-f-phone').value.trim()) || null;

            if (!account_code) {
              modalBody.querySelector('#mkt-f-code').focus();
              return;
            }

            if (!account_name) {
              modalBody.querySelector('#mkt-f-name').focus();
              return;
            }

            // پشکنینی کۆدی دووبارە تەنها لە کاتی زیادکردنی نوێدا
            if (!isEdit) {
              try {
                if (typeof API !== 'undefined' && API.Markets && API.Markets.search) {
                  const existing = await API.Markets.search(account_code);
                  const isDup = (existing || []).some(m => {
                    const codeDigits = UI.toLatinDigits(m.account_code || '').replace(/\D/g, '');
                    return codeDigits === account_code;
                  }) || state.localMarkets.has(account_code);

                  if (isDup) {
                    modalBody.querySelector('#mkt-f-code').focus();
                    return;
                  }
                }
              } catch (_) {}
            }

            // پشکنینی زۆنی نوێ و تۆمارکردنی لە سەب بەیس
            if (neighborhood) {
              const isOld = allZones.some(z => UI.norm(z) === UI.norm(neighborhood));
              if (!isOld) {
                try {
                  await API.Lists.insertZone({ name: neighborhood });
                  Store.invalidateLists();
                } catch (e) {
                  console.warn('Could not insert new zone:', e);
                }
              }
            }

            const payload = {
              account_code,
              account_name,
              neighborhood,
              latitude: Number.isFinite(selectedLat) ? selectedLat : null,
              longitude: Number.isFinite(selectedLon) ? selectedLon : null,
              phone
            };

            try {
              if (isEdit) {
                try {
                  await API.Markets.update(account_code, payload);
                } catch (e) {
                  console.warn('API update failed, updating locally:', e);
                }
                state.localMarkets.set(account_code, payload);
                const idx = state.searchResults.findIndex(m => String(m.account_code) === String(account_code));
                if (idx !== -1) state.searchResults[idx] = payload;
              } else {
                try {
                  await API.Markets.insert(payload);
                } catch (e) {
                  console.warn('API insert failed, saving locally:', e);
                }
                state.localMarkets.set(account_code, payload);
                state.search = account_code;
                const pageSearch = $('#mkt-page-search', container);
                if (pageSearch) pageSearch.value = account_code;
                state.hasSearched = true;
                state.searchResults = [payload];
              }

              close();
              updateListDisplay();
            } catch (err) {
              console.error('هەڵە لە پاشەکەوتکردن:', err);
            }
          }
        }
      ]
    });
  }

  /* ---------------- سڕینەوەی ماڕکێت ---------------- */

  async function confirmDeleteMarket(accountCode) {
    const market = state.searchResults.find(m => String(m.account_code) === String(accountCode)) ||
                   state.localMarkets.get(accountCode);
    const label = market ? `${market.account_name} (#${accountCode})` : `#${accountCode}`;

    const ok = await UI.confirmDialog(`ئایا دڵنیایت لە سڕینەوەی ماڕکێتی «${label}» لە سیستەم و سەب بەیس؟`, {
      danger: true,
      okLabel: 'بەڵێ، بیسڕەوە',
      cancelLabel: 'پاشگەزبوونەوە'
    });

    if (!ok) return;

    try {
      try {
        await API.Markets.delete(accountCode);
      } catch (e) {
        console.warn('API delete failed, removing locally:', e);
      }

      state.localMarkets.delete(accountCode);
      state.searchResults = state.searchResults.filter(m => String(m.account_code) !== String(accountCode));
      updateListDisplay();
    } catch (err) {
      console.error('هەڵە لە سڕینەوە:', err);
    }
  }

  /* ---------------- دەسەڵاتی سڕینەوە بەپێی ڕۆڵی بەکارهێنەر ---------------- */

  function canDeleteMarket() {
    const u = (typeof App !== 'undefined' && App && App.getUser) ? App.getUser() : (Store.getSession()?.user || null);
    if (!u) return false;
    const prof = String(u.profession || '').trim();
    // لە یوسەری سایەق و دابەشکار و مەندووب تەنها دووگمەی دەستکاری داتا پشان بداتن سڕینەوە پشان نەداتن
    if (
      prof === (typeof CONFIG !== 'undefined' && CONFIG.PROFESSION_DRIVER) ||
      prof === (typeof CONFIG !== 'undefined' && CONFIG.PROFESSION_DISTRIBUTOR) ||
      prof === (typeof CONFIG !== 'undefined' && CONFIG.PROFESSION_DELEGATE) ||
      prof === 'سایەق' ||
      prof === 'دابەشکار' ||
      prof === 'مەندوب' ||
      prof === 'مەندووب'
    ) {
      return false;
    }
    return true;
  }

  /* ---------------- کردنەوەی لۆکەیشنی ماڕکێت لە ئەپەکانی نەخشە (Maps.me / Google Maps / Geo) ---------------- */

  /* ---------------- کردنەوەی لۆکەیشنی ماڕکێت لە ئەپەکانی نەخشە (Google Maps / Geo) ---------------- */

  function openLocationApp(market) {
    if (!market) return;
    const lat = market.latitude !== null && market.latitude !== undefined ? parseFloat(market.latitude) : null;
    const lon = market.longitude !== null && market.longitude !== undefined ? parseFloat(market.longitude) : null;
    const name = String(market.account_name || 'ماڕکێت').trim();
    const code = String(market.account_code || '').trim();
    const label = code ? `${name} (#${code})` : name;

    // ئەگەر لۆکەیشن تۆمار نەکرابێت — ڕاستەوخۆ فۆڕمی دەستکاری بکاتەوە بەبێ پرسیار
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      openAddEditModal(market);
      return;
    }

    // پرفەرەنسی پێشتر هەڵبژێردراو — ڕاستەوخۆ بچە بەبێ هیچ مەسج یان مۆداڵ
    let savedPref = null;
    try {
      savedPref = localStorage.getItem('dlv_preferred_map_app');
      if (savedPref === 'mapsme') {
        localStorage.removeItem('dlv_preferred_map_app');
        savedPref = null;
      }
    } catch (_) {}

    if (savedPref === 'google') {
      launchGoogleMaps(lat, lon);
      return;
    } else if (savedPref === 'geo') {
      launchGeo(lat, lon, label);
      return;
    }

    // هیچ پرفەرەنسێک نییە — پیشاندانی مۆداڵی هەڵبژاردن
    showMapChooserModal(market, lat, lon, label);
  }

  function launchGoogleMaps(lat, lon) {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    window.open(url, '_blank');
  }

  function launchGeo(lat, lon, label) {
    const url = `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(label)})`;
    window.location.href = url;
  }

  function showMapChooserModal(market, lat, lon, label) {
    const modalBody = document.createElement('div');
    modalBody.innerHTML = `
      <div style="text-align: right; direction: rtl;">
        <div style="background: var(--surface-2); padding: 12px 14px; border-radius: 10px; margin-bottom: 14px; border: 1px solid var(--border);">
          <div style="font-weight: 800; font-size: 1.05rem; color: var(--accent);">${UI.esc(label)}</div>
          <div style="font-size: 0.82rem; color: var(--muted); margin-top: 4px; direction: ltr; font-family: monospace;">
            📍 پۆوتان: ${lat}, ${lon}
          </div>
        </div>

        <div style="font-size: 0.9rem; font-weight: 700; color: var(--text); margin-bottom: 8px;">
          ئەپێک هەڵبژێرە بۆ کردنەوەی شوێنەکە لەسەر نەخشە:
        </div>

        <div class="mkt-map-chooser-list">
          <!-- دوگمەی Google Maps -->
          <button type="button" class="mkt-map-app-btn google" id="mkt-btn-app-google">
            <div class="mkt-map-app-icon">📍</div>
            <div class="mkt-map-app-details">
              <span class="mkt-map-app-title">ئەپی Google Maps</span>
              <span class="mkt-map-app-sub">نەخشەی گوگڵ (لە هەموو مۆبایل و کۆمپیوتەرێک کاردەکات)</span>
            </div>
            <span>➜</span>
          </button>

          <!-- دوگمەی هەموو ئەپەکان -->
          <button type="button" class="mkt-map-app-btn geo" id="mkt-btn-app-geo">
            <div class="mkt-map-app-icon">🧭</div>
            <div class="mkt-map-app-details">
              <span class="mkt-map-app-title">هەموو ئەپەکانی مۆبایل (Geo Navigation)</span>
              <span class="mkt-map-app-sub">سیستەمی مۆبایل دەپرسێت بە کام ئەپ دەیکەیتەوە</span>
            </div>
            <span>➜</span>
          </button>
        </div>

        <!-- هەڵبژاردنی هەمیشەیی -->
        <label style="display: flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 0.85rem; color: var(--muted); cursor: pointer;">
          <input type="checkbox" id="mkt-save-pref-app" style="width: 16px; height: 16px; accent-color: var(--accent);">
          <span>ئەم ئەپە بە بنەڕەتی دابنێ بۆ جارەکانی داهاتوو</span>
        </label>
      </div>
    `;

    const { close } = UI.openModal({
      title: '🗺️ کردنەوەی شوێنی ماڕکێت',
      body: modalBody,
      actions: [
        { label: 'داخستن', className: 'btn-ghost', onClick: () => close() }
      ]
    });

    const chk = modalBody.querySelector('#mkt-save-pref-app');

    modalBody.querySelector('#mkt-btn-app-google')?.addEventListener('click', () => {
      try {
        if (chk && chk.checked) localStorage.setItem('dlv_preferred_map_app', 'google');
      } catch (_) {}
      close();
      launchGoogleMaps(lat, lon);
    });

    modalBody.querySelector('#mkt-btn-app-geo')?.addEventListener('click', () => {
      try {
        if (chk && chk.checked) localStorage.setItem('dlv_preferred_map_app', 'geo');
      } catch (_) {}
      close();
      launchGeo(lat, lon, label);
    });
  }


  /* =========================================================
   *  ڕێندەری ڕووکاری فۆڕمەکە (Main Page Layout)
   * ========================================================= */

  function render(el) {
    container = el;
    state.search = '';
    state.searchResults = [];
    state.hasSearched = false;
    state.searching = false;
    renderLayout();
  }

  function renderLayout() {
    if (!container) return;

    container.innerHTML = `
      <div class="markets-view mkt-custom-page" style="max-width: 960px; margin: 0 auto; padding: 0 14px 20px;">

        <!-- خانەی گەڕان لکێندراوە بە باڕی سەرەوە بەبێ تێکست و دوگمە زیادەکان -->
        <div class="mkt-top-search-strip">
          <div class="mkt-search-input-wrap">
            <span class="mkt-input-search-ico">${UI.icon('search', 18)}</span>
            <input type="text" id="mkt-page-search" class="mkt-code-search-input"
                   placeholder="گەڕان بەپێی کۆدی ماڕکێت یان ناوی ماڕکێت..."
                   value="${UI.esc(state.search)}" autocomplete="off" autofocus>
            <button type="button" class="mkt-clear-search-btn" id="mkt-page-search-clear" style="display: ${state.search ? 'flex' : 'none'};" title="پاککردنەوە">✕</button>
          </div>
        </div>

        <!-- لیستی ماڕکێتەکان لەسەر پەڕەکە -->
        <div class="mkt-list-container" id="mkt-page-list-container">
          ${renderPageListHtml(state.searchResults)}
        </div>

        <!-- دوگمەی سەربەخۆی کامێرا بۆ سکان و دروستکردنی فایلی ماپ (KMZ) بەبێ هیچ ویندۆیەکی دەوروبەر -->
        <button type="button" class="mkt-bbar-camera-btn" id="mkt-open-camera-btn" title="کامێرا و دروستکردنی فایلی ماپ">
          <span class="mkt-bbar-cam-ico">${UI.icon('camera', 26)}</span>
          <span class="mkt-bbar-cam-badge" id="mkt-bbar-badge" style="display: ${state.activeGroup && state.activeGroup.length ? 'inline-flex' : 'none'};">
            ${(state.activeGroup || []).length}
          </span>
        </button>

      </div>
    `;

    bindPageEvents();
  }

  /* ---------------- ڕێندەری لیستی سەر پەڕەکە ---------------- */

  function renderPageListHtml(list) {
    // ئەگەر بەکارهێنەر هێشتا گەڕانی نەکردووە (بۆ کردنەوەی دەستبەجێ بەبێ هێنانی هەموو ماڕکێتەکان)
    if (!state.hasSearched || !state.search.trim()) {
      return `
        <div class="card mkt-search-prompt-card">
          <div class="mkt-search-prompt-icon">🔍</div>
          <h3 class="mkt-search-prompt-title">گەڕان بۆ ماڕکێتەکان</h3>
          <p class="mkt-search-prompt-desc">
            تکایە لە خانەی سەرەوە کۆدی ماڕکێت یان ناوی ماڕکێت بنووسە بۆ بینین و دەستکاریکردنی ماڕکێتەکە.
          </p>
        </div>
      `;
    }

    // ئەگەر لە کاتی گەڕاندایە لە سەب بەیس
    if (state.searching) {
      return `
        <div class="card mkt-search-loading-card">
          <div class="mkt-search-spinner"></div>
          <div style="font-weight: 700; color: var(--accent); font-size: 0.95rem;">دەگەڕێت لە سەب بەیس...</div>
        </div>
      `;
    }

    // ئەگەر گەڕان کرا بەڵام هیچ ماڕکێتێک نەدۆزرایەوە
    if (!list || !list.length) {
      return `
        <div class="card" style="padding: 34px 20px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 8px;">❌</div>
          <div style="font-weight: 800; font-size: 1.05rem;">هیچ ماڕکێتێک بەم ناونیشانە نەدۆزرایەوە</div>
          <p style="font-size: 0.88rem; color: var(--muted); margin: 6px 0 14px;">
            هیچ ماڕکێتێک بە کۆد یان ناوی «${UI.esc(state.search)}» نەدۆزرایەوە.
          </p>
          <button type="button" class="btn btn-ghost btn-sm" id="mkt-page-clear-search-link">
            پاککردنەوەی گەڕان
          </button>
        </div>
      `;
    }

    const canDel = canDeleteMarket();

    return `
      <div class="mkt-rows-list" style="display: flex; flex-direction: column; gap: 10px;">
        ${list.map(m => {
          const code = String(m.account_code || '');
          const name = String(m.account_name || 'ماڕکێت');
          const nh = m.neighborhood ? String(m.neighborhood).trim() : '';
          const phone = m.phone ? String(m.phone).trim() : '';
          const hasLoc = m.latitude !== null && m.latitude !== undefined &&
                         m.longitude !== null && m.longitude !== undefined;

          return `
            <div class="mkt-swipe-item" data-code="${UI.esc(code)}">
              
              <!-- دوگمەکانی لای ڕاست (کاتێک ویندۆکە بۆ لای چەپ ڕادەکێشرێت دەردەکەون) -->
              <div class="mkt-swipe-actions mkt-swipe-actions-right">
                <button type="button" class="mkt-action-btn mkt-btn-edit" data-action="edit-mkt" data-code="${UI.esc(code)}" title="دەستکاری تۆمار" aria-label="دەستکاری تۆمار">
                  ${UI.icon('edit', 22)}
                </button>
                ${canDel ? `
                  <button type="button" class="mkt-action-btn mkt-btn-delete" data-action="del-mkt" data-code="${UI.esc(code)}" title="سڕینەوە" aria-label="سڕینەوە">
                    ${UI.icon('trash', 22)}
                  </button>
                ` : ''}
              </div>

              <!-- دوگمەکانی لای چەپ (کاتێک ویندۆکە بۆ لای ڕاست ڕادەکێشرێت دەردەکەون) -->
              <div class="mkt-swipe-actions mkt-swipe-actions-left">
                <button type="button" class="mkt-action-btn mkt-btn-edit" data-action="edit-mkt" data-code="${UI.esc(code)}" title="دەستکاری تۆمار" aria-label="دەستکاری تۆمار">
                  ${UI.icon('edit', 22)}
                </button>
                ${canDel ? `
                  <button type="button" class="mkt-action-btn mkt-btn-delete" data-action="del-mkt" data-code="${UI.esc(code)}" title="سڕینەوە" aria-label="سڕینەوە">
                    ${UI.icon('trash', 22)}
                  </button>
                ` : ''}
              </div>

              <!-- ویندۆی پێشەوەی ماڕکێت — ڕاکێشان بۆ چەپ و ڕاست -->
              <div class="mkt-card-front" data-code="${UI.esc(code)}" title="ڕاکێشان بۆ دەستکاری یان سڕینەوە">

                <!-- ناوەرۆکی سەرەکی ماڕکێت -->
                <div class="mkt-card-body">

                  <!-- دێڕی یەکەم: #کۆدی ماڕکێت تەنیشتی ناوی ماڕکێت -->
                  <div class="mkt-card-row-top">
                    <span class="mkt-card-code">#${UI.esc(code)}</span>
                    <span class="mkt-card-name">${UI.esc(name)}</span>
                  </div>

                  <!-- دێڕی دووەم: زۆن پاشان ژمارە تەلەفۆن -->
                  <div class="mkt-card-row-sub">
                    <span class="mkt-card-zone">📍 ${UI.esc(nh || 'زۆن دیاری نەکراوە')}</span>
                    ${phone ? `
                      <span class="mkt-card-dot">•</span>
                      <a href="tel:${UI.esc(phone)}" class="mkt-card-phone" title="پەیوەندیکردن">📞 ${UI.esc(phone)}</a>
                    ` : ''}
                  </div>

                </div>

                <!-- ستریپی نەخشە — لای ڕاستی کارتەکە، پڕ بە بەرزی -->
                <button type="button"
                  class="mkt-card-map-strip ${hasLoc ? 'has-loc' : 'no-loc'}"
                  data-action="open-map"
                  title="${hasLoc ? 'کردنەوەی شوێن لەسەر نەخشە' : 'دیاریکردنی شوێن لەسەر نەخشە'}">
                  <span class="mkt-map-strip-icon">${hasLoc ? '📍' : '🚫'}</span>
                </button>

              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ---------------- گرێدانی ئیڤێنتەکانی سەر پەڕەکە ---------------- */

  let searchDebounceTimer = null;

  function bindPageEvents() {
    if (!container) return;

    // گەڕانی سەر پەڕە
    const pageSearch = $('#mkt-page-search', container);
    if (pageSearch) {
      pageSearch.addEventListener('input', e => {
        const val = e.target.value;
        const clrBtn = $('#mkt-page-search-clear', container);
        if (clrBtn) clrBtn.style.display = val.trim() ? 'flex' : 'none';

        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

        if (!val.trim()) {
          state.search = '';
          state.hasSearched = false;
          state.searching = false;
          state.searchResults = [];
          updateListDisplay();
          return;
        }

        searchDebounceTimer = setTimeout(() => {
          performSearch(val);
        }, 220);
      });

      pageSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
          performSearch(pageSearch.value);
        }
      });
    }

    const clearPageSearch = $('#mkt-page-search-clear', container);
    if (clearPageSearch) {
      clearPageSearch.addEventListener('click', () => {
        if (pageSearch) pageSearch.value = '';
        clearPageSearch.style.display = 'none';
        state.search = '';
        state.hasSearched = false;
        state.searching = false;
        state.searchResults = [];
        updateListDisplay();
        if (pageSearch) pageSearch.focus();
      });
    }



    // جێگیرکردنی خانەی گەڕان لەژێر باڕی سەرەوە بۆ ئەوەی لە کاتی سکڕۆڵ نەچێتە سەرەوە یان خوارەوە
    const topbar = (typeof document !== 'undefined' && typeof document.querySelector === 'function') ? document.querySelector('.topbar') : null;
    const searchStrip = container && typeof container.querySelector === 'function' ? container.querySelector('.mkt-top-search-strip') : null;
    const syncSearchTop = () => {
      if (searchStrip) {
        const h = (topbar && topbar.offsetHeight) ? topbar.offsetHeight : 52;
        searchStrip.style.top = `${h}px`;
      }
    };
    syncSearchTop();
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', syncSearchTop, { passive: true });
    }

    // دوگمەی کامێرا لەسەر باڕی خوارەوە
    const camBtn = $('#mkt-open-camera-btn', container);
    if (camBtn) {
      camBtn.addEventListener('click', () => openCameraModal());
    }

    const listEl = $('#mkt-page-list-container', container);
    if (listEl) bindPageListActions(listEl);
  }

  let activeOpenCard = null;

  function closeActiveCard() {
    if (activeOpenCard) {
      activeOpenCard.style.transform = '';
      activeOpenCard.classList.remove('is-open');
      delete activeOpenCard.dataset.offset;
      activeOpenCard = null;
    }
  }

  function bindPageListActions(root) {
    if (!root) return;

    // لینکی پاککردنەوەی گەڕان
    const clearLink = root.querySelector('#mkt-page-clear-search-link');
    if (clearLink) {
      clearLink.addEventListener('click', () => {
        const pageSearch = $('#mkt-page-search', container);
        if (pageSearch) pageSearch.value = '';
        state.search = '';
        state.hasSearched = false;
        state.searching = false;
        state.searchResults = [];
        updateListDisplay();
        if (pageSearch) pageSearch.focus();
      });
    }

    // دەستکاری تۆمار
    root.querySelectorAll('[data-action="edit-mkt"]').forEach(btn => {
      const handler = e => {
        e.stopPropagation();
        closeActiveCard();
        const code = btn.getAttribute('data-code');
        const market = state.searchResults.find(m => String(m.account_code) === String(code)) ||
                       state.localMarkets.get(code);
        if (market) openAddEditModal(market);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('pointerdown', e => e.stopPropagation());
    });

    // سڕینەوە
    root.querySelectorAll('[data-action="del-mkt"]').forEach(btn => {
      const handler = e => {
        e.stopPropagation();
        closeActiveCard();
        const code = btn.getAttribute('data-code');
        confirmDeleteMarket(code);
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('pointerdown', e => e.stopPropagation());
    });

    // بەڕێوەبردنی ڕاکێشان (Swipe) و داگرتنی ویندۆ بۆ ئەپەکانی نەخشە
    root.querySelectorAll('.mkt-swipe-item').forEach(item => {
      const front = item.querySelector('.mkt-card-front');
      const code = item.getAttribute('data-code');
      const market = state.searchResults.find(m => String(m.account_code) === String(code)) ||
                     state.localMarkets.get(code);
      if (!front) return;

      let startX = 0;
      let startY = 0;
      let startTime = 0;
      let isDragging = false;
      let isHorizontal = false;
      let isVertical = false;
      let initialOffset = 0;
      let pointerId = null;
      let movedDistance = 0;

      // پانی دوگمەکان: بۆ سایەق/دابەشکار/مەندوب 1 ئایکۆنە (60px)، بۆ بەڕێوەبەر 2 ئایکۆنە (120px)
      const maxReveal = canDeleteMarket() ? 120 : 60;

      const onPointerDown = e => {
        // پەیوەندی تەلەفۆن ڕێگری لێناکرێت
        if (e.target.closest('a[href^="tel:"], .mkt-card-phone')) return;

        // ئەگەر ویندۆیەکی تر کراوە بێت، دایبخە
        if (activeOpenCard && activeOpenCard !== front) {
          closeActiveCard();
        }

        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startTime = Date.now();
        isDragging = false;
        isHorizontal = false;
        isVertical = false;
        movedDistance = 0;
        initialOffset = front.dataset.offset ? parseFloat(front.dataset.offset) : 0;

        try {
          front.setPointerCapture(pointerId);
        } catch (_) {}

        item.classList.add('is-dragging');

        const moveHandler = ev => onPointerMove(ev);
        const upHandler = ev => {
          onPointerUp(ev);
          front.removeEventListener('pointermove', moveHandler);
          front.removeEventListener('pointerup', upHandler);
          front.removeEventListener('pointercancel', upHandler);
          window.removeEventListener('pointermove', moveHandler);
          window.removeEventListener('pointerup', upHandler);
          window.removeEventListener('pointercancel', upHandler);
        };

        front.addEventListener('pointermove', moveHandler, { passive: false });
        front.addEventListener('pointerup', upHandler);
        front.addEventListener('pointercancel', upHandler);
        window.addEventListener('pointermove', moveHandler, { passive: false });
        window.addEventListener('pointerup', upHandler);
        window.addEventListener('pointercancel', upHandler);
      };

      const onPointerMove = e => {
        if (isVertical) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        movedDistance = Math.hypot(dx, dy);

        if (!isHorizontal && !isVertical) {
          // ئەگەر بە ڕوونی ئاسۆیی بێت و زیاتر لە 12 پیکسڵ جوڵابێت
          if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            isHorizontal = true;
          } else if (Math.abs(dy) > 10) {
            // جوڵەی ستوونی (Scroll) پەڕەکە تێک نەدرێت
            isVertical = true;
            item.classList.remove('is-dragging');
            if (pointerId !== null) {
              try { front.releasePointerCapture(pointerId); } catch (_) {}
              pointerId = null;
            }
            return;
          }
        }

        if (isHorizontal) {
          if (e.cancelable) e.preventDefault();
          isDragging = true;

          let targetX = initialOffset + dx;

          // سنوردارکردن لە چەپ و ڕاست
          if (targetX < -(maxReveal + 25)) targetX = -(maxReveal + 25);
          if (targetX > (maxReveal + 25)) targetX = (maxReveal + 25);

          front.style.transform = `translateX(${targetX}px)`;
        }
      };

      const onPointerUp = e => {
        item.classList.remove('is-dragging');
        if (pointerId !== null) {
          try { front.releasePointerCapture(pointerId); } catch (_) {}
          pointerId = null;
        }

        const totalDx = e.clientX - startX;
        const elapsed = Date.now() - startTime;

        if (isDragging) {
          const finalX = initialOffset + totalDx;
          const threshold = maxReveal * 0.28;

          // کاتێک بۆ لای چەپ دەبرێت
          if (finalX < -threshold) {
            front.style.transform = `translateX(-${maxReveal}px)`;
            front.dataset.offset = -maxReveal;
            front.classList.add('is-open');
            activeOpenCard = front;
          }
          // کاتێک بۆ لای ڕاست دەبرێت
          else if (finalX > threshold) {
            front.style.transform = `translateX(${maxReveal}px)`;
            front.dataset.offset = maxReveal;
            front.classList.add('is-open');
            activeOpenCard = front;
          }
          // ئەگەر کەم ڕاکێشرابێت، دەگەڕێتەوە شوێنی سەرەتایی
          else {
            front.style.transform = '';
            delete front.dataset.offset;
            front.classList.remove('is-open');
            if (activeOpenCard === front) activeOpenCard = null;
          }
        } else if (!isVertical && movedDistance < 14 && elapsed < 650) {
          // داگرتنی ئاسایی (Tap) — تەنها کارتی کراوە دادەخات
          if (front.classList.contains('is-open')) {
            front.style.transform = '';
            delete front.dataset.offset;
            front.classList.remove('is-open');
            activeOpenCard = null;
          }
        }
      };

      front.addEventListener('pointerdown', onPointerDown);
    });

    // دوگمەی 📍 نەخشە / بێ GPS — تەنها ئەمانە دەچنەوە ناو نەخشە
    root.querySelectorAll('[data-action="open-map"]').forEach(btn => {
      // ڕێگری لە دەستپێکردنی swipe لەلایەن دوگمەی نەخشە
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation();
      });
      btn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        closeActiveCard();
        const swipeItem = btn.closest('.mkt-swipe-item');
        const mCode = swipeItem ? swipeItem.getAttribute('data-code') : null;
        const mkt = (state.searchResults || []).find(m => String(m.account_code) === String(mCode)) ||
                    (state.localMarkets ? state.localMarkets.get(mCode) : null);
        if (mkt) openLocationApp(mkt);
      });
    });

    // ڕێگری لە swipe کاتێک پەیوەندی بە ژمارە تەلەفۆن دەکرێت
    root.querySelectorAll('.mkt-card-phone').forEach(el => {
      el.addEventListener('pointerdown', e => e.stopPropagation());
    });

    // داگرتن لە هەر شوێنێکی تر کارتی کراوە دابخات
    document.addEventListener('pointerdown', e => {
      if (!e.target.closest('.mkt-swipe-item')) {
        closeActiveCard();
      }
    }, { passive: true });
  }

  /* ---------------- نوێکردنەوەی باجی دوگمەی کامێرا ---------------- */

  function updateBottomBarBadge() {
    const badge = $('#mkt-bbar-badge', container);
    if (badge) {
      const len = (state.activeGroup || []).length;
      badge.textContent = String(len);
      badge.style.display = len > 0 ? 'inline-flex' : 'none';
    }
  }

  /* ---------------- فۆرماتی KML و دروستکردنی فایلی KMZ (هاوشێوەی allmarket.kmz) ---------------- */

  function crc32Table() {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[n] = c;
    }
    return table;
  }
  const CRC_TABLE = crc32Table();

  function computeCrc32(bytes) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function createKmzBlob(kmlString) {
    const encoder = new TextEncoder();
    const data = encoder.encode(kmlString);
    const fn = encoder.encode('mapsme.kml');
    const crc = computeCrc32(data);
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    // Local file header (30 bytes + filename)
    const loc = new Uint8Array(30 + fn.length);
    const locView = new DataView(loc.buffer);
    locView.setUint32(0, 0x04034b50, true);
    locView.setUint16(4, 20, true);
    locView.setUint16(6, 0, true);
    locView.setUint16(8, 0, true); // store
    locView.setUint16(10, dosTime, true);
    locView.setUint16(12, dosDate, true);
    locView.setUint32(14, crc, true);
    locView.setUint32(18, data.length, true);
    locView.setUint32(22, data.length, true);
    locView.setUint16(26, fn.length, true);
    locView.setUint16(28, 0, true);
    loc.set(fn, 30);

    // Central directory header (46 bytes + filename)
    const cen = new Uint8Array(46 + fn.length);
    const cenView = new DataView(cen.buffer);
    cenView.setUint32(0, 0x02014b50, true);
    cenView.setUint16(4, 20, true);
    cenView.setUint16(6, 20, true);
    cenView.setUint16(8, 0, true);
    cenView.setUint16(10, 0, true);
    cenView.setUint16(12, dosTime, true);
    cenView.setUint16(14, dosDate, true);
    cenView.setUint32(16, crc, true);
    cenView.setUint32(20, data.length, true);
    cenView.setUint32(24, data.length, true);
    cenView.setUint16(28, fn.length, true);
    cenView.setUint16(30, 0, true);
    cenView.setUint16(32, 0, true);
    cenView.setUint16(34, 0, true);
    cenView.setUint16(36, 0, true);
    cenView.setUint32(38, 0, true);
    cenView.setUint32(42, 0, true);
    cen.set(fn, 46);

    // End of central directory record (22 bytes)
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, 1, true);
    endView.setUint16(10, 1, true);
    endView.setUint32(12, cen.length, true);
    endView.setUint32(16, loc.length + data.length, true);
    endView.setUint16(20, 0, true);

    return new Blob([loc, data, cen, end], { type: 'application/vnd.google-earth.kmz' });
  }

  function generateMapsMeKml(markets, title = 'ماڕکێتەکان') {
    const isoDate = new Date().toISOString();
    const docUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : '5490db64-6610-43a3-811c-00adff6951a6';

    const placemarks = (markets || []).map((m, idx) => {
      const code = UI.esc(m.account_code || '');
      const name = UI.esc(m.account_name || 'ماڕکێت');
      const zone = UI.esc(m.neighborhood || m.zone || '—');
      const phone = UI.esc(m.phone || '—');
      const lat = Number(m.latitude);
      const lng = Number(m.longitude);
      const pmUuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mkt-${idx}-${code}`;
      const stopNum = idx + 1;

      return `
  <Placemark>
    <name>${stopNum}. [${code}] ${name}</name>
    <TimeStamp><when>${isoDate}</when></TimeStamp>
    <styleUrl>#placemark-red</styleUrl>
    <Point><coordinates>${lng},${lat}</coordinates></Point>
    <description><![CDATA[ڕیزبەندی: ${stopNum}<br>کۆدی ئەکاونت: ${code}<br>ناوی ماڕکێت: ${name}<br>زۆن: ${zone}<br>تەلەفۆن: ${phone}]]></description>
    <ExtendedData xmlns:mwm="https://maps.me">
      <mwm:name>${stopNum}. ${name}</mwm:name>
      <mwm:customName>${stopNum}. [${code}] ${name}</mwm:customName>
      <mwm:scale>18</mwm:scale>
      <mwm:visibility>1</mwm:visibility>
      <mwm:lastModified>${isoDate}</mwm:lastModified>
      <mwm:isDeleted>0</mwm:isDeleted>
      <mwm:uniqueId>${pmUuid}</mwm:uniqueId>
    </ExtendedData>
  </Placemark>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.2">
<Document>
  <Style id="placemark-red">
    <IconStyle>
      <Icon>
        <href>http://maps.me/placemarks/placemark-red.png</href>
      </Icon>
    </IconStyle>
  </Style>
  <Style id="placemark-blue">
    <IconStyle>
      <Icon>
        <href>http://maps.me/placemarks/placemark-blue.png</href>
      </Icon>
    </IconStyle>
  </Style>
  <Style id="placemark-purple">
    <IconStyle>
      <Icon>
        <href>http://maps.me/placemarks/placemark-purple.png</href>
      </Icon>
    </IconStyle>
  </Style>
  <Style id="placemark-yellow">
    <IconStyle>
      <Icon>
        <href>http://maps.me/placemarks/placemark-yellow.png</href>
      </Icon>
    </IconStyle>
  </Style>
  <Style id="placemark-green">
    <IconStyle>
      <Icon>
        <href>http://maps.me/placemarks/placemark-green.png</href>
      </Icon>
    </IconStyle>
  </Style>
  <name>${UI.esc(title)}</name>
  <visibility>1</visibility>
  <ExtendedData xmlns:mwm="https://maps.me">
    <mwm:lastModified>${isoDate}</mwm:lastModified>
    <mwm:isDeleted>0</mwm:isDeleted>
    <mwm:uniqueId>${docUuid}</mwm:uniqueId>
  </ExtendedData>
  ${placemarks}
</Document>
</kml>`;
  }

  async function sendGroupToMapsMe(marketsGroup) {
    const valid = (marketsGroup || []).filter(m => m.latitude !== null && m.latitude !== undefined &&
                                                  m.longitude !== null && m.longitude !== undefined &&
                                                  !isNaN(Number(m.latitude)) && !isNaN(Number(m.longitude)));

    if (!valid.length) {
      UI.toast('هیچ کام لە ماڕکێتە دیاریکراوەکان لۆکەیشنی GPS یان نییە بۆ ناردن بۆ ماپ', 'warning', 4000);
      return;
    }

    const title = `ماڕکێتەکان_${UI.todayStr()}`;
    const kmlText = generateMapsMeKml(valid, title);
    const kmzBlob = createKmzBlob(kmlText);
    const filename = `${title}.kmz`;
    const file = new File([kmzBlob], filename, { type: 'application/vnd.google-earth.kmz' });

    let shared = false;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: title,
          text: 'فایلی ماڕکێتەکان بۆ بەرنامەی ماپ'
        });
        shared = true;
        UI.toast('فایلی ماڕکێتەکان (KMZ) بە سەرکەوتوویی بۆ بەرنامەی ماپ نێردرا ✓', 'success', 3500);
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Share error:', err);
      }
    }

    if (!shared) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(kmzBlob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 1500);
      UI.toast('فایلی KMZ دابەزێنرا — لە مۆبایل یان کۆمپیوتەر کلیکی لێبکە تا لە ماپسمی بکرێتەوە ✓', 'success', 4500);
    }
  }

  /* =========================================================
   *  بەشی کامێرا و دروستکردنی فایلی ماپ (KMZ) بە سکانی لۆکاڵ (بێ AI)
   * ========================================================= */

  function rotateImageFile(file, degrees = 90) {
    return new Promise((resolve) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (degrees === 90 || degrees === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const rotatedFile = new File([blob], file.name || 'rotated.jpg', { type: 'image/jpeg' });
          resolve(rotatedFile);
        }, 'image/jpeg', 0.92);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(file);
      };
      img.src = objUrl;
    });
  }

  function prepareImageForOcr(file, maxWidth = 1800) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        let w = img.width;
        let h = img.height;
        if (w > maxWidth || h > maxWidth) {
          if (w > h) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          } else {
            w = Math.round((w * maxWidth) / h);
            h = maxWidth;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // ڕوونکردنەوەی وێنە و زیادکردنی کۆنتراست بۆ دیاربوونی ژمارەکان
        try {
          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const c = (gray - 128) * 1.45 + 128;
            const v = c < 0 ? 0 : (c > 255 ? 255 : c);
            d[i] = v;
            d[i + 1] = v;
            d[i + 2] = v;
          }
          ctx.putImageData(imgData, 0, 0);
        } catch (_) {}

        resolve(canvas);
      };
      img.onerror = reject;
      img.src = objUrl;
    });
  }

  let _tesseractWorker = null;

  async function getOcrWorker(onProgress) {
    if (_tesseractWorker) return _tesseractWorker;
    if (typeof Tesseract === 'undefined') {
      throw new Error('سیستەمی سکانی OCR بەردەست نییە؛ تکایە لاپەڕەکە نوێ (Refresh) بکەرەوە');
    }

    const logHandler = m => {
      if (onProgress && m && m.status) {
        const pct = Math.round((m.progress || 0) * 100);
        if (m.status.includes('recogniz')) {
          onProgress(`شیکردنەوەی خشتە و ژمارەکان... ${pct}%`);
        } else if (m.status.includes('load') || m.status.includes('init')) {
          onProgress(`ئامادەکردنی مۆدێلی سکان... ${pct}%`);
        } else {
          onProgress(m.status);
        }
      }
    };

    try {
      _tesseractWorker = await Tesseract.createWorker('eng', 1, {
        workerPath: 'tesseract-worker.min.js',
        logger: logHandler
      });
    } catch (err) {
      console.warn('Worker local load fallback:', err);
      _tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: logHandler
      });
    }

    return _tesseractWorker;
  }

  // دەرهێنانی ژمارەکانی ستوونی «کۆد» (کە دەکەوێتە نێوان «ڕیز» و «پسوولە»)
  function extractManifestCodes(ocrResult) {
    if (!ocrResult) return [];
    const lines = ocrResult.lines || [];
    const fullText = ocrResult.text || '';

    const candidates = [];
    const textLines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    let expectedSeq = 1;

    for (const line of textLines) {
      const latin = UI.toLatinDigits(line);
      // فلتەرکردنی هێڵە ناپێویستەکان
      if (/(ڕیز|پسوولە|لایەنی\s*حساب|مجموع|کۆی\s*گشتی|total|invoice|account)/i.test(latin) && latin.length > 35) {
        continue;
      }

      // دەرهێنانی هەموو ژمارەکانی ناو هێڵەکە
      const tokens = (latin.match(/\b\d+\b/g) || []);
      if (!tokens.length) continue;

      // ١. فلتەرکردنی ژمارەی پسوولە (پسوولە هەمیشە ٦ ڕەقەمە، وەک 104052)
      const nonInvoices = tokens.filter(t => t.length !== 6 && t.length <= 5 && parseInt(t, 10) > 0);
      if (!nonInvoices.length) continue;

      let rowNum = null;
      let codeNum = null;

      if (nonInvoices.length === 1) {
        codeNum = nonInvoices[0];
      } else if (nonInvoices.length === 2) {
        const n1 = nonInvoices[0];
        const n2 = nonInvoices[1];
        const p1 = parseInt(n1, 10);
        const p2 = parseInt(n2, 10);

        // ئەگەر یەکێکیان ژمارەی ڕیز بێت (وەک 1, 2, 3...) و ئەویتریان کۆدی ماڕکێت (وەک 7815, 1849...)
        if (p1 === expectedSeq || (p1 > 0 && p1 <= 150 && n1.length <= 2 && n2.length >= 2)) {
          rowNum = String(p1);
          codeNum = n2;
        } else if (p2 === expectedSeq || (p2 > 0 && p2 <= 150 && n2.length <= 2 && n1.length >= 2)) {
          rowNum = String(p2);
          codeNum = n1;
        } else {
          // جیاکردنەوە بەپێی درێژی: کۆد لە نێوان ٣ بۆ ٥ ڕەقەمە
          if (n1.length >= 3 && n1.length <= 5) codeNum = n1;
          else if (n2.length >= 3 && n2.length <= 5) codeNum = n2;
          else codeNum = n1;
        }
      } else {
        // ئەگەر زیاد لە ٢ ژمارە مابوونەوە
        const pFirst = parseInt(nonInvoices[0], 10);
        let startIdx = 0;
        if (pFirst === expectedSeq || (pFirst > 0 && pFirst <= 150 && nonInvoices[0].length <= 2)) {
          rowNum = String(pFirst);
          startIdx = 1;
        }
        const foundCode = nonInvoices.slice(startIdx).find(n => n.length >= 3 && n.length <= 5) || nonInvoices[startIdx];
        codeNum = foundCode;
      }

      if (codeNum && codeNum.length !== 6 && codeNum.length <= 5) {
        const seq = rowNum || String(candidates.length + 1);
        if (rowNum) expectedSeq = parseInt(rowNum, 10) + 1;
        else expectedSeq++;

        candidates.push({
          seq: seq,
          code: codeNum.trim()
        });
      }
    }

    // سڕینەوەی دووبارەبوونەوەکان بە هێشتنەوەی ڕیزبەندی
    const seenCodes = new Set();
    const cleanList = [];
    for (const c of candidates) {
      if (!seenCodes.has(c.code)) {
        seenCodes.add(c.code);
        cleanList.push(c);
      }
    }

    return cleanList;
  }

  // پشکنین و هێنانی زانیاری ماڕکێتەکان لە سەپابەیس بەپێی کۆدەکان
  async function lookupMarketsInDatabase(rawItems) {
    if (!Array.isArray(rawItems) || !rawItems.length) return [];

    const distinctCodes = [];
    rawItems.forEach(r => {
      const c = UI.toLatinDigits(r.code || '').replace(/\D/g, '').trim();
      if (c && c.length !== 6 && c.length <= 5 && !distinctCodes.includes(c)) {
        distinctCodes.push(c);
      }
    });

    const dbMap = new Map();

    // پشکنین لە کشی ناوخۆیی
    distinctCodes.forEach(c => {
      const m = state.localMarkets.get(c) || (state.searchResults || []).find(x => String(x.account_code).trim() === c);
      if (m) dbMap.set(c, m);
    });

    // هێنانی دەستەجەمعی لە داتابەیسی سەپابەیس بەپێی account_code
    const missing = distinctCodes.filter(c => !dbMap.has(c));
    if (missing.length > 0) {
      try {
        const url = `${CONFIG.RECORDS_URL}/${CONFIG.MARKETS_TABLE}?account_code=in.(${encodeURIComponent(missing.join(','))})&select=*`;
        const res = await fetch(url, {
          headers: {
            'apikey': CONFIG.RECORDS_KEY,
            'Authorization': `Bearer ${CONFIG.RECORDS_KEY}`
          }
        });
        if (res.ok) {
          const list = await res.json();
          (list || []).forEach(m => {
            const code = String(m.account_code || '').trim();
            if (code) {
              dbMap.set(code, m);
              state.localMarkets.set(code, m);
            }
          });
        }
      } catch (e) {
        console.warn('Batch fetch error:', e);
      }

      // گەڕانی تاکی لە API بۆ ئەو کۆدانەی هێشتا نەدۆزراونەتەوە
      for (const c of missing) {
        if (!dbMap.has(c) && typeof API !== 'undefined' && API.Markets && API.Markets.search) {
          try {
            const list = await API.Markets.search(c);
            const m = (list || []).find(x => String(x.account_code).trim() === c);
            if (m) {
              dbMap.set(c, m);
              state.localMarkets.set(c, m);
            }
          } catch (_) {}
        }
      }
    }

    return rawItems.map((item, idx) => {
      const cleanCode = UI.toLatinDigits(item.code || '').replace(/\D/g, '').trim();
      const m = dbMap.get(cleanCode);
      const hasCoords = m && m.latitude !== null && m.latitude !== undefined &&
                        m.longitude !== null && m.longitude !== undefined &&
                        !isNaN(Number(m.latitude)) && !isNaN(Number(m.longitude));

      return {
        seq: String(item.seq || idx + 1),
        account_code: cleanCode,
        account_name: (m && m.account_name) ? m.account_name : 'کۆدی نەناسراو',
        neighborhood: (m && (m.neighborhood || m.zone)) ? (m.neighborhood || m.zone) : '',
        phone: (m && m.phone) ? m.phone : '',
        latitude: hasCoords ? Number(m.latitude) : null,
        longitude: hasCoords ? Number(m.longitude) : null,
        hasLocation: !!hasCoords,
        inDb: !!m
      };
    });
  }

  function appendMarketsToActiveGroup(items) {
    let added = 0;
    items.forEach(it => {
      const code = String(it.account_code || '').trim();
      if (!code) return;
      const idx = state.activeGroup.findIndex(x => String(x.account_code).trim() === code);
      if (idx !== -1) {
        if (it.hasLocation && (!state.activeGroup[idx].latitude || !state.activeGroup[idx].longitude)) {
          state.activeGroup[idx] = it;
        }
      } else {
        state.activeGroup.push(it);
        added++;
      }
    });
    updateBottomBarBadge();
    return added;
  }

  /* =========================================================
   *  مۆدالی کامێرا بە تەنها دوو ئۆپشن: گرتنی وێنە و هێنانی وێنە لە ئامێر
   * ========================================================= */

  function openCameraModal() {
    const modalBody = document.createElement('div');
    modalBody.className = 'mkt-cam-modal-body';

    modalBody.innerHTML = `
      <!-- هێدەر و ڕێنمایی سادە -->
      <div style="background:rgba(59,130,246,0.06); padding:10px 14px; border-radius:10px; border:1px solid var(--border); margin-bottom:12px;">
        <strong style="font-size:0.92rem; color:var(--text); display:block; margin-bottom:4px;">
          📸 سکانکردنی کاغەزی مانیفێست (کۆد و لۆکەیشن)
        </strong>
        <p class="muted" style="margin:0; font-size:0.8rem; line-height:1.4;">
          وێنەی کاغەزەکە بگرە یان لە ئامێرەکەت هەڵیبژێرە؛ ژمارەکانی ستوونی «کۆد» (نێوان ڕیز و پسوولە) دەردەهێنرێن و ناو و لۆکەیشنەکانیان ڕاستەوخۆ لە داتابەیس دەهێنرێن بۆ هەناردەکردن بۆ Maps.me.
        </p>
      </div>

      <!-- تەنها دوو ئۆپشن بەپێی داواکاری: گرتنی وێنە و هێنانی وێنە لە ئامێر -->
      <input type="file" id="mkt-cam-file-input" accept="image/*" capture="environment" style="display:none">
      <input type="file" id="mkt-gal-file-input" accept="image/*" style="display:none">

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
        <button type="button" class="btn btn-primary" id="mkt-cam-btn-take" style="padding:12px 6px; font-size:0.9rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px;">
          <span style="font-size:1.2rem;">📷</span> <span>گرتنی وێنە (کامێرا)</span>
        </button>
        <button type="button" class="btn btn-ghost" id="mkt-cam-btn-gallery" style="padding:12px 6px; font-size:0.9rem; font-weight:700; display:flex; align-items:center; justify-content:center; gap:8px; border:1px solid var(--border);">
          <span style="font-size:1.2rem;">🖼️</span> <span>هێنانی وێنە لە ئامێر</span>
        </button>
      </div>

      <!-- شوێنی پێشبینینی وێنە لەگەڵ دوگمەی سووڕاندن و سڕینەوە -->
      <div class="mkt-thumbs-preview" id="mkt-thumbs-preview" style="display:none; margin-bottom:14px;"></div>

      <!-- لیستی مارکێتە دۆزراوەکان بۆ دروستکردنی فایلی ماپ -->
      <div class="mkt-scanned-group-wrap">
        <div class="mkt-group-head-row">
          <h4>📍 مارکێتە دۆزراوەکان (<span id="mkt-group-count">${state.activeGroup.length}</span>)</h4>
          ${state.activeGroup.length ? `<button type="button" class="btn btn-xs btn-ghost text-danger" id="mkt-clear-group-btn">خاوێنکردنەوە</button>` : ''}
        </div>

        <div class="mkt-group-items-list" id="mkt-group-items-list">
          ${renderActiveGroupHtml()}
        </div>
      </div>
    `;

    const { close } = UI.openModal({
      title: '📸 کامێرا و دروستکردنی فایلی ماپ (KMZ)',
      body: modalBody,
      wide: true,
      actions: [
        { label: 'داخستن', className: 'btn-ghost', onClick: () => close() },
        {
          label: '🗺️ کردنەوە لە Maps.me (KMZ)',
          className: 'btn-success',
          onClick: async () => {
            if (!state.activeGroup.length) {
              UI.toast('تکایە سەرەتا بە وێنەگرتن یان گەلەری مارکێتەکان زیاد بکە', 'warning');
              return;
            }
            const missingLocs = state.activeGroup.filter(m => !m.latitude || !m.longitude);
            if (missingLocs.length > 0 && missingLocs.length === state.activeGroup.length) {
              UI.toast('هیچ کام لە مارکێتەکان لۆکەیشنی GPS یان نییە! تکایە لانی کەم یەک لۆکەیشن دیاری بکە.', 'danger', 4500);
              return;
            }
            if (missingLocs.length > 0) {
              UI.toast(`تێبینی: لە کۆی ${state.activeGroup.length} مارکێت، ${missingLocs.length} مارکێت بێ لۆکەیشنن و لەسەر ماپ دەرناکەون.`, 'warning', 4500);
            }
            await sendGroupToMapsMe(state.activeGroup);
            close();
            updateBottomBarBadge();
          }
        }
      ]
    });

    const camInput = modalBody.querySelector('#mkt-cam-file-input');
    const galInput = modalBody.querySelector('#mkt-gal-file-input');
    const btnTake = modalBody.querySelector('#mkt-cam-btn-take');
    const btnGallery = modalBody.querySelector('#mkt-cam-btn-gallery');
    const thumbsWrap = modalBody.querySelector('#mkt-thumbs-preview');

    btnTake?.addEventListener('click', () => camInput?.click());
    btnGallery?.addEventListener('click', () => galInput?.click());

    const handleFiles = async (files) => {
      if (!files || !files.length) return;
      thumbsWrap.style.display = 'flex';

      for (const file of files) {
        let currentFile = file;
        const imgBox = document.createElement('div');
        imgBox.className = 'mkt-thumb-box';
        let currentUrl = URL.createObjectURL(currentFile);

        imgBox.innerHTML = `
          <img src="${currentUrl}" alt="کاعەز">
          <button type="button" class="mkt-thumb-rot" title="ئەگەر وێنەکە لار بوو بیپێچەوە 90°">⟳ سووڕاندن</button>
          <button type="button" class="mkt-thumb-del" title="سڕینەوە">✕</button>
          <span class="mkt-thumb-status">ئامادەکردنی وێنە...</span>
        `;
        thumbsWrap.appendChild(imgBox);

        imgBox.querySelector('.mkt-thumb-del')?.addEventListener('click', () => {
          imgBox.remove();
          URL.revokeObjectURL(currentUrl);
          if (!thumbsWrap.children.length) thumbsWrap.style.display = 'none';
        });

        const statusEl = imgBox.querySelector('.mkt-thumb-status');
        const rotBtn = imgBox.querySelector('.mkt-thumb-rot');

        rotBtn?.addEventListener('click', async () => {
          rotBtn.disabled = true;
          statusEl.textContent = 'سووڕاندن...';
          currentFile = await rotateImageFile(currentFile, 90);
          URL.revokeObjectURL(currentUrl);
          currentUrl = URL.createObjectURL(currentFile);
          imgBox.querySelector('img').src = currentUrl;
          await processImageLocally(currentFile, statusEl);
          refreshGroupUi();
          rotBtn.disabled = false;
        });

        await processImageLocally(currentFile, statusEl);
        refreshGroupUi();
      }
    };

    camInput?.addEventListener('change', e => {
      handleFiles([...(e.target.files || [])]);
      camInput.value = '';
    });
    galInput?.addEventListener('change', e => {
      handleFiles([...(e.target.files || [])]);
      galInput.value = '';
    });

    async function processImageLocally(file, statusEl) {
      statusEl.textContent = 'ئامادەکردنی وێنە...';
      try {
        const canvas = await prepareImageForOcr(file, 1800);
        statusEl.textContent = 'دەستپێکردنی سکان...';

        const worker = await getOcrWorker(msg => {
          statusEl.textContent = msg;
        });

        statusEl.textContent = 'خوێندنەوەی ژمارەکان...';
        const result = await worker.recognize(canvas);
        const extracted = extractManifestCodes(result.data);

        if (!extracted.length) {
          statusEl.textContent = 'هیچ کۆدێک نەدۆزرایەوە؛ دەتوانیت بیسوڕێنیت ⟳';
          statusEl.style.color = '#ef4444';
          return;
        }

        statusEl.textContent = `پشکنینی ${extracted.length} کۆد لە داتابەیس...`;
        const lookedUp = await lookupMarketsInDatabase(extracted);
        const added = appendMarketsToActiveGroup(lookedUp);

        statusEl.textContent = `${added} مارکێت دۆزرایەوە ✓`;
        statusEl.style.color = '#10b981';
        UI.toast(`${extracted.length} کۆد لە وێنەکە خوێنرایەوە و لە داتابەیس پشکێنرا ✓`, 'success', 3500);
      } catch (err) {
        console.error('Local OCR error:', err);
        statusEl.textContent = 'هەڵە لە سکان: ' + err.message;
        statusEl.style.color = '#ef4444';
        UI.toast('هەڵە لە سکانی وێنە: ' + err.message, 'danger', 4500);
      }
    }

    // خاوێنکردنەوەی هەموو گرووپەکە
    modalBody.querySelector('#mkt-clear-group-btn')?.addEventListener('click', () => {
      state.activeGroup = [];
      updateBottomBarBadge();
      refreshGroupUi();
    });

    function refreshGroupUi() {
      const countEl = modalBody.querySelector('#mkt-group-count');
      const listEl = modalBody.querySelector('#mkt-group-items-list');
      if (countEl) countEl.textContent = state.activeGroup.length;
      if (listEl) listEl.innerHTML = renderActiveGroupHtml();
      bindGroupItemEvents();
      updateBottomBarBadge();
    }

    function bindGroupItemEvents() {
      // سڕینەوەی ماڕکێت لە لیست
      modalBody.querySelectorAll('[data-drop-code]').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = btn.dataset.dropCode;
          state.activeGroup = state.activeGroup.filter(x => String(x.account_code) !== String(c));
          refreshGroupUi();
        });
      });

      // دیاریکردنی لۆکەیشن بۆ ئەوانەی لۆکەیشنیان نییە لەسەر نەخشە
      modalBody.querySelectorAll('[data-fix-loc-code]').forEach(btn => {
        btn.addEventListener('click', () => {
          const c = btn.dataset.fixLocCode;
          const target = state.activeGroup.find(x => String(x.account_code) === String(c));
          if (!target) return;

          openMapPickerModal({
            initialLat: target.latitude,
            initialLon: target.longitude,
            onSelect: async (lat, lon) => {
              target.latitude = Number(lat);
              target.longitude = Number(lon);
              target.hasLocation = true;
              try {
                await fetch(`${CONFIG.RECORDS_URL}/${CONFIG.MARKETS_TABLE}?account_code=eq.${encodeURIComponent(target.account_code)}`, {
                  method: 'PATCH',
                  headers: {
                    'apikey': CONFIG.RECORDS_KEY,
                    'Authorization': `Bearer ${CONFIG.RECORDS_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ latitude: target.latitude, longitude: target.longitude })
                });
                UI.toast(`لۆکەیشنی مارکێتی «${target.account_name}» نوێکرایەوە ✓`, 'success');
              } catch (e) {
                console.warn('Update location failed:', e);
              }
              refreshGroupUi();
            }
          });
        });
      });
    }

    bindGroupItemEvents();
  }

  function renderActiveGroupHtml() {
    if (!state.activeGroup.length) {
      return `<div class="mkt-group-empty muted" style="padding:18px; text-align:center;">هێشتا هیچ وێنەیەک سکان نەکراوە. دوگمەی کامێرا یان گەلەری دابگرە بۆ سکان.</div>`;
    }

    return state.activeGroup.map((m, idx) => {
      const hasCoords = m.latitude !== null && m.latitude !== undefined &&
                        m.longitude !== null && m.longitude !== undefined &&
                        !isNaN(Number(m.latitude)) && !isNaN(Number(m.longitude));
      const code = UI.esc(m.account_code || '');
      const name = UI.esc(m.account_name || 'مارکێت');
      const zone = UI.esc(m.neighborhood || m.zone || '');

      return `
        <div class="mkt-group-card-item">
          <span class="mkt-g-index">#${idx + 1}</span>
          <div class="mkt-g-info">
            <div class="mkt-g-code-row">
              <span class="mkt-g-code-chip">${code}</span>
              <strong>${name}</strong>
            </div>
            <div class="mkt-g-sub">
              ${zone ? `<span>📍 ${zone}</span>` : ''}
              ${hasCoords
                ? `<span class="mkt-badge-has-loc">✓ لۆکەیشن هەیە (${Number(m.latitude).toFixed(4)}, ${Number(m.longitude).toFixed(4)})</span>`
                : `<span class="mkt-badge-warn-loc">⚠️ ئەم کۆدە بێ لۆکەیشنە</span>
                   <button type="button" class="btn btn-xs btn-ghost text-primary" data-fix-loc-code="${code}" style="padding:1px 6px; font-size:0.72rem;">📍 دیاریکردنی لۆکەیشن</button>`}
            </div>
          </div>
          <button type="button" class="btn btn-ghost btn-xs text-danger" data-drop-code="${code}" title="سڕینەوە">✕</button>
        </div>`;
    }).join('');
  }

  function stop() {
    // وەستاندنی کاتژمێر یان پرۆسەکان لە کاتی دەرچوون
  }

  return {
    render,
    stop,
    openAddEditModal,
    openCameraModal
  };
})();
