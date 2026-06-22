'use client';

import React, { useState } from 'react';
import { WarningAmberOutlined, CheckCircleOutlined, CloseOutlined } from '@mui/icons-material';
import { flagContent } from '@/services/moderation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  reporterId: string;
}

export function ReportModal({ isOpen, onClose, quizId, reporterId }: ReportModalProps) {
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      await flagContent(quizId, reporterId, reason);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setReason('');
        onClose();
      }, 2000);
    } catch (err: unknown) {
      console.error('[ReportModal] 通報失敗:', err);
      const message = err instanceof Error ? err.message : '通報の送信に失敗しました。もう一度お試しください。';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-lg sm:max-w-lg"
        showCloseButton={false}
        data-testid="report-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div data-testid="report-modal-overlay" className="sr-only" aria-hidden />

        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <WarningAmberOutlined sx={{ fontSize: 18 }} className="text-destructive" />
              クイズの通報
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="閉じる"
            >
              <CloseOutlined sx={{ fontSize: 18 }} />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            クイズの通報理由を入力してください
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center font-medium" data-testid="report-success-message">
            <CheckCircleOutlined sx={{ fontSize: 32 }} className="mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
            <p>通報を送信しました。ご協力ありがとうございました。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              このクイズが利用規約やガイドライン（公序良俗に反する内容、著作権侵害、その他不適切な記述など）に違反していると思われる場合は、具体的な理由を入力して通報してください。
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="report-reason">通報理由（必須）</Label>
              <Textarea
                id="report-reason"
                placeholder="通報理由を具体的に記述してください..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                disabled={loading}
                data-testid="report-reason-input"
                className="min-h-[120px]"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2 sm:justify-stretch">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={loading || !reason.trim()}
                data-testid="report-submit-btn"
                data-analytics="quiz-report-submit"
              >
                {loading ? '送信中...' : '通報する'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
