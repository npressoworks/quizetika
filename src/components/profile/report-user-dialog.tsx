'use client';

import React, { useState } from 'react';
import { WarningAmberOutlined, CheckCircleOutlined, CloseOutlined } from '@mui/icons-material';
import { submitUserReport } from '@/services/user-report';
import { UserReportCategory } from '@/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReportUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetUid: string;
  targetDisplayName?: string;
  reporterId: string;
}

const CATEGORY_OPTIONS: { value: UserReportCategory; label: string }[] = [
  { value: 'harassment', label: 'ハラスメント' },
  { value: 'impersonation', label: 'なりすまし' },
  { value: 'spam', label: 'スパム' },
  { value: 'other', label: 'その他' },
];

export function ReportUserDialog({
  isOpen,
  onClose,
  targetUid,
  targetDisplayName,
  reporterId,
}: ReportUserDialogProps) {
  const [category, setCategory] = useState<UserReportCategory | ''>('');
  const [detail, setDetail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setCategory('');
    setDetail('');
    setValidationError(null);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!category || !detail.trim()) {
      setValidationError('通報理由を選択し、詳細を入力してください。');
      return;
    }

    setValidationError(null);
    setError(null);
    setLoading(true);
    try {
      await submitUserReport(reporterId, targetUid, category, detail);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        resetState();
        onClose();
      }, 2000);
    } catch (err: unknown) {
      console.error('[ReportUserDialog] 通報失敗:', err);
      const message = err instanceof Error ? err.message : '通報の送信に失敗しました。もう一度お試しください。';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className="max-w-lg sm:max-w-lg"
        showCloseButton={false}
        data-testid="report-user-dialog-content"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <WarningAmberOutlined sx={{ fontSize: 18 }} className="text-destructive" />
              ユーザーの通報
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              aria-label="閉じる"
            >
              <CloseOutlined sx={{ fontSize: 18 }} />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            通報理由を選択し、詳細を入力してください
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center font-medium" data-testid="report-user-success-message">
            <CheckCircleOutlined sx={{ fontSize: 32 }} className="mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
            <p>通報を受け付けました。ご協力ありがとうございました。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {targetDisplayName ? `「${targetDisplayName}」さんが` : 'このユーザーが'}
              迷惑行為やガイドライン違反を行っていると思われる場合は、通報理由を選択し、具体的な内容を入力して通報してください。
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="report-user-category">通報理由のカテゴリ（必須）</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as UserReportCategory)}
                disabled={loading}
              >
                <SelectTrigger
                  id="report-user-category"
                  data-testid="report-user-category-select"
                  className="w-full"
                >
                  <SelectValue placeholder="カテゴリを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      data-testid={`report-user-category-option-${option.value}`}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="report-user-detail">詳細（必須）</Label>
              <Textarea
                id="report-user-detail"
                placeholder="通報理由を具体的に記述してください..."
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                disabled={loading}
                data-testid="report-user-detail-input"
                className="min-h-[120px]"
              />
            </div>

            {validationError && (
              <p className="text-sm text-destructive" data-testid="report-user-validation-error">
                {validationError}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter className="gap-2 sm:justify-stretch">
              <Button type="button" variant="secondary" className="flex-1" onClick={handleClose} disabled={loading}>
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={loading}
                data-testid="report-user-submit-btn"
                data-analytics="profile-report-user-submit"
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
