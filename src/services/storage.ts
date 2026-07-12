import { createClient } from '@/lib/supabase/client';
import { assertGenreIconFileValid } from '../lib/genre-icon-upload';
import { resolveBucketAndPath, parseSupabasePublicUrl } from '../lib/storage-path';

/**
 * 画像ファイルをアップロードする
 * @param file アップロードする画像ファイルオブジェクト
 * @param path Storage内の保存パス（先頭セグメントがバケットID）
 * @returns アップロード後の公開URL
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  assertGenreIconFileValid(file);

  const { bucket, objectPath } = resolveBucketAndPath(path);
  const supabase = createClient();

  const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
    contentType: file.type,
  });
  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * 指定された公開URLの画像を物理削除する (クレンジング用)
 * @param imageUrl 削除対象画像の公開URL
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  // Supabase Storage の公開URLパターンに一致しない場合（Supabase 以外の外部URL（Dicebearデフォルトアバター等））は何もしない
  const parsed = parseSupabasePublicUrl(imageUrl);
  if (!parsed) {
    return;
  }

  const supabase = createClient();
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.objectPath]);
  if (error) {
    console.error(`Failed to delete storage object: ${imageUrl}`, error);
    throw error;
  }
}

/* ==========================================================================
   アセットパス命名ヘルパー関数
   ========================================================================== */

/**
 * クイズカバー画像の保存パスを取得
 * 形式: quizzes/{quizId}/cover_{timestamp}.png
 */
export function getQuizCoverPath(quizId: string, extension: string = 'png'): string {
  const timestamp = Date.now();
  return `quizzes/${quizId}/cover_${timestamp}.${extension}`;
}

/**
 * 問題の参考画像の保存パスを取得
 * 形式: quizzes/{quizId}/questions/{questionId}_{timestamp}.png
 */
export function getQuestionImagePath(quizId: string, questionId: string, extension: string = 'png'): string {
  const timestamp = Date.now();
  return `quizzes/${quizId}/questions/${questionId}_${timestamp}.${extension}`;
}

/**
 * ユーザーアバター画像の保存パスを取得
 * 形式: users/{uid}/avatar_{timestamp}.png
 */
export function getUserAvatarPath(uid: string, extension: string = 'png'): string {
  const timestamp = Date.now();
  return `users/${uid}/avatar_${timestamp}.${extension}`;
}

/**
 * ジャンルアイコンの保存パスを取得
 * 形式: genres/{genreId}/icon_{timestamp}.png
 */
export function getGenreIconPath(genreId: string, extension: string = 'png'): string {
  const timestamp = Date.now();
  return `genres/${genreId}/icon_${timestamp}.${extension}`;
}

// SNSロゴ公開URLのインメモリキャッシュ
const snsLogoCache: Record<string, string> = {};

/**
 * 指定されたSNSのロゴ画像の公開URLを取得する
 * キャッシュがあれば即時返却し、なければ Supabase Storage から取得してキャッシュする
 */
export async function getSnsLogoUrl(snsName: string): Promise<string> {
  const name = snsName.trim().toLowerCase();
  if (snsLogoCache[name]) {
    return snsLogoCache[name];
  }

  const supabase = createClient();
  const { data } = supabase.storage.from('sns-logos').getPublicUrl(`${name}.png`);
  snsLogoCache[name] = data.publicUrl;
  return data.publicUrl;
}

/**
 * クイズカバー画像を Supabase Storage にアップロードする
 * @param file アップロードする画像データ（File または Blob）
 * @param quizId クイズのドキュメントID
 * @returns アップロード後の公開URL
 */
export async function uploadQuizCover(file: File | Blob, quizId: string): Promise<string> {
  const contentType = file.type || 'image/jpeg';
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif'];
  if (!allowedMimeTypes.includes(contentType)) {
    throw new Error('PNG, JPEG, GIF ファイルのみアップロード可能です。');
  }

  const maxBytes = 10 * 1024 * 1024; // 10MB
  if (file.size > maxBytes) {
    throw new Error('ファイルサイズは 10MB 以下にしてください。');
  }

  const extension = contentType === 'image/jpeg' ? 'jpeg' : contentType === 'image/gif' ? 'gif' : 'png';
  const path = getQuizCoverPath(quizId, extension);
  const { bucket, objectPath } = resolveBucketAndPath(path);

  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
    contentType,
  });
  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}
