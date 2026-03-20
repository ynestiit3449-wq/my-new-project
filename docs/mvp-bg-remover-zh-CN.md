# Image Background Remover — MVP 需求说明（v1.0）

版本：v1.0  日期：2026-03-20
负责人：陈

1) 项目背景与目标
- 目标：提供一个极简网页，用户上传图片后，在线去除背景并下载透明背景图。
- 约束与偏好：
  - 部署：Cloudflare（Pages 前端 + Workers 后端）
  - 存储：不使用持久化存储（不落盘，不用 R2/KV/Images）；仅内存流式处理
  - 第三方：Remove.bg API
- 成功标准（MVP）：用户在桌面和手机端均可于 ≤8 秒获得处理结果；前后端均不持久化图片；密钥不泄露。

2) MVP 范围（Scope）
- 必做：
  - 单张图片上传（或提供图片 URL）
  - 参数：size（auto/full/preview），输出格式 png
  - 显示结果预览、下载按钮
  - 错误提示（网络/配额/图片不合规）
  - CORS 限制为自有域名
  - 不落盘，Worker 端全程流式转发
- 可选（若进度允许）：
  - 人机验证：Cloudflare Turnstile
  - 背景替换：纯色背景合成（前端 Canvas）
  - 国际化：中/英双语切换

3) 关键用户旅程（User Journeys）
- UJ1：上传并去背景
  - 进入主页 → 选择图片或拖拽 → 点击「去除背景」→ 显示处理进度 → 预览透明 PNG → 下载
- UJ2：URL 处理（可选）
  - 粘贴图片 URL → 去背景 → 预览/下载
- UJ3：失败重试
  - 弹框显示失败原因与建议 → 允许重新上传/重试

4) 功能需求
- 前端（单页）
  - 组件：上传区（拖拽+选择）、参数区（size 下拉）、提交按钮、结果区（预览+下载）
  - 状态：初始/上传中/处理中/成功/失败
  - 校验：仅 image/*；大小 ≤10MB；清晰的错误提示
  - 体验：处理期间显示加载动画；成功后自动展示预览与下载
  - 移动端适配：按钮适合触控、图片自适应宽度
- 后端（Cloudflare Worker）
  - POST /api/remove-bg
    - 输入：multipart/form-data（image_file 或 image_url），size（默认 auto），format=png
    - 处理：将 FormData 直传 Remove.bg（X-Api-Key 来自环境变量），不持久化；流式回传响应体
    - 输出：透明 PNG（二进制流），或 JSON 错误
  - CORS：仅允许指定域（env.CORS_ORIGIN）；支持 OPTIONS 预检
  - Headers：Cache-Control: no-store，禁止缓存
  - 日志：仅记录必要技术元数据（状态码/耗时），不记录图片/PII
- 第三方 API（Remove.bg）
  - Endpoint：POST https://api.remove.bg/v1.0/removebg
  - 参数（MVP 使用）：image_file 或 image_url，size（auto/full/preview），format=png
  - 注意：使用 preview 模式便于联调与控费；失败时透传核心错误信息（状态码/简述）

5) 接口定义（Contract）
- POST /api/remove-bg
  - Request（multipart/form-data）
    - image_file: File（二选一）
    - image_url: string（二选一）
    - size: "auto" | "full" | "preview"（可选，默认 auto）
    - format: "png"（可选，默认 png）
  - Response
    - 成功：200，Content-Type: image/png；body 为图像二进制流
    - 失败：4xx/5xx，Content-Type: application/json
      - { error: string, status?: number, detail?: string }
- CORS
  - Access-Control-Allow-Origin: https://yourdomain.com
  - Methods: POST, OPTIONS
  - Headers: Content-Type

6) 数据与状态
- 无服务端持久化存储
- 内存态：请求到达 → 构建 FormData → 转发 Remove.bg → 将响应流直接返回
- 前端本地状态：仅用于显示进度与结果（blob URL）；刷新即丢失

7) 安全与合规
- 密钥管理：REMOVE_BG_API_KEY 通过 wrangler secret 注入；不在前端暴露
- CORS：限制为正式域名
- 人机验证（可选）：Cloudflare Turnstile（前端 sitekey + Worker 验证）
- 防滥用（MVP 简化）：限制单次上传大小与 MIME 类型；显示服务条款与隐私说明
- 隐私：在页面显著说明「仅实时处理，不存储图片」

8) 非功能性需求（NFR）
- 性能：端到端 P95 ≤ 8s（full 可能更久，需提示）；首屏加载 ≤ 1s（静态站点）
- 可用性：≥ 99.9%（依赖 Remove.bg SLA）
- 可观测性：记录关键指标（成功率/失败率/平均耗时），不含图像/PII
- 浏览器支持：Chrome/Edge/Safari/Firefox 最近两个大版本；移动端 Safari/Chrome

9) 监控与告警（MVP 轻量）
- Workers Analytics：请求数、错误率、耗时
- Remove.bg 侧：监控配额/余额
- 告警：错误率 >5% 或连续 3 分钟失败即在控制台查看（后续接入通知）

10) 文案与本地化
- 中文为默认；常用错误的友好说明（文件过大、格式不支持、配额不足、网络异常）
- 可选：英文切换

11) 上线与运维
- 部署
  - 前端：Cloudflare Pages（或内置在 Worker 响应中，MVP 可先内置）
  - 后端：Cloudflare Workers（wrangler deploy）
  - 环境变量：REMOVE_BG_API_KEY、CORS_ORIGIN（必设）
- 域名与路由
  - 生产域名 Pages 指向静态文件
  - /api/remove-bg 路由到 Worker
- 回滚：保留上个稳定版本

12) 验收标准（验收用例）
- 用例 A：上传 2MB PNG，size=auto
  - 期望：≤8s 返回透明 PNG，可预览与下载，网络面板 200 且无缓存
- 用例 B：上传 JPEG，size=preview
  - 期望：成功返回透明 PNG，像素符合 preview 规格（以 Remove.bg 定义为准）
- 用例 C：不选文件直接提交
  - 期望：前端即时提示；若到达后端，则 400 JSON 错误
- 用例 D：上传 15MB 图片
  - 期望：前端阻止并提示「文件过大（≤10MB）」；不可发起请求
- 用例 E：伪造跨域请求
  - 期望：被 CORS 拦截（非允许域无法读取响应）
- 用例 F：Remove.bg 配额不足/返回 402/429
  - 期望：前端展示明确错误与重试/改用 preview 提示；后端返回 JSON 错误
- 用例 G：移动端 Safari
  - 期望：页面可用、可上传、可下载

13) 里程碑与工期（紧凑版）
- 第1天：项目初始化（Pages/Worker、wrangler、环境变量、基础页面）
- 第2天：后端联通 Remove.bg（流式转发、错误处理、CORS）
- 第3天：前端流程与 UI、移动端适配、基本校验
- 第4天：联调与验收用例；性能与文案优化
- 第5天：可选增强（Turnstile/背景替换），预发布与上线

14) 风险与应对
- Remove.bg 计费与配额风险：默认 preview；在 UI 明示计费逻辑；低余额预警流程
- 滥用：短期用 Turnstile；若被刷再评估限流（会涉及存储/状态）
- 跨域与密钥泄露：CORS 严格限制域；密钥仅 Worker 侧使用
- 体积与时延：提示 full 模式更慢；默认 auto/preview

15) 成本预估（粗略）
- Cloudflare Workers/Pages：小规模基本接近免费（视请求量）
- Remove.bg：按次计费；开发阶段使用 preview 控费；上线前评估月预算与价格等级

16) 埋点（可选，轻量）
- 事件：
  - upload_start {file_type, file_size, size_param}
  - upload_fail {reason}
  - process_success {elapsed_ms, size_param}
  - process_fail {status, reason}
  - download_click {}
- 仅匿名事件，不上传任何图片内容或可识别个人数据

17) 超出范围（Out of Scope，MVP 不做）
- 批量处理与队列
- 用户账号/计费系统
- 自研/本地模型推理
- 历史记录与图库（因不存储）
- 多种高级编辑（抠边微调、发丝修复手动笔刷等）

附录 A：技能检索与来源备注（按运营策略）
- skillhub search image background remover：
  -（节选）self-improving-agent、find-skills、summarize、agent-browser、gog、github、ontology、skill-vetter、proactive-agent、weather、self-improving、nano-pdf、multi-search-engine、sonoscli、humanizer、notion、obsidian、nano-banana-pro、openai-whisper、auto-updater
- clawhub search image background remover：
  - imagemagick、background-removal、image-edit、design-assets、image-process、image-to-relief-stl、background-remove、fal-text-to-image、bria-ai、image-enhancer
- skillhub search background removal：
  - background-removal（v0.1.5）、imagemagick（v1.0.0）、image-edit（v1.0.0）、video-edit（v1.0.0）、eachlabs-image-edit（v0.1.1）、ai-task-hub（v3.2.10）、image-process（v0.1.0）、cutout-visual-api（v1.0.0）等
- 说明与风险信号：
  - 你已指定使用 Remove.bg API，因此无需安装额外技能。
  - 可选备选：
    - background-removal（BiRefNet，本地/推理脚本）：需要下载模型与算力；注意许可与镜像可信度。
    - cutout-visual-api（Cutout.Pro 云 API）：第三方计费、密钥管理、可用性风险。
- 公开与私有源均可并行使用，非排他。
