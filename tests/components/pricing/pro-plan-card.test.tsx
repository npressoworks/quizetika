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
const mockFetchProPrices = jest.fn();

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
  fetchProPrices: (...args: unknown[]) => mockFetchProPrices(...args),
  startCheckoutSession: (...args: unknown[]) => mockStartCheckoutSession(...args),
  startPortalSession: (...args: unknown[]) => mockStartPortalSession(...args),
  redirectToExternalUrl: (...args: unknown[]) => mockRedirectToExternalUrl(...args),
}));

const readyPrices = {
  monthly: { amount: 980, currency: 'jpy' as const, label: '¥980/月' },
  yearly: { amount: 9800, currency: 'jpy' as const, label: '¥9,800/年' },
  savingsLabel: '年額で約2ヶ月分お得',
};

describe('ProPlanCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchProPrices.mockResolvedValue(readyPrices);
    mockStartCheckoutSession.mockResolvedValue({
      sessionUrl: 'https://checkout.stripe.com/test',
    });
    mockStartPortalSession.mockResolvedValue({
      sessionUrl: 'https://billing.stripe.com/test',
    });
  });

  test('ctaMode=subscribe: 価格取得後に購読ボタンを表示', async () => {
    render(<ProPlanCard ctaMode="subscribe" />);
    await waitFor(() => {
      expect(screen.getByTestId('pricing-price-ready')).toHaveTextContent('¥980/月');
    });
    expect(screen.getByTestId('pricing-subscribe-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('pricing-portal-btn')).not.toBeInTheDocument();
  });

  test('ctaMode=manage: Portal ボタンのみ表示', async () => {
    render(<ProPlanCard ctaMode="manage" />);
    await waitFor(() => {
      expect(screen.getByTestId('pricing-price-ready')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pricing-portal-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('pricing-subscribe-btn')).not.toBeInTheDocument();
  });

  test('ctaMode=guest: 購読クリックでログインへ遷移', async () => {
    render(<ProPlanCard ctaMode="guest" />);
    await waitFor(() => {
      expect(screen.getByTestId('pricing-price-ready')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('pricing-subscribe-btn'));
    expect(mockPush).toHaveBeenCalledWith('/login?redirect=/pricing');
    expect(mockStartCheckoutSession).not.toHaveBeenCalled();
  });

  test('ctaMode=subscribe: 購読クリックで Checkout API を呼ぶ', async () => {
    render(<ProPlanCard ctaMode="subscribe" />);
    await waitFor(() => {
      expect(screen.getByTestId('pricing-subscribe-btn')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('pricing-subscribe-btn'));

    await waitFor(() => {
      expect(mockStartCheckoutSession).toHaveBeenCalledWith('monthly');
      expect(mockRedirectToExternalUrl).toHaveBeenCalledWith('https://checkout.stripe.com/test');
    });
  });

  test('ctaMode=manage: Portal クリックで Portal API を呼ぶ', async () => {
    render(<ProPlanCard ctaMode="manage" />);
    await waitFor(() => {
      expect(screen.getByTestId('pricing-portal-btn')).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId('pricing-portal-btn'));

    await waitFor(() => {
      expect(mockStartPortalSession).toHaveBeenCalled();
      expect(mockRedirectToExternalUrl).toHaveBeenCalledWith('https://billing.stripe.com/test');
    });
  });

  test('価格取得失敗時はエラー表示と購読 disabled', async () => {
    mockFetchProPrices.mockRejectedValue(new Error('fail'));
    render(<ProPlanCard ctaMode="subscribe" />);

    await waitFor(() => {
      expect(screen.getByTestId('pricing-price-error')).toHaveTextContent('価格を読み込めません');
    });
    expect(screen.getByTestId('pricing-subscribe-btn')).toBeDisabled();
    expect(screen.getByTestId('pricing-interval-monthly')).toBeDisabled();
  });

  test('価格取得失敗時も manage では Portal を有効維持', async () => {
    mockFetchProPrices.mockRejectedValue(new Error('fail'));
    render(<ProPlanCard ctaMode="manage" />);

    await waitFor(() => {
      expect(screen.getByTestId('pricing-price-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pricing-portal-btn')).not.toBeDisabled();
  });

  test('年額選択で年額ラベルとお得表示', async () => {
    render(<ProPlanCard ctaMode="subscribe" />);
    await waitFor(() => {
      expect(screen.getByTestId('pricing-price-ready')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('pricing-interval-yearly'));

    expect(screen.getByTestId('pricing-price-ready')).toHaveTextContent('¥9,800/年');
    expect(screen.getByText('年額で約2ヶ月分お得')).toBeInTheDocument();
  });
});
