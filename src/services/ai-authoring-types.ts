import type { Quiz } from '@/types';
import type { QuizFormat } from '@/lib/quiz-format';

export const AI_QUIZ_PROMPT_MAX_LENGTH = 500;
export const AI_QUIZ_QUESTION_COUNT = 10;
export const PRO_DAILY_QUESTION_GENERATION_LIMIT = 100;
export const PRO_DAILY_THUMBNAIL_GENERATION_LIMIT = 20;
export const PRO_DAILY_CHAT_LIMIT = 100;
export const DAILY_AUTHORING_DOC_QUESTIONS = 'questions';
export const DAILY_AUTHORING_DOC_THUMBNAIL = 'thumbnail';
export const DAILY_AUTHORING_DOC_CHAT = 'chat';

export const MIXED_ALLOWED_QUESTION_TYPES = [
  'multiple-choice',
  'true-false',
  'text-input',
  'sorting',
  'association',
] as const;

export type MixedAllowedQuestionType = (typeof MIXED_ALLOWED_QUESTION_TYPES)[number];

export interface AiAuthoringUsage {
  limit: number | null;
  usedToday: number;
  remainingToday: number | null;
}

export interface AssertAiAuthoringAccessResult {
  uid: string;
  hasPaidEntitlements: boolean;
  isModeratorExempt: boolean;
  skipDailyLimit: boolean;
}

export interface DailyAiAuthoringCountDoc {
  count?: number;
  lastUpdatedDate?: string;
}

export interface AiGenerateQuestionsRequest {
  prompt: string;
  format: QuizFormat;
  title?: string;
  description?: string;
  genre?: string;
  userId: string;
}

export interface AiGenerateQuestionsResponse {
  questions: Quiz['questions'];
  usage: AiAuthoringUsage;
}

export interface AiGenerateThumbnailRequest {
  title: string;
  description: string;
  quizId?: string;
  userId: string;
}

export interface AiGenerateThumbnailResponse {
  thumbnailUrl: string;
  usage: AiAuthoringUsage;
}

export interface AiAuthoringUsageResponse {
  questions: AiAuthoringUsage;
  thumbnail: AiAuthoringUsage;
  chat: AiAuthoringUsage;
}
