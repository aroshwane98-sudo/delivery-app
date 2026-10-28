/* =========================================================
 *  فۆڕمی ماڕکێتەکان — Markets View (Clean Canvas)
 *  ئەم پەڕەیە بە بەتاڵی و پاکی ئامادەکراوە بۆ داڕشتنەوەی سەرلەنوێ
 *  کۆپی یەدەگ لە: view-markets.backup.js پارێزراوە
 * ========================================================= */

const MarketsView = (() => {
  let container = null;

  function render(el) {
    container = el;
    container.innerHTML = `
      <div class="markets-blank-container" style="max-width: 900px; margin: 0 auto; padding: 24px 16px;">
        
        <!-- سەردێڕی پەڕە -->
        <div class="card" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 22px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 46px; height: 46px; border-radius: 12px; background: rgba(16, 185, 129, 0.12); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 24px;">
              🏪
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700;">فۆڕمی ماڕکێتەکان</h2>
              <p style="margin: 3px 0 0; color: var(--text-muted, #94a3b8); font-size: 0.85rem;">
                ئامادەکراوە بۆ داڕشتنەوەی دیزاین و زانیارییە نوێیەکان بەپێی داواکاریت
              </p>
            </div>
          </div>
          <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.25); padding: 5px 12px; border-radius: 20px; font-size: 0.78rem;">
            ئامادەی دیزاینە
          </span>
        </div>

        <!-- کارتێکی پاک و ڕێکخراو بۆ داڕشتنەوە -->
        <div class="card" style="padding: 40px 24px; text-align: center; border: 2px dashed var(--border-color, rgba(148, 163, 184, 0.25)); background: var(--surface-1, rgba(255, 255, 255, 0.02)); border-radius: 16px;">
          
          <div style="width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 50%; background: rgba(59, 130, 246, 0.08); display: flex; align-items: center; justify-content: center; font-size: 32px;">
            ✨
          </div>

          <h3 style="margin: 0 0 10px; font-size: 1.15rem; font-weight: 700;">فۆڕمەکە بە بەتاڵی ئامادەکراوە</h3>
          <p style="max-width: 520px; margin: 0 auto 24px; color: var(--text-muted, #94a3b8); font-size: 0.9rem; line-height: 1.7;">
            ئەم بەشە بە تەواوی خاوێن کراوەتەوە و بەستراوە بە سیستەمەکەتەوە. تکایە پێم بڵێ چ جۆرە زانیاری و خانەیەک (کێڵگە - Fields)ت دەوێت بۆ ماڕکێتەکان تا ڕێک لەسەر داواکاریت دایبڕێژمەوە.
          </p>

          <!-- ڕێبەری نموونەی ئەو خانانەی دەتوانیت دایبنێیت -->
          <div style="max-width: 500px; margin: 0 auto 20px; padding: 16px; background: var(--surface-2, rgba(148, 163, 184, 0.06)); border-radius: 12px; text-align: right;">
            <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; color: var(--text-main, #e2e8f0);">
              نموونەی ئەو تایبەتمەندییانەی دەتوانیت دیارییان بکەیت:
            </div>
            <ul style="margin: 0; padding-right: 20px; font-size: 0.84rem; color: var(--text-muted, #94a3b8); line-height: 1.8;">
              <li>کۆدی ماڕکێت، ناوی ماڕکێت، ناوی خاوەن یان بەرپرس</li>
              <li>شوێن و گەڕەک، لۆکەیشنی GPS یان بەستەری Google Maps</li>
              <li>ژمارەی مۆبایل و پەیوەندی</li>
              <li>دیاریکردنی زۆن (Zone) یان مەندوب و شۆفێری بەرپرس</li>
              <li>یاخود هەر خشتە و فۆڕمێکی تر کە لە خەیاڵتایە</li>
            </ul>
          </div>

          <div style="font-size: 0.78rem; color: var(--text-muted, #64748b);">
            💡 تێبینی: کۆدی تەواوی پێشوو وەک پارێزراو لە فایلی <code>view-markets.backup.js</code> هەڵگیراوە.
          </div>
        </div>

      </div>
    `;
  }

  function stop() {
    // پاککردنەوەی هەر تایمەر یان ئیڤێنتێک لە کاتی گۆڕینی تاب
  }

  return {
    render,
    stop
  };
})();
