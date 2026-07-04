import { toggleReaction, getSentReactions, getReceivedReactions } from '@/services/reaction';

// チェーン用のモックヘルパー (bookmark.test.ts と同様のパターン)
const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
    then: jest.fn((onFulfilled: any) => {
      return Promise.resolve(resolveValue).then(onFulfilled);
    }),
  };
  return chain;
};

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(() => mock),
    in: jest.fn(() => mock),
    order: jest.fn(() => mock),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    rpc: jest.fn(),
  };
  return {
    createClient: () => mock,
  };
});

import { createClient } from '@/lib/supabase/client';
const mockSupabase = createClient() as any;

describe('ReactionService', () => {
  const senderId = 'player-uid';
  const quizId = 'quiz-uid';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.in.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  describe('toggleReaction', () => {
    test('handle_toggle_reaction RPC を正しい引数で呼び出し、追加時は true を返すこと', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await toggleReaction(senderId, quizId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_toggle_reaction', {
        p_sender_id: senderId,
        p_quiz_id: quizId,
      });
      expect(result).toBe(true);
    });

    test('既にリアクション済みの場合、RPCが解除結果(false)を返し、トグルオフとして扱われること', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: false, error: null });

      const result = await toggleReaction(senderId, quizId);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('handle_toggle_reaction', {
        p_sender_id: senderId,
        p_quiz_id: quizId,
      });
      expect(result).toBe(false);
    });

    test('RPCがエラーを返した場合、例外を投げること', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

      await expect(toggleReaction(senderId, quizId)).rejects.toThrow();
    });
  });

  describe('getSentReactions', () => {
    test('自分が送信したリアクション履歴を降順で取得し、クイズタイトルを付与すること', async () => {
      const receiverId = 'author-1';
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'reactions') {
          return createChainMock({
            data: [
              {
                sender_id: senderId,
                receiver_id: receiverId,
                quiz_id: quizId,
                type: 'like',
                created_at: '2026-05-29T10:00:00.000Z',
              },
            ],
            error: null,
          });
        }
        if (table === 'quizzes') {
          return createChainMock({
            data: [{ id: quizId, title: 'テストクイズ' }],
            error: null,
          });
        }
        return mockSupabase;
      });

      const list = await getSentReactions(senderId);

      expect(mockSupabase.from).toHaveBeenCalledWith('reactions');
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        id: `${senderId}_${quizId}_like`,
        senderId,
        receiverId,
        quizId,
        quizTitle: 'テストクイズ',
        type: 'like',
        createdAt: new Date('2026-05-29T10:00:00.000Z'),
      });
    });

    test('データが存在しない場合、空配列を返すこと', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'reactions') {
          return createChainMock({ data: [], error: null });
        }
        return mockSupabase;
      });

      const list = await getSentReactions(senderId);
      expect(list).toEqual([]);
    });
  });

  describe('getReceivedReactions', () => {
    test('作家として自作クイズに獲得したリアクション履歴を降順で取得し、クイズタイトルを付与すること', async () => {
      const receiverId = 'author-1';
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'reactions') {
          return createChainMock({
            data: [
              {
                sender_id: senderId,
                receiver_id: receiverId,
                quiz_id: quizId,
                type: 'like',
                created_at: '2026-05-29T10:00:00.000Z',
              },
            ],
            error: null,
          });
        }
        if (table === 'quizzes') {
          return createChainMock({
            data: [{ id: quizId, title: 'テストクイズ' }],
            error: null,
          });
        }
        return mockSupabase;
      });

      const list = await getReceivedReactions(receiverId);

      expect(mockSupabase.from).toHaveBeenCalledWith('reactions');
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        id: `${senderId}_${quizId}_like`,
        senderId,
        receiverId,
        quizId,
        quizTitle: 'テストクイズ',
        type: 'like',
        createdAt: new Date('2026-05-29T10:00:00.000Z'),
      });
    });
  });
});
