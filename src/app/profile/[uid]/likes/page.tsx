'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getSentReactions, getReceivedReactions, Reaction } from '@/services/reaction';
import { getUser } from '@/services/user';
import { Header } from '@/components/layout/header';
import { Heart, ArrowLeft, ExternalLink, MessageSquare } from 'lucide-react';
import { User } from '@/types';
import styles from './likes.module.css';

export default function LikesPage() {
  const { uid } = useParams() as { uid: string };
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [sentList, setSentList] = useState<Reaction[]>([]);
  const [receivedList, setReceivedList] = useState<Reaction[]>([]);
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [loading, setLoading] = useState(true);

  const isMyProfile = currentUser?.id === uid;

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
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <>
        <Header />
        <div className={styles.errorContainer}>
          <h2>ユーザーが見つかりません</h2>
          <p>お探しのユーザーのリアクション履歴は存在しません。</p>
          <Link href="/" className="btn btn-primary">ホームに戻る</Link>
        </div>
      </>
    );
  }

  const currentList = activeTab === 'sent' ? sentList : receivedList;

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Back to Profile */}
          <button 
            onClick={() => router.push(`/profile/${uid}`)} 
            className={styles.backButton}
          >
            <ArrowLeft size={16} />
            <span>{profileUser.displayName} のプロフィール</span>
          </button>

          {/* Likes Card */}
          <div className={`${styles.likesCard} glass-card animate-fade-in`}>
            <div className={styles.cardHeader}>
              <div className={styles.titleWrapper}>
                <Heart size={24} className={styles.heartIcon} />
                <h1 className={styles.title}>リアクション履歴</h1>
              </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabsContainer}>
              <button
                className={`${styles.tabButton} ${activeTab === 'sent' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('sent')}
              >
                <span>送ったリアクション ({sentList.length})</span>
              </button>
              <button
                className={`${styles.tabButton} ${activeTab === 'received' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('received')}
              >
                <span>受け取ったリアクション ({receivedList.length})</span>
              </button>
            </div>

            {/* List */}
            <div className={styles.listContainer}>
              {currentList.length === 0 ? (
                <div className={styles.emptyState}>
                  <Heart size={40} className={styles.emptyIcon} />
                  <p>
                    {activeTab === 'sent' 
                      ? '送ったリアクション（お礼）はまだありません。' 
                      : '獲得したリアクション（感謝）はまだありません。'}
                  </p>
                </div>
              ) : (
                <div className={styles.reactionList}>
                  {currentList.map((item) => (
                    <Link 
                      key={item.id} 
                      href={`/quiz/${item.quizId}`}
                      className={styles.reactionCard}
                    >
                      <div className={styles.cardContent}>
                        <div className={styles.quizInfo}>
                          <span className={styles.badge}>QUIZ</span>
                          <h3 className={styles.quizTitle}>{item.quizTitle}</h3>
                        </div>
                        <p className={styles.message}>
                          {activeTab === 'sent' 
                            ? 'このクイズをプレイし、作成者に感謝のリアクションを送信しました。' 
                            : 'プレイヤーがこのクイズをプレイし、あなたに感謝のリアクションを送ってくれました！'}
                        </p>
                        <span className={styles.timestamp}>
                          {new Date(item.createdAt).toLocaleDateString('ja-JP', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <ExternalLink size={18} className={styles.linkIcon} />
                    </Link>
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
