/**
 * legacy-storage-migration.ts
 *
 * サーバー専用モジュール（Supabase Admin クライアント依存）。
 * ブラウザコンポーネントから直接インポートしないでください。
 *
 * Firebase Storage 由来の旧URLが残存する DB レコードの棚卸し（LegacyAssetInventory）。
 * `LEGACY_STORAGE_TARGETS`（`@/lib/legacy-storage-targets`）を唯一の情報源として、
 * 対象テーブル/カラムを走査し、`firebasestorage.googleapis.com` を含む値を検出する。
 * 既に Supabase 公開URL形式のレコードは冪等フィルタとして除外する。
 */
import { createAdminClient } from '@/lib/supabase/server';
import { parseSupabasePublicUrl } from '@/lib/storage-path';
import { LEGACY_STORAGE_TARGETS, type LegacyStorageTarget } from '@/lib/legacy-storage-targets';

const FIREBASE_STORAGE_URL_SUBSTRING = 'firebasestorage.googleapis.com';

/**
 * 棚卸しで検出された、Firebase Storage 由来の旧URLを保持する1レコード分の情報
 */
export interface LegacyAssetRecord {
  table: LegacyStorageTarget['table'];
  idColumn: string;
  recordId: string;
  urlColumn: string;
  legacyUrl: string;
  bucket: LegacyStorageTarget['bucket'];
}

/** 対象テーブルへのクエリが失敗した場合のエラー情報 */
export type InventoryError = { kind: 'query_failed'; table: string; message: string };

export type ScanLegacyAssetsResult =
  | { ok: true; records: LegacyAssetRecord[] }
  | { ok: false; error: InventoryError };

/** クエリ結果の1行分を汎用的に扱うための型（`any` を避けるための最小限の形状） */
type LegacyQueryRow = Record<string, unknown>;

/**
 * `LEGACY_STORAGE_TARGETS` の各カラムを走査し、`firebasestorage.googleapis.com` を含む
 * URLを保持するレコードを検出する。既に Supabase 公開URL形式のレコードは除外する（冪等フィルタ）。
 *
 * いずれかのテーブルへのクエリが失敗した場合は、その時点で走査を打ち切りエラーを返す
 * （stop-on-first-error）。
 */
export async function scanLegacyAssets(): Promise<ScanLegacyAssetsResult> {
  const supabase = createAdminClient();
  const records: LegacyAssetRecord[] = [];

  for (const target of LEGACY_STORAGE_TARGETS) {
    const { data, error } = await supabase
      .from(target.table)
      .select(`${target.idColumn}, ${target.urlColumn}`)
      .ilike(target.urlColumn, `%${FIREBASE_STORAGE_URL_SUBSTRING}%`);

    if (error) {
      return {
        ok: false,
        error: { kind: 'query_failed', table: target.table, message: error.message },
      };
    }

    const rows = (data ?? []) as unknown as LegacyQueryRow[];

    for (const row of rows) {
      const legacyUrl = row[target.urlColumn];
      const recordId = row[target.idColumn];

      if (typeof legacyUrl !== 'string' || typeof recordId !== 'string') {
        continue;
      }

      // 冪等フィルタ: 既に Supabase 公開URL形式と判定できるレコードは対象から除外する
      if (parseSupabasePublicUrl(legacyUrl) !== null) {
        continue;
      }

      records.push({
        table: target.table,
        idColumn: target.idColumn,
        recordId,
        urlColumn: target.urlColumn,
        legacyUrl,
        bucket: target.bucket,
      });
    }
  }

  return { ok: true, records };
}

const SAMPLE_READABILITY_MAX_SAMPLE_SIZE = 5;

export type SampleReadabilityResult =
  | { ok: true; readableCount: number; sampleSize: number }
  | { ok: false; sampleSize: number };

/**
 * 棚卸し結果から最大 {@link SAMPLE_READABILITY_MAX_SAMPLE_SIZE} 件（総数がそれ未満の場合は全件）を
 * サンプルとして抽出し、各URLへ匿名 `fetch`（GET）を行い読み取り可能かを検証する。
 *
 * ネットワークエラーおよび非2xxレスポンスは、いずれも当該レコードを「読み取り不可」として扱い、
 * 例外は投げない（1レコードの失敗が全体の判定を止めない）。
 *
 * サンプル中に読み取り可能なレコードが1件も存在しない場合は `ok: false` を返し、
 * 呼び出し側（LegacyMigrationVerificationGate の sample モード）が移行処理の開始を止められるようにする。
 */
export async function checkSampleReadability(
  records: readonly LegacyAssetRecord[]
): Promise<SampleReadabilityResult> {
  const sample = records.slice(0, SAMPLE_READABILITY_MAX_SAMPLE_SIZE);

  const readabilityChecks = await Promise.all(
    sample.map(async (record) => {
      try {
        const response = await fetch(record.legacyUrl);
        return response.ok;
      } catch {
        return false;
      }
    })
  );

  const readableCount = readabilityChecks.filter(Boolean).length;
  const sampleSize = sample.length;

  if (readableCount === 0) {
    return { ok: false, sampleSize };
  }

  return { ok: true, readableCount, sampleSize };
}

/** 残存検証（final モード）で報告する1レコード分の識別情報（テーブル・カラム・ID） */
export interface ResidualLegacyAssetRecord {
  table: LegacyStorageTarget['table'];
  idColumn: string;
  recordId: string;
  urlColumn: string;
}

export type CheckResidualLegacyAssetsResult =
  | { ok: true; residualCount: 0 }
  | {
      ok: false;
      kind: 'residual_found';
      residualCount: number;
      residualRecords: ResidualLegacyAssetRecord[];
    }
  | { ok: false; kind: 'scan_failed'; error: InventoryError };

/**
 * LegacyMigrationVerificationGate の `final` モードにおける残存件数検証。
 *
 * `scanLegacyAssets()` を再実行し、Firebase Storage 由来の旧URLを保持するレコードが
 * 一件も残っていないことを確認する（Requirement 9.1）。
 *
 * 走査自体が失敗した場合（クエリエラー）は `kind: 'scan_failed'` として返し、
 * 「残存あり（`kind: 'residual_found'`）」とは明確に区別する。
 * 残存が検出された場合は、該当レコード（テーブル・カラム・ID）の一覧を結果に含める
 * （Requirement 9.2）。
 */
export async function checkResidualLegacyAssets(): Promise<CheckResidualLegacyAssetsResult> {
  const scanResult = await scanLegacyAssets();

  if (!scanResult.ok) {
    return { ok: false, kind: 'scan_failed', error: scanResult.error };
  }

  if (scanResult.records.length === 0) {
    return { ok: true, residualCount: 0 };
  }

  return {
    ok: false,
    kind: 'residual_found',
    residualCount: scanResult.records.length,
    residualRecords: scanResult.records.map((record) => ({
      table: record.table,
      idColumn: record.idColumn,
      recordId: record.recordId,
      urlColumn: record.urlColumn,
    })),
  };
}

/**
 * 棚卸し結果を対象領域（テーブル.カラム）別に集計する。
 * 例: `{ 'users.avatar_url': 12, 'quizzes.thumbnail_url': 3 }`
 */
export function summarizeByTarget(records: readonly LegacyAssetRecord[]): Record<string, number> {
  const summary: Record<string, number> = {};

  for (const record of records) {
    const key = `${record.table}.${record.urlColumn}`;
    summary[key] = (summary[key] ?? 0) + 1;
  }

  return summary;
}

/** 複製後アップロード時に許可する画像形式（既存アップロード経路と同一の制限。SVG不可） */
const ALLOWED_MIGRATION_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
};

/** `migrateOneRecord` が失敗した段階を示す型付きの理由（例外は投げない） */
export type MigrateOneRecordFailureReason =
  | 'fetch_failed'
  | 'mime_mismatch'
  | 'upload_failed'
  | 'verify_failed';

export type MigrateOneRecordResult =
  | { ok: true; record: LegacyAssetRecord; newUrl: string }
  | {
      ok: false;
      record: LegacyAssetRecord;
      reason: MigrateOneRecordFailureReason;
      detail: string;
    };

/**
 * 1レコード分の「取得→形式検証→複製→公開確認」を順に実行する（Requirement 4.1-4.4）。
 *
 * 複製先は決定的パス `{bucket}/legacy-migrated/{table}-{recordId}-{column}.{ext}`
 * （`research.md` Design Decisions 参照）とし、`upsert: true` で冪等にアップロードする。
 *
 * いずれの段階の失敗も例外を投げず、型付きの失敗理由を持つ結果として返す。
 * DBの更新はここでは行わない（呼び出し側のバッチ処理の責務）。
 */
export async function migrateOneRecord(
  record: LegacyAssetRecord
): Promise<MigrateOneRecordResult> {
  // 1. 旧URLへの匿名HTTP GET
  let response: Response;
  try {
    response = await fetch(record.legacyUrl);
  } catch (error) {
    return {
      ok: false,
      record,
      reason: 'fetch_failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      record,
      reason: 'fetch_failed',
      detail: `HTTP ${response.status}`,
    };
  }

  // 2. 取得結果のMIME形式検証（PNG/JPEG/GIFのみ許可）
  const rawContentType = response.headers.get('content-type') ?? '';
  const contentType = rawContentType.split(';')[0].trim().toLowerCase();
  const extension = ALLOWED_MIGRATION_MIME_TYPES[contentType];

  if (!extension) {
    return {
      ok: false,
      record,
      reason: 'mime_mismatch',
      detail: `許可されていない画像形式です: ${rawContentType || '(不明)'}`,
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // 3. 決定的パスでの Supabase Storage への upsert アップロード
  const objectPath = `legacy-migrated/${record.table}-${record.recordId}-${record.urlColumn}.${extension}`;
  const supabase = createAdminClient();

  const { error: uploadError } = await supabase.storage
    .from(record.bucket)
    .upload(objectPath, buffer, { contentType, upsert: true });

  if (uploadError) {
    return {
      ok: false,
      record,
      reason: 'upload_failed',
      detail: uploadError.message,
    };
  }

  // 4. 新URLへのGETによる公開アクセス確認
  const { data: publicUrlData } = supabase.storage.from(record.bucket).getPublicUrl(objectPath);
  const newUrl = publicUrlData.publicUrl;

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(newUrl);
  } catch (error) {
    return {
      ok: false,
      record,
      reason: 'verify_failed',
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (!verifyResponse.ok) {
    return {
      ok: false,
      record,
      reason: 'verify_failed',
      detail: `HTTP ${verifyResponse.status}`,
    };
  }

  return { ok: true, record, newUrl };
}

/** `runLegacyStorageMigration` が実行モードで記録する失敗理由（`migrateOneRecord` の失敗理由に加え、DB更新自体の失敗を含む） */
export type MigrationFailureReason = MigrateOneRecordFailureReason | 'db_update_failed';

/** 結果レポートに含まれる1件分の失敗情報 */
export interface MigrationFailureEntry {
  record: LegacyAssetRecord;
  reason: MigrationFailureReason;
  detail?: string;
}

/** ドライラン結果に含まれる1件分のプレビュー情報（実際の書き込みは行わない） */
export interface DryRunPreviewEntry {
  record: LegacyAssetRecord;
  plannedNewUrl: string;
}

/** `runLegacyStorageMigration` の集計結果レポート */
export interface MigrationRunReport {
  mode: 'dry-run' | 'execute';
  totalCandidates: number;
  byTable: Record<string, number>;
  succeeded: number;
  failed: number;
  failures: MigrationFailureEntry[];
  /** dry-run（`mode: 'dry-run'`）の場合のみ設定される */
  dryRunPreview?: DryRunPreviewEntry[];
}

export type RunLegacyStorageMigrationResult =
  | ({ ok: true } & MigrationRunReport)
  | { ok: false; kind: 'scan_failed'; error: InventoryError };

/** テーブル別のレコード件数を集計する（`summarizeByTarget` とは異なり、カラム単位ではなくテーブル単位で集計する） */
function countByTable(records: readonly LegacyAssetRecord[]): Record<string, number> {
  const byTable: Record<string, number> = {};

  for (const record of records) {
    byTable[record.table] = (byTable[record.table] ?? 0) + 1;
  }

  return byTable;
}

/**
 * ドライラン用に、実ファイルを取得せず旧URL文字列から拡張子を推測する。
 *
 * ドライランは Storage/DB への書き込みは一切行わない仕様のため、実際にファイルを
 * 取得して Content-Type を確認することはできない（実行モードの `migrateOneRecord` が
 * 唯一の正しい拡張子確定手段）。そのため、旧URL文字列の末尾に許可対象の拡張子
 * （png/jpg/jpeg/gif）が含まれていればそれを「想定される新URL」の表示にのみ使い、
 * 推測できない場合は最も一般的な形式である `png` をプレースホルダとして使用する。
 * この値は表示目的のみであり、実行モードでの実際のアップロード結果には使用しない。
 */
function inferPlannedExtension(legacyUrl: string): string {
  const match = legacyUrl.match(/\.(png|jpe?g|gif)(?:[?#]|$)/i);

  if (!match) {
    return 'png';
  }

  const ext = match[1].toLowerCase();
  return ext === 'jpg' ? 'jpeg' : ext;
}

/**
 * `record.table`/`record.urlColumn` に応じて該当テーブルのURLカラムを新URLへ更新する。
 *
 * Supabase の生成型は `.from(table)` に渡すテーブル名がユニオン型のままだと、`.update()` の
 * 引数を全テーブルの Update 型の積で検証しようとし、動的なカラム名の代入を静的に許可しない
 * （2カラム以上を持ちうる合併リテラル型を computed property key に使った場合も、TSは
 * インデックスシグネチャ型に広げてしまい同様に弾かれる）。
 * そのため `record.table` と `record.urlColumn` の両方を switch でリテラル型まで絞り込み、
 * 各分岐でハードコードされたキー名を持つオブジェクトリテラルを渡すことで、`any` を使わずに
 * 型チェックを通す。`LEGACY_STORAGE_TARGETS` に定義された組み合わせ以外は到達しない
 * （`default` 分岐は防御的にエラーを返す）。
 */
async function updateLegacyUrlColumn(
  supabase: ReturnType<typeof createAdminClient>,
  record: LegacyAssetRecord,
  newUrl: string
): Promise<{ error: { message: string } | null }> {
  switch (record.table) {
    case 'users':
      return supabase
        .from('users')
        .update({ avatar_url: newUrl })
        .eq(record.idColumn, record.recordId);
    case 'quizzes': {
      const client = supabase.from('quizzes');
      if (record.urlColumn === 'thumbnail_url') {
        return client.update({ thumbnail_url: newUrl }).eq(record.idColumn, record.recordId);
      }
      return client.update({ author_avatar: newUrl }).eq(record.idColumn, record.recordId);
    }
    case 'questions': {
      const client = supabase.from('questions');
      if (record.urlColumn === 'image_url') {
        return client.update({ image_url: newUrl }).eq(record.idColumn, record.recordId);
      }
      return client.update({ author_avatar: newUrl }).eq(record.idColumn, record.recordId);
    }
    case 'metadata_genres':
      return supabase
        .from('metadata_genres')
        .update({ icon_image_url: newUrl })
        .eq(record.idColumn, record.recordId);
    case 'genre_requests':
      return supabase
        .from('genre_requests')
        .update({ icon_image_url: newUrl })
        .eq(record.idColumn, record.recordId);
  }
}

/**
 * `scanLegacyAssets()` の結果を入力として、レコードごとに移行（またはドライランプレビュー）を
 * オーケストレーションし、結果レポートを生成する（Requirement 3, 5, 6, 7.2）。
 *
 * - `options.execute === false`（既定・ドライラン）: `migrateOneRecord()` を一切呼び出さず、
 *   Storage/DBへの書き込みも発生しない。対象レコード一覧と想定される新URLのみを返す（Requirement 3.1-3.3）。
 * - `options.execute === true`（実行モード）: レコードごとに `migrateOneRecord()` を呼び出し、
 *   成功したレコードについてのみDBのURLカラムを新URLへ更新する。失敗したレコード（`migrateOneRecord`
 *   の失敗、および更新自体の失敗）はDB値を変更せず、失敗理由を記録して後続レコードの処理を継続する
 *   （Requirement 5.1, 5.2, 6.1）。
 *
 * `scanLegacyAssets()`自体が失敗した場合は「対象0件」として扱わず、`kind: 'scan_failed'` として
 * 明確に区別して伝播する。
 */
export async function runLegacyStorageMigration(options: {
  execute: boolean;
}): Promise<RunLegacyStorageMigrationResult> {
  const scanResult = await scanLegacyAssets();

  if (!scanResult.ok) {
    return { ok: false, kind: 'scan_failed', error: scanResult.error };
  }

  const { records } = scanResult;
  const byTable = countByTable(records);

  if (!options.execute) {
    const supabase = createAdminClient();

    const dryRunPreview: DryRunPreviewEntry[] = records.map((record) => {
      const extension = inferPlannedExtension(record.legacyUrl);
      const objectPath = `legacy-migrated/${record.table}-${record.recordId}-${record.urlColumn}.${extension}`;
      const { data } = supabase.storage.from(record.bucket).getPublicUrl(objectPath);

      return { record, plannedNewUrl: data.publicUrl };
    });

    return {
      ok: true,
      mode: 'dry-run',
      totalCandidates: records.length,
      byTable,
      succeeded: 0,
      failed: 0,
      failures: [],
      dryRunPreview,
    };
  }

  const supabase = createAdminClient();
  const failures: MigrationFailureEntry[] = [];
  let succeeded = 0;

  for (const record of records) {
    const migrationResult = await migrateOneRecord(record);

    if (!migrationResult.ok) {
      failures.push({
        record,
        reason: migrationResult.reason,
        detail: migrationResult.detail,
      });
      continue;
    }

    const { error: updateError } = await updateLegacyUrlColumn(
      supabase,
      record,
      migrationResult.newUrl
    );

    if (updateError) {
      failures.push({
        record,
        reason: 'db_update_failed',
        detail: updateError.message,
      });
      continue;
    }

    succeeded += 1;
  }

  return {
    ok: true,
    mode: 'execute',
    totalCandidates: records.length,
    byTable,
    succeeded,
    failed: failures.length,
    failures,
  };
}
