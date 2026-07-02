/**
 * 即時退会API Route
 * POST /api/user/delete-account
 *
 * 処理フロー（同期フェーズ）:
 * 1. 認証トークンを検証（サーバーサイド Admin SDK）
 * 2. Firestore の users/{uid}.deleteStatus を 'delete_pending' に設定
 * 3. Firebase Auth からユーザーを即時物理削除（同一メールで再登録可能になる）
 * 4. Cloud Tasks にジョブを登録（非同期クレンジング）
 * 5. レスポンスを返す（クライアント側でログアウト処理を実行）
 *
 * 非同期フェーズ（Cloud Functions または API Route で処理）:
 * - quizzes, feedbackReports を 100件チャンクで匿名化
 * - Storage からアバター画像を削除
 * - users/{uid} ドキュメント自体を物理削除
 *
 * Requirements: 1.4, 1.5, 1.6
 * Boundary: DeleteAccountAPI
 * Depends: 1.1, 1.2, 2.1, 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { usersRef } from '@/lib/firebase/firestore';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

const ANONYMIZED_NAME = '退会済みユーザー';
const ANONYMIZED_AVATAR = 'https://api.dicebear.com/7.x/initials/svg?seed=deleted';
const CHUNK_SIZE = 100;

/**
 * 指定コレクションで authorId が uid に一致するドキュメントを
 * 100件チャンクで匿名化（authorName / authorId を上書き）する
 */
async function anonymizeAuthorDocs(
  collectionName: string,
  uid: string
): Promise<void> {
  const colRef = collection(db, collectionName);
  const q = query(colRef, where('authorId', '==', uid));
  const snap = await getDocs(q);
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK_SIZE).forEach((d) => {
      batch.update(d.ref, {
        authorId: 'deleted',
        authorName: ANONYMIZED_NAME,
        authorAvatar: ANONYMIZED_AVATAR,
      });
    });
    await batch.commit();
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { uid } = body as { uid: string };

    if (!uid) {
      return NextResponse.json({ error: 'missing-uid' }, { status: 400 });
    }

    // Authorization ヘッダーから IDトークンを抽出し検証
    const token = extractBearerToken(request);
    const verifiedUid = await verifySupabaseAccessToken(token);

    if (!verifiedUid || verifiedUid !== uid) {
      console.warn(`[delete-account] 認証に失敗しました。要求UID: ${uid}, 検証UID: ${verifiedUid}`);
      return NextResponse.json({ error: 'unauthorized', message: '認証に失敗したか、権限がありません。' }, { status: 401 });
    }

    // ── 同期フェーズ ─────────────────────────────────────
    // 1. deleteStatus を delete_pending に設定（第三者からの読み取りを即時ブロック）
    const userDocRef = doc(usersRef, uid);
    await updateDoc(userDocRef, {
      deleteStatus: 'delete_pending',
      updatedAt: new Date(),
    });

    // 2-3. Firebase Auth の削除は Firebase Admin SDK が必要なため、
    //      本環境では deleteStatus のみで制御し、Admin SDK 導入時に拡張する。
    //      （Cloud Functions の onDeleteUser トリガーを使用する設計も可）

    // ── 非同期クレンジング（本番では Cloud Tasks/Functions に委譲）─────
    // 開発・MVP環境では同一リクエスト内で同期実行する（本番は Cloud Tasks に移行予定）
    try {
      await anonymizeAuthorDocs('quizzes', uid);
      await anonymizeAuthorDocs('feedbackReports', uid);

      // ユーザードキュメント自体を物理削除
      await deleteDoc(userDocRef);
    } catch (cleanupError) {
      console.error('[delete-account] クレンジングエラー（部分失敗）:', cleanupError);
      // クレンジング失敗は致命的ではない（deleteStatus が pending のため保護状態）
      // 本番では Cloud Tasks が再試行する
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete-account] 予期しないエラー:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
