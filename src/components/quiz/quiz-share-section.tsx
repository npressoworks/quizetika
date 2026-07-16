'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ContentCopyOutlined, ShareOutlined, SmsOutlined } from '@mui/icons-material';
import { buildTwitterShareUrl, buildLineShareUrl } from '@/lib/social-share';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface QuizShareSectionProps {
  quizId: string;
  quizTitle: string;
}

const classes = {
  section: 'w-full',
  trigger:
    'inline-flex items-center justify-center rounded-full border border-border bg-background p-2 text-foreground transition-colors hover:bg-muted',
  menuContent: 'w-[220px]',
  menuItem: 'gap-2',
} as const;

const COPY_FEEDBACK_DURATION_MS = 3000;

/**
 * クイズ詳細画面向けのSNS共有メニュー。
 * 共有アイコンボタン押下で展開するドロップダウンメニューから、
 * X共有・LINE共有・URLコピーの3操作を提供する（要件28、Phase 40）。
 */
export const QuizShareSection: React.FC<QuizShareSectionProps> = ({ quizId, quizTitle }) => {
  const [shareUrl, setShareUrl] = useState('');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // origin はSSR時点で確定しないため、success-client.tsx の handleCopyUrl 生成パターンと
      // 同様にクライアント側マウント後の効果内でのみ算出する。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShareUrl(`${window.location.origin}/quiz/${quizId}`);
    }
  }, [quizId]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          setCopied(false);
          setOpen(false);
        }, COPY_FEEDBACK_DURATION_MS);
      }
    } catch (err) {
      console.error('URLのコピーに失敗しました:', err);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    // コピー完了フィードバック表示中は、外側クリックやEscape以外の理由での
    // クローズ要求（例: コピー項目自身の再クリック直後の内部状態変化）でも
    // フィードバックが即座に消えないよう、明示的な自動クローズ（setTimeout側）
    // にのみ閉じる責務を寄せる。ユーザーが再度アイコンを押す・外側をクリックする・
    // Escapeを押す操作は通常どおり Base UI の open state 変更として届くため許可する。
    setOpen(nextOpen);
  };

  return (
    <div className={classes.section}>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={classes.trigger}
              data-testid="quiz-detail-share-trigger"
              aria-label="このクイズをシェアする"
            />
          }
        >
          <ShareOutlined sx={{ fontSize: 20 }} />
        </DropdownMenuTrigger>
        <DropdownMenuContent className={classes.menuContent} data-testid="quiz-detail-share-menu">
          <DropdownMenuItem
            className={classes.menuItem}
            render={
              <a
                href={buildTwitterShareUrl(quizTitle, shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="quiz-detail-share-x"
              />
            }
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Xでシェア</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={classes.menuItem}
            render={
              <a
                href={buildLineShareUrl(shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="quiz-detail-share-line"
              />
            }
          >
            <SmsOutlined sx={{ fontSize: 16 }} />
            <span>LINEで送る</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={classes.menuItem}
            closeOnClick={false}
            onClick={handleCopyUrl}
            data-testid="quiz-detail-share-copy"
          >
            <ContentCopyOutlined sx={{ fontSize: 16 }} />
            <span>{copied ? 'コピーしました' : 'URLをコピー'}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
