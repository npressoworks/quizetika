/**
 * 通報数上位ユーザー一覧パネル
 *
 * `getReportedUsersRanking` を呼び出し、総通報数降順のランキングを
 * limit/offsetベースの「前へ/次へ」ページネーションで表示する。
 * 行選択時は `onSelectUser(uid)` を呼び出すのみで、詳細操作の実装は保持しない
 * （Single Responsibility、design.md ReportedUsersPanelセクション参照）。
 *
 * 管理者ロールガード（Requirement 9.1）は `AdminUsersPage` 側の責務であり、
 * 本コンポーネントは呼び出し元がすでにアクセス制御を検証済みであることを前提とする。
 */
'use client';

import React, { useEffect, useState } from 'react';
import { getReportedUsersRanking } from '@/services/reputation-client';
import { ReportedUserSummary } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 20;

const TIER_LABELS: Record<ReportedUserSummary['moderationTier'], string> = {
  newcomer: 'Newcomer (新規)',
  contributor: 'Contributor (貢献者)',
  moderator: 'Moderator (一般モデレータ)',
  senior_moderator: 'Senior Moderator (上級モデレータ)',
};

const getTierLabel = (tier: ReportedUserSummary['moderationTier']) => TIER_LABELS[tier] ?? tier;

interface AdminReportedUsersPanelProps {
  onSelectUser: (uid: string) => void;
}

export function AdminReportedUsersPanel({ onSelectUser }: AdminReportedUsersPanelProps) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ReportedUserSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    getReportedUsersRanking(page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setHasMore(result.hasMore);
      })
      .catch((err) => {
        console.error('通報数上位ユーザー一覧の取得エラー:', err);
        if (cancelled) return;
        setItems([]);
        setHasMore(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">通報数上位ユーザー</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div data-testid="admin-reported-users-skeleton" className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">通報されたユーザーはいません</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>表示名</TableHead>
                  <TableHead>UID</TableHead>
                  <TableHead>ティア</TableHead>
                  <TableHead>BANステータス</TableHead>
                  <TableHead>総通報数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.uid}
                    className="cursor-pointer"
                    onClick={() => onSelectUser(item.uid)}
                  >
                    <TableCell className="font-medium">{item.displayName}</TableCell>
                    <TableCell className="font-mono text-xs">{item.uid}</TableCell>
                    <TableCell>{getTierLabel(item.moderationTier)}</TableCell>
                    <TableCell>
                      {item.isBanned ? (
                        <Badge variant="destructive">BAN済み</Badge>
                      ) : (
                        <Badge variant="outline">アクティブ</Badge>
                      )}
                    </TableCell>
                    <TableCell>{item.totalReportCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                前へ
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                次へ
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
