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
- 以下のいずれかで答えてください：
  - はい: 質問が裏設定の真相に照らして「はい」に相当する場合
  - いいえ: 質問が裏設定の真相に照らして「いいえ」に相当する場合
  - 関係ありません: 質問が謎の解決に関係ない場合
  - 判断できません: 裏設定から判断できない場合`;
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
  const firstLine = lines[0] ?? '';

  let answerType: AiAnswerType = 'unknown';
  if (firstLine.includes('はい')) answerType = 'yes';
  else if (firstLine.includes('いいえ')) answerType = 'no';
  else if (firstLine.includes('関係ありません')) answerType = 'irrelevant';
  // それ以外は unknown

  const aiComment = lines.slice(1).join('\n').trim() || '';

  return { answerType, aiComment };
}

import { Content } from '@google/generative-ai';

/**
 * 過去の対話履歴を Gemini API の Content[] 形式に変換する（最大20件分）
 *
 * @param history 過去の質問履歴
 * @returns Gemini Content配列
 */
export function mapHistoryToGeminiContents(
  history: { questionText: string; answerType: string; aiComment?: string }[]
): Content[] {
  const recent = history.slice(-20); // 直近20回
  return recent.flatMap((item) => {
    let answerText = '';
    if (item.answerType === 'yes') answerText = 'はい';
    else if (item.answerType === 'no') answerText = 'いいえ';
    else if (item.answerType === 'irrelevant') answerText = '関係ありません';
    else answerText = '判断できません';

    if (item.aiComment) {
      answerText += `\n${item.aiComment}`;
    }

    return [
      { role: 'user', parts: [{ text: item.questionText }] },
      { role: 'model', parts: [{ text: answerText }] },
    ];
  });
}

/**
 * Gemini Chat API用のシステムインストラクションを構築する
 *
 * @param aiContextDetails クイズの裏設定
 * @returns システムインストラクションプロンプト
 */
export function buildAiSystemInstruction(aiContextDetails: string): string {
  return `あなたは「ウミガメのスープ」（水平思考パズル）のゲームマスターです。
ユーザーから寄せられる質問に対して、以下の【裏設定】に基づいて回答ルールに従って答えてください。
回答ルールにない余計なヒントや解答を直接教えるような発言は絶対に避けてください。

【裏設定（絶対に直接開示しないこと）】
${aiContextDetails}

【回答ルール】
- 以下のいずれかで答えてください：
  - はい: 質問が裏設定の真相に照らして「はい」に相当する場合
  - いいえ: 質問が裏設定の真相に照らして「いいえ」に相当する場合
  - 関係ありません: 質問が謎の解決に関係ない場合
  - 判断できません: 裏設定から判断できない場合`;
}
