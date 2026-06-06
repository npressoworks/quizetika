import React from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import type { Quiz } from '../../types';
import { resolveQuizFormat } from '@/lib/quiz-format';
import { getFormatLabel, getFormatIcon } from '@/lib/quiz-format-labels';
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
  const formatLabel = getFormatLabel(formatValue);
  const formatIcon = getFormatIcon(formatValue);
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
            <span className={styles.rating}>★ {quiz.reviewScore.toFixed(1)}</span>
          )}
        </div>

        <p className={styles.description}>{quiz.description}</p>

        <div className={styles.meta}>
          <span className={styles.author}>作者: {quiz.authorName || '名無しさん'}</span>
          <span className={styles.questionCount}>問題数: {quiz.questionCount}問</span>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.difficultyStar} data-testid="quiz-card-difficulty">
            ★ {quiz.difficulty}
          </span>
          <span className={styles.genreLabel} data-testid="quiz-card-genre">
            {genreLabel}
          </span>
          <span className={styles.formatLabel} data-testid="quiz-card-format">
            {formatIcon} {formatLabel}
          </span>
        </div>

        <button
          className={styles.playBtn}
          onClick={handlePlayClick}
          data-testid="play-btn"
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
