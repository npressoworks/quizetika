/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProfileQuizzesPanel } from '@/components/profile/profile-quizzes-panel';
import { getQuizzesByAuthor, getQuizzesByAuthorPage } from '@/services/quiz';
import { useAds } from '@/hooks/useAds';

// searchQuery は呼び出し側（プロフィール画面ではタブの上の検索欄）が管理する制御プロパティのため、
// テストでは検索欄を持つラッパーで検証する。
function ProfileQuizzesPanelHarness(
  props: Omit<React.ComponentProps<typeof ProfileQuizzesPanel>, 'searchQuery'>
) {
  const [searchQuery, setSearchQuery] = React.useState('');
  return (
    <>
      <input
        data-testid="profile-quiz-search-input"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <ProfileQuizzesPanel {...props} searchQuery={searchQuery} />
    </>
  );
}

jest.mock('@/services/quiz', () => ({
  getQuizzesByAuthor: jest.fn(),
  getQuizzesByAuthorPage: jest.fn(),
}));

jest.mock('@/hooks/useAds', () => ({
  useAds: jest.fn(),
}));

// Mock components to simplify tests
jest.mock('@/components/ads/adsense-inline-ad', () => ({
  AdsenseInlineAd: () => <div data-testid="adsense-inline-ad">広告</div>,
}));

jest.mock('@/components/quiz/quiz-card', () => ({
  QuizCard: ({ quiz }: { quiz: any }) => <div data-testid="quiz-card">{quiz.title}</div>,
}));

// IntersectionObserver mock
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = IntersectionObserverMock as any;

const mockQuizzes = Array.from({ length: 15 }, (_, i) => ({
  id: `quiz-${i + 1}`,
  authorId: 'user-1',
  authorName: 'テスト作者',
  title: `クイズ ${i + 1}`,
  description: `説明 ${i + 1}`,
  genre: 'general',
  tags: [],
}));

describe('ProfileQuizzesPanel', () => {
  const mockOnBookmarkToggle = jest.fn();
  const mockOnPlayClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAds as jest.Mock).mockReturnValue({ showAds: false });
    (getQuizzesByAuthorPage as jest.Mock).mockResolvedValue({
      items: mockQuizzes.slice(0, 10),
      nextCursor: null,
    });
    (getQuizzesByAuthor as jest.Mock).mockResolvedValue(mockQuizzes);
  });

  it('初期マウント時に getQuizzesByAuthorPage を呼び出し、結果をレンダリングする', async () => {
    render(
      <ProfileQuizzesPanel
        authorId="user-1"
        isMyProfile={false}
        bookmarkedIds={new Set()}
        onBookmarkToggle={mockOnBookmarkToggle}
        onPlayClick={mockOnPlayClick}
      />
    );

    await waitFor(() => {
      expect(getQuizzesByAuthorPage).toHaveBeenCalledWith('user-1', {
        limit: 20,
        includeUnpublished: false,
      });
      expect(screen.getByText('クイズ 1')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('quiz-card');
    expect(cards).toHaveLength(10);
  });

  it('検索キーワード入力時に一括取得 getQuizzesByAuthor に切り替わり、クライアントフィルタが機能する', async () => {
    render(
      <ProfileQuizzesPanelHarness
        authorId="user-1"
        isMyProfile={false}
        bookmarkedIds={new Set()}
        onBookmarkToggle={mockOnBookmarkToggle}
        onPlayClick={mockOnPlayClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('クイズ 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('profile-quiz-search-input');
    
    // 「クイズ 5」で検索
    fireEvent.change(searchInput, { target: { value: 'クイズ 5' } });

    await waitFor(() => {
      expect(getQuizzesByAuthor).toHaveBeenCalledWith('user-1', false);
    });

    await waitFor(() => {
      const cards = screen.getAllByTestId('quiz-card');
      expect(cards).toHaveLength(1);
      expect(screen.getByText('クイズ 5')).toBeInTheDocument();
      expect(screen.queryByText('クイズ 1')).not.toBeInTheDocument();
    });
  });

  it('無料プラン (showAds=true) では 10件ごとに広告がインライン表示されること', async () => {
    (useAds as jest.Mock).mockReturnValue({ showAds: true });
    // 12件のクイズをロード
    (getQuizzesByAuthorPage as jest.Mock).mockResolvedValue({
      items: mockQuizzes.slice(0, 12),
      nextCursor: null,
    });

    render(
      <ProfileQuizzesPanel
        authorId="user-1"
        isMyProfile={false}
        bookmarkedIds={new Set()}
        onBookmarkToggle={mockOnBookmarkToggle}
        onPlayClick={mockOnPlayClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('クイズ 1')).toBeInTheDocument();
    });

    // クイズカードが 12個
    const cards = screen.getAllByTestId('quiz-card');
    expect(cards).toHaveLength(12);

    // 10件ごとに広告が挿入されるため、広告枠が 1つ表示される
    const ads = screen.getAllByTestId('adsense-inline-ad');
    expect(ads).toHaveLength(1);
  });

  it('有料プラン (showAds=false) では広告が表示されないこと', async () => {
    (useAds as jest.Mock).mockReturnValue({ showAds: false });
    (getQuizzesByAuthorPage as jest.Mock).mockResolvedValue({
      items: mockQuizzes.slice(0, 12),
      nextCursor: null,
    });

    render(
      <ProfileQuizzesPanel
        authorId="user-1"
        isMyProfile={false}
        bookmarkedIds={new Set()}
        onBookmarkToggle={mockOnBookmarkToggle}
        onPlayClick={mockOnPlayClick}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('クイズ 1')).toBeInTheDocument();
    });

    const cards = screen.getAllByTestId('quiz-card');
    expect(cards).toHaveLength(12);

    // 広告枠が表示されないこと
    expect(screen.queryByTestId('adsense-inline-ad')).not.toBeInTheDocument();
  });
});
