const createChainMock = (resolveValue: any) => {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue.maybeSingle)),
    then: jest.fn((onFulfilled: any) => {
      return Promise.resolve(resolveValue.write).then(onFulfilled);
    }),
  };
  return chain;
};

let chain: any;

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: jest.fn(() => chain),
  }),
}));

import { seedInitialGenresWithAdmin } from '../../src/services/seedInitialGenresAdmin';

describe('seedInitialGenresWithAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('未登録ジャンルは新規作成され added が増えること', async () => {
    chain = createChainMock({
      maybeSingle: { data: null, error: null },
      write: { error: null },
    });

    const result = await seedInitialGenresWithAdmin();

    expect(result.added).toBeGreaterThan(0);
    expect(result.updated).toBe(0);
    expect(chain.insert).toHaveBeenCalled();
    expect(chain.update).not.toHaveBeenCalled();
  });

  test('既存ジャンルIDは更新され updated が増えること', async () => {
    chain = createChainMock({
      maybeSingle: { data: { id: 'existing' }, error: null },
      write: { error: null },
    });

    const result = await seedInitialGenresWithAdmin();

    expect(result.updated).toBeGreaterThan(0);
    expect(result.added).toBe(0);
    expect(chain.update).toHaveBeenCalled();
    expect(chain.insert).not.toHaveBeenCalled();
  });
});
