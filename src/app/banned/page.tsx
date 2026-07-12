/**
 * アカウント停止専用通知画面
 *
 * 機能:
 * - BANされたユーザーへ停止メッセージを表示
 * - 非BANユーザーおよび未ログインユーザーが直接アクセスした場合はホーム (/) にリダイレクト
 * - 基本フレーム（ヘッダー・タイトル・停止通知）は即座に表示し、BAN理由・日時等の
 *   詳細情報はロード中スケルトンを挟んで最新データに差し替える（非同期表示最適化）
 *
 * Requirements: 6.1, 6.2, 7.6, 7.7, 7.8, 7.10
 * Boundary: BannedPage
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getUserProfile } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { User } from '@/types';
import styles from './banned.module.css';

export default function BannedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [banDetail, setBanDetail] = useState<User | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    if (loading) return;

    // クッキー内の banned フラグも確認
    const isCookieBanned = typeof document !== 'undefined' &&
      document.cookie.split('; ').some(row => row.startsWith('quizetika_banned=true'));

    const isBanned = (user && user.isBanned === true) || isCookieBanned;

    if (!isBanned) {
      // BANされていない場合はホーム画面へリダイレクト (Req 6.2, 既存動作・無変更)
      router.push('/');
    } else {
      setChecking(false);
    }
  }, [user, loading, router]);

  // BAN理由・日時は AuthContext のキャッシュがBAN後に更新されていない可能性があるため、
  // 基本フレーム表示後に最新のユーザープロフィールを取得し直す（Req 7.7, 7.8）
  useEffect(() => {
    if (loading || checking || !user?.id) return;

    let cancelled = false;
    setDetailLoading(true);

    getUserProfile(user.id)
      .then((profile) => {
        if (!cancelled) setBanDetail(profile);
      })
      .catch((err) => {
        console.error('BAN詳細情報の取得エラー:', err);
        if (!cancelled) setBanDetail(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, checking, user?.id]);

  if (loading || checking) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>確認しています...</p>
      </div>
    );
  }

  const displayReason = banDetail?.bannedReason ?? user?.bannedReason;
  const displayBannedAt = banDetail?.bannedAt ?? user?.bannedAt;
  const formattedBannedAt = displayBannedAt
    ? new Date(displayBannedAt).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : undefined;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.bannedCard}>
        <div className={styles.iconContainer}>🚨</div>
        <h1 className={styles.title}>アカウントが停止されています</h1>
        <p className={styles.message}>
          利用規約への違反、または不適切な行為が確認されたため、お使いの quizetika アカウントは現在一時的または恒久的に停止（BAN）されています。
        </p>
        {detailLoading ? (
          <div
            data-testid="banned-info-skeleton"
            className={styles.reasonBox}
            style={{ width: '100%' }}
          >
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          (displayReason || formattedBannedAt) && (
            <div className={styles.reasonBox}>
              {displayReason && (
                <>
                  <span className={styles.reasonLabel}>停止理由:</span>
                  <p className={styles.reasonText}>{displayReason}</p>
                </>
              )}
              {formattedBannedAt && (
                <>
                  <span className={styles.reasonLabel}>停止日時:</span>
                  <p className={styles.reasonText}>{formattedBannedAt}</p>
                </>
              )}
            </div>
          )
        )}
        <div className={styles.footerInfo}>
          <p>
            本件に関する不服申し立てやお問い合わせは、サポート窓口までご連絡ください。
          </p>
          <p className={styles.contactEmail}>support@quizetika.example.com</p>
        </div>
      </div>
    </div>
  );
}
