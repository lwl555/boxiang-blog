// ===== Agnes AI 免费三模型封装（文本 / 图像 / 视频）=====
// 文本：agnes-2.0-flash（OpenAI 兼容 /v1/chat/completions）
// 图像：agnes-image-2.1-flash（/v1/images/generations）
// 视频：agnes-video-v2.0（异步任务 /v1/videos + /agnesapi 轮询）
// API Key 从后台「站点设置 → agnes_api_key」读取（管理员可随时更换）
window.Agnes = (function () {
  const API_ROOT = 'https://api.agnes-ai.cn';
  const BASE = API_ROOT + '/v1';
  const MODELS = {
    text: 'agnes-2.0-flash',
    image: 'agnes-image-2.1-flash',
    video: 'agnes-video-v2.0'
  };

  let _key = '';
  let _keyPromise = null;

  function getKey() {
    if (_key) return Promise.resolve(_key);
    if (_keyPromise) return _keyPromise;
    _keyPromise = (async () => {
      try {
        if (window.supabase && window.SUPABASE_URL) {
          const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
          const { data } = await sb
            .from(window.SUPABASE_TABLES.config)
            .select('key,value')
            .eq('key', 'agnes_api_key')
            .maybeSingle();
          if (data && data.value && String(data.value).trim()) {
            _key = String(data.value).trim();
            return _key;
          }
        }
      } catch (e) { /* 忽略，走本地缓存 */ }
      const local = localStorage.getItem('bx_agnes_key');
      if (local) { _key = local.trim(); return _key; }
      return '';
    })();
    return _keyPromise;
  }

  function headers(key) {
    return {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    };
  }

  // ===== 错误分类：网络 / 超时 / 接口 =====
  function netErr(code, msg) {
    const e = new Error(msg);
    e.code = code;
    return e;
  }
  function classifyError(e, fallback) {
    if (!e) return new Error(fallback);
    if (e.code) return e;
    if (e.name === 'AbortError') return netErr('timeout', '请求超时：AI 服务响应太慢，已自动重试或请稍后再试');
    if (e.name === 'TypeError' || /network|fetch|ECONN|socket|interrupt|chunk/i.test(e.message || '')) {
      return netErr('network', '网络连接不稳定，请检查网络后重试');
    }
    return e;
  }

  // ===== 超时控制器（兼容外部 signal）=====
  function withTimeout(ms, externalSignal) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    const onAbort = () => ctrl.abort();
    if (externalSignal) {
      if (externalSignal.aborted) ctrl.abort();
      else externalSignal.addEventListener('abort', onAbort);
    }
    return {
      signal: ctrl.signal,
      done() {
        clearTimeout(timer);
        if (externalSignal) externalSignal.removeEventListener('abort', onAbort);
      }
    };
  }

  async function errOf(r, fallback) {
    try { const j = await r.json(); return (j && j.error && (j.error.message || j.error.msg)) || fallback; }
    catch (e) { return fallback; }
  }

  // ===== 文本：流式 / 非流式对话 =====
  async function chat(messages, opts = {}) {
    const key = await getKey();
    if (!key) throw new Error('AI 服务还没配置好，站长稍后会上线，请稍等～');
    const body = {
      model: MODELS.text,
      messages: messages,
      stream: !!opts.stream
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;

    const timeout = opts.timeout || 240000;
    const t = withTimeout(timeout, opts.signal);
    let r;
    try {
      r = await fetch(BASE + '/chat/completions', {
        method: 'POST',
        headers: headers(key),
        body: JSON.stringify(body),
        signal: t.signal
      });
    } catch (e) {
      t.done();
      throw classifyError(e, '文本生成失败');
    }
    t.done();

    if (!opts.stream) {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw netErr('http', await errOf(r, '文本生成失败：' + r.status));
      return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    }
    if (!r.ok || !r.body) throw netErr('http', await errOf(r, '文本生成失败：' + r.status));

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    let full = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        let i;
        while ((i = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, i).trim();
          buffer = buffer.slice(i + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (delta) {
              full += delta;
              if (opts.onDelta) opts.onDelta(delta);
            }
          } catch (e) { /* 跳过解析失败的行 */ }
        }
      }
    } catch (e) {
      throw classifyError(e, '网络中断：流式输出未完成');
    }
    return full;
  }

  // ===== 图像：文生图（URL 输出）=====
  async function generateImage(prompt, opts = {}) {
    const key = await getKey();
    if (!key) throw new Error('AI 服务还没配置好，站长稍后会上线，请稍等～');
    const body = {
      model: MODELS.image,
      prompt: prompt,
      size: opts.size || '1K',
      ratio: opts.ratio || '16:9',
      extra_body: { response_format: 'url' }
    };
    const t = withTimeout(opts.timeout || 150000, null);
    let r;
    try {
      r = await fetch(BASE + '/images/generations', {
        method: 'POST',
        headers: headers(key),
        body: JSON.stringify(body),
        signal: t.signal
      });
    } catch (e) {
      t.done();
      throw classifyError(e, '图像生成失败');
    }
    t.done();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw netErr('http', await errOf(r, '图像生成失败：' + r.status));
    return (j.data && j.data[0] && j.data[0].url) || '';
  }

  // ===== 视频：异步任务 =====
  async function createVideo(prompt, opts = {}) {
    const key = await getKey();
    if (!key) throw new Error('AI 服务还没配置好，站长稍后会上线，请稍等～');
    const body = {
      model: MODELS.video,
      prompt: prompt,
      width: opts.width || 1152,
      height: opts.height || 768,
      num_frames: opts.num_frames || 121,
      frame_rate: opts.frame_rate || 24
    };
    const t = withTimeout(opts.timeout || 90000, null);
    let r;
    try {
      r = await fetch(BASE + '/videos', {
        method: 'POST',
        headers: headers(key),
        body: JSON.stringify(body),
        signal: t.signal
      });
    } catch (e) {
      t.done();
      throw classifyError(e, '视频任务创建失败');
    }
    t.done();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw netErr('http', await errOf(r, '视频任务创建失败：' + r.status));
    return j.video_id || j.task_id || j.id || '';
  }

  async function getVideo(videoId) {
    const key = await getKey();
    const t = withTimeout(40000, null);
    let r;
    try {
      r = await fetch(API_ROOT + '/agnesapi?video_id=' + encodeURIComponent(videoId), {
        headers: { 'Authorization': 'Bearer ' + key },
        signal: t.signal
      });
    } catch (e) {
      t.done();
      throw classifyError(e, '查询视频失败');
    }
    t.done();
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw netErr('http', await errOf(r, '查询视频失败：' + r.status));
    return j;
  }

  return {
    MODELS: MODELS,
    getKey: getKey,
    chat: chat,
    generateImage: generateImage,
    createVideo: createVideo,
    getVideo: getVideo
  };
})();