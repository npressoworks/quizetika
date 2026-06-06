'use client';

import { useExploreQuizFeed, type HomeFeedTab } from './useExploreQuizFeed';
import type { HomeFeedFilters } from '@/lib/home-feed-filters';

export type { HomeFeedTab } from './useExploreQuizFeed';

export function useHomeQuizFeed(
  activeTab: HomeFeedTab,
  userId: string | undefined,
  filters: HomeFeedFilters
) {
  return useExploreQuizFeed({
    mode: 'home',
    activeTab,
    userId,
    filters,
  });
}
