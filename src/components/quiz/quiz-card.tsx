import React from 'react';
import Link from 'next/link';
import { BookmarkBorderOutlined, Bookmark, ThumbUpAltOutlined } from '@mui/icons-material';
import type { Quiz } from '../../types';
import { resolveQuizFormat } from '@/lib/quiz-format';
import { getDifficultyColor } from '@/lib/difficulty-color';
import { formatReviewScorePercent } from '@/services/review-utils';
import { FormatLabel } from '@/components/quiz/format-label';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuizCardProps {
  quiz: Quiz;
  href?: string;
  genreDisplayName?: string;
  isBookmarked: boolean;
  onBookmarkToggle: (quizId: string) => Promise<void>;
  onPlayClick: (quizId: string) => void;
}

export function QuizCard({
  quiz,
  href,
  genreDisplayName,
  isBookmarked,
  onBookmarkToggle,
  onPlayClick,
}: QuizCardProps) {
  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onBookmarkToggle(quiz.id || '');
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onPlayClick(quiz.id || '');
  };

  const formatValue = resolveQuizFormat({ format: quiz.format, questions: quiz.questions ?? [] });
  const genreLabel = genreDisplayName ?? quiz.genre;

  const content = (
    <>
      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-muted">
        {quiz.thumbnailUrl ? (
          <img src={quiz.thumbnailUrl} alt={quiz.title} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <span className="text-4xl">💡</span>
          </div>
        )}
        <div
          className="absolute top-2 left-2 z-10"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <FormatLabel
            format={formatValue}
            testId="quiz-card-format"
            className="cursor-help border-border bg-background/80 backdrop-blur-sm shadow-sm"
          />
        </div>
        <button
          className="absolute top-2 right-2 z-10 rounded-full border border-border bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-muted"
          onClick={handleBookmarkClick}
          data-testid="quiz-card-bookmark-btn"
          data-analytics="quiz-bookmark-toggle"
          aria-label="ブックマーク"
          type="button"
        >
          {isBookmarked ? (
            <Bookmark
              sx={{ fontSize: 18, color: '#00ff66' }}
              data-testid="bookmark-icon-filled"
            />
          ) : (
            <BookmarkBorderOutlined
              sx={{ fontSize: 18, color: 'currentColor' }}
              data-testid="bookmark-icon-outlined"
            />
          )}
        </button>
        {quiz.reviewScore != null && (
          <span
            className="absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm shadow-sm"
            data-testid="quiz-card-review-score"
          >
            <ThumbUpAltOutlined sx={{ fontSize: 12 }} aria-hidden />
            {formatReviewScorePercent(quiz.reviewScore)}
          </span>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 pt-(--card-spacing)">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-foreground">
          {quiz.title}
        </h3>

        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{quiz.description}</p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>作者: {quiz.authorName || '名無しさん'}</span>
          <span>問題数: {quiz.questionCount}問</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            data-testid="quiz-card-difficulty"
            className="font-semibold"
            style={{ color: getDifficultyColor(quiz.difficulty) }}
          >
            Lv.{quiz.difficulty}
          </span>
          <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground" data-testid="quiz-card-genre">
            {genreLabel}
          </span>
        </div>

        <Button
          className="mt-auto w-full"
          onClick={handlePlayClick}
          data-testid="play-btn"
          data-analytics="quiz-play-start-card"
          type="button"
        >
          挑戦する
        </Button>
      </CardContent>
    </>
  );

  const cardClass = cn(
    'h-full gap-0 overflow-hidden pt-0',
    'transform-gpu backface-hidden',
    'transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
    'hover:-translate-y-2 hover:shadow-lg hover:shadow-primary/10 hover:ring-primary/25',
    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  );

  if (href) {
    return (
      <Link href={href} className="block h-full" data-testid="quiz-card">
        <Card className={cardClass}>{content}</Card>
      </Link>
    );
  }

  return (
    <Card
      className={cn(cardClass, 'cursor-pointer')}
      data-testid="quiz-card"
      onClick={() => onPlayClick(quiz.id || '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onPlayClick(quiz.id || '');
      }}
      role="button"
      tabIndex={0}
    >
      {content}
    </Card>
  );
}
