'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getNotifications, markAsRead, Notification } from '@/services/notification';
import {
  UserPlus,
  CheckCircle,
  AlertTriangle,
  Heart,
  Bell,
  Check,
} from 'lucide-react';
import { NotificationsSkeleton } from '@/components/ui/notifications-skeleton';
import styles from './notifications.module.css';

export function NotificationsClient() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push('/login?redirect=/notifications');
      return;
    }

    const currentUserId = currentUser.id;

    async function loadNotifications() {
      try {
        const list = await getNotifications(currentUserId);
        setNotifications(list);
      } catch (err) {
        console.error('[NotificationsClient] Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [currentUser, authLoading, router]);

  const handleNotificationClick = async (notif: Notification) => {
    try {
      if (!notif.isRead) {
        await markAsRead(notif.id);
        setNotifications(prev => 
          prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n)
        );
      }

      if (notif.type === 'follow' && notif.senderId) {
        router.push(`/profile/${notif.senderId}`);
      } else if (notif.type === 'correction_resolved' && notif.targetId) {
        router.push(`/quiz/${notif.targetId}`);
      } else if (notif.type === 'bookmark' && notif.targetId) {
        router.push(`/quiz/${notif.targetId}`);
      } else if (notif.type === 'quiz_review_warning' && notif.targetId) {
        router.push(`/quiz/${notif.targetId}`);
      }
    } catch (err) {
      console.error('[NotificationsClient] Failed to process notification click:', err);
    }
  };

  const handleAllRead = async () => {
    try {
      const unreadList = notifications.filter(n => !n.isRead);
      await Promise.all(unreadList.map(n => markAsRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('[NotificationsClient] Failed to mark all as read:', err);
    }
  };

  if (authLoading || loading) {
    return <NotificationsSkeleton data-testid="notifications-skeleton" />;
  }

  if (!currentUser) {
    return null;
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'follow':
        return <UserPlus size={20} className={styles.iconFollow} />;
      case 'correction_resolved':
        return <CheckCircle size={20} className={styles.iconSuccess} />;
      case 'bookmark':
        return <Heart size={20} className={styles.iconHeart} />;
      case 'badge_unlocked':
        return <Bell size={20} className={styles.iconSuccess} />;
      case 'quiz_review_warning':
      default:
        return <AlertTriangle size={20} className={styles.iconWarning} />;
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
      case 'badge_unlocked':
        return `新しいバッジ「${notif.targetTitle || 'バッジ'}」を獲得しました！`;
      case 'quiz_review_warning':
        return `クイズ『${notif.targetTitle || 'クイズ'}』の評価が低下しています。内容の改善を検討してください。`;
      default:
        return '新しい通知があります。';
    }
  };

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <div data-testid="notifications-page-container">
      {hasUnread && (
        <div className={styles.cardHeader} style={{ paddingTop: 0, borderBottom: 'none' }}>
          <span />
          <button onClick={handleAllRead} className={styles.allReadBtn}>
            <Check size={16} />
            <span>すべて既読にする</span>
          </button>
        </div>
      )}

      <div className={styles.listContainer}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                <Bell size={40} className={styles.emptyIcon} />
                <p>届いている通知はありません。</p>
              </div>
            ) : (
              <div className={styles.notificationList}>
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    onClick={() => handleNotificationClick(notif)}
                    className={`${styles.notificationCard} ${!notif.isRead ? styles.unreadCard : ''}`}
                  >
                    <div className={styles.iconWrapper}>
                      {notif.senderAvatar ? (
                        <img 
                          src={notif.senderAvatar} 
                          alt={notif.senderName || 'Sender'} 
                          className={styles.senderAvatar}
                        />
                      ) : (
                        <div className={styles.fallbackIcon}>
                          {getNotificationIcon(notif.type)}
                        </div>
                      )}
                    </div>

                    <div className={styles.contentWrapper}>
                      <p className={styles.message}>{getNotificationMessage(notif)}</p>
                      <span className={styles.timestamp}>
                        {new Date(notif.createdAt).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    {!notif.isRead && <div className={styles.unreadDot} />}
                  </div>
                ))}
              </div>
            )}
      </div>
    </div>
  );
}
