/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';
import { getUserProfile } from '@/services/user';
import { getUserAdminLogs, getUserOpenReportCount } from '@/services/reputation-client';
import { User, AdminLogEntry } from '@/types';

jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/user', () => ({
  getUserProfile: jest.fn(),
}));

jest.mock('@/services/reputation-client', () => ({
  getUserAdminLogs: jest.fn(),
  getUserOpenReportCount: jest.fn(),
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
const mockGetUserOpenReportCount = getUserOpenReportCount as jest.MockedFunction<
  typeof getUserOpenReportCount
>;

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
    mockGetUserOpenReportCount.mockResolvedValue(0);
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

describe('AdminUserSearchPanel - 通報数リセット（Requirement 12）', () => {
  const mockGetIdToken = jest.fn().mockResolvedValue('admin-token');

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      authUser: { getIdToken: mockGetIdToken } as any,
    } as any);
    mockGetUserProfile.mockResolvedValue(testUser);
    mockGetUserAdminLogs.mockResolvedValue([]);
  });

  const searchFor = async () => {
    render(<AdminUserSearchPanel />);
    fireEvent.change(screen.getByPlaceholderText('ユーザーUIDを入力...'), {
      target: { value: 'uid-1' },
    });
    fireEvent.click(screen.getByText('検索'));
  };

  test('ユーザー検索成功時に未処理通報件数の取得関数が対象UIDで呼び出され、結果が画面に表示される', async () => {
    mockGetUserOpenReportCount.mockResolvedValue(3);

    await searchFor();

    await waitFor(() => expect(mockGetUserOpenReportCount).toHaveBeenCalledWith('uid-1'));
    expect(await screen.findByText(/未処理の直接通報.*3件/)).toBeInTheDocument();
  });

  test('未処理通報が0件のとき、通報数リセット実行ボタンは非活性化される', async () => {
    mockGetUserOpenReportCount.mockResolvedValue(0);

    await searchFor();

    await waitFor(() => expect(screen.getByText(/未処理の直接通報.*0件/)).toBeInTheDocument());
    expect(document.getElementById('execute-reset-reports-btn')).toBeDisabled();
  });

  test('未処理通報が1件以上のとき活性化され、理由が10文字未満だと実行ボタンは非活性化される', async () => {
    mockGetUserOpenReportCount.mockResolvedValue(1);

    await searchFor();

    await waitFor(() => expect(screen.getByText(/未処理の直接通報.*1件/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('通報数リセット理由（10文字以上必須）'), {
      target: { value: '短い理由' },
    });

    expect(document.getElementById('execute-reset-reports-btn')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('通報数リセット理由（10文字以上必須）'), {
      target: { value: 'これはテスト用の十分な長さの理由です' },
    });

    expect(document.getElementById('execute-reset-reports-btn')).not.toBeDisabled();
  });

  test('確認後、reset-reports APIがBearerトークン付きで正しいbodyで呼び出され、成功後に件数0・成功メッセージ・監査ログ再取得を反映する', async () => {
    mockGetUserOpenReportCount.mockResolvedValue(2);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await searchFor();
    await waitFor(() => expect(screen.getByText(/未処理の直接通報.*2件/)).toBeInTheDocument());
    await waitFor(() => expect(mockGetUserAdminLogs).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('通報数リセット理由（10文字以上必須）'), {
      target: { value: 'これはテスト用の十分な長さの理由です' },
    });
    fireEvent.click(document.getElementById('execute-reset-reports-btn')!);

    const confirmBtn = await screen.findByTestId('confirm-action-btn');

    // 確認後の再取得はカウント0を返すようにする
    mockGetUserOpenReportCount.mockResolvedValue(0);
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/users/reset-reports',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        body: JSON.stringify({
          targetUid: 'uid-1',
          reason: 'これはテスト用の十分な長さの理由です',
        }),
      }),
    );

    await waitFor(() => expect(mockGetUserAdminLogs).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/未処理の直接通報.*0件/)).toBeInTheDocument());
    expect(screen.getByText(/ユーザーの通報数をリセットしました|通報.*リセットしました/)).toBeInTheDocument();
  });

  test('クイズ通報累計（quizzes.flags_count）には影響しない旨の説明文が表示される', async () => {
    mockGetUserOpenReportCount.mockResolvedValue(1);

    await searchFor();

    await waitFor(() => expect(screen.getByText(/未処理の直接通報.*1件/)).toBeInTheDocument());
    expect(screen.getByText(/flags_count/)).toBeInTheDocument();
  });
});
