import { 
  sendReaction, 
  getSentReactions, 
  getReceivedReactions 
} from '../../src/services/reaction';
import { runTransaction, doc, getDocs } from 'firebase/firestore';

// Firebase Firestore モック
jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((ref, ...paths) => {
      const id = paths.length > 0 ? paths[paths.length - 1] : 'auto-generated-id';
      return { id, path: paths.join('/') };
    }),
    collection: jest.fn((db, path) => ({ path })),
    query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    orderBy: jest.fn((field, dir) => ({ field, dir })),
    getDocs: jest.fn(),
    increment: jest.fn((n) => n),
    runTransaction: jest.fn(),
  };
});

describe('ReactionService', () => {
  const senderId = 'player-uid';
  const receiverId = 'creator-uid';
  const quizId = 'quiz-uid';
  const type = 'thank' as const;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendReaction', () => {
    test('自分自身には送信不可であること', async () => {
      await sendReaction(senderId, senderId, quizId, type);
      expect(runTransaction).not.toHaveBeenCalled();
    });

    test('新規リアクション送信時に、アトミック登録および作家の累計獲得数がインクリメントされること', async () => {
      const mockReactionSnap = { exists: () => false };
      const mockQuizSnap = { 
        exists: () => true,
        data: () => ({ title: 'クイズ名' })
      };
      const mockUserSnap = { exists: () => true };

      const mockTransaction = {
        get: jest.fn().mockImplementation((ref) => {
          if (ref.id === `${senderId}_${quizId}_${type}`) return mockReactionSnap;
          if (ref.id === quizId) return mockQuizSnap;
          if (ref.id === receiverId) return mockUserSnap;
          return null;
        }),
        set: jest.fn(),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation((db, callback) => {
        return callback(mockTransaction);
      });

      await sendReaction(senderId, receiverId, quizId, type);

      expect(mockTransaction.get).toHaveBeenCalledTimes(3);
      expect(mockTransaction.set).toHaveBeenCalledTimes(1);
      expect(mockTransaction.update).toHaveBeenCalledTimes(1);

      // リアクションの登録データを検証
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ id: `${senderId}_${quizId}_${type}` }),
        expect.objectContaining({
          senderId,
          receiverId,
          quizId,
          quizTitle: 'クイズ名',
          type,
        })
      );

      // 作家アトミック加算の検証
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: receiverId }),
        { totalReactionsCount: 1 } // increment(1) のダミー
      );
    });

    test('既にリアクションが送信済みの場合は、何も処理しないこと (二重投票防止)', async () => {
      const mockReactionSnap = { exists: () => true };

      const mockTransaction = {
        get: jest.fn().mockReturnValue(mockReactionSnap),
        set: jest.fn(),
        update: jest.fn(),
      };

      (runTransaction as jest.Mock).mockImplementation((db, callback) => {
        return callback(mockTransaction);
      });

      await sendReaction(senderId, receiverId, quizId, type);

      expect(mockTransaction.get).toHaveBeenCalledTimes(1);
      expect(mockTransaction.set).not.toHaveBeenCalled();
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });
  });

  describe('getSentReactions', () => {
    test('自分が送信したリアクション履歴を降順で取得できること', async () => {
      const mockDocs = [
        {
          id: `${senderId}_${quizId}_${type}`,
          data: () => ({
            senderId,
            receiverId,
            quizId,
            quizTitle: 'テストクイズ',
            type: 'thank',
            createdAt: { toDate: () => new Date('2026-05-29T10:00:00Z') },
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

      const list = await getSentReactions(senderId);

      expect(getDocs).toHaveBeenCalled();
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        id: `${senderId}_${quizId}_${type}`,
        senderId,
        receiverId,
        quizId,
        quizTitle: 'テストクイズ',
        type: 'thank',
        createdAt: new Date('2026-05-29T10:00:00Z'),
      });
    });
  });

  describe('getReceivedReactions', () => {
    test('作家として自作クイズに獲得したリアクション履歴を降順で取得できること', async () => {
      const mockDocs = [
        {
          id: `${senderId}_${quizId}_${type}`,
          data: () => ({
            senderId,
            receiverId,
            quizId,
            quizTitle: 'テストクイズ',
            type: 'thank',
            createdAt: { toDate: () => new Date('2026-05-29T10:00:00Z') },
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({ docs: mockDocs });

      const list = await getReceivedReactions(receiverId);

      expect(getDocs).toHaveBeenCalled();
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        id: `${senderId}_${quizId}_${type}`,
        senderId,
        receiverId,
        quizId,
        quizTitle: 'テストクイズ',
        type: 'thank',
        createdAt: new Date('2026-05-29T10:00:00Z'),
      });
    });
  });
});
