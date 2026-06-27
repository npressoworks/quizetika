/**
 * 解答セッション保護およびオフライン自動同期モジュール
 *
 * 機能:
 * 1. LocalAttemptSession  - プレイ中の進捗を localStorage に永続化（リロード離脱防止）
 * 2. PendingSyncAttempt   - オフライン完了した結果を localStorage に退避し、
 *                          オンライン復帰時にバッチ同期する
 *
 * Boundary: AttemptService (Task 2.3)
 * Requirements: 3.2, 3.3
 */

import { Attempt, QuestionAnswerRecord, QuestionAnswerDetail } from '../types';

/* ==========================================================================
   定数 / キー設計
   ========================================================================== */

/** セッション保存キーのプレフィックス。クイズIDとユーザーIDで一意になる */
export const ATTEMPT_SESSION_KEY_PREFIX = 'quizetika_session_';

/** 未同期Attempt一覧を保存するキー */
export const PENDING_SYNC_KEY = 'quizetika_pending_sync';

/* ==========================================================================
   型定義
   ========================================================================== */

/**
 * プレイ中の進捗データ（localStorage に保存するシリアライズ対象）
 */
export interface PlayProgressData {
  /** クイズID */
  quizId: string;
  /** プレイヤーのユーザーID */
  userId: string;
  /** プレイモード */
  mode: Attempt['mode'];
  /** セッション開始時刻 (ISO 8601 文字列) */
  startedAt: string;
  /** 回答済み問題のIDリスト（順序保持） */
  answeredQuestionIds: string[];
  /** 不正解だった問題IDリスト */
  failedQuestionIds: string[];
  /** 問題ごとのユーザー回答 */
  questionAnswers?: Record<string, string>;
  /** 問題ごとの詳細な解答行動データ（新規追加） */
  questionAnswerDetails?: QuestionAnswerDetail[];
  /** 現在の正解数 */
  currentScore: number;
  /** 全問題数 */
  totalQuestions: number;
  /** 経過秒数 */
  elapsedSeconds: number;
  /** リストID（リストプレイ時のみ） */
  listId?: string | null;
}

/**
 * オフライン時に保存する未同期 Attempt データ
 * completedAt は ISO 文字列で保存する
 */
export interface PendingSyncAttempt {
  /** localStorage 内の一意ローカルID */
  localId: string;
  quizId: string;
  userId: string;
  listId?: string | null;
  mode: Attempt['mode'];
  score: number;
  totalQuestions: number;
  elapsedSeconds: number;
  failedQuestionIds: string[];
  questionAnswers?: QuestionAnswerRecord[];
  /** 問題ごとの詳細な解答行動データ（新規追加） */
  questionAnswerDetails?: QuestionAnswerDetail[];
  difficultyVote?: number | null;
  aiTurnCount: number;
  aiTurnLimit: number | null;
  /** プレイ完了時刻 (ISO 8601 文字列) */
  completedAt: string;
}

/* ==========================================================================
   シリアライズ / デシリアライズ
   ========================================================================== */

/**
 * PlayProgressData を JSON 文字列にシリアライズする
 */
export function serializeAttemptSession(data: PlayProgressData): string {
  return JSON.stringify(data);
}

/**
 * JSON 文字列を PlayProgressData にデシリアライズする
 * @returns 成功時はオブジェクト、失敗時は null
 */
export function deserializeAttemptSession(json: string): PlayProgressData | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as PlayProgressData;
  } catch {
    return null;
  }
}

/* ==========================================================================
   LocalAttemptSession: プレイ中の進捗管理
   ========================================================================== */

/**
 * プレイ中の解答進捗を localStorage に永続化するクラス
 */
export const LocalAttemptSession = {
  /**
   * セッションキーを生成する
   */
  _key(quizId: string, userId: string): string {
    return `${ATTEMPT_SESSION_KEY_PREFIX}${quizId}_${userId}`;
  },

  /**
   * プレイ進捗を localStorage に保存する
   */
  save(quizId: string, userId: string, data: PlayProgressData): void {
    try {
      localStorage.setItem(this._key(quizId, userId), serializeAttemptSession(data));
    } catch (e) {
      // プライベートブラウジングなど localStorage が利用不可の場合は無視
      console.warn('[LocalAttemptSession] localStorage への保存に失敗しました:', e);
    }
  },

  /**
   * 保存済みのプレイ進捗を読み込む
   * @returns 進捗データ、または存在しない場合は null
   */
  load(quizId: string, userId: string): PlayProgressData | null {
    try {
      const raw = localStorage.getItem(this._key(quizId, userId));
      if (!raw) return null;
      return deserializeAttemptSession(raw);
    } catch {
      return null;
    }
  },

  /**
   * プレイ完了または離脱後にセッションデータを削除する
   */
  clear(quizId: string, userId: string): void {
    try {
      localStorage.removeItem(this._key(quizId, userId));
    } catch {
      // 無視
    }
  },
};

/* ==========================================================================
   未同期 Attempt のオフライン退避・バッチ同期
   ========================================================================== */

/**
 * localStorage から未同期 Attempt リストを取得する
 */
export function getPendingSyncAttempts(): PendingSyncAttempt[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingSyncAttempt[];
  } catch {
    return [];
  }
}

/**
 * 未同期 Attempt をリストに追加して localStorage に保存する
 * @param attempt 追加する未同期 Attempt
 */
export function addPendingSyncAttempt(attempt: PendingSyncAttempt): void {
  const current = getPendingSyncAttempts();
  current.push(attempt);
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('[AttemptSession] 未同期データの保存に失敗しました:', e);
  }
}

/**
 * 同期完了した Attempt を未同期リストから削除する
 * @param localId 削除対象のローカルID
 */
export function clearPendingSyncAttempt(localId: string): void {
  const remaining = getPendingSyncAttempts().filter((a) => a.localId !== localId);
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(remaining));
  } catch {
    // 無視
  }
}

/**
 * ローカルIDを生成するユーティリティ（タイムスタンプ + ランダム）
 */
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
