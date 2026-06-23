/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProfileClient } from '@/app/profile/[uid]/profile-client';
import { getQuizzesByAuthor, getQuizzesByAuthorPage } from '@/services/quiz';
import { getBookmarkedQuizIds, toggleBookmark } from '@/services/bookmark';

const mockPush = jest.fn();
const mockParams = { uid: 'user-1' };
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  notFound: jest.fn(),
  useRouter: () => ({ push: mockPush }),
}));

const mockCurrentUser = { id: 'user-1', displayName: '本人' };
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: mockCurrentUser }),
}));

jest.mock('@/services/user', () => ({
  getUser: jest.fn().mockResolvedValue({
    id: 'user-1',
    displayName: 'テストユーザー',
    reputationScore: 100,
    followersCount: 10,
    followingCount: 5,
    bio: 'プロフィール自己紹介',
    badges: [],
    deleteStatus: 'active',
    totalFailedQuestionsCount: 0,
  }),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
  isFollowing: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/services/quiz', () => ({
  getQuizzesByAuthor: jest.fn(),
  getQuizzesByAuthorPage: jest.fn(),
}));

jest.mock('@/services/bookmark', () => ({
  getBookmarkedQuizIds: jest.fn(),
  toggleBookmark: jest.fn(),
}));

jest.mock('@/services/storage', () => ({
  getSnsLogoUrl: jest.fn().mockResolvedValue(''),
}));

// 共通UI用の IntersectionObserver の簡易モック
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverMock as any;

const mockQuizzes = Array.from({ length: 25 }, (_, i) => ({
  id: `quiz-${i + 1}`,
  authorId: 'user-1',
  authorName: 'テストユーザー',
  title: `クイズタイトル ${i + 1}`,
  description: `クイズ説明 ${i + 1} 特徴ワード`,
  thumbnailUrl: null,
  difficulty: 5,
  genre: i % 2 === 0 ? 'programming' : 'history',
  tags: i % 2 === 0 ? ['it', 'web'] : ['history'],
  questionCount: 5,
  status: 'published' as const,
  playCount: 10,
  bookmarksCount: 2,
  questions: [],
  questionIds: [],
}));

describe('ProfileClient - Created Quizzes Search & Hybrid Infinite Scroll', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getQuizzesByAuthor as jest.Mock).mockResolvedValue(mockQuizzes);
    (getQuizzesByAuthorPage as jest.Mock).mockImplementation((authorId, options = {}) => {
      const limit = options.limit ?? 20;
      const cursor = options.cursor;
      
      let items = mockQuizzes;
      if (cursor) {
        // 簡易カーソルシミュレーション (1つ前の最後のIDの次から limit 件数分ロード)
        const lastId = cursor.replace('cursor-', '');
        const index = mockQuizzes.findIndex(q => q.id === lastId);
        items = mockQuizzes.slice(index + 1);
      }
      
      const pageItems = items.slice(0, limit);
      const hasMore = items.length > limit;
      return Promise.resolve({
        items: pageItems,
        nextCursor: hasMore ? `cursor-${pageItems[pageItems.length - 1].id}` : null,
      });
    });
    (getBookmarkedQuizIds as jest.Mock).mockResolvedValue(['quiz-1']);
  });

  it('検索入力欄と「もっと見る」ボタンが表示されること', async () => {
    render(<ProfileClient />);
    
    // 非同期のデータロードを待つ
    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    });

    // 検索入力欄が存在すること
    const searchInput = screen.getByTestId('profile-quiz-search-input');
    expect(searchInput).toBeInTheDocument();

    // 25件あるので、初期20件ロードされた状態になり、「もっと見る」ボタンが存在すること
    const loadMoreButton = screen.getByTestId('profile-feed-load-more-button');
    expect(loadMoreButton).toBeInTheDocument();
  });

  it('検索キーワードによってクイズがフィルタリングされ、一括フェッチからインメモリ表示されること', async () => {
    render(<ProfileClient />);
    
    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('profile-quiz-search-input');

    // 「history」というキーワードで検索
    fireEvent.change(searchInput, { target: { value: 'history' } });

    // 一括フェッチ getQuizzesByAuthor が呼ばれることを確認
    await waitFor(() => {
      expect(getQuizzesByAuthor).toHaveBeenCalledWith('user-1', true);
    });

    // 「history」ジャンルのクイズのみ表示されていることを確認
    // 奇数インデックス（偶数番号）が history
    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 2')).toBeInTheDocument();
      expect(screen.queryByText('クイズタイトル 1')).not.toBeInTheDocument();
    });
  });

  it('初期20件が表示され、「もっと見る」をクリックすると追加の 5件が表示されること', async () => {
    render(<ProfileClient />);

    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    });

    // 1ページ目には最大20件表示されているはず（クイズ1〜20）
    expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    expect(screen.getByText('クイズタイトル 20')).toBeInTheDocument();
    expect(screen.queryByText('クイズタイトル 21')).not.toBeInTheDocument();

    // 「もっと見る」ボタンが存在することを確認
    const loadMoreButton = screen.getByTestId('profile-feed-load-more-button');
    expect(loadMoreButton).toBeInTheDocument();

    // 「もっと見る」をクリックして追加取得
    await act(async () => {
      fireEvent.click(loadMoreButton);
    });

    // 2ページ目のクイズ（21〜25）が表示されること
    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 21')).toBeInTheDocument();
      expect(screen.getByText('クイズタイトル 25')).toBeInTheDocument();
    });

    // 全て読み込み終わったので「もっと見る」ボタンが非表示になること
    expect(screen.queryByTestId('profile-feed-load-more-button')).not.toBeInTheDocument();
  });

  it('ブックマークの切り替えができること', async () => {
    (toggleBookmark as jest.Mock).mockResolvedValue(true);
    render(<ProfileClient />);

    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    });

    // 共通QuizCard内のブックマークボタンを取得 (1つ目のクイズ用)
    const bookmarkButtons = screen.getAllByTestId('quiz-card-bookmark-btn');
    expect(bookmarkButtons).toHaveLength(20); // 1ページ目に20のカードがあるため

    await act(async () => {
      fireEvent.click(bookmarkButtons[0]);
    });

    await waitFor(() => {
      expect(toggleBookmark).toHaveBeenCalledWith('user-1', 'quiz-1', 'quiz');
    });
  });
});
