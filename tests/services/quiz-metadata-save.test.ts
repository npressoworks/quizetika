import { saveQuiz } from '../../src/services/quiz';
import { MetadataValidationError } from '../../src/lib/metadata-resolution';

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    insert: jest.fn(() => mock),
    delete: jest.fn(() => mock),
    in: jest.fn(() => mock),
    select: jest.fn(() => mock),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    then: jest.fn((onFulfilled) => Promise.resolve({ data: null, error: null }).then(onFulfilled)),
  };
  return {
    createClient: () => mock,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

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
    mockSupabase.from.mockClear();
    mockSupabase.insert.mockClear();
    mockSupabase.delete.mockClear();
    mockSupabase.in.mockClear();
    mockSupabase.select.mockClear();
    mockSupabase.maybeSingle.mockReset();

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.delete.mockReturnValue(mockSupabase);
    mockSupabase.in.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
  });

  test('下書き保存時に canonical フィールドが埋め込まれる', async () => {
    // maybeSingle がユーザー情報取得 (enforceVisibilityEntitlement) とタグ・ジャンルチェックで呼ばれます
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { subscription_tier: 'free' }, error: null }) // user
      .mockResolvedValueOnce({ data: { id: 'react' }, error: null }); // tag checks inside ensureTagMasters

    // insert 呼び出し時のモック
    mockSupabase.insert
      .mockResolvedValueOnce({ data: [], error: null }) // questions
      .mockResolvedValueOnce({ data: [], error: null }); // quizzes

    await saveQuiz(baseQuiz as any, 'draft');

    expect(applyQuizMetadataFields).toHaveBeenCalledWith(
      'programming',
      ['react'],
      'author-1'
    );

    // quizzes への insert 引数を検証
    expect(mockSupabase.from).toHaveBeenCalledWith('quizzes');
    expect(mockSupabase.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canonical_genre_id: 'programming',
        canonical_tag_ids: ['react'],
      })
    );
  });

  test('無効ジャンルは validation-error で拒否', async () => {
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { subscription_tier: 'free' }, error: null }); // user

    (applyQuizMetadataFields as jest.Mock).mockRejectedValueOnce(
      new MetadataValidationError('選択されたジャンルはマスタに存在しないか、無効です', 'genre')
    );

    await expect(saveQuiz(baseQuiz as any, 'draft')).rejects.toThrow(MetadataValidationError);
  });
});
