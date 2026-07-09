/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/sidebar';

// Mock navigation
let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock auth context variables
let mockUser: any = null;
let mockLoading = false;

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
  }),
}));
jest.mock('@/lib/supabase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

describe('Sidebar Component', () => {
  beforeEach(() => {
    mockPathname = '/';
    mockUser = null;
    mockLoading = false;
  });

  it('未ログイン時はログインボタンを表示し、主要メニューを非表示にする', () => {
    mockUser = null;
    render(<Sidebar />);

    // ログインボタンがあること
    expect(screen.getByRole('link', { name: 'ログイン' })).toBeInTheDocument();

    // ホーム・Proプランはあるが、通知やブックマーク、作問、ダッシュボードはないこと
    expect(screen.getAllByText('ホーム')[0]).toBeInTheDocument();
    expect(screen.getAllByText('検索')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Proプラン')[0]).toBeInTheDocument();
    expect(screen.queryByText('通知')).not.toBeInTheDocument();
    expect(screen.queryByText('ブックマーク')).not.toBeInTheDocument();
    expect(screen.queryByText('クイズを作る')).not.toBeInTheDocument();
    expect(screen.queryByText('ダッシュボード')).not.toBeInTheDocument();
  });

  it('ログイン時は主要メニュー（カスタムクイズ、通知、ブックマーク、作問、ダッシュボード）を表示する', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    render(<Sidebar />);

    expect(screen.getAllByText('ホーム')[0]).toBeInTheDocument();
    expect(screen.queryByTestId('nav-lists')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-my-quiz')).toBeInTheDocument();
    expect(screen.getAllByText('通知')[0]).toBeInTheDocument();
    expect(screen.getAllByText('ブックマーク')[0]).toBeInTheDocument();
    expect(screen.getAllByText('マイページ')[0]).toBeInTheDocument();
    expect(screen.getAllByText('クイズを作る')[0]).toBeInTheDocument();
    expect(screen.getAllByText('ダッシュボード')[0]).toBeInTheDocument();

    // ログインユーザーのアバター・表示名が表示されること
    expect(screen.getAllByText('ななみ')[0]).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-profile-btn')).toBeInTheDocument();
  });

  it('/ ではホームのみ active', () => {
    mockUser = null;
    mockPathname = '/';
    render(<Sidebar />);

    expect(screen.getByTestId('nav-home')).toHaveClass('active');
    expect(screen.getByTestId('nav-search')).not.toHaveClass('active');
  });

  it('/search では検索のみ active', () => {
    mockUser = null;
    mockPathname = '/search';
    render(<Sidebar />);

    expect(screen.getByTestId('nav-search')).toHaveClass('active');
    expect(screen.getByTestId('nav-home')).not.toHaveClass('active');
  });

  it('現在のパスと一致するメニューがアクティブ表示になる', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    mockPathname = '/bookmarks';

    render(<Sidebar />);

    // ブックマークリンクに active クラス（またはそれに類するスタイル）が付与されること
    // CSS modules をモックしてない場合はクラス名そのままでテストするか、テスト属性をチェック
    const bookmarkLink = screen.getAllByText('ブックマーク')[0].closest('a');
    expect(bookmarkLink).toHaveClass('active');
  });

  it('/pricing パスで Proプラン メニューがアクティブ表示になる', () => {
    mockUser = null;
    mockPathname = '/pricing';

    render(<Sidebar />);

    const pricingLink = screen.getAllByText('Proプラン')[0].closest('a');
    expect(pricingLink).toHaveClass('active');
  });

  it('未ログイン時は nav-my-quiz を表示しない', () => {
    mockUser = null;
    render(<Sidebar />);
    expect(screen.queryByTestId('nav-lists')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-my-quiz')).not.toBeInTheDocument();
  });

  it('/my-quiz でカスタムクイズのみ active', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    mockPathname = '/my-quiz';
    render(<Sidebar />);
    expect(screen.getByTestId('nav-my-quiz')).toHaveClass('active');
    expect(screen.getByTestId('nav-home')).not.toHaveClass('active');
  });

  it('プロフィール領域はクリック時にドロップダウンメニュー（ポップアップ）を展開し、設定やログアウトが表示される', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    render(<Sidebar />);

    const profileBtn = screen.getByTestId('sidebar-profile-btn');
    expect(profileBtn).toBeInTheDocument();

    // 初期状態ではポップアップアイテムは非表示
    expect(screen.queryByTestId('sidebar-settings-link')).not.toBeInTheDocument();
    expect(screen.queryByText('ログアウト')).not.toBeInTheDocument();

    // クリックして開く
    fireEvent.click(profileBtn);

    // ポップアップアイテムが表示されること
    expect(screen.getByTestId('sidebar-dashboard-link')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-settings-link')).toBeInTheDocument();
    expect(screen.getByText('ログアウト')).toBeInTheDocument();
  });

  it('管理者ユーザーログイン時は「管理者メニュー」を主要メニューに表示し、/admin パスでアクティブ表示になる', () => {
    mockUser = { id: 'admin-123', displayName: '管理者', avatarUrl: 'avatar.png', role: 'admin' };
    render(<Sidebar />);

    expect(screen.getByTestId('nav-admin')).toBeInTheDocument();
    expect(screen.getAllByText('管理者メニュー')[0]).toBeInTheDocument();
  });

  it('管理者ユーザーログイン時、/admin では管理者メニューが active になる', () => {
    mockUser = { id: 'admin-123', displayName: '管理者', avatarUrl: 'avatar.png', role: 'admin' };
    mockPathname = '/admin';
    render(<Sidebar />);

    expect(screen.getByTestId('nav-admin')).toHaveClass('active');
    expect(screen.getByTestId('nav-home')).not.toHaveClass('active');
  });

  it('一般ユーザー（非管理者）ログイン時は「管理者メニュー」を主要メニューに表示しない', () => {
    mockUser = { id: 'user-123', displayName: '一般ユーザー', avatarUrl: 'avatar.png', role: 'user' };
    render(<Sidebar />);

    expect(screen.queryByTestId('nav-admin')).not.toBeInTheDocument();
    expect(screen.queryByText('管理者メニュー')).not.toBeInTheDocument();
  });

  it('isCollapsed が true のときはミニ幅になり、ラベルを非表示にする', () => {
    mockUser = null;
    const { container } = render(<Sidebar isCollapsed={true} onToggle={jest.fn()} />);

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('lg:w-[70px]');
    expect(aside).not.toHaveClass('lg:w-[275px]');

    // ロゴの "etika" 部分が非表示クラスを持つこと
    const logoSuffix = screen.getByText('etika');
    expect(logoSuffix).toHaveClass('lg:hidden');

    // ナビゲーションラベルが非表示クラスを持つこと
    const labels = container.querySelectorAll('.nav-label');
    labels.forEach((label) => {
      expect(label).toHaveClass('lg:hidden');
    });
  });

  it('isCollapsed が false のときは通常幅になり、ラベルを表示する', () => {
    mockUser = null;
    const { container } = render(<Sidebar isCollapsed={false} onToggle={jest.fn()} />);

    const aside = container.querySelector('aside');
    expect(aside).toHaveClass('lg:w-[275px]');
    expect(aside).not.toHaveClass('lg:w-[70px]');

    const logoSuffix = screen.getByText('etika');
    expect(logoSuffix).not.toHaveClass('lg:hidden');

    const labels = container.querySelectorAll('.nav-label');
    labels.forEach((label) => {
      expect(label).not.toHaveClass('lg:hidden');
    });
  });

  it('トグルボタンが表示され、クリック時に onToggle が呼ばれる', () => {
    const mockToggle = jest.fn();
    render(<Sidebar isCollapsed={false} onToggle={mockToggle} />);

    const toggleBtn = screen.getByTestId('sidebar-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('ミニサイドバー表示時、ホバーツールチップ要素が各メニューにレンダリングされる', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    const { container } = render(<Sidebar isCollapsed={true} onToggle={jest.fn()} />);

    // ホーム・検索・アバター・プロフィールに対するツールチップ要素の検証
    const homeTooltip = screen.getAllByText('ホーム').find((el) => el.classList.contains('absolute'));
    expect(homeTooltip).toBeInTheDocument();

    const searchTooltip = screen.getAllByText('検索').find((el) => el.classList.contains('absolute'));
    expect(searchTooltip).toBeInTheDocument();

    const profileTooltip = screen.getAllByText('マイページ').find((el) => el.classList.contains('absolute'));
    expect(profileTooltip).toBeInTheDocument();

    const avatarTooltip = screen.getAllByText('ななみ').find((el) => el.classList.contains('absolute'));
    expect(avatarTooltip).toBeInTheDocument();
  });
});
