/**
 * Firebase Storage 由来の旧URLを保持する可能性がある対象テーブル/カラムの静的定義。
 * `LegacyAssetInventory` はこの配列を唯一の情報源として棚卸し対象を決定する。
 * 対象カラムを追加する場合はこの配列に手動で追加する（自動検出は行わない）。
 */
export interface LegacyStorageTarget {
  /** 対象の Postgres テーブル名 */
  table: 'users' | 'quizzes' | 'questions' | 'metadata_genres' | 'genre_requests';
  /** 主キーカラム名（全対象テーブルで 'id'） */
  idColumn: string;
  /** 旧URLを保持しているカラム名 */
  urlColumn: string;
  /** 複製先の Supabase Storage バケット名 */
  bucket: 'users' | 'quizzes' | 'genres';
}

export const LEGACY_STORAGE_TARGETS: readonly LegacyStorageTarget[] = [
  { table: 'users', idColumn: 'id', urlColumn: 'avatar_url', bucket: 'users' },
  { table: 'quizzes', idColumn: 'id', urlColumn: 'thumbnail_url', bucket: 'quizzes' },
  { table: 'quizzes', idColumn: 'id', urlColumn: 'author_avatar', bucket: 'quizzes' },
  { table: 'questions', idColumn: 'id', urlColumn: 'image_url', bucket: 'quizzes' },
  { table: 'questions', idColumn: 'id', urlColumn: 'author_avatar', bucket: 'quizzes' },
  { table: 'metadata_genres', idColumn: 'id', urlColumn: 'icon_image_url', bucket: 'genres' },
  { table: 'genre_requests', idColumn: 'id', urlColumn: 'icon_image_url', bucket: 'genres' },
];
