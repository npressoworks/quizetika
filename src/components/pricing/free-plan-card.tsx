'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CheckOutlined, PersonOutlined } from '@mui/icons-material';
import { getFreePlanForUi } from '@/lib/pricing-display';
import type { PricingUiCtaMode } from '@/lib/pricing-entitlement';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface FreePlanCardProps {
  ctaMode: PricingUiCtaMode;
}

export function FreePlanCard({ ctaMode }: FreePlanCardProps) {
  const router = useRouter();
  const plan = getFreePlanForUi();
  const isCurrentPlan = ctaMode === 'subscribe';

  const handleCta = () => {
    if (ctaMode === 'guest') {
      router.push('/login?redirect=/pricing');
    }
  };

  return (
    <Card data-testid="pricing-free-card" className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PersonOutlined sx={{ fontSize: 24 }} className="text-muted-foreground" />
          {plan.displayName}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1">
        <div>
          <p className="text-3xl font-bold">¥0</p>
          <p className="text-sm text-muted-foreground">ずっと無料</p>
        </div>

        <ul className="flex flex-col gap-2">
          {plan.featureBullets.map((feature) => (
            <li key={feature.id} className="flex items-start gap-2 text-sm">
              <CheckOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0 text-primary" />
              <span>{feature.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-4">
          {/* paid-plan-card の注意書きスペースと高さを揃えるため */}
          <div className="h-5" />

          {isCurrentPlan ? (
            <div className="flex justify-center w-full">
              <Badge variant="secondary" data-testid="pricing-free-current">
                利用中
              </Badge>
            </div>
          ) : ctaMode === 'guest' ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleCta}
              data-testid="pricing-free-start-btn"
              aria-label="無料で始める"
            >
              無料で始める
            </Button>
          ) : (
            <div className="flex justify-center w-full">
              <span className="text-sm text-muted-foreground" data-testid="pricing-free-included">
                基本プラン
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
