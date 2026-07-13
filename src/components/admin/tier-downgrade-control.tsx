/**
 * 管理者向け：ユーザーの権限ティアーを段階的に引き下げる操作コンポーネント
 *
 * - 現在のティアより厳密に下位のティアのみを選択肢とする
 * - newcomer の場合は操作自体を非活性化する（Requirement 10.7）
 * - 理由入力は10文字以上必須（Requirement 10.4）
 */
'use client';

import React, { useState } from 'react';
import { CircularProgress } from '@mui/material';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type ModerationTier = 'newcomer' | 'contributor' | 'moderator' | 'senior_moderator';

const TIER_ORDER: ModerationTier[] = ['newcomer', 'contributor', 'moderator', 'senior_moderator'];

const TIER_LABELS: Record<ModerationTier, string> = {
  newcomer: 'Newcomer (新規)',
  contributor: 'Contributor (貢献者)',
  moderator: 'Moderator (一般モデレータ)',
  senior_moderator: 'Senior Moderator (上級モデレータ)',
};

export interface TierDowngradeControlProps {
  targetUid: string;
  currentTier: ModerationTier;
  getIdToken: () => Promise<string | null>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function TierDowngradeControl({
  targetUid,
  currentTier,
  getIdToken,
  onSuccess,
  onError,
}: TierDowngradeControlProps) {
  const [selectedTier, setSelectedTier] = useState<ModerationTier | ''>('');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const lowerTiers = currentIndex >= 0 ? TIER_ORDER.slice(0, currentIndex) : [];
  const isDisabled = currentTier === 'newcomer' || lowerTiers.length === 0;

  const handleRequestDowngrade = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) {
      setValidationError('引き下げ先のティアーを選択してください。');
      return;
    }
    if (reason.length < 10) {
      setValidationError('引き下げ理由は10文字以上で入力してください。');
      return;
    }
    setValidationError(null);
    setConfirmOpen(true);
  };

  const executeDowngrade = async () => {
    if (!selectedTier) return;

    setActionLoading(true);
    setValidationError(null);

    try {
      const token = await getIdToken();
      const res = await fetch('/api/admin/users/downgrade-tier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid,
          newTier: selectedTier,
          reason,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'ティア引き下げ処理に失敗しました。');
      }

      onSuccess('ユーザーの権限ティアーを引き下げました。');
      setReason('');
      setSelectedTier('');
    } catch (err: unknown) {
      console.error('ティア引き下げエラー:', err);
      onError(
        err instanceof Error ? err.message : 'ティア引き下げ処理中にエラーが発生しました。',
      );
    } finally {
      setActionLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">権限ティアーの引き下げ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isDisabled ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="tier-downgrade-disabled-message"
          >
            このユーザーは既に最下位ティアー（Newcomer）のため、引き下げ操作は行えません。
          </p>
        ) : (
          <form
            onSubmit={handleRequestDowngrade}
            className="space-y-4"
            data-testid="tier-downgrade-form"
          >
            <div className="space-y-2">
              <Label htmlFor="tierDowngradeSelect">引き下げ先ティアー</Label>
              <Select
                value={selectedTier}
                onValueChange={(value) => setSelectedTier(value as ModerationTier)}
                disabled={actionLoading}
              >
                <SelectTrigger
                  id="tierDowngradeSelect"
                  data-testid="tier-downgrade-select"
                  className="w-full"
                >
                  <SelectValue placeholder="ティアーを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {lowerTiers.map((tier) => (
                    <SelectItem key={tier} value={tier} data-testid={`tier-downgrade-option-${tier}`}>
                      {TIER_LABELS[tier]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tierDowngradeReason">引き下げ理由（10文字以上必須）</Label>
              <Textarea
                id="tierDowngradeReason"
                placeholder="ティアーを引き下げるに至った具体的な理由を入力してください..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={actionLoading}
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">現在の文字数: {reason.length} 文字</p>
            </div>
            {validationError && (
              <p className="text-sm text-destructive" data-testid="tier-downgrade-validation-error">
                {validationError}
              </p>
            )}
            <Button
              type="submit"
              id="execute-tier-downgrade-btn"
              data-testid="execute-tier-downgrade-btn"
              variant="destructive"
              disabled={actionLoading || !selectedTier || reason.length < 10}
            >
              {actionLoading ? (
                <>
                  <CircularProgress size={16} /> 処理中...
                </>
              ) : (
                '⬇️ ティアーを引き下げる'
              )}
            </Button>
          </form>
        )}
      </CardContent>

      {confirmOpen && (
        <ConfirmActionDialog
          open={confirmOpen}
          onOpenChange={(open) => {
            if (!open && !actionLoading) setConfirmOpen(false);
          }}
          title="ティアーを引き下げますか？"
          description={`対象ユーザーの権限ティアーを「${
            selectedTier ? TIER_LABELS[selectedTier] : ''
          }」へ変更します。この操作は監査ログに記録されます。`}
          confirmLabel="引き下げを実行"
          onConfirm={executeDowngrade}
          loading={actionLoading}
        />
      )}
    </Card>
  );
}
