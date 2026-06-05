/**
 * クイズ投稿SNS「quizeum」共通型定義
 */

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
  role?: string; // システム管理者など特権ロール（Firestore 上の任意フィールド）
  reputationHistory: ReputationEventLog[]; // スコア変動履歴 (直近30件)
  lastReputationCalculatedAt: Date | null; // 変動バッチ計算日時
  totalFailedQuestionsCount: number; // 未復習の間違い問題の総数
  deleteStatus: 'active' | 'delete_pending'; // 退会状態
  isBanned?: boolean;      // BANフラグ
  bannedReason?: string;   // BAN理由
  bannedAt?: Date;         // BAN日時
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
export type TextInputMode = 'text' | 'numeric' | 'char-count';

/** クイズリストの種別（未設定は読み取り時 `quiz` として扱う） */
export type QuizListType = 'quiz' | 'question';

/** エディタ送信用: 参照リンク設問か新規/所有設問か（Firestore 永続化フィールドは必須ではない） */
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
  bookmarksCount?: number; // 設問単体がブックマーク登録された総数
}

export interface LeaderboardRecord {
  userId: string;
  displayName: string;
  score: number;
  elapsedSeconds: number;
  completedAt: Date;
}

// 4. クイズ (Quiz)
export interface Quiz {
  id: string;             // クイズID (FirestoreドキュメントID)
  authorId: string;       // 作成者のユーザーID
  authorName: string;     // 作成者の表示名 (非正規化)
  authorAvatar: string;   // 作成者のアバターURL (非正規化)
  title: string;
  description: string;
  thumbnailUrl: string | null;
  difficulty: number;     // 1〜10の整数
  genre: string;          // ジャンル (例: 'programming', 'history' など)
  tags: string[];         // 標準化されたタグの配列
  originalTags: string[]; // 入力された生のタグの配列
  questionIds: string[];  // 設問ドキュメントのID配列 (順序保持)
  questions: Question[];  // 問題の配列 (表示高速化用・非正規化コピー)
  questionCount: number;  // 問題数
  status: 'draft' | 'published' | 'suspended'; // ステータス
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
  format?: 'mixed' | 'multiple-choice' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking'; // クイズ全体の形式
  createdAt: Date;
  updatedAt: Date;
}

// 5. リスト (QuizList)
export interface QuizList {
  id: string;             // リストID (FirestoreドキュメントID)
  authorId: string;       // 作成者のユーザーID
  authorName: string;     // 作成者の表示名 (非正規化)
  authorAvatar: string;   // 作成者のアバターURL (非正規化)
  title: string;
  description: string;
  coverImageUrl?: string; // カバー画像URL
  quizIds: string[];      // 含まれるクイズIDの配列
  questionIds: string[];  // 含まれる設問IDの配列
  /** リスト種別。既存ドキュメント未設定時は `quiz` として解釈 */
  listType?: QuizListType;
  isPublished: boolean;   // 公開フラグ
  bookmarksCount: number; // ブックマークされている数
  createdAt: Date;
  updatedAt: Date;
}

// 6. フォロー関係 (Follow)
export interface Follow {
  id: string;             // followerId_followingId の形式
  followerId: string;     // フォローした側 (ログイン中ユーザー)
  followingId: string;    // フォローされた側 (ターゲット)
  createdAt: Date;
}

// 7. ブックマーク (Bookmark)
export interface Bookmark {
  id: string;             // userId_targetId の形式
  userId: string;         // ブックマークしたユーザー
  targetId: string;       // クイズID、リストID、または設問ID
  targetType: 'quiz' | 'list' | 'question'; // 対象のタイプ
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

// クイズ挑戦結果 (APIやローカル再生の記録用)
export interface QuestionAnswerRecord {
  questionId: string;
  userAnswer: string;
}

export interface Attempt {
  id: string;
  userId: string;
  quizId: string;
  listId?: string | null;
  /**
   * プレイモード。
   * `question-list`: 設問リスト連続プレイ（設問ごとに1 attempt、`listId` + 親 `quizId`、`totalQuestions: 1`）
   */
  mode: 'normal' | 'exam' | 'flashcard' | 'review' | 'list' | 'question-list' | 'test-play';
  score: number;          // 正解数
  totalQuestions: number; // 全問題数
  elapsedSeconds: number; // 経過秒数
  failedQuestionIds: string[]; // 間違えた問題ID配列
  questionAnswers?: QuestionAnswerRecord[]; // 設問ごとのユーザー回答（表示用）
  difficultyVote?: number | null; // 難易度投票値
  aiQuestionsHistory?: AiQuestion[]; // AI対話履歴
  aiTurnCount: number;    // 質問ターン数
  aiTurnLimit: number | null; // 質問制限数
  completedAt: Date;
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

/** ブックマークした設問1件（親クイズメタ付き） */
export interface BookmarkedQuestionEntry {
  question: Question;
  parentQuizId: string;
  parentQuizTitle: string;
  bookmarkedAt: Date;
}

/** 分類ブックマーク一覧（クイズ・リスト・設問） */
export interface BookmarkFeed {
  quizzes: Quiz[];
  lists: QuizList[];
  questions: BookmarkedQuestionEntry[];
}

/** 既存リストの listType 未設定をクイズリストとして解釈 */
export function resolveListType(list: Pick<QuizList, 'listType'>): QuizListType {
  return list.listType ?? 'quiz';
}

/** 設問リストプレイ attempt の契約を満たすか */
export function satisfiesQuestionListAttemptContract(
  attempt: Pick<Attempt, 'mode' | 'listId' | 'quizId' | 'totalQuestions'>
): boolean {
  return (
    attempt.mode === 'question-list' &&
    !!attempt.listId &&
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
  questionId: string;
  questionText: string;
  selectedChoiceText?: string;
  reporterId: string;
  creatorId: string;
  category: 'typo' | 'fact' | 'alternative';
  content: string;
  status: 'open' | 'resolved';
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

