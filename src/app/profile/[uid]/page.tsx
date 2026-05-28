'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter, notFound } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { 
  getUser, 
  followUser, 
  unfollowUser, 
  isFollowing 
} from '@/services/user';
import { getQuizzesByAuthor } from '@/services/quiz';
import { getQuizListsByAuthor } from '@/services/quiz-list';
import { 
  Award, 
  Zap, 
  Star, 
  Crown, 
  Play, 
  PenTool, 
  BookOpen, 
  Users, 
  TrendingUp, 
  Sparkles, 
  User as UserIcon,
  Shield,
  Heart,
  Grid,
  List,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { User, Quiz, QuizList as QuizListType, Badge } from '@/types';
import styles from './profile.module.css';

// バッジのアイコンマッピング
const getBadgeIcon = (iconName: string) => {
  switch (iconName) {
    case 'play-circle':
      return <Play size={20} />;
    case 'zap':
      return <Zap size={20} />;
    case 'star':
      return <Star size={20} />;
    case 'award':
      return <Award size={20} />;
    case 'crown':
      return <Crown size={20} />;
    case 'pencil':
      return <PenTool size={20} />;
    case 'book-open':
    case 'library':
      return <BookOpen size={20} />;
    case 'users':
      return <Users size={20} />;
    case 'trending-up':
      return <TrendingUp size={20} />;
    case 'sparkles':
      return <Sparkles size={20} />;
    default:
      return <Award size={20} />;
  }
};

// 権限ティアーのスタイルと表示名のマッピング
const getTierDetails = (tier: string) => {
  switch (tier) {
    case 'senior_moderator':
      return { label: 'シニアモデレーター', class: styles.tierSeniorMod };
    case 'moderator':
      return { label: 'モデレーター', class: styles.tierMod };
    case 'contributor':
      return { label: 'コントリビューター', class: styles.tierContributor };
    case 'newcomer':
    default:
      return { label: 'ニューカマー', class: styles.tierNewcomer };
  }
};

export default function ProfilePage() {
  const { uid } = useParams() as { uid: string };
  const { user: currentUser } = useAuth();
  const router = useRouter();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizLists, setQuizLists] = useState<QuizListType[]>([]);
  const [followingState, setFollowingState] = useState(false);
  const [activeTab, setActiveTab] = useState<'quizzes' | 'lists'>('quizzes');
  const [loading, setLoading] = useState(true);
  const [submittingFollow, setSubmittingFollow] = useState(false);
  const [isDeletedPending, setIsDeletedPending] = useState(false);

  const isMyProfile = currentUser?.id === uid;

  useEffect(() => {
    async function loadProfileData() {
      try {
        setLoading(true);
        const userData = await getUser(uid);
        
        if (!userData) {
          setLoading(false);
          return;
        }

        // 退会処理中のアクセス制限 (本人以外はブロックし、404へ誘導)
        if (userData.deleteStatus === 'delete_pending' && !isMyProfile) {
          setIsDeletedPending(true);
          setLoading(false);
          return;
        }

        setProfileUser(userData);

        // クイズとリストの取得
        const [userQuizzes, userLists] = await Promise.all([
          getQuizzesByAuthor(uid, isMyProfile),
          getQuizListsByAuthor(uid, isMyProfile)
        ]);
        
        setQuizzes(userQuizzes);
        setQuizLists(userLists);

        // フォロー状態の確認
        if (currentUser && !isMyProfile) {
          const following = await isFollowing(currentUser.id, uid);
          setFollowingState(following);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    }

    if (uid) {
      loadProfileData();
    }
  }, [uid, currentUser, isMyProfile]);

  // 退会処理中かつ本人以外の場合は404
  if (isDeletedPending) {
    notFound();
  }

  const handleFollowToggle = async () => {
    if (!currentUser || submittingFollow || !profileUser) return;
    setSubmittingFollow(true);
    try {
      if (followingState) {
        await unfollowUser(currentUser.id, uid);
        setFollowingState(false);
        setProfileUser(prev => prev ? { ...prev, followersCount: Math.max(0, prev.followersCount - 1) } : null);
      } else {
        await followUser(currentUser.id, uid);
        setFollowingState(true);
        setProfileUser(prev => prev ? { ...prev, followersCount: prev.followersCount + 1 } : null);
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
    } finally {
      setSubmittingFollow(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className={styles.errorContainer}>
        <AlertTriangle size={48} className={styles.errorIcon} />
        <h2>ユーザーが見つかりません</h2>
        <p>指定されたユーザーは存在しないか、退会済みです。</p>
        <Link href="/" className="btn btn-primary">ホームに戻る</Link>
      </div>
    );
  }

  const tierDetails = getTierDetails(profileUser.moderationTier);

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* 退会処理中の本人向け警告表示 */}
        {profileUser.deleteStatus === 'delete_pending' && isMyProfile && (
          <div className={`${styles.deleteAlert} animate-fade-in`}>
            <AlertTriangle size={20} />
            <span>このアカウントは現在削除処理中です。一部の機能が非活性化されている可能性があります。</span>
          </div>
        )}

        {/* Profile Card */}
        <div className={`${styles.profileCard} glass-card animate-fade-in`}>
          <div className={styles.cardHeader}>
            <div className={styles.avatarWrapper}>
              <img 
                src={profileUser.avatarUrl || '/default-avatar.png'} 
                alt={profileUser.displayName} 
                className={styles.avatar} 
              />
            </div>

            <div className={styles.userInfo}>
              <div className={styles.nameSection}>
                <h1 className={styles.displayName}>{profileUser.displayName}</h1>
                <span className={`${styles.tierBadge} ${tierDetails.class}`}>
                  <Shield size={14} />
                  <span>{tierDetails.label}</span>
                </span>
              </div>

              <div className={styles.statsRow}>
                <Link href={`/profile/${uid}/connections?tab=following`} className={styles.statLink}>
                  <strong>{profileUser.followingCount}</strong> <span className={styles.statLabel}>フォロー</span>
                </Link>
                <Link href={`/profile/${uid}/connections?tab=followers`} className={styles.statLink}>
                  <strong>{profileUser.followersCount}</strong> <span className={styles.statLabel}>フォロワー</span>
                </Link>
                <div className={styles.reputationStat}>
                  <strong>{profileUser.reputationScore}</strong> <span className={styles.statLabel}>信頼スコア</span>
                </div>
              </div>

              <p className={styles.bio}>{profileUser.bio || '自己紹介はまだ登録されていません。'}</p>
              
              <div className={styles.profileActions}>
                {isMyProfile ? (
                  <>
                    <Link 
                      href="/profile/edit" 
                      className="btn btn-secondary"
                      style={{ padding: '8px 24px', fontSize: '0.9rem' }}
                    >
                      プロフィールの編集
                    </Link>
                    <Link 
                      href={`/profile/${uid}/likes`} 
                      className="btn btn-outline"
                      style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                    >
                      <Heart size={16} />
                      <span>リアクション履歴</span>
                    </Link>
                  </>
                ) : (
                  currentUser && (
                    <button
                      onClick={handleFollowToggle}
                      disabled={submittingFollow}
                      className={`btn ${followingState ? 'btn-secondary' : 'btn-accent'}`}
                      style={{ padding: '8px 32px', fontSize: '0.95rem' }}
                    >
                      {followingState ? 'フォロー解除' : 'フォローする'}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 弱点克服（復習）セクション (本人のみ表示) */}
        {isMyProfile && profileUser.totalFailedQuestionsCount > 0 && (
          <div className={`${styles.reviewSection} glass-card animate-fade-in`}>
            <div className={styles.reviewContent}>
              <div className={styles.reviewIconWrapper}>
                <Zap size={24} className={styles.reviewIcon} />
              </div>
              <div>
                <h3 className={styles.reviewTitle}>弱点克服プレイ（復習）</h3>
                <p className={styles.reviewText}>
                  過去に間違えた問題が <strong>{profileUser.totalFailedQuestionsCount}問</strong> あります。
                  復習プレイで苦手なジャンルを克服しましょう！
                </p>
              </div>
            </div>
            <Link href="/quiz/review" className="btn btn-primary">
              <span>復習をはじめる</span>
              <ChevronRight size={18} />
            </Link>
          </div>
        )}

        {/* Badges Section */}
        {profileUser.badges.length > 0 && (
          <div className={`${styles.badgesSection} glass-card animate-fade-in`}>
            <h2 className={styles.sectionTitle}>獲得した称号バッジ</h2>
            <div className={styles.badgeGrid}>
              {profileUser.badges.map((badge: Badge) => (
                <div key={badge.id} className={styles.badgeCard} title={badge.description}>
                  <div className={styles.badgeIconWrapper}>
                    {getBadgeIcon(badge.iconName)}
                  </div>
                  <div className={styles.badgeInfo}>
                    <div className={styles.badgeTitle}>{badge.title}</div>
                    <div className={styles.badgeDesc}>{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content Tabbed Area */}
        <div className={`${styles.contentSection} animate-fade-in`}>
          <div className={styles.tabsContainer}>
            <button 
              className={`${styles.tabButton} ${activeTab === 'quizzes' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('quizzes')}
            >
              <Grid size={18} />
              <span>作成したクイズ ({quizzes.length})</span>
            </button>
            <button 
              className={`${styles.tabButton} ${activeTab === 'lists' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('lists')}
            >
              <List size={18} />
              <span>作成したリスト ({quizLists.length})</span>
            </button>
          </div>

          {/* Tab Panels */}
          {activeTab === 'quizzes' ? (
            <div className={styles.gridContainer}>
              {quizzes.length === 0 ? (
                <div className={styles.emptyState}>
                  作成したクイズはまだありません。
                </div>
              ) : (
                <div className={styles.cardGrid}>
                  {quizzes.map((quiz) => (
                    <Link 
                      key={quiz.id} 
                      href={`/quiz/${quiz.id}`} 
                      className={`${styles.quizCard} glass-card glass-card-hover`}
                    >
                      {quiz.thumbnailUrl && (
                        <div className={styles.quizThumbnailWrapper}>
                          <img src={quiz.thumbnailUrl} alt={quiz.title} className={styles.quizThumbnail} />
                        </div>
                      )}
                      <div className={styles.quizCardBody}>
                        <div className={styles.quizMeta}>
                          <span className={styles.quizGenre}>{quiz.genre}</span>
                          <span className={styles.quizDifficulty}>難易度 {quiz.difficulty}/10</span>
                        </div>
                        <h3 className={styles.quizTitle}>{quiz.title}</h3>
                        <p className={styles.quizDesc}>{quiz.description}</p>
                        <div className={styles.quizTags}>
                          {quiz.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className={styles.quizTag}>#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.gridContainer}>
              {quizLists.length === 0 ? (
                <div className={styles.emptyState}>
                  作成したリストはまだありません。
                </div>
              ) : (
                <div className={styles.cardGrid}>
                  {quizLists.map((list) => (
                    <Link 
                      key={list.id} 
                      href={`/list/${list.id}`} 
                      className={`${styles.quizCard} glass-card glass-card-hover`}
                    >
                      {list.coverImageUrl && (
                        <div className={styles.quizThumbnailWrapper}>
                          <img src={list.coverImageUrl} alt={list.title} className={styles.quizThumbnail} />
                        </div>
                      )}
                      <div className={styles.quizCardBody}>
                        <h3 className={styles.quizTitle}>{list.title}</h3>
                        <p className={styles.quizDesc}>{list.description}</p>
                        <div className={styles.listMeta}>
                          <span>収録問題: {list.quizIds?.length || 0}問</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
