'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAds } from '@/hooks/useAds';
import { cn } from '@/lib/utils';

interface AdsenseInlineAdProps {
  adSlot?: string;
  className?: string;
}

export function AdsenseInlineAd({ adSlot, className }: AdsenseInlineAdProps): React.JSX.Element | null {
  const { showAds } = useAds();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const isE2EMock = typeof window !== 'undefined' && window.localStorage.getItem('e2e-mock-ads') === 'true';
  const isDummy =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    isE2EMock ||
    !clientId;

  // 本番環境用の AdSense push トリガー
  useEffect(() => {
    if (mounted && showAds && !isDummy) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        // 広告ブロックやロードエラー時は例外を無視する
        console.warn('[AdSense] push 呼び出しが失敗しました (広告ブロッカー等の影響の可能性があります):', e);
      }
    }
  }, [mounted, showAds, isDummy]);

  // ハイドレーションミスマッチを防ぐためマウント完了まで何も表示しない
  if (!mounted || !showAds) {
    return null;
  }



  const cardClass = cn(
    'h-full gap-0 overflow-hidden pt-0 border border-border bg-card text-card-foreground',
    'transform-gpu backface-hidden',
    'transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
    'hover:-translate-y-2 hover:shadow-lg hover:shadow-primary/10 hover:ring-primary/25',
    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
    className
  );

  if (isDummy) {
    return (
      <Card className={cardClass} data-testid="ad-card-dummy">
        <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
          <div className="absolute top-2 left-2 z-10 rounded-md bg-amber-500/90 px-2 py-0.5 text-xs font-bold text-amber-950 backdrop-blur-sm shadow-sm">
            PR
          </div>
          <span className="text-4xl">📢</span>
        </div>

        <CardContent className="flex flex-1 flex-col gap-3 pt-6">
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-foreground">
            PR: スポンサー広告
          </h3>
          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
            クイズをプレイしていただきありがとうございます。広告はサービスの維持とAI解答機能の提供に使用されています。
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>配信元: Google AdSense (Mock)</span>
          </div>
          <Button className="mt-auto w-full variant-outline" type="button" disabled>
            スポンサーサイトを見る
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 本番環境用の AdSense 表示
  return (
    <Card className={cardClass} data-testid="ad-card-real">
      <div className="relative w-full h-full min-h-[350px] flex flex-col">
        <div className="absolute top-2 left-2 z-10 rounded-md bg-amber-500/90 px-2 py-0.5 text-xs font-bold text-amber-950 backdrop-blur-sm shadow-sm">
          PR
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', height: '100%' }}
            data-ad-client={clientId}
            data-ad-slot={adSlot || 'default'}
            data-ad-format="fluid"
            data-ad-layout-key="-fb+5w+4e-db+86"
            data-testid="ad-card-adsense"
          />
        </div>
      </div>
    </Card>
  );
}

// 本番環境用の push トリガー
export function triggerAdSensePush() {
  if (typeof window !== 'undefined') {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (e) {
      // 広告ブロックやロードエラー時は例外を無視する
      console.warn('[AdSense] push 呼び出しが失敗しました (広告ブロッカー等の影響の可能性があります):', e);
    }
  }
}
