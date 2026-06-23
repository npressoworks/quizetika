/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdsenseInlineAd } from '@/components/ads/adsense-inline-ad';
import { useAds } from '@/hooks/useAds';

// useAds のモック化
jest.mock('@/hooks/useAds', () => ({
  useAds: jest.fn(),
}));

const mockUseAds = useAds as jest.Mock;

describe('AdsenseInlineAd Component', () => {
  const originalEnv = process.env;
  let localStorageStore: Record<string, string> = {};

  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => localStorageStore[key] || null,
        setItem: (key: string, val: string) => {
          localStorageStore[key] = val;
        },
        removeItem: (key: string) => {
          delete localStorageStore[key];
        },
        clear: () => {
          localStorageStore = {};
        },
      },
      writable: true,
    });
  });

  beforeEach(() => {
    localStorageStore = {};
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-test-12345',
      NODE_ENV: 'test',
    };
    // adsbygoogle の簡易モック
    (window as any).adsbygoogle = [];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('showAds が false のとき、何もレンダリングしない (null を返す)', () => {
    mockUseAds.mockReturnValue({
      showAds: false,
      shouldShowVideoAd: () => false,
    });

    const { container } = render(<AdsenseInlineAd />);
    expect(container).toBeEmptyDOMElement();
  });

  it('showAds が true かつ開発/テスト環境のとき、ダミー広告カード（PRバッジ付き）をレンダリングする', () => {
    mockUseAds.mockReturnValue({
      showAds: true,
      shouldShowVideoAd: () => false,
    });

    render(<AdsenseInlineAd />);

    expect(screen.getByTestId('ad-card-dummy')).toBeInTheDocument();
    expect(screen.getByText('PR')).toBeInTheDocument();
    expect(screen.getByText(/スポンサー広告/)).toBeInTheDocument();
  });

  it('showAds が true かつ本番環境のとき、AdSense insタグをレンダリングし push を呼び出す', () => {
    process.env.NODE_ENV = 'production';
    
    mockUseAds.mockReturnValue({
      showAds: true,
      shouldShowVideoAd: () => false,
    });

    const pushSpy = jest.spyOn((window as any).adsbygoogle, 'push');

    render(<AdsenseInlineAd adSlot="test-slot-123" />);

    const ins = screen.getByTestId('ad-card-adsense');
    expect(ins).toBeInTheDocument();
    expect(ins).toHaveAttribute('data-ad-client', 'ca-pub-test-12345');
    expect(ins).toHaveAttribute('data-ad-slot', 'test-slot-123');
    
    expect(pushSpy).toHaveBeenCalled();
  });
});
