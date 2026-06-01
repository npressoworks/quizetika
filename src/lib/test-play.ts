import { Question, QuestionAnswerRecord, Quiz } from '@/types';

export const TEST_PLAY_PAYLOAD_KEY = 'quizeum_test_play_payload';
export const TEST_PLAY_RESULT_KEY = 'quizeum_test_play_result';
export const TEST_PLAY_QUIZ_ID = 'test-play';
export const TEST_PLAY_TTL_MS = 24 * 60 * 60 * 1000;

export interface TestPlayPayload {
  quizDraft: Omit<Quiz, 'id'> & { id?: string };
  sourcePath: string;
  authorId: string;
  createdAt: number;
}

export interface TestPlayResult {
  questionAnswers: QuestionAnswerRecord[];
  correctCount: number;
  totalQuestions: number;
  elapsedSeconds: number;
  completedAt: number;
  failedQuestionIds: string[];
}

export function getPlayableQuestions(questions: Question[]): Question[] {
  return questions.filter((q) => q.questionText.trim().length > 0);
}

export function hasPlayableQuestions(questions: Question[]): boolean {
  return getPlayableQuestions(questions).length > 0;
}

export function canJudgeQuestion(q: Question): boolean {
  switch (q.type) {
    case 'multiple-choice':
    case 'true-false':
      return (q.choices?.some((c) => c.isCorrect) ?? false);
    case 'text-input':
    case 'association':
    case 'quick-press':
      return (q.correctTextAnswerList?.some((a) => a.trim().length > 0) ?? false);
    case 'sorting':
      return (q.sortingItems?.length ?? 0) >= 2;
    case 'lateral-thinking':
      return (q.truthKeywords?.some((k) => k.trim().length > 0) ?? false);
    default:
      return false;
  }
}

function obfuscateQuickPressQuestion(q: Question): Question {
  if (q.type !== 'quick-press') return q;
  return {
    ...q,
    questionText: btoa(unescape(encodeURIComponent(q.questionText))),
    correctTextAnswerList:
      q.correctTextAnswerList?.map((ans) => btoa(unescape(encodeURIComponent(ans)))) ?? [],
  };
}

export function prepareQuizForTestPlay(
  draft: Omit<Quiz, 'id'> & { id?: string }
): Quiz {
  const playable = getPlayableQuestions(draft.questions).map(obfuscateQuickPressQuestion);
  const now = new Date();
  return {
    id: TEST_PLAY_QUIZ_ID,
    authorId: draft.authorId,
    authorName: draft.authorName,
    authorAvatar: draft.authorAvatar,
    title: draft.title.trim() || '（無題のテストプレイ）',
    description: draft.description,
    thumbnailUrl: draft.thumbnailUrl,
    difficulty: draft.difficulty,
    genre: draft.genre || '',
    tags: draft.tags ?? [],
    originalTags: draft.originalTags ?? [],
    questionIds: playable.map((q) => q.id),
    questions: playable,
    questionCount: playable.length,
    status: 'draft',
    flagsCount: 0,
    playCount: 0,
    bookmarksCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: null,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: draft.canonicalGenreId ?? '',
    canonicalTagIds: draft.canonicalTagIds ?? [],
    leaderboard: [],
    format: draft.format,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildTestPlayPayload(
  draft: Omit<Quiz, 'id'> & { id?: string },
  sourcePath: string,
  authorId: string
): TestPlayPayload {
  return {
    quizDraft: draft,
    sourcePath,
    authorId,
    createdAt: Date.now(),
  };
}

export function saveTestPlayPayload(payload: TestPlayPayload): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TEST_PLAY_PAYLOAD_KEY, JSON.stringify(payload));
}

export function loadTestPlayPayload(expectedAuthorId: string): TestPlayPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(TEST_PLAY_PAYLOAD_KEY);
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as TestPlayPayload;
    if (payload.authorId !== expectedAuthorId) return null;
    if (Date.now() - payload.createdAt > TEST_PLAY_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function saveTestPlayResult(result: TestPlayResult): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TEST_PLAY_RESULT_KEY, JSON.stringify(result));
}

export function loadTestPlayResult(): TestPlayResult | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(TEST_PLAY_RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TestPlayResult;
  } catch {
    return null;
  }
}

export function clearTestPlaySession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TEST_PLAY_PAYLOAD_KEY);
  sessionStorage.removeItem(TEST_PLAY_RESULT_KEY);
}

/** 水平思考：truthKeywords のローカル部分一致判定 */
export function checkTruthKeywordsLocally(truthText: string, keywords: string[]): boolean {
  if (!keywords.length) return false;
  const normalized = truthText
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return keywords.every((kw) => {
    const nkw = kw
      .toLowerCase()
      .replace(/[\s\u3000]/g, '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    return normalized.includes(nkw);
  });
}
