import type { Metadata, Viewport } from "next";
import { getSettings } from "@/lib/db";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  return {
    title: settings.site_title,
    description: settings.site_description || undefined,
    // 管理后台保存的关键词：帖子页面加载时服务端渲染为 meta keywords
    keywords: settings.keywords.length > 0 ? settings.keywords.join(", ") : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
