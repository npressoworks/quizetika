'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';

// computeHasPaidEntitlements のインポート
// pricing-entitlement 内に定義されている判定関数を利用
import { PricingUiState } from '@/lib/pricing-entitlement';
import type { User } from '@/types';
import type { SubscriptionStatus, SubscriptionTier } from '@/types/subscription';

const PAID_ACTIVE_STATUSES: SubscriptionStatus[] = ['active', 'trialing'];

function computeHasPaidEntitlements(user: User | null): boolean {
  // E2Eテスト用のモック判定
  if (typeof window !== 'undefined') {
    try {
      const e2eMock = window.localStorage.getItem('e2e-mock-pro-user');
      if (e2eMock) {
        const parsed = JSON.parse(e2eMock);
        if (
          parsed.subscriptionTier === 'pro' &&
          parsed.subscriptionStatus === 'active'
        ) {
          return true;
        }
      }
    } catch (e) {
      // 解析エラーは無視して通常の判定にフォールバック
    }
  }

  if (!user) return false;

  const subscriptionTier = user.subscriptionTier ?? 'free';
  const subscriptionStatus = user.subscriptionStatus ?? null;

  return (
    (subscriptionTier === 'pro' || subscriptionTier === 'premium') &&
    subscriptionStatus !== null &&
    PAID_ACTIVE_STATUSES.includes(subscriptionStatus)
  );
}

export interface UseAdsResult {
  showAds: boolean;
  shouldShowVideoAd: () => boolean;
}

export function useAds(): UseAdsResult {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ハイドレーションエラー防止のため、マウント完了前は広告を表示しない (false)
  if (!mounted) {
    return {
      showAds: false,
      shouldShowVideoAd: () => false,
    };
  }

  // 認証情報の取得ロード中の間は非表示
  if (loading) {
    return {
      showAds: false,
      shouldShowVideoAd: () => false,
    };
  }

  // テスト等での広告無効化フラグチェック
  if (typeof window !== 'undefined') {
    if (window.localStorage.getItem('e2e-mock-ads-disabled') === 'true') {
      return {
        showAds: false,
        shouldShowVideoAd: () => false,
      };
    }
  }

  // 有料プラン会員は広告非表示
  const hasPaid = computeHasPaidEntitlements(user);
  const showAds = !hasPaid;

  const shouldShowVideoAd = () => {
    if (!showAds) return false;

    // E2E テスト用の強制動画広告トリガーチェック
    if (typeof window !== 'undefined') {
      if (window.localStorage.getItem('e2e-mock-force-video-ad') === 'true') {
        return true;
      }
    }

    return Math.random() < 1 / 3;
  };

  return {
    showAds,
    shouldShowVideoAd,
  };
}
