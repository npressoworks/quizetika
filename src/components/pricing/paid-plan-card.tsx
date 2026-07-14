'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckOutlined, AutoAwesomeOutlined } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { getPricingPlanForUi } from '@/lib/pricing-display';
import type { PricingUiCtaMode } from '@/lib/pricing-entitlement';
import {
  BillingClientError,
  redirectToExternalUrl,
  startCheckoutSession,
  startPortalSession,
} from '@/lib/billing-client';
import type { PlanPrices } from '@/lib/billing-client';
import type { PriceInterval, SubscriptionTier } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PaidPlanCardProps {
  tier: 'player' | 'creator';
  ctaMode: PricingUiCtaMode;
  userSubscriptionTier: SubscriptionTier;
  hasPaidEntitlements: boolean;
  refreshUser: () => Promise<void>;
  selectedInterval: PriceInterval;
  prices: PlanPrices | null;
  priceStatus: 'loading' | 'ready' | 'error';
}

export function PaidPlanCard({
  tier,
  ctaMode,
  userSubscriptionTier,
  hasPaidEntitlements,
  refreshUser,
  selectedInterval,
  prices,
  priceStatus,
}: PaidPlanCardProps) {
  const router = useRouter();
  const plan = getPricingPlanForUi(tier);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  const isCurrentPlan = hasPaidEntitlements && userSubscriptionTier === tier;
  const showManageCta = isCurrentPlan || alreadySubscribed;
  const showSwitchCta = hasPaidEntitlements && userSubscriptionTier !== tier;
  
  const isIntervalDisabled =
    loading || ctaMode === 'loading' || priceStatus !== 'ready';
  const isPortalDisabled = loading || ctaMode === 'loading';
  const isSubscribeDisabled =
    loading ||
    ctaMode === 'loading' ||
    (priceStatus !== 'ready' && ctaMode === 'subscribe');
  const isSwitchDisabled =
    loading ||
    ctaMode === 'loading' ||
    priceStatus !== 'ready';

  const priceLabel =
    priceStatus === 'ready' && prices
      ? selectedInterval === 'monthly'
        ? prices.monthly.label
        : prices.yearly.label
      : priceStatus === 'loading'
        ? '読み込み中…'
        : '価格を読み込めません';

  const savingsLabel =
    priceStatus === 'ready' && prices && selectedInterval === 'yearly'
      ? prices.savingsLabel
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

      if (priceStatus !== 'ready') {
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

  const onSwitchCtaClick = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const { sessionUrl } = await startPortalSession();
      redirectToExternalUrl(sessionUrl);
    } catch (error) {
      if (error instanceof BillingClientError) {
        setErrorMessage(error.apiError.message);
      } else {
        setErrorMessage('エラーが発生しました。しばらくしてから再度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-primary/30 flex flex-col h-full" data-testid={`pricing-${tier}-card`}>
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
        <CardContent className="flex flex-col gap-4 flex-1">
          <p
            className={cn(
              'text-3xl font-bold',
              priceStatus === 'error' && 'text-destructive',
              priceStatus === 'loading' && 'text-muted-foreground'
            )}
            data-testid={
              priceStatus === 'error'
                ? `pricing-${tier}-price-error`
                : priceStatus === 'loading'
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

          <div className="mt-auto flex flex-col gap-4">
            {errorMessage && (
              <p className="text-sm text-destructive" role="alert" data-testid={`pricing-${tier}-error-message`}>
                {errorMessage}
              </p>
            )}

            {/* 注意書きスペースの高さを確保し、ボタン位置を揃える */}
            <div className="h-5 flex items-center justify-center">
              {showSwitchCta && tier === 'creator' && (
                <p className="text-xs text-muted-foreground text-center">
                  即時切り替えと日割り課金が発生します。
                </p>
              )}
            </div>

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
              <Button
                type="button"
                className="w-full"
                onClick={onSwitchCtaClick}
                disabled={isSwitchDisabled}
                data-testid="pricing-switch-btn"
                aria-label={
                  userSubscriptionTier === 'player' && tier === 'creator'
                    ? 'Creatorにアップグレードする'
                    : 'Playerにダウングレードする'
                }
              >
                {loading ? <CircularProgress size={18} /> : null}
                {userSubscriptionTier === 'player' && tier === 'creator'
                  ? 'Creatorにアップグレードする'
                  : 'Playerにダウングレードする'}
              </Button>
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
          </div>
        </CardContent>
      </Card>

    </>
  );
}
