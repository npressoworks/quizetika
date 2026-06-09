'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { 
  getUser, 
  getFollowingUsers, 
  getFollowerUsers, 
  followUser, 
  unfollowUser, 
  isFollowing 
} from '@/services/user';
import { UserPlus, UserCheck, Users } from 'lucide-react';
import { User } from '@/types';
import { ConnectionsSkeleton } from '@/components/profile/connections-skeleton';
import styles from './connections.module.css';

export function ConnectionsClient() {
  const { uid } = useParams() as { uid: string };
  const { user: currentUser, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  // 初期タブの設定 (クエリパラメータから取得, デフォルトは 'following')
  const initialTab = searchParams.get('tab') === 'followers' ? 'followers' : 'following';

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [followingList, setFollowingList] = useState<User[]>([]);
  const [followersList, setFollowersList] = useState<User[]>([]);
  const [myFollowingMap, setMyFollowingMap] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    async function loadConnections() {
      try {
        setLoading(true);
        const [userData, following, followers] = await Promise.all([
          getUser(uid),
          getFollowingUsers(uid),
          getFollowerUsers(uid)
        ]);

        if (!userData) {
          setLoading(false);
          return;
        }

        setProfileUser(userData);
        setFollowingList(following);
        setFollowersList(followers);

        // ログインユーザー自身が、このリストの中のどのユーザーをフォローしているか判定
        if (currentUser) {
          const allUserIds = Array.from(new Set([
            ...following.map(u => u.id),
            ...followers.map(u => u.id)
          ]));

          const map: Record<string, boolean> = {};
          await Promise.all(
            allUserIds.map(async (userId) => {
              if (userId === currentUser.id) return;
              const isFollow = await isFollowing(currentUser.id, userId);
              map[userId] = isFollow;
            })
          );
          setMyFollowingMap(map);
        }
      } catch (err) {
        console.error('Failed to load connections:', err);
      } finally {
        setLoading(false);
      }
    }

    if (uid) {
      loadConnections();
    }
  }, [uid, currentUser]);

  const handleFollowToggle = async (targetUser: User) => {
    if (!currentUser || togglingId) return;
    setTogglingId(targetUser.id);
    try {
      const isCurrentlyFollowing = !!myFollowingMap[targetUser.id];
      if (isCurrentlyFollowing) {
        await unfollowUser(currentUser.id, targetUser.id);
      } else {
        await followUser(currentUser.id, targetUser.id);
      }

      const [following, followers] = await Promise.all([
        getFollowingUsers(uid),
        getFollowerUsers(uid),
      ]);
      setFollowingList(following);
      setFollowersList(followers);
      setProfileUser((prev) =>
        prev
          ? {
              ...prev,
              followingCount: following.length,
              followersCount: followers.length,
            }
          : null
      );
      setMyFollowingMap((prev) => ({
        ...prev,
        [targetUser.id]: !isCurrentlyFollowing,
      }));
    } catch (err) {
      console.error('Failed to toggle follow status in list:', err);
    } finally {
      setTogglingId(null);
    }
  };

  if (authLoading || loading) {
    return <ConnectionsSkeleton data-testid="connections-skeleton" />;
  }

  if (!profileUser) {
    return (
      <div className={styles.errorContainer}>
        <h2>ユーザーが見つかりません</h2>
        <p>お探しのユーザーのつながり情報は存在しません。</p>
        <Link href="/" className="btn btn-primary">ホームに戻る</Link>
      </div>
    );
  }

  const currentList = activeTab === 'following' ? followingList : followersList;

  return (
    <div className={`${styles.connectionsCard} glass-card animate-fade-in`} data-testid="connections-page-container">
          <div className={styles.cardHeader}>
            <h1 className={styles.title}>つながり一覧</h1>
          </div>

          {/* Tabs */}
          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tabButton} ${activeTab === 'following' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('following')}
            >
              <span>フォロー中 ({followingList.length})</span>
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'followers' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('followers')}
            >
              <span>フォロワー ({followersList.length})</span>
            </button>
          </div>

          {/* User List */}
          <div className={styles.listContainer}>
            {currentList.length === 0 ? (
              <div className={styles.emptyState}>
                <Users size={40} className={styles.emptyIcon} />
                <p>
                  {activeTab === 'following' 
                    ? 'フォローしているユーザーはまだいません。' 
                    : 'フォロワーはまだいません。'}
                </p>
              </div>
            ) : (
              <div className={styles.userList}>
                {currentList.map((targetUser) => {
                  const isMe = currentUser?.id === targetUser.id;
                  const isFollowedByMe = !!myFollowingMap[targetUser.id];
                  const isBtnToggling = togglingId === targetUser.id;

                  return (
                    <div key={targetUser.id} className={styles.userCard}>
                      <Link href={`/profile/${targetUser.id}`} className={styles.userInfoLink}>
                        <img 
                          src={targetUser.avatarUrl || '/default-avatar.png'} 
                          alt={targetUser.displayName} 
                          className={styles.avatar} 
                        />
                        <div className={styles.userInfo}>
                          <h3 className={styles.displayName}>{targetUser.displayName}</h3>
                          <p className={styles.bio}>{targetUser.bio || '自己紹介はまだ登録されていません。'}</p>
                        </div>
                      </Link>

                      {/* フォロートグルボタン (自分以外のユーザーカードにのみ表示) */}
                      {!isMe && currentUser && (
                        <button
                          onClick={() => handleFollowToggle(targetUser)}
                          disabled={isBtnToggling}
                          className={`btn ${isFollowedByMe ? 'btn-secondary' : 'btn-accent'} ${styles.followBtn}`}
                        >
                          {isFollowedByMe ? (
                            <>
                              <UserCheck size={16} />
                              <span className={styles.btnText}>フォロー中</span>
                            </>
                          ) : (
                            <>
                              <UserPlus size={16} />
                              <span className={styles.btnText}>フォロー</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
    </div>
  );
}
