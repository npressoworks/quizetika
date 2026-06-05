import React from 'react';
import { Bookmark } from 'lucide-react';
import type { Quiz } from '../../types';
import styles from './quiz-card.module.css';

interface QuizCardProps {
  quiz: Quiz;
  isBookmarked: boolean;
  onBookmarkToggle: (quizId: string) => Promise<void>;
  onPlayClick: (quizId: string) => void;
}

export function QuizCard({ quiz, isBookmarked, onBookmarkToggle, onPlayClick }: QuizCardProps) {
  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmarkToggle(quiz.id || '');
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div className={styles.quizCard} data-testid="quiz-card" onClick={handlePlayClick}>
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

        <div className={styles.difficultyContainer}>
          <span className={styles.difficultyText}>難易度: {quiz.difficulty} / 10</span>
          <div className={styles.progressBarBg}>
            <div
              className={styles.progressBar}
              style={{ width: `${(quiz.difficulty / 10) * 100}%` }}
            />
          </div>
        </div>

        <button className={styles.playBtn} onClick={handlePlayClick}>
          挑戦する
        </button>
      </div>
    </div>
  );
}
