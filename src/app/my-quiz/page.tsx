import React, { Suspense } from 'react';
import { MyQuizClient } from './my-quiz-client';
import styles from './my-quiz.module.css';

export const metadata = {
  title: 'マイクイズ | quizeum',
};

export default function MyQuizPage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div data-testid="my-quiz-skeleton">読み込み中...</div>}>
        <MyQuizClient />
      </Suspense>
    </div>
  );
}
