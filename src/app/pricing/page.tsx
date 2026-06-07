'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { resolvePricingUiState } from '@/lib/pricing-entitlement';
import { CheckoutFeedbackBanner } from '@/components/pricing/checkout-feedback-banner';
import { SubscriptionStatusBadge } from '@/components/pricing/subscription-status-badge';
import { FreePlanCard } from '@/components/pricing/free-plan-card';
import { ProPlanCard } from '@/components/pricing/pro-plan-card';
import styles from './pricing.module.css';

function PricingSkeleton() {
  return (
    <div className={styles.container} data-testid="pricing-skeleton">
      <div className={`${styles.skeletonTitle} ${styles.pulse}`} />
      <div className={`${styles.skeletonCard} ${styles.pulse}`} />
    </div>
  );
}

function PricingPageContent() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkoutFeedback, setCheckoutFeedback] = useState<'success' | 'canceled' | null>(null);

  const uiState = useMemo(() => resolvePricingUiState(user, loading), [user, loading]);

  const pendingWebhook =
    checkoutFeedback === 'success' && !loading && user !== null && !uiState.hasPaidEntitlements;

  useEffect(() => {
    const checkoutParam = searchParams.get('checkout');
    if (checkoutParam !== 'success' && checkoutParam !== 'canceled') return;

    setCheckoutFeedback(checkoutParam);
    if (checkoutParam === 'success') {
      void refreshUser();
    }
    router.replace('/pricing');
  }, [searchParams, refreshUser, router]);

  if (loading) {
    return <PricingSkeleton />;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Sparkles size={32} style={{ color: '#00ff66' }} aria-hidden />
          料金プラン
        </h1>
        <p className={styles.subtitle}>
          無料の Free プランから始めて、必要に応じて Pro プランへアップグレードできます。
        </p>
        <SubscriptionStatusBadge visible={uiState.showProBadge} />
      </header>

      {checkoutFeedback && (
        <CheckoutFeedbackBanner
          variant={checkoutFeedback}
          pendingWebhook={pendingWebhook}
        />
      )}

      <div className={styles.cardGrid}>
        <FreePlanCard ctaMode={uiState.ctaMode} />
        <ProPlanCard ctaMode={uiState.ctaMode} />
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingSkeleton />}>
      <PricingPageContent />
    </Suspense>
  );
}
