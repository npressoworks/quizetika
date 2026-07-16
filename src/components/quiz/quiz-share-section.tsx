'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ContentCopyOutlined, SmsOutlined } from '@mui/icons-material';
import { buildTwitterShareUrl, buildLineShareUrl } from '@/lib/social-share';

export interface QuizShareSectionProps {
  quizId: string;
  quizTitle: string;
}

const classes = {
  section: 'w-full rounded-xl border border-border bg-muted/20 p-5',
  title: 'mb-4 text-base font-bold text-foreground',
  buttons: 'flex flex-col gap-2 sm:flex-row sm:flex-wrap',
  btnShare:
    'relative inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
  btnX: 'bg-foreground text-background hover:opacity-90',
  btnLine: 'bg-[#06C755] text-white hover:opacity-90',
  btnCopy: 'border border-border bg-background text-foreground hover:bg-muted',
  copyToast:
    'absolute -top-10 left-1/2 -translate-x-1/2 rounded bg-foreground px-3 py-1 text-xs text-background',
} as const;

/**
 * クイズ詳細画面向けのSNS共有セクション。
 * X共有・LINE共有・URLコピーの3操作を提供する（要件28）。
 */
export const QuizShareSection: React.FC<QuizShareSectionProps> = ({ quizId, quizTitle }) => {
  const [shareUrl, setShareUrl] = useState('');
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
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error('URLのコピーに失敗しました:', err);
    }
  };

  return (
    <div className={classes.section} data-testid="quiz-detail-share-section">
      <h2 className={classes.title}>このクイズをシェアする</h2>
      <div className={classes.buttons}>
        <a
          href={buildTwitterShareUrl(quizTitle, shareUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${classes.btnShare} ${classes.btnX}`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Xでシェア
        </a>

        <a
          href={buildLineShareUrl(shareUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${classes.btnShare} ${classes.btnLine}`}
        >
          <SmsOutlined sx={{ fontSize: 18 }} />
          LINEで送る
        </a>

        <button
          type="button"
          onClick={handleCopyUrl}
          className={`${classes.btnShare} ${classes.btnCopy}`}
        >
          <ContentCopyOutlined sx={{ fontSize: 18 }} />
          URLをコピー
          {copied && <span className={classes.copyToast}>コピーしました！</span>}
        </button>
      </div>
    </div>
  );
};
