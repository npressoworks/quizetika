/**
 * @jest-environment jsdom
 *
 * /banned 画面のスケルトン化テスト
 * Requirements: 6.1, 6.2, 7.6, 7.7, 7.8, 7.10
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';
import { getUserProfile } from '@/services/user';
import { User } from '@/types';

// next/navigation のモック
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// useAuth のモック
jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

// getUserProfile のモック（BAN理由・日時の最新情報取得用）
jest.mock('@/services/user', () => ({
  getUserProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;

import BannedPage from '@/app/banned/page';

const bannedUser = {
  id: 'uid-banned-1',
  displayName: 'BANされたユーザー',
  isBanned: true,
  bannedReason: '規約違反のため',
  bannedAt: '2026-07-01T00:00:00.000Z',
} as unknown as User;

describe('BannedPage - アカウント停止画面のスケルトン化', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie = 'quizetika_banned=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  });

  test('BANされていないユーザーがアクセスした場合、ホーム画面へリダイレクトされること（既存動作、無変更）', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'uid-1', isBanned: false } as unknown as User,
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<BannedPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  test('未ログインユーザーがアクセスした場合、ホーム画面へリダイレクトされること（既存動作、無変更）', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<BannedPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  test('BANされたユーザーがアクセスした場合、詳細情報のロード中でも基本フレーム（タイトル）が即座に表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: bannedUser,
      loading: false,
    } as ReturnType<typeof useAuth>);
    // getUserProfile を意図的に解決させず、ロード中状態を維持する
    mockGetUserProfile.mockReturnValue(new Promise(() => {}));

    render(<BannedPage />);

    await waitFor(() => {
      expect(screen.getByText('アカウントが停止されています')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  test('BAN詳細情報のロード中は data-testid="banned-info-skeleton" のスケルトンが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: bannedUser,
      loading: false,
    } as ReturnType<typeof useAuth>);
    mockGetUserProfile.mockReturnValue(new Promise(() => {}));

    render(<BannedPage />);

    await waitFor(() => {
      expect(screen.getByTestId('banned-info-skeleton')).toBeInTheDocument();
    });
  });

  test('BAN詳細情報のロード完了後、スケルトンが実際のBAN理由・日時に差し替わること', async () => {
    mockUseAuth.mockReturnValue({
      user: bannedUser,
      loading: false,
    } as ReturnType<typeof useAuth>);
    mockGetUserProfile.mockResolvedValue(bannedUser);

    render(<BannedPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('banned-info-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText('規約違反のため')).toBeInTheDocument();
    const expectedFormattedDate = new Date(bannedUser.bannedAt as unknown as string).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(screen.getByText(expectedFormattedDate)).toBeInTheDocument();
  });
});
