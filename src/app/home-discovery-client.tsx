'use client';

import React from 'react';
import Link from 'next/link';
import type { GenreMetadata, Quiz } from '@/types';
import { QuizCarousel } from '@/components/explore/quiz-carousel';
import { GenreCarousel } from '@/components/explore/genre-carousel';
import { buildSearchUrlQuery } from '@/lib/search-url-state';
import { HomeSidebar } from '@/components/explore/home-sidebar';

export interface HomeDiscoveryClientProps {
  initialTrending: Quiz[];
  initialLatest: Quiz[];
  initialGenres: GenreMetadata[];
  trendingError?: string | null;
  latestError?: string | null;
  genresError?: string | null;
}

interface DiscoverySectionProps {
  title: string;
  seeMoreHref: string;
  seeMoreTestId: string;
  sectionTestId: string;
  children: React.ReactNode;
}

function DiscoverySection({
  title,
  seeMoreHref,
  seeMoreTestId,
  sectionTestId,
  children,
}: DiscoverySectionProps) {
  return (
    <section className="flex flex-col gap-4" data-testid={sectionTestId}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="m-0 text-xl font-bold text-foreground">{title}</h2>
        <Link
          href={seeMoreHref}
          className="whitespace-nowrap text-sm font-semibold text-primary no-underline hover:underline"
          data-testid={seeMoreTestId}
        >
          もっと見る
        </Link>
      </div>
      {children}
    </section>
  );
}

export function HomeDiscoveryClient({
  initialTrending,
  initialLatest,
  initialGenres,
  trendingError = null,
  latestError = null,
  genresError = null,
}: HomeDiscoveryClientProps) {
  const genreLabelById = new Map(initialGenres.map((genre) => [genre.id, genre.displayName]));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_300px] items-start w-full">
      <div className="flex flex-col gap-10 min-w-0">
        <DiscoverySection
          title="おすすめクイズ"
          seeMoreHref={`/search?${buildSearchUrlQuery({ tab: 'trending' })}`}
          seeMoreTestId="discovery-see-more-trending"
          sectionTestId="home-discovery-trending"
        >
          <QuizCarousel
            quizzes={initialTrending}
            loading={false}
            error={trendingError}
            genreLabelById={genreLabelById}
          />
        </DiscoverySection>

        <DiscoverySection
          title="おすすめジャンル"
          seeMoreHref={`/search?${buildSearchUrlQuery({ openFilters: true })}`}
          seeMoreTestId="discovery-see-more-genres"
          sectionTestId="home-discovery-genres"
        >
          <GenreCarousel
            genres={initialGenres}
            loading={false}
            error={genresError}
            mode="navigate"
          />
        </DiscoverySection>

        <DiscoverySection
          title="新着クイズ"
          seeMoreHref="/search?tab=latest"
          seeMoreTestId="discovery-see-more-latest"
          sectionTestId="home-discovery-latest"
        >
          <QuizCarousel
            quizzes={initialLatest}
            loading={false}
            error={latestError}
            genreLabelById={genreLabelById}
          />
        </DiscoverySection>
      </div>
      <HomeSidebar />
    </div>
  );
}
