-- =========================================================
--  داخستنی پڕۆژەی دووەم — لیستەکان (usersv2, zonesv2, vehiclesv2, professions, notifications)
--  ئەم SQL یە لە SQL Editor ی پڕۆژەی *لیستەکان* جێبەجێ بکە:
--  https://gyxfgtoedunvkduslhld.supabase.co
--
--  ⚠️ تەنها پاش جێبەجێکردنی فەنکشنی gateway و دانانی GATEWAY_URL
--     لە config.js جێبەجێی بکە — ئەگینا ئەپەکە وەستاوە!
--
--  گرنگترینی ئەمە: usersv2 — تێپەڕەوشە (PIN) ی هەموو بەکارهێنەران لەوێدایە!
-- =========================================================

-- ١. چالاککردنی RLS لەسەر هەموو خشتەکان
alter table public.usersv2 enable row level security;
alter table public.zonesv2 enable row level security;
alter table public.vehiclesv2 enable row level security;
alter table public.professions enable row level security;
alter table public.notifications enable row level security;

-- ٢. لابردنی هەموو مۆڵەتەکان لە ڕۆڵە گشتییەکان
revoke all on public.usersv2 from anon;
revoke all on public.usersv2 from authenticated;
revoke all on public.zonesv2 from anon;
revoke all on public.zonesv2 from authenticated;
revoke all on public.vehiclesv2 from anon;
revoke all on public.vehiclesv2 from authenticated;
revoke all on public.professions from anon;
revoke all on public.professions from authenticated;
revoke all on public.notifications from anon;
revoke all on public.notifications from authenticated;

-- ٣. سڕینەوەی پۆلیسی کۆن ئەگەر هەبوو
drop policy if exists "public access" on public.usersv2;
drop policy if exists "anon access" on public.usersv2;
drop policy if exists "enable all for all" on public.usersv2;
drop policy if exists "public access" on public.zonesv2;
drop policy if exists "public access" on public.vehiclesv2;
drop policy if exists "public access" on public.professions;
drop policy if exists "public access" on public.notifications;

-- تێبینی: فەنکشنی gateway بە service_role کار دەکات کە بەسەر RLS تێپەڕ دەبێت —
-- بۆیە سیستەمەکە بە ئاسایی کاردەکات، بەڵام کەسی تر بە کلیدی گشتی هیچ ناتوانێت.
