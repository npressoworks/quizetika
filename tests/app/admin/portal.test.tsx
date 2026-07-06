/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';

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

// useAuth のモック
jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// 対象の画面コンポーネントをインポート
import AdminPortalPage from '@/app/admin/page';

describe('AdminPortalPage - 管理者メニューポータルUI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('認証解決のロード中である場合、ローディングインジケータが表示されること', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: true,
      refreshUser: jest.fn(),
    });

    render(<AdminPortalPage />);

    expect(screen.getByTestId('admin-portal-loading')).toBeInTheDocument();
  });

  test('未ログインのアクセス時に /login へリダイレクトされること', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminPortalPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/admin');
    });
  });

  test('非管理者（かつ admin ロールでない）のアクセス時に /not-found へリダイレクトされること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        moderationTier: 'newcomer',
      } as any,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminPortalPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/not-found');
    });
  });

  test('管理者のアクセス時に4つの管理機能カード（モデレーション審査、ユーザー評判管理、ジャンル直接管理、運営からのお知らせ管理）が表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as any,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminPortalPage />);

    // 画面タイトルが表示されること
    expect(screen.getByText('管理者コントロールセンター')).toBeInTheDocument();

    // 4つの機能カードが表示されること
    expect(screen.getByText('モデレーション審査')).toBeInTheDocument();
    expect(screen.getByText('ユーザー評判管理')).toBeInTheDocument();
    expect(screen.getByText('ジャンル直接管理')).toBeInTheDocument();
    expect(screen.getByText('運営からのお知らせ管理')).toBeInTheDocument();

    // 各遷移用リンクが正しいhrefを持っていること
    expect(screen.getByRole('link', { name: /モデレーション審査/ })).toHaveAttribute(
      'href',
      '/admin/moderation'
    );
    expect(screen.getByRole('link', { name: /ユーザー評判管理/ })).toHaveAttribute(
      'href',
      '/admin/users'
    );
    expect(screen.getByRole('link', { name: /ジャンル直接管理/ })).toHaveAttribute(
      'href',
      '/admin/genres'
    );
    expect(screen.getByRole('link', { name: /運営からのお知らせ管理/ })).toHaveAttribute(
      'href',
      '/admin/announcements'
    );
  });
});
