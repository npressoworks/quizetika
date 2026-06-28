import React, { Suspense } from 'react';
import { MyQuizClient } from './my-quiz-client';

export const metadata = {
  title: 'カスタムクイズ | quizetika',
};

export default function MyQuizPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-10" data-testid="my-quiz-page">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">カスタムクイズ</h1>
        <p className="mt-2 text-muted-foreground">
          自作クイズ・ブックマークから問題を集め、フィルタして連続プレイできます。
        </p>
      </header>

      <Suspense fallback={null}>
        <MyQuizClient />
      </Suspense>
    </div>
  );
}
