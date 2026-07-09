import { saveQuiz, updateQuiz } from '../../src/services/quiz';

/**
 * Phase 39 (要件32): クイズ公開処理が NGワードマスタ読み取りサービス
 * (`listActiveNgWords()`) を経由して禁止語チェックを行うことを検証する。
 *
 * `ng-words.ts` は `@/lib/supabase/client` の `createClient()` を用いて
 * `ng_words` テーブルを参照するため、既存のクイズ系テスト（quiz-metadata-save.test.ts）
 * と同じチェーン形式の Supabase モックを使い、`ng_words` テーブルへのクエリだけ
 * 個別の結果を返せるようにする。
 */

jest.mock('@/lib/supabase/client', () => {
  const state: {
    currentTable: string;
    ngWordsResponse: { data: { word: string }[] | null; error: { message: string } | null };
  } = {
    currentTable: '',
    ngWordsResponse: { data: [], error: null },
  };

  const mock: any = {
    __state: state,
    from: jest.fn((table: string) => {
      state.currentTable = table;
      return mock;
    }),
    insert: jest.fn(() => mock),
    update: jest.fn(() => mock),
    delete: jest.fn(() => mock),
    in: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    upsert: jest.fn(() => mock),
    select: jest.fn(() => mock),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    // `.eq()` チェーンの終端で await されるクエリ（`ng_words` の SELECT など）は
    // thenable プロトコル経由でここに到達する。テーブル名に応じて結果を出し分ける。
    then: jest.fn((onFulfilled: any, onRejected?: any) => {
      if (state.currentTable === 'ng_words') {
        return Promise.resolve(state.ngWordsResponse).then(onFulfilled, onRejected);
      }
      return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
    }),
  };
  return { createClient: () => mock };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;
const ngWordsState = mockSupabase.__state as {
  currentTable: string;
  ngWordsResponse: { data: { word: string }[] | null; error: { message: string } | null };
};

jest.mock('../../src/lib/metadata-resolution', () => {
  const actual = jest.requireActual('../../src/lib/metadata-resolution');
  return {
    ...actual,
    applyQuizMetadataFields: jest.fn().mockResolvedValue({
      canonicalGenreId: 'programming',
      canonicalTagIds: ['react'],
    }),
  };
});

const baseSaveQuiz = {
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

function buildQuizRow(overrides: Record<string, any> = {}) {
  return {
    id: 'quiz-1',
    author_id: 'author-1',
    author_name: 'Author',
    author_avatar: '',
    title: 'Original Title',
    description: '',
    thumbnail_url: null,
    difficulty: 5,
    genre: 'programming',
    question_count: 1,
    status: 'draft',
    visibility: 'public',
    flags_count: 0,
    play_count: 0,
    bookmarks_count: 0,
    positive_count: 0,
    negative_count: 0,
    temp_positive_count: 0,
    temp_negative_count: 0,
    review_score: null,
    canonical_genre_id: 'programming',
    format: null,
    is_review_masked: false,
    review_badge: null,
    active_reset_request_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    quiz_tags: [],
    quiz_questions: [
      {
        display_order: 0,
        question: {
          id: 'q1',
          owner_quiz_id: 'quiz-1',
          link_kind: null,
          author_id: 'author-1',
          author_name: 'Author',
          author_avatar: '',
          type: 'true-false',
          question_text: 'Sample question text here',
          explanation: '',
          image_url: null,
          hint: null,
          limit_time: null,
          correct_text_answer_list: null,
          text_input_mode: null,
          text_input_char_count: null,
          choices: [
            { id: 'c1', choiceText: 'Yes', isCorrect: true, selectedCount: 0 },
            { id: 'c2', choiceText: 'No', isCorrect: false, selectedCount: 0 },
          ],
          sorting_items: null,
          association_hints: null,
          ai_context_details: null,
          truth_keywords: null,
          source_url: null,
          correct_count: 0,
          incorrect_count: 0,
          bookmarks_count: 0,
        },
      },
    ],
    ...overrides,
  };
}

describe('quiz publish flow: NGワードマスタ参照統合 (要件32.1-32.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ngWordsState.currentTable = '';
    ngWordsState.ngWordsResponse = { data: [], error: null };
  });

  describe('saveQuiz', () => {
    test('published: listActiveNgWords() で取得した語句がタイトルに含まれる場合、公開が拒否されクイズが永続化されない', async () => {
      ngWordsState.ngWordsResponse = { data: [{ word: 'spam' }], error: null };

      await expect(
        saveQuiz({ ...baseSaveQuiz, title: 'Spam Quiz' } as any, 'published')
      ).rejects.toThrow(/不適切なワード/);

      // ng_words マスタを参照したこと
      expect(mockSupabase.from).toHaveBeenCalledWith('ng_words');
      // バリデーションで弾かれ、クイズ本体が永続化されていないこと（フェイルクローズと同様、未検証のまま公開しない）
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    test('published: NGワードマスタの取得自体が失敗した場合、エラーで中断されクイズが公開されない（フェイルクローズ）', async () => {
      ngWordsState.ngWordsResponse = {
        data: null,
        error: { message: 'network error' },
      };

      await expect(
        saveQuiz({ ...baseSaveQuiz, title: 'Clean Title' } as any, 'published')
      ).rejects.toThrow(/NGワード一覧の取得に失敗しました/);

      expect(mockSupabase.from).toHaveBeenCalledWith('ng_words');
      // 未検証のまま公開されていない（quizzes への insert が一切発生しない）
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    test('published: マスタ上に該当語句がなければ、取得した一覧で検証した上で公開が成功する', async () => {
      ngWordsState.ngWordsResponse = { data: [{ word: 'spam' }], error: null };

      const quizId = await saveQuiz(
        { ...baseSaveQuiz, title: 'Clean Title' } as any,
        'published'
      );

      expect(quizId).toBeTruthy();
      expect(mockSupabase.from).toHaveBeenCalledWith('ng_words');
      expect(mockSupabase.from).toHaveBeenCalledWith('quizzes');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    test('draft: 下書き保存では NGワードマスタを参照しない', async () => {
      const quizId = await saveQuiz({ ...baseSaveQuiz } as any, 'draft');

      expect(quizId).toBeTruthy();
      expect(mockSupabase.from).not.toHaveBeenCalledWith('ng_words');
    });
  });

  describe('updateQuiz', () => {
    test('published: listActiveNgWords() で取得した語句がタイトルに含まれる場合、公開が拒否されクイズが更新されない', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: buildQuizRow(), error: null });
      ngWordsState.ngWordsResponse = { data: [{ word: 'spam' }], error: null };

      await expect(
        updateQuiz('quiz-1', { status: 'published', title: 'Spam Quiz' } as any)
      ).rejects.toThrow(/不適切なワード/);

      expect(mockSupabase.from).toHaveBeenCalledWith('ng_words');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    test('published: NGワードマスタの取得自体が失敗した場合、エラーで中断されクイズが更新されない（フェイルクローズ）', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: buildQuizRow(), error: null });
      ngWordsState.ngWordsResponse = {
        data: null,
        error: { message: 'network error' },
      };

      await expect(
        updateQuiz('quiz-1', { status: 'published' } as any)
      ).rejects.toThrow(/NGワード一覧の取得に失敗しました/);

      expect(mockSupabase.from).toHaveBeenCalledWith('ng_words');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    test('published: マスタ上に該当語句がなければ、取得した一覧で検証した上で更新が成功する', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: buildQuizRow(), error: null });
      ngWordsState.ngWordsResponse = { data: [{ word: 'spam' }], error: null };

      await expect(
        updateQuiz('quiz-1', { status: 'published' } as any)
      ).resolves.toBeUndefined();

      expect(mockSupabase.from).toHaveBeenCalledWith('ng_words');
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    test('draft: 下書き保存では NGワードマスタを参照しない', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: buildQuizRow({ status: 'draft' }),
        error: null,
      });

      await expect(
        updateQuiz('quiz-1', { status: 'draft', title: 'Updated Title' } as any)
      ).resolves.toBeUndefined();

      expect(mockSupabase.from).not.toHaveBeenCalledWith('ng_words');
    });
  });
});
