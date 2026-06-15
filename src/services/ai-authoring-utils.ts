import type { Question, Quiz, Choice, SortingItem } from '@/types';
import type { UserEntitlements } from '@/types/subscription';
import type { QuizFormat } from '@/lib/quiz-format';
import { createDefaultChoices } from '@/services/quiz-choice-utils';
import { createTrueFalseChoices } from '@/lib/true-false-defaults';
import {
  AI_QUIZ_PROMPT_MAX_LENGTH,
  AI_QUIZ_QUESTION_COUNT,
  PRO_DAILY_QUESTION_GENERATION_LIMIT,
  PRO_DAILY_THUMBNAIL_GENERATION_LIMIT,
  MIXED_ALLOWED_QUESTION_TYPES,
  type AiAuthoringUsage,
  type AssertAiAuthoringAccessResult,
  type DailyAiAuthoringCountDoc,
  type MixedAllowedQuestionType,
} from '@/services/ai-authoring-types';

export {
  AI_QUIZ_PROMPT_MAX_LENGTH,
  AI_QUIZ_QUESTION_COUNT,
  PRO_DAILY_QUESTION_GENERATION_LIMIT,
  PRO_DAILY_THUMBNAIL_GENERATION_LIMIT,
  DAILY_AUTHORING_DOC_QUESTIONS,
  DAILY_AUTHORING_DOC_THUMBNAIL,
  MIXED_ALLOWED_QUESTION_TYPES,
} from '@/services/ai-authoring-types';

export function getJstTodayString(): string {
  const d = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(d.getTime() + jstOffset);
  const yyyy = jstDate.getUTCFullYear();
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function readDailyAuthoringCount(
  data: DailyAiAuthoringCountDoc | undefined,
  todayStr: string
): number {
  if (!data || data.lastUpdatedDate !== todayStr) return 0;
  return data.count ?? 0;
}

export function buildAuthoringUsage(
  usedToday: number,
  limit: number,
  isExempt: boolean
): AiAuthoringUsage {
  if (isExempt) {
    return { limit: null, usedToday, remainingToday: null };
  }
  return {
    limit,
    usedToday,
    remainingToday: Math.max(0, limit - usedToday),
  };
}

export function checkDailyAuthoringLimit(
  count: number,
  limit: number,
  isExempt: boolean
): { exceeded: boolean; usage: AiAuthoringUsage } {
  const usage = buildAuthoringUsage(count, limit, isExempt);
  if (isExempt) {
    return { exceeded: false, usage };
  }
  return { exceeded: count >= limit, usage };
}

export function assertAiAuthoringAccess(
  entitlements: UserEntitlements,
  uid: string
): AssertAiAuthoringAccessResult {
  const isModeratorExempt =
    entitlements.hasUnlimitedAiQuestions && !entitlements.hasPaidEntitlements;
  return {
    uid,
    hasPaidEntitlements: entitlements.hasPaidEntitlements,
    isModeratorExempt,
    skipDailyLimit: entitlements.hasUnlimitedAiQuestions,
  };
}

export function canAccessAiAuthoring(entitlements: UserEntitlements): boolean {
  return entitlements.hasPaidEntitlements || entitlements.hasUnlimitedAiQuestions;
}

export function readDailyAuthoringUsage(
  questionsCount: number,
  thumbnailCount: number,
  isExempt: boolean
): { questions: AiAuthoringUsage; thumbnail: AiAuthoringUsage } {
  return {
    questions: buildAuthoringUsage(
      questionsCount,
      PRO_DAILY_QUESTION_GENERATION_LIMIT,
      isExempt
    ),
    thumbnail: buildAuthoringUsage(
      thumbnailCount,
      PRO_DAILY_THUMBNAIL_GENERATION_LIMIT,
      isExempt
    ),
  };
}

export function buildAiQuizGenerationPrompt(input: {
  prompt: string;
  format: QuizFormat;
  title?: string;
  description?: string;
  genre?: string;
}): string {
  const contextParts: string[] = [];
  if (input.title?.trim()) contextParts.push(`タイトル: ${input.title.trim()}`);
  if (input.description?.trim()) contextParts.push(`説明: ${input.description.trim()}`);
  if (input.genre?.trim()) contextParts.push(`ジャンル: ${input.genre.trim()}`);

  const contextBlock =
    contextParts.length > 0 ? `クイズコンテキスト:\n${contextParts.join('\n')}\n\n` : '';

  const formatInstruction =
    input.format === 'mixed'
      ? `複合形式。各問題の type は ${MIXED_ALLOWED_QUESTION_TYPES.join(', ')} のいずれか。`
      : `全問題の type は「${input.format}」に一致させる（multiple-choice 形式では true-false も可）。`;

  return `${contextBlock}ユーザーの作問指示:\n${input.prompt.trim()}\n\n形式: ${input.format}\n${formatInstruction}\n正確な日本語の問題を ${AI_QUIZ_QUESTION_COUNT} 問生成してください。`;
}

interface AiQuestionJsonItem {
  type?: string;
  questionText?: string;
  explanation?: string;
  hint?: string | null;
  choices?: { choiceText?: string; isCorrect?: boolean }[];
  correctTextAnswerList?: string[];
  sortingItems?: { text?: string; correctOrder?: number }[];
  associationHints?: string[];
}

function isMixedAllowedType(type: string): type is MixedAllowedQuestionType {
  return (MIXED_ALLOWED_QUESTION_TYPES as readonly string[]).includes(type);
}

function isTypeAllowedForFormat(type: string, format: QuizFormat): boolean {
  if (format === 'mixed') {
    return isMixedAllowedType(type);
  }
  if (format === 'multiple-choice') {
    return type === 'multiple-choice' || type === 'true-false';
  }
  return type === format;
}

function mapChoices(raw: AiQuestionJsonItem['choices'], type: Question['type']): Choice[] {
  if (type === 'true-false') {
    const correctChoice = raw?.find((c) => c.isCorrect);
    const correctText = correctChoice?.choiceText?.trim() ?? '';
    const isBatsu =
      correctText === '✕' ||
      correctText === '×' ||
      correctText === 'X' ||
      correctText === 'x' ||
      correctText === 'batsu' ||
      correctText === 'Batsu' ||
      correctText === '偽' ||
      correctText === '誤り' ||
      correctText === '間違い' ||
      correctText === 'false' ||
      correctText === 'False';
    return createTrueFalseChoices(isBatsu ? 'batsu' : 'maru');
  }

  if (!raw || raw.length === 0) {
    return createDefaultChoices();
  }

  return raw.map((c, i) => ({
    id: String(i + 1),
    choiceText: (c.choiceText ?? `選択肢 ${i + 1}`).trim(),
    isCorrect: Boolean(c.isCorrect),
    selectedCount: 0,
  }));
}

function mapSortingItems(raw: AiQuestionJsonItem['sortingItems']): SortingItem[] {
  if (!raw || raw.length < 2) {
    return [
      { id: '1', text: '要素 1', correctOrder: 0 },
      { id: '2', text: '要素 2', correctOrder: 1 },
    ];
  }

  // 初期マッピングを行う
  const mapped = raw.map((item, i) => ({
    id: String(i + 1),
    text: (item.text ?? `要素 ${i + 1}`).trim(),
    correctOrder: Number.isInteger(item.correctOrder) ? item.correctOrder! : i,
  }));

  // correctOrder の値でソートする（安定ソートにするために元のインデックスも考慮）
  const sorted = [...mapped].sort((a, b) => {
    if (a.correctOrder !== b.correctOrder) {
      return a.correctOrder - b.correctOrder;
    }
    return Number(a.id) - Number(b.id);
  });

  // ソートされた順序に基づいて、0 から始まる連番を correctOrder に再設定する。
  // これにより、AIが 1始まり（1, 2, 3...）で生成した場合や、重複があった場合でも
  // システムが要求する 0 〜 (length-1) の一意な整数値に正規化され、バリデーションエラーを確実に防ぎます。
  sorted.forEach((item, index) => {
    const originalItem = mapped.find((m) => m.id === item.id);
    if (originalItem) {
      originalItem.correctOrder = index;
    }
  });

  return mapped;
}

function mapSingleAiItem(item: AiQuestionJsonItem, format: QuizFormat): Question {
  const type = item.type ?? (format === 'mixed' ? 'multiple-choice' : format);
  if (!isTypeAllowedForFormat(type, format)) {
    throw new Error(`invalid-type:${type}`);
  }

  const question: Question = {
    id: Math.random().toString(36).substring(2, 11),
    type: type as Question['type'],
    questionText: (item.questionText ?? '').trim(),
    explanation: (item.explanation ?? '').trim(),
    imageUrl: null,
    hint: item.hint?.trim() || null,
    limitTime: null,
    correctCount: 0,
    incorrectCount: 0,
  };

  if (question.type === 'multiple-choice' || question.type === 'true-false') {
    question.choices = mapChoices(item.choices, question.type);
  } else if (
    question.type === 'text-input' ||
    question.type === 'quick-press' ||
    question.type === 'association'
  ) {
    const answers = (item.correctTextAnswerList ?? []).map((a) => a.trim()).filter(Boolean);
    question.correctTextAnswerList =
      answers.length > 0 ? answers : ['正解テキスト'];
    if (question.type === 'association') {
      question.associationHints =
        (item.associationHints ?? []).map((h) => h.trim()).filter(Boolean).length > 0
          ? item.associationHints!.map((h) => h.trim()).filter(Boolean)
          : ['ヒント 1'];
    }
  } else if (question.type === 'sorting') {
    question.sortingItems = mapSortingItems(item.sortingItems);
  }

  return question;
}

export function mapAiJsonToQuestions(raw: unknown, format: Quiz['format']): Question[] {
  if (!format) {
    throw new Error('invalid-format');
  }

  let items: AiQuestionJsonItem[];
  if (Array.isArray(raw)) {
    items = raw as AiQuestionJsonItem[];
  } else if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as { questions?: unknown }).questions)
  ) {
    items = (raw as { questions: AiQuestionJsonItem[] }).questions;
  } else {
    throw new Error('invalid-json');
  }

  if (items.length !== AI_QUIZ_QUESTION_COUNT) {
    throw new Error('invalid-count');
  }

  return items.map((item) => mapSingleAiItem(item, format as QuizFormat));
}
