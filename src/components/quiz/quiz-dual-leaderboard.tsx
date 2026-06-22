'use client';

import React, { useMemo } from 'react';
import { EmojiEventsOutlined } from '@mui/icons-material';
import { getLeaderboardFirstPlay, getLeaderboardReplay } from '@/lib/leaderboard-ranking';
import type { LeaderboardRecord, Quiz } from '@/types';
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

export interface QuizDualLeaderboardProps {
  quiz: Quiz;
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

function LeaderboardTable({
  entries,
  tableTestId,
  rowKeyPrefix,
}: {
  entries: LeaderboardRecord[];
  tableTestId: string;
  rowKeyPrefix: string;
}) {
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
              <TableCell className={cn(rankClass(index))}>#{index + 1}</TableCell>
              <TableCell>{record.displayName || '名無しさん'}</TableCell>
              <TableCell>{record.score}</TableCell>
              <TableCell>{record.elapsedSeconds} 秒</TableCell>
              <TableCell>{formatCompletedAt(record.completedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function QuizDualLeaderboard({ quiz }: QuizDualLeaderboardProps) {
  const firstPlayEntries = useMemo(
    () => getLeaderboardFirstPlay(quiz).slice(0, 5),
    [quiz]
  );
  const replayEntries = useMemo(
    () => getLeaderboardReplay(quiz).slice(0, 5),
    [quiz]
  );

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
          <TabsList className="mb-4 h-auto w-full flex-wrap">
            <TabsTrigger value="firstPlay" data-testid="quiz-leaderboard-tab-first" className="flex-1">
              初回プレイランキング（上位5名）
            </TabsTrigger>
            <TabsTrigger value="replay" data-testid="quiz-leaderboard-tab-replay" className="flex-1">
              リプレイランキング（上位5名）
            </TabsTrigger>
          </TabsList>
          <TabsContent value="firstPlay">
            <LeaderboardTable
              entries={firstPlayEntries}
              tableTestId="highscore-leaderboard"
              rowKeyPrefix="first"
            />
          </TabsContent>
          <TabsContent value="replay">
            <LeaderboardTable
              entries={replayEntries}
              tableTestId="replay-leaderboard"
              rowKeyPrefix="replay"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
