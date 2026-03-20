export const runtime = 'edge';
import { getRequestContext } from '@cloudflare/next-on-pages';

function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  } as Record<string, string>;
}

export async function OPTIONS() {
  const { env } = getRequestContext();
  return new Response(null, { status: 204, headers: corsHeaders(env.CORS_ORIGIN) });
}

export async function POST(req: Request) {
  const { env } = getRequestContext();
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return json({ error: 'multipart/form-data required' }, 400, env);
  }

  const form = await req.formData();
  const file = form.get('image_file');
  const imageUrl = form.get('image_url');
  if (!file && !imageUrl) {
    return json({ error: 'image_file or image_url required' }, 400, env);
  }

  const out = new FormData();
  if (file instanceof File) out.append('image_file', file, (file as File).name || 'upload.png');
  if (imageUrl) out.append('image_url', String(imageUrl));
  out.append('size', String(form.get('size') || 'auto'));
  out.append('format', String(form.get('format') || 'png'));

  const r = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY },
    body: out,
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return json({ error: 'remove.bg failed', status: r.status, detail: detail.slice(0, 500) }, 502, env);
  }

  const headers = new Headers({
    'Content-Type': r.headers.get('content-type') || 'image/png',
    'Cache-Control': 'no-store',
    ...corsHeaders(env.CORS_ORIGIN),
  });
  return new Response(r.body, { status: 200, headers });
}

function json(obj: unknown, status: number, env: any) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(env?.CORS_ORIGIN),
    },
  });
}
