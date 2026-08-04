// ===== 薄想 · AI 建站工作台 v3（会话记忆 / 文件区 / 免费API / 断网自愈）=====
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
    '【先理解，再设计】\n' +
    '动笔前先在内心提炼用户需求的三个要点：网站类型、目标人群、核心卖点；据此决定板块结构、文案语气与内容细节。禁止套用通用模板，内容必须贴合用户描述的具体业务。多轮修改时，先回顾上一版已确定的信息，只按最新要求重写整站。\n' +
    '【技术硬性要求】\n' +
    '1. 网站类型完全由用户需求决定：个人主页、作品集、企业官网、电商小店、博客、活动落地页、在线工具、导航页等都可以做，不要局限于个人名片。\n' +
    '2. 单文件自包含：所有 CSS 写在 <style> 标签内，所有 JS 写在 <script> 标签内，禁止引用任何外部 CSS/JS/字体/图片/视频（包括 CDN、Google Fonts、picsum、unsplash 等一切外网资源）。\n' +
    '3. 配图一律用内嵌方案代替真实图片：emoji、CSS 渐变、内联 SVG、data URI。需要照片感时，用「渐变底 + 大号 emoji + 光影层次」的卡片设计，保证断网也能完整显示。\n' +
    '4. JavaScript 必须健壮：事件绑定放在 body 末尾或 DOMContentLoaded 内；任何 DOM 查询先判空；动画优先用 CSS 实现（transition、@keyframes、IntersectionObserver 可选）。\n' +
    '5. 输出必须完整：禁止省略号、禁止「…略…」等占位符、禁止截断，结尾必须是 </html>。\n' +
    '【视觉规范（必须严格遵守）】\n' +
    '6. 风格：东方美学 + 现代质感。背景暖纸米色 #f5efe2，主强调色朱砂红 #c2402b，辅助强调色琥珀金 #c98a16，正文深褐 #33261d，次要文字 #6d5c4b。严禁蓝色、紫色、青色等科技感配色，严禁大面积白色极简（可用但必须搭配暖色质感）。\n' +
    '7. 设计感：丝滑的滚动显现动画、细腻渐变光晕、玻璃拟态卡片、精致 hover 动效、装饰性线条或几何元素、恰到好处的衬线/粗黑标题、充足留白与清晰层级。要让人一眼觉得这是精心设计的品牌官网而不是模板。\n' +
    '8. 响应式：移动端必须同样好看，导航折叠、字号自适应、卡片单列。\n' +
    '9. 文案：内容具体真实，围绕用户业务展开（导航、Hero、关于、服务/产品、案例、价格、联系等按类型取舍），避免空话套话。\n' +
    '10. 联系区域放一个明显按钮，链接到 https://lwl555.github.io/boxiang-blog/#order（文案：向薄想工作室下单）。\n' +
    '11. 页脚加一行小字：由 薄想工作室 免费生成。\n' +
    '12. 输出前自检：单页不少于 60 行；无任何外部依赖；无 JS 明显错误；</html> 完整闭合。\n' +
    '13. 长度控制：整页控制在 400~700 行以内、总字符 12000 以内，宁可精简也不要写太长，确保一次输出完整、绝不截断。';
  // ===== 会话存储（每个网站一份记忆，刷新不丢）=====
  const SESSIONS_KEY = 'bx_studio_sessions_v2';
  const CUR_KEY = 'bx_studio_cur_v2';
  const MSG_PREFIX = 'bx_studio_msg_';
  const LEGACY_KEY = 'bx_studio_state_v1';

  let sessions = [];
  let current = null;
  let messages = [];
  let lastHtml = '';
  let mode = 'text';
  let generating = false;
  let aborter = null;
  let videoTimer = null;

  function uid() { return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function loadSessions() {
    try { sessions = JSON.parse(localStorage.getItem(SESSIONS_KEY)) || []; }
    catch (e) { sessions = []; }
  }
  function saveSessions() { try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); } catch (e) {} }
  function curId() { return localStorage.getItem(CUR_KEY) || ''; }
  function setCurId(id) { try { localStorage.setItem(CUR_KEY, id); } catch (e) {} }
  function loadMsgs(id) {
    try { return JSON.parse(localStorage.getItem(MSG_PREFIX + id)) || { messages: [], lastHtml: '' }; }
    catch (e) { return { messages: [], lastHtml: '' }; }
  }
  function saveMsgs(id, obj) { try { localStorage.setItem(MSG_PREFIX + id, JSON.stringify(obj)); } catch (e) {} }
  function delMsgs(id) { try { localStorage.removeItem(MSG_PREFIX + id); } catch (e) {} }

  function touchSession() {
    if (current) { current.updated_at = new Date().toISOString(); saveSessions(); }
  }
  function persistCurrent() {
    if (!current) return;
    current.mode = mode;
    touchSession();
    const stored = messages
      .filter((m) => m.role !== 'system')
      .slice(-16)
      .map((m) => {
        if (m.role === 'assistant' && m.content && m.content.length > 2000) {
          return { role: 'assistant', content: summarizeHtml(m.content), sys: m.sys };
        }
        return m;
      });
    saveMsgs(current.id, { messages: stored, lastHtml: lastHtml || '' });
  }

  function migrateLegacy() {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      const id = uid();
      sessions.unshift({
        id: id,
        name: s.name || '',
        type: s.type || '自动判断',
        theme: s.theme || '朱砂',
        mode: (s.mode && MODE_INFO[s.mode]) ? s.mode : 'text',
        published: false,
        publishedSlug: '',
        updated_at: new Date().toISOString(),
        apis: []
      });
      saveMsgs(id, { messages: s.messages || [], lastHtml: s.lastHtml || '' });
      setCurId(id);
      localStorage.removeItem(LEGACY_KEY);
      saveSessions();
    } catch (e) { /* 忽略 */ }
  }

  // ===== 会话操作 =====
  function newSession() {
    const id = uid();
    const s = {
      id: id, name: '', type: '自动判断', theme: '朱砂', mode: 'text',
      published: false, publishedSlug: '', updated_at: new Date().toISOString(), apis: []
    };
    sessions.unshift(s);
    saveSessions();
    setCurId(id);
    switchTo(id);
    return s;
  }

  function switchTo(id) {
    persistCurrent();
    current = sessions.find((x) => x.id === id) || null;
    if (!current) { newSession(); return; }
    setCurId(id);
    const saved = loadMsgs(id);
    messages = [{ role: 'system', content: SYSTEM_PROMPT }].concat(saved.messages || []);
    lastHtml = saved.lastHtml || '';
    mode = (current.mode && MODE_INFO[current.mode]) ? current.mode : 'text';
    setMode(mode);
    $('stName').value = current.name || '';
    $('stType').value = current.type || '自动判断';
    $('stTheme').value = current.theme || '朱砂';
    chatList.innerHTML = '';
    $('stFrame').srcdoc = '';
    if (lastHtml) {
      preview(lastHtml);
      $('stStatus').textContent = '✅ 已恢复上次预览';
    } else {
      $('stStatus').textContent = '👀 实时预览';
    }
    $('stPreviewUrl').textContent = current.publishedSlug
      ? '✅ 已发布：' + BASE + '/sites/' + current.publishedSlug + '/'
      : '还没发布 · 发布后这里显示网址';
    if (saved.messages && saved.messages.length) renderHistory(saved.messages);
    else welcome();
    renderSessions();
    renderFiles();
    renderApis();
    $('stSessionCount').textContent = sessions.length;
  }

  function deleteSession(id) {
    if (!confirm('删除这个网站的记忆？对话和代码都会清除（已发布的网站不受影响）。')) return;
    sessions = sessions.filter((x) => x.id !== id);
    delMsgs(id);
    saveSessions();
    if (curId() === id) {
      localStorage.removeItem(CUR_KEY);
      if (sessions.length) {
        setCurId(sessions[0].id);
        switchTo(sessions[0].id);
      } else {
        current = null; messages = []; lastHtml = '';
        chatList.innerHTML = '';
        $('stFrame').srcdoc = '';
        $('stName').value = ''; $('stType').value = '自动判断'; $('stTheme').value = '朱砂';
        $('stStatus').textContent = '👀 实时预览';
        $('stPreviewUrl').textContent = '还没发布 · 发布后这里显示网址';
        newSession();
      }
    } else {
      renderSessions();
      $('stSessionCount').textContent = sessions.length;
    }
  }

  function renderSessions() {
    const list = $('sessionList');
    if (!list) return;
    if (!sessions.length) {
      list.innerHTML = '<div class="empty-tip">还没有网站记忆，点下面「新建网站」开始吧 ✨</div>';
      return;
    }
    list.innerHTML = sessions.map((s) => {
      const active = s.id === curId();
      return '<div class="session-item' + (active ? ' active' : '') + '" data-sid="' + s.id + '">' +
        '<div class="session-main">' +
        '<b>' + esc(s.name || '未命名网站') + '</b>' +
        '<span class="session-meta">' + esc(s.type || '自动判断') + ' · ' +
        (s.published ? '✅ 已发布' : '🕐 未发布') + ' · ' + fmtTime(s.updated_at) +
        (s.apis && s.apis.length ? ' · 🧩' + s.apis.length + '个API' : '') +
        '</span></div>' +
        '<button class="mini-btn danger" data-del="' + s.id + '">删除</button>' +
        '</div>';
    }).join('');
    list.querySelectorAll('[data-sid]').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-del]')) return;
        switchTo(el.dataset.sid);
        $('sessionModal').hidden = true;
      });
    });
    list.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); deleteSession(b.dataset.del); });
    });
  }

  function fmtTime(d) {
    try {
      const x = new Date(d);
      return (x.getMonth() + 1) + '月' + x.getDate() + '日 ' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0');
    } catch (e) { return ''; }
  }
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
    return addMsg('bot', '<span class="status">' + text + '</span>');
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
    window.Agnes.getKey().then((k) => {
      if (!k) {
        addMsg('bot', '<span class="status">⚠️ AI 服务正在配置中，站长马上就好～ 你可以先看看页面，稍后再来生成。</span>');
      }
    });
  }

  function renderHistory(msgs) {
    for (const m of msgs) {
      if (m.sys) continue;
      if (m.role === 'user') {
        addMsg('user', esc(m.content));
      } else {
        const s = String(m.content || '').replace(/\s+/g, ' ').slice(0, 100);
        addMsg('bot', '<span class="status">✦ 之前生成的一版网站</span><div style="margin-top:6px;font-size:.84rem;color:var(--soft);word-break:break-all">' + esc(s) + (m.content && m.content.length > 100 ? '…' : '') + '</div>');
      }
    }
  }

  // ===== HTML 工具 =====
  function extractHtml(text) {
    if (!text) return '';
    let t = text.trim();
    const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fence) return fence[1].trim();
    if (/^<!DOCTYPE html/i.test(t) || /^<html/i.test(t)) return t;
    const idx = t.search(/<!DOCTYPE html|<html/i);
    if (idx >= 0) return t.slice(idx).trim();
    return t;
  }

  function repairHtml(h) {
    let s = String(h || '');
    const trim = s.trim();
    if (!/^<!DOCTYPE html/i.test(trim) && !/^<html/i.test(trim)) {
      s = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>生成页面</title>\n</head>\n<body>\n' + s;
    }
    if (((s.match(/<style[\s>]/gi) || []).length) > ((s.match(/<\/style>/gi) || []).length)) s += '\n</style>';
    if (((s.match(/<script[\s>]/gi) || []).length) > ((s.match(/<\/script>/gi) || []).length)) s += '\n</script>';
    if (((s.match(/<body[\s>]/gi) || []).length) > ((s.match(/<\/body>/gi) || []).length)) s += '\n</body>';
    if (!/<\/html>\s*$/i.test(s.trim())) s = s.replace(/\s*$/, '') + '\n</html>';
    return s;
  }

  function isCompleteHtml(h) {
    const s = String(h || '');
    return /<\/html>\s*$/i.test(s.trim()) &&
      ((s.match(/<style[\s>]/gi) || []).length) === ((s.match(/<\/style>/gi) || []).length) &&
      ((s.match(/<script[\s>]/gi) || []).length) === ((s.match(/<\/script>/gi) || []).length);
  }

  function preview(html) {
    lastHtml = repairHtml(html);
    $('stFrame').srcdoc = lastHtml;
  }

  // ===== 上下文压缩（防止 AI 上下文爆炸 / 本地存储爆炸）=====
  function summarizeHtml(html) {
    const t = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
    const secs = [];
    const re = /<(?:h2|h3|section)[^>]*>([\s\S]*?)<\/(?:h2|h3|section)>/gi;
    let m;
    while ((m = re.exec(html)) && secs.length < 12) {
      secs.push(m[1].replace(/<[^>]+>/g, '').trim().slice(0, 30));
    }
    return '【上一版网站摘要】标题：' + t + '；主标题：' + h1 + '；板块：' + (secs.join('、') || '无') + '；总代码 ' + html.length + ' 字符。改版时参考此摘要重写整站即可。';
  }

  function compactForRequest() {
    const out = [messages[0]];
    for (const m of messages.slice(-13)) {
      if (m.role === 'system') continue;
      if (m.role === 'assistant' && m.content && /<html/i.test(m.content)) {
        out.push({ role: 'assistant', content: summarizeHtml(m.content) });
      } else {
        out.push({ role: m.role, content: m.content, sys: m.sys ? true : undefined });
      }
    }
    return out;
  }

  function apiCtxText() {
    if (!current || !current.apis || !current.apis.length) return '';
    const lines = current.apis.map((a) => {
      const def = FREE_APIS[a];
      return def ? '【' + def.name + '】' + def.desc : a;
    });
    return '当前页面已接入的免费 API 功能：\n' + lines.join('\n') +
      '\n（继续改版时请保留这些已接入的功能代码，除非用户明确要求移除；若用户要求调整位置或样式，按需求移动即可。）\n';
  }

  // ===== 模式切换 =====
  function setMode(m) {
    mode = m;
    document.querySelectorAll('.tool-btn').forEach((x) => x.classList.toggle('active', x.dataset.mode === m));
    $('stModelBadge').textContent = MODE_INFO[m].badge;
    $('chatHint').textContent = MODE_INFO[m].hint;
    $('chatInput').placeholder = m === 'text' ? '跟 AI 说你想做什么网站…' : (m === 'image' ? '描述想生成的图片…' : '描述想生成的视频…');
  }
  // ===== 文本：生成/修改网站（带断网自动重试）=====
  async function sendText() {
    const input = $('chatInput');
    const q = input.value.trim();
    if (!q || generating) return;
    input.value = '';
    input.style.height = 'auto';
    addMsg('user', esc(q));

    const name = $('stName').value.trim();
    const type = $('stType').value;
    const theme = $('stTheme').value;
    const ctx = [];
    if (name || type !== '自动判断' || theme !== '朱砂') {
      if (name) ctx.push('网站名字：' + name);
      if (type !== '自动判断') ctx.push('网站类型：' + type);
      ctx.push('主配色要求：' + theme + ' 系（对应色值：#f5efe2 纸米底 + 强调色，按主题调整）');
    }
    const apiCtx = apiCtxText();
    if (apiCtx) ctx.unshift(apiCtx.replace(/\n$/, ''));
    const fullQ = (ctx.length ? '【站点信息】' + ctx.join('；') + '。\n' : '') + '【用户需求】' + q;
    messages.push({ role: 'user', content: fullQ });

    generating = true;
    setBusy(true);
    let statusEl = addStatus('<span class="thinking"><span class="dots"><i></i><i></i><i></i></span>AI 正在思考，请稍候…</span>');
    aborter = new AbortController();
    try {
      let streamText = '';
      let started = false;
      const bubble = document.createElement('div');
      bubble.className = 'msg bot';
      bubble.innerHTML = '<div class="avatar">✦</div><div class="bubble"></div>';
      const bubbleText = bubble.querySelector('.bubble');
      let full = '';
      let complete = false;

      for (let attempt = 0; attempt < 4 && !complete; attempt++) {
        if (attempt > 0) {
          streamText = '';
          started = false;
          bubbleText.textContent = '';
          if (statusEl.isConnected) statusEl.remove();
          statusEl = addStatus('<span class="status">⚠️ 刚才的输出不完整（AI 截断了），正在自动继续补全第 ' + attempt + ' 次…</span>');
        }
        const chatMsgs = attempt === 0
          ? compactForRequest()
          : compactForRequest().concat([
              { role: 'assistant', content: full },
              { role: 'user', content: '【继续写】你刚才输出的 HTML 因为长度限制被系统截断了。请接着你输出的最后位置继续写，补齐所有剩余内容。要求：不要重复任何已输出的内容；如果还有未完成的标签（如 footer、body、html）必须全部闭合；最终输出必须以 </body> 和 </html> 结尾。只输出续写部分，不要解释。' }
            ]);
        try {
          const cont = await window.Agnes.chat(chatMsgs, {
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
          full = (attempt > 0 ? full.replace(/\s*$/, '') + '\n' : '') + cont;
          full = full.split(String.fromCharCode(96)).join('').trim();
          const html = extractHtml(full);
          complete = !!html && html.length >= 300 && isCompleteHtml(html);
        } catch (e2) {
          const net = e2 && (e2.code === 'network' || e2.code === 'timeout' || /network|fetch|timeout|abort|连接|网络|中断/i.test(e2.message || ''));
          if (net && attempt < 3) {
            if (statusEl.isConnected) statusEl.remove();
            statusEl = addStatus('<span class="status">⚠️ ' + esc(e2.message) + '，正在自动重试第 ' + (attempt + 2) + ' 次…</span>');
            continue;
          }
          throw e2;
        }
      }

      if (statusEl.isConnected) statusEl.remove();
      if (!started) {
        chatList.appendChild(bubble);
        bubbleText.textContent = full || '';
        chatList.scrollTop = chatList.scrollHeight;
      }
      const html = extractHtml(full);
      if (!html || html.length < 300) throw new Error('AI 没有返回有效的网页内容，请再试一次');
      preview(html);
      messages.push({ role: 'assistant', content: full });
      bubbleText.textContent = complete
        ? '✅ 网站已生成！看看右边预览 👉 不满意就继续跟我说，想换风格、加板块、改颜色都可以。'
        : '✅ 网站已生成（AI 输出略有截断，已自动修补显示）。不满意就继续跟我说，我来帮你改。';
      $('stStatus').textContent = complete ? '✅ 已生成 · 可继续对话修改' : '⚠️ 已生成（部分修补）· 可继续对话修改';
      persistCurrent();
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
        persistCurrent();
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
      const raw = e && e.message ? e.message : '生成失败';
      const friendly = (e && (e.code === 'network' || e.code === 'timeout'))
        ? '网络不太稳定：' + raw + '（请检查网络后再试一次）'
        : raw;
      prog.textContent = '❌ ' + friendly;
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
            persistCurrent();
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
  // ===== 免费 API 市场（已实测：无需 key、支持 CORS）=====
  const FLOAT_CSS = 'position:fixed;right:16px;bottom:16px;z-index:9999;max-width:280px;padding:12px 16px;border-radius:14px;background:rgba(30,20,15,.93);color:#fff;font-size:13px;line-height:1.6;box-shadow:0 10px 30px rgba(0,0,0,.35);font-family:inherit';
  const CLOSE_CSS = 'position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;background:#c2402b;color:#fff;text-align:center;line-height:20px;font-size:12px;cursor:pointer';
  function floatWidget(id, text) {
    return '(function(){var d=document.createElement("div");d.style.cssText="' + FLOAT_CSS + '";d.id="' + id + '";var c=document.createElement("span");c.style.cssText="' + CLOSE_CSS + '";c.textContent="×";c.onclick=function(){d.remove()};d.appendChild(c);var t=document.createElement("div");d.appendChild(t);document.body.appendChild(d);t.textContent="' + text + '";return t;})();';
  }

  const FREE_APIS = {
    hitokoto: {
      name: '一言 · 每日一句',
      icon: '💬',
      desc: '随机返回一句温暖的话，自动显示在页面右下角，适合提升网站格调。无需注册、完全免费。',
      sample: 'fetch("https://v1.hitokoto.cn/?c=k&encode=json").then(r=>r.json()).then(d=>console.log(d.hitokoto))',
      script: function () {
        return '<script>/* 一言 · 免费API */' + floatWidget('bx-api-hitokoto', '加载中…') +
          'fetch("https://v1.hitokoto.cn/?c=k&encode=json").then(function(r){return r.json()}).then(function(j){var t=document.getElementById("bx-api-hitokoto");if(t&&t.lastChild&&j.hitokoto){t.lastChild.innerHTML="💬 “"+j.hitokoto+"”<br><span style=\"opacity:.7\">—— "+(j.from||"")+"</span>"}}).catch(function(){var t=document.getElementById("bx-api-hitokoto");if(t)t.lastChild.textContent="一言加载失败"});</' + 'script>';
      }
    },
    jinrishici: {
      name: '今日诗词',
      icon: '📜',
      desc: '随机返回一句古诗词（含作者出处），自动显示在页面右下角，很有文化味。免费无需 key。',
      sample: 'fetch("https://v1.jinrishici.com/all.json").then(r=>r.json()).then(d=>console.log(d.content))',
      script: function () {
        return '<script>/* 今日诗词 · 免费API */' + floatWidget('bx-api-poem', '加载诗词…') +
          'fetch("https://v1.jinrishici.com/all.json").then(function(r){return r.json()}).then(function(j){var t=document.getElementById("bx-api-poem");if(t&&t.lastChild&&j.content){t.lastChild.innerHTML="📜 “"+j.content+"”<br><span style=\"opacity:.7\">—— "+(j.author||"")+"《"+(j.origin||"")+"》</span>"}}).catch(function(){var t=document.getElementById("bx-api-poem");if(t)t.lastChild.textContent="诗词加载失败"});</' + 'script>';
      }
    },
    weather: {
      name: '天气 · 实时播报',
      icon: '🌤',
      desc: '按城市显示当前温度与天气，默认北京，改页面 body 的 data-city 属性即可换城市。免费无需 key。',
      sample: 'fetch("https://wttr.in/Beijing?format=j1&lang=zh").then(r=>r.json()).then(d=>console.log(d.current_condition[0]))',
      script: function () {
        return '<script>/* 天气 · wttr.in 免费API（改 data-city 换城市） */' + floatWidget('bx-api-weather', '加载天气…') +
          'var _city=document.body.getAttribute("data-city")||"Beijing";fetch("https://wttr.in/"+_city+"?format=j1&lang=zh").then(function(r){return r.json()}).then(function(j){var t=document.getElementById("bx-api-weather");var c=j&&j.current_condition&&j.current_condition[0];if(t&&t.lastChild&&c){var w=(c.lang_zh&&c.lang_zh[0]&&c.lang_zh[0].value)||(c.weatherDesc&&c.weatherDesc[0]&&c.weatherDesc[0].value)||"";t.lastChild.innerHTML="🌤 "+_city+" "+(c.temp_C||"-")+"°C "+(w||"")}}).catch(function(){var t=document.getElementById("bx-api-weather");if(t)t.lastChild.textContent="天气加载失败"});</' + 'script>';
      }
    },
    ipwhois: {
      name: 'IP 定位 · 访客城市',
      icon: '📍',
      desc: '自动识别访问者所在城市与运营商，显示在页面右下角，适合本地生活类网站。免费无需 key。',
      sample: 'fetch("https://ipwho.is/").then(r=>r.json()).then(d=>console.log(d.city, d.connection.isp))',
      script: function () {
        return '<script>/* IP定位 · ipwho.is 免费API */' + floatWidget('bx-api-ip', '定位中…') +
          'fetch("https://ipwho.is/").then(function(r){return r.json()}).then(function(j){var t=document.getElementById("bx-api-ip");if(t&&t.lastChild&&j&&j.success!==false){t.lastChild.innerHTML="📍 "+(j.city||"未知城市")+" · "+(j.region||"")+"<br><span style=\"opacity:.7\">"+(j.connection&&j.connection.isp||"")+"</span>"}else{var x=document.getElementById("bx-api-ip");if(x)x.lastChild.textContent="定位失败"}}).catch(function(){var t=document.getElementById("bx-api-ip");if(t)t.lastChild.textContent="定位加载失败"});</' + 'script>';
      }
    },
    fx: {
      name: '实时汇率',
      icon: '💱',
      desc: '显示美元/欧元兑人民币的实时汇率，自动显示在页面右下角，适合外贸、代购、留学类网站。免费无需 key。',
      sample: 'fetch("https://open.er-api.com/v6/latest/CNY").then(r=>r.json()).then(d=>console.log(d.rates.USD))',
      script: function () {
        return '<script>/* 汇率 · open.er-api.com 免费API */' + floatWidget('bx-api-fx', '加载汇率…') +
          'fetch("https://open.er-api.com/v6/latest/CNY").then(function(r){return r.json()}).then(function(j){var t=document.getElementById("bx-api-fx");if(t&&t.lastChild&&j&&j.rates){t.lastChild.innerHTML="💱 1 USD ≈ "+(j.rates.USD?j.rates.USD.toFixed(2):"-")+" CNY<br><span style=\"opacity:.7\">1 EUR ≈ "+(j.rates.EUR?j.rates.EUR.toFixed(2):"-")+" CNY</span>"}}).catch(function(){var t=document.getElementById("bx-api-fx");if(t)t.lastChild.textContent="汇率加载失败"});</' + 'script>';
      }
    }
  };

  function addApi(apiId) {
    const def = FREE_APIS[apiId];
    if (!def) return;
    if (!current) { alert('请先新建一个网站'); return; }
    if (current.apis.includes(apiId)) { alert('这个 API 已经接入过啦'); return; }
    if (!lastHtml) { alert('先让 AI 生成网站内容，再接 API 效果更好'); return; }
    if (!injectScript(def.script())) { alert('还没有网站代码，无法接入'); return; }
    current.apis.push(apiId);
    persistCurrent();
    messages.push({ role: 'user', content: '（系统：用户已一键接入免费 API「' + def.name + '」，代码已插入页面 </body> 前。继续修改网站时请保留该功能，除非用户要求移除或移动位置。）', sys: true });
    persistCurrent();
    addMsg('bot', '<span class="status">🧩 已接入「' + def.name + '」：代码已插入页面并生效（右下角可看到效果）。AI 后续改版会自动保留，想移动位置直接跟 AI 说。</span>');
    renderApis();
    renderFiles();
    $('stStatus').textContent = '✅ 已接入 ' + def.name;
  }

  function injectScript(tag) {
    if (!lastHtml) return false;
    lastHtml = repairHtml(lastHtml);
    if (/<\/body>/i.test(lastHtml)) lastHtml = lastHtml.replace(/<\/body>/i, tag + '</body>');
    else lastHtml += tag;
    preview(lastHtml);
    return true;
  }

  function renderApis() {
    const panel = $('apiList');
    if (!panel) return;
    const ids = Object.keys(FREE_APIS);
    panel.innerHTML = ids.map((id) => {
      const def = FREE_APIS[id];
      const on = !!(current && current.apis && current.apis.includes(id));
      return '<div class="api-card' + (on ? ' on' : '') + '">' +
        '<div class="api-head"><span class="api-icon">' + def.icon + '</span><b>' + esc(def.name) + '</b>' +
        (on ? '<span class="api-tag">✅ 已接入</span>' : '') + '</div>' +
        '<p>' + esc(def.desc) + '</p>' +
        '<pre>' + esc(def.sample) + '</pre>' +
        '<button class="st-btn ' + (on ? 'ghost' : 'accent') + ' api-add" data-api="' + id + '"' + (on ? ' disabled' : '') + '>' + (on ? '已接入' : '一键接入') + '</button>' +
        '</div>';
    }).join('');
    panel.querySelectorAll('[data-api]').forEach((b) => {
      b.addEventListener('click', () => addApi(b.dataset.api));
    });
  }

  // ===== 文件区：查看当前网站的所有文件 =====
  let filesCache = [];

  function extractStyle(html) {
    const out = [];
    const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = re.exec(html))) out.push(m[1]);
    return out.join('\n\n');
  }

  function extractScript(html) {
    const out = [];
    const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(html))) out.push(m[1]);
    return out.join('\n\n');
  }

  function extractAssets(html) {
    const urls = [];
    const re = /(?:src|href|poster)=["'](https?:\/\/[^"']+)["']/gi;
    let m;
    while ((m = re.exec(html))) urls.push(m[1]);
    return Array.from(new Set(urls));
  }

  function buildReadme() {
    const name = $('stName').value.trim() || '我的网站';
    const type = $('stType').value === '自动判断' ? '自动判断' : $('stType').value;
    const apis = (current && current.apis && current.apis.length)
      ? current.apis.map((a) => '- ' + (FREE_APIS[a] ? FREE_APIS[a].name : a)).join('\n')
      : '（无）';
    return '# ' + name + '\n\n' +
      '- 网站类型：' + type + '\n' +
      '- 主题配色：' + $('stTheme').value + '\n' +
      '- 生成时间：' + new Date().toLocaleString('zh-CN') + '\n' +
      '- 已接入免费 API：\n' + apis + '\n\n' +
      '由 薄想工作室 AI 建站工作台 免费生成。';
  }

  function buildFiles() {
    const html = lastHtml || '';
    filesCache = [{ path: 'index.html', name: 'index.html', content: html, type: 'html' }];
    if (html) {
      const css = extractStyle(html);
      if (css.trim()) filesCache.push({ path: 'css/style.css', name: 'style.css', content: css.trim(), type: 'css' });
      const js = extractScript(html);
      if (js.trim()) filesCache.push({ path: 'js/script.js', name: 'script.js', content: js.trim(), type: 'js' });
      extractAssets(html).forEach((u, i) => {
        filesCache.push({ path: 'assets/asset-' + (i + 1), name: u, content: u, type: 'asset' });
      });
      filesCache.push({ path: 'README.md', name: 'README.md', content: buildReadme(), type: 'md' });
    }
    return filesCache;
  }

  function fileIcon(f) {
    if (f.type === 'css') return '🎨';
    if (f.type === 'js') return '⚙️';
    if (f.type === 'md') return '📄';
    if (f.type === 'asset') return '🖼️';
    return '🌐';
  }

  function renderFiles() {
    const tree = $('fileTree');
    if (!tree) return;
    const files = buildFiles();
    if (!lastHtml) {
      tree.innerHTML = '<div class="empty-tip">先让 AI 生成网站，这里会列出全部文件</div>';
      $('fileView').hidden = true;
      return;
    }
    tree.innerHTML = '<div class="file-folder">📁 ' + esc($('stName').value.trim() || '我的网站') + '</div>' +
      files.map((f, i) => {
        const short = f.path.split('/').pop();
        return '<div class="file-item" data-fi="' + i + '">' +
          '<span class="fi-icon">' + fileIcon(f) + '</span>' +
          '<span class="fi-name">' + esc(short) + '</span>' +
          (f.type === 'asset' ? '<span class="fi-sub">' + esc(f.name.slice(0, 30)) + '…</span>' : '<span class="fi-sub">' + fmtSize(f.content.length) + '</span>') +
          '</div>';
      }).join('');
    tree.querySelectorAll('[data-fi]').forEach((el) => {
      el.addEventListener('click', () => {
        tree.querySelectorAll('.file-item').forEach((x) => x.classList.remove('active'));
        el.classList.add('active');
        const f = files[+el.dataset.fi];
        $('fileTitle').textContent = f.path;
        $('fileCode').value = f.content;
        $('fileDownload').dataset.path = f.path;
        $('fileCopy').dataset.path = f.path;
        $('fileView').hidden = false;
      });
    });
    const first = tree.querySelector('[data-fi="0"]');
    if (first && $('fileView').hidden) {
      first.classList.add('active');
      $('fileTitle').textContent = files[0].path;
      $('fileCode').value = files[0].content;
      $('fileDownload').dataset.path = files[0].path;
      $('fileCopy').dataset.path = files[0].path;
      $('fileView').hidden = false;
    }
  }

  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    return (n / 1024).toFixed(1) + ' KB';
  }

  // ===== 右侧 Tab 切换 =====
  function setRightTab(tab) {
    $('stTabPreview').classList.toggle('active', tab === 'preview');
    $('stTabFiles').classList.toggle('active', tab === 'files');
    $('stTabApis').classList.toggle('active', tab === 'apis');
    $('previewFrame').hidden = tab !== 'preview';
    $('filesPanel').hidden = tab !== 'files';
    $('apisPanel').hidden = tab !== 'apis';
    if (tab === 'files') renderFiles();
    if (tab === 'apis') renderApis();
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
      const PURPOSE_MAP = { '个人主页': '个人名片', '作品集': '作品集', '企业官网': '其他', '小店展示': '小店展示', '博客': '博客', '活动落地页': '其他', '工具页': '其他', '其他': '其他', '自动判断': '其他' };
      const purpose = PURPOSE_MAP[$('stType').value] || '其他';
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
      if (current) {
        current.published = true;
        current.publishedSlug = slug;
        current.name = title;
        touchSession();
        saveSessions();
        renderSessions();
      }
      body.innerHTML =
        '<div class="ok-mark">🎉</div>' +
        '<h2 style="text-align:center">发布成功！</h2>' +
        '<p class="pub-tip">你的网站已提交上线，站长审核通过后即可访问：</p>' +
        '<a class="pub-url" href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' +
        '<p class="pub-tip"><b>提示：</b>发布的是当前这份代码，后续继续让 AI 修改后需要重新发布。</p>' +
        '<div class="pub-actions">' +
        '<button class="st-btn ghost" id="pubVisit" onclick="window.open(\'' + url + '\',\'_blank\')">🔗 打开网站</button>' +
        '<button class="st-btn accent" id="pubCopy" onclick="navigator.clipboard.writeText(\'' + url + '\')">📋 复制网址</button>' +
        '</div>';
      const copyBtn = body.querySelector('#pubCopy');
      if (copyBtn) copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url); copyBtn.textContent = '已复制 ✓'; }
        catch (e) { window.prompt('复制网址：', url); }
      });
      addMsg('bot', '<span class="status">🎉 发布成功！网址：' + url + '</span>');
    } catch (e) {
      const rawMsg = e && e.message ? e.message : '未知错误';
      const friendlyMsg = /content_html|schema cache|syntax error/i.test(rawMsg)
        ? '数据库还没完成升级：请先在 Supabase → SQL Editor 里执行「AI 建站工作台升级」脚本（向站长要那段代码，粘贴运行即可）。'
        : rawMsg;
      body.innerHTML = '<div class="ok-mark">😥</div><h2 style="text-align:center">发布失败</h2><p class="pub-tip err-box">' + esc(friendlyMsg) + '</p>';
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 发布网站';
    }
  }

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
      setMode(mode);
      touchSession();
    });
  });
  $('stPublish').addEventListener('click', publish);
  $('stNewSite').addEventListener('click', () => {
    persistCurrent();
    newSession();
    addMsg('bot', '<span class="status">✨ 已新建一个空白网站记忆，之前的网站在「📚 我的网站」里可以随时切回来。</span>');
  });
  $('stSessionsBtn').addEventListener('click', () => {
    renderSessions();
    $('sessionModal').hidden = false;
  });
  $('sessionClose').addEventListener('click', () => { $('sessionModal').hidden = true; });
  $('sessionBackdrop').addEventListener('click', () => { $('sessionModal').hidden = true; });
  $('sessionNew').addEventListener('click', () => {
    persistCurrent();
    newSession();
    $('sessionModal').hidden = false;
    renderSessions();
  });

  // 右侧 Tab
  $('stTabPreview').addEventListener('click', () => setRightTab('preview'));
  $('stTabFiles').addEventListener('click', () => setRightTab('files'));
  $('stTabApis').addEventListener('click', () => setRightTab('apis'));

  // 刷新预览
  $('stReload').addEventListener('click', () => {
    if (!lastHtml) return;
    $('stFrame').srcdoc = repairHtml(lastHtml);
    const b = $('stReload'); b.textContent = '🔄 已刷新';
    setTimeout(() => { b.textContent = '🔄 刷新预览'; }, 1200);
  });

  // 复制 / 下载
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

  // 文件区按钮
  $('fileCopy').addEventListener('click', async () => {
    const f = filesCache.find((x) => x.path === $('fileCopy').dataset.path);
    if (!f) return;
    try {
      await navigator.clipboard.writeText(f.content);
      const b = $('fileCopy'); b.textContent = '已复制 ✓';
      setTimeout(() => { b.textContent = '📋 复制'; }, 1400);
    } catch (e) { alert('复制失败'); }
  });
  $('fileDownload').addEventListener('click', () => {
    const f = filesCache.find((x) => x.path === $('fileDownload').dataset.path);
    if (!f) return;
    const blob = new Blob([f.content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.path.split('/').pop();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  });

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
  loadSessions();
  migrateLegacy();
  if (!sessions.length) {
    newSession();
  } else {
    const id = curId();
    const found = id && sessions.find((x) => x.id === id);
    switchTo(found ? found.id : sessions[0].id);
  }
  $('stSessionCount').textContent = sessions.length;
  renderSessions();

  window.addEventListener('beforeunload', () => {
    persistCurrent();
    if (videoTimer) clearInterval(videoTimer);
    if (aborter) aborter.abort();
  });
})();