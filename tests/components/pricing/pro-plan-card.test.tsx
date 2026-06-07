/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProPlanCard } from '@/components/pricing/pro-plan-card';

const mockPush = jest.fn();
const mockStartCheckoutSession = jest.fn();
const mockStartPortalSession = jest.fn();
const mockRedirectToExternalUrl = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('@/lib/billing-client', () => ({
  BillingClientError: class BillingClientError extends Error {
    apiError: { code: string; message: string };
    constructor(apiError: { code: string; message: string }) {
      super(apiError.message);
      this.apiError = apiError;
    }
  },
  startCheckoutSession: (...args: unknown[]) => mockStartCheckoutSession(...args),
  startPortalSession: (...args: unknown[]) => mockStartPortalSession(...args),
  redirectToExternalUrl: (...args: unknown[]) => mockRedirectToExternalUrl(...args),
}));

describe('ProPlanCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartCheckoutSession.mockResolvedValue({
      sessionUrl: 'https://checkout.stripe.com/test',
    });
    mockStartPortalSession.mockResolvedValue({
      sessionUrl: 'https://billing.stripe.com/test',
    });
  });

  test('ctaMode=subscribe: 購読ボタンを表示', () => {
    render(<ProPlanCard ctaMode="subscribe" />);
    expect(screen.getByTestId('pricing-subscribe-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('pricing-portal-btn')).not.toBeInTheDocument();
  });

  test('ctaMode=manage: Portal ボタンのみ表示', () => {
    render(<ProPlanCard ctaMode="manage" />);
    expect(screen.getByTestId('pricing-portal-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('pricing-subscribe-btn')).not.toBeInTheDocument();
  });

  test('ctaMode=guest: 購読クリックでログインへ遷移', () => {
    render(<ProPlanCard ctaMode="guest" />);
    fireEvent.click(screen.getByTestId('pricing-subscribe-btn'));
    expect(mockPush).toHaveBeenCalledWith('/login?redirect=/pricing');
    expect(mockStartCheckoutSession).not.toHaveBeenCalled();
  });

  test('ctaMode=subscribe: 購読クリックで Checkout API を呼ぶ', async () => {
    render(<ProPlanCard ctaMode="subscribe" />);
    fireEvent.click(screen.getByTestId('pricing-subscribe-btn'));

    await waitFor(() => {
      expect(mockStartCheckoutSession).toHaveBeenCalledWith('monthly');
      expect(mockRedirectToExternalUrl).toHaveBeenCalledWith('https://checkout.stripe.com/test');
    });
  });

  test('ctaMode=manage: Portal クリックで Portal API を呼ぶ', async () => {
    render(<ProPlanCard ctaMode="manage" />);
    fireEvent.click(screen.getByTestId('pricing-portal-btn'));

    await waitFor(() => {
      expect(mockStartPortalSession).toHaveBeenCalled();
      expect(mockRedirectToExternalUrl).toHaveBeenCalledWith('https://billing.stripe.com/test');
    });
  });
});
