'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function SettingsClient() {
  const { user, authUser } = useAuth();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const router = useRouter();

  const handleDeleteAccount = async () => {
    if (!authUser) return;
    setIsDeleting(true);
    try {
      const token = await authUser.getIdToken();
      const response = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: authUser.uid }),
      });

      if (!response.ok) {
        throw new Error('退会処理に失敗しました');
      }

      // ログアウトとリダイレクト
      const { signOut } = await import('@/lib/supabase/auth');
      await signOut();
      router.push('/?deleted=true');
    } catch (error) {
      console.error(error);
      alert('退会処理中にエラーが発生しました。再度お試しください。');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="settings-page-container">
      <Card>
        <CardHeader>
          <CardTitle>表示テーマ</CardTitle>
          <CardDescription>アプリ全体の配色を切り替えます。</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      {user && (
        <Card>
          <CardHeader>
            <CardTitle>アカウント</CardTitle>
            <CardDescription>プロフィール情報を編集できます。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 items-start">
            <Link
              href="/profile/edit"
              data-testid="settings-profile-edit-link"
              className={cn(buttonVariants({ variant: 'secondary' }))}
            >
              プロフィールを編集
            </Link>

            <div className="border-t pt-4 w-full">
              <h4 className="text-sm font-medium text-destructive mb-1">危険な操作</h4>
              <p className="text-xs text-muted-foreground mb-3">
                退会すると、作成したクイズやプレイ履歴などが削除され、有料サブスクリプションも即時に解約されます。この操作は取り消せません。
              </p>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" data-testid="settings-delete-account-button">
                      退会する
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>本当に退会しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      退会すると、アカウント情報および関連するデータ（作成したクイズ、プレイ履歴、ブックマークなど）がすべて削除されます。また、有料サブスクリプションが有効な場合は即時に解約されます。この操作は取り消せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      variant="destructive"
                      data-testid="settings-delete-account-confirm"
                    >
                      {isDeleting ? '退会処理中...' : '退会する'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

