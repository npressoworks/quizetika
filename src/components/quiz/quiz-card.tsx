import React from 'react';
import Link from 'next/link';
import { Bookmark, ThumbsUp } from 'lucide-react';
import type { Quiz } from '../../types';
import { resolveQuizFormat } from '@/lib/quiz-format';
import { getDifficultyColor } from '@/lib/difficulty-color';
import { formatReviewScorePercent } from '@/services/review-utils';
import { FormatLabel } from '@/components/quiz/format-label';
import styles from './quiz-card.module.css';

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

  const getFallbackClass = (genre: string) => {
    switch (genre) {
      case 'programming':
        return styles.gradientProgramming;
      case 'web-front':
      case 'web':
        return styles.gradientWeb;
      default:
        return styles.gradientDefault;
    }
  };

  const formatValue = resolveQuizFormat({ format: quiz.format, questions: quiz.questions ?? [] });
  const genreLabel = genreDisplayName ?? quiz.genre;

  const content = (
    <>
      <div className={styles.thumbnailContainer}>
        {quiz.thumbnailUrl ? (
          <img src={quiz.thumbnailUrl} alt={quiz.title} className={styles.thumbnail} />
        ) : (
          <div className={`${styles.thumbnailPlaceholder} ${getFallbackClass(quiz.genre)}`}>
            <span className={styles.genreIcon}>💡</span>
          </div>
        )}
        <button
          className={`${styles.bookmarkBtn} ${isBookmarked ? styles.active : ''}`}
          onClick={handleBookmarkClick}
          data-testid="quiz-card-bookmark-btn"
          data-analytics="quiz-bookmark-toggle"
          aria-label="ブックマーク"
          type="button"
        >
          <Bookmark
            size={18}
            color={isBookmarked ? '#00ff66' : 'currentColor'}
            fill={isBookmarked ? '#00ff66' : 'none'}
          />
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{quiz.title}</h3>
          {quiz.reviewScore != null && (
            <span className={styles.rating} data-testid="quiz-card-review-score">
              <ThumbsUp size={14} aria-hidden />
              {formatReviewScorePercent(quiz.reviewScore)}
            </span>
          )}
        </div>

        <p className={styles.description}>{quiz.description}</p>

        <div className={styles.meta}>
          <span className={styles.author}>作者: {quiz.authorName || '名無しさん'}</span>
          <span className={styles.questionCount}>問題数: {quiz.questionCount}問</span>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.difficultyStar} data-testid="quiz-card-difficulty" style={{ fontFamily: 'monospace' }}>
            <span style={{ color: getDifficultyColor(quiz.difficulty) }}>{'★'.repeat(quiz.difficulty)}</span>
            <span style={{ color: 'var(--text-muted)' }}>{'☆'.repeat(Math.max(0, 5 - quiz.difficulty))}</span>
          </span>
          <span className={styles.genreLabel} data-testid="quiz-card-genre">
            {genreLabel}
          </span>
          <FormatLabel
            format={formatValue}
            className={styles.formatLabel}
            testId="quiz-card-format"
          />
        </div>

        <button
          className={styles.playBtn}
          onClick={handlePlayClick}
          data-testid="play-btn"
          data-analytics="quiz-play-start-card"
          type="button"
        >
          挑戦する
        </button>
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.quizCard} data-testid="quiz-card">
        {content}
      </Link>
    );
  }

  return (
    <div
      className={styles.quizCard}
      data-testid="quiz-card"
      onClick={() => onPlayClick(quiz.id || '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onPlayClick(quiz.id || '');
      }}
      role="button"
      tabIndex={0}
    >
      {content}
    </div>
  );
}
