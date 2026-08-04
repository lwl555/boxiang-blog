// ===== 首页 · 最近上线的免费网站列表 =====
(function () {
  if (!window.supabase) return;
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const T = window.SUPABASE_TABLES;
  const BASE = 'https://lwl555.github.io/boxiang-blog';

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function loadSites() {
    const grid = document.getElementById('siteGrid');
    if (!grid) return;
    try {
      const { data, error } = await sb.from(T.sites)
        .select('title,slug,purpose,theme,description,published_at')
        .eq('status', 'published').order('created_at', { ascending: false }).limit(9);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) { grid.innerHTML = '<div class="empty-tip">第一个免费网站等你来抢 🎉</div>'; return; }
      grid.innerHTML = rows.map((s) => {
        const emoji = { '个人名片': '🪪', '作品集': '🎨', '小店展示': '🏪', '博客': '📝', '其他': '✨' }[s.purpose] || '✨';
        return `
        <a class="site-card glass" href="${BASE}/sites/${s.slug}/" target="_blank" rel="noopener">
          <div class="site-emoji">${emoji}</div>
          <div class="site-body">
            <h3>${esc(s.title)}</h3>
            <p>${esc((s.description || '').slice(0, 40))}</p>
            <span class="site-meta">${esc(s.theme || '')} · ${esc(s.purpose || '')} · /sites/${s.slug}/</span>
          </div>
        </a>`;
      }).join('');
    } catch (e) {
      grid.innerHTML = '<div class="empty-tip">加载失败，请稍后再试</div>';
      console.warn(e);
    }
  }

  loadSites();
})();