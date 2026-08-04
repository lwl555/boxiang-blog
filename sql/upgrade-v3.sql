-- ============================================
-- 薄想接单博客 · 后台「立即上线」升级（整体复制运行即可）
-- 使用方法：Supabase Dashboard → SQL Editor → 粘贴全部 → Run
-- 本脚本可重复执行，不会影响已有数据
-- ============================================

-- 1. 建站表新增「上线时间」字段（记录后台手动发布到 GitHub Pages 的时间）
alter table public.sites add column if not exists deployed_at timestamptz;

-- 2. 站点配置表新增「GitHub 部署令牌」键（管理员在后台「站点设置」里填写）
insert into public.site_config (key, value) values ('ghp_deploy', '')
  on conflict (key) do nothing;

-- 3. 安全加固：部署令牌对游客不可见，其余配置保持公开读取
drop policy if exists "config_public_read" on public.site_config;
create policy "config_public_read" on public.site_config
  for select to anon, authenticated
  using (key <> 'ghp_deploy');

-- 4. 管理员可读取全部配置（含部署令牌），写入权限已有，无需改动
drop policy if exists "config_admin_select_all" on public.site_config;
create policy "config_admin_select_all" on public.site_config
  for select to authenticated
  using ((auth.jwt() ->> 'email') in ('3342689223@qq.com'));