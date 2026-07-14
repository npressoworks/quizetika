'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { filterGenreSuggestions } from '@/lib/filter-genre-suggestions';
import { useAuth } from '@/context/auth-context';
import {
  getUser,
  updateProfile,
  validateProfileData,
  ProfileValidationError
} from '@/services/user';
import { validateAvatarFile, AVATAR_ACCEPT } from '@/lib/avatar-upload';
import { uploadUserAvatar } from '@/services/storage';
import { ErrorOutlined, SaveOutlined, ArrowBackOutlined } from '@mui/icons-material';
import { ProfileEditSkeleton } from '@/components/profile/profile-skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useActiveGenres } from '@/hooks/useActiveGenres';

export function ProfileEditClient() {
  const { user: currentUser, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [youtube, setYoutube] = useState('');
  const [x, setX] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ProfileValidationError[]>([]);
  const [submitError, setSubmitError] = useState('');

  const [existingAvatarUrl, setExistingAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);

  const { genres, loading: genresLoading } = useActiveGenres();

  const handleGenreAdd = (genreId: string) => {
    if (selectedGenres.length >= 3) return;
    if (!selectedGenres.includes(genreId)) {
      setSelectedGenres(prev => [...prev, genreId]);
    }
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleGenreRemove = (genreId: string) => {
    setSelectedGenres(prev => prev.filter(id => id !== genreId));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateAvatarFile(file);
    if (!validation.ok) {
      setAvatarError(validation.error);
      return;
    }

    setAvatarError('');
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  // 外側クリックでサジェストを閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // サジェストの絞り込み (すでに選択されているものは除く)
  const filteredSuggestions = React.useMemo(() => {
    const unselected = genres.filter(g => !selectedGenres.includes(g.id));
    return filterGenreSuggestions(unselected, searchQuery, 8);
  }, [genres, selectedGenres, searchQuery]);

  useEffect(() => {
    async function loadUserData() {
      if (authLoading) return;
      if (!currentUser) {
        router.push('/login');
        return;
      }
      try {
        const userData = await getUser(currentUser.id);
        if (userData) {
          setDisplayName(userData.displayName || '');
          setBio(userData.bio || '');
          setExistingAvatarUrl(userData.avatarUrl || '');
          setSelectedGenres(userData.followedGenres || []);
          if (userData.snsLinks) {
            setYoutube(userData.snsLinks.youtube || '');
            setX(userData.snsLinks.x || '');
            setInstagram(userData.snsLinks.instagram || '');
            setTiktok(userData.snsLinks.tiktok || '');
          }
        }
      } catch (err) {
        console.error('Failed to load user profile for editing:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserData();
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (loading) return;
    const validationErrors = validateProfileData({
      displayName,
      bio,
      snsLinks: { youtube, x, instagram, tiktok }
    });
    setErrors(validationErrors);
  }, [displayName, bio, youtube, x, instagram, tiktok, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || errors.length > 0 || submitting) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        avatarUrl = await uploadUserAvatar(avatarFile, currentUser.id);
      }

      await updateProfile(currentUser.id, {
        displayName,
        bio,
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        followedGenres: selectedGenres,
        snsLinks: { youtube, x, instagram, tiktok }
      });
      await refreshUser();
      router.push(`/profile/${currentUser.id}`);
    } catch (err: unknown) {
      console.error('Profile update failed:', err);
      setSubmitError((err as Error)?.message || '更新に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const getFieldError = (field: 'displayName' | 'bio' | 'snsLinks.youtube' | 'snsLinks.x' | 'snsLinks.instagram' | 'snsLinks.tiktok') => {
    return errors.find(err => err.field === field)?.message;
  };

  if (authLoading || loading) {
    return <ProfileEditSkeleton />;
  }

  const hasErrors = errors.length > 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Button
        type="button"
        variant="ghost"
        className="mb-4 -ml-2"
        onClick={() => router.push(`/profile/${currentUser?.id}`)}
      >
        <ArrowBackOutlined sx={{ fontSize: 16 }} />
        <span>プロフィールに戻る</span>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>プロフィールの編集</CardTitle>
        </CardHeader>
        <CardContent>
          {submitError && (
            <Alert variant="destructive" className="mb-4">
              <ErrorOutlined sx={{ fontSize: 16 }} className="size-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-3">
              <img
                data-testid="profile-avatar-preview"
                src={avatarPreviewUrl || existingAvatarUrl || '/default-avatar.png'}
                alt={displayName}
                className="size-24 rounded-full border border-border object-cover"
              />
              <Label
                htmlFor="avatar-upload-input"
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-input bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                画像を変更する
              </Label>
              <input
                id="avatar-upload-input"
                data-testid="profile-avatar-upload-input"
                type="file"
                accept={AVATAR_ACCEPT}
                className="hidden"
                disabled={submitting}
                onChange={handleAvatarChange}
              />
              {avatarError && (
                <span className="text-xs text-destructive">{avatarError}</span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">表示名</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={cn(getFieldError('displayName') && 'border-destructive')}
                placeholder="ユーザー名を入力してください"
                disabled={submitting}
              />
              <div className="flex items-center justify-between text-xs">
                {getFieldError('displayName') ? (
                  <span className="text-destructive">{getFieldError('displayName')}</span>
                ) : (
                  <span />
                )}
                <span className={cn('text-muted-foreground', displayName.length > 30 && 'text-destructive')}>
                  {displayName.length} / 30
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="bio">自己紹介</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className={cn('min-h-[120px]', getFieldError('bio') && 'border-destructive')}
                placeholder="自己紹介を書いてみましょう（好きなジャンルや関心など）"
                disabled={submitting}
                rows={5}
              />
              <div className="flex items-center justify-between text-xs">
                {getFieldError('bio') ? (
                  <span className="text-destructive">{getFieldError('bio')}</span>
                ) : (
                  <span />
                )}
                <span className={cn('text-muted-foreground', bio.length > 200 && 'text-destructive')}>
                  {bio.length} / 200
                </span>
              </div>
            </div>

            {/* 好きなジャンル選択 */}
            <div className="flex flex-col gap-2" data-testid="profile-genre-select" ref={wrapRef}>
              <Label htmlFor="genre-search">好きなジャンル（最大3つ）</Label>
              
              {/* 選択済みのジャンルチップ */}
              <div className="flex flex-wrap gap-2 mb-1" data-testid="profile-selected-genres">
                {selectedGenres.map(genreId => {
                  const genre = genres.find(g => g.id === genreId);
                  if (!genre) return null;
                  return (
                    <div
                      key={genre.id}
                      data-testid={`profile-genre-chip-${genre.id}`}
                      className="flex items-center gap-1.5 rounded-full bg-secondary text-secondary-foreground border border-input px-3 py-1.5 text-sm"
                    >
                      {genre.iconImageUrl && (
                        <img src={genre.iconImageUrl} alt="" className="size-4 object-contain" />
                      )}
                      <span>{genre.displayName}</span>
                      <button
                        type="button"
                        data-testid={`profile-genre-remove-${genre.id}`}
                        onClick={() => handleGenreRemove(genre.id)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 cursor-pointer flex items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label={`${genre.displayName}を削除`}
                        disabled={submitting}
                      >
                        <span className="text-xs font-bold leading-none">&times;</span>
                      </button>
                    </div>
                  );
                })}
                {selectedGenres.length === 0 && (
                  <span className="text-sm text-muted-foreground py-1">ジャンルが選択されていません</span>
                )}
              </div>

              {genresLoading ? (
                <span className="text-sm text-muted-foreground">ジャンル一覧を読み込み中...</span>
              ) : (
                <div className="relative w-full">
                  <Input
                    id="genre-search"
                    data-testid="profile-genre-search-input"
                    type="text"
                    placeholder={
                      selectedGenres.length >= 3
                        ? "ジャンルは最大3つまで登録できます"
                        : "ジャンル名で検索して追加..."
                    }
                    value={searchQuery}
                    disabled={submitting || selectedGenres.length >= 3}
                    autoComplete="off"
                    onFocus={() => setShowSuggestions(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setHighlight(0);
                      setShowSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if (!showSuggestions || filteredSuggestions.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlight(h => Math.min(h + 1, filteredSuggestions.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlight(h => Math.max(h - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        handleGenreAdd(filteredSuggestions[highlight].id);
                      } else if (e.key === 'Escape') {
                        setShowSuggestions(false);
                      }
                    }}
                  />

                  {/* サジェストリスト */}
                  {showSuggestions && searchQuery.trim().length > 0 && (
                    <div 
                      className="absolute z-20 top-[calc(100%+4px)] left-0 right-0 max-h-[200px] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md"
                      role="listbox"
                    >
                      {filteredSuggestions.length > 0 ? (
                        <ul className="m-0 list-none p-0">
                          {filteredSuggestions.map((g, i) => (
                            <li
                              key={g.id}
                              role="option"
                              aria-selected={i === highlight}
                              data-testid={`profile-genre-suggest-${g.id}`}
                              className={cn(
                                "cursor-pointer px-3 py-2 text-sm rounded hover:bg-muted flex items-center gap-2",
                                i === highlight && "bg-muted"
                              )}
                              onMouseDown={(e) => {
                                e.preventDefault(); // Inputのblurを防ぐ
                                handleGenreAdd(g.id);
                              }}
                            >
                              {g.iconImageUrl && (
                                <img src={g.iconImageUrl} alt="" className="size-4 object-contain" />
                              )}
                              <span>{g.displayName}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">一致するジャンルが見つかりません</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SNS Links */}
            <div className="flex flex-col gap-4 border-t pt-4">
              <h3 className="text-sm font-semibold">SNSリンクの登録</h3>
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="youtube">YouTube</Label>
                <Input
                  id="youtube"
                  type="text"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  className={cn(getFieldError('snsLinks.youtube') && 'border-destructive')}
                  placeholder="https://www.youtube.com/channel/..."
                  disabled={submitting}
                />
                {getFieldError('snsLinks.youtube') && (
                  <span className="text-xs text-destructive">{getFieldError('snsLinks.youtube')}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="x">X (旧 Twitter)</Label>
                <Input
                  id="x"
                  type="text"
                  value={x}
                  onChange={(e) => setX(e.target.value)}
                  className={cn(getFieldError('snsLinks.x') && 'border-destructive')}
                  placeholder="https://x.com/..."
                  disabled={submitting}
                />
                {getFieldError('snsLinks.x') && (
                  <span className="text-xs text-destructive">{getFieldError('snsLinks.x')}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className={cn(getFieldError('snsLinks.instagram') && 'border-destructive')}
                  placeholder="https://www.instagram.com/..."
                  disabled={submitting}
                />
                {getFieldError('snsLinks.instagram') && (
                  <span className="text-xs text-destructive">{getFieldError('snsLinks.instagram')}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="tiktok">TikTok</Label>
                <Input
                  id="tiktok"
                  type="text"
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  className={cn(getFieldError('snsLinks.tiktok') && 'border-destructive')}
                  placeholder="https://www.tiktok.com/@..."
                  disabled={submitting}
                />
                {getFieldError('snsLinks.tiktok') && (
                  <span className="text-xs text-destructive">{getFieldError('snsLinks.tiktok')}</span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push(`/profile/${currentUser?.id}`)}
                disabled={submitting}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={hasErrors || submitting}>
                <SaveOutlined sx={{ fontSize: 18 }} />
                <span>{submitting ? '保存中...' : '保存'}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
