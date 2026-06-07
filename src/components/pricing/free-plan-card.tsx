'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Check, User } from 'lucide-react';
import { getFreePlanForUi } from '@/lib/pricing-display';
import type { PricingUiCtaMode } from '@/lib/pricing-entitlement';
import styles from './free-plan-card.module.css';

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
    <article className={`${styles.card} glass-card`} data-testid="pricing-free-card">
      <div className={styles.header}>
        <User size={24} className={styles.icon} aria-hidden />
        <h2 className={styles.planName}>{plan.displayName}</h2>
      </div>

      <p className={styles.price}>{plan.monthlyPriceLabel}</p>
      <p className={styles.priceNote}>ずっと無料</p>

      <ul className={styles.featureList}>
        {plan.featureBullets.map((feature) => (
          <li key={feature.id} className={styles.featureItem}>
            <Check size={16} aria-hidden />
            <span>{feature.label}</span>
          </li>
        ))}
      </ul>

      {isCurrentPlan ? (
        <span className={styles.currentBadge} data-testid="pricing-free-current">
          利用中
        </span>
      ) : ctaMode === 'guest' ? (
        <button
          type="button"
          className={`${styles.ctaBtn} btn`}
          onClick={handleCta}
          data-testid="pricing-free-start-btn"
          aria-label="無料で始める"
        >
          無料で始める
        </button>
      ) : (
        <span className={styles.includedNote} data-testid="pricing-free-included">
          基本プラン
        </span>
      )}
    </article>
  );
}
