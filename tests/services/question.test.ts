/**
 * question service - getQuestionsByQuiz / updateQuestionOrder (正規化スキーマ版)
 */

import { getQuestionsByQuiz, updateQuestionOrder } from '@/services/question';

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    in: jest.fn(() => mock),
    order: jest.fn(() => mock),
    rpc: jest.fn(),
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
    mockSupabase.order.mockClear();
    mockSupabase.rpc.mockReset();

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
  });

  it('quiz_questions の display_order 順に問題を返す', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { question_id: 'q-2', display_order: 0 },
        { question_id: 'q-1', display_order: 1 },
      ],
      error: null,
    });

    mockSupabase.in.mockResolvedValueOnce({
      data: [
        { id: 'q-1', question_text: '個別問題1', type: 'multiple-choice', correct_count: 0, incorrect_count: 0 },
        { id: 'q-2', question_text: '個別問題2', type: 'multiple-choice', correct_count: 0, incorrect_count: 0 },
      ],
      error: null,
    });

    const questions = await getQuestionsByQuiz(quizId);

    expect(questions).toHaveLength(2);
    expect(questions[0].questionText).toBe('個別問題2');
    expect(questions[1].questionText).toBe('個別問題1');
    expect(mockSupabase.from).toHaveBeenCalledWith('quiz_questions');
  });

  it('quiz_questions に紐づく問題が存在しない場合は空配列を返す', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [], error: null });

    const questions = await getQuestionsByQuiz(quizId);

    expect(questions).toHaveLength(0);
  });

  it('questions テーブル側に一部の問題が欠落していても取得できた分のみ返す', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { question_id: 'q-1', display_order: 0 },
        { question_id: 'q-2', display_order: 1 },
      ],
      error: null,
    });

    mockSupabase.in.mockResolvedValueOnce({
      data: [
        { id: 'q-1', question_text: '個別問題1', type: 'multiple-choice', correct_count: 0, incorrect_count: 0 },
      ],
      error: null,
    });

    const questions = await getQuestionsByQuiz(quizId);

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('q-1');
  });
});

describe('question service - updateQuestionOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.rpc.mockReset();
  });

  it('handle_reorder_questions RPC を正しい引数で呼び出す', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: 2, error: null });

    await updateQuestionOrder('quiz-123', ['q-2', 'q-1']);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_reorder_questions', {
      p_quiz_id: 'quiz-123',
      p_question_ids: ['q-2', 'q-1'],
    });
  });

  it('RPCがエラーを返した場合は例外を投げる', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Question set does not match quiz_questions membership' },
    });

    await expect(updateQuestionOrder('quiz-123', ['q-x'])).rejects.toThrow(
      '問題の並び替えに失敗しました'
    );
  });
});
