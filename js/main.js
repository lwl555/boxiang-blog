// ===== 前台逻辑 =====
(function () {
  const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
  const sb = window.supabase.createClient(url, key);
  const T = window.SUPABASE_TABLES;
  const $ = (id) => document.getElementById(id);
  const fmt = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  };

  // 导航
  const nav = $('nav');
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 40));
  $('navToggle').addEventListener('click', () => $('navLinks').classList.toggle('open'));

  // 入场动画
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // 数字滚动
  const counter = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target.querySelector('b');
      const target = +el.dataset.count;
      let n = 0;
      const step = () => { n += Math.max(1, Math.ceil(target / 40)); if (n >= target) { el.textContent = target; } else { el.textContent = n; requestAnimationFrame(step); } };
      step();
      counter.unobserve(e.target);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat').forEach((s) => counter.observe(s));

  // 站点配置
  async function loadConfig() {
    try {
      const { data, error } = await sb.from(T.config).select('key,value');
      if (error) throw error;
      const map = {};
      (data || []).forEach((r) => { map[r.key] = r.value; });
      const set = (id, v) => { if (v && $(id)) $(id).textContent = v; };
      set('heroTag', map.hero_tag);
      set('heroTitle', map.hero_title);
      set('heroSub', map.hero_sub);
      set('aboutName', map.nickname);
      set('aboutText', map.about_text);
      if (map.douyin_id) {
        set('metaDouyin', map.douyin_id);
        const a = document.querySelector('.about-contacts a');
        if (a) a.textContent = '📱 抖音 · ' + map.douyin_id;
      }
      if (map.wechat_id) {
        set('metaWechat', map.wechat_id);
        const a = document.querySelectorAll('.about-contacts a')[1];
        if (a) a.textContent = '📮 公众号 · ' + map.wechat_id;
      }
      if (map.services) {
        try {
          const list = JSON.parse(map.services);
          if (Array.isArray(list) && list.length) {
            $('serviceGrid').innerHTML = list.map((s) => `
              <div class="service-card glass reveal">
                <div class="svc-icon">${s.icon || '✨'}</div>
                <h3>${s.title}</h3>
                <p>${s.desc}</p>
              </div>`).join('');
            document.querySelectorAll('#serviceGrid .reveal').forEach((el) => io.observe(el));
          }
        } catch (e) { /* 保留默认服务 */ }
      }
    } catch (e) { console.warn('配置加载失败', e); }
  }

  // 作品 + 博客
  async function loadPosts() {
    try {
      const { data, error } = await sb.from(T.posts)
        .select('*').eq('published', true).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const posts = data || [];
      const works = posts.filter((p) => p.category === 'work');
      const blogs = posts.filter((p) => p.category === 'blog');
      renderWorks(works);
      renderBlogs(blogs);
    } catch (e) {
      $('worksEmpty').textContent = '内容加载失败，请稍后再试';
      $('blogList').innerHTML = '<div class="empty-tip">内容加载失败，请稍后再试</div>';
      console.warn(e);
    }
  }

  function renderWorks(works) {
    const grid = $('workGrid');
    if (!works.length) { grid.innerHTML = '<div class="empty-tip">作品正在制作中，敬请期待 ✨</div>'; return; }
    grid.innerHTML = works.map((w) => `
      <div class="work-card glass" data-id="${w.id}">
        <div class="work-cover">${w.cover ? `<img src="${w.cover}" alt="${w.title}" style="width:100%;height:100%;object-fit:cover;">` : '🖼️'}</div>
        <div class="work-body">
          <h3>${w.title}</h3>
          <p>${(w.summary || w.content || '').slice(0, 60)}</p>
          ${w.tags ? `<div class="work-tags">${w.tags.split(',').map((t) => `<span>${t.trim()}</span>`).join('')}</div>` : ''}
        </div>
      </div>`).join('');
    grid.querySelectorAll('.work-card').forEach((c) => c.addEventListener('click', () => openPost(works.find((w) => w.id === +c.dataset.id))));
  }

  function renderBlogs(blogs) {
    const list = $('blogList');
    if (!blogs.length) { list.innerHTML = '<div class="empty-tip">还没有文章，关注公众号第一时间获取 ✨</div>'; return; }
    list.innerHTML = blogs.map((b) => `
      <div class="blog-item glass" data-id="${b.id}">
        <h3>${b.title}</h3>
        <span class="blog-date">${fmt(b.created_at)}</span>
      </div>`).join('');
    list.querySelectorAll('.blog-item').forEach((c) => c.addEventListener('click', () => openPost(blogs.find((b) => b.id === +c.dataset.id))));
  }

  function openPost(p) {
    $('modalTitle').textContent = p.title;
    $('modalMeta').textContent = fmt(p.created_at) + (p.tags ? ' · ' + p.tags : '');
    $('modalBody').innerHTML = (p.content || '').replace(/\n/g, '<br>');
    $('postModal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  $('modalClose').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', closeModal);
  function closeModal() { $('postModal').hidden = true; document.body.style.overflow = ''; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // 接单表单
  $('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('orderBtn'), tip = $('orderTip');
    btn.disabled = true; btn.textContent = '提交中…';
    const { error } = await sb.from(T.orders).insert({
      name: $('oName').value.trim(),
      contact: $('oContact').value.trim(),
      type: $('oType').value,
      budget: $('oBudget').value || null,
      description: $('oDesc').value.trim()
    });
    btn.disabled = false; btn.innerHTML = '提交需求 <span>→</span>';
    if (error) {
      tip.textContent = '提交失败：' + (error.message || '网络异常') + '，可直接联系抖音/公众号';
      tip.style.color = '#c2402b';
    } else {
      e.target.reset();
      tip.textContent = '✅ 提交成功！我会尽快联系你，谢谢信任～';
      tip.style.color = '#3e8e63';
    }
  });

  $('year').textContent = new Date().getFullYear();
  loadConfig();
  loadPosts();
})();