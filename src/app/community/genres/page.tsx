/**
 * ジャンル新設申請・投票画面
 *
 * 機能:
 * - 認証ユーザー向け「申請フォーム」タブ: 英語ID・日本語名・PNG/JPEG/GIFアイコン（SVG不可、最大2MB）
 * - モデレータ以上向け「投票」タブ: 保留中ジャンル申請への賛否投票
 * - 可決条件達成時のシステム自動反映と成功アラート表示
 * - 「承認・否決履歴」タブ: 完了済み申請の閲覧
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 * Boundary: CommunityGenres-Request, CommunityGenres-Vote
 */
'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import {
  submitGenreRequest,
  voteGenreRequest,
} from '@/services/tagMerge';
import { uploadImage, getGenreIconPath } from '@/services/storage';
import styles from './genres.module.css';
import {
  validateGenreIconFile,
  GENRE_ICON_ACCEPT,
} from '@/lib/genre-icon-upload';

/** ジャンル申請の型定義 */
interface GenreRequest {
  id: string;
  genreId: string;
  displayName: string;
  iconImageUrl: string;
  requesterId: string;
  votesForCount: number;
  votesAgainstCount: number;
  weightedVotesFor: number;
  weightedVotesAgainst: number;
  votedUserIds: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date | Timestamp;
}

type TabType = 'request' | 'vote' | 'history';

export default function CommunityGenresPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('request');
  const [pendingRequests, setPendingRequests] = useState<GenreRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<GenreRequest[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [autoApprovalAlert, setAutoApprovalAlert] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // フォーム状態
  const [formGenreId, setFormGenreId] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formIconFile, setFormIconFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------
  // 権限チェック
  // -------------------------------------------------------------------
  const TIER_RANK: Record<string, number> = {
    newcomer: 0,
    contributor: 1,
    moderator: 2,
    senior_moderator: 3,
  };

  const isModerator = !!user && (TIER_RANK[user.moderationTier] ?? 0) >= TIER_RANK.moderator;
  const isSeniorModerator = user?.moderationTier === 'senior_moderator';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/community/genres');
    }
  }, [user, loading, router]);

  // -------------------------------------------------------------------
  // 保留中ジャンル申請のリアルタイム取得 (Req 3.2)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'genreRequests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as GenreRequest));
      setPendingRequests(requests);
    });

    return () => unsubscribe();
  }, [user]);

  // -------------------------------------------------------------------
  // 履歴データの取得 (Req 3.5)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (activeTab !== 'history' || !user) return;

    setFetchLoading(true);
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'genreRequests'),
          where('status', 'in', ['approved', 'rejected']),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setHistoryRequests(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as GenreRequest))
        );
      } catch (err) {
        console.error('履歴取得エラー:', err);
      } finally {
        setFetchLoading(false);
      }
    };
    fetchHistory();
  }, [activeTab, user]);

  // -------------------------------------------------------------------
  // アイコンファイル選択バリデーション (Req 3.1)
  // -------------------------------------------------------------------
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setIconError(null);
    setFormIconFile(null);
    setIconPreviewUrl(null);

    if (!file) return;

    const validation = validateGenreIconFile(file);
    if (!validation.ok) {
      setIconError(validation.error);
      return;
    }

    setFormIconFile(file);

    // プレビュー生成
    const reader = new FileReader();
    reader.onload = (ev) => setIconPreviewUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // -------------------------------------------------------------------
  // ジャンル申請フォーム送信 (Req 3.1)
  // -------------------------------------------------------------------
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formIconFile) {
      setErrorMessage('アイコン画像を選択してください。');
      return;
    }

    // genreId バリデーション（小文字・ハイフン区切り）
    if (!/^[a-z][a-z0-9-]*$/.test(formGenreId)) {
      setErrorMessage(
        'ジャンルIDは小文字の英数字とハイフンのみ使用できます（例: my-genre）。'
      );
      return;
    }

    setSubmitLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // 1. Firebase Storage にアイコンをアップロード
      // MIMEタイプから拡張子を抽出 (image/jpeg -> jpeg/jpg, image/png -> png, image/gif -> gif)
      let extension = formIconFile.type.split('/')[1] || 'png';
      if (extension === 'jpeg') extension = 'jpg';
      const path = getGenreIconPath(formGenreId, extension);
      const iconUrl = await uploadImage(formIconFile, path);

      // 2. ジャンル申請をFirestoreに保存
      await submitGenreRequest(
        formGenreId,
        formDisplayName,
        iconUrl,
        user.id
      );

      setSuccessMessage(`「${formDisplayName}」のジャンル申請を送信しました。`);
      setFormGenreId('');
      setFormDisplayName('');
      setFormIconFile(null);
      setIconPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('申請送信エラー:', err);
      setErrorMessage(err.message || '申請の送信に失敗しました。');
    } finally {
      setSubmitLoading(false);
    }
  };

  // -------------------------------------------------------------------
  // モデレータ投票 (Req 3.3, 3.4)
  // -------------------------------------------------------------------
  const handleVote = async (
    genreRequest: GenreRequest,
    vote: 'approve' | 'reject'
  ) => {
    if (!user || !isModerator) return;

    setVoteLoading(genreRequest.id + vote);
    setSuccessMessage(null);
    setErrorMessage(null);
    setAutoApprovalAlert(null);

    try {
      await voteGenreRequest(genreRequest.id, user.id, vote);
      
      const weight = user.moderationTier === 'senior_moderator' ? 2 : 1;
      const isApprove = vote === 'approve';
      const nextWeightedFor = genreRequest.weightedVotesFor + (isApprove ? weight : 0);
      const nextWeightedAgainst = genreRequest.weightedVotesAgainst + (isApprove ? 0 : weight);
      const totalWeighted = nextWeightedFor + nextWeightedAgainst;
      const approveRate = totalWeighted > 0 ? nextWeightedFor / totalWeighted : 0;

      if (nextWeightedFor >= 5 && approveRate >= 0.8) {
        setAutoApprovalAlert(
          `🎉 ジャンル「${genreRequest.displayName}」が可決され、ジャンルが追加されました！`
        );
      } else {
        setSuccessMessage(
          vote === 'approve' ? '👍 賛成票を投じました。' : '👎 反対票を投じました。'
        );
      }
    } catch (err: any) {
      console.error('投票エラー:', err);
      setErrorMessage(err.message || '投票に失敗しました。');
    } finally {
      setVoteLoading(null);
    }
  };

  // -------------------------------------------------------------------
  // 日付フォーマット
  // -------------------------------------------------------------------
  const formatDate = (date: Date | Timestamp) => {
    const d = date instanceof Timestamp ? date.toDate() : date;
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 賛成率
  const calcApprovalRate = (req: GenreRequest) => {
    const totalWeight = req.weightedVotesFor + req.weightedVotesAgainst;
    if (totalWeight === 0) return 0;
    return Math.round((req.weightedVotesFor / totalWeight) * 100);
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

  if (!user) return null;

  return (
    <div className={styles.pageContainer}>
      {/* ページヘッダー */}
      <header className={styles.pageHeader}>
        <div className={styles.headerBadge}>🎭 コミュニティ</div>
        <h1 className={styles.pageTitle}>ジャンル新設申請</h1>
        <p className={styles.pageSubtitle}>
          新しいジャンルを申請し、モデレータの投票で承認されればカタログに追加されます。
        </p>
        {isSeniorModerator && (
          <div className={styles.seniorBadge}>
            ⚡ シニアモデレータ — 投票の重み: <strong>x2</strong>
          </div>
        )}
      </header>

      {/* 自動可決アラート (Req 3.4) */}
      {autoApprovalAlert && (
        <div className={styles.alertAutoApproval}>
          {autoApprovalAlert}
        </div>
      )}

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
          id="tab-request"
          className={`${styles.tabBtn} ${activeTab === 'request' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('request')}
        >
          📝 申請フォーム
        </button>
        {isModerator && (
          <button
            id="tab-vote"
            className={`${styles.tabBtn} ${activeTab === 'vote' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('vote')}
          >
            🗳️ 投票
            {pendingRequests.length > 0 && (
              <span className={styles.tabBadge}>{pendingRequests.length}</span>
            )}
          </button>
        )}
        <button
          id="tab-history"
          className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 承認・否決履歴
        </button>
      </div>

      {/* タブコンテンツ */}
      <div className={styles.tabContent}>

        {/* ============================================================
            申請フォームタブ (Req 3.1)
            ============================================================ */}
        {activeTab === 'request' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>新ジャンルを申請する</h2>
            <p className={styles.formDescription}>
              認証済みのユーザーなら誰でもジャンル追加を申請できます。
              モデレータの投票で可決されれば自動的に追加されます。
            </p>
            <form onSubmit={handleSubmitRequest} className={styles.form}>
              {/* ジャンルID */}
              <div className={styles.formGroup}>
                <label htmlFor="genreId" className={styles.formLabel}>
                  ジャンルID（英語・小文字・ハイフン区切り）
                </label>
                <input
                  id="genreId"
                  type="text"
                  className={styles.formInput}
                  placeholder="例: japanese-history"
                  value={formGenreId}
                  onChange={(e) => setFormGenreId(e.target.value.toLowerCase())}
                  pattern="[a-z][a-z0-9\-]*"
                  required
                />
                <span className={styles.inputHint}>
                  小文字の英数字とハイフンのみ使用できます
                </span>
              </div>

              {/* 日本語表示名 */}
              <div className={styles.formGroup}>
                <label htmlFor="displayName" className={styles.formLabel}>
                  ジャンル名（日本語）
                </label>
                <input
                  id="displayName"
                  type="text"
                  className={styles.formInput}
                  placeholder="例: 日本史"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  required
                />
              </div>

              {/* アイコンアップロード */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  アイコン画像（PNG / JPEG / GIF、最大2MB）
                </label>
                <div
                  className={styles.uploadArea}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {iconPreviewUrl ? (
                    <div className={styles.iconPreview}>
                      <img src={iconPreviewUrl} alt="アイコンプレビュー" className={styles.iconPreviewImg} />
                      <span className={styles.iconPreviewName}>{formIconFile?.name}</span>
                    </div>
                  ) : (
                    <div className={styles.uploadPlaceholder}>
                      <span className={styles.uploadIcon}>🖼️</span>
                      <span className={styles.uploadText}>クリックしてファイルを選択</span>
                      <span className={styles.uploadHint}>PNG, JPEG, GIF（最大2MB）</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  id="iconFile"
                  type="file"
                  accept={GENRE_ICON_ACCEPT}
                  onChange={handleIconChange}
                  className={styles.hiddenInput}
                />
                {iconError && (
                  <span className={styles.inputError}>{iconError}</span>
                )}
              </div>

              <button
                type="submit"
                id="submit-genre-btn"
                className={styles.submitBtn}
                disabled={submitLoading || !formIconFile || !!iconError}
              >
                {submitLoading ? (
                  <>
                    <span className={styles.btnSpinner} /> アップロード中...
                  </>
                ) : (
                  '🚀 ジャンルを申請する'
                )}
              </button>
            </form>
          </div>
        )}

        {/* ============================================================
            投票タブ (Req 3.2, 3.3, 3.4)
            ============================================================ */}
        {activeTab === 'vote' && isModerator && (
          <div>
            {pendingRequests.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>✨</div>
                <p>現在、投票待ちのジャンル申請はありません。</p>
              </div>
            ) : (
              <div className={styles.requestList}>
                {pendingRequests.map((req) => {
                  const approvalRate = calcApprovalRate(req);
                  return (
                    <div key={req.id} className={styles.requestCard}>
                      {/* アイコンとジャンル情報 */}
                      <div className={styles.genreInfo}>
                        <div className={styles.genreIcon}>
                          {req.iconImageUrl ? (
                            <img src={req.iconImageUrl} alt={req.displayName} className={styles.genreIconImg} />
                          ) : (
                            <span>🎭</span>
                          )}
                        </div>
                        <div className={styles.genreDetails}>
                          <h3 className={styles.genreDisplayName}>
                            {req.displayName}
                          </h3>
                          <code className={styles.genreId}>{req.genreId}</code>
                          <span className={styles.genreDate}>
                            申請日: {formatDate(req.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* プログレスバー */}
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
                            合計: {req.weightedVotesFor + req.weightedVotesAgainst} / 可決条件: 重み5以上 & 80%以上
                          </span>
                        </div>
                      </div>

                      {/* 投票ボタン */}
                      <div className={styles.voteActions}>
                        {isSeniorModerator && (
                          <span className={styles.weightBadge}>
                            ⚡ 投票の重み: x2
                          </span>
                        )}
                        <div className={styles.voteBtns}>
                          <button
                            id={`genre-vote-approve-${req.id}`}
                            className={`${styles.voteBtn} ${styles.voteApproveBtn}`}
                            onClick={() => handleVote(req, 'approve')}
                            disabled={voteLoading !== null}
                          >
                            {voteLoading === req.id + 'approve' ? (
                              <span className={styles.btnSpinner} />
                            ) : (
                              '👍 賛成'
                            )}
                          </button>
                          <button
                            id={`genre-vote-reject-${req.id}`}
                            className={`${styles.voteBtn} ${styles.voteRejectBtn}`}
                            onClick={() => handleVote(req, 'reject')}
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
            承認・否決履歴タブ (Req 3.5)
            ============================================================ */}
        {activeTab === 'history' && (
          <div>
            {fetchLoading ? (
              <div className={styles.loadingInner}>
                <div className={styles.spinner} />
              </div>
            ) : historyRequests.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📜</div>
                <p>まだ完了したジャンル申請はありません。</p>
              </div>
            ) : (
              <div className={styles.historyList}>
                {historyRequests.map((req) => (
                  <div
                    key={req.id}
                    className={`${styles.historyCard} ${
                      req.status === 'approved'
                        ? styles.historyApproved
                        : styles.historyRejected
                    }`}
                  >
                    <div className={styles.historyIcon}>
                      {req.iconImageUrl ? (
                        <img src={req.iconImageUrl} alt={req.displayName} className={styles.genreIconImg} />
                      ) : (
                        <span>🎭</span>
                      )}
                    </div>
                    <div className={styles.historyDetails}>
                      <span className={styles.historyDisplayName}>
                        {req.displayName}
                      </span>
                      <code className={styles.historyGenreId}>{req.genreId}</code>
                      <span className={styles.historyDate}>
                        {formatDate(req.createdAt)}
                      </span>
                    </div>
                    <div
                      className={`${styles.historyStatus} ${
                        req.status === 'approved'
                          ? styles.statusApproved
                          : styles.statusRejected
                      }`}
                    >
                      {req.status === 'approved' ? '✅ 承認' : '❌ 否決'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
