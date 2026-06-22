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
import { PersonAddOutlined, HowToRegOutlined, GroupOutlined } from '@mui/icons-material';
import { User } from '@/types';
import { ConnectionsSkeleton } from '@/components/profile/connections-skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function ConnectionsClient() {
  const { uid } = useParams() as { uid: string };
  const { user: currentUser, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

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
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h2 className="text-xl font-semibold">ユーザーが見つかりません</h2>
        <p className="text-muted-foreground">お探しのユーザーのつながり情報は存在しません。</p>
        <Link href="/" className={cn(buttonVariants())}>
          ホームに戻る
        </Link>
      </div>
    );
  }

  const currentList = activeTab === 'following' ? followingList : followersList;

  return (
    <Card data-testid="connections-page-container">
      <CardHeader>
        <CardTitle>つながり一覧</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'following' | 'followers')}>
          <TabsList className="mb-4">
            <TabsTrigger value="following">フォロー中 ({followingList.length})</TabsTrigger>
            <TabsTrigger value="followers">フォロワー ({followersList.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {currentList.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                <GroupOutlined sx={{ fontSize: 40 }} />
                <p>
                  {activeTab === 'following'
                    ? 'フォローしているユーザーはまだいません。'
                    : 'フォロワーはまだいません。'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {currentList.map((targetUser) => {
                  const isMe = currentUser?.id === targetUser.id;
                  const isFollowedByMe = !!myFollowingMap[targetUser.id];
                  const isBtnToggling = togglingId === targetUser.id;

                  return (
                    <div
                      key={targetUser.id}
                      className="flex items-center justify-between gap-4 rounded-lg border p-4"
                    >
                      <Link href={`/profile/${targetUser.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar className="size-12">
                          <AvatarImage src={targetUser.avatarUrl || '/default-avatar.png'} alt={targetUser.displayName} />
                          <AvatarFallback>{targetUser.displayName.slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">{targetUser.displayName}</h3>
                          <p className="truncate text-sm text-muted-foreground">
                            {targetUser.bio || '自己紹介はまだ登録されていません。'}
                          </p>
                        </div>
                      </Link>

                      {!isMe && currentUser && (
                        <Button
                          type="button"
                          variant={isFollowedByMe ? 'secondary' : 'default'}
                          size="sm"
                          onClick={() => handleFollowToggle(targetUser)}
                          disabled={isBtnToggling}
                        >
                          {isFollowedByMe ? (
                            <>
                              <HowToRegOutlined sx={{ fontSize: 16 }} />
                              フォロー中
                            </>
                          ) : (
                            <>
                              <PersonAddOutlined sx={{ fontSize: 16 }} />
                              フォロー
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
