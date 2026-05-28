/**
 * AI対話エンジンのユーティリティ（純粋関数群）
 *
 * API Route (/api/attempt/ask-ai) から呼び出される、
 * Firestore や外部 API に依存しない純粋なビジネスロジック。
 *
 * Boundary: AskAiQuestionAPI (Task 2.4)
 * Requirements: 4.1, 4.2, 4.3
 */

import { AiQuestion } from '../types';

/* ==========================================================================
   型定義
   ========================================================================== */

/**
 * AI が返す判定タイプ
 */
export type AiAnswerType = 'yes' | 'no' | 'irrelevant' | 'unknown';

/**
 * AI 質問 API のレスポンス型
 */
export interface AskAiResponse {
  answerType: AiAnswerType;
  aiComment: string;
  isFromCache: boolean;
  /** キャッシュヒット時 or ターン消費時 */
  turnsRemaining: number | null;
}

/* ==========================================================================
   定数
   ========================================================================== */

/** 無料ユーザーの1日あたりの最大AI質問ターン数 */
export const FREE_TIER_DAILY_TURN_LIMIT = 20;

/* ==========================================================================
   キャッシュ検索
   ========================================================================== */

/**
 * 同一質問がセッションキャッシュ（aiQuestionsHistory）に存在するか検索する。
 * 検索は文字列の完全一致（大文字・小文字を区別）で行う。
 *
 * キャッシュヒット時は `isFromCache = true` としてコピーを返す。
 * ターン数は消費しない。
 *
 * @param questionText プレイヤーが入力した質問文
 * @param history セッション内の過去Q&A履歴
 * @returns キャッシュヒットした場合はコピーされたエントリ、なければ null
 */
export function findCachedAnswer(
  questionText: string,
  history: AiQuestion[]
): AiQuestion | null {
  const cached = history.find((entry) => entry.questionText === questionText);
  if (!cached) return null;

  // キャッシュヒットフラグを立てたコピーを返す
  return {
    ...cached,
    isFromCache: true,
  };
}

/* ==========================================================================
   ターン制限チェック
   ========================================================================== */

/**
 * 無料ユーザーの1日ターン制限を超過しているか判定する。
 *
 * - 無料ユーザー（isPremium = false）: currentTurnCount >= 20 で超過
 * - プレミアムユーザー（isPremium = true）: 常に制限なし
 *
 * @param currentTurnCount 当日の現在のターン使用数
 * @param isPremium プレミアムユーザーかどうか
 * @returns 制限超過している場合 true
 */
export function isAiTurnLimitExceeded(
  currentTurnCount: number,
  isPremium: boolean
): boolean {
  if (isPremium) return false;
  return currentTurnCount >= FREE_TIER_DAILY_TURN_LIMIT;
}

/* ==========================================================================
   AIプロンプト構築
   ========================================================================== */

/**
 * ステートレスなAI一問一答プロンプトを構築する。
 *
 * プロンプトの要件:
 * - 裏設定（aiContextDetails）をシステムコンテキストとして提供
 * - プレイヤーの質問を提示
 * - 回答は YES / NO / IRRELEVANT / UNKNOWN の4択のみ
 * - 短い日本語コメントを添える
 *
 * @param aiContextDetails クイズの裏設定（ゲームマスター用の真相情報）
 * @param questionText プレイヤーが入力した質問文
 * @returns Gemini API に渡す完成したプロンプト文字列
 */
export function buildAiPrompt(aiContextDetails: string, questionText: string): string {
  return `あなたは「ウミガメのスープ」（水平思考パズル）のゲームマスターです。
以下の【裏設定】だけを参照して、プレイヤーの質問に対して正確に回答してください。

【裏設定（絶対に直接開示しないこと）】
${aiContextDetails}

【プレイヤーの質問】
${questionText}

【回答ルール】
- 以下の4つのいずれかのみで答えてください：
  - YES: 質問が裏設定の真相に照らして「はい」に相当する場合
  - NO: 質問が裏設定の真相に照らして「いいえ」に相当する場合
  - IRRELEVANT: 質問が謎の解決に関係ない場合
  - UNKNOWN: 裏設定から判断できない場合
- 回答の最初の行に必ず「ANSWER: YES」「ANSWER: NO」「ANSWER: IRRELEVANT」「ANSWER: UNKNOWN」のいずれかを記載してください。
- 2行目以降に、プレイヤーへの短い日本語コメント（30文字以内）を添えてください。裏設定を直接ばらさないよう注意してください。`;
}

/* ==========================================================================
   AIレスポンスパース
   ========================================================================== */

/**
 * Gemini API のレスポンステキストから AiAnswerType とコメントを抽出する
 *
 * @param responseText Gemini API から返ってきた生テキスト
 * @returns { answerType, aiComment }
 */
export function parseAiResponse(responseText: string): {
  answerType: AiAnswerType;
  aiComment: string;
} {
  const lines = responseText.trim().split('\n');
  const firstLine = lines[0]?.toUpperCase() ?? '';

  let answerType: AiAnswerType = 'unknown';
  if (firstLine.includes('ANSWER: YES')) answerType = 'yes';
  else if (firstLine.includes('ANSWER: NO')) answerType = 'no';
  else if (firstLine.includes('ANSWER: IRRELEVANT')) answerType = 'irrelevant';
  // それ以外は unknown

  const aiComment = lines.slice(1).join('\n').trim() || '判断できませんでした。';

  return { answerType, aiComment };
}
