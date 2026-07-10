import { listNgWords, createNgWord, updateNgWord, setNgWordActive } from '../../src/services/ngWords';

const mockSupabase: any = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  rpc: jest.fn(),
};

jest.mock('../../src/lib/supabase/server', () => ({
  createClient: async () => mockSupabase,
}));

const supabase = mockSupabase;

const sampleRow = {
  id: 'ng-1',
  word: 'スパム',
  normalized_word: 'スパム',
  is_active: true,
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

describe('NgWordsService - listNgWords', () => {
  beforeEach(() => jest.clearAllMocks());

  test('RLS経由のSELECTで取得した行をNgWord[]へマッピングして返す', async () => {
    supabase.select.mockResolvedValue({ data: [sampleRow], error: null });

    const result = await listNgWords();

    expect(supabase.from).toHaveBeenCalledWith('ng_words');
    expect(result).toEqual([
      {
        id: 'ng-1',
        word: 'スパム',
        isActive: true,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
  });

  test('取得エラー時は例外をスローする', async () => {
    supabase.select.mockResolvedValue({ data: null, error: { message: 'db error' } });

    await expect(listNgWords()).rejects.toThrow();
  });
});

describe('NgWordsService - createNgWord', () => {
  beforeEach(() => jest.clearAllMocks());

  test('RPCを正しい引数で呼び出し、レスポンスをNgWordへマッピングする', async () => {
    supabase.rpc.mockResolvedValue({ data: sampleRow, error: null });

    const result = await createNgWord('スパム');

    expect(supabase.rpc).toHaveBeenCalledWith('handle_create_ng_word', {
      p_word: 'スパム',
    });
    expect(result).toEqual({
      id: 'ng-1',
      word: 'スパム',
      isActive: true,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    });
  });

  test('空文字の場合はRPCを呼ばずにドメインエラーをスローする', async () => {
    await expect(createNgWord('')).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('空白のみの場合はRPCを呼ばずにドメインエラーをスローする', async () => {
    await expect(createNgWord('   ')).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('重複語句（23505）はドメインエラーへ変換される', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    await expect(createNgWord('スパム')).rejects.toThrow('この語句はすでに登録されています');
  });

  test('権限不足エラーは伝播する', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(createNgWord('スパム')).rejects.toThrow();
  });
});

describe('NgWordsService - updateNgWord', () => {
  beforeEach(() => jest.clearAllMocks());

  test('RPCを正しい引数で呼び出し、レスポンスをNgWordへマッピングする', async () => {
    const updatedRow = { ...sampleRow, word: '改訂後スパム' };
    supabase.rpc.mockResolvedValue({ data: updatedRow, error: null });

    const result = await updateNgWord('ng-1', '改訂後スパム');

    expect(supabase.rpc).toHaveBeenCalledWith('handle_update_ng_word', {
      p_id: 'ng-1',
      p_word: '改訂後スパム',
    });
    expect(result.word).toBe('改訂後スパム');
  });

  test('空文字の場合はRPCを呼ばずにドメインエラーをスローする', async () => {
    await expect(updateNgWord('ng-1', '')).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('空白のみの場合はRPCを呼ばずにドメインエラーをスローする', async () => {
    await expect(updateNgWord('ng-1', '   ')).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test('重複語句（23505）はドメインエラーへ変換される', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    await expect(updateNgWord('ng-1', 'スパム')).rejects.toThrow('この語句はすでに登録されています');
  });

  test('権限不足エラーは伝播する', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(updateNgWord('ng-1', 'スパム')).rejects.toThrow();
  });
});

describe('NgWordsService - setNgWordActive', () => {
  beforeEach(() => jest.clearAllMocks());

  test('true→false: RPCを正しい引数で呼び出し、レスポンスをNgWordへマッピングする', async () => {
    const inactiveRow = { ...sampleRow, is_active: false };
    supabase.rpc.mockResolvedValue({ data: inactiveRow, error: null });

    const result = await setNgWordActive('ng-1', false);

    expect(supabase.rpc).toHaveBeenCalledWith('handle_set_ng_word_active', {
      p_id: 'ng-1',
      p_is_active: false,
    });
    expect(result.isActive).toBe(false);
  });

  test('false→true: RPCを正しい引数で呼び出し、レスポンスをNgWordへマッピングする', async () => {
    const activeRow = { ...sampleRow, is_active: true };
    supabase.rpc.mockResolvedValue({ data: activeRow, error: null });

    const result = await setNgWordActive('ng-1', true);

    expect(supabase.rpc).toHaveBeenCalledWith('handle_set_ng_word_active', {
      p_id: 'ng-1',
      p_is_active: true,
    });
    expect(result.isActive).toBe(true);
  });

  test('権限不足エラーは伝播する', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission-denied' } });

    await expect(setNgWordActive('ng-1', false)).rejects.toThrow();
  });
});
