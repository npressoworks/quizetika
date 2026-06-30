import {
  getBookmarkedQuizzes,
  toggleBookmark,
  InvalidBookmarkTargetError,
} from '@/services/bookmark';
import { getDoc, getDocs } from 'firebase/firestore';
import { createNotification } from '@/services/notification';

jest.mock('@/services/notification', () => ({
  createNotification: jest.fn(),
}));

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    doc: jest.fn((_ref, ...paths) => ({ id: paths[paths.length - 1] })),
    runTransaction: jest.fn(),
  };
});

describe('bookmark service', () => {
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_ENV = 'development';
  });

  it('getBookmarkedQuizzes はドキュメント ID でクイズを解決する（id フィールド in クエリに依存しない）', async () => {
    (getDocs as jest.Mock).mockImplementation(async () => {
      const callCount = (getDocs as jest.Mock).mock.calls.length;
      if (callCount === 1) {
        return {
          docs: [
            {
              data: () => ({
                userId,
                targetId: 'quiz-a',
                targetType: 'quiz',
                createdAt: new Date('2026-06-01'),
              }),
            },
          ],
          forEach(callback: any) {
            this.docs.forEach(callback);
          }
        };
      } else {
        return {
          docs: [
            {
              id: 'quiz-a',
              data: () => ({
                id: 'quiz-a',
                title: 'テストクイズ',
                status: 'published',
              }),
            },
          ],
          forEach(callback: any) {
            this.docs.forEach(callback);
          }
        };
      }
    });

    const quizzes = await getBookmarkedQuizzes(userId);

    expect(getDocs).toHaveBeenCalledTimes(2);
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0].id).toBe('quiz-a');
    expect(quizzes[0].title).toBe('テストクイズ');
  });

  it('toggleBookmark は targetType=list を拒否する', async () => {
    await expect(
      toggleBookmark(userId, 'list-a', 'list' as 'quiz')
    ).rejects.toBeInstanceOf(InvalidBookmarkTargetError);
  });

  it('toggleBookmark はクイズ（targetType=quiz）が追加された時、作成者へ通知を作成する', async () => {
    const mockQuiz = {
      id: 'quiz-a',
      title: 'テストクイズ',
      authorId: 'author-1',
      status: 'published',
    };

    const mockTransaction = {
      get: jest.fn().mockImplementation((ref) => {
        if (ref.id === 'user-1_quiz-a') return { exists: () => false };
        return { exists: () => true, data: () => mockQuiz };
      }),
      set: jest.fn(),
      update: jest.fn(),
    };

    const { runTransaction } = require('firebase/firestore');
    (runTransaction as jest.Mock).mockImplementation((db: any, callback: any) => callback(mockTransaction));

    (getDoc as jest.Mock).mockImplementation((ref: any) => {
      if (ref.id === 'quiz-a') {
        return { exists: () => true, data: () => mockQuiz };
      }
      if (ref.id === 'user-1') {
        return { exists: () => true, data: () => ({ displayName: 'ブックマーク者', avatarUrl: 'avatar' }) };
      }
      return { exists: () => false };
    });

    const added = await toggleBookmark(userId, 'quiz-a', 'quiz');
    expect(added).toBe(true);

    expect(createNotification).toHaveBeenCalledWith({
      userId: 'author-1',
      type: 'bookmark',
      senderId: userId,
      senderName: 'ブックマーク者',
      senderAvatar: 'avatar',
      targetId: 'quiz-a',
      targetTitle: 'テストクイズ',
    });
  });
});
