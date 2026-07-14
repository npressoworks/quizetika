/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SubscriptionStatusBadge } from '@/components/pricing/subscription-status-badge';

describe('SubscriptionStatusBadge', () => {
  test('visible=true かつ tier=player のとき Player 契約中バッジを表示', () => {
    render(<SubscriptionStatusBadge visible tier="player" />);
    expect(screen.getByTestId('subscription-status-badge')).toBeInTheDocument();
    expect(screen.getByText('Player 契約中')).toBeInTheDocument();
  });

  test('visible=true かつ tier=creator のとき Creator 契約中バッジを表示', () => {
    render(<SubscriptionStatusBadge visible tier="creator" />);
    expect(screen.getByTestId('subscription-status-badge')).toBeInTheDocument();
    expect(screen.getByText('Creator 契約中')).toBeInTheDocument();
  });

  test('visible=false のとき非表示', () => {
    render(<SubscriptionStatusBadge visible={false} tier="creator" />);
    expect(screen.queryByTestId('subscription-status-badge')).not.toBeInTheDocument();
  });

  test('tier が free または未指定のとき非表示', () => {
    render(<SubscriptionStatusBadge visible tier="free" />);
    expect(screen.queryByTestId('subscription-status-badge')).not.toBeInTheDocument();
  });
});
