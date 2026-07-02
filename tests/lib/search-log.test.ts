// Supabase クライアントのモック (jest.mock は巻き上げられるためインポートより前に宣言)
const mockInsert = jest.fn().mockResolvedValue({ error: null });
const mockFrom = jest.fn().mockReturnValue({ insert: mockInsert });

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

import { writeSearchLog } from '../../src/lib/search-log';

describe('writeSearchLog (検索ログのサイレント記録)', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({ insert: mockInsert });
    // console.error の出力をキャッチしてテストログを汚さないようにする
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('未認証ユーザー (userId が undefined または空) の場合は記録せずに早期リターンすること', async () => {
    await writeSearchLog(undefined, 'テストキーワード');
    await writeSearchLog('', 'テストキーワード');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('検索キーワードもタグも空の場合は記録せずに早期リターンすること', async () => {
    const userId = 'user-123';
    await writeSearchLog(userId, undefined, undefined);
    await writeSearchLog(userId, '', []);

    expect(mockFrom).not.toHaveBeenCalled();
  });

  test('認証済みユーザーでキーワードが存在する場合、正しくSupabaseに保存されること', async () => {
    const userId = 'user-123';
    const queryText = 'JavaScript';

    await writeSearchLog(userId, queryText);

    expect(mockFrom).toHaveBeenCalledWith('search_logs');
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertPayload = mockInsert.mock.calls[0][0];
    expect(insertPayload.user_id).toBe(userId);

    // query フィールドは JSON 文字列
    const parsed = JSON.parse(insertPayload.query);
    expect(parsed.queryText).toBe(queryText);
    expect(parsed.tags).toBeUndefined();
  });

  test('認証済みユーザーでタグが存在する場合、正しくSupabaseに保存されること', async () => {
    const userId = 'user-123';
    const tags = ['web', 'react'];

    await writeSearchLog(userId, undefined, tags);

    expect(mockFrom).toHaveBeenCalledWith('search_logs');
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertPayload = mockInsert.mock.calls[0][0];
    expect(insertPayload.user_id).toBe(userId);

    const parsed = JSON.parse(insertPayload.query);
    expect(parsed.queryText).toBeUndefined();
    expect(parsed.tags).toEqual(tags);
  });

  test('Supabaseへの書き込みに失敗した場合、例外をスローせずエラーを出力するだけで正常終了すること', async () => {
    const userId = 'user-123';
    const queryText = 'error-test';

    mockInsert.mockRejectedValueOnce(new Error('Supabase Write Error'));

    // 呼び出しが例外をスローしないことを検証
    await expect(writeSearchLog(userId, queryText)).resolves.not.toThrow();

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
