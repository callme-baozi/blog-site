import type { Metadata, Viewport } from "next";
import { getSettings } from "@/lib/db";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  return {
    title: settings.site_title,
    description: settings.site_description || undefined,
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
