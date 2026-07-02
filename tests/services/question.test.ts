/**
 * question service - getQuestionsByQuiz (Supabase 移行版)
 */

import { getQuestionsByQuiz } from '@/services/question';

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    in: jest.fn(() => mock),
    maybeSingle: jest.fn(),
  };
  return {
    createClient: () => mock,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

describe('question service - getQuestionsByQuiz', () => {
  const quizId = 'quiz-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockClear();
    mockSupabase.select.mockClear();
    mockSupabase.eq.mockClear();
    mockSupabase.in.mockClear();
    mockSupabase.maybeSingle.mockReset();

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.in.mockReturnValue(mockSupabase);
  });

  it('問題の個別ドキュメントがすべて正常に存在する場合はそれらを返す', async () => {
    // クイズデータのモック（個別問題IDが2つ存在する）
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: {
        id: quizId,
        question_ids: ['q-1', 'q-2'],
        questions: [
          { id: 'q-1', questionText: '親ドキュメント内の問題1' },
          { id: 'q-2', questionText: '親ドキュメント内の問題2' },
        ],
      },
      error: null,
    });

    // 個別問題ドキュメントが正常に2件返ってくるモック
    mockSupabase.in.mockResolvedValueOnce({
      data: [
        { id: 'q-1', question_text: '個別問題1', type: 'multiple-choice' },
        { id: 'q-2', question_text: '個別問題2', type: 'multiple-choice' },
      ],
      error: null,
    });

    const questions = await getQuestionsByQuiz(quizId);

    expect(questions).toHaveLength(2);
    expect(questions[0].questionText).toBe('個別問題1');
    expect(questions[1].questionText).toBe('個別問題2');
  });

  it('問題の個別ドキュメントが欠落している（不整合）場合は、親の非正規化コピーをフォールバックとして返す', async () => {
    // クイズデータのモック
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: {
        id: quizId,
        question_ids: ['q-1', 'q-2'],
        questions: [
          { id: 'q-1', questionText: '親ドキュメント内の問題1' },
          { id: 'q-2', questionText: '親ドキュメント内の問題2' },
        ],
      },
      error: null,
    });

    // 個別問題ドキュメントが1件しか返ってこない（q-2が欠落している）モック
    mockSupabase.in.mockResolvedValueOnce({
      data: [
        { id: 'q-1', question_text: '個別問題1', type: 'multiple-choice' },
      ],
      error: null,
    });

    const questions = await getQuestionsByQuiz(quizId);

    // フォールバックにより親ドキュメント内の問題コピー（2件）が返ることを確認
    expect(questions).toHaveLength(2);
    expect(questions[0].questionText).toBe('親ドキュメント内の問題1');
    expect(questions[1].questionText).toBe('親ドキュメント内の問題2');
  });
});
