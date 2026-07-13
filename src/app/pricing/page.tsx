'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AutoAwesomeOutlined } from '@mui/icons-material';
import { useAuth } from '@/context/auth-context';
import { resolvePricingUiState } from '@/lib/pricing-entitlement';
import { CheckoutFeedbackBanner } from '@/components/pricing/checkout-feedback-banner';
import { SubscriptionStatusBadge } from '@/components/pricing/subscription-status-badge';
import { FreePlanCard } from '@/components/pricing/free-plan-card';
import { PaidPlanCard } from '@/components/pricing/paid-plan-card';
import { Skeleton } from '@/components/ui/skeleton';

function PricingSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10" data-testid="pricing-skeleton">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}

function PricingPageContent() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkoutFeedback, setCheckoutFeedback] = useState<'success' | 'canceled' | null>(null);
  const checkoutHandledRef = useRef(false);

  const uiState = useMemo(() => resolvePricingUiState(user, loading), [user, loading]);

  const pendingWebhook =
    checkoutFeedback === 'success' && !loading && user !== null && !uiState.hasPaidEntitlements;

  useEffect(() => {
    const checkoutParam = searchParams.get('checkout');
    if (checkoutParam !== 'success' && checkoutParam !== 'canceled') return;
    if (checkoutHandledRef.current) return;
    checkoutHandledRef.current = true;

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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-3 text-center">
        <h1 className="flex items-center justify-center gap-3 text-3xl font-extrabold tracking-tight">
          <AutoAwesomeOutlined sx={{ fontSize: 32 }} className="text-primary" aria-hidden />
          料金プラン
        </h1>
        <p className="text-muted-foreground">
          無料の Free プランから始めて、必要に応じて Player プランや Creator プランへアップグレードできます。
        </p>
        <SubscriptionStatusBadge visible={uiState.hasPaidEntitlements} tier={uiState.subscriptionTier} />
      </header>

      {checkoutFeedback && (
        <CheckoutFeedbackBanner
          variant={checkoutFeedback}
          pendingWebhook={pendingWebhook}
        />
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <FreePlanCard ctaMode={uiState.ctaMode} />
        <PaidPlanCard
          tier="player"
          ctaMode={uiState.ctaMode}
          userSubscriptionTier={uiState.subscriptionTier}
          hasPaidEntitlements={uiState.hasPaidEntitlements}
          refreshUser={refreshUser}
        />
        <PaidPlanCard
          tier="creator"
          ctaMode={uiState.ctaMode}
          userSubscriptionTier={uiState.subscriptionTier}
          hasPaidEntitlements={uiState.hasPaidEntitlements}
          refreshUser={refreshUser}
        />
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
