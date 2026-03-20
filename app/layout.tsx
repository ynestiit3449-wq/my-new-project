import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Background Remover",
  description: "Remove image backgrounds on Cloudflare Workers via Remove.bg",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
