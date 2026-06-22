'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getSentReactions, getReceivedReactions, Reaction } from '@/services/reaction';
import { getUser } from '@/services/user';
import { FavoriteOutlined, OpenInNewOutlined } from '@mui/icons-material';
import { User } from '@/types';
import { LikesSkeleton } from '@/components/profile/likes-skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export function LikesClient() {
  const { uid } = useParams() as { uid: string };
  const { loading: authLoading } = useAuth();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [sentList, setSentList] = useState<Reaction[]>([]);
  const [receivedList, setReceivedList] = useState<Reaction[]>([]);
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLikesData() {
      try {
        setLoading(true);
        const [userData, sent, received] = await Promise.all([
          getUser(uid),
          getSentReactions(uid),
          getReceivedReactions(uid)
        ]);

        if (!userData) {
          setLoading(false);
          return;
        }

        setProfileUser(userData);
        setSentList(sent);
        setReceivedList(received);
      } catch (err) {
        console.error('Failed to load reaction history:', err);
      } finally {
        setLoading(false);
      }
    }

    if (uid) {
      loadLikesData();
    }
  }, [uid]);

  if (authLoading || loading) {
    return <LikesSkeleton />;
  }

  if (!profileUser) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-xl font-semibold">ユーザーが見つかりません</h2>
        <p className="text-muted-foreground">お探しのユーザーのリアクション履歴は存在しません。</p>
        <Link href="/" className={cn(buttonVariants())}>
          ホームに戻る
        </Link>
      </div>
    );
  }

  const currentList = activeTab === 'sent' ? sentList : receivedList;

  return (
    <Card data-testid="likes-page-container">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FavoriteOutlined sx={{ fontSize: 24 }} className="text-pink-500" />
          リアクション履歴
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sent' | 'received')}>
          <TabsList className="mb-4">
            <TabsTrigger value="sent">送ったリアクション ({sentList.length})</TabsTrigger>
            <TabsTrigger value="received">受け取ったリアクション ({receivedList.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {currentList.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <FavoriteOutlined sx={{ fontSize: 40 }} />
                <p>
                  {activeTab === 'sent'
                    ? '送ったリアクション（お礼）はまだありません。'
                    : '獲得したリアクション（感謝）はまだありません。'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {currentList.map((item) => (
                  <Link
                    key={item.id}
                    href={`/quiz/${item.quizId}`}
                    className={cn(
                      'flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant="outline">QUIZ</Badge>
                        <h3 className="truncate font-semibold">{item.quizTitle}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === 'sent'
                          ? 'このクイズをプレイし、作成者に感謝のリアクションを送信しました。'
                          : 'プレイヤーがこのクイズをプレイし、あなたに感謝のリアクションを送ってくれました！'}
                      </p>
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <OpenInNewOutlined sx={{ fontSize: 18 }} className="shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
