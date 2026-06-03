jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

import { saveQuiz } from '../../src/services/quiz';
import { MetadataValidationError } from '../../src/lib/metadata-resolution';

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  const batchSet = jest.fn();
  const batchCommit = jest.fn().mockResolvedValue(undefined);
  return {
    ...original,
    doc: jest.fn(() => ({ id: 'new-quiz-id' })),
    collection: jest.fn((_db, path) => ({ path })),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    writeBatch: jest.fn(() => ({ set: batchSet, commit: batchCommit })),
    setDoc: jest.fn(),
  };
});

jest.mock('../../src/lib/metadata-resolution', () => {
  const actual = jest.requireActual('../../src/lib/metadata-resolution');
  return {
    ...actual,
    applyQuizMetadataFields: jest.fn().mockResolvedValue({
      canonicalGenreId: 'programming',
      canonicalTagIds: ['react'],
    }),
    assertActiveGenre: jest.fn(),
    ensureTagMasters: jest.fn(),
    resolveCanonicalGenreId: jest.fn(),
    resolveCanonicalTagIds: jest.fn(),
  };
});

import { writeBatch } from 'firebase/firestore';
import { applyQuizMetadataFields } from '../../src/lib/metadata-resolution';

const baseQuiz = {
  authorId: 'author-1',
  authorName: 'Author',
  authorAvatar: '',
  title: 'Test Quiz',
  description: '',
  thumbnailUrl: null,
  difficulty: 5,
  genre: 'programming',
  tags: ['react'],
  originalTags: ['React'],
  questions: [
    {
      id: 'q1',
      type: 'true-false' as const,
      questionText: 'Sample question text here',
      explanation: '',
      imageUrl: null,
      hint: null,
      limitTime: null,
      correctCount: 0,
      incorrectCount: 0,
      choices: [
        { id: 'c1', choiceText: 'Yes', isCorrect: true, selectedCount: 0 },
        { id: 'c2', choiceText: 'No', isCorrect: false, selectedCount: 0 },
      ],
    },
  ],
  questionIds: [],
  questionCount: 1,
  status: 'draft' as const,
  flagsCount: 0,
  positiveCount: 0,
  negativeCount: 0,
  tempPositiveCount: 0,
  tempNegativeCount: 0,
  reviewScore: null,
  reviewBadge: null,
  isReviewMasked: false,
  activeResetRequestId: null,
  canonicalGenreId: '',
  canonicalTagIds: [],
  leaderboardFirstPlay: [],
  leaderboardReplay: [],
};

describe('saveQuiz metadata integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('下書き保存時に canonical フィールドが埋め込まれる', async () => {
    await saveQuiz(baseQuiz as any, 'draft');

    expect(applyQuizMetadataFields).toHaveBeenCalledWith(
      'programming',
      ['react'],
      'author-1'
    );

    const batch = (writeBatch as jest.Mock).mock.results[0].value;
    const payload = batch.set.mock.calls.find(
      (call: unknown[]) => call[1]?.canonicalGenreId === 'programming'
    )?.[1];
    expect(payload?.canonicalGenreId).toBe('programming');
    expect(payload?.canonicalTagIds).toEqual(['react']);
  });

  test('無効ジャンルは validation-error で拒否', async () => {
    (applyQuizMetadataFields as jest.Mock).mockRejectedValueOnce(
      new MetadataValidationError('選択されたジャンルはマスタに存在しないか、無効です', 'genre')
    );

    await expect(saveQuiz(baseQuiz as any, 'draft')).rejects.toThrow(MetadataValidationError);
  });
});
