/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { CheckoutFeedbackBanner } from '@/components/pricing/checkout-feedback-banner';

describe('CheckoutFeedbackBanner', () => {
  test('success: 祝福メッセージを表示', () => {
    render(<CheckoutFeedbackBanner variant="success" />);
    expect(screen.getByTestId('checkout-feedback-success')).toBeInTheDocument();
    expect(screen.getByText(/Pro プランへの加入が完了しました/)).toBeInTheDocument();
  });

  test('canceled: 中立メッセージを表示', () => {
    render(<CheckoutFeedbackBanner variant="canceled" />);
    expect(screen.getByTestId('checkout-feedback-canceled')).toBeInTheDocument();
    expect(screen.getByText(/購入手続きはキャンセルされました/)).toBeInTheDocument();
  });

  test('pendingWebhook: 反映待ち案内を表示', () => {
    render(<CheckoutFeedbackBanner variant="success" pendingWebhook />);
    expect(screen.getByTestId('checkout-pending-webhook')).toBeInTheDocument();
  });
});
