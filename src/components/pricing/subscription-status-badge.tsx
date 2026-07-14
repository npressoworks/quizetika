'use client';

import React from 'react';
import { WorkspacePremiumOutlined } from '@mui/icons-material';
import { Badge } from '@/components/ui/badge';
import type { SubscriptionTier } from '@/types/subscription';

interface SubscriptionStatusBadgeProps {
  visible: boolean;
  tier?: SubscriptionTier;
}

export function SubscriptionStatusBadge({ visible, tier }: SubscriptionStatusBadgeProps) {
  if (!visible || !tier || tier === 'free') return null;

  const label = tier === 'player' ? 'Player 契約中' : 'Creator 契約中';

  return (
    <Badge variant="secondary" className="gap-1" data-testid="subscription-status-badge">
      <WorkspacePremiumOutlined sx={{ fontSize: 14 }} />
      {label}
    </Badge>
  );
}
