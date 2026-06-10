'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  getUser,
  followUser,
  unfollowUser,
  isFollowing
} from '@/services/user';
import { getQuizzesByAuthor } from '@/services/quiz';
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
  Shield,
  Grid,
  History,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { User, Quiz, Badge } from '@/types';
import { resolveModerationTierDisplay, type ModerationTierDisplayKey } from '@/lib/moderation-tier-display';
import { ProfilePlayHistoryPanel } from '@/components/profile/profile-play-history-panel';
import { ProfileDetailSkeleton } from '@/components/profile/profile-skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge as UiBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

type ProfileContentTab = 'quizzes' | 'history';

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

const TIER_BADGE_CLASS: Record<ModerationTierDisplayKey, string> = {
  admin: 'bg-red-500/10 text-red-600 border-red-500/20',
  senior_moderator: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  moderator: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  contributor: 'bg-green-500/10 text-green-600 border-green-500/20',
  newcomer: 'bg-muted text-muted-foreground',
};

export function ProfileClient() {
  const { uid } = useParams() as { uid: string };
  const { user: currentUser } = useAuth();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [followingState, setFollowingState] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileContentTab>('quizzes');
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

        if (userData.deleteStatus === 'delete_pending' && !isMyProfile) {
          setIsDeletedPending(true);
          setLoading(false);
          return;
        }

        setProfileUser(userData);

        const quizzesResult = await getQuizzesByAuthor(uid, isMyProfile);
        setQuizzes(quizzesResult);

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
    return <ProfileDetailSkeleton data-testid="profile-skeleton" />;
  }

  if (!profileUser) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
        <AlertTriangle size={48} className="text-muted-foreground" />
        <h2 className="text-xl font-semibold">ユーザーが見つかりません</h2>
        <p className="text-muted-foreground">指定されたユーザーは存在しないか、退会済みです。</p>
        <Link href="/" className={cn(buttonVariants())}>
          ホームに戻る
        </Link>
      </div>
    );
  }

  const tierDisplay = resolveModerationTierDisplay(profileUser);
  const tierBadgeClass = TIER_BADGE_CLASS[tierDisplay.key];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6" data-testid="profile-page-container">
      <div className="flex flex-col gap-6">
        {profileUser.deleteStatus === 'delete_pending' && isMyProfile && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              このアカウントは現在削除処理中です。一部の機能が非活性化されている可能性があります。
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row">
            <Avatar className="size-24 shrink-0">
              <AvatarImage src={profileUser.avatarUrl || '/default-avatar.png'} alt={profileUser.displayName} />
              <AvatarFallback>{profileUser.displayName.slice(0, 1)}</AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{profileUser.displayName}</h1>
                <UiBadge variant="outline" className={cn('gap-1', tierBadgeClass)}>
                  <Shield size={14} />
                  {tierDisplay.label}
                </UiBadge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <Link href={`/profile/${uid}/connections?tab=following`} className="hover:text-primary">
                  <strong>{profileUser.followingCount}</strong>{' '}
                  <span className="text-muted-foreground">フォロー</span>
                </Link>
                <Link href={`/profile/${uid}/connections?tab=followers`} className="hover:text-primary">
                  <strong>{profileUser.followersCount}</strong>{' '}
                  <span className="text-muted-foreground">フォロワー</span>
                </Link>
                <div>
                  <strong>{profileUser.reputationScore}</strong>{' '}
                  <span className="text-muted-foreground">信頼スコア</span>
                </div>
              </div>

              <p className="text-muted-foreground">
                {profileUser.bio || '自己紹介はまだ登録されていません。'}
              </p>

              <div>
                {isMyProfile ? (
                  <Link
                    href="/profile/edit"
                    className={cn(buttonVariants({ variant: 'secondary' }))}
                  >
                    プロフィールの編集
                  </Link>
                ) : (
                  currentUser && (
                    <Button
                      variant={followingState ? 'secondary' : 'default'}
                      onClick={handleFollowToggle}
                      disabled={submittingFollow}
                      data-analytics="profile-follow-toggle"
                    >
                      {followingState ? 'フォロー解除' : 'フォローする'}
                    </Button>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {isMyProfile && profileUser.totalFailedQuestionsCount > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Zap size={24} />
                </div>
                <div>
                  <h3 className="font-semibold">弱点克服プレイ（復習）</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    過去に間違えた問題が <strong>{profileUser.totalFailedQuestionsCount}問</strong> あります。
                    復習プレイで苦手なジャンルを克服しましょう！
                  </p>
                </div>
              </div>
              <Link
                href="/quiz/review"
                data-analytics="review-start-from-profile"
                className={cn(buttonVariants())}
              >
                復習をはじめる
                <ChevronRight size={18} />
              </Link>
            </CardContent>
          </Card>
        )}

        {profileUser.badges.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">獲得した称号バッジ</h2>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {profileUser.badges.map((badge: Badge) => (
                  <div
                    key={badge.id}
                    className="flex items-start gap-3 rounded-lg border p-4"
                    title={badge.description}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {getBadgeIcon(badge.iconName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">{badge.title}</div>
                      <div className="text-sm text-muted-foreground">{badge.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ProfileContentTab)}
          >
            <TabsList className="mb-6">
              <TabsTrigger value="quizzes" className="gap-2">
                <Grid size={18} />
                作成したクイズ ({quizzes.length})
              </TabsTrigger>
              {isMyProfile && (
                <TabsTrigger value="history" className="gap-2" data-testid="profile-tab-history">
                  <History size={18} />
                  プレイ履歴
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="history">
              <ProfilePlayHistoryPanel isActive={activeTab === 'history'} />
            </TabsContent>

            <TabsContent value="quizzes">
              {quizzes.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  作成したクイズはまだありません。
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {quizzes.map((quiz) => (
                    <Link key={quiz.id} href={`/quiz/${quiz.id}`}>
                      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                        {quiz.thumbnailUrl && (
                          <div className="aspect-video overflow-hidden bg-muted">
                            <img src={quiz.thumbnailUrl} alt={quiz.title} className="h-full w-full object-cover" />
                          </div>
                        )}
                        <CardContent className="flex flex-col gap-2 p-4">
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>{quiz.genre}</span>
                            <span>難易度 {quiz.difficulty}/10</span>
                          </div>
                          <h3 className="line-clamp-2 font-semibold">{quiz.title}</h3>
                          <p className="line-clamp-2 text-sm text-muted-foreground">{quiz.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {quiz.tags.slice(0, 3).map((tag, idx) => (
                              <UiBadge key={idx} variant="secondary" className="text-xs">
                                #{tag}
                              </UiBadge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </main>
  );
}
