import React from 'react';
import { QuizCarouselSkeleton } from './quiz-carousel-skeleton';
import { GenreCarouselSkeleton } from './genre-carousel-skeleton';

export function HomeDiscoveryPageSkeleton() {
  return (
    <div className="flex flex-col" data-testid="home-discovery-page-skeleton">
      <section className="mb-10" data-testid="home-discovery-trending">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">おすすめクイズ</h2>
        </div>
        <QuizCarouselSkeleton />
      </section>
      <section className="mb-10" data-testid="home-discovery-genres">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">ジャンル</h2>
        </div>
        <GenreCarouselSkeleton />
      </section>
      <section className="mb-10" data-testid="home-discovery-latest">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">新着クイズ</h2>
        </div>
        <QuizCarouselSkeleton />
      </section>
    </div>
  );
}
