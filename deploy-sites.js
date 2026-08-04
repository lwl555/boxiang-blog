// ===== 免费建站 · 子站部署脚本 =====
// 读取 Supabase 中已审核通过（published）的网站 → 本地生成 sites/<slug>/index.html → 推送到 GitHub
// 运行：node deploy-sites.js   （环境变量 DEPLOY_TOKEN_LIST 传 GitHub token，多个用分号分隔）
const fs = require('fs');
const path = require('path');
const SRC = __dirname;
const REPO = 'lwl555/boxiang-blog';
const SB_URL = 'https://wcnssyiqitugqfmcbdhe.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbnNzeWlxaXR1Z3FmbWNiZGhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDEyNzUsImV4cCI6MjA5ODk3NzI3NX0.9EfbEr7BQhZtbOwHJ3IrkOy16kcaxlmzuJuV0A2Z8Eg';

const THEMES = {
  '朱砂':   { bg: '#faf3e6', panel: '#fffdf6', accent: '#c2402b', dark: '#8a2f22', ink: '#33261d', soft: '#6d5c4b' },
  '墨绿':   { bg: '#f3efe2', panel: '#fbf8ee', accent: '#2f5d4a', dark: '#1f4034', ink: '#2c3026', soft: '#5f6b58' },
  '琥珀':   { bg: '#faf0da', panel: '#fffaf0', accent: '#c98a16', dark: '#8f6210', ink: '#3a2d18', soft: '#7a6747' },
  '玫瑰褐': { bg: '#f7ece4', panel: '#fdf7f1', accent: '#a63a3a', dark: '#7c2b2b', ink: '#38251f', soft: '#7d6257' }
};
const FEATURE_ICONS = {
  '作品展示': '🖼️', '服务项目': '🧰', '在线联系': '📮',
  '社交链接': '🔗', '价格清单': '💰', '访客留言': '💬'
};
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function generateSiteHtml(d) {
  const t = THEMES[d.theme] || THEMES['朱砂'];
  const feats = (d.features || []).map((f) => `<div class="feat"><span>${FEATURE_ICONS[f] || '✦'}</span><b>${esc(f)}</b></div>`).join('');
  const purposeTitle = {
    '个人名片': '个人名片', '作品集': '作品与案例', '小店展示': '小店介绍',
    '博客': '最新文章', '其他': '关于我们'
  }[d.purpose] || '关于';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(d.title)}</title>
<style>
:root{--bg:${t.bg};--panel:${t.panel};--accent:${t.accent};--dark:${t.dark};--ink:${t.ink};--soft:${t.soft}}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;line-height:1.8;overflow-x:hidden}
.top{position:sticky;top:0;z-index:9;background:rgba(255,255,255,.82);backdrop-filter:blur(10px);border-bottom:1px solid rgba(0,0,0,.07)}
.top-in{max-width:960px;margin:0 auto;padding:14px 22px;display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:900;font-size:1.15rem;letter-spacing:1px;color:var(--ink)}
.brand b{color:var(--accent)}
.top a{color:var(--accent);text-decoration:none;font-weight:700;font-size:.9rem}
.hero{max-width:960px;margin:0 auto;padding:90px 22px 40px;text-align:center}
.hero .seal{display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:var(--accent);color:#fff;font-size:1.4rem;margin-bottom:18px;box-shadow:0 10px 24px rgba(0,0,0,.14)}
.hero h1{font-size:clamp(1.8rem,5vw,2.8rem);letter-spacing:2px}
.hero p{color:var(--soft);margin-top:16px;font-size:1.05rem;max-width:620px;margin-left:auto;margin-right:auto}
.sec{max-width:960px;margin:44px auto;padding:0 22px}
.sec h2{font-size:1.35rem;padding-left:14px;border-left:5px solid var(--accent);margin-bottom:22px;letter-spacing:1px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.feat{background:var(--panel);border:1px solid rgba(0,0,0,.08);border-radius:14px;padding:22px;text-align:center;box-shadow:0 8px 20px rgba(0,0,0,.05)}
.feat span{font-size:1.7rem;display:block;margin-bottom:8px}
.feat b{font-size:.95rem}
.cta{max-width:960px;margin:56px auto;padding:0 22px;text-align:center}
.cta .box{background:var(--dark);color:#fff;border-radius:20px;padding:44px 26px}
.cta h2{font-size:1.4rem;margin-bottom:10px;letter-spacing:1px}
.cta p{opacity:.85;font-size:.95rem;margin-bottom:24px}
.btn{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;font-weight:800;padding:13px 34px;border-radius:999px;box-shadow:0 10px 24px rgba(0,0,0,.2);transition:transform .2s}
.btn:hover{transform:translateY(-2px)}
footer{max-width:960px;margin:30px auto;padding:26px 22px 40px;text-align:center;color:var(--soft);font-size:.82rem;border-top:1px dashed rgba(0,0,0,.15)}
footer a{color:var(--accent)}
</style>
</head>
<body>
<header class="top">
  <div class="top-in">
    <div class="brand">${esc(d.title)}<b>✦</b></div>
    <a href="#contact">联系我</a>
  </div>
</header>

<section class="hero">
  <div class="seal">✦</div>
  <h1>${esc(d.title)}</h1>
  <p>${esc(d.description)}</p>
</section>

<section class="sec">
  <h2>${esc(purposeTitle)}</h2>
  <div class="grid">${feats}</div>
</section>

<section class="sec" id="contact">
  <h2>联系方式</h2>
  <div class="cta">
    <div class="box">
      <h2>找到我</h2>
      <p>${esc(d.contact)}</p>
      <a class="btn" href="https://lwl555.github.io/boxiang-blog/#order">向薄想工作室下单</a>
    </div>
  </div>
</section>

<footer>
  ${esc(d.title)} · 由 <a href="https://lwl555.github.io/boxiang-blog" target="_blank">薄想工作室</a> 免费生成
</footer>
</body>
</html>`;
}

async function fetchPublishedSites() {
  const url = SB_URL + '/rest/v1/sites?select=*&status=eq.published&order=published_at.desc';
  const r = await fetch(url, {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Accept: 'application/json' }
  });
  if (!r.ok) throw new Error('查询 Supabase 失败：' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function pushFile(token, relPath, content) {
  const api = 'https://api.github.com/repos/' + REPO + '/contents/' + encodeURI(relPath);
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'codex-deploy' };
  let sha = null;
  try {
    const r0 = await fetch(api, { headers });
    if (r0.ok) sha = (await r0.json()).sha;
  } catch (e) {}
  const body = { message: '发布免费网站 ' + relPath, content: Buffer.from(content, 'utf8').toString('base64') };
  if (sha) body.sha = sha;
  const r = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(relPath + ' 推送失败：' + r.status + ' ' + (await r.text()).slice(0, 150));
  return relPath;
}

async function main() {
  const sites = await fetchPublishedSites();
  console.log('已上线网站数：' + sites.length);
  if (!sites.length) { console.log('没有需要部署的网站'); return; }

  const tokens = (process.env.DEPLOY_TOKEN_LIST || '').split(';').filter(Boolean);
  if (!tokens.length) { console.error('缺少 GitHub token：请设置环境变量 DEPLOY_TOKEN_LIST'); process.exit(1); }

  const local = path.join(SRC, 'sites');
  fs.mkdirSync(local, { recursive: true });
  const jobs = [];
  for (const s of sites) {
    const html = generateSiteHtml(s);
    const dir = path.join(local, s.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    jobs.push({ slug: s.slug, content: html });
    console.log('已生成 sites/' + s.slug + '/index.html ← ' + s.title);
  }

  let lastErr = null;
  for (const token of tokens) {
    let fail = false, okCount = 0;
    for (const j of jobs) {
      try {
        await pushFile(token, 'sites/' + j.slug + '/index.html', j.content);
        okCount++;
        console.log('OK   sites/' + j.slug + '/index.html');
      } catch (e) {
        fail = true; lastErr = e.message; console.log('FAIL ' + e.message);
      }
    }
    if (!fail) { console.log('ALL_DONE ok=' + okCount + '，访问：https://lwl555.github.io/boxiang-blog/sites/<slug>/'); return; }
    console.log('该 token 有失败，尝试下一个');
  }
  console.error('ALL_TOKENS_FAILED', lastErr);
  process.exit(1);
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });