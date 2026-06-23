/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileClient } from '@/app/profile/[uid]/profile-client';
import { getQuizzesByAuthor } from '@/services/quiz';

const mockParams = { uid: 'user-1' };
jest.mock('next/navigation', () => ({
  useParams: () => mockParams,
  notFound: jest.fn(),
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
}));

jest.mock('@/services/storage', () => ({
  getSnsLogoUrl: jest.fn().mockResolvedValue(''),
}));

const mockQuizzes = Array.from({ length: 12 }, (_, i) => ({
  id: `quiz-${i + 1}`,
  authorId: 'user-1',
  authorName: 'テストユーザー',
  title: `クイズタイトル ${i + 1}`,
  description: `クイズ説明 ${i + 1} 特徴ワード`,
  thumbnailUrl: null,
  difficulty: 5,
  genre: i % 2 === 0 ? 'プログラミング' : '歴史',
  tags: i % 2 === 0 ? ['it', 'web'] : ['history'],
  questionCount: 5,
  status: 'published' as const,
  playCount: 10,
  bookmarksCount: 2,
  questions: [],
  questionIds: [],
}));

describe('ProfileClient - Created Quizzes Search & Pagination', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    (getQuizzesByAuthor as jest.Mock).mockResolvedValue(mockQuizzes);
  });

  it('検索入力欄とページングUIが表示されること', async () => {
    render(<ProfileClient />);
    
    // 非同期のデータロードを待つ
    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    });

    // 検索入力欄が存在すること
    const searchInput = screen.getByTestId('profile-quiz-search-input');
    expect(searchInput).toBeInTheDocument();

    // ページングUIが存在すること
    const pagination = screen.getByTestId('profile-quiz-pagination');
    expect(pagination).toBeInTheDocument();
  });

  it('検索キーワードによってクイズがフィルタリングされ、ページが1ページ目にリセットされること', async () => {
    render(<ProfileClient />);
    
    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('profile-quiz-search-input');

    // 「歴史」というキーワードで検索
    fireEvent.change(searchInput, { target: { value: '歴史' } });

    // 「歴史」ジャンルのクイズのみ表示されていることを確認
    // 奇数インデックス（偶数番号）が歴史
    expect(screen.getByText('クイズタイトル 2')).toBeInTheDocument();
    expect(screen.queryByText('クイズタイトル 1')).not.toBeInTheDocument();
  });

  it('クイズが10件以上ある場合、1ページ目には9件のみ表示され、ページングが制御されること', async () => {
    render(<ProfileClient />);

    await waitFor(() => {
      expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    });

    // 1ページ目には最大9件表示されているはず（クイズ1〜9）
    expect(screen.getByText('クイズタイトル 1')).toBeInTheDocument();
    expect(screen.getByText('クイズタイトル 9')).toBeInTheDocument();
    expect(screen.queryByText('クイズタイトル 10')).not.toBeInTheDocument();

    // 「前へ」ボタンが非活性、かつ「次へ」ボタンが活性状態であることを確認
    const prevButton = screen.getByRole('button', { name: /前へ|前のページ/i });
    const nextButton = screen.getByRole('button', { name: /次へ|次のページ/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // 「次へ」をクリックして2ページ目に遷移
    fireEvent.click(nextButton);

    // 2ページ目のクイズ（10〜12）が表示されること
    expect(screen.getByText('クイズタイトル 10')).toBeInTheDocument();
    expect(screen.getByText('クイズタイトル 12')).toBeInTheDocument();
    expect(screen.queryByText('クイズタイトル 1')).not.toBeInTheDocument();

    // 2ページ目（最終ページ）なので、「次へ」が非活性、「前へ」が活性状態であること
    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();
  });
});
