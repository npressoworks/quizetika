'use client';

import React, { useEffect, useState } from 'react';
import { EmojiEventsOutlined, LocalFireDepartmentOutlined } from '@mui/icons-material';
import { db } from '@/lib/firebase/config';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { User as DBUser } from '@/types';
import { leaderboardClasses as styles } from './leaderboard-classes';

interface LeaderboardUser {
  id: string;
  displayName: string;
  avatarUrl: string;
  score: number;
}

interface LeaderboardClientProps {
  initialRankings: LeaderboardUser[];
}

export function LeaderboardClient({ initialRankings }: LeaderboardClientProps) {
  const [activeTab, setActiveTab] = useState<'score' | 'plays' | 'creators'>('score');
  const [loading, setLoading] = useState<boolean>(false);
  const [rankings, setRankings] = useState<LeaderboardUser[]>(initialRankings);
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }

    async function fetchRankings() {
      setLoading(true);
      try {
        const usersRef = collection(db, 'users');
        let fetched: LeaderboardUser[] = [];

        if (activeTab === 'score') {
          const q = query(usersRef, orderBy('reputationScore', 'desc'), limit(10));
          const snap = await getDocs(q);
          fetched = snap.docs.map((docSnap) => {
            const u = docSnap.data() as DBUser;
            return {
              id: docSnap.id,
              displayName: u.displayName || 'ユーザー',
              avatarUrl: u.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg',
              score: u.reputationScore,
            };
          });
        } else if (activeTab === 'plays') {
          const q = query(usersRef, orderBy('totalPlayCount', 'desc'), limit(10));
          const snap = await getDocs(q);
          fetched = snap.docs.map((docSnap) => {
            const u = docSnap.data() as DBUser;
            return {
              id: docSnap.id,
              displayName: u.displayName || 'ユーザー',
              avatarUrl: u.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg',
              score: u.totalPlayCount,
            };
          });
        } else if (activeTab === 'creators') {
          const q = query(usersRef, orderBy('createdQuizzesCount', 'desc'), limit(10));
          const snap = await getDocs(q);
          fetched = snap.docs.map((docSnap) => {
            const u = docSnap.data() as DBUser;
            return {
              id: docSnap.id,
              displayName: u.displayName || 'ユーザー',
              avatarUrl: u.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg',
              score: u.createdQuizzesCount,
            };
          });
        }

        setRankings(fetched);
      } catch (e) {
        console.error('[LeaderboardClient] ランキング取得エラー:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchRankings();
  }, [activeTab]);

  return (
    <div className={styles.container} data-testid="leaderboard-page-container">
      <div className={styles.titleSection}>
        <h1 className={styles.title} data-testid="leaderboard-global-title">
          <EmojiEventsOutlined sx={{ fontSize: 36 }} style={{ color: '#ffd700', verticalAlign: 'text-bottom' }} />
          quizeum 殿堂入りリーダーボード
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
          プラットフォーム内で活躍するトップランカーたちのランキングです。
        </p>
      </div>

      {/* タブバー */}
      <div className={styles.tabBar} data-testid="leaderboard-global-tabs">
        <div
          className={`${styles.tab} ${activeTab === 'score' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('score')}
          data-testid="leaderboard-tab-score"
        >
          <LocalFireDepartmentOutlined sx={{ fontSize: 16 }} style={{ display: 'inline', marginRight: '6px' }} />
          総合信頼スコア
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'plays' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('plays')}
          data-testid="leaderboard-tab-plays"
        >
          <EmojiEventsOutlined sx={{ fontSize: 16 }} style={{ display: 'inline', marginRight: '6px' }} />
          累計プレイ数
        </div>
        <div
          className={`${styles.tab} ${activeTab === 'creators' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('creators')}
          data-testid="leaderboard-tab-creators"
        >
          <EmojiEventsOutlined sx={{ fontSize: 16 }} style={{ display: 'inline', marginRight: '6px' }} />
          クリエイターランキング
        </div>
      </div>

      {/* ランキングボード */}
      <div className={styles.boardCard}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            ランキングを集計中...
          </div>
        ) : rankings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            データが見つかりませんでした。
          </div>
        ) : (
          <table className={styles.table} data-testid="leaderboard-global-table">
            <thead>
              <tr>
                <th className={styles.th}>順位</th>
                <th className={styles.th}>プレイヤー</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>
                  {activeTab === 'score' && '信頼スコア'}
                  {activeTab === 'plays' && '累計プレイ数'}
                  {activeTab === 'creators' && '作成クイズ数'}
                </th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((player, index) => {
                const rankClass =
                  index === 0
                    ? styles.rank1
                    : index === 1
                    ? styles.rank2
                    : index === 2
                    ? styles.rank3
                    : styles.rankNormal;
                return (
                  <tr key={player.id}>
                    <td className={styles.td}>
                      <span className={`${styles.rankBadge} ${rankClass}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <img
                        src={player.avatarUrl}
                        alt={player.displayName}
                        width={32}
                        height={32}
                        className={styles.avatar}
                      />
                      <strong>{player.displayName}</strong>
                    </td>
                    <td className={styles.td} style={{ textAlign: 'right', fontWeight: 700 }}>
                      {player.score.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
