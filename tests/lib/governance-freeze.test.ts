import {
  COMMUNITY_GOVERNANCE_FROZEN,
  isGovernanceFrozen,
} from '@/lib/governance-freeze';

describe('governance-freeze', () => {
  it('凍結フラグ定数は現在 true（凍結中）', () => {
    expect(COMMUNITY_GOVERNANCE_FROZEN).toBe(true);
  });

  it('isGovernanceFrozen() は定数と同じ値を返す', () => {
    expect(isGovernanceFrozen()).toBe(COMMUNITY_GOVERNANCE_FROZEN);
  });

  it('純粋関数として同一ビルド内で常に同じ値を返す', () => {
    const first = isGovernanceFrozen();
    expect(isGovernanceFrozen()).toBe(first);
    expect(isGovernanceFrozen()).toBe(first);
  });

  it('jest.mock による差し替えが可能（凍結解除状態をテストで再現できる）', () => {
    jest.isolateModules(() => {
      jest.doMock('@/lib/governance-freeze', () => ({
        COMMUNITY_GOVERNANCE_FROZEN: false,
        isGovernanceFrozen: jest.fn().mockReturnValue(false),
      }));

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mocked = require('@/lib/governance-freeze') as {
        isGovernanceFrozen: () => boolean;
      };
      expect(mocked.isGovernanceFrozen()).toBe(false);
    });

    jest.dontMock('@/lib/governance-freeze');
  });
});
