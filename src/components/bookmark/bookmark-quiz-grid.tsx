'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bookmark } from 'lucide-react';
import { Quiz } from '@/types';
import cardStyles from '@/app/page.module.css';

interface BookmarkQuizGridProps {
  quizzes: Quiz[];
  onRemove: (quizId: string) => void;
}

export function BookmarkQuizGrid({ quizzes, onRemove }: BookmarkQuizGridProps) {
  if (quizzes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', background: 'var(--glass-bg)', border: 'var(--glass-border)', borderRadius: 'var(--radius-lg)' }}>
        <h2 style={{ color: 'var(--text-main)', marginBottom: '8px' }}>ブックマークしたクイズがありません</h2>
        <p style={{ color: 'var(--text-muted)' }}>気になるクイズをお気に入り登録してコレクションしましょう！</p>
      </div>
    );
  }

  return (
    <div className={cardStyles.grid}>
      {quizzes.map((quiz) => (
        <Link key={quiz.id} href={`/quiz/${quiz.id}`} className={cardStyles.card}>
          {quiz.reviewBadge && !quiz.isReviewMasked && (
            <div className={cardStyles.badgeContainer}>
              <span className={cardStyles.badge}>🏅 {quiz.reviewBadge}</span>
            </div>
          )}
          <div className={cardStyles.cardThumbnail}>
            {quiz.thumbnailUrl ? (
              <Image src={quiz.thumbnailUrl} alt={quiz.title} fill sizes="300px" />
            ) : (
              <span className={cardStyles.thumbnailFallback}>💡</span>
            )}
          </div>
          <div className={cardStyles.cardContent}>
            <span className={cardStyles.cardGenre}>{quiz.genre}</span>
            <h3 className={cardStyles.cardTitle}>{quiz.title}</h3>
            <div className={cardStyles.cardStats}>
              <span>⏱️ {quiz.questionCount} 問</span>
              <button
                className={`${cardStyles.bookmarkBtn} ${cardStyles.bookmarked}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove(quiz.id);
                }}
                title="ブックマーク解除"
              >
                <Bookmark size={18} fill="#00ff66" color="#00ff66" />
              </button>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
