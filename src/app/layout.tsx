import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { PostHogProvider } from "./providers";
import { PostHogPageView } from "./PostHogPageView";
import { getThemeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "quizeum - クイズ投稿・管理SNS",
  description: "クイズを自由に作成・投稿し、他のユーザーと競い合える次世代クイズSNSプラットフォーム。自分だけのリストの作成や、フォロー機能、ランキングなど楽しさ満載！",
  keywords: ["クイズ", "リスト", "投稿", "SNS", "学習", "教育", "quizeum"],
  authors: [{ name: "quizeum Dev Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
      </head>
      <body>
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <AuthProvider>
            <ThemeProvider>
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </ThemeProvider>
          </AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}

