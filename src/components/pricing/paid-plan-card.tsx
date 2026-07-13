'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckOutlined, AutoAwesomeOutlined } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { getPricingPlanForUi } from '@/lib/pricing-display';
import type { PricingUiCtaMode } from '@/lib/pricing-entitlement';
import {
  BillingClientError,
  fetchPlanPrices,
  redirectToExternalUrl,
  startCheckoutSession,
  startPortalSession,
  changePlan,
} from '@/lib/billing-client';
import type { PlanPrices } from '@/lib/billing-client';
import type { PriceInterval, SubscriptionTier } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DowngradeConfirmDialog } from './downgrade-confirm-dialog';

interface PaidPlanCardProps {
  tier: 'player' | 'creator';
  ctaMode: PricingUiCtaMode;
  userSubscriptionTier: SubscriptionTier;
  hasPaidEntitlements: boolean;
  refreshUser: () => Promise<void>;
}

type PaidPlanPriceUiState =
  | { status: 'loading' }
  | { status: 'ready'; prices: PlanPrices }
  | { status: 'error' };

export function PaidPlanCard({
  tier,
  ctaMode,
  userSubscriptionTier,
  hasPaidEntitlements,
  refreshUser,
}: PaidPlanCardProps) {
  const router = useRouter();
  const plan = getPricingPlanForUi(tier);
  const [selectedInterval, setSelectedInterval] = useState<PriceInterval>('monthly');
  const [priceState, setPriceState] = useState<PaidPlanPriceUiState>({ status: 'loading' });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [isDowngradeDialogOpen, setIsDowngradeDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPrices() {
      setPriceState({ status: 'loading' });
      try {
        const result = await fetchPlanPrices();
        if (!cancelled) {
          setPriceState({ status: 'ready', prices: result[tier] });
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
  }, [tier]);

  const isCurrentPlan = hasPaidEntitlements && userSubscriptionTier === tier;
  const showManageCta = isCurrentPlan || alreadySubscribed;
  const showSwitchCta = hasPaidEntitlements && userSubscriptionTier !== tier;
  
  const isIntervalDisabled =
    loading || ctaMode === 'loading' || priceState.status !== 'ready';
  const isPortalDisabled = loading || ctaMode === 'loading';
  const isSubscribeDisabled =
    loading ||
    ctaMode === 'loading' ||
    (priceState.status !== 'ready' && ctaMode === 'subscribe');
  const isSwitchDisabled =
    loading ||
    ctaMode === 'loading' ||
    priceState.status !== 'ready';

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
      if (showManageCta) {
        const { sessionUrl } = await startPortalSession();
        redirectToExternalUrl(sessionUrl);
        return;
      }

      if (priceState.status !== 'ready') {
        return;
      }

      const { sessionUrl } = await startCheckoutSession(tier, selectedInterval);
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

  const handleSwitchPlan = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const result = await changePlan(tier);
      await refreshUser();
    } catch (error) {
      if (error instanceof BillingClientError) {
        setErrorMessage(error.apiError.message);
      } else {
        setErrorMessage('エラーが発生しました。しばらくしてから再度お試しください。');
      }
    } finally {
      setLoading(false);
      setIsDowngradeDialogOpen(false);
    }
  };

  const onSwitchCtaClick = () => {
    if (tier === 'player') {
      // Creator から Player へのダウングレード
      setIsDowngradeDialogOpen(true);
    } else {
      // Player から Creator へのアップグレード (即時実行)
      void handleSwitchPlan();
    }
  };

  return (
    <>
      <Card className="border-primary/30" data-testid={`pricing-${tier}-card`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AutoAwesomeOutlined sx={{ fontSize: 24 }} className="text-primary" />
              {plan.displayName}
            </span>
            {isCurrentPlan && (
              <Badge variant="secondary" data-testid={`pricing-${tier}-current`}>
                契約中
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleGroup
            value={[selectedInterval]}
            onValueChange={(values) => {
              const next = values[values.length - 1];
              if (next === 'monthly' || next === 'yearly') setSelectedInterval(next);
            }}
            aria-label="料金プランの支払い間隔"
          >
            <ToggleGroupItem
              value="monthly"
              disabled={isIntervalDisabled}
              data-testid={`pricing-${tier}-interval-monthly`}
            >
              月額
            </ToggleGroupItem>
            <ToggleGroupItem
              value="yearly"
              disabled={isIntervalDisabled}
              data-testid={`pricing-${tier}-interval-yearly`}
            >
              年額
            </ToggleGroupItem>
          </ToggleGroup>

          <p
            className={cn(
              'text-3xl font-bold',
              priceState.status === 'error' && 'text-destructive',
              priceState.status === 'loading' && 'text-muted-foreground'
            )}
            data-testid={
              priceState.status === 'error'
                ? `pricing-${tier}-price-error`
                : priceState.status === 'loading'
                  ? `pricing-${tier}-price-loading`
                  : `pricing-${tier}-price-ready`
            }
          >
            {priceLabel}
          </p>
          {savingsLabel && <p className="text-sm text-primary">{savingsLabel}</p>}

          <ul className="flex flex-col gap-2">
            {plan.featureBullets.map((feature) => (
              <li key={feature.id} className="flex items-start gap-2 text-sm">
                <CheckOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0 text-primary" />
                <span>{feature.label}</span>
              </li>
            ))}
          </ul>

          {errorMessage && (
            <p className="text-sm text-destructive" role="alert" data-testid={`pricing-${tier}-error-message`}>
              {errorMessage}
            </p>
          )}

          {showManageCta ? (
            <Button
              type="button"
              className="w-full"
              onClick={handleSubscribe}
              disabled={isPortalDisabled}
              data-testid="pricing-portal-btn"
              aria-label="契約内容を管理する"
            >
              {loading ? <CircularProgress size={18} /> : null}
              契約を管理する
            </Button>
          ) : showSwitchCta ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="w-full"
                onClick={onSwitchCtaClick}
                disabled={isSwitchDisabled}
                data-testid="pricing-switch-btn"
                aria-label={`${plan.displayName}に切り替える`}
              >
                {loading ? <CircularProgress size={18} /> : null}
                {plan.displayName}に切り替える
              </Button>
              {tier === 'creator' && (
                <p className="text-xs text-muted-foreground text-center">
                  即時切り替えと日割り課金が発生します。
                </p>
              )}
            </div>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={handleSubscribe}
              disabled={isSubscribeDisabled}
              data-testid="pricing-subscribe-btn"
              aria-label={ctaMode === 'guest' ? `ログインして ${plan.displayName} プランに加入する` : `${plan.displayName} プランに加入する`}
            >
              {loading ? <CircularProgress size={18} /> : null}
              {ctaMode === 'guest' ? 'ログインして加入する' : `${plan.displayName}に加入する`}
            </Button>
          )}
        </CardContent>
      </Card>

      <DowngradeConfirmDialog
        open={isDowngradeDialogOpen}
        onOpenChange={setIsDowngradeDialogOpen}
        onConfirm={handleSwitchPlan}
        loading={loading}
      />
    </>
  );
}
