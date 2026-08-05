// ===== 后台管理逻辑 =====
(function () {
  const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
  const sb = window.supabase.createClient(url, key);
  const T = window.SUPABASE_TABLES;
  const $ = (id) => document.getElementById(id);
  const fmt = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')} ${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`;
  };

  let editingId = null;
  const STATUS = { new: '新需求', processing: '处理中', done: '已完成' };

  function showLogin() { $('loginView').hidden = false; $('adminView').hidden = true; }
  function showAdmin() { $('loginView').hidden = true; $('adminView').hidden = false; }

  // 登录
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('lgBtn'), tip = $('lgTip');
    btn.disabled = true; btn.textContent = '登录中…'; tip.textContent = '';
    const { error } = await sb.auth.signInWithPassword({
      email: $('lgEmail').value.trim(),
      password: $('lgPass').value
    });
    btn.disabled = false; btn.textContent = '登 录';
    if (error) { tip.textContent = '登录失败：' + error.message; tip.style.color = '#ff6b6b'; }
    else { showAdmin(); loadAll(); }
  });

  $('logoutBtn').addEventListener('click', async () => {
    try { await sb.auth.signOut(); } catch (e) {}
    clearAuthStorage();
    showLogin();
  });

  function clearAuthStorage() {
    try { Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  }

  // 会话恢复：校验登录状态是否真的有效（防止残留的过期会话导致操作失败）
  sb.auth.getSession().then(async ({ data }) => {
    if (data.session) {
      try {
        const { error } = await sb.auth.refreshSession();
        if (error) throw new Error(error.message || 'session expired');
        showAdmin(); loadAll();
      } catch (e) {
        try { await sb.auth.signOut(); } catch (e2) {}
        clearAuthStorage();
        showLogin();
      }
    } else {
      showLogin();
    }
  });

  // Tab 切换
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      ['orders', 'posts', 'sites', 'config'].forEach((k) => { $('tab-' + k).hidden = k !== t.dataset.tab; });
      if (t.dataset.tab === 'posts') loadPosts();
      if (t.dataset.tab === 'sites') loadSites();
      if (t.dataset.tab === 'config') loadConfigForm();
    });
  });

  // ===== 订单 =====
  async function loadOrders() {
    const list = $('orderList');
    list.innerHTML = '<div class="empty-tip">加载中…</div>';
    const { data, error } = await sb.from(T.orders).select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = '<div class="empty-tip">加载失败：' + error.message + '</div>'; return; }
    const filter = $('orderFilter').value;
    const rows = filter ? (data || []).filter((o) => o.status === filter) : (data || []);
    if (!rows.length) { list.innerHTML = '<div class="empty-tip">暂无接单需求</div>'; return; }
    list.innerHTML = rows.map((o) => `
      <div class="order-card glass">
        <div class="order-top">
          <div class="order-title">
            <b>${o.name || '匿名'}</b>
            <span class="o-type">${o.type || '其他'}</span>
          </div>
          <span class="o-status ${o.status || 'new'}">${STATUS[o.status] || '新需求'}</span>
        </div>
        <div class="order-meta">
          <span>📞 ${o.contact || '未留'}</span>
          ${o.budget ? `<span>💰 ${o.budget}</span>` : ''}
          <span>🕐 ${fmt(o.created_at)}</span>
        </div>
        <div class="order-desc">${o.description || '（无描述）'}</div>
        <div class="order-actions">
          <select data-id="${o.id}" class="status-sel">
            <option value="new" ${o.status === 'new' ? 'selected' : ''}>新需求</option>
            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>处理中</option>
            <option value="done" ${o.status === 'done' ? 'selected' : ''}>已完成</option>
          </select>
          <button class="mini-btn" data-copy="${o.contact}">复制联系方式</button>
          <button class="mini-btn danger" data-del="${o.id}">删除</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.status-sel').forEach((s) => {
      s.addEventListener('change', async () => {
        const { error } = await sb.from(T.orders).update({ status: s.value }).eq('id', s.dataset.id);
        if (!error) loadOrders(); else alert('更新失败：' + error.message);
      });
    });
    list.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('确定删除这条需求？')) return;
        const { error } = await sb.from(T.orders).delete().eq('id', b.dataset.del);
        if (!error) loadOrders(); else alert('删除失败：' + error.message);
      });
    });
    list.querySelectorAll('[data-copy]').forEach((b) => {
      b.addEventListener('click', () => {
        navigator.clipboard.writeText(b.dataset.copy || '').then(() => { b.textContent = '已复制 ✓'; setTimeout(() => { b.textContent = '复制联系方式'; }, 1500); });
      });
    });
  }
  $('refreshOrders').addEventListener('click', loadOrders);
  $('orderFilter').addEventListener('change', loadOrders);

  // ===== 内容 =====
  async function loadPosts() {
    const list = $('postList');
    list.innerHTML = '<div class="empty-tip">加载中…</div>';
    const { data, error } = await sb.from(T.posts).select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = '<div class="empty-tip">加载失败：' + error.message + '</div>'; return; }
    if (!data || !data.length) { list.innerHTML = '<div class="empty-tip">还没有内容，点右上角新建</div>'; return; }
    list.innerHTML = data.map((p) => `
      <div class="post-row glass" data-edit="${p.id}">
        <div>
          <h3><span class="p-dot ${p.published ? 'on' : 'off'}"></span>${p.title}<span class="p-cat">${p.category === 'work' ? '作品' : '博客'}</span></h3>
          <div class="p-meta">${fmt(p.created_at)}${p.tags ? ' · ' + p.tags : ''}</div>
        </div>
        <div class="p-meta">${p.published ? '已发布' : '草稿'}</div>
      </div>`).join('');
    list.querySelectorAll('[data-edit]').forEach((r) => {
      r.addEventListener('click', () => openEditor(data.find((p) => p.id === +r.dataset.edit)));
    });
  }

  function openEditor(p) {
    editingId = p ? p.id : null;
    $('peTitle').textContent = p ? '编辑：' + p.title : '新建内容';
    $('pePostTitle').value = p ? p.title : '';
    $('peCategory').value = p ? p.category : 'work';
    $('peCover').value = p && p.cover ? p.cover : '';
    $('peSummary').value = p && p.summary ? p.summary : '';
    $('peTags').value = p && p.tags ? p.tags : '';
    $('peContent').value = p && p.content ? p.content : '';
    $('pePublished').checked = p ? !!p.published : true;
    $('peDelete').hidden = !p;
    $('postEditor').hidden = false;
  }
  $('newPost').addEventListener('click', () => openEditor(null));
  $('peClose').addEventListener('click', () => { $('postEditor').hidden = true; });
  $('peBackdrop').addEventListener('click', () => { $('postEditor').hidden = true; });

  $('peSave').addEventListener('click', async () => {
    const title = $('pePostTitle').value.trim();
    if (!title) { alert('请填写标题'); return; }
    const body = {
      title,
      category: $('peCategory').value,
      cover: $('peCover').value.trim() || null,
      summary: $('peSummary').value.trim() || null,
      tags: $('peTags').value.trim() || null,
      content: $('peContent').value,
      published: $('pePublished').checked
    };
    const btn = $('peSave');
    btn.disabled = true; btn.textContent = '保存中…';
    const { error } = editingId
      ? await sb.from(T.posts).update(body).eq('id', editingId)
      : await sb.from(T.posts).insert(body);
    btn.disabled = false; btn.textContent = '保存';
    if (error) { alert('保存失败：' + error.message); return; }
    $('postEditor').hidden = true;
    loadPosts();
  });

  $('peDelete').addEventListener('click', async () => {
    if (!confirm('确定删除这条内容？')) return;
    const { error } = await sb.from(T.posts).delete().eq('id', editingId);
    if (error) { alert('删除失败：' + error.message); return; }
    $('postEditor').hidden = true;
    loadPosts();
  });

  // ===== 建站审核 =====
  const SITE_STATUS = { pending: '待审核', published: '已上线', rejected: '已拒绝', offline: '已下架' };
  let siteRows = [];

  async function loadSites() {
    const list = $('siteList');
    list.innerHTML = '<div class="empty-tip">加载中…</div>';
    const { data, error } = await sb.from(T.sites).select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = '<div class="empty-tip">加载失败：' + error.message + '</div>'; return; }
    siteRows = data || [];
    const filter = $('siteFilter').value;
    const rows = filter ? siteRows.filter((s) => s.status === filter) : siteRows;
    if (!rows.length) { list.innerHTML = '<div class="empty-tip">暂无建站申请</div>'; return; }
    list.innerHTML = rows.map((s) => {
      const feats = Array.isArray(s.features) ? s.features.join(' / ') : '';
      return `
      <div class="site-admin-card glass">
        <div class="site-admin-top">
          <div>
            <b>${s.title || '未命名'}</b>
            <span class="s-purpose">${s.purpose || '其他'} · ${s.theme || ''}</span>
          </div>
          <span class="o-status ${s.status || 'pending'}">${SITE_STATUS[s.status] || '待审核'}</span>
        </div>
        <p class="site-admin-desc">${s.description || ''}</p>
        <div class="site-admin-meta">
          <span>🔗 /sites/${s.slug}/</span>
          ${s.contact ? `<span>📞 ${s.contact}</span>` : ''}
          <span>🕐 ${fmt(s.created_at)}</span>
          ${feats ? `<span>✨ ${feats}</span>` : ''}
          ${s.status === 'published' ? `<span class="dep-flag ${s.deployed_at ? 'on' : ''}">${s.deployed_at ? '🚀 已上线 ' + fmt(s.deployed_at) : '⏳ 待上线'}</span>` : ''}
        </div>
        <div class="order-actions">
          ${s.status === 'pending' ? `<button class="mini-btn ok" data-approve="${s.id}">✅ 通过审核</button>` : ''}
          ${s.status === 'published' ? `<button class="mini-btn ok" data-publish-site="${s.id}">🚀 ${s.deployed_at ? '重新上线' : '立即上线'}</button>` : ''}
          ${s.status === 'published' ? `<button class="mini-btn" data-offline="${s.id}">⏬ 下架</button>` : ''}
          ${s.status === 'offline' ? `<button class="mini-btn ok" data-republish="${s.id}">🔁 重新上架</button>` : ''}
          ${s.status !== 'rejected' ? `<button class="mini-btn" data-reject="${s.id}">❌ 拒绝</button>` : ''}
          <button class="mini-btn" data-preview="${s.id}">👁 预览代码</button>
          <button class="mini-btn danger" data-del-site="${s.id}">删除</button>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('[data-approve]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('确认通过？通过后点击「🚀 立即上线」把网站发布到线上。')) return;
        const { error } = await sb.from(T.sites)
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', b.dataset.approve);
        if (error) alert('操作失败：' + error.message); else { alert('✅ 已通过审核！点击「🚀 立即上线」发布到线上'); loadSites(); }
      });
    });
    list.querySelectorAll('[data-reject]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('确认拒绝该建站申请？')) return;
        const { error } = await sb.from(T.sites).update({ status: 'rejected' }).eq('id', b.dataset.reject);
        if (error) alert('操作失败：' + error.message); else loadSites();
      });
    });
    list.querySelectorAll('[data-publish-site]').forEach((b) => {
      b.addEventListener('click', async () => {
        const s = siteRows.find((x) => x.id === +b.dataset.publishSite);
        if (!s) return;
        let token = null;
        try { token = await getDeployToken(); }
        catch (e) { alert('读取部署令牌失败：' + e.message); return; }
        if (!token) {
          alert('请先到「站点设置」填写 GitHub 部署令牌');
          document.querySelector('.tab[data-tab="config"]').click();
          return;
        }
        b.disabled = true; const old = b.textContent; b.textContent = '🚀 上线中…';
        try {
          await deploySiteToGithub(token, s);
          const { error } = await sb.from(T.sites).update({ deployed_at: new Date().toISOString() }).eq('id', s.id);
          if (error) throw new Error(error.message);
          alert('✅ 上线成功！访问：https://lwl555.github.io/boxiang-blog/sites/' + s.slug + '/');
        } catch (e) { alert('上线失败：' + e.message); }
        b.disabled = false; b.textContent = old;
        loadSites();
      });
    });
    list.querySelectorAll('[data-offline]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('确认下架？下架后前台不再展示，线上文件也会立即移除。')) return;
        const s = siteRows.find((x) => x.id === +b.dataset.offline);
        let delMsg = '';
        if (s) {
          try {
            const token = await getDeployToken();
            if (token) await removeSiteFile(token, s.slug);
            else delMsg = '（未配置部署令牌，线上文件未移除）';
          } catch (e) { delMsg = '（线上文件移除失败：' + e.message + '）'; }
        }
        const { error } = await sb.from(T.sites).update({ status: 'offline' }).eq('id', b.dataset.offline);
        if (error) alert('操作失败：' + error.message); else { alert('已下架' + delMsg); loadSites(); }
      });
    });
    list.querySelectorAll('[data-republish]').forEach((b) => {
      b.addEventListener('click', async () => {
        const s = siteRows.find((x) => x.id === +b.dataset.republish);
        if (!s) return;
        if (!confirm('确认重新上架？网站会重新发布到线上。')) return;
        let token = null;
        try { token = await getDeployToken(); } catch (e) { alert('读取部署令牌失败：' + e.message); return; }
        if (!token) { alert('请先到「站点设置」填写 GitHub 部署令牌'); document.querySelector('.tab[data-tab="config"]').click(); return; }
        b.disabled = true; const oldT = b.textContent; b.textContent = '上架中…';
        try {
          await deploySiteToGithub(token, s);
          const { error } = await sb.from(T.sites).update({ status: 'published', deployed_at: new Date().toISOString() }).eq('id', s.id);
          if (error) throw new Error(error.message);
          alert('✅ 重新上架成功！访问：https://lwl555.github.io/boxiang-blog/sites/' + s.slug + '/');
        } catch (e) { alert('上架失败：' + e.message); }
        b.disabled = false; b.textContent = oldT;
        loadSites();
      });
    });
    list.querySelectorAll('[data-preview]').forEach((b) => {
      b.addEventListener('click', () => {
        const s = siteRows.find((x) => x.id === +b.dataset.preview);
        if (!s) return;
        const code = (s.content_html && s.content_html.trim()) ? s.content_html : window.BXSiteGen.generateSiteHtml(s);
        $('scmTitle').textContent = s.title + ' · 网站代码';
        $('scmCode').value = code;
        $('siteCodeModal').hidden = false;
      });
    });
    list.querySelectorAll('[data-del-site]').forEach((b) => {
      b.addEventListener('click', async () => {
        const s = siteRows.find((x) => x.id === +b.dataset.delSite);
        if (!s) return;
        if (!confirm('确定删除「' + (s.title || '该网站') + '」？网站记录、访客提交的数据、后端令牌会一并删除。')) return;
        const msgs = [];
        try {
          if (s.slug) {
            const r1 = await sb.from(T.site_data).delete().eq('slug', s.slug);
            if (r1.error && !/does not exist|Could not find/i.test(r1.error.message)) msgs.push('表单数据：' + r1.error.message);
            const r2 = await sb.from(T.site_backend).delete().eq('slug', s.slug);
            if (r2.error && !/does not exist|Could not find/i.test(r2.error.message)) {
              msgs.push('后端令牌：' + r2.error.message + (/security|policy/i.test(r2.error.message) ? '（运行 upgrade-v6.sql 后即可）' : ''));
            }
          }
          try {
            const token = await getDeployToken();
            if (token) await removeSiteFile(token, s.slug);
          } catch (e) { msgs.push('线上文件未移除：' + e.message); }
        } catch (e) { msgs.push('清理异常：' + e.message); }
        const { error } = await sb.from(T.sites).delete().eq('id', s.id);
        if (error) alert('删除失败：' + error.message);
        else {
          alert('已删除' + (msgs.length ? '（部分清理未完成：' + msgs.join('；') + '）' : '，网站记录、表单数据、后端令牌均已清除'));
          loadSites();
        }
      });
    });
  }
  $('refreshSites').addEventListener('click', loadSites);
  $('siteFilter').addEventListener('change', loadSites);
  $('scmClose').addEventListener('click', () => { $('siteCodeModal').hidden = true; });
  $('scmBackdrop').addEventListener('click', () => { $('siteCodeModal').hidden = true; });
  $('scmCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('scmCode').value);
      const b = $('scmCopy'); b.textContent = '已复制 ✓';
      setTimeout(() => { b.textContent = '复制代码'; }, 1500);
    } catch (e) { alert('复制失败'); }
  });

  // ===== 立即上线（GitHub Pages 部署） =====
  function utf8ToB64(str) {
    let bin = '';
    for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  async function ghApi(token, method, url, body) {
    const r = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
      body: body ? JSON.stringify(body) : undefined
    });
    return r;
  }
  async function getDeployToken() {
    const { data, error } = await sb.from(T.config).select('value').eq('key', 'ghp_deploy').limit(1);
    if (error) throw new Error(error.message);
    return (data && data[0] && data[0].value || '').trim() || null;
  }
  async function ghErr(r) {
    let msg = 'HTTP ' + r.status;
    try { const j = await r.json(); if (j && j.message) msg = j.message; } catch (e) {}
    return msg;
  }
  async function deploySiteToGithub(token, s) {
    const html = (s.content_html && s.content_html.trim()) ? s.content_html : window.BXSiteGen.generateSiteHtml(s);
    const relPath = 'sites/' + s.slug + '/index.html';
    const api = 'https://api.github.com/repos/lwl555/boxiang-blog/contents/' + encodeURIComponent(relPath);
    const r0 = await ghApi(token, 'GET', api);
    let sha = null;
    if (r0.ok) sha = (await r0.json()).sha;
    const body = { message: '发布免费网站 ' + relPath, content: utf8ToB64(html) };
    if (sha) body.sha = sha;
    const r = await ghApi(token, 'PUT', api, body);
    if (!r.ok) throw new Error(await ghErr(r));

    if (s.backend_html && s.backend_html.trim()) {
      const relAdmin = 'sites/' + s.slug + '/admin.html';
      const api2 = 'https://api.github.com/repos/lwl555/boxiang-blog/contents/' + encodeURIComponent(relAdmin);
      const r1 = await ghApi(token, 'GET', api2);
      let sha2 = null;
      if (r1.ok) sha2 = (await r1.json()).sha;
      const body2 = { message: '发布后台管理页 ' + relAdmin, content: utf8ToB64(s.backend_html) };
      if (sha2) body2.sha = sha2;
      const r2 = await ghApi(token, 'PUT', api2, body2);
      if (!r2.ok) throw new Error(await ghErr(r2));
    }
    return relPath;
  }
  async function removeSiteFile(token, slug) {
    const done = [];
    for (const file of ["index.html", "admin.html"]) {
      const relPath = 'sites/' + slug + '/' + file;
      const api = 'https://api.github.com/repos/lwl555/boxiang-blog/contents/' + encodeURIComponent(relPath);
      const r0 = await ghApi(token, 'GET', api);
      if (!r0.ok) continue;
      const info = await r0.json();
      const r = await ghApi(token, 'DELETE', api, { message: '下架网站 ' + relPath, sha: info.sha });
      if (!r.ok) throw new Error(await ghErr(r));
      done.push(relPath);
    }
    return done.length ? done.join(', ') : 'skip';
  }

  // ===== 站点设置 =====
  const CONFIG_DEFS = [
    ['nickname', '昵称', '薄想', '关于区块显示的名字'],
    ['about_text', '个人简介', '一个把创意做成实物的接单工作室。无论你是想做网站、剪视频、还是用 AI 生成画面，都可以把需求丢给我，我来帮你落地。', '关于我区块的段落文字'],
    ['douyin_id', '抖音号', '薄想30786753040', '首页展示的抖音账号'],
    ['wechat_id', '公众号', '超有用的林', '首页展示的微信公众号'],
    ['hero_tag', '首页标签', '✦ 创意接单工作室', '首页顶部小标签'],
    ['hero_title', '首页大标题', '把想法，做成会发光 的作品', '首页主标题，用两个空格分行的位置可换行'],
    ['hero_sub', '首页副标题', '网站开发 · 视频创作 · AI 绘画 · 设计落地', '主标题下方一句话'],
    ['agnes_api_key', 'Agnes AI 密钥', '', 'Agnes AI 平台（platform.agnes-ai.cn 注册后创建）的 API Key，填写后游客才可使用 AI 建站工作台（文本/图像/视频三个免费模型）'],
    ['ghp_deploy', 'GitHub 部署令牌', '', '「立即上线」专用：GitHub → Settings → Developer settings → Personal access tokens (classic) 创建，勾选 repo 权限（ghp_ 开头），用于把已审核网站推送到 lwl555/boxiang-blog 的 GitHub Pages'],
    ['services', '服务列表(JSON)', '[{"icon":"🌐","title":"网站开发","desc":"个人主页、博客、商城、企业官网，从设计到上线一条龙。"},{"icon":"🎬","title":"视频创作","desc":"剪辑、包装、AI 视频生成，让你的内容更出彩。"},{"icon":"🎨","title":"AI 绘画","desc":"插画、海报、三视图、道具设定，AI 快速出图。"},{"icon":"🚀","title":"其他定制","desc":"脚本写作、公众号排版、自动化工具，有需求尽管说。"}]', 'JSON 数组，每条含 icon/title/desc']
  ];

  let configKeys = new Set();

  async function loadConfigForm() {
    const form = $('configForm');
    form.innerHTML = '<div class="empty-tip">加载中…</div>';
    const { data, error } = await sb.from(T.config).select('key,value');
    if (error) { form.innerHTML = '<div class="empty-tip">加载失败：' + error.message + '</div>'; return; }
    const map = {};
    configKeys = new Set();
    (data || []).forEach((r) => { map[r.key] = r.value; configKeys.add(r.key); });
    form.innerHTML = CONFIG_DEFS.map(([k, label, def, hint]) => {
      const v = (map[k] ?? def).replace(/"/g, '&quot;');
      return `
      <label>${label}
        <input type="${k === 'ghp_deploy' ? 'password' : 'text'}" data-key="${k}" data-orig="${v}" value="${v}" maxlength="2000" ${k === 'ghp_deploy' ? 'autocomplete="off"' : ''}>
        ${hint ? `<span class="hint">${hint}</span>` : ''}
      </label>`;
    }).join('');
  }

  $('saveConfig').addEventListener('click', async () => {
    const btn = $('saveConfig');
    btn.disabled = true; btn.textContent = '保存中…';
    const inputs = [...document.querySelectorAll('#configForm input[data-key]')];
    const changes = inputs
      .map((inp) => ({ key: inp.dataset.key, val: inp.value, orig: inp.dataset.orig }))
      .filter((c) => c.val !== c.orig);
    let failed = '';
    await Promise.all(changes.map(async (c) => {
      try {
        const { error } = configKeys.has(c.key)
          ? await sb.from(T.config).update({ value: c.val }).eq('key', c.key)
          : await sb.from(T.config).insert({ key: c.key, value: c.val });
        if (error) throw new Error(error.message);
        configKeys.add(c.key);
      } catch (e) {
        const m = String((e && e.message) || '');
        const hint = /row-level security|JWT|invalid claim/i.test(m) ? '登录状态已失效，请点击「退出登录」后重新登录' : m;
        failed = (failed ? failed + '；' : '') + c.key + '：' + hint;
      }
    }));
    btn.disabled = false; btn.textContent = '保存设置';
    if (failed) { alert('保存失败：' + failed); return; }
    inputs.forEach((inp) => { inp.dataset.orig = inp.value; });
    btn.textContent = changes.length ? '已保存 ✓' : '没有修改';
    setTimeout(() => { btn.textContent = '保存设置'; }, 1500);
  });

  async function loadAll() { loadOrders(); loadPosts(); loadSites(); loadConfigForm(); }
})();