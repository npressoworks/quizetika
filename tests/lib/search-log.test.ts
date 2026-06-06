import { writeSearchLog } from '../../src/lib/search-log';
import { addDoc } from 'firebase/firestore';

// firebase/firestore のモック
jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    collection: jest.fn((db, path) => ({ path })),
    addDoc: jest.fn().mockResolvedValue({ id: 'mocked-log-id' }),
  };
});

// firebase/config のモック
jest.mock('../../src/lib/firebase/config', () => ({
  db: { type: 'mocked-db-instance' },
}));

describe('writeSearchLog (検索ログのサイレント記録)', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // console.error の出力をキャッチしてテストログを汚さないようにする
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('未認証ユーザー (userId が undefined または空) の場合は記録せずに早期リターンすること', async () => {
    await writeSearchLog(undefined, 'テストキーワード');
    await writeSearchLog('', 'テストキーワード');

    expect(addDoc).not.toHaveBeenCalled();
  });

  test('検索キーワードもタグも空の場合は記録せずに早期リターンすること', async () => {
    const userId = 'user-123';
    await writeSearchLog(userId, undefined, undefined);
    await writeSearchLog(userId, '', []);

    expect(addDoc).not.toHaveBeenCalled();
  });

  test('認証済みユーザーでキーワードが存在する場合、正しくFirestoreに保存されること', async () => {
    const userId = 'user-123';
    const queryText = 'JavaScript';
    
    await writeSearchLog(userId, queryText);

    expect(addDoc).toHaveBeenCalledTimes(1);
    const mockAddDoc = addDoc as jest.Mock;
    const savePayload = mockAddDoc.mock.calls[0][1];

    expect(savePayload.userId).toBe(userId);
    expect(savePayload.queryText).toBe(queryText);
    expect(savePayload.tags).toBeUndefined();
    expect(savePayload.loggedAt).toBeInstanceOf(Date);
  });

  test('認証済みユーザーでタグが存在する場合、正しくFirestoreに保存されること', async () => {
    const userId = 'user-123';
    const tags = ['web', 'react'];
    
    await writeSearchLog(userId, undefined, tags);

    expect(addDoc).toHaveBeenCalledTimes(1);
    const mockAddDoc = addDoc as jest.Mock;
    const savePayload = mockAddDoc.mock.calls[0][1];

    expect(savePayload.userId).toBe(userId);
    expect(savePayload.queryText).toBeUndefined();
    expect(savePayload.tags).toEqual(tags);
    expect(savePayload.loggedAt).toBeInstanceOf(Date);
  });

  test('Firestoreへの書き込みに失敗した場合、例外をスローせずエラーを出力するだけで正常終了すること', async () => {
    const userId = 'user-123';
    const queryText = 'error-test';

    const mockAddDoc = addDoc as jest.Mock;
    mockAddDoc.mockRejectedValueOnce(new Error('Firestore Write Error'));

    // 呼び出しが例外をスローしないことを検証
    await expect(writeSearchLog(userId, queryText)).resolves.not.toThrow();

    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
