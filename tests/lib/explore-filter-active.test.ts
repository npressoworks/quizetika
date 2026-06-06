import {
  DEFAULT_HOME_FEED_FILTERS,
  type HomeFeedFilters,
} from '@/lib/home-feed-filters';
import {
  hasActiveExploreFilters,
  hasActiveScopedExploreFilters,
} from '@/lib/explore-filter-active';

const base: HomeFeedFilters = { ...DEFAULT_HOME_FEED_FILTERS };

describe('hasActiveExploreFilters', () => {
  it('デフォルトでは false', () => {
    expect(hasActiveExploreFilters(base)).toBe(false);
  });

  it('format 指定で true', () => {
    expect(hasActiveExploreFilters({ ...base, format: 'multiple-choice' })).toBe(true);
  });

  it('genreId 指定で true', () => {
    expect(hasActiveExploreFilters({ ...base, genreId: 'science' })).toBe(true);
  });
});

describe('hasActiveScopedExploreFilters', () => {
  it('固定ジャンルのみでは false', () => {
    expect(
      hasActiveScopedExploreFilters({ ...base, genreId: 'science' }, 'science')
    ).toBe(false);
  });

  it('キーワード指定で true', () => {
    expect(
      hasActiveScopedExploreFilters(
        { ...base, genreId: 'science', searchQuery: 'react' },
        'science'
      )
    ).toBe(true);
  });

  it('形式のみ指定で true', () => {
    expect(
      hasActiveScopedExploreFilters(
        { ...base, genreId: 'science', format: 'mixed' },
        'science'
      )
    ).toBe(true);
  });
});
