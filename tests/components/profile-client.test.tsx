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

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: jest.fn().mockReturnValue({
    genres: [
      { id: 'genre-1', displayName: 'プログラミング', iconImageUrl: '/icons/prog.png' },
      { id: 'genre-2', displayName: '歴史', iconImageUrl: '' },
    ],
    loading: false,
    error: null,
    genreLabelById: new Map([
      ['genre-1', 'プログラミング'],
      ['genre-2', '歴史'],
    ]),
    refetch: jest.fn(),
  }),
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

  describe('好きなジャンル表示機能 (Phase 28)', () => {
    it('登録された好きなジャンルがチップ形式（アイコン・表示名）で表示されること', async () => {
      const { getUser } = require('@/services/user');
      (getUser as jest.Mock).mockResolvedValueOnce({
        id: 'user-1',
        displayName: 'テストユーザー',
        reputationScore: 100,
        followersCount: 10,
        followingCount: 5,
        bio: 'プロフィール自己紹介',
        badges: [],
        deleteStatus: 'active',
        totalFailedQuestionsCount: 0,
        followedGenres: ['genre-1', 'genre-2'],
      });

      render(<ProfileClient />);

      await waitFor(() => {
        const favoriteGenresSection = screen.getByTestId('profile-favorite-genres');
        expect(favoriteGenresSection).toBeInTheDocument();
        expect(screen.getByText('プログラミング')).toBeInTheDocument();
        expect(screen.getByText('歴史')).toBeInTheDocument();
        
        // アイコン画像が表示されていること
        const progIcon = document.querySelector('img[src="/icons/prog.png"]');
        expect(progIcon).toBeInTheDocument();
      });
    });

    it('好きなジャンルが未設定で本人プロフィールのとき、登録を促すリンクが表示されること', async () => {
      const { getUser } = require('@/services/user');
      (getUser as jest.Mock).mockResolvedValueOnce({
        id: 'user-1',
        displayName: 'テストユーザー',
        reputationScore: 100,
        followersCount: 10,
        followingCount: 5,
        bio: 'プロフィール自己紹介',
        badges: [],
        deleteStatus: 'active',
        totalFailedQuestionsCount: 0,
        followedGenres: [],
      });

      render(<ProfileClient />);

      await waitFor(() => {
        const favoriteGenresSection = screen.getByTestId('profile-favorite-genres');
        expect(favoriteGenresSection).toBeInTheDocument();
        expect(screen.getByText(/好きなジャンルが設定されていません/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /登録する/ })).toBeInTheDocument();
      });
    });

    it('好きなジャンルが未設定で他人プロフィールのとき、表示領域自体が描画されないこと', async () => {
      const { getUser } = require('@/services/user');
      (getUser as jest.Mock).mockResolvedValueOnce({
        id: 'user-2', // 他人
        displayName: '他人ユーザー',
        reputationScore: 50,
        followersCount: 2,
        followingCount: 2,
        bio: '他人の自己紹介',
        badges: [],
        deleteStatus: 'active',
        totalFailedQuestionsCount: 0,
        followedGenres: [],
      });
      
      // paramsを他人にするため、mockParams を一時的に書き換え
      const originalParams = { ...mockParams };
      mockParams.uid = 'user-2';

      try {
        render(<ProfileClient />);

        await waitFor(() => {
          // 他人のプロフィールでジャンル未設定時は、領域が非表示であること
          expect(screen.queryByTestId('profile-favorite-genres')).not.toBeInTheDocument();
        });
      } finally {
        mockParams.uid = originalParams.uid; // 元に戻す
      }
    });
  });

  describe('プレイ履歴タブの露出ガード（Phase 29）', () => {
    it('他人のプロフィールのとき、プレイ履歴の TabsContent がレンダリングされないこと', async () => {
      const { getUser } = require('@/services/user');
      (getUser as jest.Mock).mockResolvedValueOnce({
        id: 'user-2',
        displayName: '他人ユーザー',
        reputationScore: 50,
        followersCount: 2,
        followingCount: 2,
        bio: '他人の自己紹介',
        badges: [],
        deleteStatus: 'active',
        totalFailedQuestionsCount: 0,
        followedGenres: [],
      });

      const originalParams = { ...mockParams };
      mockParams.uid = 'user-2'; // 他人

      try {
        render(<ProfileClient />);
        await waitFor(() => {
          expect(screen.getByText('他人ユーザー')).toBeInTheDocument();
        });

        // プレイ履歴の TabsContent が存在しないこと
        expect(screen.queryByTestId('profile-tab-content-history')).not.toBeInTheDocument();
      } finally {
        mockParams.uid = originalParams.uid;
      }
    });

    it('自分のプロフィールのとき、プレイ履歴の TabsContent がレンダリングされること', async () => {
      render(<ProfileClient />);
      await waitFor(() => {
        expect(screen.getByText('テストユーザー')).toBeInTheDocument();
      });

      // プレイ履歴タブをクリック
      const historyTab = screen.getByTestId('profile-tab-history');
      fireEvent.click(historyTab);

      // タブ切り替え後に TabsContent が存在すること
      await waitFor(() => {
        expect(screen.getByTestId('profile-tab-content-history')).toBeInTheDocument();
      });
    });
  });
});
