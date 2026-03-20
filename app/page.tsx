"use client";
import { useRef, useState } from "react";

export default function Page() {
  const formRef = useRef(null as HTMLFormElement | null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBlobUrl(null);

    const fd = new FormData(formRef.current!);
    const file = fd.get("image_file") as File | null;
    if (!file || !file.size) { setMsg("请选择图片"); return; }
    if (!file.type.startsWith("image/")) { setMsg("仅支持图片文件"); return; }
    if (file.size > 10 * 1024 * 1024) { setMsg("文件过大（≤10MB）"); return; }

    try {
      setBusy(true);
      const res = await fetch("/api/remove-bg", { method: "POST", body: fd });
      if (!res.ok) {
        let detail = "";
        try { const j = await res.json(); detail = j.detail || j.error || String(res.status); } catch {}
        setMsg("失败：" + (detail || res.status));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setMsg("完成");
    } catch (err) {
      setMsg("网络异常");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Image Background Remover</h1>
          <p className="text-sm text-[#9aa4b2]">在浏览器上传图片，后端通过 Cloudflare Workers 代理 Remove.bg 实时去背景，不存储你的图片。</p>
        </header>

        <section className="card p-6 space-y-4">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
            <div>
              <input className="input" type="file" name="image_file" accept="image/*" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-sm text-[#9aa4b2]">size</span>
                <select name="size" className="select mt-1">
                  <option value="auto" defaultValue="auto">auto</option>
                  <option value="full">full</option>
                  <option value="preview">preview</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-[#9aa4b2]">format</span>
                <select name="format" className="select mt-1">
                  <option value="png" defaultValue="png">png</option>
                </select>
              </label>
            </div>
            <div>
              <button className="btn" type="submit" disabled={busy}>{busy ? "处理中…" : "去除背景"}</button>
            </div>
          </form>

          {msg && <p className="text-sm text-[#9aa4b2]">{msg}</p>}

          {blobUrl && (
            <div className="space-y-3">
              <img src={blobUrl} alt="result" className="w-full h-auto rounded-lg border border-white/10" />
              <a className="btn" href={blobUrl} download="removed.png">下载 PNG</a>
            </div>
          )}
        </section>

        <footer className="text-xs text-[#9aa4b2]">
          <p>隐私说明：图片仅用于实时处理，不会存储。Remove.bg 为第三方计费 API。</p>
        </footer>
      </div>
    </main>
  );
}
