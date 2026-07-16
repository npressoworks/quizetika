/**
 * プロフィールアバター画像アップロードのクライアント／サービス共通検証（SEC-08: SVG 禁止）
 */

export const AVATAR_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
] as const;

export type AvatarMimeType = (typeof AVATAR_ALLOWED_MIME_TYPES)[number];

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_ACCEPT =
  '.png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif';

export type AvatarValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateAvatarFile(file: File): AvatarValidationResult {
  if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.type as AvatarMimeType)) {
    return {
      ok: false,
      error: 'PNG, JPEG, GIF ファイルのみアップロード可能です。',
    };
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      error: 'ファイルサイズは 5MB 以下にしてください。',
    };
  }

  return { ok: true };
}

/** Storage アップロード前の共有ガード */
export function assertAvatarFileValid(file: File): void {
  const result = validateAvatarFile(file);
  if (!result.ok) {
    throw new Error(result.error);
  }
}
