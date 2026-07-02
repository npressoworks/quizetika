import {
  getBookmarkedQuizzes,
  toggleBookmark,
  InvalidBookmarkTargetError,
} from '@/services/bookmark';
import { createNotification } from '@/services/notification';

// チェーン用のモックヘルパー
const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
    then: jest.fn((onFulfilled) => {
      return Promise.resolve(resolveValue).then(onFulfilled);
    }),
  };
  return chain;
};

// Supabase クライアントのモックを作成
jest.mock('@/lib/supabase/client', () => {
  const mock = {
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

jest.mock('@/services/notification', () => ({
  createNotification: jest.fn(),
}));

function makeQuizRow(id: string, authorId: string, title: string) {
  return {
    id,
    author_id: authorId,
    author_name: 'Author',
    author_avatar: '',
    title,
    description: '',
    thumbnail_url: null,
    difficulty: 5,
    genre: 'programming',
    tags: [],
    original_tags: [],
    question_ids: [],
    questions: [],
    question_count: 0,
    status: 'published',
    visibility: 'public',
    flags_count: 0,
    play_count: 0,
    bookmarks_count: 0,
    positive_count: 0,
    negative_count: 0,
    temp_positive_count: 0,
    temp_negative_count: 0,
    review_score: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('bookmark service', () => {
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_ENV = 'development';

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.in.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('getBookmarkedQuizzes はブックマーククイズを解決する', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'bookmarks') {
        return createChainMock({
          data: [
            {
              id: 'user-1_quiz-a',
              user_id: userId,
              target_id: 'quiz-a',
              target_type: 'quiz',
              created_at: new Date('2026-06-01').toISOString(),
            },
          ],
          error: null,
        });
      }
      if (table === 'quizzes') {
        return createChainMock({
          data: [
            makeQuizRow('quiz-a', 'author-1', 'テストクイズ'),
          ],
          error: null,
        });
      }
      return mockSupabase;
    });

    const quizzes = await getBookmarkedQuizzes(userId);

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
    const mockQuiz = makeQuizRow('quiz-a', 'author-1', 'テストクイズ');

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'quizzes') {
        return createChainMock({ data: mockQuiz, error: null });
      }
      if (table === 'bookmarks') {
        // すでにブックマークされていない (isBookmarked => false)
        return createChainMock({ data: null, error: null });
      }
      if (table === 'users') {
        return createChainMock({
          data: { display_name: 'ブックマーク者', avatar_url: 'avatar' },
          error: null,
        });
      }
      return mockSupabase;
    });

    mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null }); // RPC handle_bookmark_toggle returns added = true

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
