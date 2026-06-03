import { applyPlayStatusFilter } from '@/lib/apply-play-status-filter';
import type { Quiz } from '@/types';

function q(id: string): Quiz {
  return {
    id,
    authorId: 'a',
    authorName: '作者',
    authorAvatar: '',
    title: id,
    description: '',
    thumbnailUrl: null,
    difficulty: 5,
    genre: 'g',
    tags: [],
    originalTags: [],
    questionIds: [],
    questions: [],
    canonicalGenreId: 'g',
    canonicalTagIds: [],
    questionCount: 5,
    status: 'published',
    flagsCount: 0,
    playCount: 0,
    bookmarksCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewBadge: null,
    reviewScore: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('applyPlayStatusFilter', () => {
  const list = [q('a'), q('b'), q('c')];
  const played = new Set(['a', 'c']);

  it('all はそのまま返す', () => {
    expect(applyPlayStatusFilter(list, 'all', played)).toHaveLength(3);
  });

  it('played はプレイ済みのみ', () => {
    expect(applyPlayStatusFilter(list, 'played', played).map((x) => x.id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('unplayed は未プレイのみ', () => {
    expect(applyPlayStatusFilter(list, 'unplayed', played).map((x) => x.id)).toEqual(['b']);
  });

  it('playedQuizIds が null のときは all 相当', () => {
    expect(applyPlayStatusFilter(list, 'played', null)).toHaveLength(3);
  });
});
