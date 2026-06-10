import {
  getBookmarkedQuizzes,
  toggleBookmark,
  InvalidBookmarkTargetError,
} from '@/services/bookmark';
import { getDoc, getDocs } from 'firebase/firestore';

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
    (getDocs as jest.Mock).mockResolvedValue({
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
    });

    (getDoc as jest.Mock).mockImplementation(async (ref: { id: string }) => {
      if (ref.id === 'quiz-a') {
        return {
          exists: () => true,
          data: () => ({
            id: 'quiz-a',
            title: 'テストクイズ',
            status: 'published',
          }),
        };
      }
      return { exists: () => false, data: () => null };
    });

    const quizzes = await getBookmarkedQuizzes(userId);

    expect(getDoc).toHaveBeenCalled();
    expect(quizzes).toHaveLength(1);
    expect(quizzes[0].id).toBe('quiz-a');
    expect(quizzes[0].title).toBe('テストクイズ');
  });

  it('toggleBookmark は targetType=list を拒否する', async () => {
    await expect(
      toggleBookmark(userId, 'list-a', 'list' as 'quiz')
    ).rejects.toBeInstanceOf(InvalidBookmarkTargetError);
  });
});
