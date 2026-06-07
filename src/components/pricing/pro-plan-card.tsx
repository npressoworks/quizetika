'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { getProPlanForUi } from '@/lib/pricing-display';
import type { PricingUiCtaMode } from '@/lib/pricing-entitlement';
import {
  BillingClientError,
  fetchProPrices,
  redirectToExternalUrl,
  startCheckoutSession,
  startPortalSession,
} from '@/lib/billing-client';
import type { ProPricesResult } from '@/lib/billing-client';
import type { PriceInterval } from '@/types/subscription';
import styles from './pro-plan-card.module.css';

interface ProPlanCardProps {
  ctaMode: PricingUiCtaMode;
}

type ProPriceUiState =
  | { status: 'loading' }
  | { status: 'ready'; prices: ProPricesResult }
  | { status: 'error' };

export function ProPlanCard({ ctaMode }: ProPlanCardProps) {
  const router = useRouter();
  const plan = getProPlanForUi();
  const [selectedInterval, setSelectedInterval] = useState<PriceInterval>('monthly');
  const [priceState, setPriceState] = useState<ProPriceUiState>({ status: 'loading' });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      setPriceState({ status: 'loading' });
      try {
        const prices = await fetchProPrices();
        if (!cancelled) {
          setPriceState({ status: 'ready', prices });
        }
      } catch {
        if (!cancelled) {
          setPriceState({ status: 'error' });
        }
      }
    }

    void loadPrices();

    return () => {
      cancelled = true;
    };
  }, []);

  const showManageCta = ctaMode === 'manage' || alreadySubscribed;
  const isIntervalDisabled =
    loading || ctaMode === 'loading' || priceState.status !== 'ready';
  const isPortalDisabled = loading || ctaMode === 'loading';
  const isSubscribeDisabled =
    loading ||
    ctaMode === 'loading' ||
    (priceState.status !== 'ready' && ctaMode === 'subscribe');

  const priceLabel =
    priceState.status === 'ready'
      ? selectedInterval === 'monthly'
        ? priceState.prices.monthly.label
        : priceState.prices.yearly.label
      : priceState.status === 'loading'
        ? '読み込み中…'
        : '価格を読み込めません';

  const savingsLabel =
    priceState.status === 'ready' && selectedInterval === 'yearly'
      ? priceState.prices.savingsLabel
      : undefined;

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

      if (priceState.status !== 'ready') {
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
          disabled={isIntervalDisabled}
          data-testid="pricing-interval-monthly"
          aria-pressed={selectedInterval === 'monthly'}
        >
          月額
        </button>
        <button
          type="button"
          className={`${styles.intervalBtn} ${selectedInterval === 'yearly' ? styles.intervalActive : ''}`}
          onClick={() => setSelectedInterval('yearly')}
          disabled={isIntervalDisabled}
          data-testid="pricing-interval-yearly"
          aria-pressed={selectedInterval === 'yearly'}
        >
          年額
        </button>
      </div>

      <p
        className={`${styles.price} ${priceState.status === 'error' ? styles.priceError : ''} ${priceState.status === 'loading' ? styles.priceLoading : ''}`}
        data-testid={
          priceState.status === 'error'
            ? 'pricing-price-error'
            : priceState.status === 'loading'
              ? 'pricing-price-loading'
              : 'pricing-price-ready'
        }
      >
        {priceLabel}
      </p>
      {savingsLabel && <p className={styles.savings}>{savingsLabel}</p>}

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
          disabled={isPortalDisabled}
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
          disabled={isSubscribeDisabled}
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
