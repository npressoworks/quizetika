'use client';

import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import styles from './checkout-feedback-banner.module.css';

export type CheckoutFeedbackVariant = 'success' | 'canceled';

interface CheckoutFeedbackBannerProps {
  variant: CheckoutFeedbackVariant;
  pendingWebhook?: boolean;
}

const MESSAGES: Record<CheckoutFeedbackVariant, string> = {
  success: 'Pro プランへの加入が完了しました。ご利用ありがとうございます！',
  canceled: '購入手続きはキャンセルされました。いつでも再度お申し込みいただけます。',
};

export function CheckoutFeedbackBanner({
  variant,
  pendingWebhook = false,
}: CheckoutFeedbackBannerProps) {
  const isSuccess = variant === 'success';

  return (
    <div
      className={`${styles.banner} ${isSuccess ? styles.success : styles.canceled}`}
      role="status"
      data-testid={`checkout-feedback-${variant}`}
    >
      {isSuccess ? <CheckCircle2 size={20} aria-hidden /> : <Info size={20} aria-hidden />}
      <div className={styles.messageGroup}>
        <p className={styles.message}>{MESSAGES[variant]}</p>
        {pendingWebhook && (
          <p className={styles.pendingNote} data-testid="checkout-pending-webhook">
            契約状態の反映に少し時間がかかる場合があります。しばらく待ってからページを再読み込みしてください。
          </p>
        )}
      </div>
    </div>
  );
}
