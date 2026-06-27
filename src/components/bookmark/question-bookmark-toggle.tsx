'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkBorderOutlined, BookmarkRounded } from '@mui/icons-material';
import { useAuth } from '@/context/auth-context';
import { toggleBookmark } from '@/services/bookmark';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuestionBookmarkToggleProps {
  questionId: string;
  initialBookmarked: boolean;
  onToggle?: (bookmarked: boolean) => void;
}

export function QuestionBookmarkToggle({
  questionId,
  initialBookmarked,
  onToggle,
}: QuestionBookmarkToggleProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      router.push('/login');
      return;
    }

    const next = !bookmarked;
    setBookmarked(next);
    setError(null);
    setBusy(true);

    try {
      const result = await toggleBookmark(user.id, questionId, 'question');
      setBookmarked(result);
      onToggle?.(result);
    } catch (err) {
      setBookmarked(bookmarked);
      const message =
        err instanceof Error ? err.message : 'ブックマークの更新に失敗しました';
      setError(message);
      console.error('[QuestionBookmarkToggle]', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-center">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleClick}
        disabled={busy}
        title={bookmarked ? 'ブックマーク解除' : 'ブックマーク登録'}
        data-testid={`question-bookmark-toggle-${questionId}`}
        className={cn(bookmarked && 'text-primary')}
      >
        {bookmarked
          ? <BookmarkRounded sx={{ fontSize: 18 }} className="fill-primary text-primary" />
          : <BookmarkBorderOutlined sx={{ fontSize: 18 }} />}
      </Button>
      {error && (
        <span className="max-w-[120px] text-center text-[0.7rem] text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
