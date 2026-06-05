'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { toggleBookmark } from '@/services/bookmark';
import styles from './bookmark.module.css';

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
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <button
        type="button"
        className={`${styles.bookmarkToggleBtn} ${bookmarked ? styles.bookmarked : ''}`}
        onClick={handleClick}
        disabled={busy}
        title={bookmarked ? 'ブックマーク解除' : 'ブックマーク登録'}
        data-testid={`question-bookmark-toggle-${questionId}`}
      >
        <Star size={18} fill={bookmarked ? '#ff007f' : 'none'} />
      </button>
      {error && (
        <span style={{ fontSize: '0.7rem', color: '#ff4d6d', maxWidth: 120, textAlign: 'center' }}>
          {error}
        </span>
      )}
    </span>
  );
}
