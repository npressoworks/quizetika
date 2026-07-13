/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';
import { getUserProfile } from '@/services/user';
import {
  getReportedUsersRanking,
  getBannedUsers,
  getUserAdminLogs,
} from '@/services/reputation-client';
import { User, ReportedUserSummary } from '@/types';

// next/navigation のモック
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// next/link のモック
jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/user', () => ({
  getUserProfile: jest.fn(),
}));

jest.mock('@/services/reputation-client', () => ({
  getReportedUsersRanking: jest.fn(),
  getBannedUsers: jest.fn(),
  getUserAdminLogs: jest.fn(),
  unbanUser: jest.fn(),
}));

// jsdom は PointerEvent 関連 API を実装していないため、base-ui コンポーネントが
// 使用する API に軽量ポリフィルを注入する。
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error jsdom 環境向けの簡易ポリフィルのため型は緩めに扱う
  window.PointerEvent = PointerEventPolyfill;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.setPointerCapture) {
  window.HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

import AdminUsersPage from '@/app/admin/users/page';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockGetReportedUsersRanking = getReportedUsersRanking as jest.MockedFunction<
  typeof getReportedUsersRanking
>;
const mockGetBannedUsers = getBannedUsers as jest.MockedFunction<typeof getBannedUsers>;
const mockGetUserAdminLogs = getUserAdminLogs as jest.MockedFunction<typeof getUserAdminLogs>;

const testUser: User = {
  id: 'uid-reported-1',
  displayName: '通報されたユーザー',
  avatarUrl: '',
  isBanned: false,
  deleteStatus: null,
  reputationScore: 10,
  moderationTier: 'contributor',
  createdQuizzesCount: 1,
  totalPlayCount: 2,
} as unknown as User;

const reportedItem: ReportedUserSummary = {
  uid: 'uid-reported-1',
  displayName: '通報されたユーザー',
  moderationTier: 'contributor',
  isBanned: false,
  totalReportCount: 7,
  latestReportAt: '2026-07-01T00:00:00.000Z',
};

describe('AdminUsersPage - タブコンテナ化と選択中ユーザー状態の配線', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetReportedUsersRanking.mockResolvedValue({ items: [reportedItem], hasMore: false });
    mockGetBannedUsers.mockResolvedValue({ items: [], hasMore: false });
    mockGetUserAdminLogs.mockResolvedValue([]);
    mockGetUserProfile.mockResolvedValue(testUser);
  });

  test('認証解決のロード中である場合、ローディングインジケータが表示されること', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: true,
      refreshUser: jest.fn(),
    } as any);

    render(<AdminUsersPage />);

    expect(screen.getByText('認証情報を確認しています...')).toBeInTheDocument();
  });

  test('未ログインのアクセス時に /login へリダイレクトされること', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    } as any);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/admin/users');
    });
  });

  test('非管理者のアクセス時に /not-found へリダイレクトされること', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', moderationTier: 'newcomer' } as any,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    } as any);

    render(<AdminUsersPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/not-found');
    });
  });

  test('管理者アクセス時に3つのタブとナビゲーションリンクが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', moderationTier: 'admin' } as any,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    } as any);

    render(<AdminUsersPage />);

    expect(screen.getByRole('tab', { name: /検索/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /通報ランキング/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /BAN管理/ })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /管理者ポータルへ/ })).toHaveAttribute(
      'href',
      '/admin'
    );
    expect(screen.getByRole('link', { name: /モデレーション審査画面へ/ })).toHaveAttribute(
      'href',
      '/admin/moderation'
    );
    expect(screen.getByRole('link', { name: /ジャンル直接管理画面へ/ })).toHaveAttribute(
      'href',
      '/admin/genres'
    );
  });

  test('通報ランキングタブでユーザー行を選択すると検索タブへ自動遷移し、該当ユーザーの詳細情報が表示される', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', moderationTier: 'admin' } as any,
      authUser: { getIdToken: jest.fn().mockResolvedValue('token') } as any,
      loading: false,
      refreshUser: jest.fn(),
    } as any);

    render(<AdminUsersPage />);

    // 通報ランキングタブへ切替
    fireEvent.click(screen.getByRole('tab', { name: /通報ランキング/ }));

    await waitFor(() => {
      expect(screen.getByText('通報されたユーザー')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('通報されたユーザー'));

    // 検索タブへ自動遷移し、該当ユーザーの詳細情報が自動検索・表示されること
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /検索/ })).toHaveAttribute('aria-selected', 'true');
    });

    await waitFor(() => {
      expect(mockGetUserProfile).toHaveBeenCalledWith('uid-reported-1');
    });

    await waitFor(() => {
      expect(screen.getAllByText('通報されたユーザー').length).toBeGreaterThan(0);
    });
  });
});
