'use client';

import React from 'react';
import { EmojiEventsOutlined } from '@mui/icons-material';
import type { LeaderboardRecord, LeaderboardSelfEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useQuizLeaderboard } from '@/hooks/useQuizLeaderboard';

export interface QuizDualLeaderboardProps {
  quizId: string;
}

function formatCompletedAt(value: Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ja-JP');
}

function rankClass(index: number): string {
  if (index === 0) return 'font-bold text-amber-500';
  if (index === 1) return 'font-bold text-slate-400';
  if (index === 2) return 'font-bold text-amber-700';
  return '';
}

/**
 * 順位・ユーザー表示名・正解数・合計解答時間・達成日の列定義。
 * TOP5表・自分の順位行の両方から再利用する（design.md Phase 38 Implementation Notes）。
 */
function LeaderboardRowCells({ rank, record }: { rank: number; record: LeaderboardRecord }) {
  return (
    <>
      <TableCell className={cn(rankClass(rank - 1))}>#{rank}</TableCell>
      <TableCell>{record.displayName || '名無しさん'}</TableCell>
      <TableCell>{record.score}</TableCell>
      <TableCell>{record.elapsedSeconds} 秒</TableCell>
      <TableCell>{formatCompletedAt(record.completedAt)}</TableCell>
    </>
  );
}

function LeaderboardTable({
  entries,
  loading,
  tableTestId,
  rowKeyPrefix,
}: {
  entries: LeaderboardRecord[];
  loading: boolean;
  tableTestId: string;
  rowKeyPrefix: string;
}) {
  if (loading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">読み込み中...</p>;
  }

  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">まだ記録がありません。</p>;
  }

  return (
    <div data-testid={tableTestId}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>順位</TableHead>
            <TableHead>ユーザー名</TableHead>
            <TableHead>正解数</TableHead>
            <TableHead>合計時間</TableHead>
            <TableHead>達成日</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((record, index) => (
            <TableRow
              key={`${rowKeyPrefix}-${record.userId}-${index}`}
              data-testid="leaderboard-entry"
            >
              <LeaderboardRowCells rank={index + 1} record={record} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * TOP5表とは別枠で、ログインユーザー自身の順位を常に1行表示する（TOP5圏内・圏外を問わない）。
 * TOP5行と同一の列定義（LeaderboardRowCells）を再利用する（要件9.9、design.md Implementation Notes）。
 */
function MyRankRow({
  self,
  rowTestId,
}: {
  self: LeaderboardSelfEntry;
  rowTestId: string;
}) {
  return (
    <div className="mt-4 border-t pt-4">
      <p className="mb-2 text-sm font-medium text-muted-foreground">あなたの順位</p>
      <Table>
        <TableBody>
          <TableRow data-testid={rowTestId}>
            <LeaderboardRowCells rank={self.rank} record={self} />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export function QuizDualLeaderboard({ quizId }: QuizDualLeaderboardProps) {
  const { user } = useAuth();
  const { firstPlay, replay } = useQuizLeaderboard(quizId, user?.id ?? null);

  return (
    <Card data-testid="quiz-leaderboard">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <EmojiEventsOutlined sx={{ fontSize: 20 }} aria-hidden />
          クイズランキング
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="firstPlay">
          <TabsList className="mb-4 h-auto w-full">
            <TabsTrigger value="firstPlay" data-testid="quiz-leaderboard-tab-first" className="flex-1 whitespace-normal">
              初回プレイ
            </TabsTrigger>
            <TabsTrigger value="replay" data-testid="quiz-leaderboard-tab-replay" className="flex-1 whitespace-normal">
              2回目以降
            </TabsTrigger>
          </TabsList>
          <TabsContent value="firstPlay">
            <LeaderboardTable
              entries={firstPlay.top}
              loading={firstPlay.loading}
              tableTestId="highscore-leaderboard"
              rowKeyPrefix="first"
            />
            {!firstPlay.loading && firstPlay.self && (
              <MyRankRow self={firstPlay.self} rowTestId="leaderboard-my-rank-first" />
            )}
          </TabsContent>
          <TabsContent value="replay">
            <LeaderboardTable
              entries={replay.top}
              loading={replay.loading}
              tableTestId="replay-leaderboard"
              rowKeyPrefix="replay"
            />
            {!replay.loading && replay.self && (
              <MyRankRow self={replay.self} rowTestId="leaderboard-my-rank-replay" />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
