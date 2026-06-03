import { auth } from '@/lib/firebase/config';
import { listUserPlayedQuizIds } from '@/services/attempt';

/**
 * ログイン中ユーザーのプレイ済みクイズ ID 一覧（Firestore クライアント + セキュリティルール）
 */
export async function fetchPlayedQuizIds(): Promise<string[]> {
  const user = auth.currentUser;
  if (!user) {
    return [];
  }

  return listUserPlayedQuizIds(user.uid);
}
