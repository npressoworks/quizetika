/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '@/components/layout/header';

let mockUser: { id: string; displayName: string; avatarUrl: string } | null = null;

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: mockUser, loading: false }),
}));

jest.mock('@/lib/firebase/config', () => ({ auth: {} }));
jest.mock('@/lib/firebase/auth', () => ({
  signOut: jest.fn(() => Promise.resolve()),
}));

describe('Header profile popup', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1', displayName: 'Tester', avatarUrl: '/a.png' };
  });

  test('header-profile-btn でポップアップが開く', () => {
    render(<Header />);
    fireEvent.click(screen.getByTestId('header-profile-btn'));
    expect(screen.getByTestId('header-profile-popup')).toBeInTheDocument();
    expect(screen.queryByTestId('header-nav-lists')).not.toBeInTheDocument();
    expect(screen.getByTestId('header-nav-my-quiz')).toBeInTheDocument();
    expect(screen.getByTestId('header-settings-link')).toBeInTheDocument();
  });

  test('管理者ログイン時は header-admin-link が表示されること', () => {
    mockUser = { id: 'admin-1', displayName: 'Admin Tester', avatarUrl: '/a.png', role: 'admin' } as any;
    render(<Header />);
    fireEvent.click(screen.getByTestId('header-profile-btn'));
    expect(screen.getByTestId('header-admin-link')).toBeInTheDocument();
  });

  test('一般ユーザーログイン時は header-admin-link が表示されないこと', () => {
    mockUser = { id: 'user-1', displayName: 'User Tester', avatarUrl: '/a.png', role: 'user' } as any;
    render(<Header />);
    fireEvent.click(screen.getByTestId('header-profile-btn'));
    expect(screen.queryByTestId('header-admin-link')).not.toBeInTheDocument();
  });
});
