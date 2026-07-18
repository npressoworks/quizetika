/**
 * クイズ投稿SNS「quizetika」共通型定義
 */

import type { SubscriptionStatus, SubscriptionTier } from './subscription';

export type { SubscriptionTier, SubscriptionStatus } from './subscription';

// 1. ユーザー情報 (Users)
export interface User {
  id: string;             // Firebase Auth の uid
  email: string;
  displayName: string;
  avatarUrl: string;
  bio: string;            // 自己紹介
  followedGenres: string[]; // フォロー中のジャンル名の配列
  badges: Badge[];        // 獲得した称号バッジ配列
  createdQuizzesCount: number; // 作成した公開クイズ数
  totalPlayCount: number; // 累計プレイ回数
  followersCount: number; // フォロワー数
  followingCount: number; // フォローしている数
  reputationScore: number; // 信頼スコア
  totalReactionsCount?: number; // 累計獲得リアクション数
  moderationTier: 'newcomer' | 'contributor' | 'moderator' | 'senior_moderator'; // 権限ティアー（管理者は role または tier の 'admin'）
  role?: string; // システム管理者など特権ロール（Supabase 上の任意フィールド）
  reputationHistory: ReputationEventLog[]; // スコア変動履歴 (直近30件)
  lastReputationCalculatedAt: Date | null; // 変動バッチ計算日時
  totalFailedQuestionsCount: number; // 未復習の間違い問題の総数
  deleteStatus: 'active' | 'delete_pending' | 'deleted'; // 退会状態
  isBanned?: boolean;      // BANフラグ
  bannedReason?: string;   // BAN理由
  bannedAt?: Date;         // BAN日時
  subscriptionTier?: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: Date;
  snsLinks?: {
    youtube?: string;
    x?: string;
    instagram?: string;
    tiktok?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  unlockedAt: Date;
}

export interface ReputationEventLog {
  eventId: string;
  delta: number;
  reason: string;
  createdAt: Date;
}

// 2. 選択肢 (Choice)
export interface Choice {
  id: string;             // 選択肢ID (UUIDまたは連番)
  choiceText: string;
  isCorrect: boolean;     // 正解フラグ
  selectedCount: number;  // 選択された累計回数
}

// 並び替え要素 (SortingItem)
export interface SortingItem {
  id: string;
  text: string;
  correctOrder: number;
}

/** 記述式問題の入力タイプ */
export type TextInputMode = 'free' | 'kanji' | 'katakana' | 'alphabet' | 'numeric';

/** エディタ送信用: 参照リンク問題か新規/所有問題か（Supabase 永続化フィールドは必須ではない） */
export type QuestionLinkKind = 'owned' | 'reference';

// 3. 問題 (Question)
export interface Question {
  id: string;             // 問題ID (UUIDまたは連番)
  quizId?: string;        // 属するクイズのID
  linkKind?: QuestionLinkKind;
  authorId?: string;      // 作成者のユーザーID
  authorName?: string;    // 作成者の表示名 (非正規化)
  authorAvatar?: string;  // 作成者のアバターURL (非正規化)
  type: 'true-false' | 'multiple-choice' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking'; // 問題タイプ
  questionText: string;
  explanation: string;    // 正解後の解説
  imageUrl: string | null; // 参考画像URL
  hint: string | null;    // ヒントテキスト
  limitTime: number | null; // 制限秒数
  correctTextAnswerList?: string[]; // 短答形式の正解候補
  textInputMode?: TextInputMode; // 記述式の入力タイプ（通常/数値/文字数指定）
  textInputCharCount?: number; // 文字数指定時の要求文字数
  choices?: Choice[];      // 選択肢リスト
  sortingItems?: SortingItem[]; // 並び替え要素
  associationHints?: string[]; // 連想ヒント
  aiContextDetails?: string; // ウミガメのスープ用裏設定
  truthKeywords?: string[]; // ウミガメのスープ用必須正解キーワード
  sourceUrl?: string | null; // 出典・参考URLリンク
  correctCount: number;   // 正解した累計回数
  incorrectCount: number; // 不正解だった累計回数
  bookmarksCount?: number; // 問題単体がブックマーク登録された総数
}

export interface LeaderboardRecord {
  userId: string;
  displayName: string;
  score: number;
  elapsedSeconds: number;
  completedAt: Date;
}

/** ログインユーザー自身のリーダーボード記録1件（順位付き。Phase 38） */
export interface LeaderboardSelfEntry extends LeaderboardRecord {
  rank: number;
}

/** 公開済みクイズの閲覧範囲（未設定は public として後方互換） */
export type QuizVisibility = 'public' | 'private' | 'followers';

// 4. クイズ (Quiz)
export interface Quiz {
  id: string;             // クイズID (Supabase の id カラム)
  authorId: string;       // 作成者のユーザーID
  authorName: string;     // 作成者の表示名 (非正規化)
  authorAvatar: string;   // 作成者のアバターURL (非正規化)
  title: string;
  description: string;
  thumbnailUrl: string | null;
  difficulty: number;     // 1〜5の整数
  genre: string;          // ジャンル (例: 'programming', 'history' など)
  tags: string[];         // 標準化されたタグの配列
  originalTags: string[]; // 入力された生のタグの配列
  questionIds: string[];  // 問題ドキュメントのID配列 (順序保持)
  questions: Question[];  // 問題の配列 (表示高速化用・非正規化コピー)
  questionCount: number;  // 問題数
  status: 'draft' | 'published' | 'suspended'; // ステータス
  /** 公開範囲（published 時のみ有効。未設定は public） */
  visibility?: QuizVisibility;
  flagsCount: number;     // 累計通報数
  playCount: number;      // 挑戦回数
  bookmarksCount: number; // ブックマークされている数
  positiveCount: number;  // 良問(👍)投票数
  negativeCount: number;  // 悪問(👎)投票数
  tempPositiveCount: number; // 再評価仮リセット期間中の👍数
  tempNegativeCount: number; // 再評価仮リセット期間中の👎数
  reviewScore: number | null; // 良問率
  reviewBadge: string | null; // 評価バッジ名
  isReviewMasked: boolean; // 評価マスク状態
  activeResetRequestId: string | null; // 申請中の評価リセットID
  /** 書き込み時解決: マージ後の正規ジャンルID（検索・一覧用。表示用 `genre` は変更しない） */
  canonicalGenreId: string;
  /** 書き込み時解決: 各タグの正規ID（`tags` と対称。`array-contains` 検索用） */
  canonicalTagIds: string[];
  /** @deprecated 読み取り互換。書き込みは leaderboardFirstPlay / leaderboardReplay */
  leaderboard?: LeaderboardRecord[];
  leaderboardFirstPlay: LeaderboardRecord[];
  leaderboardReplay: LeaderboardRecord[];
  format?: 'mixed' | 'multiple-choice' | 'true-false' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking'; // クイズ全体の形式
  createdAt: Date;
  updatedAt: Date;
}

// 5. フォロー関係 (Follow)
export interface Follow {
  followerId: string;     // フォローした側 (ログイン中ユーザー、複合主キーの一部)
  followingId: string;    // フォローされた側 (ターゲット、複合主キーの一部)
  createdAt: Date;
}

// 7. ブックマーク (Bookmark)
export interface Bookmark {
  userId: string;         // ブックマークしたユーザー (複合主キーの一部)
  targetId: string;       // クイズID、リストID、または問題ID (複合主キーの一部)
  targetType: 'quiz' | 'question'; // 対象のタイプ (複合主キーの一部)
  createdAt: Date;
}

export interface AiQuestion {
  id: string;
  questionText: string;
  answerType: 'yes' | 'no' | 'irrelevant' | 'unknown';
  aiComment?: string;
  isFromCache: boolean;
  createdAt: Date;
}

export interface AiTruthAttempt {
  id: string;
  truthText: string;
  isCorrect: boolean;
  aiFeedback: string;
  createdAt: Date | any; // Supabase の jsonb 配列格納を考慮
}

// クイズ挑戦結果 (APIやローカル再生の記録用)
export interface QuestionAnswerRecord {
  questionId: string;
  userAnswer: string;
}

/**
 * 問題ごとの詳細な解答行動データ（すべての問題形式に対応）
 */
export interface QuestionAnswerDetail {
  questionId: string;
  questionType: 'true-false' | 'multiple-choice' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking';
  isCorrect: boolean;
  elapsedSeconds: number;                // この問題の解答にかかった時間（秒、小数点を含む）
  hintsUsedCount: number;                // 使用したヒント数

  // 1. 選択式・真偽値クイズ用 (multiple-choice, true-false)
  selectedChoiceId?: string | null;      // 選択した選択肢ID
  choicesOrder?: string[] | null;        // 提示された選択肢IDのシャッフル順
  choicesInteractionsCount?: number;     // 決定までに選択肢をクリック・変更した回数

  // 2. 記述式・短答・早押しクイズ用 (text-input, quick-press, association)
  userAnswer?: string | null;            // 入力された回答文字列（記述・短答・連想用）
  quickPressSeconds?: number | null;     // 早押しボタンを押すまでの経過時間

  // 3. 並び替えクイズ用 (sorting)
  initialItemOrder?: string[] | null;    // 提示時の初期アイテム順
  finalItemOrder?: string[] | null;      // ユーザーが決定した最終アイテム順

  // 4. 水平思考クイズ用 (lateral-thinking)
  aiTurnCount?: number | null;           // 質問ターン数
  truthSummary?: string | null;          // 真相解答の最終テキスト
  lateralPlayEndedStatus?: 'passed' | 'gave_up' | null; // 合格/リタイアのステータス
  answerChanged?: boolean;               // 回答変更有無
}

export interface Attempt {
  id: string;
  userId: string;
  quizId: string;
  listId?: string | null;
  /**
   * プレイモード。
   * `question-list`: 問題リスト連続プレイ（問題ごとに1 attempt、`listId` + 親 `quizId`、`totalQuestions: 1`）
   * `my-quiz`: カスタムクイズ連続プレイ（問題ごとに1 attempt、親 `quizId`、`totalQuestions: 1`。`listId` は不要）
   */
  mode:
  | 'normal'
  | 'exam'
  | 'flashcard'
  | 'review'
  | 'list'
  | 'question-list'
  | 'my-quiz'
  | 'test-play';
  /** カスタムクイズセッション ID（`my-quiz` モード時のみ任意付与） */
  sessionId?: string | null;
  score: number;          // 正解数
  totalQuestions: number; // 全問題数
  elapsedSeconds: number; // 経過秒数
  failedQuestionIds: string[]; // 間違えた問題ID配列
  questionAnswers?: QuestionAnswerRecord[]; // 問題ごとのユーザー回答（表示用）
  questionAnswerDetails?: QuestionAnswerDetail[]; // 各問題ごとの詳細な解答行動データ（新規追加）
  difficultyVote?: number | null; // 難易度投票値
  aiQuestionsHistory?: AiQuestion[]; // AI対話履歴
  aiTruthAttempts?: AiTruthAttempt[]; // 真相提出履歴（水平思考用）
  aiTurnCount: number;    // 質問ターン数
  aiTurnLimit: number | null; // 質問制限数
  /** 水平思考クイズの進行中セッションでは未完了のため null を取り得る */
  completedAt: Date | null;
  /** 水平思考クイズを諦めて終了した場合 true */
  gaveUpLateral?: boolean;
}

export interface PlayHistoryEntry {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  mode: Attempt['mode'];
  completedAt: Date;
  elapsedSeconds: number;
}

export interface PlayHistoryPage {
  items: PlayHistoryEntry[];
  nextCursor: string | null;
}

/** ホーム探索向け段階的取得応答 */
export interface PaginatedQuizResult {
  items: Quiz[];
  nextCursor: string | null;
}

/** ブックマークした問題1件（親クイズメタ付き） */
export interface BookmarkedQuestionEntry {
  question: Question;
  parentQuizId: string;
  parentQuizTitle: string;
  bookmarkedAt: Date;
  genreId?: string;
  difficulty?: number;
  tags?: string[];
  format?: string;
}

/** 分類ブックマーク一覧（クイズ・問題） */
export interface BookmarkFeed {
  quizzes: Quiz[];
  questions: BookmarkedQuestionEntry[];
}

const DEPRECATED_PLAY_MODES = ['list', 'question-list'] as const;

/** 新規試行保存時に廃止プレイモードを拒否する */
export function assertPlayModeAllowedForSave(mode: Attempt['mode']): void {
  if ((DEPRECATED_PLAY_MODES as readonly string[]).includes(mode)) {
    throw new Error('LIST_PLAY_MODE_DEPRECATED');
  }
}

/** カスタムクイズプレイ attempt の契約を満たすか（`sessionId` は任意） */
export function satisfiesMyQuizAttemptContract(
  attempt: Pick<Attempt, 'mode' | 'quizId' | 'totalQuestions'>
): boolean {
  return (
    attempt.mode === 'my-quiz' &&
    !!attempt.quizId &&
    attempt.totalQuestions === 1
  );
}

/** `metadata_genres` マスタ（仮想統合・ジャンル一覧） */
export interface GenreMetadata {
  id: string;
  displayName: string;
  description?: string;
  iconImageUrl: string | null;
  canonicalId: string | null;
  mergedGenreIds: string[];
  isActive: boolean;
  createdAt?: Date;
}

/** `metadata_tags` マスタ（仮想統合・タグ検索） */
export interface TagMetadata {
  id: string;
  tagName?: string;
  canonicalId: string | null;
  mergedTagIds: string[];
  createdBy?: string;
  updatedAt?: Date;
  createdAt?: Date;
}

// 8. 指摘レポート (feedbackReports)
export interface FeedbackReport {
  id: string;
  quizId: string;
  quizTitle: string;
  questionId: string | null; // 特定の問題に紐付かない「クイズ全体の指摘」は null
  questionText: string;
  selectedChoiceText?: string;
  reporterId: string;
  creatorId: string;
  category: 'typo' | 'fact' | 'alternative';
  content: string;
  status: 'open' | 'resolved' | 'rejected';
  createdAt: Date;
}

// 9. 管理者ログ (adminLogs)
export interface AdminLog {
  id?: string;
  targetUid: string;
  executorId: string;
  action: 'reputation_reset' | 'ban' | 'unban';
  reason?: string;
  createdAt: Date;
}

// 9.1 ユーザー通報 (user_reports)
export type UserReportCategory = 'harassment' | 'impersonation' | 'spam' | 'other';

export interface UserReport {
  id: string;
  reporterId: string;
  targetUid: string;
  category: UserReportCategory;
  detail: string;
  status: 'open' | 'resolved' | 'rejected';
  createdAt: Date;
}

/** 通報ランキング表示用サマリー（`get_reported_users_ranking` RPC戻り値対応） */
export interface ReportedUserSummary {
  uid: string;
  displayName: string;
  moderationTier: 'newcomer' | 'contributor' | 'moderator' | 'senior_moderator';
  isBanned: boolean;
  totalReportCount: number;
  latestReportAt: string;
}

/** BAN済みユーザー一覧表示用サマリー（`get_banned_users` RPC戻り値対応） */
export interface BannedUserSummary {
  uid: string;
  displayName: string;
  bannedReason: string | null;
  bannedAt: string;
  bannedByExecutorId: string | null;
}

/** 対象ユーザーの管理者ログ履歴1件（`get_user_admin_logs` RPC戻り値対応） */
export interface AdminLogEntry {
  id: string;
  action: 'reputation_reset' | 'ban' | 'unban' | 'tier_downgrade' | 'report_reset';
  executorId: string | null;
  reason: string | null;
  createdAt: string;
}

// 10. 運営からのお知らせ (announcements)
export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'info' | 'maintenance' | 'update' | 'bug' | 'important';
  status: 'draft' | 'published';
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
}

export interface QuizExportPackage {
  exportedAt: string;
  quizzes: Quiz[];
}

export * from './dashboard';



