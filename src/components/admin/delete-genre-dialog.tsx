'use client';

import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GenreMetadata {
  id: string;
  displayName: string;
  description: string;
  iconImageUrl: string | null;
  isActive: boolean;
  createdAt?: string | Date;
}

export interface DeleteGenreDialogProps {
  open: boolean;
  targetGenre: GenreMetadata;
  otherGenres: GenreMetadata[]; // targetGenreを除いた選択肢
  affectedQuizCount: number | null; // null = 取得中
  submitLoading: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reassignToGenreId: string | null) => void;
}

export function DeleteGenreDialog({
  open,
  targetGenre,
  otherGenres,
  affectedQuizCount,
  submitLoading,
  errorMessage,
  onOpenChange,
  onConfirm,
}: DeleteGenreDialogProps) {
  const [selectedReassignId, setSelectedReassignId] = useState<string | null>(null);

  // ダイアログが開くたびに選択状態をリセットする（レンダー中に state を調整するパターン）
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedReassignId(null);
    }
  }

  const isLoadingUsage = affectedQuizCount === null;
  const requiresReassign = affectedQuizCount !== null && affectedQuizCount > 0;
  const canConfirm =
    !isLoadingUsage &&
    !submitLoading &&
    (affectedQuizCount === 0 || (requiresReassign && selectedReassignId !== null));

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedReassignId(null);
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = () => {
    if (!canConfirm) {
      return;
    }
    onConfirm(requiresReassign ? selectedReassignId : null);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ジャンルを削除</AlertDialogTitle>
          <AlertDialogDescription>
            「{targetGenre.displayName}」を削除します。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoadingUsage ? (
          <div data-testid="delete-genre-usage-loading" className="py-2 text-sm text-muted-foreground">
            影響件数を確認しています...
          </div>
        ) : (
          <div className="space-y-3">
            <p data-testid="delete-genre-usage-count" className="text-sm">
              このジャンルを参照しているクイズ: {affectedQuizCount}件
            </p>

            {requiresReassign && (
              <div className="space-y-1.5">
                <label
                  htmlFor="delete-genre-reassign-select"
                  className="text-sm font-medium"
                >
                  再割当て先ジャンル
                </label>
                <Select
                  value={selectedReassignId ?? ''}
                  onValueChange={(value) =>
                    setSelectedReassignId((value as string) || null)
                  }
                >
                  <SelectTrigger
                    id="delete-genre-reassign-select"
                    data-testid="delete-genre-reassign-select"
                  >
                    <SelectValue placeholder="再割当て先を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherGenres.map((genre) => (
                      <SelectItem
                        key={genre.id}
                        value={genre.id}
                        data-testid={`delete-genre-reassign-option-${genre.id}`}
                      >
                        {genre.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {errorMessage && (
              <p role="alert" data-testid="delete-genre-error" className="text-sm text-destructive">
                {errorMessage}
              </p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel data-testid="delete-genre-cancel-btn" disabled={submitLoading}>
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="delete-genre-confirm-btn"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {submitLoading ? '削除中...' : '削除する'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
