import React, { Suspense } from 'react';
import { MyQuizClient } from './my-quiz-client';
import styles from './my-quiz.module.css';

export const metadata = {
  title: 'マイクイズ | quizeum',
};

export default function MyQuizPage() {
  return (
    <div className={styles.container} data-testid="my-quiz-page">
      <header>
        <h1 className={styles.title}>マイクイズ</h1>
        <p className={styles.desc}>
          自作・ブックマークから問題を集め、フィルタして連続プレイできます。
        </p>
      </header>

      <Suspense fallback={null}>
        <MyQuizClient />
      </Suspense>
    </div>
  );
}
