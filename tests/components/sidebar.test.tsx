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
    expect(screen.getByText('Proプラン')).toBeInTheDocument();
    expect(screen.queryByText('通知')).not.toBeInTheDocument();
    expect(screen.queryByText('ブックマーク')).not.toBeInTheDocument();
    expect(screen.queryByText('作問する')).not.toBeInTheDocument();
    expect(screen.queryByText('ダッシュボード')).not.toBeInTheDocument();
  });

  it('ログイン時は主要メニュー（通知、ブックマーク、作問、ダッシュボード）を表示する', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    render(<Sidebar />);
    
    expect(screen.getByText('ホーム')).toBeInTheDocument();
    expect(screen.getByText('通知')).toBeInTheDocument();
    expect(screen.getByText('ブックマーク')).toBeInTheDocument();
    expect(screen.getByText('作問する')).toBeInTheDocument();
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
    
    // ログインユーザーのアバター・表示名が表示されること
    expect(screen.getByText('ななみ')).toBeInTheDocument();
    expect(screen.getByAltText('ななみ')).toBeInTheDocument();
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

  it('プロフィール領域をクリックするとポップアップメニュー（マイページ、ログアウト）が表示される', () => {
    mockUser = { id: 'user-123', displayName: 'ななみ', avatarUrl: 'avatar.png' };
    render(<Sidebar />);
    
    // 最初はポップアップメニューがないこと
    expect(screen.queryByText('マイページ')).not.toBeInTheDocument();
    expect(screen.queryByText('ログアウト')).not.toBeInTheDocument();
    
    // プロフィールボタンをクリック
    const profileBtn = screen.getByTestId('sidebar-profile-btn');
    fireEvent.click(profileBtn);
    
    // ポップアップメニューが表示されること
    expect(screen.getByText('マイページ')).toBeInTheDocument();
    expect(screen.getByText('ログアウト')).toBeInTheDocument();
  });
});
