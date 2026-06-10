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

jest.mock('@/lib/firebase/config', () => ({
  auth: {},
}));

jest.mock('@/lib/firebase/auth', () => ({
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
    expect(screen.getByText('ホーム')).toBeInTheDocument();
    expect(screen.getByText('検索')).toBeInTheDocument();
    expect(screen.getByText('Proプラン')).toBeInTheDocument();
    expect(screen.queryByText('通知')).not.toBeInTheDocument();
    expect(screen.queryByText('ブックマーク')).not.toBeInTheDocument();
    expect(screen.queryByText('作問する')).not.toBeInTheDocument();
    expect(screen.queryByText('ダッシュボード')).not.toBeInTheDocument();
  });

  it('ログイン時は主要メニュー（マイクイズ、通知、ブックマーク、作問、ダッシュボード）を表示する', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    render(<Sidebar />);
    
    expect(screen.getByText('ホーム')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-lists')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-my-quiz')).toBeInTheDocument();
    expect(screen.getByText('通知')).toBeInTheDocument();
    expect(screen.getByText('ブックマーク')).toBeInTheDocument();
    expect(screen.getByText('作問する')).toBeInTheDocument();
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
    
    // ログインユーザーのアバター・表示名が表示されること
    expect(screen.getByText('ななみ')).toBeInTheDocument();
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
    const bookmarkLink = screen.getByText('ブックマーク').closest('a');
    expect(bookmarkLink).toHaveClass('active');
  });

  it('/pricing パスで Proプラン メニューがアクティブ表示になる', () => {
    mockUser = null;
    mockPathname = '/pricing';

    render(<Sidebar />);

    const pricingLink = screen.getByText('Proプラン').closest('a');
    expect(pricingLink).toHaveClass('active');
  });

  it('未ログイン時は nav-my-quiz を表示しない', () => {
    mockUser = null;
    render(<Sidebar />);
    expect(screen.queryByTestId('nav-lists')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-my-quiz')).not.toBeInTheDocument();
  });

  it('/my-quiz でマイクイズのみ active', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    mockPathname = '/my-quiz';
    render(<Sidebar />);
    expect(screen.getByTestId('nav-my-quiz')).toHaveClass('active');
    expect(screen.getByTestId('nav-home')).not.toHaveClass('active');
  });

  it('プロフィール領域をクリックするとポップアップ（マイページ、設定、ログアウト）が表示される', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    render(<Sidebar />);
    
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-settings-link')).not.toBeInTheDocument();
    
    fireEvent.click(screen.getByTestId('sidebar-profile-btn'));
    
    expect(screen.getByText('マイページ')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-settings-link')).toBeInTheDocument();
    expect(screen.getByText('ログアウト')).toBeInTheDocument();
  });
});
