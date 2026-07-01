import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { storage } from '../lib/firebase/config';
import { assertGenreIconFileValid } from '../lib/genre-icon-upload';

/**
 * 画像ファイルをアップロードする
 * @param file アップロードする画像ファイルオブジェクト
 * @param path Storage内の保存パス
 * @returns アップロード後のダウンロードURL
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  assertGenreIconFileValid(file);

  // Storage参照の取得とアップロード
  const storageRef = ref(storage, path);
  const metadata = {
    contentType: file.type,
  };

  const snapshot = await uploadBytes(storageRef, file, metadata);
  return await getDownloadURL(snapshot.ref);
}

/**
 * 指定されたダウンロードURLの画像を物理削除する (クレンジング用)
 * @param imageUrl 削除対象画像のダウンロードURL
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  // セキュリティガード: システムのデフォルトアバターや外部API画像 (Dicebear等) は削除をスキップする
  const isStorageUrl = imageUrl.includes('firebasestorage.googleapis.com');
  if (!isStorageUrl) {
    // 外部画像やDicebearアバターの場合は何もしない
    return;
  }

  try {
    // URLから直接Storage参照を取得して削除
    const imageRef = ref(storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error: any) {
    // ファイルが既に存在しない場合 (404) は正常終了とみなす
    if (error.code === 'storage/object-not-found') {
      console.warn(`Storage object not found (already deleted): ${imageUrl}`);
      return;
    }
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

// SNSロゴダウンロードURLのインメモリキャッシュ
const snsLogoCache: Record<string, string> = {};

/**
 * 指定されたSNSのロゴ画像のダウンロードURLを取得する
 * キャッシュがあれば即時返却し、なければ Firebase Storage から取得してキャッシュする
 */
export async function getSnsLogoUrl(snsName: string): Promise<string> {
  const name = snsName.trim().toLowerCase();
  if (snsLogoCache[name]) {
    return snsLogoCache[name];
  }

  const logoPath = `/sns-logos/${name}.png`;
  const logoRef = ref(storage, logoPath);
  const url = await getDownloadURL(logoRef);
  snsLogoCache[name] = url;
  return url;
}

/**
 * クイズカバー画像を Firebase Storage にアップロードする
 * @param file アップロードする画像データ（File または Blob）
 * @param quizId クイズのドキュメントID
 * @returns アップロード後のダウンロードURL
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
  const storageRef = ref(storage, path);
  const metadata = {
    contentType: contentType,
  };

  const snapshot = await uploadBytes(storageRef, file, metadata);
  return await getDownloadURL(snapshot.ref);
}
