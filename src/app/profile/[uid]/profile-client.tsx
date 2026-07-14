'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import {
  getUser,
  followUser,
  unfollowUser,
  isFollowing
} from '@/services/user';
import { ProfileQuizzesPanel } from '@/components/profile/profile-quizzes-panel';
import { QuizCard } from '@/components/quiz/quiz-card';
import { toggleBookmark, getBookmarkedQuizIds } from '@/services/bookmark';
import { getSnsLogoUrl } from '@/services/storage';
import {
  EmojiEventsOutlined,
  FlashOnOutlined,
  StarBorderOutlined,
  WorkspacePremiumOutlined,
  PlayArrowOutlined,
  CreateOutlined,
  MenuBookOutlined,
  GroupOutlined,
  TrendingUpOutlined,
  AutoAwesomeOutlined,
  SecurityOutlined,
  GridViewOutlined,
  HistoryOutlined,
  ChevronRightOutlined,
  WarningAmberOutlined
} from '@mui/icons-material';
import { User, Quiz, Badge } from '@/types';
import { resolveModerationTierDisplay, type ModerationTierDisplayKey } from '@/lib/moderation-tier-display';
import { ProfilePlayHistoryPanel } from '@/components/profile/profile-play-history-panel';
import { ProfileDetailSkeleton } from '@/components/profile/profile-skeleton';
import { ReportUserDialog } from '@/components/profile/report-user-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge as UiBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ProfileContentTab = 'quizzes' | 'history';

const getBadgeIcon = (iconName: string) => {
  switch (iconName) {
    case 'play-circle':
      return <PlayArrowOutlined sx={{ fontSize: 20 }} />;
    case 'zap':
      return <FlashOnOutlined sx={{ fontSize: 20 }} />;
    case 'star':
      return <StarBorderOutlined sx={{ fontSize: 20 }} />;
    case 'award':
      return <EmojiEventsOutlined sx={{ fontSize: 20 }} />;
    case 'crown':
      return <WorkspacePremiumOutlined sx={{ fontSize: 20 }} />;
    case 'pencil':
      return <CreateOutlined sx={{ fontSize: 20 }} />;
    case 'book-open':
    case 'library':
      return <MenuBookOutlined sx={{ fontSize: 20 }} />;
    case 'users':
      return <GroupOutlined sx={{ fontSize: 20 }} />;
    case 'trending-up':
      return <TrendingUpOutlined sx={{ fontSize: 20 }} />;
    case 'sparkles':
      return <AutoAwesomeOutlined sx={{ fontSize: 20 }} />;
    default:
      return <EmojiEventsOutlined sx={{ fontSize: 20 }} />;
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
  const router = useRouter();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [quizzesCount, setQuizzesCount] = useState(0);
  const [followingState, setFollowingState] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileContentTab>('quizzes');
  const [loading, setLoading] = useState(true);
  const [submittingFollow, setSubmittingFollow] = useState(false);
  const [isDeletedPending, setIsDeletedPending] = useState(false);
  const [snsLogoUrls, setSnsLogoUrls] = useState<Record<string, string>>({});
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const { genres, loading: genresLoading } = useActiveGenres();
  const favoriteGenres = genres.filter(g => profileUser?.followedGenres?.includes(g.id));

  useEffect(() => {
    async function loadBookmarks() {
      if (currentUser) {
        try {
          const ids = await getBookmarkedQuizIds(currentUser.id);
          setBookmarkedIds(new Set(ids));
        } catch (e) {
          console.error('[ProfileClient] ブックマーク取得エラー:', e);
        }
      } else {
        setBookmarkedIds(new Set());
      }
    }
    loadBookmarks();
  }, [currentUser]);

  const handleBookmarkToggle = async (quizId: string) => {
    if (!currentUser) {
      router.push(`/login?redirect=%2Fprofile%2F${uid}`);
      return;
    }
    try {
      const isAdded = await toggleBookmark(currentUser.id, quizId, 'quiz');
      const nextBookmarks = new Set(bookmarkedIds);
      if (isAdded) {
        nextBookmarks.add(quizId);
      } else {
        nextBookmarks.delete(quizId);
      }
      setBookmarkedIds(nextBookmarks);
    } catch (e) {
      console.error('[ProfileClient] ブックマークトグル失敗:', e);
    }
  };

  const handleCardClick = (quizId: string) => {
    router.push(`/quiz/${quizId}`);
  };
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

  useEffect(() => {
    async function resolveSnsLogos() {
      if (!profileUser?.snsLinks) return;
      const urls: Record<string, string> = {};
      const activeSns = Object.keys(profileUser.snsLinks).filter(
        key => profileUser.snsLinks?.[key as keyof typeof profileUser.snsLinks]
      );
      
      await Promise.all(
        activeSns.map(async (sns) => {
          try {
            const url = await getSnsLogoUrl(sns);
            urls[sns] = url;
          } catch (e) {
            console.error(`Failed to get logo for ${sns}:`, e);
          }
        })
      );
      setSnsLogoUrls(urls);
    }
    
    resolveSnsLogos();
  }, [profileUser]);

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
        <WarningAmberOutlined sx={{ fontSize: 48 }} className="text-muted-foreground" />
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
            <WarningAmberOutlined className="size-4" />
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
                  <SecurityOutlined sx={{ fontSize: 14 }} />
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

              {/* 好きなジャンル表示 (Phase 28) */}
              <div data-testid="profile-favorite-genres">
                {favoriteGenres.length > 0 ? (
                  <div className="flex flex-col gap-2 mt-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">好きなジャンル</h3>
                    <div className="flex flex-wrap gap-2">
                      {favoriteGenres.map(genre => (
                        <div
                          key={genre.id}
                          className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
                        >
                          {genre.iconImageUrl && (
                            <img src={genre.iconImageUrl} alt="" className="size-4 object-contain" />
                          )}
                          <span>{genre.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  isMyProfile && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      好きなジャンルが設定されていません。
                      <Link href="/profile/edit" className="text-primary hover:underline ml-1">
                        登録する
                      </Link>
                    </div>
                  )
                )}
              </div>

              {profileUser.snsLinks && Object.values(profileUser.snsLinks).some(Boolean) && (
                <div className="flex flex-wrap gap-3 items-center mt-3" data-testid="sns-links-container">
                  {Object.entries(profileUser.snsLinks).map(([sns, url]) => {
                    if (!url) return null;
                    const logoUrl = snsLogoUrls[sns];
                    return (
                      <a
                        key={sns}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shadow-sm"
                        title={`${sns} を開く`}
                        data-testid={`sns-link-${sns}`}
                      >
                        <div className="flex size-5 items-center justify-center shrink-0">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={sns}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-[10px] font-bold uppercase">{sns.slice(0, 2)}</span>
                          )}
                        </div>
                        <span className="capitalize font-medium">{sns}</span>
                      </a>
                    );
                  })}
                </div>
              )}

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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={followingState ? 'secondary' : 'default'}
                        onClick={handleFollowToggle}
                        disabled={submittingFollow}
                        data-analytics="profile-follow-toggle"
                      >
                        {followingState ? 'フォロー解除' : 'フォローする'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setIsReportDialogOpen(true)}
                        data-testid="profile-report-user-btn"
                        data-analytics="profile-report-user-open"
                      >
                        <WarningAmberOutlined sx={{ fontSize: 16 }} className="mr-1" />
                        ユーザーを通報
                      </Button>
                    </div>
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
                  <FlashOnOutlined sx={{ fontSize: 24 }} />
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
                <ChevronRightOutlined sx={{ fontSize: 18 }} />
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
              <TabsTrigger
                value="quizzes"
                className="min-h-9 gap-2 px-3 font-medium data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold data-active:shadow-sm"
              >
                <GridViewOutlined sx={{ fontSize: 18 }} />
                作成したクイズ ({quizzesCount})
              </TabsTrigger>
              {isMyProfile && (
                <TabsTrigger
                  value="history"
                  className="min-h-9 gap-2 px-3 font-medium data-active:bg-primary data-active:text-primary-foreground data-active:font-semibold data-active:shadow-sm"
                  data-testid="profile-tab-history"
                >
                  <HistoryOutlined sx={{ fontSize: 18 }} />
                  プレイ履歴
                </TabsTrigger>
              )}
            </TabsList>

            {isMyProfile && (
              <TabsContent value="history" data-testid="profile-tab-content-history">
                <ProfilePlayHistoryPanel isActive={activeTab === 'history'} />
              </TabsContent>
            )}

            <TabsContent value="quizzes">
              <ProfileQuizzesPanel
                authorId={uid}
                isMyProfile={isMyProfile}
                bookmarkedIds={bookmarkedIds}
                onBookmarkToggle={handleBookmarkToggle}
                onPlayClick={handleCardClick}
                onQuizzesCountChange={setQuizzesCount}
              />
            </TabsContent>

          </Tabs>
        </div>
      </div>

      {currentUser && !isMyProfile && (
        <ReportUserDialog
          isOpen={isReportDialogOpen}
          onClose={() => setIsReportDialogOpen(false)}
          targetUid={uid}
          targetDisplayName={profileUser.displayName}
          reporterId={currentUser.id}
        />
      )}
    </main>
  );
}
