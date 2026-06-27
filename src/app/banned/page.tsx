/**
 * アカウント停止専用通知画面
 *
 * 機能:
 * - BANされたユーザーへ停止メッセージを表示
 * - 非BANユーザーおよび未ログインユーザーが直接アクセスした場合はホーム (/) にリダイレクト
 *
 * Requirements: 6.1, 6.2
 * Boundary: BannedUI
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import styles from './banned.module.css';

export default function BannedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    // クッキー内の banned フラグも確認
    const isCookieBanned = typeof document !== 'undefined' &&
      document.cookie.split('; ').some(row => row.startsWith('quizetika_banned=true'));

    const isBanned = (user && user.isBanned === true) || isCookieBanned;

    if (!isBanned) {
      // BANされていない場合はホーム画面へリダイレクト (Req 6.2)
      router.push('/');
    } else {
      setChecking(false);
    }
  }, [user, loading, router]);

  if (loading || checking) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>確認しています...</p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.bannedCard}>
        <div className={styles.iconContainer}>🚨</div>
        <h1 className={styles.title}>アカウントが停止されています</h1>
        <p className={styles.message}>
          利用規約への違反、または不適切な行為が確認されたため、お使いの quizetika アカウントは現在一時的または恒久的に停止（BAN）されています。
        </p>
        {user?.bannedReason && (
          <div className={styles.reasonBox}>
            <span className={styles.reasonLabel}>停止理由:</span>
            <p className={styles.reasonText}>{user.bannedReason}</p>
          </div>
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
