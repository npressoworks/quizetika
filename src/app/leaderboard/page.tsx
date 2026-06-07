import React, { Suspense } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { User as DBUser } from '@/types';
import { LeaderboardClient } from './leaderboard-client';
import { LeaderboardSkeleton } from '@/components/quiz/leaderboard-skeleton';
import styles from './leaderboard.module.css';

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
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('reputationScore', 'desc'), limit(10));
    const snap = await getDocs(q);
    const initialRankings = snap.docs.map((docSnap) => {
      const u = docSnap.data() as DBUser;
      return {
        id: docSnap.id,
        displayName: u.displayName || 'ユーザー',
        avatarUrl: u.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg',
        score: u.reputationScore,
      };
    });

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
