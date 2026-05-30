/**
 * 管理者モデレーション審査画面
 *
 * 機能:
 * - 通報5回以上に達した保留コンテンツ（クイズ）の審査キュー表示
 * - 各アイテムの通報理由・詳細の表示
 * - 公開復帰（通報リセット）・コンテンツ削除のアクションボタン
 * - 対象クイズクリック時の管理者審査用特別閲覧ビューへの遷移
 * - moderationTier によるクライアントサイドアクセスガード
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 * Boundary: AdminModeration-Queue, AdminModeration-Action
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/context/auth-context';
import { resolveFlag } from '@/services/moderation';
import { Quiz } from '@/types';
import styles from './moderation.module.css';

/** 通報フラグの詳細情報 */
interface FlagDetail {
  id: string;
  quizId: string;
  reporterId: string;
  reason: string;
  createdAt: Date;
}

/** 審査キューアイテム（クイズ＋関連フラグ群） */
interface ModerationQueueItem {
  quiz: Quiz;
  flags: FlagDetail[];
}

export default function AdminModerationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [queueItems, setQueueItems] = useState<ModerationQueueItem[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // -------------------------------------------------------------------
  // クライアントサイドアクセスガード (Req 1.1)
  // ミドルウェアによる一次保護に加えて、ページ側でも権限検証を行う
  // -------------------------------------------------------------------
  const isAuthorized =
    user?.moderationTier === 'senior_moderator' ||
    // 将来的な admin ロールフィールドへの対応（User型拡張時に削除）
    (user?.moderationTier as string) === 'admin';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/admin/moderation');
      return;
    }
    if (!loading && user && !isAuthorized) {
      router.push('/not-found');
    }
  }, [user, loading, isAuthorized, router]);

  // -------------------------------------------------------------------
  // 保留コンテンツの取得 (Req 1.2)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthorized) return;

    const fetchQueue = async () => {
      setFetchLoading(true);
      try {
        // 1. suspended 状態のクイズを取得
        const quizzesQuery = query(
          collection(db, 'quizzes'),
          where('status', '==', 'suspended'),
          orderBy('flagsCount', 'desc')
        );
        const quizzesSnap = await getDocs(quizzesQuery);
        const quizzes = quizzesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Quiz));

        // 2. 各クイズに対応する通報フラグを取得
        const items: ModerationQueueItem[] = await Promise.all(
          quizzes.map(async (quiz) => {
            const flagsQuery = query(
              collection(db, 'flags'),
              where('quizId', '==', quiz.id)
            );
            const flagsSnap = await getDocs(flagsQuery);
            const flags = flagsSnap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            } as FlagDetail));
            return { quiz, flags };
          })
        );

        setQueueItems(items);
      } catch (err) {
        console.error('審査キューの取得に失敗しました:', err);
        setErrorMessage('審査キューの読み込みに失敗しました。');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchQueue();
  }, [isAuthorized]);

  // -------------------------------------------------------------------
  // アクション: 公開復帰 / 削除 (Req 1.4)
  // -------------------------------------------------------------------
  const handleAction = async (
    quizId: string,
    action: 'restore' | 'delete'
  ) => {
    setActionLoading(quizId + action);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      if (!user) throw new Error('ユーザーがログインしていません');
      await resolveFlag(quizId, action, user.id);
      setQueueItems((prev) => prev.filter((item) => item.quiz.id !== quizId));
      setSuccessMessage(
        action === 'restore'
          ? 'コンテンツを公開に復帰しました。'
          : 'コンテンツを削除し、作成者に通知しました。'
      );
    } catch (err) {
      console.error('アクション失敗:', err);
      setErrorMessage('操作に失敗しました。もう一度お試しください。');
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------
  // 通報理由のラベル変換
  // -------------------------------------------------------------------
  const getReason = (reason: string) => {
    const labels: Record<string, string> = {
      harassment: '🔥 ハラスメント',
      spam: '📧 スパム',
      inappropriate: '🚫 不適切なコンテンツ',
      misinformation: '❌ 誤情報',
      copyright: '©️ 著作権侵害',
      other: '🔖 その他',
    };
    return labels[reason] ?? reason;
  };

  // ローディング中
  if (loading || fetchLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>審査キューを読み込んでいます...</p>
      </div>
    );
  }

  // 権限なし (ガード)
  if (!isAuthorized) return null;

  return (
    <div className={styles.pageContainer}>
      {/* ページヘッダー */}
      <header className={styles.pageHeader}>
        <div className={styles.headerBadge}>🛡️ 管理者専用</div>
        <h1 className={styles.pageTitle}>モデレーション審査</h1>
        <p className={styles.pageSubtitle}>
          通報が5回に達した保留コンテンツを審査し、公開復帰または削除を行います。
        </p>
      </header>

      {/* フィードバックメッセージ */}
      {successMessage && (
        <div className={styles.alertSuccess}>
          <span>✅</span> {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className={styles.alertError}>
          <span>⚠️</span> {errorMessage}
        </div>
      )}

      {/* キューカウンター */}
      <div className={styles.queueStats}>
        <span className={styles.queueCount}>{queueItems.length}</span>
        <span className={styles.queueLabel}>件の審査待ちコンテンツ</span>
      </div>

      {/* 審査キューリスト (Req 1.2, 1.3) */}
      {queueItems.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✨</div>
          <p>現在、審査待ちのコンテンツはありません。</p>
        </div>
      ) : (
        <div className={styles.queueList}>
          {queueItems.map(({ quiz, flags }) => (
            <div key={quiz.id} className={styles.queueCard}>
              {/* カードヘッダー */}
              <div className={styles.cardHeader}>
                <div className={styles.cardMeta}>
                  <span className={styles.contentTypeBadge}>📝 クイズ</span>
                  <span className={styles.flagCountBadge}>
                    🚩 {quiz.flagsCount} 件の通報
                  </span>
                </div>
                {/* クイズタイトル → 特別審査ビューへのリンク (Req 1.5) */}
                <Link
                  href={`/quiz/${quiz.id}?admin_review=1`}
                  target="_blank"
                  className={styles.quizTitleLink}
                >
                  <h2 className={styles.quizTitle}>{quiz.title}</h2>
                  <span className={styles.previewIcon}>🔍</span>
                </Link>
                <div className={styles.quizMeta}>
                  <span>作成者: {quiz.authorName}</span>
                  <span>問題数: {quiz.questionCount}問</span>
                  <span>ジャンル: {quiz.genre}</span>
                </div>
              </div>

              {/* 通報詳細一覧 (Req 1.3) */}
              <div className={styles.flagsSection}>
                <h3 className={styles.flagsSectionTitle}>通報詳細</h3>
                <div className={styles.flagsList}>
                  {flags.map((flag) => (
                    <div key={flag.id} className={styles.flagItem}>
                      <span className={styles.flagReason}>
                        {getReason(flag.reason)}
                      </span>
                      <span className={styles.flagReporter}>
                        通報者: {flag.reporterId.slice(0, 8)}...
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* アクションボタン (Req 1.4) */}
              <div className={styles.cardActions}>
                <button
                  id={`restore-btn-${quiz.id}`}
                  className={`${styles.actionBtn} ${styles.restoreBtn}`}
                  onClick={() => handleAction(quiz.id, 'restore')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === quiz.id + 'restore' ? (
                    <span className={styles.btnSpinner} />
                  ) : (
                    '✅ 公開に復帰'
                  )}
                </button>
                <button
                  id={`delete-btn-${quiz.id}`}
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => handleAction(quiz.id, 'delete')}
                  disabled={actionLoading !== null}
                >
                  {actionLoading === quiz.id + 'delete' ? (
                    <span className={styles.btnSpinner} />
                  ) : (
                    '🗑️ コンテンツ削除'
                  )}
                </button>
                <Link
                  href={`/quiz/${quiz.id}?admin_review=1`}
                  target="_blank"
                  className={`${styles.actionBtn} ${styles.previewBtn}`}
                >
                  🔍 管理者審査ビューで確認
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
