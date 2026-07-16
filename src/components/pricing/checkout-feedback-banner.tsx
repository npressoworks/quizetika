'use client';

import React from 'react';
import { CheckCircleOutlined, InfoOutlined } from '@mui/icons-material';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type CheckoutFeedbackVariant = 'success' | 'canceled';

interface CheckoutFeedbackBannerProps {
  variant: CheckoutFeedbackVariant;
  pendingWebhook?: boolean;
}

const MESSAGES: Record<CheckoutFeedbackVariant, string> = {
  success: '有料プランへの加入が完了しました。ご利用ありがとうございます！',
  canceled: '購入手続きはキャンセルされました。いつでも再度お申し込みいただけます。',
};

export function CheckoutFeedbackBanner({
  variant,
  pendingWebhook = false,
}: CheckoutFeedbackBannerProps) {
  const isSuccess = variant === 'success';

  return (
    <Alert
      variant={isSuccess ? 'default' : 'destructive'}
      role="status"
      data-testid={`checkout-feedback-${variant}`}
      className={isSuccess ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400' : undefined}
    >
      {isSuccess ? <CheckCircleOutlined className="size-4" /> : <InfoOutlined className="size-4" />}
      <AlertDescription>
        <p>{MESSAGES[variant]}</p>
        {pendingWebhook && (
          <p className="mt-1 text-sm opacity-80" data-testid="checkout-pending-webhook">
            契約状態の反映に少し時間がかかる場合があります。しばらく待ってからページを再読み込みしてください。
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
