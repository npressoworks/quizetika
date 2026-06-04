/**
 * システム管理者向けユーザー評判スコアリセット画面
 *
 * 機能:
 * - 特定のUIDに基づくユーザーの検索
 * - ユーザー詳細情報の表示（表示名、アバター、評判スコア、ティアー、退会ステータス）
 * - 評判スコア（0）およびモデレーションティアー（newcomer）の手動緊急リセット
 * - 10文字以上のリセット理由バリデーション
 * - 管理者ロール (admin) によるアクセス制限
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.3, 3.4, 4.2
 * Boundary: AdminUsersUI
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { getUserProfile } from '@/services/user';
import { User } from '@/types';
import styles from './users.module.css';

export default function AdminUsersPage() {
  const { user, firebaseUser, loading } = useAuth();
  const router = useRouter();

  const [searchUid, setSearchUid] = useState('');
  const [searchedUser, setSearchedUser] = useState<User | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [reason, setReason] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // クライアントサイドアクセスガード (Super Adminのみ)
  const isAuthorized =
    (user?.moderationTier as string) === 'admin' ||
    (user as any)?.role === 'admin';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/admin/users');
      return;
    }
    if (!loading && user && !isAuthorized) {
      router.push('/not-found');
    }
  }, [user, loading, isAuthorized, router]);

  // ユーザー検索処理
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUid.trim()) return;

    setFetchLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setSearchedUser(null);
    setHasSearched(true);

    try {
      const u = await getUserProfile(searchUid.trim());
      setSearchedUser(u);
      if (!u) {
        setErrorMessage('指定されたUIDのユーザーが見つかりません。');
      }
    } catch (err) {
      console.error('ユーザー検索エラー:', err);
      setErrorMessage('ユーザー情報の取得中にエラーが発生しました。');
    } finally {
      setFetchLoading(false);
    }
  };

  // 評判スコア＆ティアーのリセット処理
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedUser || !firebaseUser) return;
    if (reason.length < 10) {
      setErrorMessage('リセット理由は10文字以上で入力してください。');
      return;
    }

    setActionLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/admin/users/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: searchedUser.id,
          reason: reason,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'リセット処理に失敗しました。');
      }

      setSuccessMessage('ユーザーの信頼スコアと権限ティアーをリセットしました。');
      setReason('');

      // 最新のユーザー情報を再取得
      const updatedUser = await getUserProfile(searchedUser.id);
      setSearchedUser(updatedUser);
    } catch (err: any) {
      console.error('リセットエラー:', err);
      setErrorMessage(err.message || 'リセット処理中にエラーが発生しました。');
    } finally {
      setActionLoading(false);
    }
  };

  // モデレーターのティアーラベル日本語表記
  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      newcomer: 'Newcomer (新規)',
      contributor: 'Contributor (貢献者)',
      moderator: 'Moderator (一般モデレータ)',
      senior_moderator: 'Senior Moderator (上級モデレータ)',
      admin: 'Admin (システム管理者)',
    };
    return labels[tier] ?? tier;
  };

  // 全体ローディング中
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>認証情報を確認しています...</p>
      </div>
    );
  }

  // 権限なし (ガード)
  if (!isAuthorized) return null;

  return (
    <div className={styles.pageContainer}>
      {/* 相互ナビゲーションリンク (Req 4.2) */}
      <div className={styles.navHeader}>
        <Link href="/admin/moderation" className={styles.backLink}>
          ← モデレーション審査キューに戻る
        </Link>
      </div>

      {/* ページヘッダー */}
      <header className={styles.pageHeader}>
        <div className={styles.headerBadge}>🛡️ 特権管理者専用</div>
        <h1 className={styles.pageTitle}>ユーザー評判管理</h1>
        <p className={styles.pageSubtitle}>
          不適切行為を行ったユーザーの信頼スコア（reputationScore）および権限ティアー（moderationTier）を強制的に初期値へリセットします。
        </p>
      </header>

      {/* アラート表示 */}
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

      {/* 検索セクション (Req 2.1) */}
      <section className={styles.searchSection}>
        <h2 className={styles.sectionTitle}>ユーザー検索</h2>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <input
            type="text"
            placeholder="ユーザーUIDを入力..."
            value={searchUid}
            onChange={(e) => setSearchUid(e.target.value)}
            disabled={fetchLoading || actionLoading}
            className={styles.searchInput}
            required
          />
          <button
            type="submit"
            disabled={fetchLoading || actionLoading}
            className={styles.searchBtn}
          >
            {fetchLoading ? <span className={styles.btnSpinner} /> : '検索'}
          </button>
        </form>
      </section>

      {/* 検索結果およびリセットフォーム (Req 2.1, 3.1, 3.2, 3.3) */}
      {searchedUser && (
        <div className={styles.resultContainer}>
          <section className={styles.userCard}>
            <div className={styles.cardHeader}>
              <img
                src={searchedUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${searchedUser.id}`}
                alt={searchedUser.displayName}
                className={styles.avatar}
              />
              <div className={styles.userInfo}>
                <h3 className={styles.userName}>{searchedUser.displayName}</h3>
                <p className={styles.userUid}>UID: {searchedUser.id}</p>
                <div className={styles.userStatus}>
                  {searchedUser.deleteStatus === 'delete_pending' ? (
                    <span className={`${styles.statusBadge} ${styles.deleted}`}>退会申請中</span>
                  ) : (
                    <span className={`${styles.statusBadge} ${styles.active}`}>アクティブ</span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.cardBody}>
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>現在の信頼スコア</span>
                  <span className={styles.metaValue}>{searchedUser.reputationScore ?? 0} pt</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>現在の権限ティアー</span>
                  <span className={styles.metaValue}>{getTierLabel(searchedUser.moderationTier)}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>公開クイズ数</span>
                  <span className={styles.metaValue}>{searchedUser.createdQuizzesCount ?? 0}</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>総プレイ回数</span>
                  <span className={styles.metaValue}>{searchedUser.totalPlayCount ?? 0}</span>
                </div>
              </div>
            </div>
          </section>

          {/* リセット実行フォーム */}
          <section className={styles.resetSection}>
            <h2 className={styles.resetTitle}>評判スコア・権限ティアーの初期化</h2>
            <p className={styles.resetWarning}>
              【注意】この操作を実行すると、対象ユーザーの信頼スコアは <strong>0</strong> に、モデレーター権限ティアーは <strong>Newcomer</strong> に強制リセットされます。実行履歴は監査ログとして保存されます。
            </p>
            <form onSubmit={handleReset} className={styles.resetForm}>
              <div className={styles.formGroup}>
                <label htmlFor="resetReason" className={styles.formLabel}>
                  リセット理由（10文字以上必須）
                </label>
                <textarea
                  id="resetReason"
                  placeholder="ユーザーに評判スコアをリセットするに至った具体的な理由を入力してください..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={actionLoading}
                  className={styles.reasonTextarea}
                  rows={4}
                  required
                />
                <span className={styles.charCount}>
                  現在の文字数: {reason.length} 文字
                </span>
              </div>
              <button
                type="submit"
                id="execute-reset-btn"
                disabled={actionLoading || reason.length < 10}
                className={styles.resetBtn}
              >
                {actionLoading ? (
                  <>
                    <span className={styles.btnSpinner} /> 処理中...
                  </>
                ) : (
                  '🚨 評判と権限を緊急リセットする'
                )}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* 検索したが見つからなかった場合 */}
      {hasSearched && !searchedUser && !fetchLoading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p>指定されたUIDのユーザーが見つかりませんでした。入力されたUIDが正しいかご確認ください。</p>
        </div>
      )}
    </div>
  );
}
