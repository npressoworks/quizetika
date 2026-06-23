/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdsenseProvider } from '@/components/ads/adsense-provider';
import { useAds } from '@/hooks/useAds';

// next/script のモック化
jest.mock('next/script', () => {
  return function MockScript({ src, strategy, crossOrigin }: any) {
    return (
      <div
        data-testid="next-script"
        data-src={src}
        data-strategy={strategy}
        data-crossorigin={crossOrigin}
      />
    );
  };
});

// useAds のモック化
jest.mock('@/hooks/useAds', () => ({
  useAds: jest.fn(),
}));

const mockUseAds = useAds as jest.Mock;

describe('AdsenseProvider Component', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_ADSENSE_CLIENT_ID: 'ca-pub-test-12345',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('showAds が true の場合、正しい client ID を持つ Script タグをレンダリングする', () => {
    mockUseAds.mockReturnValue({
      showAds: true,
      shouldShowVideoAd: () => false,
    });

    render(
      <AdsenseProvider>
        <div data-testid="child">Content</div>
      </AdsenseProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    
    const script = screen.getByTestId('next-script');
    expect(script).toBeInTheDocument();
    expect(script).toHaveAttribute(
      'data-src',
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-test-12345'
    );
    expect(script).toHaveAttribute('data-strategy', 'afterInteractive');
    expect(script).toHaveAttribute('data-crossorigin', 'anonymous');
  });

  it('showAds が false の場合、Script タグをレンダリングしない', () => {
    mockUseAds.mockReturnValue({
      showAds: false,
      shouldShowVideoAd: () => false,
    });

    render(
      <AdsenseProvider>
        <div data-testid="child">Content</div>
      </AdsenseProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('next-script')).not.toBeInTheDocument();
  });

  it('環境変数が未設定の場合、showAds が true であっても Script タグをマウントしない', () => {
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
    
    mockUseAds.mockReturnValue({
      showAds: true,
      shouldShowVideoAd: () => false,
    });

    render(
      <AdsenseProvider>
        <div data-testid="child">Content</div>
      </AdsenseProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('next-script')).not.toBeInTheDocument();
  });
});
