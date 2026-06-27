import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { PostHogProvider } from "./providers";
import { PostHogPageView } from "./PostHogPageView";
import { getThemeInitScript } from "@/lib/theme";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

import { AdsenseProvider } from "@/components/ads/adsense-provider";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "quizetika - クイズ投稿・管理SNS",
  description: "クイズを自由に作成・投稿し、他のユーザーと競い合える次世代クイズSNSプラットフォーム。自分だけのリストの作成や、フォロー機能、ランキングなど楽しさ満載！",
  keywords: ["クイズ", "リスト", "投稿", "SNS", "学習", "教育", "quizetika"],
  authors: [{ name: "quizetika Dev Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning className={cn(geistSans.variable, geistMono.variable, "font-sans")}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
      </head>
      <body>
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <AuthProvider>
            <AdsenseProvider>
              <ThemeProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
              </ThemeProvider>
            </AdsenseProvider>
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}


