/**
 * クイズ公開バリデーション・タグ正規化ロジック
 * Firestore に依存しない純粋関数群（テスト容易性のため分離）
 *
 * Boundary: QuizService (Task 2.2)
 * Requirements: 2.1, 2.2, 2.3
 */

import { Quiz, Question } from '../types';
import {
  MAX_MULTIPLE_CHOICE_COUNT,
  MIN_MULTIPLE_CHOICE_COUNT,
} from './quiz-choice-utils';

/* ==========================================================================
   NGワード定義
   ========================================================================== */

/**
 * NGワード一覧（小文字で定義。実際のプロダクションでは外部設定ファイルや
 * Firestore の moderation コレクションから動的ロードすることを推奨）
 */
export const NG_WORD_LIST: string[] = [
  'spam',
  'scam',
  'hentai',
  'adult',
  'porn',
  'xxx',
  // 追加のNGワードはここに記載
];

/**
 * テキストにNGワードが含まれるか判定する（ケースインセンシティブ）
 * @param text 検査対象テキスト
 * @returns NGワードを含む場合 true
 */
export function containsNgWord(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return NG_WORD_LIST.some((word) => lower.includes(word));
}

/* ==========================================================================
   タグ正規化
   ========================================================================== */

/**
 * タグ文字列を正規化する（純粋関数）
 * 処理内容:
 * 1. 全角・半角スペースをトリム
 * 2. 小文字化
 * 3. 中間のスペース（全角含む）を除去
 * 4. ハイフン・アンダースコア以外の記号を除去
 *
 * @param input 生のタグ入力文字列
 * @returns 正規化されたタグ文字列
 */
export function normalizeTag(input: string): string {
  return input
    .trim()                             // 前後の半角スペースをトリム
    .replace(/　/g, '')                 // 全角スペースを除去
    .toLowerCase()                      // 小文字化
    .replace(/\s+/g, '')               // 中間の半角スペースを除去
    .replace(/[^\p{L}\p{N}\-_]/gu, ''); // 文字・数字・ハイフン・アンダースコア以外を除去
}

/* ==========================================================================
   公開時バリデーション
   ========================================================================== */

/**
 * クイズ公開バリデーションエラーの型
 */
export interface QuizPublishValidationError {
  field: 'title' | 'description' | 'questions' | 'difficulty' | 'genre' | 'ngWord';
  message: string;
  /** 問題単位のエラーの場合、問題インデックス（0始まり） */
  questionIndex?: number;
}

/**
 * 問題ごとに正解が設定されているか検証するヘルパー
 */
function isQuestionAnswerValid(question: Question): boolean {
  switch (question.type) {
    case 'multiple-choice': {
      const choices = question.choices ?? [];
      if (choices.length < MIN_MULTIPLE_CHOICE_COUNT || choices.length > MAX_MULTIPLE_CHOICE_COUNT) {
        return false;
      }
      return choices.some((c) => c.isCorrect);
    }

    case 'true-false': {
      const choices = question.choices ?? [];
      if (choices.length !== 2) return false;
      return choices.some((c) => c.isCorrect);
    }

    case 'text-input':
    case 'quick-press':
      // correctTextAnswerList に最低1つのエントリが必要
      return (question.correctTextAnswerList ?? []).length > 0;

    case 'sorting': {
      // sortingItems が2〜6個必要
      const items = question.sortingItems ?? [];
      if (items.length < 2 || items.length > 6) return false;
      // correctOrderの重複チェックとインデックス範囲検証
      const orders = items.map((item) => item.correctOrder);
      const uniqueOrders = new Set(orders);
      if (uniqueOrders.size !== orders.length) return false;
      const maxOrder = items.length - 1;
      return orders.every((o) => o >= 0 && o <= maxOrder);
    }

    case 'association': {
      // associationHints が1〜5個必要、かつ correctTextAnswerList に最低1つの正解パターンが必要
      const hints = question.associationHints ?? [];
      if (hints.length < 1 || hints.length > 5) return false;
      return (question.correctTextAnswerList ?? []).length > 0;
    }

    case 'lateral-thinking':
      // aiContextDetails（裏設定）が必要、かつ必須キーワードが1つ以上指定されていること
      return (
        Boolean(question.aiContextDetails?.trim()) &&
        (question.truthKeywords ?? []).filter((kw) => kw.trim()).length > 0
      );

    default:
      return true;
  }
}

/**
 * クイズの公開前バリデーションを実行する
 *
 * 検証内容:
 * - タイトル: 必須、最大100文字
 * - 難易度: 1〜10の整数
 * - 問題数: 最低1問
 * - 各問題の正解設定: 問題タイプごとに適切な正解が設定されていること
 * - NGワード: タイトル・説明・問題文にNGワードが含まれないこと
 *
 * @param quiz 検証対象のクイズ
 * @returns バリデーションエラーの配列（0件 = 合格）
 */
export function validateQuizForPublish(quiz: Quiz): QuizPublishValidationError[] {
  const errors: QuizPublishValidationError[] = [];

  // ── タイトル ──────────────────────────────────────────
  if (!quiz.title.trim()) {
    errors.push({ field: 'title', message: 'タイトルは必須です' });
  } else if (quiz.title.length > 100) {
    errors.push({ field: 'title', message: 'タイトルは100文字以内で入力してください' });
  }

  // ── 難易度 ────────────────────────────────────────────
  if (
    !Number.isInteger(quiz.difficulty) ||
    quiz.difficulty < 1 ||
    quiz.difficulty > 10
  ) {
    errors.push({ field: 'difficulty', message: '難易度は1〜10の整数で設定してください' });
  }

  // ── 問題数 ────────────────────────────────────────────
  if (!quiz.questions || quiz.questions.length === 0) {
    errors.push({ field: 'questions', message: '公開するには最低1問の問題が必要です' });
  } else {
    // ── 各問題の正解設定チェック ──────────────────────
    quiz.questions.forEach((q, idx) => {
      if (!isQuestionAnswerValid(q)) {
        const detailMsg = q.type === 'lateral-thinking'
          ? '裏設定（aiContextDetails）または必須キーワードが不足しています'
          : '正解が設定されていません';
        errors.push({
          field: 'questions',
          message: `問題 ${idx + 1}「${q.questionText.slice(0, 20)}」に${detailMsg}`,
          questionIndex: idx,
        });
      }
    });

    // ── クイズ形式と設問タイプの一貫性チェック ──────────
    if (quiz.format) {
      quiz.questions.forEach((q, idx) => {
        if (quiz.format === 'mixed') {
          // 複合形式: 選択式、記述式、並び替えのみ許可
          const allowedTypes = ['multiple-choice', 'true-false', 'text-input', 'sorting'];
          if (!allowedTypes.includes(q.type)) {
            errors.push({
              field: 'questions',
              message: `問題 ${idx + 1} のタイプ「${q.type}」は、複合クイズ形式では許可されていません。`,
              questionIndex: idx,
            });
          }
        } else {
          // 単一形式: クイズ全体の形式と設問の形式が一致していること
          if (quiz.format === 'multiple-choice') {
            if (q.type !== 'multiple-choice' && q.type !== 'true-false') {
              errors.push({
                field: 'questions',
                message: `問題 ${idx + 1} のタイプがクイズ全体の形式（選択式）と一致していません。`,
                questionIndex: idx,
              });
            }
          } else {
            if (q.type !== quiz.format) {
              errors.push({
                field: 'questions',
                message: `問題 ${idx + 1} のタイプがクイズ全体の形式と一致していません。`,
                questionIndex: idx,
              });
            }
          }
        }
      });
    }
  }

  // ── NGワードチェック ──────────────────────────────────
  const textsToCheck = [
    quiz.title,
    quiz.description,
    ...quiz.questions.flatMap((q) => [q.questionText, q.explanation ?? '']),
  ];

  for (const text of textsToCheck) {
    if (containsNgWord(text)) {
      errors.push({
        field: 'ngWord',
        message: '不適切なワードが含まれているため公開できません。内容を修正してください',
      });
      break; // 最初の検出で打ち切り（重複エラーを防ぐ）
    }
  }

  return errors;
}
