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
    await sb.auth.signOut();
    showLogin();
  });

  // 会话恢复
  sb.auth.getSession().then(({ data }) => {
    if (data.session) { showAdmin(); loadAll(); }
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
  const SITE_STATUS = { pending: '待审核', published: '已上线', rejected: '已拒绝' };
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
        </div>
        <div class="order-actions">
          ${s.status === 'pending' ? `<button class="mini-btn ok" data-approve="${s.id}">✅ 通过并上线</button>` : ''}
          ${s.status !== 'rejected' ? `<button class="mini-btn" data-reject="${s.id}">❌ 拒绝</button>` : ''}
          <button class="mini-btn" data-preview="${s.id}">👁 预览代码</button>
          <button class="mini-btn danger" data-del-site="${s.id}">删除</button>
        </div>
      </div>`;
    }).join('');

    list.querySelectorAll('[data-approve]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('确认通过？通过后前台会展示该网站。')) return;
        const { error } = await sb.from(T.sites)
          .update({ status: 'published', published_at: new Date().toISOString() })
          .eq('id', b.dataset.approve);
        if (error) alert('操作失败：' + error.message); else { alert('✅ 已上线！请通知 Codex 运行部署脚本生成网站文件（或稍后我统一处理）'); loadSites(); }
      });
    });
    list.querySelectorAll('[data-reject]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('确认拒绝该建站申请？')) return;
        const { error } = await sb.from(T.sites).update({ status: 'rejected' }).eq('id', b.dataset.reject);
        if (error) alert('操作失败：' + error.message); else loadSites();
      });
    });
    list.querySelectorAll('[data-preview]').forEach((b) => {
      b.addEventListener('click', () => {
        const s = siteRows.find((x) => x.id === +b.dataset.preview);
        if (!s) return;
        const code = window.BXSiteGen.generateSiteHtml(s);
        $('scmTitle').textContent = s.title + ' · 网站代码';
        $('scmCode').value = code;
        $('siteCodeModal').hidden = false;
      });
    });
    list.querySelectorAll('[data-del-site]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('确定删除这条建站申请？')) return;
        const { error } = await sb.from(T.sites).delete().eq('id', b.dataset.delSite);
        if (error) alert('删除失败：' + error.message); else loadSites();
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

  // ===== 站点设置 =====
  const CONFIG_DEFS = [
    ['nickname', '昵称', '薄想', '关于区块显示的名字'],
    ['about_text', '个人简介', '一个把创意做成实物的接单工作室。无论你是想做网站、剪视频、还是用 AI 生成画面，都可以把需求丢给我，我来帮你落地。', '关于我区块的段落文字'],
    ['douyin_id', '抖音号', '薄想30786753040', '首页展示的抖音账号'],
    ['wechat_id', '公众号', '超有用的林', '首页展示的微信公众号'],
    ['hero_tag', '首页标签', '✦ 创意接单工作室', '首页顶部小标签'],
    ['hero_title', '首页大标题', '把想法，做成会发光 的作品', '首页主标题，用两个空格分行的位置可换行'],
    ['hero_sub', '首页副标题', '网站开发 · 视频创作 · AI 绘画 · 设计落地', '主标题下方一句话'],
    ['services', '服务列表(JSON)', '[{"icon":"🌐","title":"网站开发","desc":"个人主页、博客、商城、企业官网，从设计到上线一条龙。"},{"icon":"🎬","title":"视频创作","desc":"剪辑、包装、AI 视频生成，让你的内容更出彩。"},{"icon":"🎨","title":"AI 绘画","desc":"插画、海报、三视图、道具设定，AI 快速出图。"},{"icon":"🚀","title":"其他定制","desc":"脚本写作、公众号排版、自动化工具，有需求尽管说。"}]', 'JSON 数组，每条含 icon/title/desc']
  ];

  async function loadConfigForm() {
    const form = $('configForm');
    form.innerHTML = '<div class="empty-tip">加载中…</div>';
    const { data, error } = await sb.from(T.config).select('key,value');
    if (error) { form.innerHTML = '<div class="empty-tip">加载失败：' + error.message + '</div>'; return; }
    const map = {};
    (data || []).forEach((r) => { map[r.key] = r.value; });
    form.innerHTML = CONFIG_DEFS.map(([k, label, def, hint]) => `
      <label>${label}
        <input type="text" data-key="${k}" value="${(map[k] ?? def).replace(/"/g, '&quot;')}" maxlength="2000">
        ${hint ? `<span class="hint">${hint}</span>` : ''}
      </label>`).join('');
  }

  $('saveConfig').addEventListener('click', async () => {
    const btn = $('saveConfig');
    btn.disabled = true; btn.textContent = '保存中…';
    const inputs = document.querySelectorAll('#configForm input[data-key]');
    let failed = false;
    for (const inp of inputs) {
      const key = inp.dataset.key;
      const val = inp.value;
      const { data } = await sb.from(T.config).select('key').eq('key', key).maybeSingle();
      if (data) {
        const { error } = await sb.from(T.config).update({ value: val }).eq('key', key);
        if (error) failed = error.message;
      } else {
        const { error } = await sb.from(T.config).insert({ key, value: val });
        if (error) failed = error.message;
      }
      if (failed) break;
    }
    btn.disabled = false; btn.textContent = '保存设置';
    if (failed) alert('保存失败：' + failed); else { btn.textContent = '已保存 ✓'; setTimeout(() => { btn.textContent = '保存设置'; }, 1500); }
  });

  async function loadAll() { loadOrders(); loadPosts(); loadSites(); loadConfigForm(); }
})();