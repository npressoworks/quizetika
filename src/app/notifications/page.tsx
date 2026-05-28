'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getNotifications, markNotificationAsRead, Notification } from '@/services/notification';
import { Header } from '@/components/layout/header';
import { 
  UserPlus, 
  CheckCircle, 
  AlertTriangle, 
  Heart,
  Bell, 
  ArrowLeft, 
  Check 
} from 'lucide-react';
import styles from './notifications.module.css';

export default function NotificationsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.push('/login');
      return;
    }

    const currentUserId = currentUser.id;

    async function loadNotifications() {
      try {
        const list = await getNotifications(currentUserId);
        setNotifications(list);
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [currentUser, authLoading, router]);

  const handleNotificationClick = async (notif: Notification) => {
    try {
      // 既読に更新
      if (!notif.isRead) {
        await markNotificationAsRead(notif.id);
        setNotifications(prev => 
          prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n)
        );
      }

      // タイプ別遷移
      if (notif.type === 'follow' && notif.senderId) {
        router.push(`/profile/${notif.senderId}`);
      } else if (notif.type === 'issue_resolved' && notif.quizId) {
        router.push(`/quiz/${notif.quizId}`);
      }
    } catch (err) {
      console.error('Failed to process notification click:', err);
    }
  };

  const handleAllRead = async () => {
    try {
      const unreadList = notifications.filter(n => !n.isRead);
      await Promise.all(unreadList.map(n => markNotificationAsRead(n.id)));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return <UserPlus size={20} className={styles.iconFollow} />;
      case 'issue_resolved':
        return <CheckCircle size={20} className={styles.iconSuccess} />;
      case 'bookmark':
        return <Heart size={20} className={styles.iconHeart} />;
      case 'content_deleted':
      default:
        return <AlertTriangle size={20} className={styles.iconWarning} />;
    }
  };

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Back link */}
          <button 
            onClick={() => router.push(`/profile/${currentUser?.id}`)} 
            className={styles.backButton}
          >
            <ArrowLeft size={16} />
            <span>プロフィールに戻る</span>
          </button>

          {/* Notifications Card */}
          <div className={`${styles.notificationsCard} glass-card animate-fade-in`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWrapper}>
                <Bell size={24} className={styles.bellIcon} />
                <h1 className={styles.title}>通知一覧</h1>
              </div>
              
              {hasUnread && (
                <button onClick={handleAllRead} className={styles.allReadBtn}>
                  <Check size={16} />
                  <span>すべて既読にする</span>
                </button>
              )}
            </div>

            {/* List */}
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
                        <p className={styles.message}>{notif.message}</p>
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
        </div>
      </main>
    </>
  );
}
