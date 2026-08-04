# 薄想接单博客 · 项目说明

一个以接单为主的个人博客网站：暖纸手作风（米色纸底 + 朱砂红/琥珀金，避开 AI 常用蓝色），带 3D 动画背景、接单表单、作品展示、博客、免费 AI 建站和后台管理。

## 技术栈
- 前端：原生 HTML/CSS/JS + Three.js（3D 动画）+ Supabase JS SDK
- 后端：Supabase（免费档，现有项目 wcnssyiqitugqfmcbdhe）
- 部署：GitHub Pages（lwl555/boxiang-blog）

## 目录结构
- `index.html` —— 前台主页（首页/关于/服务/免费建站/作品/博客/接单表单）
- `admin.html` —— 后台管理（登录后管理订单、内容、建站审核、站点设置）
- `css/` —— 样式（前台 + 后台）
- `js/` —— 逻辑（3D 场景、前台、建站生成器、后台、Supabase 配置）
- `sql/init.sql` —— 数据库初始化脚本（全新部署用）
- `sql/sites.sql` —— 免费建站功能 + 权限加固脚本（现有项目直接复制运行）
- `deploy-sites.js` —— 把审核通过的免费网站生成并推送到 GitHub Pages 子路径

## 上线前需要你做 2 步（约 3 分钟）

### 第 1 步：执行建表 SQL
1. 打开 https://supabase.com/dashboard → 登录 → 进入现有项目（wcnssyiqitugqfmcbdhe）
2. 左侧菜单选 **SQL Editor**（SQL 编辑器）→ 点 **New query**（新建查询）
3. 把 `sql/sites.sql` 的全部内容粘贴进去（已有表的话重跑也不会报错）
4. 点 **Run**（运行），看到绿色成功提示即可

### 第 2 步：创建管理员账号
1. 左侧菜单选 **Authentication**（身份验证）→ **Users**（用户）
2. 点 **Add user**（添加用户）→ 填邮箱和密码（这就是后台登录账号）
3. 保存即可

完成后访问 `admin.html`，用刚创建的邮箱密码登录，即可：
- 📋 查看/处理接单需求（改状态、复制联系方式、删除）
- 📝 管理作品和博客（增删改、发布/隐藏）
- 🌐 审核免费建站申请（通过/拒绝/预览代码/删除）
- ⚙️ 修改站点内容（昵称、简介、抖音号、公众号、服务列表等）

## 免费 AI 建站（像秒哒一样）
- 游客在前台"免费建站"区块填名称、用途、一句话介绍、配色、功能，实时预览并提交
- 系统自动生成独立网址：`https://lwl555.github.io/boxiang-blog/sites/<bx-xxxxxx>/`
- 防刷限制：同一设备最多 3 个，全站每天 100 个（SQL 触发器控制）
- 管理员在后台"建站审核"通过后，运行部署脚本生成网站文件：
  `node deploy-sites.js`（需先设置环境变量 `DEPLOY_TOKEN_LIST=你的GitHub token`）

## 权限说明
- 游客：只能提交接单需求、提交待审核的建站申请、阅读已上线的网站
- 管理员（3342689223@qq.com）：后台全部管理功能
- 数据安全由 Supabase RLS 策略保护，anon key 在浏览器公开是正常的

## 部署
由 Codex 推送到 GitHub Pages：
- 前台：https://lwl555.github.io/boxiang-blog/
- 后台：https://lwl555.github.io/boxiang-blog/admin.html

## 配色
暖纸米色底 + 朱砂红主色 + 琥珀金点缀 + 墨绿辅助，刻意避开蓝色。