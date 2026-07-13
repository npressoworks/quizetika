/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PricingPage from '@/app/pricing/page';
import { useAuth } from '@/context/auth-context';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockGetParam: string | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: (param: string) => (param === 'checkout' ? mockGetParam : null),
  }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/billing-client', () => ({
  BillingClientError: class BillingClientError extends Error {
    apiError: { code: string; message: string };
    constructor(apiError: { code: string; message: string }) {
      super(apiError.message);
      this.apiError = apiError;
    }
  },
  fetchPlanPrices: jest.fn().mockResolvedValue({
    player: {
      monthly: { amount: 500, currency: 'jpy', label: '¥500/月' },
      yearly: { amount: 5000, currency: 'jpy', label: '¥5,000/年' },
      savingsLabel: '年額で約2ヶ月分お得',
    },
    creator: {
      monthly: { amount: 980, currency: 'jpy', label: '¥980/月' },
      yearly: { amount: 9800, currency: 'jpy', label: '¥9,800/年' },
      savingsLabel: '年額で約2ヶ月分お得',
    },
  }),
}));

const mockUseAuth = useAuth as jest.Mock;

describe('PricingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetParam = null;
  });

  test('loading=true のときはスケルトンを表示する', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      refreshUser: jest.fn(),
    });

    render(<PricingPage />);

    expect(screen.getByTestId('pricing-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('料金プラン')).not.toBeInTheDocument();
  });

  test('loading=false のときは料金プランページを表示する（3カラムのカードが表示される）', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<PricingPage />);

    // ヘッダーが表示されることを確認
    expect(screen.getByRole('heading', { name: '料金プラン' })).toBeInTheDocument();
    expect(screen.getByText('無料の Free プランから始めて、必要に応じて Player プランや Creator プランへアップグレードできます。')).toBeInTheDocument();

    // 3枚のプランカード（Free, Player, Creator）が表示されることを確認
    expect(screen.getByTestId('pricing-free-card')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByTestId('pricing-player-card')).toBeInTheDocument();
      expect(screen.getByTestId('pricing-creator-card')).toBeInTheDocument();
    });
  });

  test('checkout=success クエリがあるときは成功バナーを表示し refreshUser を呼ぶ', async () => {
    const mockRefreshUser = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { uid: 'test-user', subscriptionTier: 'free' },
      loading: false,
      refreshUser: mockRefreshUser,
    });
    mockGetParam = 'success';

    render(<PricingPage />);

    // 成功フィードバックバナーが表示されることを確認
    expect(screen.getByTestId('checkout-feedback-success')).toBeInTheDocument();
    expect(mockRefreshUser).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/pricing');
  });

  test('checkout=canceled クエリがあるときはキャンセルバナーを表示する', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'test-user', subscriptionTier: 'free' },
      loading: false,
      refreshUser: jest.fn(),
    });
    mockGetParam = 'canceled';

    render(<PricingPage />);

    // キャンセルフィードバックバナーが表示されることを確認
    expect(screen.getByTestId('checkout-feedback-canceled')).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith('/pricing');
  });
});
