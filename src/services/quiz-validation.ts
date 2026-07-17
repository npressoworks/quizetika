/**
 * クイズ公開バリデーション・タグ正規化ロジック
 * Supabase に依存しない純粋関数群（テスト容易性のため分離）
 *
 * Boundary: QuizService (Task 2.2)
 * Requirements: 2.1, 2.2, 2.3
 */

import { Quiz, Question } from '../types';
import { isReferenceLinkQuestion } from '../lib/linked-question';
import { MIXED_ALLOWED_QUESTION_TYPES } from './ai-authoring-types';
import type { QuizFormat } from '../lib/quiz-format';
import {
  normalizeTrueFalseChoices,
  type TrueFalseCorrectSide,
} from '../lib/true-false-defaults';
import {
  MAX_TEXT_INPUT_CHAR_COUNT,
  MIN_TEXT_INPUT_CHAR_COUNT,
  isValidNumericAnswerText,
  resolveTextInputMode,
  normalizeTextAnswer,
} from './text-answer-utils';
import {
  MAX_MULTIPLE_CHOICE_COUNT,
  MIN_MULTIPLE_CHOICE_COUNT,
} from './quiz-choice-utils';

/* ==========================================================================
   NGワード定義
   ========================================================================== */

/**
 * テキストにNGワードが含まれるか判定する（ケースインセンシティブ）
 * @param text 検査対象テキスト
 * @param ngWords 判定に用いるNGワード一覧（呼び出し元が用意する。例: `listActiveNgWords()`）
 * @returns NGワードを含む場合 true
 */
export function containsNgWord(text: string, ngWords: readonly string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return ngWords.some((word) => lower.includes(word.toLowerCase()));
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
export const MIN_QUESTION_TEXT_LENGTH = 5;
export const MAX_QUESTION_TEXT_LENGTH = 500;

export type QuizValidationQuestionField =
  | 'questionText'
  | 'type'
  | 'answers'
  | 'textInputCharCount'
  | 'correctTextAnswer'
  | 'sortingItems'
  | 'associationHints'
  | 'aiContextDetails'
  | 'truthKeywords';

export interface QuizPublishValidationError {
  field: 'title' | 'description' | 'questions' | 'difficulty' | 'genre' | 'ngWord';
  message: string;
  /** 問題単位のエラーの場合、問題インデックス（0始まり） */
  questionIndex?: number;
  /** 問題内の対象フィールド */
  questionField?: QuizValidationQuestionField;
  /** 正解候補リスト内のインデックス（questionField === 'correctTextAnswer' の場合） */
  answerIndex?: number;
}

export function filterValidationErrors(
  errors: QuizPublishValidationError[],
  filter: {
    field: QuizPublishValidationError['field'];
    questionIndex?: number;
    questionField?: QuizValidationQuestionField;
    answerIndex?: number;
    /** true の場合、questionIndex 未設定のエラーのみ */
    unscopedOnly?: boolean;
  }
): QuizPublishValidationError[] {
  return errors.filter((err) => {
    if (err.field !== filter.field) return false;
    if (filter.unscopedOnly && err.questionIndex !== undefined) return false;
    if (filter.questionIndex !== undefined && err.questionIndex !== filter.questionIndex) return false;
    if (filter.questionField !== undefined && err.questionField !== filter.questionField) return false;
    if (filter.answerIndex !== undefined && err.answerIndex !== filter.answerIndex) return false;
    return true;
  });
}

/** サマリー表示用にエラーメッセージを整形する */
export function formatValidationErrorSummary(
  err: QuizPublishValidationError,
  quiz: Pick<Quiz, 'questions'>
): string {
  if (err.questionIndex != null) {
    const q = quiz.questions[err.questionIndex];
    const preview = q?.questionText.slice(0, 20) || '（無題）';
    return `問題 ${err.questionIndex + 1}「${preview}」: ${err.message}`;
  }
  return err.message;
}

/**
 * 問題の問題文を検証する（下書き・公開の共通）
 */
export function collectQuestionTextValidationErrors(
  question: Question,
  idx: number
): QuizPublishValidationError[] {
  const trimmed = question.questionText?.trim() ?? '';
  const errors: QuizPublishValidationError[] = [];

  if (!trimmed) {
    errors.push({
      field: 'questions',
      questionIndex: idx,
      questionField: 'questionText',
      message: '問題文を入力してください',
    });
    return errors;
  }

  if (trimmed.length < MIN_QUESTION_TEXT_LENGTH) {
    errors.push({
      field: 'questions',
      questionIndex: idx,
      questionField: 'questionText',
      message: `問題文は${MIN_QUESTION_TEXT_LENGTH}文字以上で入力してください`,
    });
  }

  if (question.questionText.length > MAX_QUESTION_TEXT_LENGTH) {
    errors.push({
      field: 'questions',
      questionIndex: idx,
      questionField: 'questionText',
      message: `問題文は${MAX_QUESTION_TEXT_LENGTH}文字以内で入力してください`,
    });
  }

  return errors;
}

/**
 * 問題ごとに正解が設定されているか検証するヘルパー
 */
export function collectQuestionValidationErrors(question: Question, idx: number): QuizPublishValidationError[] {
  const errors: QuizPublishValidationError[] = [
    ...collectQuestionTextValidationErrors(question, idx),
  ];

  switch (question.type) {
    case 'multiple-choice': {
      if (question.choices === null || question.choices === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '選択肢リストが定義されていません',
        });
        break;
      }
      const choices = question.choices;
      if (choices.length < MIN_MULTIPLE_CHOICE_COUNT || choices.length > MAX_MULTIPLE_CHOICE_COUNT) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: `選択肢は${MIN_MULTIPLE_CHOICE_COUNT}〜${MAX_MULTIPLE_CHOICE_COUNT}個設定してください`,
        });
      } else if (!choices.some((c) => c.isCorrect)) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '正解の選択肢を1つ以上指定してください',
        });
      }
      break;
    }

    case 'true-false': {
      if (question.choices === null || question.choices === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '選択肢リストが定義されていません',
        });
        break;
      }
      const choices = question.choices;
      const correctCount = choices.filter((c) => c.isCorrect).length;
      if (choices.length !== 2) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '〇✕形式は選択肢2つが必要です',
        });
      } else if (correctCount === 0) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '正解の選択肢を指定してください',
        });
      } else if (correctCount > 1) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '〇✕形式は正解を1つだけ指定してください',
        });
      }
      break;
    }

    case 'text-input': {
      if (question.correctTextAnswerList === null || question.correctTextAnswerList === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '正解テキストリストが定義されていません',
        });
        break;
      }
      const list = question.correctTextAnswerList;
      if (list.length === 0) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '正解候補を最低1つ設定してください',
        });
      }

      const mode = resolveTextInputMode(question);
      const count = question.textInputCharCount;

      // 1. 要求文字数制限のバリデーション（指定がある場合のみ）
      if (count !== undefined && count !== null) {
        if (
          !Number.isInteger(count) ||
          count < MIN_TEXT_INPUT_CHAR_COUNT ||
          count > MAX_TEXT_INPUT_CHAR_COUNT
        ) {
          errors.push({
            field: 'questions',
            questionIndex: idx,
            questionField: 'textInputCharCount',
            message: '要求文字数は1〜100の整数で設定してください',
          });
        } else {
          list.forEach((ans, aIdx) => {
            const cleanAns = normalizeTextAnswer(ans);
            if (cleanAns.length !== count) {
              errors.push({
                field: 'questions',
                questionIndex: idx,
                questionField: 'correctTextAnswer',
                answerIndex: aIdx,
                message: `要求文字数（${count}文字）と一致していません（現在${cleanAns.length}文字）`,
              });
            }
          });
        }
      }

      // 2. 文字種別バリデーション
      list.forEach((ans, aIdx) => {
        const cleanAns = normalizeTextAnswer(ans);
        if (mode === 'kanji') {
          if (!cleanAns || !/^[一-龠々〇〆ヶ\u3400-\u4dbf]+$/.test(cleanAns)) {
            errors.push({
              field: 'questions',
              questionIndex: idx,
              questionField: 'correctTextAnswer',
              answerIndex: aIdx,
              message: '正解候補は漢字のみで入力してください',
            });
          }
        } else if (mode === 'katakana') {
          if (!cleanAns || !/^[ァ-ヶー]+$/.test(cleanAns)) {
            errors.push({
              field: 'questions',
              questionIndex: idx,
              questionField: 'correctTextAnswer',
              answerIndex: aIdx,
              message: '正解候補はカタカナのみで入力してください',
            });
          }
        } else if (mode === 'alphabet') {
          if (!cleanAns || !/^[a-zA-Z]+$/.test(cleanAns)) {
            errors.push({
              field: 'questions',
              questionIndex: idx,
              questionField: 'correctTextAnswer',
              answerIndex: aIdx,
              message: '正解候補はアルファベットのみで入力してください',
            });
          }
        } else if (mode === 'numeric') {
          if (!isValidNumericAnswerText(ans)) {
            errors.push({
              field: 'questions',
              questionIndex: idx,
              questionField: 'correctTextAnswer',
              answerIndex: aIdx,
              message: '整数・小数の数値を入力してください',
            });
          }
        }
      });
      break;
    }

    case 'quick-press': {
      if (question.correctTextAnswerList === null || question.correctTextAnswerList === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '正解テキストリストが定義されていません',
        });
        break;
      }
      if (question.correctTextAnswerList.length === 0) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '正解候補を最低1つ設定してください',
        });
      }
      break;
    }

    case 'sorting': {
      if (question.sortingItems === null || question.sortingItems === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'sortingItems',
          message: '並び替え要素リストが定義されていません',
        });
        break;
      }
      const items = question.sortingItems;
      if (items.length < 2 || items.length > 6) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'sortingItems',
          message: '並び替え要素は2〜6個設定してください',
        });
      } else {
        const orders = items.map((item) => item.correctOrder);
        const uniqueOrders = new Set(orders);
        const maxOrder = items.length - 1;
        if (uniqueOrders.size !== orders.length || !orders.every((o) => o >= 0 && o <= maxOrder)) {
          errors.push({
            field: 'questions',
            questionIndex: idx,
            questionField: 'sortingItems',
            message: '並び替え要素の順序設定が不正です',
          });
        }
      }
      break;
    }

    case 'association': {
      let missingField = false;
      if (question.associationHints === null || question.associationHints === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'associationHints',
          message: '連想ヒントリストが定義されていません',
        });
        missingField = true;
      }
      if (question.correctTextAnswerList === null || question.correctTextAnswerList === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '正解テキストリストが定義されていません',
        });
        missingField = true;
      }
      if (missingField) {
        break;
      }
      const hints = question.associationHints;
      if (!hints || hints.length < 1 || hints.length > 5) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'associationHints',
          message: '連想ヒントは1〜5個設定してください',
        });
      }
      if (!question.correctTextAnswerList || question.correctTextAnswerList.length === 0) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'answers',
          message: '正解候補を最低1つ設定してください',
        });
      }
      break;
    }

    case 'lateral-thinking': {
      let missingField = false;
      if (question.aiContextDetails === null || question.aiContextDetails === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'aiContextDetails',
          message: 'AI用の裏設定が定義されていません',
        });
        missingField = true;
      }
      if (question.truthKeywords === null || question.truthKeywords === undefined) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'truthKeywords',
          message: '必須正解キーワードが定義されていません',
        });
        missingField = true;
      }
      if (missingField) {
        break;
      }
      if (!question.aiContextDetails || !question.aiContextDetails.trim()) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'aiContextDetails',
          message: 'AI用の裏設定（真相）を入力してください',
        });
      }
      if (!question.truthKeywords || question.truthKeywords.filter((kw) => kw.trim()).length === 0) {
        errors.push({
          field: 'questions',
          questionIndex: idx,
          questionField: 'truthKeywords',
          message: '必須正解キーワードを最低1つ登録してください',
        });
      }
      break;
    }

    default:
      break;
  }

  return errors;
}

/**
 * 下書き保存前バリデーション（タイトル・ジャンル・各問題文）
 */
export function validateQuizForDraft(quiz: Pick<Quiz, 'title' | 'genre' | 'questions'>): QuizPublishValidationError[] {
  const errors: QuizPublishValidationError[] = [];

  if (!quiz.title?.trim()) {
    errors.push({ field: 'title', message: '下書き保存するにはタイトルを入力してください' });
  }
  if (!quiz.genre?.trim()) {
    errors.push({ field: 'genre', message: 'ジャンルを選択してください' });
  }
  (quiz.questions ?? []).forEach((q, idx) => {
    errors.push(...collectQuestionTextValidationErrors(q, idx));
  });

  return errors;
}

/**
 * クイズの公開前バリデーションを実行する
 *
 * 検証内容:
 * - タイトル: 必須、最大100文字
 * - 難易度: 1〜10の整数
 * - ジャンル: 必須
 * - 問題数: 最低1問
 * - 各問題の問題文: 必須、5文字以上500文字以内
 * - 各問題の正解設定: 問題タイプごとに適切な正解が設定されていること
 * - NGワード: タイトル・説明・問題文にNGワードが含まれないこと
 *
 * @param quiz 検証対象のクイズ
 * @param ngWords NGワード判定に用いる語句一覧（呼び出し元が用意する。例: `listActiveNgWords()`）
 * @returns バリデーションエラーの配列（0件 = 合格）
 */
export function validateQuizForPublish(
  quiz: Quiz,
  ngWords: readonly string[]
): QuizPublishValidationError[] {
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
    quiz.difficulty > 5
  ) {
    errors.push({ field: 'difficulty', message: '難易度は1〜5の整数で設定してください' });
  }

  // ── ジャンル ──────────────────────────────────────────
  if (!quiz.genre?.trim()) {
    errors.push({ field: 'genre', message: 'ジャンルを選択してください' });
  }

  // ── 問題数 ────────────────────────────────────────────
  if (!quiz.questions || quiz.questions.length === 0) {
    errors.push({ field: 'questions', message: '公開するには最低1問の問題が必要です' });
  } else {
    // ── 各問題の正解設定チェック ──────────────────────
    quiz.questions.forEach((q, idx) => {
      if (isReferenceLinkQuestion(q)) return;
      errors.push(...collectQuestionValidationErrors(q, idx));
    });

    // ── クイズ形式と問題タイプの一貫性チェック ──────────
    if (quiz.format) {
      quiz.questions.forEach((q, idx) => {
        if (isReferenceLinkQuestion(q)) return;
        if (quiz.format === 'mixed') {
          const allowedTypes = ['multiple-choice', 'true-false', 'text-input', 'sorting', 'association'];
          if (!allowedTypes.includes(q.type)) {
            errors.push({
              field: 'questions',
              message: `問題タイプ「${q.type}」は、複合クイズ形式では許可されていません`,
              questionIndex: idx,
              questionField: 'type',
            });
          }
        } else if (quiz.format === 'multiple-choice') {
          if (q.type !== 'multiple-choice' && q.type !== 'true-false') {
            errors.push({
              field: 'questions',
              message: 'クイズ全体の形式（選択式）と一致していません',
              questionIndex: idx,
              questionField: 'type',
            });
          }
        } else if (q.type !== quiz.format) {
          errors.push({
            field: 'questions',
            message: 'クイズ全体の形式と一致していません',
            questionIndex: idx,
            questionField: 'type',
          });
        }
      });
    }
  }

  // ── NGワードチェック ──────────────────────────────────
  const textsToCheck = [
    quiz.title,
    quiz.description,
    ...quiz.questions
      .filter((q) => !isReferenceLinkQuestion(q))
      .flatMap((q) => [q.questionText, q.explanation ?? '']),
  ];

  for (const text of textsToCheck) {
    if (containsNgWord(text, ngWords)) {
      errors.push({
        field: 'ngWord',
        message: '不適切なワードが含まれているため公開できません。内容を修正してください',
      });
      break; // 最初の検出で打ち切り（重複エラーを防ぐ）
    }
  }

  return errors;
}

/**
 * AI 生成問題の一括検証（作問 API 422 判定用）
 */
export function validateGeneratedQuestions(
  questions: Question[],
  format: QuizFormat
): QuizPublishValidationError[] {
  const errors: QuizPublishValidationError[] = [];

  questions.forEach((q, idx) => {
    if (isReferenceLinkQuestion(q)) return;
    errors.push(...collectQuestionValidationErrors(q, idx));

    if (format === 'mixed') {
      if (!MIXED_ALLOWED_QUESTION_TYPES.includes(q.type as typeof MIXED_ALLOWED_QUESTION_TYPES[number])) {
        errors.push({
          field: 'questions',
          message: `問題タイプ「${q.type}」は、複合クイズ形式では許可されていません`,
          questionIndex: idx,
          questionField: 'type',
        });
      }
    } else if (format === 'multiple-choice') {
      if (q.type !== 'multiple-choice' && q.type !== 'true-false') {
        errors.push({
          field: 'questions',
          message: 'クイズ全体の形式（選択式）と一致していません',
          questionIndex: idx,
          questionField: 'type',
        });
      }
    } else if (q.type !== format) {
      errors.push({
        field: 'questions',
        message: 'クイズ全体の形式と一致していません',
        questionIndex: idx,
        questionField: 'type',
      });
    }
  });

  return errors;
}

/**
 * 保存前に問題データを正規化する（〇✕形式の選択肢ラベル等）
 */
export function normalizeQuizQuestionsForSave(questions: Question[]): Question[] {
  return questions.map((q) => {
    if (isReferenceLinkQuestion(q) || q.type !== 'true-false') {
      return q;
    }
    return {
      ...q,
      choices: normalizeTrueFalseChoices(q.choices),
    };
  });
}

export function setTrueFalseCorrectSide(
  question: Question,
  side: TrueFalseCorrectSide
): Question {
  if (question.type !== 'true-false') return question;
  return {
    ...question,
    choices: normalizeTrueFalseChoices(question.choices, side),
  };
}
