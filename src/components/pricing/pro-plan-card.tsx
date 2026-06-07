'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { getProPlanForUi } from '@/lib/pricing-display';
import type { PricingUiCtaMode } from '@/lib/pricing-entitlement';
import {
  BillingClientError,
  redirectToExternalUrl,
  startCheckoutSession,
  startPortalSession,
} from '@/lib/billing-client';
import type { PriceInterval } from '@/types/subscription';
import styles from './pro-plan-card.module.css';

interface ProPlanCardProps {
  ctaMode: PricingUiCtaMode;
}

export function ProPlanCard({ ctaMode }: ProPlanCardProps) {
  const router = useRouter();
  const plan = getProPlanForUi();
  const [selectedInterval, setSelectedInterval] = useState<PriceInterval>('monthly');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  const priceLabel =
    selectedInterval === 'monthly'
      ? plan.monthlyPriceLabel
      : (plan.yearlyPriceLabel ?? plan.monthlyPriceLabel);

  const handleSubscribe = async () => {
    setErrorMessage(null);
    setAlreadySubscribed(false);

    if (ctaMode === 'guest') {
      router.push('/login?redirect=/pricing');
      return;
    }

    if (ctaMode === 'loading') return;

    setLoading(true);
    try {
      if (ctaMode === 'manage' || alreadySubscribed) {
        const { sessionUrl } = await startPortalSession();
        redirectToExternalUrl(sessionUrl);
        return;
      }

      const { sessionUrl } = await startCheckoutSession(selectedInterval);
      redirectToExternalUrl(sessionUrl);
    } catch (error) {
      if (error instanceof BillingClientError) {
        if (error.apiError.code === 'already-subscribed') {
          setAlreadySubscribed(true);
        }
        setErrorMessage(error.apiError.message);
      } else {
        setErrorMessage('エラーが発生しました。しばらくしてから再度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const showManageCta = ctaMode === 'manage' || alreadySubscribed;
  const isDisabled = loading || ctaMode === 'loading';

  return (
    <article className={`${styles.card} glass-card`} data-testid="pricing-pro-card">
      <div className={styles.header}>
        <Sparkles size={24} className={styles.icon} aria-hidden />
        <h2 className={styles.planName}>{plan.displayName}</h2>
      </div>

      <div className={styles.intervalToggle} role="group" aria-label="料金プランの支払い間隔">
        <button
          type="button"
          className={`${styles.intervalBtn} ${selectedInterval === 'monthly' ? styles.intervalActive : ''}`}
          onClick={() => setSelectedInterval('monthly')}
          disabled={isDisabled}
          data-testid="pricing-interval-monthly"
          aria-pressed={selectedInterval === 'monthly'}
        >
          月額
        </button>
        <button
          type="button"
          className={`${styles.intervalBtn} ${selectedInterval === 'yearly' ? styles.intervalActive : ''}`}
          onClick={() => setSelectedInterval('yearly')}
          disabled={isDisabled}
          data-testid="pricing-interval-yearly"
          aria-pressed={selectedInterval === 'yearly'}
        >
          年額
        </button>
      </div>

      <p className={styles.price}>{priceLabel}</p>
      {selectedInterval === 'yearly' && plan.yearlySavingsLabel && (
        <p className={styles.savings}>{plan.yearlySavingsLabel}</p>
      )}

      <ul className={styles.featureList}>
        {plan.featureBullets.map((feature) => (
          <li key={feature.id} className={styles.featureItem}>
            <Check size={16} aria-hidden />
            <span>{feature.label}</span>
          </li>
        ))}
      </ul>

      {errorMessage && (
        <p className={styles.error} role="alert" data-testid="pricing-error-message">
          {errorMessage}
        </p>
      )}

      {showManageCta ? (
        <button
          type="button"
          className={`${styles.ctaBtn} btn btn-accent`}
          onClick={handleSubscribe}
          disabled={isDisabled}
          data-testid="pricing-portal-btn"
          aria-label="契約内容を管理する"
        >
          {loading ? <Loader2 size={18} className={styles.spinner} aria-hidden /> : null}
          契約を管理する
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.ctaBtn} btn btn-accent`}
          onClick={handleSubscribe}
          disabled={isDisabled}
          data-testid="pricing-subscribe-btn"
          aria-label={ctaMode === 'guest' ? 'ログインして Pro プランに加入する' : 'Pro プランに加入する'}
        >
          {loading ? <Loader2 size={18} className={styles.spinner} aria-hidden /> : null}
          {ctaMode === 'guest' ? 'ログインして加入する' : 'Pro プランに加入する'}
        </button>
      )}
    </article>
  );
}
