/**
 * migrate-legacy-storage.ts
 *
 * `supabase-storage-legacy-migration` の薄いCLIラッパー（LegacyAssetMigrator）。
 * 実処理は一切持たず、`src/services/legacy-storage-migration.ts` の
 * `runLegacyStorageMigration()` を呼び出し、結果を人間可読な形式で標準出力へ報告する。
 *
 * - 既定（引数なし）: ドライランモード。対象一覧と想定新URLを出力するのみで、
 *   Storage/DBへの書き込みは一切行わない（Requirement 3.1-3.3）。
 * - `--execute` フラグ指定時: 実行モード。成功件数・失敗件数・失敗理由一覧を出力する
 *   （Requirement 6.2）。個別レコードの失敗は正常終了として扱う（Requirement 6.1の
 *   continue-on-failure設計により、部分成功は想定内の結果であるため）。
 *
 * 実行:
 *   npm run migrate:legacy-storage             # ドライラン
 *   npm run migrate:legacy-storage -- --execute # 実行モード
 */
import { loadEnvConfig } from '@next/env';
import {
  runLegacyStorageMigration,
  type DryRunPreviewEntry,
  type InventoryError,
  type MigrationFailureEntry,
  type MigrationRunReport,
  type RunLegacyStorageMigrationResult,
} from '@/services/legacy-storage-migration';

// Next.js の開発サーバーとは別プロセスでこのスクリプトが実行されるため、
// .env.local 等を明示的に読み込む (Next.js 本体と同じ @next/env を使用。
// playwright.config.ts と同じパターン)
loadEnvConfig(process.cwd());

/** `process.argv` に `--execute` フラグが含まれるかどうかのみを見る（値は不要） */
export function parseExecuteFlag(argv: readonly string[]): boolean {
  return argv.includes('--execute');
}

function formatScanFailure(error: InventoryError): string {
  const lines: string[] = [];
  lines.push('=== 移行対象の棚卸しに失敗しました ===');
  lines.push(`テーブル: ${error.table}`);
  lines.push(`理由: ${error.message}`);
  lines.push('');
  lines.push('RESULT: FAIL (scan_failed)');
  return lines.join('\n');
}

function formatByTable(byTable: Record<string, number>): string[] {
  const entries = Object.entries(byTable);
  if (entries.length === 0) {
    return ['  (対象レコードなし)'];
  }
  return entries.map(([table, count]) => `  - ${table}: ${count}件`);
}

function formatDryRunPreviewEntry(entry: DryRunPreviewEntry): string {
  const { record } = entry;
  return [
    `  - ${record.table}.${record.urlColumn} (id=${record.recordId})`,
    `      旧URL: ${record.legacyUrl}`,
    `      想定新URL: ${entry.plannedNewUrl}`,
  ].join('\n');
}

function formatDryRunReport(report: MigrationRunReport): string {
  const lines: string[] = [];
  lines.push('=== migrate-legacy-storage: ドライラン結果 ===');
  lines.push(`対象総件数: ${report.totalCandidates}件`);
  lines.push('対象領域別の内訳:');
  lines.push(...formatByTable(report.byTable));
  lines.push('');

  const preview = report.dryRunPreview ?? [];
  if (preview.length === 0) {
    lines.push('移行対象レコードはありません。');
  } else {
    lines.push('移行対象レコード一覧と想定新URL:');
    for (const entry of preview) {
      lines.push(formatDryRunPreviewEntry(entry));
    }
  }

  lines.push('');
  lines.push('Storage/DBへの書き込みは行われていません（ドライラン）。');
  lines.push('実際に移行するには --execute フラグを指定してください。');
  lines.push('');
  lines.push('RESULT: DRY-RUN COMPLETE');
  return lines.join('\n');
}

function formatFailureEntry(entry: MigrationFailureEntry): string {
  const { record } = entry;
  const detail = entry.detail ? ` (${entry.detail})` : '';
  return `  - ${record.table}.${record.urlColumn} (id=${record.recordId}): ${entry.reason}${detail}`;
}

function formatExecuteReport(report: MigrationRunReport): string {
  const lines: string[] = [];
  lines.push('=== migrate-legacy-storage: 実行結果 ===');
  lines.push(`対象総件数: ${report.totalCandidates}件`);
  lines.push('対象領域別の内訳:');
  lines.push(...formatByTable(report.byTable));
  lines.push('');
  lines.push(`成功: ${report.succeeded}件`);
  lines.push(`失敗: ${report.failed}件`);

  if (report.failures.length > 0) {
    lines.push('失敗レコード一覧:');
    for (const entry of report.failures) {
      lines.push(formatFailureEntry(entry));
    }
  }

  lines.push('');
  lines.push('RESULT: EXECUTE COMPLETE');
  return lines.join('\n');
}

export function formatMigrationReport(result: RunLegacyStorageMigrationResult): string {
  if (!result.ok) {
    return formatScanFailure(result.error);
  }

  return result.mode === 'dry-run' ? formatDryRunReport(result) : formatExecuteReport(result);
}

async function main(): Promise<void> {
  const execute = parseExecuteFlag(process.argv.slice(2));
  const result = await runLegacyStorageMigration({ execute });

  if (!result.ok) {
    console.error(formatMigrationReport(result));
    process.exitCode = 1;
    return;
  }

  console.log(formatMigrationReport(result));
  process.exitCode = 0;
}

main().catch((error: unknown) => {
  console.error('=== migrate-legacy-storage: 予期しないエラーが発生しました ===');
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
