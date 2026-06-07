import React from 'react';
import styles from './result-skeleton.module.css';

interface ResultSkeletonProps {
  'data-testid'?: string;
}

export function ResultSkeleton({ 'data-testid': testId = 'quiz-result-skeleton' }: ResultSkeletonProps) {
  return (
    <div className={styles.skeletonCard} data-testid={testId}>
      {/* 円形スコアプレースホルダー */}
      <div className={styles.scoreCircleWrapper}>
        <div className={`${styles.scoreCircle} ${styles.pulse}`} />
      </div>

      {/* タイトルプレースホルダー */}
      <div className={`${styles.title} ${styles.pulse}`} />

      {/* 作成者情報 */}
      <div className={styles.authorRow}>
        <div className={`${styles.avatar} ${styles.pulse}`} />
        <div className={`${styles.authorName} ${styles.pulse}`} />
      </div>

      {/* メタ情報 */}
      <div className={styles.metaRow}>
        <div className={`${styles.metaItem} ${styles.pulse}`} />
        <div className={`${styles.metaItem} ${styles.pulse}`} />
        <div className={`${styles.metaItem} ${styles.pulse}`} />
      </div>

      {/* もう一度プレイするボタン */}
      <div className={styles.buttonWrapper}>
        <div className={`${styles.button} ${styles.pulse}`} />
      </div>

      {/* フィードバックセクション枠 */}
      <div className={styles.feedbackSection}>
        <div className={`${styles.feedbackTitle} ${styles.pulse}`} />
        <div className={styles.feedbackButtons}>
          <div className={`${styles.feedbackBtn} ${styles.pulse}`} />
          <div className={`${styles.feedbackBtn} ${styles.pulse}`} />
        </div>
      </div>

      {/* 解答一覧プレースホルダー */}
      <div className={styles.questionsList}>
        <div className={`${styles.sectionTitle} ${styles.pulse}`} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.questionItem}>
            <div className={styles.questionHeader}>
              <div className={`${styles.questionIcon} ${styles.pulse}`} />
              <div className={`${styles.questionText} ${styles.pulse}`} />
            </div>
            <div className={styles.answers}>
              <div className={`${styles.answerLine} ${styles.pulse}`} style={{ width: '40%' }} />
              <div className={`${styles.answerLine} ${styles.pulse}`} style={{ width: '50%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
