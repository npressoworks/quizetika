/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';

jest.mock('@/lib/firebase/config', () => require('../../__mocks__/firebase-config'));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

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

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
}));

jest.mock('@/services/moderation', () => ({
  resolveFlag: jest.fn(),
}));

jest.mock('@/lib/seed-genres-access', () => ({
  assertSeedGenresAccess: jest.fn().mockResolvedValue({ id: 'admin-1' }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdminModerationPage = require('@/app/admin/moderation/page').default as typeof import('@/app/admin/moderation/page').default;

describe('AdminModerationPage - seed genres UI', () => {
  const mockGetIdToken = jest.fn().mockResolvedValue('admin-token');

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, added: 4, updated: 6 }),
    });
  });

  test('管理者のみ初期ジャンル投入セクションが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as never,
      firebaseUser: { getIdToken: mockGetIdToken } as never,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminModerationPage />);

    expect(
      await screen.findByRole('button', { name: /初期ジャンル一括投入/ })
    ).toBeInTheDocument();
  });

  test('シニアモデレータには投入ボタンが表示されないこと', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'mod-1',
        moderationTier: 'senior_moderator',
      } as never,
      firebaseUser: { getIdToken: mockGetIdToken } as never,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminModerationPage />);

    await waitFor(() => {
      expect(screen.getByText(/件の審査待ちコンテンツ/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /初期ジャンル一括投入/ })).not.toBeInTheDocument();
  });

  test('投入中はボタンが無効化され、完了後に成功メッセージが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as never,
      firebaseUser: { getIdToken: mockGetIdToken } as never,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminModerationPage />);

    const button = await screen.findByRole('button', { name: /初期ジャンル一括投入/ });
    fireEvent.click(button);

    expect(button).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText(/新規: 4件、更新: 6件/)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/seed-genres',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
