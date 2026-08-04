-- ============================================
-- 薄想接单博客 · 免费 AI 建站功能 + 权限加固（整体复制运行即可）
-- 使用方法：Supabase Dashboard → SQL Editor → 粘贴全部 → Run
-- 管理员邮箱：3342689223@qq.com（如需增加管理员，把邮箱加进下面的 in 列表）
-- 本脚本可重复执行，不会影响已有数据
-- ============================================

-- 1. 建站申请表（游客在前台提交，管理员后台审核）
create table if not exists public.sites (
  id bigint generated always as identity primary key,
  title text not null,
  slug text not null unique,
  description text,
  purpose text not null default '个人名片' check (purpose in ('个人名片','作品集','小店展示','博客','其他')),
  theme text not null default '朱砂' check (theme in ('朱砂','墨绿','琥珀','玫瑰褐')),
  features jsonb not null default '[]'::jsonb,
  contact text,
  client_id text not null,
  status text not null default 'pending' check (status in ('pending','published','rejected')),
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- 2. 防刷限额触发器（同一浏览器最多 3 个，全站每天最多 100 个）
create or replace function public.check_site_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.sites where client_id = new.client_id) >= 3 then
    raise exception '同一设备最多免费创建 3 个网站，请先等审核结果';
  end if;
  if (select count(*) from public.sites where created_at::date = current_date) >= 100 then
    raise exception '今日免费建站名额已用完，明天再来吧';
  end if;
  return new;
end;
$$;

drop trigger if exists sites_limit_before_insert on public.sites;
create trigger sites_limit_before_insert
before insert on public.sites
for each row execute function public.check_site_limit();

-- 3. 建站表权限（RLS）
alter table public.sites enable row level security;

-- 游客只能提交"待审核"的建站申请
drop policy if exists "sites_anon_insert" on public.sites;
create policy "sites_anon_insert" on public.sites
  for insert to anon
  with check (status = 'pending');

-- 所有人可阅读已上线（published）的网站信息
drop policy if exists "sites_public_read" on public.sites;
create policy "sites_public_read" on public.sites
  for select to anon, authenticated
  using (status = 'published');

-- 仅管理员可查看/审核/删除所有建站申请
drop policy if exists "sites_admin_all" on public.sites;
create policy "sites_admin_all" on public.sites
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('3342689223@qq.com'))
  with check ((auth.jwt() ->> 'email') in ('3342689223@qq.com'));

-- ============ 4. 权限加固：以下把旧规则收紧到"仅管理员邮箱" ============
-- 之前任何登录用户都能管后台，现在只有 3342689223@qq.com 可以

-- 接单需求表
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('3342689223@qq.com'))
  with check ((auth.jwt() ->> 'email') in ('3342689223@qq.com'));

-- 作品/文章表
drop policy if exists "posts_admin_all" on public.posts;
create policy "posts_admin_all" on public.posts
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('3342689223@qq.com'))
  with check ((auth.jwt() ->> 'email') in ('3342689223@qq.com'));

-- 站点配置表（读保持公开，写仅管理员）
drop policy if exists "config_admin_insert" on public.site_config;
create policy "config_admin_insert" on public.site_config
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') in ('3342689223@qq.com'));

drop policy if exists "config_admin_update" on public.site_config;
create policy "config_admin_update" on public.site_config
  for update to authenticated
  using ((auth.jwt() ->> 'email') in ('3342689223@qq.com'))
  with check ((auth.jwt() ->> 'email') in ('3342689223@qq.com'));

drop policy if exists "config_admin_delete" on public.site_config;
create policy "config_admin_delete" on public.site_config
  for delete to authenticated
  using ((auth.jwt() ->> 'email') in ('3342689223@qq.com'));