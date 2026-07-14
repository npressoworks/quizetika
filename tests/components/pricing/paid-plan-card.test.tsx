/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PaidPlanCard } from '@/components/pricing/paid-plan-card';

const mockPush = jest.fn();
const mockStartCheckoutSession = jest.fn();
const mockStartPortalSession = jest.fn();
const mockRedirectToExternalUrl = jest.fn();
const mockFetchPlanPrices = jest.fn();
const mockChangePlan = jest.fn();
const mockRefreshUser = jest.fn();

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
  fetchPlanPrices: (...args: unknown[]) => mockFetchPlanPrices(...args),
  startCheckoutSession: (...args: unknown[]) => mockStartCheckoutSession(...args),
  startPortalSession: (...args: unknown[]) => mockStartPortalSession(...args),
  redirectToExternalUrl: (...args: unknown[]) => mockRedirectToExternalUrl(...args),
  changePlan: (...args: unknown[]) => mockChangePlan(...args),
}));

const readyPrices = {
  player: {
    monthly: { amount: 500, currency: 'jpy' as const, label: '¥500/月' },
    yearly: { amount: 5000, currency: 'jpy' as const, label: '¥5,000/年' },
    savingsLabel: '年額で約2ヶ月分お得',
  },
  creator: {
    monthly: { amount: 980, currency: 'jpy' as const, label: '¥980/月' },
    yearly: { amount: 9800, currency: 'jpy' as const, label: '¥9,800/年' },
    savingsLabel: '年額で約2ヶ月分お得',
  },
};

describe('PaidPlanCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPlanPrices.mockResolvedValue(readyPrices);
    mockStartCheckoutSession.mockResolvedValue({
      sessionUrl: 'https://checkout.stripe.com/test',
    });
    mockStartPortalSession.mockResolvedValue({
      sessionUrl: 'https://billing.stripe.com/test',
    });
    mockChangePlan.mockResolvedValue({ subscriptionTier: 'creator' });
  });

  describe('価格表示と基本購読', () => {
    test('ctaMode=subscribe: 価格取得後に購読ボタンを表示', async () => {
      render(
        <PaidPlanCard
          tier="creator"
          ctaMode="subscribe"
          userSubscriptionTier="free"
          hasPaidEntitlements={false}
          refreshUser={mockRefreshUser}
          selectedInterval="monthly"
          prices={readyPrices.creator}
          priceStatus="ready"
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('pricing-creator-price-ready')).toHaveTextContent('¥980/月');
      });
      expect(screen.getByTestId('pricing-subscribe-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('pricing-portal-btn')).not.toBeInTheDocument();
    });

    test('ctaMode=guest: 購読クリックでログインへ遷移', async () => {
      render(
        <PaidPlanCard
          tier="player"
          ctaMode="guest"
          userSubscriptionTier="free"
          hasPaidEntitlements={false}
          refreshUser={mockRefreshUser}
          selectedInterval="monthly"
          prices={readyPrices.player}
          priceStatus="ready"
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('pricing-player-price-ready')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('pricing-subscribe-btn'));
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/pricing');
      expect(mockStartCheckoutSession).not.toHaveBeenCalled();
    });

    test('ctaMode=subscribe: 購読クリックで Checkout API を呼ぶ', async () => {
      render(
        <PaidPlanCard
          tier="player"
          ctaMode="subscribe"
          userSubscriptionTier="free"
          hasPaidEntitlements={false}
          refreshUser={mockRefreshUser}
          selectedInterval="monthly"
          prices={readyPrices.player}
          priceStatus="ready"
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('pricing-subscribe-btn')).not.toBeDisabled();
      });
      fireEvent.click(screen.getByTestId('pricing-subscribe-btn'));

      await waitFor(() => {
        expect(mockStartCheckoutSession).toHaveBeenCalledWith('player', 'monthly');
        expect(mockRedirectToExternalUrl).toHaveBeenCalledWith('https://checkout.stripe.com/test');
      });
    });

    test('価格取得失敗時はエラー表示と購読無効', async () => {
      render(
        <PaidPlanCard
          tier="creator"
          ctaMode="subscribe"
          userSubscriptionTier="free"
          hasPaidEntitlements={false}
          refreshUser={mockRefreshUser}
          selectedInterval="monthly"
          prices={null}
          priceStatus="error"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('pricing-creator-price-error')).toHaveTextContent('価格を読み込めません');
      });
      expect(screen.getByTestId('pricing-subscribe-btn')).toBeDisabled();
    });
  });

  describe('契約中・管理', () => {
    test('自身と一致する契約中 tier: 契約管理ボタンと契約中バッジを表示', async () => {
      render(
        <PaidPlanCard
          tier="player"
          ctaMode="manage"
          userSubscriptionTier="player"
          hasPaidEntitlements={true}
          refreshUser={mockRefreshUser}
          selectedInterval="monthly"
          prices={readyPrices.player}
          priceStatus="ready"
        />
      );
      await waitFor(() => {
        expect(screen.getByTestId('pricing-player-price-ready')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pricing-portal-btn')).toBeInTheDocument();
      expect(screen.getByTestId('pricing-player-current')).toHaveTextContent('契約中');
      expect(screen.queryByTestId('pricing-subscribe-btn')).not.toBeInTheDocument();
    });

    test('価格取得失敗時も、自身と一致する契約中は Portal を有効維持', async () => {
      render(
        <PaidPlanCard
          tier="player"
          ctaMode="manage"
          userSubscriptionTier="player"
          hasPaidEntitlements={true}
          refreshUser={mockRefreshUser}
          selectedInterval="monthly"
          prices={null}
          priceStatus="error"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('pricing-player-price-error')).toBeInTheDocument();
      });
      expect(screen.getByTestId('pricing-portal-btn')).not.toBeDisabled();
    });
  });

  describe('プラン変更（切り替え）', () => {
    test('Player 契約中に Creator カード: 切り替えるボタンを表示 (アップグレードしてポータルへ遷移)', async () => {
      mockStartPortalSession.mockResolvedValue({ sessionUrl: 'https://billing.stripe.com/portal/session-1' });

      render(
        <PaidPlanCard
          tier="creator"
          ctaMode="manage"
          userSubscriptionTier="player"
          hasPaidEntitlements={true}
          refreshUser={mockRefreshUser}
          selectedInterval="monthly"
          prices={readyPrices.creator}
          priceStatus="ready"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('pricing-switch-btn')).toBeInTheDocument();
        expect(screen.getByTestId('pricing-switch-btn')).not.toBeDisabled();
      });
      expect(screen.getByTestId('pricing-switch-btn')).toHaveTextContent('Creatorにアップグレードする');
      expect(screen.getByText('即時切り替えと日割り課金が発生します。')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('pricing-switch-btn'));

      await waitFor(() => {
        expect(mockStartPortalSession).toHaveBeenCalled();
        expect(mockRedirectToExternalUrl).toHaveBeenCalledWith('https://billing.stripe.com/portal/session-1');
      });
    });

    test('Creator 契約中に Player カード: 切り替えるボタンを表示 (ダウングレードしてポータルへ遷移)', async () => {
      mockStartPortalSession.mockResolvedValue({ sessionUrl: 'https://billing.stripe.com/portal/session-2' });

      render(
        <PaidPlanCard
          tier="player"
          ctaMode="manage"
          userSubscriptionTier="creator"
          hasPaidEntitlements={true}
          refreshUser={mockRefreshUser}
          selectedInterval="monthly"
          prices={readyPrices.player}
          priceStatus="ready"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('pricing-switch-btn')).toBeInTheDocument();
        expect(screen.getByTestId('pricing-switch-btn')).not.toBeDisabled();
      });
      expect(screen.getByTestId('pricing-switch-btn')).toHaveTextContent('Playerにダウングレードする');

      fireEvent.click(screen.getByTestId('pricing-switch-btn'));

      await waitFor(() => {
        expect(mockStartPortalSession).toHaveBeenCalled();
        expect(mockRedirectToExternalUrl).toHaveBeenCalledWith('https://billing.stripe.com/portal/session-2');
      });
    });
  });
});
