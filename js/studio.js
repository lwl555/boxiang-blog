// ===== 薄想 · AI 建站工作台 =====
(function () {
  const $ = (id) => document.getElementById(id);
  const BASE = 'https://lwl555.github.io/boxiang-blog';
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const T = window.SUPABASE_TABLES;

  const MODE_INFO = {
    text: { badge: '💬 文本模式', hint: '💬 文本：直接生成/修改整站 · 🖼️ 图像：生成配图插入页面 · 🎬 视频：生成视频插入页面', toolTitle: '🖼️ 生成一张图片', toolTip: '描述你想要的画面，生成后会插入到页面顶部。' },
    image: { badge: '🖼️ 图像模式', hint: '🖼️ 图像模式：描述画面，AI 生成图片后自动插入页面。', toolTitle: '🖼️ 生成一张图片', toolTip: '描述你想要的画面，生成后会插入到页面顶部。' },
    video: { badge: '🎬 视频模式', hint: '🎬 视频模式：描述视频内容（约 5 秒），生成后自动插入页面。', toolTitle: '🎬 生成一段视频', toolTip: '描述你想要的视频画面（约 5 秒），生成后自动插入页面顶部。' }
  };

  const SYSTEM_PROMPT = '你是一位顶级网页设计师与前端工程师，为「薄想工作室」的免费 AI 建站工作台服务。\n' +
    '用户会告诉你他想要什么样的网站，你必须只输出一个完整、可直接运行的 HTML 文档（以 <!DOCTYPE html> 开头，以 </html> 结尾），不要输出任何解释文字，不要用 Markdown 代码块包裹。\n' +
    '硬性要求：\n' +
    '1. 网站类型完全由用户需求决定：个人主页、作品集、企业官网、电商小店、博客、活动落地页、在线工具、导航页等都可以做，不要局限于个人名片。\n' +
    '2. 视觉风格：东方美学 + 现代质感。背景用暖纸米色 #f5efe2，主强调色朱砂红 #c2402b，辅助强调色琥珀金 #c98a16，正文深褐 #33261d，次要文字 #6d5c4b。严禁使用蓝色、紫色、青色等科技感配色，严禁大面积白色极简（可用但必须搭配暖色质感）。\n' +
    '3. 必须有明显的设计感：丝滑的滚动显现动画、细腻渐变光晕、玻璃拟态卡片、精致 hover 动效、装饰性线条或几何元素、恰到好处的衬线/粗黑标题。要让用户觉得这是精心设计的品牌官网，而不是模板。\n' +
    '4. 所有 CSS 写在 <style> 标签内，所有 JS 写在 <script> 标签内，不要引用任何外部库或外部 CSS/JS 文件。配图可用 https://picsum.photos/seed/boxiang/900/600 这类占位图，也可用 emoji 或 CSS 渐变装饰代替。\n' +
    '5. 响应式设计，移动端必须同样好看。\n' +
    '6. 内容要具体、真实、完整：根据用户的描述展开合理的文案与板块（导航、Hero、关于、服务/产品、案例、价格、联系等，按网站类型取舍），避免空话套话。\n' +
    '7. 联系区域放一个明显按钮，链接到 https://lwl555.github.io/boxiang-blog/#order（文案：向薄想工作室下单）。\n' +
    '8. 页脚加一行小字：由 薄想工作室 免费生成。\n' +
    '9. 后续对话中，用户会提出修改意见，你要根据上下文重写整个 HTML（保持之前的修改与内容）。\n' +
    '10. 输出要完整，不要省略中间内容。';

  let messages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];
  let lastHtml = '';
  let mode = 'text';
  let generating = false;
  let aborter = null;
  let videoTimer = null;

  // ===== 消息渲染 =====
  const chatList = $('chatList');

  function addMsg(role, html) {
    const div = document.createElement('div');
    div.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
    const avatar = role === 'user' ? '🙋' : '✦';
    div.innerHTML = '<div class="avatar">' + avatar + '</div><div class="bubble">' + html + '</div>';
    chatList.appendChild(div);
    chatList.scrollTop = chatList.scrollHeight;
    return div.querySelector('.bubble');
  }

  function addStatus(text) {
    const b = addMsg('bot', '<span class="status">' + text + '</span>');
    return b;
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function welcome() {
    const bubble = addMsg('bot',
      '你好呀，我是 <b>薄想 AI 建站助手</b> ✦\n\n' +
      '告诉我你想做什么网站：个人主页、作品集、企业官网、小店、博客、活动页……什么类型的网页都可以，一句话就能开干！' +
      '<div class="sugg">' +
      '<button data-s="帮我做一个咖啡馆的官网，要有菜单、地址和故事">☕ 咖啡馆官网</button>' +
      '<button data-s="做一个摄影师的个人作品集网站，展示照片和约拍价格">📷 摄影师作品集</button>' +
      '<button data-s="做一个宠物店的介绍页，可爱温馨风格，有服务和价格">🐶 宠物店介绍页</button>' +
      '<button data-s="做一个美妆博主的活动落地页，引导关注抖音">🎬 博主活动落地页</button>' +
      '</div>'
    );
    bubble.querySelectorAll('[data-s]').forEach((b) => {
      b.addEventListener('click', () => {
        $('chatInput').value = b.dataset.s;
        sendText();
      });
    });
    // 检查 AI key
    window.Agnes.getKey().then((k) => {
      if (!k) {
        addMsg('bot', '<span class="status">⚠️ AI 服务正在配置中，站长马上就好～ 你可以先看看页面，稍后再来生成。</span>');
      }
    });
  }

  // ===== HTML 提取 =====
  function extractHtml(text) {
    if (!text) return '';
    let t = text.trim();
    const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fence) return fence[1].trim();
    if (/^<!DOCTYPE html/i.test(t) || /^<html/i.test(t)) return t;
    // 尝试从包含 <html 的位置截取
    const idx = t.search(/<!DOCTYPE html|<html/i);
    if (idx >= 0) return t.slice(idx).trim();
    return t;
  }

  function preview(html) {
    lastHtml = html;
    $('stFrame').srcdoc = html;
  }

  // ===== 文本：生成/修改网站 =====
  async function sendText() {
    const input = $('chatInput');
    const q = input.value.trim();
    if (!q || generating) return;
    input.value = '';
    input.style.height = 'auto';
    addMsg('user', esc(q));

    // 附加站点信息
    const name = $('stName').value.trim();
    const type = $('stType').value;
    const theme = $('stTheme').value;
    let fullQ = q;
    if (name || type !== '自动判断' || theme !== '朱砂') {
      const ctx = [];
      if (name) ctx.push('网站名字：' + name);
      if (type !== '自动判断') ctx.push('网站类型：' + type);
      ctx.push('主配色要求：' + theme + ' 系（对应色值：#f5efe2 纸米底 + 强调色，按主题调整）');
      fullQ = '【站点信息】' + ctx.join('；') + '。\n【用户需求】' + q;
    }
    messages.push({ role: 'user', content: fullQ });

    generating = true;
    setBusy(true);
    const statusEl = addStatus('<span class="thinking"><span class="dots"><i></i><i></i><i></i></span>AI 正在思考，请稍候…</span>');
    aborter = new AbortController();
    try {
      let streamText = '';
      let started = false;
      const bubble = document.createElement('div');
      bubble.className = 'msg bot';
      bubble.innerHTML = '<div class="avatar">✦</div><div class="bubble"></div>';
      const bubbleText = bubble.querySelector('.bubble');

      const full = await window.Agnes.chat(messages, {
        stream: true,
        signal: aborter.signal,
        onDelta: (d) => {
          if (!started) {
            started = true;
            statusEl.remove();
            chatList.appendChild(bubble);
            chatList.scrollTop = chatList.scrollHeight;
          }
          streamText += d;
          bubbleText.textContent = streamText.slice(-600);
          chatList.scrollTop = chatList.scrollHeight;
        }
      });
      if (!started) {
        statusEl.remove();
        chatList.appendChild(bubble);
        bubbleText.textContent = full || '';
        chatList.scrollTop = chatList.scrollHeight;
      }
      const html = extractHtml(full);
      if (!html || html.length < 300) throw new Error('AI 没有返回有效的网页内容，请再试一次');
      preview(html);
      messages.push({ role: 'assistant', content: full });
      bubbleText.textContent = '✅ 网站已生成！看看右边预览 👉 不满意就继续跟我说，想换风格、加板块、改颜色都可以。';
      $('stStatus').textContent = '✅ 已生成 · 可继续对话修改';
    } catch (e) {
      const msg = e && e.message ? e.message : '生成失败，请重试';
      addMsg('bot', '<span class="status">❌ ' + esc(msg) + '</span>');
    } finally {
      generating = false;
      setBusy(false);
    }
  }

  function setBusy(busy) {
    $('chatSend').disabled = busy;
    $('chatSend').textContent = busy ? '…' : '发送';
  }

  // ===== 工具模式（图像/视频）=====
  let toolMode = 'image';
  let toolRatio = '1:1';

  function openTool(m) {
    toolMode = m;
    $('toolTitle').textContent = MODE_INFO[m].toolTitle;
    $('toolTip').textContent = MODE_INFO[m].toolTip;
    $('toolPrompt').value = '';
    $('toolProgress').textContent = '';
    $('toolRun').disabled = false;
    $('toolRun').textContent = '生成';
    const prev = $('toolModal').querySelector('.tool-preview-img');
    if (prev) prev.remove();
    $('toolModal').hidden = false;
    setTimeout(() => $('toolPrompt').focus(), 100);
  }

  async function runTool() {
    const prompt = $('toolPrompt').value.trim();
    if (!prompt || $('toolRun').disabled) return;
    $('toolRun').disabled = true;
    const prog = $('toolProgress');
    try {
      if (toolMode === 'image') {
        prog.innerHTML = '<span class="thinking"><span class="dots"><i></i><i></i><i></i></span>🎨 AI 正在画画，约 10~30 秒…</span>';
        const url = await window.Agnes.generateImage(prompt, { ratio: toolRatio });
        if (!url) throw new Error('没有拿到图片地址');
        const imgTag = '<img src="' + url + '" alt="' + esc(prompt.slice(0, 50)) + '" style="width:100%;height:auto;border-radius:18px;box-shadow:0 14px 34px rgba(0,0,0,.16);margin:22px 0;display:block">';
        if (lastHtml) preview(insertMedia(imgTag));
        const b = addMsg('bot', '🖼️ 图片生成好了：<br><img class="img-inline" src="' + url + '" alt="生成的图片">');
        b.querySelector('img').addEventListener('click', () => {
          if (lastHtml && !lastHtml.includes(url)) {
            preview(insertMedia(imgTag));
            b.textContent = '✅ 图片已插入页面顶部';
          }
        });
        prog.textContent = '✅ 完成（点图片可插入页面）';
        $('toolRun').textContent = '再生成一张';
        $('toolRun').disabled = false;
      } else {
        prog.innerHTML = '<span class="thinking"><span class="dots"><i></i><i></i><i></i></span>🎬 正在创建视频任务…</span>';
        const videoId = await window.Agnes.createVideo(prompt, { num_frames: 121, frame_rate: 24 });
        if (!videoId) throw new Error('视频任务创建失败');
        await pollVideo(videoId, prompt, prog);
      }
    } catch (e) {
      prog.textContent = '❌ ' + (e && e.message ? e.message : '生成失败');
      $('toolRun').disabled = false;
      $('toolRun').textContent = '重试';
    }
  }

  async function pollVideo(videoId, prompt, prog) {
    return new Promise((resolve) => {
      let tries = 0;
      videoTimer = setInterval(async () => {
        tries++;
        try {
          const v = await window.Agnes.getVideo(videoId);
          const st = v.status || 'queued';
          if (st === 'completed' && v.metadata && v.metadata.url) {
            clearInterval(videoTimer);
            const url = v.metadata.url;
            const videoTag = '<video src="' + url + '" autoplay muted loop playsinline controls style="width:100%;max-height:420px;border-radius:18px;box-shadow:0 14px 34px rgba(0,0,0,.16);margin:22px 0;display:block;background:#000"></video>';
            if (lastHtml) preview(insertMedia(videoTag));
            const b = addMsg('bot', '🎬 视频生成好了！<br><video class="img-inline" src="' + url + '" autoplay muted loop playsinline controls style="max-height:260px"></video>');
            b.querySelector('video').addEventListener('click', () => {
              if (lastHtml && !lastHtml.includes(url)) {
                preview(insertMedia(videoTag));
                b.textContent = '✅ 视频已插入页面顶部';
              }
            });
            prog.textContent = '✅ 完成（点视频可插入页面）';
            $('toolRun').textContent = '再生成一段';
            $('toolRun').disabled = false;
            resolve();
          } else if (st === 'failed') {
            clearInterval(videoTimer);
            prog.textContent = '❌ 视频生成失败，请换个描述再试';
            $('toolRun').disabled = false;
            $('toolRun').textContent = '重试';
            resolve();
          } else {
            const pct = v.progress || Math.min(tries * 6, 90);
            prog.innerHTML = '<span class="thinking"><span class="dots"><i></i><i></i><i></i></span>🎬 视频生成中… ' + pct + '%（约 1~3 分钟）</span>';
            if (tries > 80) {
              clearInterval(videoTimer);
              prog.textContent = '⏳ 生成时间较长，稍后刷新页面在预览里查看（已完成可点下方重试）';
              $('toolRun').disabled = false;
              resolve();
            }
          }
        } catch (e) {
          clearInterval(videoTimer);
          prog.textContent = '❌ ' + (e && e.message ? e.message : '查询失败');
          $('toolRun').disabled = false;
          resolve();
        }
      }, 5000);
    });
  }

  function insertMedia(tag) {
    const html = lastHtml || '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, tag + '</body>');
    return html + tag;
  }

  // ===== 发布 =====
  function makeSlug() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'bx-' + s;
  }

  function getClientId() {
    let id = localStorage.getItem('bx_site_client');
    if (!id) {
      id = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('bx_site_client', id);
    }
    return id;
  }

  async function publish() {
    const title = $('stName').value.trim() || '';
    if (!title) {
      addMsg('bot', '<span class="status">⚠️ 发布前先给网站起个名字（顶部输入框）</span>');
      return;
    }
    if (!lastHtml || lastHtml.length < 300) {
      addMsg('bot', '<span class="status">⚠️ 还没生成网站内容，先在左边跟 AI 聊一聊吧</span>');
      return;
    }
    const btn = $('stPublish');
    btn.disabled = true;
    btn.textContent = '发布中…';
    const body = $('pubBody');
    body.innerHTML = '<div class="ok-mark">⏳</div><h2 style="text-align:center">正在发布…</h2>';
    $('pubModal').hidden = false;

    try {
      const purpose = $('stType').value === '自动判断' ? '其他' : $('stType').value;
      const theme = $('stTheme').value;
      const firstUser = messages.find((m) => m.role === 'user');
      const desc = (firstUser ? firstUser.content.replace(/【站点信息】[^。]*。?/, '').slice(0, 80) : title);
      let ok = false, lastErr = '', slug = '';
      for (let i = 0; i < 3 && !ok; i++) {
        slug = makeSlug();
        const { error } = await sb.from(T.sites).insert({
          title: title,
          slug: slug,
          description: desc,
          purpose: purpose,
          theme: theme,
          features: [],
          contact: '站内联系',
          client_id: getClientId(),
          status: 'published',
          content_html: lastHtml
        });
        if (!error) ok = true; else lastErr = error.message || '网络异常';
      }
      if (!ok) throw new Error(lastErr);

      const url = BASE + '/sites/' + slug + '/';
      $('stPreviewUrl').textContent = url;
      body.innerHTML =
        '<div class="ok-mark">🎉</div>' +
        '<h2 style="text-align:center">发布成功！</h2>' +
        '<a class="pub-url" href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' +
        '<p class="pub-tip">你的网站正在自动上线，<b>约 1~5 分钟</b>后即可访问（首次部署稍慢）。<br>' +
        '以后想修改，重新来工作台生成后再次发布即可。有问题找站长：公众号「超有用的林」。</p>' +
        '<div class="pub-actions">' +
        '<button class="st-btn accent" id="pubOpen">打开我的网站</button>' +
        '<button class="st-btn ghost" id="pubCopy">复制网址</button>' +
        '</div>';
      const openBtn = $('pubOpen');
      const copyBtn = $('pubCopy');
      openBtn.addEventListener('click', () => window.open(url, '_blank'));
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
          copyBtn.textContent = '已复制 ✓';
        } catch (e) { window.prompt('复制网址：', url); }
      });
      addMsg('bot', '<span class="status">🎉 发布成功！网址：' + url + '</span>');
    } catch (e) {
      body.innerHTML = '<div class="ok-mark">😥</div><h2 style="text-align:center">发布失败</h2><p class="pub-tip err-box">' + esc(e && e.message ? e.message : '未知错误') + '</p>';
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 发布网站';
    }
  }

  // ===== 复制 / 下载 / 清空 =====
  $('stCopyCode').addEventListener('click', async () => {
    if (!lastHtml) return;
    try {
      await navigator.clipboard.writeText(lastHtml);
      const b = $('stCopyCode'); b.textContent = '已复制 ✓';
      setTimeout(() => { b.textContent = '📋 复制代码'; }, 1600);
    } catch (e) { alert('复制失败'); }
  });
  $('stDownload').addEventListener('click', () => {
    if (!lastHtml) return;
    const blob = new Blob([lastHtml], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = ($('stName').value.trim() || 'my-site') + '.html';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  });
  $('stClear').addEventListener('click', () => {
    if (!confirm('重新开始会清空当前对话和预览，确定？')) return;
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    lastHtml = '';
    chatList.innerHTML = '';
    $('stFrame').srcdoc = '';
    $('stName').value = '';
    $('stPreviewUrl').textContent = '还没发布 · 发布后这里显示网址';
    $('stStatus').textContent = '👀 实时预览';
    welcome();
  });

  // ===== 事件绑定 =====
  $('chatSend').addEventListener('click', () => {
    if (mode === 'text') sendText();
    else openTool(mode);
  });
  $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mode === 'text') sendText(); else openTool(mode);
    }
  });
  $('chatInput').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 110) + 'px';
  });
  document.querySelectorAll('.tool-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      mode = b.dataset.mode;
      $('stModelBadge').textContent = MODE_INFO[mode].badge;
      $('chatHint').textContent = MODE_INFO[mode].hint;
      $('chatInput').placeholder = mode === 'text' ? '跟 AI 说你想做什么网站…' : (mode === 'image' ? '描述想生成的图片…' : '描述想生成的视频…');
    });
  });
  $('stPublish').addEventListener('click', publish);

  // 工具弹窗
  document.querySelectorAll('.ratio-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      toolRatio = b.dataset.ratio;
    });
  });
  $('toolRun').addEventListener('click', runTool);
  $('toolClose').addEventListener('click', () => { $('toolModal').hidden = true; });
  $('toolBackdrop').addEventListener('click', () => { $('toolModal').hidden = true; });
  $('pubClose').addEventListener('click', () => { $('pubModal').hidden = true; });
  $('pubBackdrop').addEventListener('click', () => { $('pubModal').hidden = true; });

  // ===== 初始化 =====
  welcome();
  window.addEventListener('beforeunload', () => {
    if (videoTimer) clearInterval(videoTimer);
    if (aborter) aborter.abort();
  });
})();