/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { getReportedUsersRanking } from '@/services/reputation';
import { ReportedUserSummary } from '@/types';

jest.mock('@/services/reputation', () => ({
  getReportedUsersRanking: jest.fn(),
}));

import { AdminReportedUsersPanel } from '@/app/admin/users/admin-reported-users-panel';

const mockGetReportedUsersRanking = getReportedUsersRanking as jest.MockedFunction<
  typeof getReportedUsersRanking
>;

const makeItem = (overrides: Partial<ReportedUserSummary> = {}): ReportedUserSummary => ({
  uid: 'uid-1',
  displayName: 'テストユーザー',
  moderationTier: 'contributor',
  isBanned: false,
  totalReportCount: 5,
  latestReportAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

describe('AdminReportedUsersPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ロード中はスケルトンを表示し、取得後はテーブル行に置き換える', async () => {
    let resolveFn: (value: { items: ReportedUserSummary[]; hasMore: boolean }) => void = () => {};
    mockGetReportedUsersRanking.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      })
    );

    render(<AdminReportedUsersPanel onSelectUser={jest.fn()} />);

    expect(screen.getByTestId('admin-reported-users-skeleton')).toBeInTheDocument();

    resolveFn({ items: [makeItem()], hasMore: false });

    await waitFor(() => {
      expect(screen.queryByTestId('admin-reported-users-skeleton')).not.toBeInTheDocument();
    });
    expect(screen.getByText('テストユーザー')).toBeInTheDocument();
  });

  it('表示名・UID・ティアラベル・BANステータス・総通報数を表示する', async () => {
    mockGetReportedUsersRanking.mockResolvedValue({
      items: [
        makeItem({
          uid: 'uid-banned',
          displayName: 'BANユーザー',
          moderationTier: 'senior_moderator',
          isBanned: true,
          totalReportCount: 12,
        }),
      ],
      hasMore: false,
    });

    render(<AdminReportedUsersPanel onSelectUser={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('BANユーザー')).toBeInTheDocument();
    });
    expect(screen.getByText('uid-banned')).toBeInTheDocument();
    expect(screen.getByText(/Senior Moderator/)).toBeInTheDocument();
    expect(screen.getByText('BAN済み')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('行を選択すると onSelectUser が正しいuidで呼ばれる', async () => {
    const onSelectUser = jest.fn();
    mockGetReportedUsersRanking.mockResolvedValue({
      items: [makeItem({ uid: 'uid-select-me' })],
      hasMore: false,
    });

    render(<AdminReportedUsersPanel onSelectUser={onSelectUser} />);

    await waitFor(() => {
      expect(screen.getByText('テストユーザー')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('テストユーザー'));

    expect(onSelectUser).toHaveBeenCalledWith('uid-select-me');
  });

  it('「次へ」でページを進め、hasMoreに応じてボタンの活性/非活性が切り替わる', async () => {
    mockGetReportedUsersRanking.mockResolvedValueOnce({
      items: [makeItem({ uid: 'page-1-user' })],
      hasMore: true,
    });

    render(<AdminReportedUsersPanel onSelectUser={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('page-1-user')).toBeInTheDocument();
    });

    const prevButton = screen.getByRole('button', { name: '前へ' });
    const nextButton = screen.getByRole('button', { name: '次へ' });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    mockGetReportedUsersRanking.mockResolvedValueOnce({
      items: [makeItem({ uid: 'page-2-user' })],
      hasMore: false,
    });

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('page-2-user')).toBeInTheDocument();
    });

    expect(mockGetReportedUsersRanking).toHaveBeenLastCalledWith(2, expect.any(Number));
    expect(screen.getByRole('button', { name: '前へ' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled();
  });

  it('該当0件のときは空状態メッセージを表示する', async () => {
    mockGetReportedUsersRanking.mockResolvedValue({ items: [], hasMore: false });

    render(<AdminReportedUsersPanel onSelectUser={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('通報されたユーザーはいません')).toBeInTheDocument();
    });
  });
});
