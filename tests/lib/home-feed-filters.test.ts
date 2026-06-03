import {
  DEFAULT_HOME_FEED_FILTERS,
  hasActiveHomeSearchFilters,
} from '@/lib/home-feed-filters';

describe('hasActiveHomeSearchFilters', () => {
  it('デフォルトでは false', () => {
    expect(hasActiveHomeSearchFilters(DEFAULT_HOME_FEED_FILTERS)).toBe(false);
  });

  it('genreId 指定で true', () => {
    expect(
      hasActiveHomeSearchFilters({ ...DEFAULT_HOME_FEED_FILTERS, genreId: 'history' })
    ).toBe(true);
  });

  it('キーワード指定で true', () => {
    expect(
      hasActiveHomeSearchFilters({ ...DEFAULT_HOME_FEED_FILTERS, searchQuery: 'react' })
    ).toBe(true);
  });
});
