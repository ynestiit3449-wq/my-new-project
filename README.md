# Image Background Remover (Next.js + Tailwind + Cloudflare)

MVP 前端使用 Next.js App Router + Tailwind，后端 API 在 ，通过 Cloudflare（edge runtime）代理 Remove.bg，不落盘，仅内存流式转发。

快速开始：
- npm i
- npm run dev

Cloudflare 部署：
- npm i -g wrangler
- wrangler login
- wrangler secret put REMOVE_BG_API_KEY
- wrangler secret put CORS_ORIGIN   # 例如 https://yourdomain.com
- wrangler deploy

注意：Remove.bg 为计费 API，建议先用 size=preview 联调；生产请限制 CORS。
