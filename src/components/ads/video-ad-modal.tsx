'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface VideoAdModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function VideoAdModal({ isOpen, onComplete }: VideoAdModalProps): React.JSX.Element | null {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      return;
    }

    if (countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
      data-testid="video-ad-modal"
    >
      <Card className="relative w-full max-w-lg overflow-hidden border border-primary/30 bg-neutral-900 text-white shadow-2xl shadow-primary/20">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <span className="rounded bg-amber-500/90 px-2.5 py-0.5 text-xs font-bold text-amber-950 shadow-sm">
            スポンサー広告
          </span>
          <span className="text-xs text-neutral-400">
            動画広告のテスト再生中
          </span>
        </div>

        {/* 動画プレイヤー風のダミー領域 */}
        <div className="relative aspect-video w-full bg-black flex flex-col items-center justify-center overflow-hidden">
          {/* ネオン風のグラデーション背景とローダー */}
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-950/40 via-black to-emerald-950/40 opacity-70" />
          <div className="z-10 flex flex-col items-center gap-4 text-center p-6">
            <div className="relative flex size-20 items-center justify-center rounded-full bg-neutral-800/80 ring-4 ring-primary/30">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/20 opacity-75" />
              <span className="text-3xl">🎯</span>
            </div>
            <h4 className="text-lg font-bold text-neutral-100 tracking-wide">
              Quizetika Pro プラン
            </h4>
            <p className="text-xs text-neutral-400 max-w-xs">
              月額わずか数百円で、広告が完全に非表示になり、AI質問が使い放題になります。
            </p>
          </div>
        </div>

        {/* コントロール・ボタン領域 */}
        <div className="flex flex-col gap-3 p-6 border-t border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>サービスの継続にご協力ありがとうございます</span>
            {countdown > 0 && (
              <span className="font-mono text-primary font-semibold">
                スキップ可能まであと {countdown} 秒
              </span>
            )}
          </div>

          <Button
            className="w-full py-6 font-bold tracking-wide"
            onClick={onComplete}
            disabled={countdown > 0}
            data-testid="ad-skip-btn"
            type="button"
          >
            {countdown > 0 ? `あと ${countdown} 秒でスキップ可能` : 'スキップして結果へ'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
