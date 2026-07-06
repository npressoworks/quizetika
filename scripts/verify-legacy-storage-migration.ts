/**
 * verify-legacy-storage-migration.ts
 *
 * `supabase-storage-legacy-migration` の薄いCLIラッパー（LegacyMigrationVerificationGate）。
 * 実処理は一切持たず、`src/services/legacy-storage-migration.ts` の
 * `checkSampleReadability()`/`checkResidualLegacyAssets()` を呼び出し、結果を人間可読な形式で
 * 標準出力へ報告する。`final` モードで残存ゼロかつビルド・テスト成功の場合のみ、
 * `src/lib/legacy-fallback-cleanup.ts` の純粋関数を使って対象3ファイルを読み込み・変換・書き戻す。
 *
 * - `sample` モード（Requirement 1.1-1.3）: `scanLegacyAssets()` → `checkSampleReadability()` を実行し、
 *   結果に応じた終了コード（Pass: 0 / Fail: 非ゼロ）で終了する。
 * - `final` モード（Requirement 8.1-8.3, 9.1-9.4）: `checkResidualLegacyAssets()` を実行し、
 *   残存がある場合は残存レコード一覧を出力して非ゼロ終了する（実ファイルは一切変更しない）。
 *   残存ゼロの場合のみ `npm run build`/`npm run test` を実行し、両方成功した場合にのみ
 *   `next.config.ts`・`src/services/storage.ts`・`src/lib/storage-path.ts` を書き換える。
 *
 * 実行:
 *   npm run verify:legacy-storage-migration -- sample
 *   npm run verify:legacy-storage-migration -- final
 */
import { loadEnvConfig } from '@next/env';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  scanLegacyAssets,
  checkSampleReadability,
  checkResidualLegacyAssets,
  type InventoryError,
  type ResidualLegacyAssetRecord,
  type SampleReadabilityResult,
  type CheckResidualLegacyAssetsResult,
} from '@/services/legacy-storage-migration';
import {
  removeFirebaseStorageRemotePattern,
  updateLegacyUrlComment,
} from '@/lib/legacy-fallback-cleanup';

// Next.js の開発サーバーとは別プロセスでこのスクリプトが実行されるため、
// .env.local 等を明示的に読み込む (Next.js 本体と同じ @next/env を使用。
// playwright.config.ts / migrate-legacy-storage.ts と同じパターン)
loadEnvConfig(process.cwd());

export type Mode = 'sample' | 'final';

/** `process.argv.slice(2)` から `sample`/`final` の位置引数を読み取る。それ以外は null。 */
export function parseMode(argv: readonly string[]): Mode | null {
  const arg = argv[0];
  return arg === 'sample' || arg === 'final' ? arg : null;
}

const USAGE = [
  '使い方: npm run verify:legacy-storage-migration -- <sample|final>',
  '  sample: 移行開始前のサンプル読み取り可能性検証',
  '  final : 移行完了後の残存件数検証 + build/testゲート + フォールバックコード撤去',
].join('\n');

/*
 * ============================================================
 * sample モード
 * ============================================================
 */

function formatScanFailure(error: InventoryError): string {
  return [
    '=== 移行対象の棚卸しに失敗しました ===',
    `テーブル: ${error.table}`,
    `理由: ${error.message}`,
    '',
    'RESULT: FAIL (scan_failed)',
  ].join('\n');
}

function formatSampleResult(result: SampleReadabilityResult): string {
  const lines: string[] = ['=== verify-legacy-storage-migration: sample モード ==='];
  lines.push(`サンプル件数: ${result.sampleSize}件`);

  if (result.ok) {
    lines.push(`読み取り可能件数: ${result.readableCount}/${result.sampleSize}件`);
    lines.push('');
    lines.push('RESULT: PASS');
  } else {
    lines.push('読み取り可能件数: 0件（サンプル全滅）');
    lines.push('');
    lines.push('RESULT: FAIL (sample_all_unreadable)');
  }

  return lines.join('\n');
}

export interface RunSampleModeDeps {
  scan: typeof scanLegacyAssets;
  checkSample: typeof checkSampleReadability;
}

const defaultRunSampleModeDeps: RunSampleModeDeps = {
  scan: scanLegacyAssets,
  checkSample: checkSampleReadability,
};

/**
 * `sample` モードの中核ロジック。棚卸し → サンプル読み取り検証を行い、
 * 人間可読な出力と終了コード（Pass: 0 / Fail: 非ゼロ）を返す（Requirement 1.1-1.3）。
 */
export async function runSampleMode(
  deps: RunSampleModeDeps = defaultRunSampleModeDeps
): Promise<{ exitCode: number; output: string }> {
  const scanResult = await deps.scan();

  if (!scanResult.ok) {
    return { exitCode: 1, output: formatScanFailure(scanResult.error) };
  }

  const sampleResult = await deps.checkSample(scanResult.records);

  return {
    exitCode: sampleResult.ok ? 0 : 1,
    output: formatSampleResult(sampleResult),
  };
}

/*
 * ============================================================
 * final モード
 * ============================================================
 */

/** フォールバック撤去対象の3ファイルのパス */
export interface FallbackFilePaths {
  nextConfigPath: string;
  storageServicePath: string;
  storagePathLibPath: string;
}

const DEFAULT_FALLBACK_FILE_PATHS: FallbackFilePaths = {
  nextConfigPath: path.join(process.cwd(), 'next.config.ts'),
  storageServicePath: path.join(process.cwd(), 'src', 'services', 'storage.ts'),
  storagePathLibPath: path.join(process.cwd(), 'src', 'lib', 'storage-path.ts'),
};

/** ファイルI/Oの注入インターフェース（テストでは実ファイルではなく一時ディレクトリに向ける） */
export interface FileIO {
  readFile: (filePath: string) => string;
  writeFile: (filePath: string, content: string) => void;
}

const DEFAULT_FILE_IO: FileIO = {
  readFile: (filePath) => fs.readFileSync(filePath, 'utf-8'),
  writeFile: (filePath, content) => fs.writeFileSync(filePath, content, 'utf-8'),
};

/**
 * 対象3ファイルの内容に `removeFirebaseStorageRemotePattern`/`updateLegacyUrlComment`
 * （`@/lib/legacy-fallback-cleanup`、既に単体テスト済みの純粋関数）を適用し、`changed: true`
 * のファイルのみを書き戻す。ファイルI/Oは `io` 引数経由でのみ行うため、テストでは
 * 一時ディレクトリへのパス + 実 `fs` を渡すことで、実リポジトリファイルに一切触れずに
 * このロジック自体を検証できる（Requirement 8.1, 8.2）。
 */
export function applyFallbackCleanup(
  paths: FallbackFilePaths = DEFAULT_FALLBACK_FILE_PATHS,
  io: FileIO = DEFAULT_FILE_IO
): { changedFiles: string[] } {
  const changedFiles: string[] = [];

  const nextConfigResult = removeFirebaseStorageRemotePattern(io.readFile(paths.nextConfigPath));
  if (nextConfigResult.changed) {
    io.writeFile(paths.nextConfigPath, nextConfigResult.content);
    changedFiles.push(paths.nextConfigPath);
  }

  const storageServiceResult = updateLegacyUrlComment(io.readFile(paths.storageServicePath));
  if (storageServiceResult.changed) {
    io.writeFile(paths.storageServicePath, storageServiceResult.content);
    changedFiles.push(paths.storageServicePath);
  }

  const storagePathLibResult = updateLegacyUrlComment(io.readFile(paths.storagePathLibPath));
  if (storagePathLibResult.changed) {
    io.writeFile(paths.storagePathLibPath, storagePathLibResult.content);
    changedFiles.push(paths.storagePathLibPath);
  }

  return { changedFiles };
}

export interface BuildTestResult {
  buildOk: boolean;
  testOk: boolean;
  buildOutput: string;
  testOutput: string;
}

/** `spawnSync` の呼び出しを差し替え可能にするための最小インターフェース */
export type RunCommand = (command: string, args: string[]) => { status: number | null; output: string };

const defaultRunCommand: RunCommand = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  return { status: result.status, output };
};

/**
 * `npm run build` に続けて `npm run test` をサブプロセスとして実行する。
 * `build` が失敗した場合は `test` を実行しない（Requirement 9.3, 9.4）。
 */
export function runBuildAndTest(runCommand: RunCommand = defaultRunCommand): BuildTestResult {
  const buildResult = runCommand('npm', ['run', 'build']);
  const buildOk = buildResult.status === 0;

  if (!buildOk) {
    return { buildOk: false, testOk: false, buildOutput: buildResult.output, testOutput: '' };
  }

  const testResult = runCommand('npm', ['run', 'test']);
  const testOk = testResult.status === 0;

  return { buildOk, testOk, buildOutput: buildResult.output, testOutput: testResult.output };
}

function formatScanFailedFinal(error: InventoryError): string {
  return [
    '=== 最終検証: 残存件数検証に失敗しました ===',
    `テーブル: ${error.table}`,
    `理由: ${error.message}`,
    '',
    'RESULT: FAIL (scan_failed)',
  ].join('\n');
}

function formatResidualRecord(record: ResidualLegacyAssetRecord): string {
  return `  - ${record.table}.${record.urlColumn} (${record.idColumn}=${record.recordId})`;
}

function formatResidualFound(residualRecords: readonly ResidualLegacyAssetRecord[]): string {
  const lines = [
    '=== 最終検証: 残存する旧URLレコードが検出されました ===',
    `残存件数: ${residualRecords.length}件`,
    '残存レコード一覧:',
  ];
  lines.push(...residualRecords.map(formatResidualRecord));
  lines.push('');
  lines.push('フォールバックコードの撤去、build/testの実行は行いません。');
  lines.push('');
  lines.push('RESULT: FAIL (residual_found)');
  return lines.join('\n');
}

function formatBuildTestFailure(result: BuildTestResult): string {
  const lines = ['=== 最終検証: build/testゲートに失敗しました ==='];
  lines.push(`npm run build: ${result.buildOk ? 'OK' : 'FAILED'}`);
  if (!result.buildOk) {
    lines.push(result.buildOutput);
  } else {
    lines.push(`npm run test: ${result.testOk ? 'OK' : 'FAILED'}`);
    lines.push(result.testOutput);
  }
  lines.push('');
  lines.push('フォールバックコードの撤去は行いません。');
  lines.push('');
  lines.push('RESULT: FAIL (build_test_failed)');
  return lines.join('\n');
}

function formatCleanupSuccess(result: { changedFiles: string[] }): string {
  const lines = [
    '=== 最終検証: 残存ゼロ、build/test成功、フォールバックコードを撤去しました ===',
  ];
  if (result.changedFiles.length === 0) {
    lines.push('変更されたファイルはありません（既に撤去済み、または対象パターンが見つかりませんでした）。');
  } else {
    lines.push('変更されたファイル:');
    lines.push(...result.changedFiles.map((f) => `  - ${f}`));
  }
  lines.push('');
  lines.push('RESULT: PASS');
  return lines.join('\n');
}

export interface RunFinalModeDeps {
  checkResidual: () => Promise<CheckResidualLegacyAssetsResult>;
  runBuildAndTest: () => BuildTestResult;
  paths: FallbackFilePaths;
  io: FileIO;
}

const defaultRunFinalModeDeps: RunFinalModeDeps = {
  checkResidual: checkResidualLegacyAssets,
  runBuildAndTest: () => runBuildAndTest(),
  paths: DEFAULT_FALLBACK_FILE_PATHS,
  io: DEFAULT_FILE_IO,
};

/**
 * `final` モードの中核ロジック（Requirement 8.1-8.3, 9.1-9.4）。
 *
 * - 残存検証自体が失敗（`kind: 'scan_failed'`）した場合、または残存が検出された場合
 *   （`kind: 'residual_found'`）は、`runBuildAndTest`/ファイルI/Oのいずれも一切実行せず
 *   非ゼロ終了する。
 * - 残存ゼロの場合のみ `runBuildAndTest()` を実行し、いずれかが失敗した場合はファイルI/Oを
 *   一切実行せず非ゼロ終了する。
 * - 残存ゼロかつbuild/test成功の場合のみ `applyFallbackCleanup()` を実行し、対象3ファイルを
 *   実際に読み込み・変換・書き戻す。
 */
export async function runFinalMode(
  deps: RunFinalModeDeps = defaultRunFinalModeDeps
): Promise<{ exitCode: number; output: string }> {
  const residualResult = await deps.checkResidual();

  if (!residualResult.ok) {
    if (residualResult.kind === 'scan_failed') {
      return { exitCode: 1, output: formatScanFailedFinal(residualResult.error) };
    }
    return { exitCode: 1, output: formatResidualFound(residualResult.residualRecords) };
  }

  const buildTestResult = deps.runBuildAndTest();

  if (!buildTestResult.buildOk || !buildTestResult.testOk) {
    return { exitCode: 1, output: formatBuildTestFailure(buildTestResult) };
  }

  const cleanupResult = applyFallbackCleanup(deps.paths, deps.io);

  return { exitCode: 0, output: formatCleanupSuccess(cleanupResult) };
}

/*
 * ============================================================
 * エントリポイント
 * ============================================================
 */

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));

  if (!mode) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const result = mode === 'sample' ? await runSampleMode() : await runFinalMode();

  if (result.exitCode === 0) {
    console.log(result.output);
  } else {
    console.error(result.output);
  }
  process.exitCode = result.exitCode;
}

// テストからこのモジュールを `import` した際に `main()` が実行されないよう、
// CLIとして直接実行された場合（`tsx scripts/verify-legacy-storage-migration.ts ...`）のみ起動する
// （`scripts/verify-firebase-removed.js` と同じ `require.main === module` パターン）。
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error('=== verify-legacy-storage-migration: 予期しないエラーが発生しました ===');
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  });
}
