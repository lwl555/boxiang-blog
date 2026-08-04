// ===== 免费 AI 建站逻辑 =====
(function () {
  if (!window.supabase || !window.BXSiteGen) return;
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const T = window.SUPABASE_TABLES;
  const $ = (id) => document.getElementById(id);
  const BASE = 'https://lwl555.github.io/boxiang-blog';
  const gen = window.BXSiteGen;

  function getClientId() {
    let id = localStorage.getItem('bx_site_client');
    if (!id) {
      id = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('bx_site_client', id);
    }
    return id;
  }

  function makeSlug() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'bx-' + s;
  }

  function collectForm() {
    return {
      title: $('sTitle').value.trim(),
      purpose: $('sPurpose').value,
      description: $('sDesc').value.trim(),
      contact: $('sContact').value.trim(),
      theme: (document.querySelector('input[name="theme"]:checked') || {}).value || '朱砂',
      features: Array.from(document.querySelectorAll('#featureChips input:checked')).map((i) => i.value)
    };
  }

  // ===== 实时预览 =====
  let lastCode = '';
  function refreshPreview() {
    const d = collectForm();
    if (!d.title && !d.description && !d.contact) {
      $('previewUrl').textContent = 'bx-xxxxxx';
      $('sitePreview').srcdoc = '<body style="margin:0;display:flex;align-items:center;justify-content:center;font-family:sans-serif;color:#b5a48e;background:#f8f2e4">填写左侧表单，这里实时预览你的网站 ✨</body>';
      $('previewActions').hidden = true;
      return;
    }
    lastCode = gen.generateSiteHtml(d);
    $('sitePreview').srcdoc = lastCode;
    $('previewUrl').textContent = makeSlug();
    $('previewActions').hidden = false;
  }
  ['sTitle', 'sPurpose', 'sDesc', 'sContact'].forEach((id) => $(id).addEventListener('input', refreshPreview));
  document.querySelectorAll('#themePicker input, #featureChips input').forEach((el) => el.addEventListener('change', () => {
    document.querySelectorAll('.theme-card').forEach((c) => c.classList.remove('selected'));
    const checked = document.querySelector('input[name="theme"]:checked');
    if (checked) checked.closest('.theme-card').classList.add('selected');
    refreshPreview();
  }));

  // ===== 复制 / 下载 =====
  $('copyCodeBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(lastCode);
      const b = $('copyCodeBtn');
      b.textContent = '✅ 已复制';
      setTimeout(() => { b.textContent = '📋 复制代码'; }, 1600);
    } catch (e) { alert('复制失败，请手动复制'); }
  });
  $('downloadCodeBtn').addEventListener('click', () => {
    const blob = new Blob([lastCode], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ($('sTitle').value.trim() || 'my-site') + '.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  });

  // ===== 提交审核 =====
  $('siteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = collectForm();
    if (!d.title || !d.description || !d.contact) {
      const tip = $('siteTip');
      tip.textContent = '请把必填项填完整哦'; tip.style.color = '#c2402b'; return;
    }
    const btn = $('siteBtn'), tip = $('siteTip');
    btn.disabled = true; btn.textContent = '生成中…';

    let ok = false, lastErr = '', finalSlug = '';
    for (let i = 0; i < 3 && !ok; i++) {
      finalSlug = makeSlug();
      const { error } = await sb.from(T.sites).insert({
        title: d.title,
        slug: finalSlug,
        description: d.description,
        purpose: d.purpose,
        theme: d.theme,
        features: d.features,
        contact: d.contact,
        client_id: getClientId(),
        status: 'pending'
      });
      if (!error) ok = true; else lastErr = error.message || '网络异常';
    }

    btn.disabled = false; btn.innerHTML = '🚀 一键生成我的网站 <span class="arrow">→</span>';
    if (!ok) {
      tip.textContent = '提交失败：' + lastErr;
      tip.style.color = '#c2402b';
      return;
    }
    e.target.reset();
    document.querySelector('.theme-card.theme-cinnabar').classList.add('selected');
    document.querySelector('input[name="theme"][value="朱砂"]').checked = true;
    document.querySelectorAll('#featureChips input').forEach((c, i) => { c.checked = i === 0; });
    refreshPreview();
    tip.innerHTML = '✅ 已提交！审核通过后会自动上线，网址：<b>' + BASE + '/sites/' + finalSlug + '/</b>（一般当天完成）';
    tip.style.color = '#2f5d4a';
    tip.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ===== 最近上线列表 =====
  async function loadSites() {
    const grid = $('siteGrid');
    try {
      const { data, error } = await sb.from(T.sites)
        .select('title,slug,purpose,theme,description,published_at')
        .eq('status', 'published').order('published_at', { ascending: false }).limit(9);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) { grid.innerHTML = '<div class="empty-tip">第一个免费网站等你来抢 🎉</div>'; return; }
      grid.innerHTML = rows.map((s) => {
        const emoji = { '个人名片': '🪪', '作品集': '🎨', '小店展示': '🏪', '博客': '📝', '其他': '✨' }[s.purpose] || '✨';
        return `
        <a class="site-card glass" href="${BASE}/sites/${s.slug}/" target="_blank" rel="noopener">
          <div class="site-emoji">${emoji}</div>
          <div class="site-body">
            <h3>${gen.esc(s.title)}</h3>
            <p>${gen.esc((s.description || '').slice(0, 40))}</p>
            <span class="site-meta">${gen.esc(s.theme || '')} · ${gen.esc(s.purpose || '')} · /sites/${s.slug}/</span>
          </div>
        </a>`;
      }).join('');
    } catch (e) {
      grid.innerHTML = '<div class="empty-tip">加载失败，请稍后再试</div>';
      console.warn(e);
    }
  }

  refreshPreview();
  loadSites();
})();