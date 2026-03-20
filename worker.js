export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env)
      });
    }

    if (url.pathname === '/api/remove-bg' && request.method === 'POST') {
      const ct = request.headers.get('content-type') || '';
      if (!ct.includes('multipart/form-data')) {
        return json({ error: 'multipart/form-data required' }, 400, env);
      }

      const form = await request.formData();
      const file = form.get('image_file');
      const imageUrl = form.get('image_url');
      if (!file && !imageUrl) {
        return json({ error: 'image_file or image_url required' }, 400, env);
      }

      const out = new FormData();
      if (file instanceof File) out.append('image_file', file, file.name || 'upload.png');
      if (imageUrl) out.append('image_url', imageUrl.toString());
      out.append('size', form.get('size') || 'auto');
      out.append('format', form.get('format') || 'png');

      const r = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY },
        body: out
      });

      if (!r.ok) {
        const detail = await r.text();
        return json({ error: 'remove.bg failed', status: r.status, detail: detail.slice(0, 500) }, 502, env);
      }

      const headers = new Headers({
        'Content-Type': r.headers.get('content-type') || 'image/png',
        'Cache-Control': 'no-store',
        ...corsHeaders(env)
      });

      return new Response(r.body, { status: 200, headers });
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(INDEX_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    return new Response('Not found', { status: 404 });
  }
};

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(env)
    }
  });
}

function corsHeaders(env) {
  const origin = env.CORS_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

const INDEX_HTML = `<!doctype html>
<meta charset="utf-8">
<title>Background Remover</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui, -apple-system, Segoe UI, Roboto; margin:24px} #out img{max-width:100%; height:auto} .btn{padding:10px 16px} .row{margin:12px 0}</style>
<h1>Image Background Remover</h1>
<form id="f">
  <div class="row">
    <input type="file" name="image_file" accept="image/*" required>
  </div>
  <div class="row">
    <label>size: </label>
    <select name="size">
      <option value="auto" selected>auto</option>
      <option value="full">full</option>
      <option value="preview">preview</option>
    </select>
  </div>
  <div class="row">
    <button class="btn" type="submit">Remove Background</button>
  </div>
</form>
<div id="msg"></div>
<div id="out"></div>
<script>
const f = document.getElementById('f');
const msg = document.getElementById('msg');
const out = document.getElementById('out');

f.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = 'Processing...';
  out.innerHTML = '';

  const fd = new FormData(f);
  const file = fd.get('image_file');
  if (!file || !file.size) {
    msg.textContent = '请选择图片';
    return;
  }
  if (!file.type.startsWith('image/')) {
    msg.textContent = '仅支持图片文件';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    msg.textContent = '文件过大（≤10MB）';
    return;
  }

  try {
    const res = await fetch('/api/remove-bg', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      msg.textContent = '失败：' + (err.detail || res.status);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    out.innerHTML = '<img alt="result" src="' + url + '"><div class="row"><a class="btn" download="removed.png" href="' + url + '">下载 PNG</a></div>';
    msg.textContent = '完成';
  } catch (e) {
    msg.textContent = '网络异常';
  }
});
</script>`;
