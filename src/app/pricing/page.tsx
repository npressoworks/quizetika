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
import { fetchPlanPrices } from '@/lib/billing-client';
import type { PlanPrices } from '@/lib/billing-client';
import type { PriceInterval } from '@/types/subscription';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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

type PaidPlanPriceUiState =
  | { status: 'loading' }
  | { status: 'ready'; prices: { player: PlanPrices; creator: PlanPrices } }
  | { status: 'error' };

function PricingPageContent() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkoutFeedback, setCheckoutFeedback] = useState<'success' | 'canceled' | null>(null);
  const checkoutHandledRef = useRef(false);

  const [selectedInterval, setSelectedInterval] = useState<PriceInterval>('monthly');
  const [priceState, setPriceState] = useState<PaidPlanPriceUiState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      setPriceState({ status: 'loading' });
      try {
        const result = await fetchPlanPrices();
        if (!cancelled) {
          setPriceState({ status: 'ready', prices: result });
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

  const isIntervalDisabled =
    loading || uiState.ctaMode === 'loading' || priceState.status !== 'ready';

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

      {/* まとめて切り替えるためのトグル */}
      <div className="flex justify-center mt-2 mb-4">
        <div className="relative flex rounded-full bg-muted/60 p-1.5 border border-border/80 shadow-sm max-w-[360px] w-full sm:w-auto">
          <button
            type="button"
            disabled={isIntervalDisabled}
            onClick={() => setSelectedInterval('monthly')}
            className={cn(
              "relative z-10 flex-1 px-6 py-2.5 text-sm font-bold rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer whitespace-nowrap",
              selectedInterval === 'monthly' ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="pricing-interval-monthly"
            aria-label="月額プラン"
          >
            {selectedInterval === 'monthly' && (
              <motion.div
                layoutId="active-interval"
                className="absolute inset-0 bg-primary rounded-full -z-10 shadow-md shadow-primary/20"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span>月額</span>
          </button>
          <button
            type="button"
            disabled={isIntervalDisabled}
            onClick={() => setSelectedInterval('yearly')}
            className={cn(
              "relative z-10 flex-1 px-6 py-2.5 text-sm font-bold rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap",
              selectedInterval === 'yearly' ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="pricing-interval-yearly"
            aria-label="年額プラン（約2ヶ月分お得）"
          >
            {selectedInterval === 'yearly' && (
              <motion.div
                layoutId="active-interval"
                className="absolute inset-0 bg-primary rounded-full -z-10 shadow-md shadow-primary/20"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="flex items-center gap-1">
              年額
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 scale-90 sm:scale-100",
                selectedInterval === 'yearly' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
              )}>
                2ヶ月分お得
              </span>
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <FreePlanCard ctaMode={uiState.ctaMode} />
        <PaidPlanCard
          tier="player"
          ctaMode={uiState.ctaMode}
          userSubscriptionTier={uiState.subscriptionTier}
          hasPaidEntitlements={uiState.hasPaidEntitlements}
          refreshUser={refreshUser}
          selectedInterval={selectedInterval}
          prices={priceState.status === 'ready' ? priceState.prices.player : null}
          priceStatus={priceState.status}
        />
        <PaidPlanCard
          tier="creator"
          ctaMode={uiState.ctaMode}
          userSubscriptionTier={uiState.subscriptionTier}
          hasPaidEntitlements={uiState.hasPaidEntitlements}
          refreshUser={refreshUser}
          selectedInterval={selectedInterval}
          prices={priceState.status === 'ready' ? priceState.prices.creator : null}
          priceStatus={priceState.status}
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
