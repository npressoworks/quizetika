/**
 * タグ/ジャンルマージリクエスト画面
 *
 * 機能:
 * - moderator 以上のクライアントサイドアクセスガード
 * - 「提案起案」タブ: マージ提案フォーム（ソース → ターゲット）
 * - 「投票一覧」タブ: 保留中マージリクエストのカード表示
 * - ソースタグクリックで対応リスト画面を別ウィンドウで開く
 * - 賛成👍 / 反対👎 投票（シニアモデレータは重みx2バッジ表示）
 * - weightedVotesFor / weightedVotesAgainst に基づくリアルタイムプログレスバー
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 * Boundary: CommunityMerge, CommunityMerge-Vote
 */
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  updateDoc,
  increment,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/context/auth-context';
import { createMergeRequest, voteMergeRequest } from '@/services/tagMerge';
import styles from './merge.module.css';

/** マージリクエストの型定義 */
interface MergeRequest {
  id: string;
  targetType: 'tag' | 'genre';
  sourceId: string;
  targetId: string;
  requesterId: string;
  requesterName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  votesForCount: number;
  votesAgainstCount: number;
  weightedVotesFor: number;
  weightedVotesAgainst: number;
  votedUserIds: string[];
  createdAt: Date | Timestamp;
}

type TabType = 'propose' | 'votes';

export default function CommunityMergePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('votes');
  const [mergeRequests, setMergeRequests] = useState<MergeRequest[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // フォーム状態
  const [formSourceId, setFormSourceId] = useState('');
  const [formTargetId, setFormTargetId] = useState('');
  const [formType, setFormType] = useState<'tag' | 'genre'>('tag');
  const [formReasoning, setFormReasoning] = useState('');

  // -------------------------------------------------------------------
  // クライアントサイドアクセスガード (Req 2.1)
  // -------------------------------------------------------------------
  const TIER_RANK: Record<string, number> = {
    newcomer: 0,
    contributor: 1,
    moderator: 2,
    senior_moderator: 3,
  };

  const isAuthorized =
    !!user && (TIER_RANK[user.moderationTier] ?? 0) >= TIER_RANK.moderator;

  const isSeniorModerator = user?.moderationTier === 'senior_moderator';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/community/merge');
      return;
    }
    if (!loading && user && !isAuthorized) {
      router.push('/not-found');
    }
  }, [user, loading, isAuthorized, router]);

  // -------------------------------------------------------------------
  // 保留中マージリクエストのリアルタイム取得 (Req 2.3)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isAuthorized) return;

    setFetchLoading(true);
    const q = query(
      collection(db, 'mergeRequests'),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as MergeRequest));
        setMergeRequests(requests);
        setFetchLoading(false);
      },
      (err) => {
        console.error('マージリクエスト取得エラー:', err);
        setErrorMessage('マージリクエストの読み込みに失敗しました。');
        setFetchLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isAuthorized]);

  // -------------------------------------------------------------------
  // マージ提案の起案送信 (Req 2.2)
  // -------------------------------------------------------------------
  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formSourceId.trim() || !formTargetId.trim()) return;

    setSubmitLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await createMergeRequest(
        formSourceId.trim(),
        formTargetId.trim(),
        formType,
        formReasoning,
        user.id
      );
      setSuccessMessage(
        `「${formSourceId}」→「${formTargetId}」のマージ提案を起案しました。`
      );
      setFormSourceId('');
      setFormTargetId('');
      setFormReasoning('');
      setActiveTab('votes');
    } catch (err) {
      console.error('起案失敗:', err);
      setErrorMessage('マージ提案の送信に失敗しました。');
    } finally {
      setSubmitLoading(false);
    }
  };

  // -------------------------------------------------------------------
  // 賛否投票 (Req 2.5, 2.6)
  // -------------------------------------------------------------------
  const handleVote = async (
    mergeRequestId: string,
    vote: 'approve' | 'reject'
  ) => {
    if (!user) return;

    setVoteLoading(mergeRequestId + vote);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await voteMergeRequest(mergeRequestId, user.id, vote);
      setSuccessMessage(
        vote === 'approve' ? '👍 賛成票を投じました。' : '👎 反対票を投じました。'
      );
    } catch (err) {
      console.error('投票失敗:', err);
      setErrorMessage('投票に失敗しました。');
    } finally {
      setVoteLoading(null);
    }
  };

  // -------------------------------------------------------------------
  // ソースタグ/ジャンル一覧を別ウィンドウで開く (Req 2.4)
  // -------------------------------------------------------------------
  const openSourceList = (sourceId: string, type: 'tag' | 'genre') => {
    const path = type === 'tag' ? `/tags/${sourceId}` : `/genres/${sourceId}`;
    window.open(path, '_blank');
  };

  // -------------------------------------------------------------------
  // 賛成率計算 (Req 2.7)
  // -------------------------------------------------------------------
  const calcApprovalRate = (req: MergeRequest): number => {
    const totalWeighted = req.weightedVotesFor + req.weightedVotesAgainst;
    if (totalWeighted === 0) return 0;
    return Math.round((req.weightedVotesFor / totalWeighted) * 100);
  };

  // ローディング
  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>読み込んでいます...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className={styles.pageContainer}>
      {/* ページヘッダー */}
      <header className={styles.pageHeader}>
        <div className={styles.headerBadge}>🔀 モデレータ専用</div>
        <h1 className={styles.pageTitle}>タグ / ジャンル マージリクエスト</h1>
        <p className={styles.pageSubtitle}>
          表記揺れのタグやジャンルを統合するマージ提案を起案・投票できます。
        </p>
        {isSeniorModerator && (
          <div className={styles.seniorBadge}>
            ⚡ シニアモデレータ — 投票の重み: <strong>x2</strong>
          </div>
        )}
      </header>

      {/* フィードバックメッセージ */}
      {successMessage && (
        <div className={styles.alertSuccess}>✅ {successMessage}</div>
      )}
      {errorMessage && (
        <div className={styles.alertError}>⚠️ {errorMessage}</div>
      )}

      {/* タブナビゲーション */}
      <div className={styles.tabNav}>
        <button
          id="tab-votes"
          className={`${styles.tabBtn} ${activeTab === 'votes' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('votes')}
        >
          📋 投票一覧
          {mergeRequests.length > 0 && (
            <span className={styles.tabBadge}>{mergeRequests.length}</span>
          )}
        </button>
        <button
          id="tab-propose"
          className={`${styles.tabBtn} ${activeTab === 'propose' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('propose')}
        >
          ✏️ 提案起案
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className={styles.tabContent}>
        {/* ============================================================
            投票一覧タブ (Req 2.3, 2.4, 2.5, 2.6, 2.7)
            ============================================================ */}
        {activeTab === 'votes' && (
          <div className={styles.votesTab}>
            {fetchLoading ? (
              <div className={styles.loadingInner}>
                <div className={styles.spinner} />
              </div>
            ) : mergeRequests.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🌿</div>
                <p>現在、保留中のマージ提案はありません。</p>
              </div>
            ) : (
              <div className={styles.requestList}>
                {mergeRequests.map((req) => {
                  const approvalRate = calcApprovalRate(req);
                  return (
                    <div key={req.id} className={styles.requestCard}>
                      {/* リクエストヘッダー */}
                      <div className={styles.requestHeader}>
                        <span className={styles.requestTypeBadge}>
                          {req.targetType === 'tag' ? '🏷️ タグ' : '🎭 ジャンル'}
                        </span>
                        <span className={styles.requestDate}>
                          {req.createdAt instanceof Timestamp
                            ? req.createdAt.toDate().toLocaleDateString('ja-JP')
                            : req.createdAt instanceof Date
                            ? req.createdAt.toLocaleDateString('ja-JP')
                            : ''}
                        </span>
                      </div>
 
                      {/* マージ方向表示 (Req 2.4: ソースクリックで別ウィンドウ) */}
                      <div className={styles.mergeDirection}>
                        <button
                          className={styles.sourceLink}
                          onClick={() => openSourceList(req.sourceId, req.targetType)}
                          title="クリックして一覧を別ウィンドウで開く"
                        >
                          {req.sourceId}
                          <span className={styles.externalIcon}>↗</span>
                        </button>
                        <span className={styles.mergeArrow}>→</span>
                        <span className={styles.targetLabel}>{req.targetId}</span>
                      </div>

                      {/* プログレスバー (Req 2.7) */}
                      <div className={styles.progressSection}>
                        <div className={styles.progressHeader}>
                          <span className={styles.progressLabel}>賛成率</span>
                          <span className={styles.progressValue}>
                            {approvalRate}%
                          </span>
                        </div>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{ width: `${approvalRate}%` }}
                          />
                        </div>
                        <div className={styles.voteWeights}>
                          <span className={styles.voteFor}>
                            👍 {req.weightedVotesFor}
                          </span>
                          <span className={styles.voteAgainst}>
                            👎 {req.weightedVotesAgainst}
                          </span>
                          <span className={styles.voteTotal}>
                            合計重み: {req.weightedVotesFor + req.weightedVotesAgainst}
                          </span>
                        </div>
                      </div>

                      {/* 投票ボタン (Req 2.5, 2.6) */}
                      <div className={styles.voteActions}>
                        {isSeniorModerator && (
                          <span className={styles.weightBadge}>
                            ⚡ 投票の重み: x2
                          </span>
                        )}
                        <div className={styles.voteBtns}>
                          <button
                            id={`vote-approve-${req.id}`}
                            className={`${styles.voteBtn} ${styles.voteApproveBtn}`}
                            onClick={() => handleVote(req.id, 'approve')}
                            disabled={voteLoading !== null}
                          >
                            {voteLoading === req.id + 'approve' ? (
                              <span className={styles.btnSpinner} />
                            ) : (
                              '👍 賛成'
                            )}
                          </button>
                          <button
                            id={`vote-reject-${req.id}`}
                            className={`${styles.voteBtn} ${styles.voteRejectBtn}`}
                            onClick={() => handleVote(req.id, 'reject')}
                            disabled={voteLoading !== null}
                          >
                            {voteLoading === req.id + 'reject' ? (
                              <span className={styles.btnSpinner} />
                            ) : (
                              '👎 反対'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            提案起案タブ (Req 2.2)
            ============================================================ */}
        {activeTab === 'propose' && (
          <div className={styles.proposeTab}>
            <div className={styles.formCard}>
              <h2 className={styles.formTitle}>マージ提案を起案する</h2>
              <p className={styles.formDescription}>
                統合を提案するソースと統合先ターゲットを入力し、理由を記載してください。
              </p>
              <form onSubmit={handlePropose} className={styles.proposeForm}>
                {/* タイプ選択 */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>対象タイプ</label>
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="type"
                        value="tag"
                        checked={formType === 'tag'}
                        onChange={() => setFormType('tag')}
                      />
                      🏷️ タグ
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="type"
                        value="genre"
                        checked={formType === 'genre'}
                        onChange={() => setFormType('genre')}
                      />
                      🎭 ジャンル
                    </label>
                  </div>
                </div>

                {/* ソースID */}
                <div className={styles.formGroup}>
                  <label htmlFor="sourceId" className={styles.formLabel}>
                    ソース（統合される側）
                  </label>
                  <input
                    id="sourceId"
                    type="text"
                    className={styles.formInput}
                    placeholder="例: javascipt（表記揺れ）"
                    value={formSourceId}
                    onChange={(e) => setFormSourceId(e.target.value)}
                    required
                  />
                </div>

                {/* ターゲットID */}
                <div className={styles.formGroup}>
                  <label htmlFor="targetId" className={styles.formLabel}>
                    ターゲット（統合先の正規名）
                  </label>
                  <input
                    id="targetId"
                    type="text"
                    className={styles.formInput}
                    placeholder="例: javascript（正規）"
                    value={formTargetId}
                    onChange={(e) => setFormTargetId(e.target.value)}
                    required
                  />
                </div>

                {/* 理由 */}
                <div className={styles.formGroup}>
                  <label htmlFor="reasoning" className={styles.formLabel}>
                    統合の理由
                  </label>
                  <textarea
                    id="reasoning"
                    className={styles.formTextarea}
                    placeholder="なぜこのマージが必要か、根拠を説明してください。"
                    value={formReasoning}
                    onChange={(e) => setFormReasoning(e.target.value)}
                    rows={4}
                  />
                </div>

                <button
                  type="submit"
                  id="submit-propose-btn"
                  className={styles.submitBtn}
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <span className={styles.btnSpinner} /> 送信中...
                    </>
                  ) : (
                    '🚀 マージ提案を起案する'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
