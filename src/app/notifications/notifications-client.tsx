'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  getNotifications,
  markAsRead,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead,
  Notification
} from '@/services/notification';
import { getUnreadAnnouncementsCount } from '@/services/announcement';
import {
  PersonAddOutlined,
  CheckCircleOutlined,
  WarningAmberOutlined,
  FavoriteOutlined,
  NotificationsOutlined,
  CheckOutlined,
  LoginOutlined,
  SmsOutlined,
} from '@mui/icons-material';
import { NotificationsSkeleton } from '@/components/ui/notifications-skeleton';
import { Button } from '@/components/ui/button';
import { CardContent, Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Tabs, UnderlineTabsList, UnderlineTabsTrigger, TabsContent } from '@/components/ui/underline-tabs';
import { AnnouncementsTab } from './announcements-tab';

// ページング用カーソル（Supabase では created_at のISO文字列を使用する）
type NotificationsCursor = string | null;

export function NotificationsClient() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<NotificationsCursor>(null);
  const [hasMore, setHasMore] = useState(false);

  // 未読カウント状態
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [unreadAnnCount, setUnreadAnnCount] = useState(0);
  const [lastReadAnnAt, setLastReadAnnAt] = useState<Date | null>(null);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);

  // 初期ロード：通知とお知らせ未読数
  useEffect(() => {
    if (authLoading) return;

    // お知らせ未読数の初期化
    const storedLastRead = localStorage.getItem('quizetika_announcements_last_read_at');
    let parsedLastRead: Date | null = null;
    if (storedLastRead) {
      parsedLastRead = new Date(storedLastRead);
      setLastReadAnnAt(parsedLastRead);
    } else {
      // 初回アクセス時は過去の時刻（Unixエポック）を設定し、既存のお知らせを未読とする
      const epoch = new Date(0);
      localStorage.setItem('quizetika_announcements_last_read_at', epoch.toISOString());
      parsedLastRead = epoch;
      setLastReadAnnAt(epoch);
    }

    // 既読お知らせIDリストの初期化
    const storedReadIds = localStorage.getItem('quizetika_read_announcement_ids');
    let parsedReadIds: string[] = [];
    if (storedReadIds) {
      try {
        parsedReadIds = JSON.parse(storedReadIds);
      } catch (e) {
        console.error('[NotificationsClient] Failed to parse read announcement IDs:', e);
      }
    }
    setReadAnnouncementIds(parsedReadIds);

    async function loadInitialData() {
      try {
        setLoading(true);

        // 1. お知らせ未読数の取得
        const annCount = await getUnreadAnnouncementsCount(parsedLastRead, parsedReadIds);
        setUnreadAnnCount(annCount);

        // 2. ログインユーザー宛て通知の取得
        if (currentUser) {
          const notifRes = await getNotifications(currentUser.id, 10, null);
          setNotifications(notifRes.items);
          setLastVisible(notifRes.lastVisible);
          setHasMore(notifRes.items.length === 10);

          const notifUnread = await getUnreadNotificationsCount(currentUser.id);
          setUnreadNotifCount(notifUnread);
        }
      } catch (err) {
        console.error('[NotificationsClient] Failed to load initial data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [currentUser, authLoading]);

  const loadMoreNotifications = async () => {
    if (loadingMore || !lastVisible || !currentUser) return;
    try {
      setLoadingMore(true);
      const res = await getNotifications(currentUser.id, 10, lastVisible);
      setNotifications(prev => [...prev, ...res.items]);
      setLastVisible(res.lastVisible);
      setHasMore(res.items.length === 10);
    } catch (err) {
      console.error('[NotificationsClient] Failed to load more notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.isRead) {
        await markAsRead(notif.id);
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n)
        );
        setUnreadNotifCount(prev => Math.max(0, prev - 1));
      }

      if (notif.type === 'follow' && notif.senderId) {
        router.push(`/profile/${notif.senderId}`);
      } else if (notif.type === 'correction_resolved' && notif.targetId) {
        router.push(`/quiz/${notif.targetId}`);
      } else if (notif.type === 'bookmark' && notif.targetId) {
        router.push(`/quiz/${notif.targetId}`);
      } else if (notif.type === 'quiz_review_warning' && notif.targetId) {
        router.push(`/quiz/${notif.targetId}`);
      } else if (notif.type === 'correction_reported') {
        router.push('/creator/dashboard');
      }
    } catch (err) {
      console.error('[NotificationsClient] Failed to process notification click:', err);
    }
  };

  const handleAllNotifRead = async () => {
    if (!currentUser) return;
    try {
      await markAllNotificationsAsRead(currentUser.id);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
    } catch (err) {
      console.error('[NotificationsClient] Failed to mark all notifications as read:', err);
    }
  };

  const handleAllAnnRead = () => {
    const now = new Date();
    localStorage.setItem('quizetika_announcements_last_read_at', now.toISOString());
    localStorage.setItem('quizetika_read_announcement_ids', JSON.stringify([]));
    setLastReadAnnAt(now);
    setReadAnnouncementIds([]);
    setUnreadAnnCount(0);
  };

  const handleAnnRead = (id: string) => {
    if (readAnnouncementIds.includes(id)) return;
    const updatedIds = [...readAnnouncementIds, id];
    localStorage.setItem('quizetika_read_announcement_ids', JSON.stringify(updatedIds));
    setReadAnnouncementIds(updatedIds);
    setUnreadAnnCount(prev => Math.max(0, prev - 1));
  };

  if (authLoading || loading) {
    return <NotificationsSkeleton data-testid="notifications-skeleton" />;
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'follow':
        return <PersonAddOutlined sx={{ fontSize: 20 }} className="text-blue-500" />;
      case 'correction_resolved':
        return <CheckCircleOutlined sx={{ fontSize: 20 }} className="text-green-500" />;
      case 'bookmark':
        return <FavoriteOutlined sx={{ fontSize: 20 }} className="text-pink-500" />;
      case 'badge_unlocked':
        return <NotificationsOutlined sx={{ fontSize: 20 }} className="text-green-500" />;
      case 'correction_reported':
        return <SmsOutlined sx={{ fontSize: 20 }} className="text-amber-500" />;
      case 'quiz_review_warning':
      default:
        return <WarningAmberOutlined sx={{ fontSize: 20 }} className="text-amber-500" />;
    }
  };

  const getNotificationMessage = (notif: Notification) => {
    switch (notif.type) {
      case 'follow':
        return `${notif.senderName}さんがあなたをフォローしました。`;
      case 'bookmark':
        return `${notif.senderName}さんがあなたのクイズ『${notif.targetTitle || 'クイズ'}』をブックマークしました。`;
      case 'correction_resolved':
        return `${notif.senderName}さんがクイズ『${notif.targetTitle || 'クイズ'}』の指摘を修正しました。`;
      case 'correction_reported':
        return `${notif.senderName}さんがクイズ『${notif.targetTitle || 'クイズ'}』に間違い指摘を送信しました。`;
      case 'badge_unlocked':
        return `新しいバッジ「${notif.targetTitle || 'バッジ'}」を獲得しました！`;
      case 'quiz_review_warning':
        return `クイズ『${notif.targetTitle || 'クイズ'}』の評価が低下しています。内容の改善を検討してください。`;
      default:
        return '新しい通知があります。';
    }
  };

  return (
    <CardContent data-testid="notifications-page-container" className="pt-2">
      <Tabs defaultValue="personal">
        <UnderlineTabsList className="mb-6">
          <UnderlineTabsTrigger value="personal" data-testid="personal-tab-trigger">
            通知
            {currentUser && unreadNotifCount > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground font-bold shrink-0">
                {unreadNotifCount}
              </span>
            )}
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger value="announcements" data-testid="announcements-tab-trigger">
            運営からのお知らせ
            {unreadAnnCount > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground font-bold shrink-0">
                {unreadAnnCount}
              </span>
            )}
          </UnderlineTabsTrigger>
        </UnderlineTabsList>

        <TabsContent value="personal">
          {!currentUser ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <NotificationsOutlined sx={{ fontSize: 48 }} className="text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-bold mb-2">通知機能を利用するにはログインが必要です</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  ログインすると、あなたのクイズへのブックマーク、フォロー、間違い指摘の解決などの通知を受け取ることができます。
                </p>
                <Button
                  onClick={() => router.push('/login?redirect=/notifications')}
                  data-testid="login-redirect-btn"
                >
                  <LoginOutlined sx={{ fontSize: 16 }} className="mr-2 size-4" />
                  ログイン画面へ
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {unreadNotifCount > 0 && (
                <div className="mb-4 flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={handleAllNotifRead} data-testid="notifications-mark-all-read-btn">
                    <CheckOutlined sx={{ fontSize: 16 }} className="mr-1" />
                    <span>すべて既読にする</span>
                  </Button>
                </div>
              )}

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
                  <NotificationsOutlined sx={{ fontSize: 40 }} />
                  <p>届いている通知はありません。</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        'relative flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50',
                        !notif.isRead && 'border-primary/30 bg-primary/5'
                      )}
                    >
                      <div className="shrink-0">
                        {notif.senderAvatar ? (
                          <img
                            src={notif.senderAvatar}
                            alt={notif.senderName || 'Sender'}
                            className="size-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                            {getNotificationIcon(notif.type)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">{getNotificationMessage(notif)}</p>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {new Date(notif.createdAt).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {!notif.isRead && (
                        <span className="absolute top-4 right-4 size-2 rounded-full bg-primary" />
                      )}
                    </div>
                  ))}

                  {hasMore && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="outline"
                        onClick={loadMoreNotifications}
                        disabled={loadingMore}
                        data-testid="load-more-notifications-btn"
                      >
                        {loadingMore ? '読み込み中...' : 'もっと見る'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="announcements">
          <AnnouncementsTab
            lastReadAt={lastReadAnnAt}
            onMarkAllRead={handleAllAnnRead}
            unreadCount={unreadAnnCount}
            readAnnouncementIds={readAnnouncementIds}
            onMarkAsRead={handleAnnRead}
          />
        </TabsContent>
      </Tabs>
    </CardContent>
  );
}
