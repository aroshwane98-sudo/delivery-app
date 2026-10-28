/* =========================================================
 *  فۆڕمی تارگێت — حیسابکردنی مووچە/پاداشت بەپێی تۆمارەکانی مانگ
 *  بۆ هەر یوسەرێک: (کۆی کێش × نرخی کێش) + (کۆی پارچە × نرخی پارچە)
 *                  + (کۆی وەسڵ × نرخی وەسڵ) + پارەی سابت + باری خاریجی
 *  دواتر کۆی هەموو یوسەرە هەڵبژێردراوەکان.
 * ========================================================= */

const TargetView = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);

  const MONTH_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  const state = {
    year: null,
    month: '',
    dayFrom: 1,
    dayTo: 31,
    fixed: '',
    rateWeight: '',
    ratePieces: '',
    rateReceipt: '',
    users: [],
    selected: new Set(),   // ئایدی یوسەرە هەڵبژێردراوەکان
    search: '',
    externals: [],         // [{ ids:[...], amount:number }]
    result: null,          // { rows, totals, label }
    loading: false,
  };

  let container = null;

  /* ---------------- یارمەتیدەرەکان ---------------- */

  // ژمارەی دەهەمی: هەموو ژمارەیەک وەردەگرێت (پۆینتیش)، شتی تر لادەبرێت
  const cleanDecimalText = v => {
    let s = UI.toLatinDigits(String(v ?? '')).replace(/[,،\s]/g, '').replace(/٫/g, '.').replace(/[^\d.]/g, '');
    const i = s.indexOf('.');
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    return s;
  };
  const toNum = v => {
    const n = parseFloat(cleanDecimalText(v));
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

  const bindDecimal = (inp, key) => {
    inp.addEventListener('input', () => {
      state[key] = inp.value;
    });
  };

  const daysInMonth = (y, m) => new Date(y, Number(m), 0).getDate();
  const pad = n => String(n).padStart(2, '0');

  // پیشە → ئەو خانەیەی تۆمارەکە کە ناوی یوسەرەکەی تێدایە
  const fieldsFor = u => {
    const p = u.profession;
    if (p === CONFIG.PROFESSION_DRIVER) return ['driver'];
    if (p === CONFIG.PROFESSION_DISTRIBUTOR) return ['distributor'];
    if (p === CONFIG.PROFESSION_DELEGATE) return ['delegate'];
    return ['driver', 'distributor', 'delegate'];
  };

  const periodLabel = () =>
    `مانگی ${state.month} / ${state.year} — ڕۆژی ${state.dayFrom} تا ${state.dayTo}`;

  /* ---------------- ڕێندەر ---------------- */

  function render(el) {
    container = el;
    if (!state.year) state.year = Number(String(UI.todayStr()).slice(0, 4));
    if (!state.month) state.month = String(Number(String(UI.todayStr()).slice(5, 7)));

    const years = [state.year - 2, state.year - 1, state.year, state.year + 1];

    el.innerHTML = `
      <div class="settings-view target-view">
        <section class="card filter-card">
          <div class="admin-header-row" style="margin-bottom:8px">
            <h3 style="font-size:0.96rem"><span class="sec-icon">${UI.icon('target')}</span> فۆڕمی تارگێت</h3>
          </div>

          <div class="tg-row">
            <div class="field"><label>مانگ</label>
              <select id="tg-month">${MONTH_NAMES.map(m => `<option value="${m}" ${m === String(state.month) ? 'selected' : ''}>${m}</option>`).join('')}</select>
            </div>
            <div class="field"><label>ساڵ</label>
              <select id="tg-year">${years.map(y => `<option value="${y}" ${y === state.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
            </div>
          </div>
          <div class="tg-row">
            <div class="field"><label>ڕۆژەکانی مانگ — لە ڕۆژی</label><select id="tg-dfrom"></select></div>
            <div class="field"><label>تا ڕۆژی</label><select id="tg-dto"></select></div>
          </div>

          <div class="field"><label>💰 پارەی سابت (بۆ هەموو یوسەرەکان)</label>
            <input id="tg-fixed" type="text" inputmode="decimal" autocomplete="off" value="${UI.esc(state.fixed)}"></div>
          <div class="field"><label>کێشی بار *</label>
            <input id="tg-rw" type="text" inputmode="decimal" autocomplete="off" value="${UI.esc(state.rateWeight)}"></div>
          <div class="field"><label>پارچەکان *</label>
            <input id="tg-rp" type="text" inputmode="decimal" autocomplete="off" value="${UI.esc(state.ratePieces)}"></div>
          <div class="field"><label>ژمارەی وەسڵ *</label>
            <input id="tg-rr" type="text" inputmode="decimal" autocomplete="off" value="${UI.esc(state.rateReceipt)}"></div>
        </section>

        <section class="card" style="margin-top:12px">
          <div class="admin-header-row" style="margin-bottom:8px">
            <h3 style="font-size:0.96rem">یوسەرەکان</h3>
            <span class="chip" id="tg-sel-count"></span>
          </div>
          <div class="field" style="margin-bottom:8px">
            <input type="search" id="tg-search" placeholder="گەڕان..." autocomplete="off" value="${UI.esc(state.search)}">
          </div>
          <div class="tg-actions-row">
            <button type="button" class="btn btn-ghost btn-sm" data-tg-prof="${UI.esc(CONFIG.PROFESSION_DRIVER)}">تەنها سایەق</button>
            <button type="button" class="btn btn-ghost btn-sm" data-tg-prof="${UI.esc(CONFIG.PROFESSION_DISTRIBUTOR)}">تەنها دابەشکار</button>
            <button type="button" class="btn btn-ghost btn-sm" data-tg-prof="${UI.esc(CONFIG.PROFESSION_DELEGATE)}">تەنها مەندوب</button>
            <button type="button" class="btn btn-ghost btn-sm" id="tg-none">هیچ</button>
            <button type="button" class="btn btn-ghost btn-sm" id="tg-ext">🚛 باری خاریجی</button>
          </div>
          <div id="tg-ext-list" class="tg-ext-list"></div>
          <div id="tg-users" class="tg-users"><div class="empty-state"><p>بارکردن...</p></div></div>
        </section>

        <section class="card" style="margin-top:12px">
          <button type="button" class="btn btn-primary" id="tg-calc" style="width:100%">🧮 حیسابکردن</button>
          <div id="tg-result" style="margin-top:12px"></div>
        </section>
      </div>`;

    fillDays();
    $('#tg-month', el).addEventListener('change', e => { state.month = e.target.value; fillDays(); });
    $('#tg-year', el).addEventListener('change', e => { state.year = Number(e.target.value); fillDays(); });
    $('#tg-dfrom', el).addEventListener('change', e => { state.dayFrom = Number(e.target.value); });
    $('#tg-dto', el).addEventListener('change', e => { state.dayTo = Number(e.target.value); });

    UI.wireThousands($('#tg-fixed', el), { allowOperators: false });
    bindDecimal($('#tg-fixed', el), 'fixed');
    bindDecimal($('#tg-rw', el), 'rateWeight');
    bindDecimal($('#tg-rp', el), 'ratePieces');
    bindDecimal($('#tg-rr', el), 'rateReceipt');

    $('#tg-search', el).addEventListener('input', e => { state.search = e.target.value; renderUsers(); });
    el.querySelectorAll('[data-tg-prof]').forEach(b => b.addEventListener('click', () => {
      // تەنها ئەو پیشەیە هەڵدەبژێردرێت (هەڵبژاردنی پێشوو دەگۆڕدرێت)
      state.selected = new Set(state.users
        .filter(u => u.profession === b.dataset.tgProf)
        .map(u => String(u.id)));
      renderUsers();
    }));
    $('#tg-none', el).addEventListener('click', () => { state.selected.clear(); renderUsers(); });
    $('#tg-ext', el).addEventListener('click', openExternalModal);
    $('#tg-calc', el).addEventListener('click', calculate);

    renderExternals();
    renderResult();

    Store.loadLists()
      .then(ls => {
        state.users = UI.sortUsers(Store.visible('users', ls.users));
        renderUsers();
      })
      .catch(err => {
        $('#tg-users', el).innerHTML = `<div class="empty-state"><p>هەڵە لە هێنانی یوسەران: ${UI.esc(err.message)}</p></div>`;
      });
  }

  function fillDays() {
    const last = daysInMonth(state.year, state.month);
    if (state.dayTo > last || state.dayTo < 1) state.dayTo = last;
    if (state.dayFrom > last) state.dayFrom = 1;
    const opts = sel => Array.from({ length: last }, (_, i) =>
      `<option value="${i + 1}" ${i + 1 === sel ? 'selected' : ''}>${i + 1}</option>`).join('');
    $('#tg-dfrom', container).innerHTML = opts(state.dayFrom);
    $('#tg-dto', container).innerHTML = opts(state.dayTo);
  }

  const filteredUsers = () => {
    const q = UI.norm(state.search);
    return state.users.filter(u => !q || [u.username, u.profession].some(v => UI.norm(v).includes(q)));
  };

  function renderUsers() {
    const wrap = $('#tg-users', container);
    if (!wrap) return;
    const list = filteredUsers();
    wrap.innerHTML = list.length ? list.map(u => `
      <label class="tg-user ${state.selected.has(String(u.id)) ? 'on' : ''}">
        <input type="checkbox" data-uid="${UI.esc(String(u.id))}" ${state.selected.has(String(u.id)) ? 'checked' : ''}>
        ${UI.avatarHtml(u, 36)}
        <span class="tg-user-name">${UI.esc(u.username)}</span>
        <span class="chip">${UI.esc(u.profession || '—')}</span>
      </label>`).join('') : '<div class="empty-state"><p>هیچ یوسەرێک نەدۆزرایەوە.</p></div>';

    wrap.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) state.selected.add(cb.dataset.uid); else state.selected.delete(cb.dataset.uid);
        cb.closest('.tg-user').classList.toggle('on', cb.checked);
        updateCount();
      });
    });
    updateCount();
  }

  const updateCount = () => {
    const c = $('#tg-sel-count', container);
    if (c) c.textContent = `${UI.fmtNum(state.selected.size)} هەڵبژێردراو`;
  };

  /* ---------------- باری خاریجی ---------------- */

  function renderExternals() {
    const box = $('#tg-ext-list', container);
    if (!box) return;
    box.innerHTML = state.externals.map((x, i) => `
      <div class="tg-ext-item">
        <span>🚛 ${UI.esc(x.ids.map(id => (state.users.find(u => String(u.id) === id) || {}).username || id).join('، '))}
          — <b>${fmt(x.amount)}</b></span>
        <button type="button" class="btn btn-ghost btn-sm" data-rm="${i}">✕</button>
      </div>`).join('');
    box.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      state.externals.splice(Number(b.dataset.rm), 1);
      renderExternals();
    }));
  }

  function openExternalModal() {
    const picked = new Set();
    const { close, body } = UI.openModal({
      title: '🚛 باری خاریجی',
      body: `
        <div class="field" style="margin-bottom:8px">
          <input type="search" id="tg-ext-search" placeholder="گەڕان..." autocomplete="off">
        </div>
        <div id="tg-ext-users" class="tg-users" style="max-height:44vh;overflow:auto"></div>
        <div class="field" style="margin-top:10px">
          <label>بڕ *</label>
          <input id="tg-ext-amount" type="text" inputmode="decimal" autocomplete="off">
        </div>`,
      actions: [
        { label: 'پاشگەزبوونەوە', className: 'btn-ghost', onClick: () => close() },
        {
          label: 'زیادکردن', className: 'btn-primary',
          onClick: () => {
            const amount = toNum($('#tg-ext-amount', body).value);
            if (!picked.size) return UI.toast('تکایە بەلایەنی کەم یەک یوسەر هەڵبژێرە!', 'warning');
            if (!amount) return UI.toast('بڕەکە بنووسە!', 'warning');
            state.externals.push({ ids: [...picked], amount });
            renderExternals();
            close();
          },
        },
      ],
    });

    const amt = $('#tg-ext-amount', body);
    UI.wireThousands(amt, { allowOperators: false });

    const draw = () => {
      const q = UI.norm($('#tg-ext-search', body).value);
      const list = state.users.filter(u => !q || [u.username, u.profession].some(v => UI.norm(v).includes(q)));
      const wrap = $('#tg-ext-users', body);
      wrap.innerHTML = list.map(u => `
        <label class="tg-user ${picked.has(String(u.id)) ? 'on' : ''}">
          <input type="checkbox" data-uid="${UI.esc(String(u.id))}" ${picked.has(String(u.id)) ? 'checked' : ''}>
          ${UI.avatarHtml(u, 36)}
          <span class="tg-user-name">${UI.esc(u.username)}</span>
          <span class="chip">${UI.esc(u.profession || '—')}</span>
        </label>`).join('');
      wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => {
        if (cb.checked) picked.add(cb.dataset.uid); else picked.delete(cb.dataset.uid);
        cb.closest('.tg-user').classList.toggle('on', cb.checked);
      }));
    };
    $('#tg-ext-search', body).addEventListener('input', draw);
    draw();
  }

  /* ---------------- حیسابکردن ---------------- */

  async function fetchRecords() {
    const last = daysInMonth(state.year, state.month);
    const to = Math.min(state.dayTo, last);
    const from = `${state.year}-${pad(state.month)}-${pad(state.dayFrom)}`;
    const till = `${state.year}-${pad(state.month)}-${pad(to)}`;
    const all = [];
    let lastId = 0;
    for (let page = 0; page < 200; page++) {
      const rows = await API.Records.list({
        select: '*', order: 'id.asc', limit: 1000,
        record_date: [`gte.${from}`, `lte.${till}`],
        id: `gt.${lastId}`,
      });
      if (!rows || !rows.length) break;
      all.push(...rows);
      const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), lastId);
      if (maxId <= lastId || rows.length < 1000) break;
      lastId = maxId;
    }
    return all;
  }

  async function calculate() {
    if (state.loading) return;
    if (state.dayFrom > state.dayTo) return UI.toast('ڕۆژی دەستپێک لە ڕۆژی کۆتایی گەورەترە!', 'warning');
    if (!state.selected.size) return UI.toast('تکایە بەلایەنی کەم یەک یوسەر هەڵبژێرە!', 'warning');

    const rw = toNum(state.rateWeight), rp = toNum(state.ratePieces), rr = toNum(state.rateReceipt);
    const fixed = toNum(state.fixed);

    const btn = $('#tg-calc', container);
    state.loading = true;
    UI.btnLoading(btn, true, 'حیساب دەکرێت...');
    try {
      const records = await fetchRecords();
      const users = state.users.filter(u => state.selected.has(String(u.id)));

      const rows = users.map(u => {
        const fields = fieldsFor(u);
        let w = 0, p = 0, r = 0, trips = 0;
        records.forEach(rec => {
          if (!fields.some(f => UI.recMatchesUser(rec, f, u))) return;
          trips++;
          w += UI.cleanInt(rec.cargo_weight);
          p += UI.cleanInt(rec.pieces_count);
          r += UI.cleanInt(rec.receipt_number);
        });
        const ext = state.externals
          .filter(x => x.ids.includes(String(u.id)))
          .reduce((a, x) => a + x.amount, 0);
        const aW = w * rw, aP = p * rp, aR = r * rr;
        return { name: u.username, prof: u.profession || '', trips, w, p, r, aW, aP, aR, fixed, ext,
                 total: aW + aP + aR + fixed + ext };
      });

      const totals = rows.reduce((a, x) => {
        Object.keys(a).forEach(k => { a[k] += x[k]; });
        return a;
      }, { trips: 0, w: 0, p: 0, r: 0, aW: 0, aP: 0, aR: 0, fixed: 0, ext: 0, total: 0 });

      state.result = { rows, totals, label: periodLabel(), rates: { rw, rp, rr } };
      renderResult();
      if (!records.length) UI.toast('هیچ تۆمارێک لەم ماوەیەدا نەدۆزرایەوە.', 'warning');
    } catch (err) {
      UI.toast('هەڵە لە حیسابکردن: ' + err.message, 'error', 4500);
    } finally {
      state.loading = false;
      UI.btnLoading(btn, false);
    }
  }

  /* ---------------- ئەنجام و هەناردە ---------------- */

  function renderResult() {
    const box = $('#tg-result', container);
    if (!box) return;
    const res = state.result;
    if (!res) { box.innerHTML = ''; return; }

    box.innerHTML = `
      <div class="tg-period">${UI.esc(res.label)}</div>
      <div class="tg-table-wrap">
        <table class="tg-table">
          <thead><tr>
            <th>ناو</th><th>پیشە</th><th>کۆی کێش</th><th>کۆی پارچە</th><th>کۆی وەسڵ</th>
            <th>کێش × نرخ</th><th>پارچە × نرخ</th><th>وەسڵ × نرخ</th><th>سابت</th><th>باری خاریجی</th><th>کۆی گشتی</th>
          </tr></thead>
          <tbody>
            ${res.rows.map(x => `<tr>
              <td>${UI.esc(x.name)}</td><td>${UI.esc(x.prof)}</td>
              <td>${fmt(x.w)}</td><td>${fmt(x.p)}</td><td>${fmt(x.r)}</td>
              <td>${fmt(x.aW)}</td><td>${fmt(x.aP)}</td><td>${fmt(x.aR)}</td>
              <td>${fmt(x.fixed)}</td><td>${fmt(x.ext)}</td><td><b>${fmt(x.total)}</b></td></tr>`).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="2">تۆتاڵ</td>
            <td>${fmt(res.totals.w)}</td><td>${fmt(res.totals.p)}</td><td>${fmt(res.totals.r)}</td>
            <td>${fmt(res.totals.aW)}</td><td>${fmt(res.totals.aP)}</td><td>${fmt(res.totals.aR)}</td>
            <td>${fmt(res.totals.fixed)}</td><td>${fmt(res.totals.ext)}</td><td><b>${fmt(res.totals.total)}</b></td>
          </tr></tfoot>
        </table>
      </div>
      <div class="tg-export">
        <button type="button" class="btn btn-ghost" id="tg-x-excel">📥 بە ئێکسڵکردن</button>
        <button type="button" class="btn btn-ghost" id="tg-x-print">🖨️ پرێنتکردن</button>
        <button type="button" class="btn btn-primary" id="tg-x-both">🖨️📥 پرێنتکردن و ئێکسڵکردن</button>
      </div>`;

    $('#tg-x-excel', box).addEventListener('click', () => exportExcel());
    $('#tg-x-print', box).addEventListener('click', () => printResult());
    $('#tg-x-both', box).addEventListener('click', async () => {
      await exportExcel();
      printResult();
    });
  }

  const HEAD = ['ناو', 'پیشە', 'کۆی کێش', 'کۆی پارچە', 'کۆی وەسڵ', 'کێش × نرخ', 'پارچە × نرخ', 'وەسڵ × نرخ', 'سابت', 'باری خاریجی', 'کۆی گشتی'];
  const rowArr = x => [x.name, x.prof, x.w, x.p, x.r, x.aW, x.aP, x.aR, x.fixed, x.ext, x.total];

  async function exportExcel() {
    const res = state.result;
    if (!res) return;
    try { await UI.ensureXlsx(); } catch (err) { UI.toast(err.message, 'error'); return; }
    const t = res.totals;
    const aoa = [
      ['فۆڕمی تارگێت'],
      [res.label],
      [`نرخی کێش: ${res.rates.rw} — نرخی پارچە: ${res.rates.rp} — نرخی وەسڵ: ${res.rates.rr}`],
      [],
      HEAD,
      ...res.rows.map(rowArr),
      ['تۆتاڵ', '', t.w, t.p, t.r, t.aW, t.aP, t.aR, t.fixed, t.ext, t.total],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = HEAD.map((_, i) => ({ wch: i === 0 ? 22 : 15 }));
    ws['!merges'] = [0, 1, 2].map(r => ({ s: { r, c: 0 }, e: { r, c: HEAD.length - 1 } }));
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, 'تارگێت');
    const fileName = `تارگێت_${state.year}-${pad(state.month)}.xlsx`;
    try {
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const url = URL.createObjectURL(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 300);
    }
    UI.toast('فایلی ئێکسڵ دروستکرا ✓', 'success');
  }

  function printResult() {
    const res = state.result;
    if (!res) return;
    const t = res.totals;
    const tr = a => `<tr>${a.map(c => `<td>${UI.esc(typeof c === 'number' ? fmt(c) : c)}</td>`).join('')}</tr>`;
    const html = `<!DOCTYPE html><html lang="ckb" dir="rtl"><head><meta charset="utf-8"><title>فۆڕمی تارگێت</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: inherit, Tahoma, Arial, sans-serif; color:#111; margin:0; }
        h1 { font-size: 16pt; margin: 0 0 4px; } .sub { font-size: 10pt; color:#444; margin-bottom: 10px; }
        table { width:100%; border-collapse: collapse; font-size: 9.5pt; }
        th, td { border: 1px solid #888; padding: 5px 6px; text-align: center; }
        th { background: #e5e7eb; } tfoot td, tr.tot td { background:#f3f4f6; font-weight:800; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style></head><body>
        <h1>فۆڕمی تارگێت</h1>
        <div class="sub">${UI.esc(res.label)} — نرخی کێش: ${res.rates.rw} • پارچە: ${res.rates.rp} • وەسڵ: ${res.rates.rr}</div>
        <table><thead><tr>${HEAD.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${res.rows.map(x => tr(rowArr(x))).join('')}</tbody>
        <tfoot>${tr(['تۆتاڵ', '', t.w, t.p, t.r, t.aW, t.aP, t.aR, t.fixed, t.ext, t.total])}</tfoot></table>
      </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 2500);
    }, 400);
  }

  return { render, stop: () => {} };
})();
