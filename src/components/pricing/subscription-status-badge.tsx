'use client';

import React from 'react';
import { Crown } from 'lucide-react';
import styles from './subscription-status-badge.module.css';

interface SubscriptionStatusBadgeProps {
  visible: boolean;
}

export function SubscriptionStatusBadge({ visible }: SubscriptionStatusBadgeProps) {
  if (!visible) return null;

  return (
    <span className={styles.badge} data-testid="subscription-status-badge">
      <Crown size={14} aria-hidden />
      Pro 契約中
    </span>
  );
}
