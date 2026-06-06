import { GET } from '../../src/app/api/search/weekly-top/route';
import { NextRequest } from 'next/server';
import { getAdminFirestore } from '../../src/lib/firebase/admin';

// firebase-admin/firestore のモック
jest.mock('../../src/lib/firebase/admin', () => {
  const mockFirestore = {
    collection: jest.fn(),
  };
  return {
    getAdminFirestore: () => mockFirestore,
  };
});

describe('GET /api/search/weekly-top', () => {
  let mockFirestore: any;
  let mockLogsQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFirestore = getAdminFirestore();

    mockLogsQuery = {
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    mockFirestore.collection.mockImplementation((name: string) => {
      if (name === 'search_logs') return mockLogsQuery;
      return {};
    });
  });

  test('直近7日間の search_logs から人気キーワードTop5、人気タグTop5をそれぞれ件数降順で返すこと', async () => {
    // 過去7日間の検索ログをモック
    const mockLogs = [
      { userId: 'u1', queryText: 'JavaScript', tags: ['js', 'web'], loggedAt: new Date() },
      { userId: 'u2', queryText: 'JavaScript', tags: ['js'], loggedAt: new Date() },
      { userId: 'u3', queryText: 'React', tags: ['react', 'web'], loggedAt: new Date() },
      { userId: 'u4', queryText: 'TypeScript', tags: ['ts', 'js'], loggedAt: new Date() },
      { userId: 'u5', queryText: 'React', tags: ['react'], loggedAt: new Date() },
      { userId: 'u6', queryText: 'JavaScript', tags: [], loggedAt: new Date() },
      { userId: 'u7', queryText: 'Next.js', tags: ['nextjs', 'web'], loggedAt: new Date() },
      { userId: 'u8', queryText: 'Vue', tags: ['vue'], loggedAt: new Date() },
    ];

    mockLogsQuery.get.mockResolvedValue({
      docs: mockLogs.map((data, index) => ({
        id: `log-${index}`,
        data: () => data,
      })),
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.keywords).toBeDefined();
    expect(data.tags).toBeDefined();

    // キーワード集計:
    // JavaScript -> 3回
    // React -> 2回
    // TypeScript -> 1回
    // Next.js -> 1回
    // Vue -> 1回
    expect(data.keywords.slice(0, 2)).toEqual(['JavaScript', 'React']);
    expect(data.keywords.length).toBeLessThanOrEqual(5);

    // タグ集計:
    // js -> 3回
    // web -> 3回
    // react -> 2回
    // ts -> 1回
    // nextjs -> 1回
    // vue -> 1回
    // (js と web は同点3回、reactは2回、ts/nextjs/vueは1回)
    expect(data.tags).toContain('js');
    expect(data.tags).toContain('web');
    expect(data.tags.slice(0, 3)).toEqual(expect.arrayContaining(['js', 'web', 'react']));
    expect(data.tags.length).toBeLessThanOrEqual(5);
  });

  test('検索ログが存在しない場合は空配列を返すこと', async () => {
    mockLogsQuery.get.mockResolvedValue({ docs: [] });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.keywords).toEqual([]);
    expect(data.tags).toEqual([]);
  });

  test('例外発生時は 500 エラーを返すこと', async () => {
    mockLogsQuery.get.mockRejectedValue(new Error('Database error'));

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('internal-error');
  });
});
