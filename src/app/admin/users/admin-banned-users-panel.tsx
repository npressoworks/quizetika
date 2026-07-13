/**
 * BAN済みユーザー一覧パネル
 *
 * `getBannedUsers` を呼び出し、BAN実行日時降順の一覧を
 * 日時範囲・キーワードでの絞り込み、limit/offsetベースの「前へ/次へ」
 * ページネーションで表示する。行から `ConfirmActionDialog` を再利用した
 * 解除（UNBAN）操作を実行できる（design.md BannedUsersPanelセクション参照）。
 *
 * 管理者ロールガード（Requirement 11.1）は `AdminUsersPage` 側の責務であり、
 * 本コンポーネントは呼び出し元がすでにアクセス制御を検証済みであることを前提とする。
 */
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { getBannedUsers, unbanUser, type BannedUserFilters } from '@/services/reputation-client';
import { BannedUserSummary } from '@/types';
import { ConfirmActionDialog } from '@/components/admin/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export function AdminBannedUsersPanel() {
  const { authUser } = useAuth();

  const [bannedFrom, setBannedFrom] = useState('');
  const [bannedTo, setBannedTo] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<BannedUserSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const [pendingUnbanUid, setPendingUnbanUid] = useState<string | null>(null);
  const [unbanLoading, setUnbanLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    const filters: BannedUserFilters = {
      bannedFrom: bannedFrom || undefined,
      bannedTo: bannedTo || undefined,
      keyword: keyword || undefined,
      page,
      pageSize: PAGE_SIZE,
    };

    getBannedUsers(filters)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setHasMore(result.hasMore);
      })
      .catch((err) => {
        console.error('BAN済みユーザー一覧の取得エラー:', err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannedFrom, bannedTo, keyword, page]);

  const handleBannedFromChange = (value: string) => {
    setBannedFrom(value);
    setPage(1);
  };

  const handleBannedToChange = (value: string) => {
    setBannedTo(value);
    setPage(1);
  };

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const handleConfirmUnban = async () => {
    if (!pendingUnbanUid) return;

    setUnbanLoading(true);
    try {
      await unbanUser(pendingUnbanUid, authUser?.uid ?? '');
      setItems((prev) => prev.filter((item) => item.uid !== pendingUnbanUid));
      setPendingUnbanUid(null);
    } catch (err) {
      console.error('BAN解除エラー:', err);
    } finally {
      setUnbanLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">BAN済みユーザー</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bannedFrom">BAN日時（開始）</Label>
            <Input
              id="bannedFrom"
              type="date"
              value={bannedFrom}
              onChange={(e) => handleBannedFromChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bannedTo">BAN日時（終了）</Label>
            <Input
              id="bannedTo"
              type="date"
              value={bannedTo}
              onChange={(e) => handleBannedToChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyword">キーワード検索</Label>
            <Input
              id="keyword"
              type="text"
              placeholder="UIDまたは表示名で検索..."
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div data-testid="admin-banned-users-skeleton" className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">該当するBAN済みユーザーが見つかりません</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>表示名</TableHead>
                  <TableHead>UID</TableHead>
                  <TableHead>BAN理由</TableHead>
                  <TableHead>BAN日時</TableHead>
                  <TableHead>実行者</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.uid}>
                    <TableCell className="font-medium">{item.displayName}</TableCell>
                    <TableCell className="font-mono text-xs">{item.uid}</TableCell>
                    <TableCell>{item.bannedReason ?? '（理由なし）'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.bannedAt).toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.bannedByExecutorId ?? '（不明）'}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingUnbanUid(item.uid)}
                      >
                        解除
                      </Button>
                    </TableCell>
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

      {pendingUnbanUid && (
        <ConfirmActionDialog
          open={!!pendingUnbanUid}
          onOpenChange={(open) => {
            if (!open && !unbanLoading) setPendingUnbanUid(null);
          }}
          title="BANを解除しますか？"
          description="このユーザーのアカウント停止を解除し、通常のアクセスを復帰させます。"
          confirmLabel="BANを解除"
          onConfirm={handleConfirmUnban}
          loading={unbanLoading}
        />
      )}
    </Card>
  );
}
