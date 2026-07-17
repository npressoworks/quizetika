/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LeaderboardClient } from '@/app/leaderboard/leaderboard-client';

jest.mock('@/services/user', () => ({
  getUserLeaderboard: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/governance-freeze', () => ({
  isGovernanceFrozen: jest.fn().mockReturnValue(false),
}));

const mockInitialRankings = [
  { id: 'user-1', displayName: 'ユーザー1', avatarUrl: '', score: 100 },
];

describe('Leaderboard - Governance Freeze Display Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('凍結フラグOFFのとき、総合信頼スコア（score）タブが表示されること', () => {
    const { isGovernanceFrozen } = require('@/lib/governance-freeze');
    isGovernanceFrozen.mockReturnValue(false);

    render(<LeaderboardClient initialRankings={mockInitialRankings} />);

    expect(screen.getByTestId('leaderboard-tab-score')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard-tab-plays')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard-tab-creators')).toBeInTheDocument();
  });

  test('凍結フラグONのとき、総合信頼スコア（score）タブが非表示になり、初期選択タブが累計プレイ数（plays）になること', () => {
    const { isGovernanceFrozen } = require('@/lib/governance-freeze');
    isGovernanceFrozen.mockReturnValue(true);

    render(<LeaderboardClient initialRankings={mockInitialRankings} />);

    // scoreタブは描画されない
    expect(screen.queryByTestId('leaderboard-tab-score')).not.toBeInTheDocument();

    // playsとcreatorsタブは描画される
    expect(screen.getByTestId('leaderboard-tab-plays')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard-tab-creators')).toBeInTheDocument();

    // 初期タブ plays が active になっていること
    expect(screen.getByTestId('leaderboard-tab-plays').className).toContain('bg-background');
    expect(screen.queryByTestId('leaderboard-tab-creators')?.className).not.toContain('bg-background');
  });
});
