import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";

export const metadata: Metadata = {
  title: "quizeum - クイズ投稿・管理SNS",
  description: "クイズを自由に作成・投稿し、他のユーザーと競い合える次世代クイズSNSプラットフォーム。自分だけの問題集の作成や、フォロー機能、ランキングなど楽しさ満載！",
  keywords: ["クイズ", "問題集", "投稿", "SNS", "学習", "教育", "quizeum"],
  authors: [{ name: "quizeum Dev Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
