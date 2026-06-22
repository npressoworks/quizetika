'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckOutlined, AutoAwesomeOutlined } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
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
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
    <Card className="border-primary/30" data-testid="pricing-pro-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AutoAwesomeOutlined sx={{ fontSize: 24 }} className="text-primary" />
          {plan.displayName}
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
            data-testid="pricing-interval-monthly"
          >
            月額
          </ToggleGroupItem>
          <ToggleGroupItem
            value="yearly"
            disabled={isIntervalDisabled}
            data-testid="pricing-interval-yearly"
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
              ? 'pricing-price-error'
              : priceState.status === 'loading'
                ? 'pricing-price-loading'
                : 'pricing-price-ready'
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
          <p className="text-sm text-destructive" role="alert" data-testid="pricing-error-message">
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
        ) : (
          <Button
            type="button"
            className="w-full"
            onClick={handleSubscribe}
            disabled={isSubscribeDisabled}
            data-testid="pricing-subscribe-btn"
            aria-label={ctaMode === 'guest' ? 'ログインして Pro プランに加入する' : 'Pro プランに加入する'}
          >
            {loading ? <CircularProgress size={18} /> : null}
            {ctaMode === 'guest' ? 'ログインして加入する' : 'Pro プランに加入する'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
