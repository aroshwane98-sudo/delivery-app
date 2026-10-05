-- =========================================================
--  داخستنی پڕۆژەی یەکەم — delivery_records
--  ئەم SQL یە لە SQL Editor ی پڕۆژەی *تۆمارەکان* جێبەجێ بکە:
--  https://rivwvzdjfotkjhpuwuaf.supabase.co
--
--  ⚠️ تەنها پاش جێبەجێکردنی فەنکشنی gateway و دانانی GATEWAY_URL
--     لە config.js جێبەجێی بکە — ئەگینا ئەپەکە وەستاوە!
-- =========================================================

-- ١. چالاککردنی RLS — بەبێ هیچ پۆلیسی = هیچ کەس بە کلیدی گشتی نایبینێت
alter table public.delivery_records enable row level security;

-- ٢. لابردنی هەموو مۆڵەتەکان لە ڕۆڵە گشتییەکان
revoke all on public.delivery_records from anon;
revoke all on public.delivery_records from authenticated;

-- ٣. دڵنیابوون لەوەی هیچ پۆلیسی کۆن نەماوە کە دەستڕاگەیشتن دەدات
drop policy if exists "public access" on public.delivery_records;
drop policy if exists "anon access" on public.delivery_records;
drop policy if exists "enable all for all" on public.delivery_records;

-- تێبینی: فەنکشنی gateway بە service_role کار دەکات کە بەسەر RLS تێپەڕ دەبێت —
-- بۆیە سیستەمەکە بە ئاسایی کاردەکات، بەڵام کەسی تر بە کلیدی گشتی هیچ ناتوانێت.
