/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FreePlanCard } from '@/components/pricing/free-plan-card';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('FreePlanCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ctaMode=subscribe: 利用中バッジを表示', () => {
    render(<FreePlanCard ctaMode="subscribe" />);
    expect(screen.getByTestId('pricing-free-card')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-free-current')).toHaveTextContent('利用中');
  });

  test('ctaMode=guest: 無料で始めるボタンでログインへ遷移', () => {
    render(<FreePlanCard ctaMode="guest" />);
    fireEvent.click(screen.getByTestId('pricing-free-start-btn'));
    expect(mockPush).toHaveBeenCalledWith('/login?redirect=/pricing');
  });

  test('ctaMode=manage: 基本プラン表示', () => {
    render(<FreePlanCard ctaMode="manage" />);
    expect(screen.getByTestId('pricing-free-included')).toHaveTextContent('基本プラン');
  });
});
