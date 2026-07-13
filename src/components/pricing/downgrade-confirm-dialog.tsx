'use client';

import React from 'react';
import { getPricingPlanForUi } from '@/lib/pricing-display';
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
import { CircularProgress } from '@mui/material';

interface DowngradeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
}

export function DowngradeConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: DowngradeConfirmDialogProps) {
  const creatorPlan = getPricingPlanForUi('creator');
  const playerPlan = getPricingPlanForUi('player');

  // Creator 特典にあって Player 特典にないものを差分抽出
  const lostFeatures = creatorPlan.featureBullets.filter(
    (cb) => !playerPlan.featureBullets.some((pb) => pb.id === cb.id)
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="downgrade-confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>プランをダウングレードしますか？</AlertDialogTitle>
          <AlertDialogDescription>
            Creator プランから Player プランへダウングレードすると、以下の特典が利用できなくなります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <ul className="flex flex-col gap-1.5 pl-5 list-disc text-sm text-muted-foreground">
            {lostFeatures.map((feature) => (
              <li key={feature.id} data-testid={`lost-feature-${feature.id}`}>
                {feature.label}
              </li>
            ))}
          </ul>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault(); // 自動的に閉じるのを防ぎ、処理完了後にコントロールする
              onConfirm();
            }}
            data-testid="confirm-downgrade-btn"
          >
            {loading ? <CircularProgress size={16} className="mr-2 text-current" /> : null}
            確定して切り替える
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
