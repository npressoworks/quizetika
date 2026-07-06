import {
  scanLegacyAssets,
  summarizeByTarget,
  checkSampleReadability,
  checkResidualLegacyAssets,
  migrateOneRecord,
  runLegacyStorageMigration,
} from '@/services/legacy-storage-migration';
import type { LegacyAssetRecord } from '@/services/legacy-storage-migration';

const createChainMock = (resolveValue: unknown) => {
  const chain: {
    select: jest.Mock;
    ilike: jest.Mock;
    then: jest.Mock;
    update: jest.Mock;
    eq: jest.Mock;
  } = {
    select: jest.fn(() => chain),
    ilike: jest.fn(() => chain),
    then: jest.fn((onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(resolveValue).then(onFulfilled)
    ),
    // update().eq() は select().ilike() の解決値とは独立して扱えるよう、
    // eq() 自体が直接 Promise を返す（デフォルトは成功）。テストごとに上書き可能。
    update: jest.fn(() => chain),
    eq: jest.fn(() => Promise.resolve({ error: null })),
  };
  return chain;
};

let chainsByTable: Record<string, ReturnType<typeof createChainMock>>;
let mockUpload: jest.Mock;
let mockGetPublicUrl: jest.Mock;
let mockStorageFrom: jest.Mock;

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: jest.fn((table: string) => chainsByTable[table]),
    storage: {
      from: (bucket: string) => mockStorageFrom(bucket),
    },
  }),
}));

const FIREBASE_URL = 'https://firebasestorage.googleapis.com/v0/b/quizetika.appspot.com/o/x.png';
const SUPABASE_URL = 'https://project.supabase.co/storage/v1/object/public/users/u2/avatar.png';

describe('scanLegacyAssets', () => {
  beforeEach(() => {
    chainsByTable = {
      users: createChainMock({
        data: [
          { id: 'u1', avatar_url: FIREBASE_URL },
          { id: 'u2', avatar_url: SUPABASE_URL },
          { id: 'u3', avatar_url: null },
        ],
        error: null,
      }),
      quizzes: createChainMock({ data: [], error: null }),
      questions: createChainMock({ data: [], error: null }),
      metadata_genres: createChainMock({
        data: [
          { id: 'g1', icon_image_url: FIREBASE_URL },
          { id: 'g2', icon_image_url: FIREBASE_URL },
        ],
        error: null,
      }),
      genre_requests: createChainMock({ data: [], error: null }),
    };
  });

  it('Firebase URL・Supabase URL・null が混在するレコードのうち、Firebase URLのレコードのみを返す', async () => {
    const result = await scanLegacyAssets();

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok result');
    }

    const usersRecords = result.records.filter((r) => r.table === 'users');
    expect(usersRecords).toHaveLength(1);
    expect(usersRecords[0]).toMatchObject({
      table: 'users',
      idColumn: 'id',
      recordId: 'u1',
      urlColumn: 'avatar_url',
      legacyUrl: FIREBASE_URL,
      bucket: 'users',
    });

    // Supabase URL・null のレコードはいずれの領域にも含まれない
    expect(result.records.some((r) => r.legacyUrl === SUPABASE_URL)).toBe(false);
  });

  it('対象領域（テーブル/カラム）別のレコード件数を正しく集計する', async () => {
    const result = await scanLegacyAssets();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok result');
    }

    const summary = summarizeByTarget(result.records);
    expect(summary).toEqual({
      'users.avatar_url': 1,
      'metadata_genres.icon_image_url': 2,
    });
  });

  it('summarizeByTarget は table と urlColumn の組み合わせ単位で件数を数える', () => {
    const records: LegacyAssetRecord[] = [
      {
        table: 'quizzes',
        idColumn: 'id',
        recordId: 'q1',
        urlColumn: 'thumbnail_url',
        legacyUrl: FIREBASE_URL,
        bucket: 'quizzes',
      },
      {
        table: 'quizzes',
        idColumn: 'id',
        recordId: 'q2',
        urlColumn: 'thumbnail_url',
        legacyUrl: FIREBASE_URL,
        bucket: 'quizzes',
      },
      {
        table: 'quizzes',
        idColumn: 'id',
        recordId: 'q3',
        urlColumn: 'author_avatar',
        legacyUrl: FIREBASE_URL,
        bucket: 'quizzes',
      },
    ];

    expect(summarizeByTarget(records)).toEqual({
      'quizzes.thumbnail_url': 2,
      'quizzes.author_avatar': 1,
    });
  });

  it('いずれかのテーブルへのクエリが失敗した場合、その時点で ok: false を返す', async () => {
    chainsByTable.quizzes = createChainMock({
      data: null,
      error: { message: 'connection refused' },
    });

    const result = await scanLegacyAssets();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected error result');
    }
    expect(result.error).toEqual({
      kind: 'query_failed',
      table: 'quizzes',
      message: 'connection refused',
    });
  });
});

describe('checkSampleReadability', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const makeRecords = (count: number): LegacyAssetRecord[] =>
    Array.from({ length: count }, (_, i) => ({
      table: 'users',
      idColumn: 'id',
      recordId: `u${i}`,
      urlColumn: 'avatar_url',
      legacyUrl: `${FIREBASE_URL}?i=${i}`,
      bucket: 'users',
    }));

  it('全件200の場合、ok: true で readableCount がサンプル件数と一致する', async () => {
    const records = makeRecords(3);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;

    const result = await checkSampleReadability(records);

    expect(result).toEqual({ ok: true, readableCount: 3, sampleSize: 3 });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('一部200の場合、ok: true で readableCount が部分的な件数になる', async () => {
    const records = makeRecords(4);
    let call = 0;
    global.fetch = jest.fn(() => {
      call += 1;
      if (call <= 2) {
        return Promise.resolve({ ok: true, status: 200 });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }) as unknown as typeof fetch;

    const result = await checkSampleReadability(records);

    expect(result).toEqual({ ok: true, readableCount: 2, sampleSize: 4 });
  });

  it('全件失敗（ネットワークエラーとHTTPエラーが混在）の場合、ok: false を返す', async () => {
    const records = makeRecords(3);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: false, status: 404 }) as unknown as typeof fetch;

    const result = await checkSampleReadability(records);

    expect(result).toEqual({ ok: false, sampleSize: 3 });
  });

  it('レコードが5件を超える場合、先頭5件のみをサンプルとして fetch する', async () => {
    const records = makeRecords(8);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;

    const result = await checkSampleReadability(records);

    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(result).toEqual({ ok: true, readableCount: 5, sampleSize: 5 });
  });

  it('レコードが5件未満の場合、全件を fetch する', async () => {
    const records = makeRecords(3);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;

    const result = await checkSampleReadability(records);

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe('checkResidualLegacyAssets', () => {
  beforeEach(() => {
    chainsByTable = {
      users: createChainMock({ data: [], error: null }),
      quizzes: createChainMock({ data: [], error: null }),
      questions: createChainMock({ data: [], error: null }),
      metadata_genres: createChainMock({ data: [], error: null }),
      genre_requests: createChainMock({ data: [], error: null }),
    };
  });

  it('残存レコードが0件の場合、ok: true で residualCount が 0 になる', async () => {
    const result = await checkResidualLegacyAssets();

    expect(result).toEqual({ ok: true, residualCount: 0 });
  });

  it('残存レコードが2件以上の場合、ok: false でテーブル・カラム・IDを含むレコード一覧を返す', async () => {
    chainsByTable.users = createChainMock({
      data: [{ id: 'u1', avatar_url: FIREBASE_URL }],
      error: null,
    });
    chainsByTable.metadata_genres = createChainMock({
      data: [{ id: 'g1', icon_image_url: FIREBASE_URL }],
      error: null,
    });

    const result = await checkResidualLegacyAssets();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected residual result');
    }
    if (result.kind !== 'residual_found') {
      throw new Error('expected residual_found kind');
    }
    expect(result.residualCount).toBe(2);
    expect(result.residualRecords).toEqual(
      expect.arrayContaining([
        { table: 'users', idColumn: 'id', recordId: 'u1', urlColumn: 'avatar_url' },
        { table: 'metadata_genres', idColumn: 'id', recordId: 'g1', urlColumn: 'icon_image_url' },
      ])
    );
    expect(result.residualRecords).toHaveLength(2);
  });

  it('走査自体（クエリ）が失敗した場合、残存ありとは区別される scan_failed を返す', async () => {
    chainsByTable.quizzes = createChainMock({
      data: null,
      error: { message: 'connection refused' },
    });

    const result = await checkResidualLegacyAssets();

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected error result');
    }
    if (result.kind !== 'scan_failed') {
      throw new Error('expected scan_failed kind');
    }
    expect(result.error).toEqual({
      kind: 'query_failed',
      table: 'quizzes',
      message: 'connection refused',
    });
  });
});

describe('migrateOneRecord', () => {
  const originalFetch = global.fetch;

  const record: LegacyAssetRecord = {
    table: 'users',
    idColumn: 'id',
    recordId: 'u1',
    urlColumn: 'avatar_url',
    legacyUrl: FIREBASE_URL,
    bucket: 'users',
  };

  const NEW_URL =
    'https://project.supabase.co/storage/v1/object/public/users/legacy-migrated/users-u1-avatar_url.png';

  const okFetchResponse = (contentType: string, body: ArrayBuffer) => ({
    ok: true,
    status: 200,
    headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => body,
  });

  beforeEach(() => {
    mockUpload = jest.fn();
    mockGetPublicUrl = jest.fn();
    mockStorageFrom = jest.fn(() => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('正常系: 取得成功→検証成功→アップロード成功→公開確認成功で ok:true と newUrl を返す', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okFetchResponse('image/png', new ArrayBuffer(3)))
      .mockResolvedValueOnce({ ok: true, status: 200 }) as unknown as typeof fetch;

    mockUpload.mockResolvedValue({
      data: { path: 'legacy-migrated/users-u1-avatar_url.png' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: NEW_URL } });

    const result = await migrateOneRecord(record);

    expect(result).toEqual({ ok: true, record, newUrl: NEW_URL });
    expect(mockStorageFrom).toHaveBeenCalledWith('users');
    expect(mockUpload).toHaveBeenCalledWith(
      'legacy-migrated/users-u1-avatar_url.png',
      expect.anything(),
      { contentType: 'image/png', upsert: true }
    );
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(2, NEW_URL);
  });

  it('決定的パスの形式: {bucket}/legacy-migrated/{table}-{recordId}-{column}.{ext} の objectPath でアップロードされる', async () => {
    const quizRecord: LegacyAssetRecord = {
      table: 'quizzes',
      idColumn: 'id',
      recordId: 'q42',
      urlColumn: 'thumbnail_url',
      legacyUrl: FIREBASE_URL,
      bucket: 'quizzes',
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okFetchResponse('image/jpeg', new ArrayBuffer(2)))
      .mockResolvedValueOnce({ ok: true, status: 200 }) as unknown as typeof fetch;

    mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'https://project.supabase.co/storage/v1/object/public/quizzes/legacy-migrated/quizzes-q42-thumbnail_url.jpeg',
      },
    });

    await migrateOneRecord(quizRecord);

    expect(mockStorageFrom).toHaveBeenCalledWith('quizzes');
    expect(mockUpload).toHaveBeenCalledWith(
      'legacy-migrated/quizzes-q42-thumbnail_url.jpeg',
      expect.anything(),
      { contentType: 'image/jpeg', upsert: true }
    );
  });

  it('異常系: 取得失敗（404）の場合、fetch_failed を返しアップロードは呼ばれない', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

    const result = await migrateOneRecord(record);

    expect(result).toEqual({
      ok: false,
      record,
      reason: 'fetch_failed',
      detail: expect.any(String),
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('異常系: fetch がネットワークエラーで例外を投げた場合も fetch_failed を返す', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await migrateOneRecord(record);

    expect(result).toEqual({
      ok: false,
      record,
      reason: 'fetch_failed',
      detail: expect.any(String),
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('異常系: Content-Type が許可されない形式（image/svg+xml）の場合、mime_mismatch を返しアップロードは呼ばれない', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(okFetchResponse('image/svg+xml', new ArrayBuffer(0))) as unknown as typeof fetch;

    const result = await migrateOneRecord(record);

    expect(result).toEqual({
      ok: false,
      record,
      reason: 'mime_mismatch',
      detail: expect.any(String),
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('異常系: アップロードが失敗した場合、upload_failed を返し検証fetchは呼ばれない', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(okFetchResponse('image/jpeg', new ArrayBuffer(3))) as unknown as typeof fetch;

    mockUpload.mockResolvedValue({ data: null, error: { message: 'storage quota exceeded' } });

    const result = await migrateOneRecord(record);

    expect(result).toEqual({
      ok: false,
      record,
      reason: 'upload_failed',
      detail: 'storage quota exceeded',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('異常系: 公開アクセス確認fetchが失敗した場合、verify_failed を返す', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(okFetchResponse('image/gif', new ArrayBuffer(3)))
      .mockResolvedValueOnce({ ok: false, status: 403 }) as unknown as typeof fetch;

    mockUpload.mockResolvedValue({
      data: { path: 'legacy-migrated/users-u1-avatar_url.gif' },
      error: null,
    });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: NEW_URL } });

    const result = await migrateOneRecord(record);

    expect(result).toEqual({
      ok: false,
      record,
      reason: 'verify_failed',
      detail: expect.any(String),
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('runLegacyStorageMigration', () => {
  const originalFetch = global.fetch;

  const USERS_URL = `${FIREBASE_URL}&who=u1`;
  const GENRES_URL = `${FIREBASE_URL}&who=g1`;
  const REQUESTS_URL = `${FIREBASE_URL}&who=r1`;

  const okFetchResponse = (contentType: string, body: ArrayBuffer) => ({
    ok: true,
    status: 200,
    headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => body,
  });

  // users / metadata_genres / genre_requests はそれぞれ LEGACY_STORAGE_TARGETS 上で
  // 単一ターゲットのみを持つため、この3テーブルにのみ1件ずつデータを入れることで
  // scanLegacyAssets() が返す records の順序（users → metadata_genres → genre_requests）を
  // 決定的にできる（quizzes/questions は複数ターゲットを持つため空のままにする）。
  const setupThreeRecordScan = () => {
    chainsByTable = {
      users: createChainMock({ data: [{ id: 'u1', avatar_url: USERS_URL }], error: null }),
      quizzes: createChainMock({ data: [], error: null }),
      questions: createChainMock({ data: [], error: null }),
      metadata_genres: createChainMock({
        data: [{ id: 'g1', icon_image_url: GENRES_URL }],
        error: null,
      }),
      genre_requests: createChainMock({
        data: [{ id: 'r1', icon_image_url: REQUESTS_URL }],
        error: null,
      }),
    };
  };

  beforeEach(() => {
    mockUpload = jest.fn();
    mockGetPublicUrl = jest.fn();
    mockStorageFrom = jest.fn(() => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('ドライランモード（既定）', () => {
    beforeEach(() => {
      setupThreeRecordScan();
    });

    it('Storage/DBへの書き込み関数を一切呼ばず、対象一覧と想定新URLのみを返す', async () => {
      global.fetch = jest.fn() as unknown as typeof fetch;
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/x' },
      });

      const result = await runLegacyStorageMigration({ execute: false });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('expected ok result');
      }
      expect(result.mode).toBe('dry-run');
      expect(result.totalCandidates).toBe(3);
      expect(result.byTable).toEqual({ users: 1, metadata_genres: 1, genre_requests: 1 });
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.failures).toEqual([]);
      expect(result.dryRunPreview).toHaveLength(3);
      expect(result.dryRunPreview?.[0]).toEqual({
        record: expect.objectContaining({ recordId: 'u1' }),
        plannedNewUrl: expect.any(String),
      });

      // 観測可能な完了条件: dry-runでは migrateOneRecord が内部で使う fetch も、
      // Storage upload / DB update も一度も呼ばれない
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockUpload).not.toHaveBeenCalled();
      expect(chainsByTable.users.update).not.toHaveBeenCalled();
      expect(chainsByTable.metadata_genres.update).not.toHaveBeenCalled();
      expect(chainsByTable.genre_requests.update).not.toHaveBeenCalled();
    });
  });

  describe('実行モード（execute: true）', () => {
    const NEW_USERS_URL =
      'https://project.supabase.co/storage/v1/object/public/users/legacy-migrated/users-u1-avatar_url.png';
    const NEW_REQUESTS_URL =
      'https://project.supabase.co/storage/v1/object/public/genres/legacy-migrated/genre_requests-r1-icon_image_url.gif';

    beforeEach(() => {
      setupThreeRecordScan();
    });

    it('成功/失敗が混在する場合、成功レコードのみDB更新し、失敗レコードのDBは変更しない。レポート件数は入力件数と一致する', async () => {
      // 処理順序: users/u1(成功) → metadata_genres/g1(mime不一致で失敗) → genre_requests/r1(成功)
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(okFetchResponse('image/png', new ArrayBuffer(3))) // u1 取得
        .mockResolvedValueOnce({ ok: true, status: 200 }) // u1 公開確認
        .mockResolvedValueOnce(okFetchResponse('image/svg+xml', new ArrayBuffer(0))) // g1 取得（mime不一致）
        .mockResolvedValueOnce(okFetchResponse('image/gif', new ArrayBuffer(3))) // r1 取得
        .mockResolvedValueOnce({ ok: true, status: 200 }) as unknown as typeof fetch; // r1 公開確認

      mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
      mockGetPublicUrl
        .mockReturnValueOnce({ data: { publicUrl: NEW_USERS_URL } })
        .mockReturnValueOnce({ data: { publicUrl: NEW_REQUESTS_URL } });

      const result = await runLegacyStorageMigration({ execute: true });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('expected ok result');
      }
      expect(result.mode).toBe('execute');
      expect(result.totalCandidates).toBe(3);
      expect(result.byTable).toEqual({ users: 1, metadata_genres: 1, genre_requests: 1 });
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toMatchObject({
        record: expect.objectContaining({ table: 'metadata_genres', recordId: 'g1' }),
        reason: 'mime_mismatch',
      });
      // dry-run専用フィールドは実行モードのレポートには含めない
      expect(result.dryRunPreview).toBeUndefined();

      // 成功レコードのみDB更新される
      expect(chainsByTable.users.update).toHaveBeenCalledWith({ avatar_url: NEW_USERS_URL });
      expect(chainsByTable.users.eq).toHaveBeenCalledWith('id', 'u1');
      expect(chainsByTable.genre_requests.update).toHaveBeenCalledWith({
        icon_image_url: NEW_REQUESTS_URL,
      });
      expect(chainsByTable.genre_requests.eq).toHaveBeenCalledWith('id', 'r1');

      // 失敗レコードのDB値は変更しない（明示的な非呼び出し確認）
      expect(chainsByTable.metadata_genres.update).not.toHaveBeenCalled();
    });

    it('失敗レコードのDBは明示的に触らない', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(okFetchResponse('image/png', new ArrayBuffer(3)))
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 404 }) // g1: 取得失敗
        .mockResolvedValueOnce(okFetchResponse('image/gif', new ArrayBuffer(3)))
        .mockResolvedValueOnce({ ok: true, status: 200 }) as unknown as typeof fetch;

      mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
      mockGetPublicUrl
        .mockReturnValueOnce({ data: { publicUrl: NEW_USERS_URL } })
        .mockReturnValueOnce({ data: { publicUrl: NEW_REQUESTS_URL } });

      await runLegacyStorageMigration({ execute: true });

      expect(chainsByTable.metadata_genres.update).not.toHaveBeenCalled();
      expect(chainsByTable.metadata_genres.eq).not.toHaveBeenCalled();
    });

    it('全件成功の場合、succeeded が総件数と一致し failed は0になる', async () => {
      global.fetch = jest.fn().mockResolvedValue(okFetchResponse('image/png', new ArrayBuffer(3)));
      // 各レコード: 取得成功 → 公開確認成功 の順で交互に解決させる
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === NEW_USERS_URL || url === NEW_REQUESTS_URL || url.includes('supabase.co')) {
          return Promise.resolve({ ok: true, status: 200 });
        }
        return Promise.resolve(okFetchResponse('image/png', new ArrayBuffer(3)));
      });

      mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
      let publicUrlCall = 0;
      mockGetPublicUrl.mockImplementation(() => {
        publicUrlCall += 1;
        return {
          data: {
            publicUrl: `https://project.supabase.co/storage/v1/object/public/legacy-migrated-${publicUrlCall}.png`,
          },
        };
      });

      const result = await runLegacyStorageMigration({ execute: true });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('expected ok result');
      }
      expect(result.totalCandidates).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.failures).toEqual([]);
    });

    it('DB更新自体が失敗した場合も失敗として記録し、後続レコードの処理を継続する', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(okFetchResponse('image/png', new ArrayBuffer(3)))
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce(okFetchResponse('image/svg+xml', new ArrayBuffer(0)))
        .mockResolvedValueOnce(okFetchResponse('image/gif', new ArrayBuffer(3)))
        .mockResolvedValueOnce({ ok: true, status: 200 }) as unknown as typeof fetch;

      mockUpload.mockResolvedValue({ data: { path: 'x' }, error: null });
      mockGetPublicUrl
        .mockReturnValueOnce({ data: { publicUrl: NEW_USERS_URL } })
        .mockReturnValueOnce({ data: { publicUrl: NEW_REQUESTS_URL } });

      chainsByTable.users.eq.mockResolvedValue({ error: { message: 'db write failed' } });

      const result = await runLegacyStorageMigration({ execute: true });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error('expected ok result');
      }
      // users(DB更新失敗) + metadata_genres(mime不一致) = 2失敗、genre_requests のみ成功
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.failures.map((f) => f.record.recordId).sort()).toEqual(['g1', 'u1']);
    });
  });

  describe('scanLegacyAssets の失敗伝播', () => {
    beforeEach(() => {
      chainsByTable = {
        users: createChainMock({ data: [], error: null }),
        quizzes: createChainMock({ data: null, error: { message: 'connection refused' } }),
        questions: createChainMock({ data: [], error: null }),
        metadata_genres: createChainMock({ data: [], error: null }),
        genre_requests: createChainMock({ data: [], error: null }),
      };
    });

    it('scanLegacyAssets が失敗した場合、0件として扱わずエラーとして伝播する（dry-run）', async () => {
      global.fetch = jest.fn() as unknown as typeof fetch;

      const result = await runLegacyStorageMigration({ execute: false });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('expected error result');
      }
      expect(result.kind).toBe('scan_failed');
      expect(result.error).toEqual({
        kind: 'query_failed',
        table: 'quizzes',
        message: 'connection refused',
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('scanLegacyAssets が失敗した場合、実行モードでもDB更新は一切行われない', async () => {
      global.fetch = jest.fn() as unknown as typeof fetch;

      const result = await runLegacyStorageMigration({ execute: true });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error('expected error result');
      }
      expect(result.kind).toBe('scan_failed');
      expect(chainsByTable.users.update).not.toHaveBeenCalled();
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });
});
