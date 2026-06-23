/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React, { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { useAds } from '@/hooks/useAds';
import { useAuth } from '@/context/auth-context';

// useAuth のモック化
jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

// テスト用のプローブコンポーネント
function Probe({ onProbe }: { onProbe: (res: ReturnType<typeof useAds>) => void }) {
  const ads = useAds();
  
  useEffect(() => {
    onProbe(ads);
  }, [ads, onProbe]);

  return (
    <div>
      <span data-testid="show-ads">{ads.showAds ? 'true' : 'false'}</span>
    </div>
  );
}

describe('useAds Hook', () => {
  let localStorageStore: Record<string, string> = {};

  beforeAll(() => {
    // localStorage の簡易モック
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
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });
  });

  it('未ログインかつロード完了状態のとき、showAds は true を返す', async () => {
    const onProbe = jest.fn();
    render(<Probe onProbe={onProbe} />);

    // ハイドレーション直後は showAds が初期値 false から true に更新されることを検証する
    expect(screen.getByTestId('show-ads')).toHaveTextContent('true');
    expect(onProbe).toHaveBeenLastCalledWith(
      expect.objectContaining({ showAds: true })
    );
  });

  it('無料会員かつロード完了状態のとき、showAds は true を返す', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-free',
        subscriptionTier: 'free',
        subscriptionStatus: null,
      },
      loading: false,
    });

    const onProbe = jest.fn();
    render(<Probe onProbe={onProbe} />);

    expect(screen.getByTestId('show-ads')).toHaveTextContent('true');
  });

  it('有料会員かつアクティブプランのとき、showAds は false を返す', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-pro',
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
      },
      loading: false,
    });

    const onProbe = jest.fn();
    render(<Probe onProbe={onProbe} />);

    expect(screen.getByTestId('show-ads')).toHaveTextContent('false');
  });

  it('useAuth がロード中のとき、showAds は常に false を返す', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    const onProbe = jest.fn();
    render(<Probe onProbe={onProbe} />);

    expect(screen.getByTestId('show-ads')).toHaveTextContent('false');
  });

  it('localStorage の e2e-mock-ads-disabled が true のとき、無料会員でも showAds は false になる', () => {
    localStorageStore['e2e-mock-ads-disabled'] = 'true';
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-free',
        subscriptionTier: 'free',
        subscriptionStatus: null,
      },
      loading: false,
    });

    const onProbe = jest.fn();
    render(<Probe onProbe={onProbe} />);

    expect(screen.getByTestId('show-ads')).toHaveTextContent('false');
  });

  it('有料会員の場合、shouldShowVideoAd は常に false を返す', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-pro',
        subscriptionTier: 'pro',
        subscriptionStatus: 'active',
      },
      loading: false,
    });

    const onProbe = jest.fn();
    render(<Probe onProbe={onProbe} />);

    const adsResult = onProbe.mock.calls[onProbe.mock.calls.length - 1][0];
    expect(adsResult.shouldShowVideoAd()).toBe(false);
  });

  it('無料会員で e2e-mock-force-video-ad が true のとき、shouldShowVideoAd は常に true を返す', () => {
    localStorageStore['e2e-mock-force-video-ad'] = 'true';
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-free',
        subscriptionTier: 'free',
        subscriptionStatus: null,
      },
      loading: false,
    });

    const onProbe = jest.fn();
    render(<Probe onProbe={onProbe} />);

    const adsResult = onProbe.mock.calls[onProbe.mock.calls.length - 1][0];
    expect(adsResult.shouldShowVideoAd()).toBe(true);
  });

  it('無料会員のとき、shouldShowVideoAd は Math.random が 1/3 未満のときのみ true を返す', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-free',
        subscriptionTier: 'free',
        subscriptionStatus: null,
      },
      loading: false,
    });

    const onProbe = jest.fn();
    const { rerender } = render(<Probe onProbe={onProbe} />);

    let adsResult = onProbe.mock.calls[onProbe.mock.calls.length - 1][0];

    // Math.random を 0.25 (1/3 未満) にモック化
    const originalRandom = Math.random;
    Math.random = () => 0.25;

    expect(adsResult.shouldShowVideoAd()).toBe(true);

    // Math.random を 0.5 (1/3 以上) にモック化
    Math.random = () => 0.5;
    expect(adsResult.shouldShowVideoAd()).toBe(false);

    Math.random = originalRandom;
  });
});
