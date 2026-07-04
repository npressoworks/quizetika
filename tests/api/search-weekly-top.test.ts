import { GET } from '../../src/app/api/search/weekly-top/route';

const mockGte = jest.fn();

jest.mock('../../src/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        gte: (...args: unknown[]) => mockGte(...args),
      }),
    }),
  }),
}));

describe('GET /api/search/weekly-top', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('直近7日間の search_logs から人気キーワードTop5、人気タグTop5をそれぞれ件数降順で返すこと', async () => {
    // query カラムには queryText / tags を含む JSON 文字列が格納されている
    const rows = [
      { query: JSON.stringify({ queryText: 'JavaScript', tags: ['js', 'web'] }) },
      { query: JSON.stringify({ queryText: 'JavaScript', tags: ['js'] }) },
      { query: JSON.stringify({ queryText: 'React', tags: ['react', 'web'] }) },
      { query: JSON.stringify({ queryText: 'TypeScript', tags: ['ts', 'js'] }) },
      { query: JSON.stringify({ queryText: 'React', tags: ['react'] }) },
      { query: JSON.stringify({ queryText: 'JavaScript', tags: [] }) },
      { query: JSON.stringify({ queryText: 'Next.js', tags: ['nextjs', 'web'] }) },
      { query: JSON.stringify({ queryText: 'Vue', tags: ['vue'] }) },
    ];

    mockGte.mockResolvedValue({ data: rows, error: null });

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
    // js -> 3回, web -> 3回, react -> 2回, ts/nextjs/vue -> 1回
    expect(data.tags).toContain('js');
    expect(data.tags).toContain('web');
    expect(data.tags.slice(0, 3)).toEqual(expect.arrayContaining(['js', 'web', 'react']));
    expect(data.tags.length).toBeLessThanOrEqual(5);
  });

  test('検索ログが存在しない場合は空配列を返すこと', async () => {
    mockGte.mockResolvedValue({ data: [], error: null });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.keywords).toEqual([]);
    expect(data.tags).toEqual([]);
  });

  test('不正なJSONを含む行はスキップして集計すること', async () => {
    mockGte.mockResolvedValue({
      data: [
        { query: 'not-a-json' },
        { query: JSON.stringify({ queryText: 'React', tags: ['react'] }) },
      ],
      error: null,
    });

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.keywords).toEqual(['React']);
    expect(data.tags).toEqual(['react']);
  });

  test('例外発生時は 500 エラーを返すこと', async () => {
    mockGte.mockRejectedValue(new Error('Database error'));

    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('internal-error');
  });
});
