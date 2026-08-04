-- ============================================
-- 薄想接单博客 · AI 建站工作台升级（整体复制运行即可）
-- 使用方法：Supabase Dashboard → SQL Editor → 粘贴全部 → Run
-- 本脚本可重复执行，不会影响已有数据
-- ============================================

-- 1. 建站表新增「网站内容」字段（工作台生成的完整 HTML 存在这里）
alter table public.sites add column if not exists content_html text;

-- 2. 游客现在可以在工作台「一键发布」（点击发布 → 立即显示域名，自动上线）
--    原来只允许提交待审核，现在允许直接发布为 published；后台仍可下架/删除
drop policy if exists "sites_anon_insert" on public.sites;
create policy "sites_anon_insert" on public.sites
  for insert to anon
  with check (status in ('pending', 'published'));

-- 3. 站点配置表新增 AI 密钥字段说明（管理员在后台「站点设置」里填写 agnes_api_key）
--    无需建列：site_config 是 key/value 结构，直接新增一行即可
insert into public.site_config (key, value) values ('agnes_api_key', '')
  on conflict (key) do nothing;