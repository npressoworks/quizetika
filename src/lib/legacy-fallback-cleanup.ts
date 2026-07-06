/**
 * 旧 Firebase Storage 向けフォールバック・迂回コードを撤去するための、
 * ファイルI/Oを一切行わない純粋な文字列変換関数群。
 *
 * 実ファイルの読み込み・書き戻しは呼び出し側
 * （`scripts/verify-legacy-storage-migration.ts`、Requirement 8.3）が
 * 移行完了検証（Requirement 9）通過後にのみ行う。
 */
export interface FallbackCleanupResult {
  changed: boolean;
  content: string;
}

/**
 * `next.config.ts` のソース文字列から、`images.remotePatterns` 配列内の
 * `hostname: 'firebasestorage.googleapis.com'`（シングル/ダブルクォート両対応）
 * を含むパターンオブジェクトエントリを1件削除する。
 *
 * 対象エントリが見つからない場合は `changed: false` を返し、
 * 入力文字列をそのまま返す（冪等・非破壊）。
 */
export function removeFirebaseStorageRemotePattern(
  nextConfigSource: string
): FallbackCleanupResult {
  // remotePatterns 配列内の1オブジェクトエントリ（`{ ... },` または `{ ... }`）のうち
  // hostname が firebasestorage.googleapis.com であるものにマッチする。
  // オブジェクト内にネストした波括弧は現状の対象データに存在しないため、
  // 非貪欲マッチで最も内側の `{...}` ブロックを1件分だけ捉える。
  const entryPattern =
    /[ \t]*\{\s*[^{}]*hostname:\s*(['"])firebasestorage\.googleapis\.com\1[^{}]*\}\s*,?\r?\n/;

  const match = nextConfigSource.match(entryPattern);
  if (!match) {
    return { changed: false, content: nextConfigSource };
  }

  const content = nextConfigSource.slice(0, match.index) +
    nextConfigSource.slice((match.index ?? 0) + match[0].length);

  return { changed: true, content };
}

/**
 * `src/services/storage.ts` / `src/lib/storage-path.ts` のソース文字列から、
 * 旧 Firebase 向けフォールバックを示すコメント／docstring文言を検出し、
 * 「Supabase 以外の外部URL（Dicebearデフォルトアバター等）」という統一表現に置換する。
 *
 * 両ファイルで実際の文言が異なる点に対応する:
 * - `storage.ts`: 「旧 Firebase URL・外部アバター等」（「Storage」を含まない）
 * - `storage-path.ts`: 「旧 Firebase Storage URL・外部URL等」（「Storage」を含む）
 *
 * いずれの異表記も見つからない場合は `changed: false` を返し、
 * 入力文字列をそのまま返す（冪等・非破壊）。周辺のガード節（`if (!parsed) { ... }` 等）の
 * ロジック自体は一切変更しない。
 */
export function updateLegacyUrlComment(sourceCode: string): FallbackCleanupResult {
  const legacyPhrasePattern = /旧 Firebase (?:Storage )?URL・外部(?:アバター|URL)等/;

  if (!legacyPhrasePattern.test(sourceCode)) {
    return { changed: false, content: sourceCode };
  }

  const content = sourceCode.replace(
    legacyPhrasePattern,
    'Supabase 以外の外部URL（Dicebearデフォルトアバター等）'
  );

  return { changed: true, content };
}
