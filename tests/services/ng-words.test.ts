import { listActiveNgWords } from '../../src/services/ng-words';

jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    from: jest.fn(() => mock),
    select: jest.fn(() => mock),
    eq: jest.fn(),
  };
  return { createClient: () => mock };
});

import { createClient } from '../../src/lib/supabase/client';
const supabase = createClient() as any;

describe('NgWordsService - listActiveNgWords', () => {
  beforeEach(() => jest.clearAllMocks());

  test('ng_words を is_active = true でフィルタして word 列のみの配列として取得する', async () => {
    supabase.eq.mockResolvedValue({
      data: [{ word: 'スパム' }, { word: '詐欺' }],
      error: null,
    });

    const result = await listActiveNgWords();

    expect(supabase.from).toHaveBeenCalledWith('ng_words');
    expect(supabase.select).toHaveBeenCalledWith('word');
    expect(supabase.eq).toHaveBeenCalledWith('is_active', true);
    expect(result).toEqual(['スパム', '詐欺']);
  });

  test('該当行が0件の場合は空配列を返す', async () => {
    supabase.eq.mockResolvedValue({ data: [], error: null });

    const result = await listActiveNgWords();

    expect(result).toEqual([]);
  });

  test('data が null の場合も空配列を返す（例外にしない）', async () => {
    supabase.eq.mockResolvedValue({ data: null, error: null });

    const result = await listActiveNgWords();

    expect(result).toEqual([]);
  });

  test('Supabaseクエリが失敗した場合は例外をスローする（フェイルクローズ、空配列にフォールバックしない）', async () => {
    supabase.eq.mockResolvedValue({
      data: null,
      error: { message: 'db connection error' },
    });

    await expect(listActiveNgWords()).rejects.toThrow();
  });
});
