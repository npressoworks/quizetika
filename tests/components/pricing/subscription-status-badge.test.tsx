/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SubscriptionStatusBadge } from '@/components/pricing/subscription-status-badge';

describe('SubscriptionStatusBadge', () => {
  test('visible=true のとき Pro 契約中バッジを表示', () => {
    render(<SubscriptionStatusBadge visible />);
    expect(screen.getByTestId('subscription-status-badge')).toBeInTheDocument();
    expect(screen.getByText('Pro 契約中')).toBeInTheDocument();
  });

  test('visible=false のとき非表示', () => {
    render(<SubscriptionStatusBadge visible={false} />);
    expect(screen.queryByTestId('subscription-status-badge')).not.toBeInTheDocument();
  });
});
