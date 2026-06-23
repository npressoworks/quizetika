/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AdsenseProvider } from '@/components/ads/adsense-provider';
import { useAds } from '@/hooks/useAds';

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
    // テストごとに document.head をクリーンアップ
    const scripts = document.head.querySelectorAll('script');
    scripts.forEach((s) => s.remove());
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('showAds が true の場合、正しい client ID を持つ Script タグを document.head に追加する', () => {
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
    
    const script = document.head.querySelector(
      'script[src*="pagead2.googlesyndication.com"]'
    ) as HTMLScriptElement;
    expect(script).toBeInTheDocument();
    expect(script.src).toBe(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-test-12345'
    );
    expect(script.crossOrigin).toBe('anonymous');
    expect(script.async).toBe(true);
  });

  it('showAds が false の場合、Script タグを document.head に追加しない', () => {
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
    const script = document.head.querySelector(
      'script[src*="pagead2.googlesyndication.com"]'
    );
    expect(script).not.toBeInTheDocument();
  });

  it('環境変数が未設定の場合、showAds が true であっても Script タグを追加しない', () => {
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
    const script = document.head.querySelector(
      'script[src*="pagead2.googlesyndication.com"]'
    );
    expect(script).not.toBeInTheDocument();
  });
});
