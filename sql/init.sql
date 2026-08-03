-- ============================================
-- 薄想接单博客 · 数据库初始化
-- 使用方法：Supabase Dashboard → SQL Editor → 粘贴全部 → Run
-- 执行后请到 Authentication → Users → Add user 添加管理员账号
-- ============================================

-- 1. 接单需求表
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  name text not null,
  contact text not null,
  type text,
  budget text,
  description text,
  status text not null default 'new' check (status in ('new','processing','done')),
  created_at timestamptz not null default now()
);

-- 2. 内容表（作品 + 博客）
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null default 'work' check (category in ('work','blog')),
  cover text,
  summary text,
  tags text,
  content text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. 站点配置表
create table if not exists public.site_config (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- ============ 权限规则（RLS） ============
alter table public.orders enable row level security;
alter table public.posts enable row level security;
alter table public.site_config enable row level security;

-- 游客只能提交接单需求（只能插入，不能读别人的）
drop policy if exists "orders_anon_insert" on public.orders;
create policy "orders_anon_insert" on public.orders
  for insert to anon
  with check (true);

-- 管理员可查看/修改/删除订单
drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all to authenticated
  using (true) with check (true);

-- 作品/文章：所有人可读已发布的
drop policy if exists "posts_public_read" on public.posts;
create policy "posts_public_read" on public.posts
  for select to anon, authenticated
  using (published = true);

-- 管理员可增删改所有内容（含草稿）
drop policy if exists "posts_admin_all" on public.posts;
create policy "posts_admin_all" on public.posts
  for all to authenticated
  using (true) with check (true);

-- 站点配置：所有人可读
drop policy if exists "config_public_read" on public.site_config;
create policy "config_public_read" on public.site_config
  for select to anon, authenticated
  using (true);

-- 站点配置：仅管理员可改
drop policy if exists "config_admin_write" on public.site_config;
create policy "config_admin_write" on public.site_config
  for insert, update, delete to authenticated
  using (true) with check (true);

-- ============ 默认数据 ============
insert into public.site_config (key, value) values
  ('nickname', '薄想'),
  ('about_text', '一个把创意做成实物的接单工作室。无论你是想做网站、剪视频、还是用 AI 生成画面，都可以把需求丢给我，我来帮你落地。'),
  ('douyin_id', '薄想30786753040'),
  ('wechat_id', '超有用的林'),
  ('hero_tag', '✦ 创意接单工作室'),
  ('hero_title', '把想法，做成会发光 的作品'),
  ('hero_sub', '网站开发 · 视频创作 · AI 绘画 · 设计落地'),
  ('services', '[{"icon":"🌐","title":"网站开发","desc":"个人主页、博客、商城、企业官网，从设计到上线一条龙。"},{"icon":"🎬","title":"视频创作","desc":"剪辑、包装、AI 视频生成，让你的内容更出彩。"},{"icon":"🎨","title":"AI 绘画","desc":"插画、海报、三视图、道具设定，AI 快速出图。"},{"icon":"🚀","title":"其他定制","desc":"脚本写作、公众号排版、自动化工具，有需求尽管说。"}]')
on conflict (key) do nothing;