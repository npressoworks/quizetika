import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { storage } from '../lib/firebase/config';

// 許容するMIMEタイプの定義 (SEC-08 SVG-based XSS防御のためSVG形式を排除)
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif'
];

// 最大ファイルサイズ制限 (2MB)
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

/**
 * 画像ファイルをアップロードする
 * @param file アップロードする画像ファイルオブジェクト
 * @param path Storage内の保存パス
 * @returns アップロード後のダウンロードURL
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  // 1. ファイルサイズチェック (最大2MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('画像サイズは最大2MBまで許容されます。');
  }

  // 2. MIMEタイプチェック
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('無効なファイル形式です。PNG, JPEG, GIF, SVG のみアップロード可能です。');
  }

  // 3. Storage参照の取得とアップロード
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
 * 設問の参考画像の保存パスを取得
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
 * 形式: genres/{genreId}/icon_{timestamp}.svg
 */
export function getGenreIconPath(genreId: string, extension: string = 'svg'): string {
  const timestamp = Date.now();
  return `genres/${genreId}/icon_${timestamp}.${extension}`;
}
