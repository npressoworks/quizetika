import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseMode,
  runSampleMode,
  runFinalMode,
  applyFallbackCleanup,
  type RunSampleModeDeps,
  type RunFinalModeDeps,
  type FileIO,
} from '../../scripts/verify-legacy-storage-migration';
import type {
  LegacyAssetRecord,
  ScanLegacyAssetsResult,
  SampleReadabilityResult,
  CheckResidualLegacyAssetsResult,
} from '../../src/services/legacy-storage-migration';

function makeTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function makeRecord(overrides: Partial<LegacyAssetRecord> = {}): LegacyAssetRecord {
  return {
    table: 'users',
    idColumn: 'id',
    recordId: 'user-1',
    urlColumn: 'avatar_url',
    legacyUrl: 'https://firebasestorage.googleapis.com/v0/b/example/o/avatar.png',
    bucket: 'users',
    ...overrides,
  };
}

function makeFileIoSpy(): FileIO & { readFile: jest.Mock; writeFile: jest.Mock } {
  return {
    readFile: jest.fn(() => {
      throw new Error('readFile should not be called in this scenario');
    }),
    writeFile: jest.fn(),
  };
}

describe('parseMode', () => {
  test('"sample" を渡すと sample を返す', () => {
    expect(parseMode(['sample'])).toBe('sample');
  });

  test('"final" を渡すと final を返す', () => {
    expect(parseMode(['final'])).toBe('final');
  });

  test('無効な引数の場合は null を返す', () => {
    expect(parseMode(['invalid'])).toBeNull();
  });

  test('引数なしの場合は null を返す', () => {
    expect(parseMode([])).toBeNull();
  });
});

describe('runSampleMode', () => {
  test('棚卸しが失敗した場合、非ゼロ終了しエラー内容を出力する', async () => {
    const deps: RunSampleModeDeps = {
      scan: jest.fn(
        async (): Promise<ScanLegacyAssetsResult> => ({
          ok: false,
          error: { kind: 'query_failed', table: 'users', message: 'connection refused' },
        })
      ),
      checkSample: jest.fn(),
    };

    const result = await runSampleMode(deps);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('connection refused');
    expect(deps.checkSample).not.toHaveBeenCalled();
  });

  test('サンプル読み取りが1件以上成功した場合、終了コード0を返す', async () => {
    const records = [makeRecord()];
    const deps: RunSampleModeDeps = {
      scan: jest.fn(async (): Promise<ScanLegacyAssetsResult> => ({ ok: true, records })),
      checkSample: jest.fn(
        async (): Promise<SampleReadabilityResult> => ({ ok: true, readableCount: 1, sampleSize: 1 })
      ),
    };

    const result = await runSampleMode(deps);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('1/1');
    expect(deps.checkSample).toHaveBeenCalledWith(records);
  });

  test('サンプル読み取りが全滅した場合、非ゼロ終了コードを返す', async () => {
    const records = [makeRecord()];
    const deps: RunSampleModeDeps = {
      scan: jest.fn(async (): Promise<ScanLegacyAssetsResult> => ({ ok: true, records })),
      checkSample: jest.fn(
        async (): Promise<SampleReadabilityResult> => ({ ok: false, sampleSize: 1 })
      ),
    };

    const result = await runSampleMode(deps);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('FAIL');
  });
});

/*
 * ============================================================
 * applyFallbackCleanup: 一時ディレクトリにコピーしたフィクスチャファイルに対する検証
 * （リポジトリの実ファイルは一切読み書きしない）
 * ============================================================
 */

const NEXT_CONFIG_FIXTURE = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
`;

const STORAGE_TS_FIXTURE = `export async function deleteImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  // Supabase Storage の公開URLパターンに一致しない場合（旧 Firebase URL・外部アバター等）は何もしない
  const parsed = parseSupabasePublicUrl(imageUrl);
  if (!parsed) {
    return;
  }
`;

const STORAGE_PATH_TS_FIXTURE = `/**
 * 一致しない場合（旧 Firebase Storage URL・外部URL等）は null を返す
 */
export function parseSupabasePublicUrl(url: string): BucketAndPath | null {
  const match = url.match(SUPABASE_PUBLIC_URL_PATTERN);
  if (!match) {
    return null;
  }
`;

function makeRealFileIo(): FileIO {
  return {
    readFile: (filePath) => readFileSync(filePath, 'utf-8'),
    writeFile: (filePath, content) => writeFileSync(filePath, content, 'utf-8'),
  };
}

describe('applyFallbackCleanup', () => {
  let tempDir: string;

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('対象パターンを含む3ファイルすべてが変換され書き戻される', () => {
    tempDir = makeTempDir('verify-legacy-cleanup-all-changed-');
    const paths = {
      nextConfigPath: join(tempDir, 'next.config.ts'),
      storageServicePath: join(tempDir, 'storage.ts'),
      storagePathLibPath: join(tempDir, 'storage-path.ts'),
    };
    writeFileSync(paths.nextConfigPath, NEXT_CONFIG_FIXTURE, 'utf-8');
    writeFileSync(paths.storageServicePath, STORAGE_TS_FIXTURE, 'utf-8');
    writeFileSync(paths.storagePathLibPath, STORAGE_PATH_TS_FIXTURE, 'utf-8');

    const result = applyFallbackCleanup(paths, makeRealFileIo());

    expect(result.changedFiles.sort()).toEqual(
      [paths.nextConfigPath, paths.storageServicePath, paths.storagePathLibPath].sort()
    );

    const newNextConfig = readFileSync(paths.nextConfigPath, 'utf-8');
    expect(newNextConfig).not.toContain('firebasestorage.googleapis.com');
    expect(newNextConfig).toContain('api.dicebear.com');

    const newStorageTs = readFileSync(paths.storageServicePath, 'utf-8');
    expect(newStorageTs).not.toContain('旧 Firebase URL・外部アバター等');
    expect(newStorageTs).toContain('Supabase 以外の外部URL（Dicebearデフォルトアバター等）');
    // ガード節のロジック自体は変更されない
    expect(newStorageTs).toContain('if (!parsed) {\n    return;\n  }');

    const newStoragePathTs = readFileSync(paths.storagePathLibPath, 'utf-8');
    expect(newStoragePathTs).not.toContain('旧 Firebase Storage URL・外部URL等');
    expect(newStoragePathTs).toContain('Supabase 以外の外部URL（Dicebearデフォルトアバター等）');
  });

  test('対象パターンを含まないファイルは書き戻されない（changedFilesに含まれない）', () => {
    tempDir = makeTempDir('verify-legacy-cleanup-no-changes-');
    const paths = {
      nextConfigPath: join(tempDir, 'next.config.ts'),
      storageServicePath: join(tempDir, 'storage.ts'),
      storagePathLibPath: join(tempDir, 'storage-path.ts'),
    };
    const cleanNextConfig = NEXT_CONFIG_FIXTURE.replace(
      /\{\s*protocol: 'https',\s*hostname: 'firebasestorage\.googleapis\.com',\s*port: '',\s*pathname: '\/\*\*',\s*\},\r?\n/,
      ''
    );
    writeFileSync(paths.nextConfigPath, cleanNextConfig, 'utf-8');
    writeFileSync(paths.storageServicePath, 'export const noop = 1;\n', 'utf-8');
    writeFileSync(paths.storagePathLibPath, 'export const noop2 = 1;\n', 'utf-8');

    const result = applyFallbackCleanup(paths, makeRealFileIo());

    expect(result.changedFiles).toEqual([]);
    expect(readFileSync(paths.nextConfigPath, 'utf-8')).toBe(cleanNextConfig);
    expect(readFileSync(paths.storageServicePath, 'utf-8')).toBe('export const noop = 1;\n');
    expect(readFileSync(paths.storagePathLibPath, 'utf-8')).toBe('export const noop2 = 1;\n');
  });
});

/*
 * ============================================================
 * runFinalMode: モード分岐のオーケストレーション検証
 * ============================================================
 */

describe('runFinalMode', () => {
  test('残存件数検証自体が失敗した場合、非ゼロ終了しファイルI/O・build/testを一切実行しない', async () => {
    const io = makeFileIoSpy();
    const runBuildAndTest = jest.fn();
    const deps: RunFinalModeDeps = {
      checkResidual: jest.fn(
        async (): Promise<CheckResidualLegacyAssetsResult> => ({
          ok: false,
          kind: 'scan_failed',
          error: { kind: 'query_failed', table: 'quizzes', message: 'timeout' },
        })
      ),
      runBuildAndTest,
      paths: {
        nextConfigPath: 'unused-next-config.ts',
        storageServicePath: 'unused-storage.ts',
        storagePathLibPath: 'unused-storage-path.ts',
      },
      io,
    };

    const result = await runFinalMode(deps);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('timeout');
    expect(runBuildAndTest).not.toHaveBeenCalled();
    expect(io.readFile).not.toHaveBeenCalled();
    expect(io.writeFile).not.toHaveBeenCalled();
  });

  test('残存レコードが検出された場合、実ファイルを一切変更せず非ゼロ終了し残存一覧を出力する', async () => {
    const io = makeFileIoSpy();
    const runBuildAndTest = jest.fn();
    const residualRecords = [
      { table: 'users' as const, idColumn: 'id', recordId: 'user-1', urlColumn: 'avatar_url' },
      { table: 'quizzes' as const, idColumn: 'id', recordId: 'quiz-9', urlColumn: 'thumbnail_url' },
    ];
    const deps: RunFinalModeDeps = {
      checkResidual: jest.fn(
        async (): Promise<CheckResidualLegacyAssetsResult> => ({
          ok: false,
          kind: 'residual_found',
          residualCount: residualRecords.length,
          residualRecords,
        })
      ),
      runBuildAndTest,
      paths: {
        nextConfigPath: 'unused-next-config.ts',
        storageServicePath: 'unused-storage.ts',
        storagePathLibPath: 'unused-storage-path.ts',
      },
      io,
    };

    const result = await runFinalMode(deps);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('users.avatar_url');
    expect(result.output).toContain('quizzes.thumbnail_url');
    expect(runBuildAndTest).not.toHaveBeenCalled();
    expect(io.readFile).not.toHaveBeenCalled();
    expect(io.writeFile).not.toHaveBeenCalled();
  });

  test('残存ゼロだが npm run build が失敗した場合、実ファイルを一切変更せず非ゼロ終了する', async () => {
    const io = makeFileIoSpy();
    const runBuildAndTest = jest.fn(() => ({
      buildOk: false,
      testOk: false,
      buildOutput: 'TypeScript error: something is wrong',
      testOutput: '',
    }));
    const deps: RunFinalModeDeps = {
      checkResidual: jest.fn(
        async (): Promise<CheckResidualLegacyAssetsResult> => ({ ok: true, residualCount: 0 })
      ),
      runBuildAndTest,
      paths: {
        nextConfigPath: 'unused-next-config.ts',
        storageServicePath: 'unused-storage.ts',
        storagePathLibPath: 'unused-storage-path.ts',
      },
      io,
    };

    const result = await runFinalMode(deps);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('something is wrong');
    expect(runBuildAndTest).toHaveBeenCalledTimes(1);
    expect(io.readFile).not.toHaveBeenCalled();
    expect(io.writeFile).not.toHaveBeenCalled();
  });

  test('残存ゼロ・build成功だが npm run test が失敗した場合、実ファイルを一切変更せず非ゼロ終了する', async () => {
    const io = makeFileIoSpy();
    const runBuildAndTest = jest.fn(() => ({
      buildOk: true,
      testOk: false,
      buildOutput: '',
      testOutput: 'FAIL tests/example.test.ts',
    }));
    const deps: RunFinalModeDeps = {
      checkResidual: jest.fn(
        async (): Promise<CheckResidualLegacyAssetsResult> => ({ ok: true, residualCount: 0 })
      ),
      runBuildAndTest,
      paths: {
        nextConfigPath: 'unused-next-config.ts',
        storageServicePath: 'unused-storage.ts',
        storagePathLibPath: 'unused-storage-path.ts',
      },
      io,
    };

    const result = await runFinalMode(deps);

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('FAIL tests/example.test.ts');
    expect(io.readFile).not.toHaveBeenCalled();
    expect(io.writeFile).not.toHaveBeenCalled();
  });

  test('残存ゼロ・build/test成功の場合のみ、一時ディレクトリのフィクスチャファイルが正しく変換・書き戻される', async () => {
    const tempDir = makeTempDir('verify-legacy-final-success-');
    try {
      const paths = {
        nextConfigPath: join(tempDir, 'next.config.ts'),
        storageServicePath: join(tempDir, 'storage.ts'),
        storagePathLibPath: join(tempDir, 'storage-path.ts'),
      };
      writeFileSync(paths.nextConfigPath, NEXT_CONFIG_FIXTURE, 'utf-8');
      writeFileSync(paths.storageServicePath, STORAGE_TS_FIXTURE, 'utf-8');
      writeFileSync(paths.storagePathLibPath, STORAGE_PATH_TS_FIXTURE, 'utf-8');

      const runBuildAndTest = jest.fn(() => ({
        buildOk: true,
        testOk: true,
        buildOutput: '',
        testOutput: '',
      }));
      const deps: RunFinalModeDeps = {
        checkResidual: jest.fn(
          async (): Promise<CheckResidualLegacyAssetsResult> => ({ ok: true, residualCount: 0 })
        ),
        runBuildAndTest,
        paths,
        io: makeRealFileIo(),
      };

      const result = await runFinalMode(deps);

      expect(result.exitCode).toBe(0);
      expect(runBuildAndTest).toHaveBeenCalledTimes(1);

      const newNextConfig = readFileSync(paths.nextConfigPath, 'utf-8');
      expect(newNextConfig).not.toContain('firebasestorage.googleapis.com');
      expect(newNextConfig).toContain('api.dicebear.com');

      const newStorageTs = readFileSync(paths.storageServicePath, 'utf-8');
      expect(newStorageTs).toContain('Supabase 以外の外部URL（Dicebearデフォルトアバター等）');

      const newStoragePathTs = readFileSync(paths.storagePathLibPath, 'utf-8');
      expect(newStoragePathTs).toContain('Supabase 以外の外部URL（Dicebearデフォルトアバター等）');

      expect(result.output).toContain(paths.nextConfigPath);
      expect(result.output).toContain(paths.storageServicePath);
      expect(result.output).toContain(paths.storagePathLibPath);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
