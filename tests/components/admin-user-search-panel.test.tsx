/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';
import { getUserProfile } from '@/services/user';
import { getUserAdminLogs } from '@/services/reputation';
import { User, AdminLogEntry } from '@/types';

jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/user', () => ({
  getUserProfile: jest.fn(),
}));

jest.mock('@/services/reputation', () => ({
  getUserAdminLogs: jest.fn(),
}));

// jsdom は PointerEvent 関連 API を実装していないため、base-ui コンポーネント
// （ConfirmActionDialog / TierDowngradeControl 内部）が使用する API に軽量ポリフィルを注入する。
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

import { AdminUserSearchPanel } from '@/app/admin/users/admin-user-search-panel';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockGetUserAdminLogs = getUserAdminLogs as jest.MockedFunction<typeof getUserAdminLogs>;

const testUser: User = {
  id: 'uid-1',
  displayName: 'テストユーザー',
  avatarUrl: '',
  isBanned: false,
  deleteStatus: null,
  reputationScore: 42,
  moderationTier: 'contributor',
  createdQuizzesCount: 3,
  totalPlayCount: 10,
} as unknown as User;

const testLogs: AdminLogEntry[] = [
  {
    id: 'log-1',
    action: 'ban',
    executorId: 'admin-uid-1',
    reason: '規約違反のため',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'log-2',
    action: 'reputation_reset',
    executorId: 'admin-uid-2',
    reason: null,
    createdAt: '2026-06-01T00:00:00.000Z',
  },
];

describe('AdminUserSearchPanel - 監査ログ履歴リストとスケルトン表示', () => {
  const mockGetIdToken = jest.fn().mockResolvedValue('admin-token');

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      authUser: { getIdToken: mockGetIdToken } as any,
    } as any);
  });

  const searchFor = async () => {
    render(<AdminUserSearchPanel />);
    fireEvent.change(screen.getByPlaceholderText('ユーザーUIDを入力...'), {
      target: { value: 'uid-1' },
    });
    fireEvent.click(screen.getByText('検索'));
  };

  test('ユーザー検索中はユーザー情報スケルトンが表示され、完了後に実データへ差し替わる', async () => {
    let resolveProfile: (u: User) => void;
    mockGetUserProfile.mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );
    mockGetUserAdminLogs.mockResolvedValue([]);

    await searchFor();

    expect(await screen.findByTestId('admin-user-info-skeleton')).toBeInTheDocument();

    resolveProfile!(testUser);

    await waitFor(() =>
      expect(screen.queryByTestId('admin-user-info-skeleton')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('テストユーザー')).toBeInTheDocument();
  });

  test('監査ログ取得中はログスケルトンが表示され、完了後に履歴リストへ差し替わる', async () => {
    mockGetUserProfile.mockResolvedValue(testUser);
    let resolveLogs: (logs: AdminLogEntry[]) => void;
    mockGetUserAdminLogs.mockReturnValue(
      new Promise((resolve) => {
        resolveLogs = resolve;
      }),
    );

    await searchFor();

    expect(await screen.findByTestId('admin-logs-skeleton')).toBeInTheDocument();

    resolveLogs!(testLogs);

    await waitFor(() =>
      expect(screen.queryByTestId('admin-logs-skeleton')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('BAN')).toBeInTheDocument();
    expect(screen.getByText('評判リセット')).toBeInTheDocument();
    expect(screen.getByText('規約違反のため')).toBeInTheDocument();
    expect(screen.getByText('admin-uid-1')).toBeInTheDocument();
  });

  test('ユーザー検索成功時に getUserAdminLogs が対象UIDで呼び出される', async () => {
    mockGetUserProfile.mockResolvedValue(testUser);
    mockGetUserAdminLogs.mockResolvedValue(testLogs);

    await searchFor();

    await waitFor(() => expect(mockGetUserAdminLogs).toHaveBeenCalledWith('uid-1'));
  });

  test('リセット実行成功後に監査ログ一覧が再取得される', async () => {
    mockGetUserProfile.mockResolvedValue(testUser);
    mockGetUserAdminLogs.mockResolvedValue(testLogs);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await searchFor();
    await waitFor(() => expect(mockGetUserAdminLogs).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('リセット理由（10文字以上必須）'), {
      target: { value: 'これはテスト用の十分な長さの理由です' },
    });
    fireEvent.click(document.getElementById('execute-reset-btn')!);

    const confirmBtn = await screen.findByTestId('confirm-action-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockGetUserAdminLogs).toHaveBeenCalledTimes(2));
  });
});
