'use client';

import React from 'react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateQuiz } from '@/services/quiz';
import { resolveQuizVisibility, ProRequiredForVisibilityError } from '@/lib/quiz-access';
import type { Quiz, QuizVisibility } from '@/types';
import type { UserEntitlements } from '@/types/subscription';

export interface CreatorQuizVisibilityToggleProps {
  quiz: Pick<Quiz, 'id' | 'status' | 'visibility'>;
  entitlements: Pick<UserEntitlements, 'hasPaidEntitlements'>;
  onVisibilityChange: (quizId: string, next: QuizVisibility) => void;
}

const VISIBILITY_OPTIONS: { value: QuizVisibility; label: string }[] = [
  { value: 'public', label: '公開' },
  { value: 'followers', label: '限定公開' },
  { value: 'private', label: '非公開' },
];

const PRO_RESTRICTED_VISIBILITY: QuizVisibility[] = ['followers', 'private'];

function isProRequiredError(error: unknown): boolean {
  if (error instanceof ProRequiredForVisibilityError) {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'pro-required-for-visibility'
  );
}

/**
 * 公開済みクイズの公開範囲（公開・限定公開・非公開）を切り替える UI。
 *
 * 呼び出し側（`CreatorQuizManagementSections`）が `status === 'published'` の行にのみ
 * マウントすることを前提とする（要件17.2, 17.3）。念のため `quiz.status !== 'published'`
 * の場合は Select 自体を disabled にして誤操作を防ぐ（CONCERNS 参照）。
 *
 * 無料プランのユーザーも限定公開・非公開の選択操作自体は行えるが、実際に切り替えは行わず
 * Pro プランへの誘導ポップアップを表示する。API 呼び出し後にサーバー側で権限エラーが
 * 返った場合（プラン状態の競合等）も同じポップアップで案内する。
 */
export function CreatorQuizVisibilityToggle({
  quiz,
  entitlements,
  onVisibilityChange,
}: CreatorQuizVisibilityToggleProps) {
  const currentVisibility = resolveQuizVisibility(quiz);
  const [displayValue, setDisplayValue] = React.useState<QuizVisibility>(currentVisibility);
  const [pending, setPending] = React.useState(false);
  const [genericError, setGenericError] = React.useState(false);
  const [proModalOpen, setProModalOpen] = React.useState(false);

  const canAccessProVisibility = entitlements.hasPaidEntitlements;
  const notPublished = quiz.status !== 'published';

  const handleValueChange = async (value: string) => {
    const next = value as QuizVisibility;
    const previous = displayValue;
    if (next === previous) {
      return;
    }

    if (PRO_RESTRICTED_VISIBILITY.includes(next) && !canAccessProVisibility) {
      // 無料プランでは選択操作自体は許可するが、実際の切り替えは行わずポップアップで案内する。
      setProModalOpen(true);
      return;
    }

    setGenericError(false);
    setDisplayValue(next);
    setPending(true);
    try {
      await updateQuiz(quiz.id, { visibility: next });
      setPending(false);
      onVisibilityChange(quiz.id, next);
    } catch (error) {
      setPending(false);
      setDisplayValue(previous);
      if (isProRequiredError(error)) {
        setProModalOpen(true);
      } else {
        setGenericError(true);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Select
        value={displayValue}
        disabled={pending || notPublished}
        onValueChange={(value) => {
          void handleValueChange(value as string);
        }}
      >
        <SelectTrigger
          className="w-full"
          data-testid="creator-quiz-visibility-toggle"
        >
          <SelectValue>
            {VISIBILITY_OPTIONS.find((option) => option.value === displayValue)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {VISIBILITY_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              data-testid={`creator-quiz-visibility-toggle-option-${option.value}`}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {genericError && (
        <div
          data-testid="creator-quiz-visibility-toggle-error"
          className="text-xs text-destructive"
        >
          <p>公開範囲の切り替えに失敗しました。時間をおいて再度お試しください。</p>
        </div>
      )}

      <Dialog open={proModalOpen} onOpenChange={setProModalOpen}>
        <DialogContent data-testid="creator-quiz-visibility-pro-modal">
          <DialogHeader>
            <DialogTitle>Pro プランが必要です</DialogTitle>
            <DialogDescription>
              限定公開・非公開への切り替えには Pro プランへのアップグレードが必要です。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Link
              href="/pricing"
              className={cn(buttonVariants(), 'w-fit')}
              onClick={() => setProModalOpen(false)}
            >
              Pro プランを見る
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
