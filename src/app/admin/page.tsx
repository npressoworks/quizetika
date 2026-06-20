'use client';

/**
 * 管理者メニューポータル画面
 *
 * 各種管理者用サブ画面（モデレーション審査、ユーザー評判管理、ジャンル直接管理）への
 * ナビゲーションを提供するポータル画面です。
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Users, Layers, ArrowRight, Loader2, Bell } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminPortalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // 管理者権限のチェック
  const isAdmin = Boolean(user && isAdminUser(user));

  // 認証・認可ガード
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/admin');
      return;
    }
    if (!loading && user && !isAdmin) {
      router.push('/not-found');
    }
  }, [user, loading, isAdmin, router]);

  // 認証情報の読み込み中表示 (Requirement 8.2)
  if (loading) {
    return (
      <div
        data-testid="admin-portal-loading"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground"
      >
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">管理者認証情報を確認しています...</p>
      </div>
    );
  }

  // 管理者以外は表示しない
  if (!isAdmin) return null;

  // メニューカードの定義
  const menuItems = [
    {
      title: 'モデレーション審査',
      description: '通報されたコンテンツ（クイズなど）を確認し、公開復帰または削除の審査判断を行います。',
      href: '/admin/moderation',
      icon: Shield,
      color: 'from-amber-500/20 to-orange-500/20 text-orange-500 border-orange-500/30',
      iconBg: 'bg-orange-500/10',
    },
    {
      title: 'ユーザー評判管理',
      description: 'ユーザーの評判スコア（Reputation）や権限レベル（ModerationTier）を一元管理します。',
      href: '/admin/users',
      icon: Users,
      color: 'from-blue-500/20 to-indigo-500/20 text-blue-500 border-blue-500/30',
      iconBg: 'bg-blue-500/10',
    },
    {
      title: 'ジャンル直接管理',
      description: 'コミュニティ投票を経由せずに、新しいクイズジャンルを直接新設・管理します。',
      href: '/admin/genres',
      icon: Layers,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-500 border-emerald-500/30',
      iconBg: 'bg-emerald-500/10',
    },
    {
      title: '運営からのお知らせ管理',
      description: 'ビルドなしで運営からのお知らせを追加・編集・削除し、一般ユーザーへ公開します。',
      href: '/admin/announcements',
      icon: Bell,
      color: 'from-purple-500/20 to-pink-500/20 text-purple-500 border-purple-500/30',
      iconBg: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-6">
      {/* 画面ヘッダー */}
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 font-semibold">
            🛡️ システム管理者専用
          </Badge>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          管理者コントロールセンター
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm md:text-base leading-relaxed">
          Quizeumプラットフォームの健全性とガバナンスを維持するための統合管理ポータルです。
          ロールおよび権限に基づき、安全に各機能へアクセスします。
        </p>
      </header>

      {/* メニューカード一覧 (Requirement 8.3) */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group block focus:outline-none">
              <Card className="h-full border border-border bg-card transition-all duration-300 hover:scale-[1.02] hover:shadow-md hover:border-foreground/20 overflow-hidden relative">
                {/* 装飾用のグラデーション背景 */}
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
                
                <CardHeader className="relative z-10 pb-2">
                  <div className="flex items-center justify-between">
                    <div className={`flex size-12 items-center justify-center rounded-xl ${item.iconBg} ${item.color.split(' ')[2]} transition-transform duration-300 group-hover:scale-110`}>
                      <IconComponent className="size-6" />
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-foreground" />
                  </div>
                  <CardTitle className="mt-4 text-xl font-bold group-hover:text-foreground">
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10">
                  <CardDescription className="text-sm leading-relaxed text-muted-foreground group-hover:text-muted-foreground/80">
                    {item.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
