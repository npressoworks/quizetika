import { getAdminStorage } from '@/lib/firebase/admin';

const DEFAULT_BUCKET =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  process.env.FIREBASE_STORAGE_BUCKET;

function resolveBucketName(): string {
  if (DEFAULT_BUCKET) {
    return DEFAULT_BUCKET.replace(/^gs:\/\//, '');
  }
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId) {
    return `${projectId}.appspot.com`;
  }
  throw new Error('Firebase Storage バケット名が設定されていません');
}

/**
 * クイズカバー画像（PNG）を Admin SDK 経由でアップロードし、公開 URL を返す
 */
export async function uploadQuizCoverBuffer(
  buffer: Buffer,
  options: { quizId?: string; uid: string }
): Promise<string> {
  const bucket = getAdminStorage().bucket(resolveBucketName());
  const timestamp = Date.now();
  const path = options.quizId
    ? `quizzes/${options.quizId}/cover_${timestamp}.png`
    : `quizzes/drafts/${options.uid}/cover_${timestamp}.png`;

  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: { contentType: 'image/png' },
    resumable: false,
  });

  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
