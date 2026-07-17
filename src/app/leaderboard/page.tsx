import React, { Suspense } from 'react';
import { getUserLeaderboard } from '@/services/user';
import { LeaderboardClient } from './leaderboard-client';
import { LeaderboardSkeleton } from '@/components/quiz/leaderboard-skeleton';
import { leaderboardClasses as styles } from './leaderboard-classes';
import { isGovernanceFrozen } from '@/lib/governance-freeze';

export default async function LeaderboardPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<LeaderboardSkeleton data-testid="leaderboard-global-skeleton" />}>
        <LeaderboardDataLoader />
      </Suspense>
    </div>
  );
}

async function LeaderboardDataLoader() {
  try {
    const sortBy = isGovernanceFrozen() ? 'totalPlayCount' : 'reputationScore';
    const users = await getUserLeaderboard(sortBy, 10);
    const initialRankings = users.map((u) => ({
      id: u.id,
      displayName: u.displayName || 'ユーザー',
      avatarUrl: u.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg',
      score: sortBy === 'totalPlayCount' ? u.totalPlayCount : u.reputationScore,
    }));

    return <LeaderboardClient initialRankings={initialRankings} />;
  } catch (e) {
    console.error('[LeaderboardDataLoader] 初期データ取得失敗:', e);
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger, #c62828)' }}>
        ランキングの読み込みに失敗しました。ページを再読み込みしてください。
      </div>
    );
  }
}

