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
