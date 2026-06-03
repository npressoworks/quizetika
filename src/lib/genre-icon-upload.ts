/**
 * ジャンルアイコンアップロードのクライアント／サービス共通検証（SEC-08: SVG 禁止）
 */

export const GENRE_ICON_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
] as const;

export type GenreIconMimeType = (typeof GENRE_ICON_ALLOWED_MIME_TYPES)[number];

export const GENRE_ICON_MAX_BYTES = 2 * 1024 * 1024;

export const GENRE_ICON_ACCEPT =
  '.png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif';

export type GenreIconValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateGenreIconFile(file: File): GenreIconValidationResult {
  if (
    !GENRE_ICON_ALLOWED_MIME_TYPES.includes(file.type as GenreIconMimeType)
  ) {
    return {
      ok: false,
      error: 'PNG, JPEG, GIF ファイルのみアップロード可能です。',
    };
  }

  if (file.size > GENRE_ICON_MAX_BYTES) {
    return {
      ok: false,
      error: 'ファイルサイズは 2MB 以下にしてください。',
    };
  }

  return { ok: true };
}

/** Storage アップロード前の共有ガード */
export function assertGenreIconFileValid(file: File): void {
  const result = validateGenreIconFile(file);
  if (!result.ok) {
    throw new Error(result.error);
  }
}
