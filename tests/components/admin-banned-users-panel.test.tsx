/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';
import { getBannedUsers, unbanUser } from '@/services/reputation-client';
import { BannedUserSummary } from '@/types';

jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/reputation-client', () => ({
  getBannedUsers: jest.fn(),
  unbanUser: jest.fn(),
}));

// jsdom は PointerEvent 関連 API を実装していないため、base-ui コンポーネント
// （ConfirmActionDialog 内部）が使用する API に軽量ポリフィルを注入する。
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

import { AdminBannedUsersPanel } from '@/app/admin/users/admin-banned-users-panel';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetBannedUsers = getBannedUsers as jest.MockedFunction<typeof getBannedUsers>;
const mockUnbanUser = unbanUser as jest.MockedFunction<typeof unbanUser>;

const makeItem = (overrides: Partial<BannedUserSummary> = {}): BannedUserSummary => ({
  uid: 'uid-1',
  displayName: 'テストユーザー',
  bannedReason: '規約違反のため',
  bannedAt: '2026-07-01T00:00:00.000Z',
  bannedByExecutorId: 'admin-uid-1',
  ...overrides,
});

describe('AdminBannedUsersPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      authUser: { uid: 'admin-uid-current' } as any,
    } as any);
  });

  it('ロード中はスケルトンを表示し、取得後はテーブル行に置き換える', async () => {
    let resolveFn: (value: { items: BannedUserSummary[]; hasMore: boolean }) => void = () => {};
    mockGetBannedUsers.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    render(<AdminBannedUsersPanel />);

    expect(screen.getByTestId('admin-banned-users-skeleton')).toBeInTheDocument();

    resolveFn({ items: [makeItem()], hasMore: false });

    await waitFor(() => {
      expect(screen.queryByTestId('admin-banned-users-skeleton')).not.toBeInTheDocument();
    });
    expect(screen.getByText('テストユーザー')).toBeInTheDocument();
  });

  it('表示名・UID・BAN理由・BAN日時・実行者を表示する', async () => {
    mockGetBannedUsers.mockResolvedValue({
      items: [
        makeItem({
          uid: 'uid-banned',
          displayName: 'BANユーザー',
          bannedReason: '不正行為のため',
          bannedByExecutorId: 'admin-uid-9',
        }),
      ],
      hasMore: false,
    });

    render(<AdminBannedUsersPanel />);

    await waitFor(() => {
      expect(screen.getByText('BANユーザー')).toBeInTheDocument();
    });
    expect(screen.getByText('uid-banned')).toBeInTheDocument();
    expect(screen.getByText('不正行為のため')).toBeInTheDocument();
    expect(screen.getByText('admin-uid-9')).toBeInTheDocument();
  });

  it('日時範囲・キーワード変更で再取得し、page が1にリセットされる', async () => {
    mockGetBannedUsers.mockResolvedValueOnce({
      items: [makeItem({ uid: 'page-1-user' })],
      hasMore: true,
    });

    render(<AdminBannedUsersPanel />);

    await waitFor(() => {
      expect(screen.getByText('page-1-user')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '次へ' }));

    await waitFor(() => {
      expect(mockGetBannedUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });

    mockGetBannedUsers.mockResolvedValueOnce({
      items: [makeItem({ uid: 'filtered-user' })],
      hasMore: false,
    });

    fireEvent.change(screen.getByLabelText('キーワード検索'), {
      target: { value: 'テスト検索語' },
    });

    await waitFor(() => {
      expect(mockGetBannedUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'テスト検索語', page: 1 }),
      );
    });

    mockGetBannedUsers.mockResolvedValueOnce({
      items: [makeItem({ uid: 'range-user' })],
      hasMore: false,
    });

    fireEvent.change(screen.getByLabelText('BAN日時（開始）'), {
      target: { value: '2026-06-01' },
    });

    await waitFor(() => {
      expect(mockGetBannedUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ bannedFrom: '2026-06-01', page: 1 }),
      );
    });
  });

  it('「次へ」でページを進め、hasMoreに応じてボタンの活性/非活性が切り替わる', async () => {
    mockGetBannedUsers.mockResolvedValueOnce({
      items: [makeItem({ uid: 'page-1-user' })],
      hasMore: true,
    });

    render(<AdminBannedUsersPanel />);

    await waitFor(() => {
      expect(screen.getByText('page-1-user')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: '前へ' });
    const nextButton = screen.getByRole('button', { name: '次へ' });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    mockGetBannedUsers.mockResolvedValueOnce({
      items: [makeItem({ uid: 'page-2-user' })],
      hasMore: false,
    });

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('page-2-user')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '前へ' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled();
  });

  it('解除ボタンで確認ダイアログが開き、確認するとunbanUserが呼ばれて行が一覧から除外される', async () => {
    mockGetBannedUsers.mockResolvedValue({
      items: [
        makeItem({ uid: 'uid-to-unban', displayName: '解除対象ユーザー' }),
        makeItem({ uid: 'uid-other', displayName: '別のユーザー' }),
      ],
      hasMore: false,
    });
    mockUnbanUser.mockResolvedValue(undefined);

    render(<AdminBannedUsersPanel />);

    await waitFor(() => {
      expect(screen.getByText('解除対象ユーザー')).toBeInTheDocument();
    });

    const unbanButtons = screen.getAllByRole('button', { name: '解除' });
    fireEvent.click(unbanButtons[0]);

    const confirmBtn = await screen.findByTestId('confirm-action-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockUnbanUser).toHaveBeenCalledWith('uid-to-unban', 'admin-uid-current');
    });

    await waitFor(() => {
      expect(screen.queryByText('解除対象ユーザー')).not.toBeInTheDocument();
    });
    expect(screen.getByText('別のユーザー')).toBeInTheDocument();
  });

  it('該当0件のときは空状態メッセージを表示する', async () => {
    mockGetBannedUsers.mockResolvedValue({ items: [], hasMore: false });

    render(<AdminBannedUsersPanel />);

    await waitFor(() => {
      expect(screen.getByText('該当するBAN済みユーザーが見つかりません')).toBeInTheDocument();
    });
  });
});
