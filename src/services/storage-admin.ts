import { createAdminClient } from '@/lib/supabase/server';
import { resolveBucketAndPath, parseSupabasePublicUrl } from '@/lib/storage-path';

/**
 * クイズカバー画像（PNG）を Service Role Key 経由でアップロードし、公開 URL を返す
 */
export async function uploadQuizCoverBuffer(
  buffer: Buffer,
  options: { quizId?: string; uid: string }
): Promise<string> {
  const timestamp = Date.now();
  const path = options.quizId
    ? `quizzes/${options.quizId}/cover_${timestamp}.png`
    : `quizzes/drafts/${options.uid}/cover_${timestamp}.png`;

  const { bucket, objectPath } = resolveBucketAndPath(path);
  const supabase = createAdminClient();

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: 'image/png',
    upsert: false,
  });
  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * AI生成されたジャンルアイコン画像（一時保存用）を Supabase Storage に保存し、公開 URL を返す
 */
export async function uploadTemporaryGenreIconBuffer(
  buffer: Buffer,
  uid: string
): Promise<string> {
  const timestamp = Date.now();
  const filename = `${uid}_${timestamp}.png`;
  const path = `genres/temp/${filename}`;

  const { bucket, objectPath } = resolveBucketAndPath(path);
  const supabase = createAdminClient();

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: 'image/png',
    upsert: false,
  });
  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * ジャンルアイコンの一時保存先（genres/temp/...）から本パス（genres/{genreId}/...）へ移動し、公開URLを返す
 */
export async function moveTemporaryGenreIcon(tempUrl: string, genreId: string): Promise<string> {
  const parsed = parseSupabasePublicUrl(tempUrl);
  if (!parsed || parsed.bucket !== 'genres' || !parsed.objectPath.startsWith('temp/')) {
    throw new Error('無効な一時アイコンURLです');
  }

  const extension = parsed.objectPath.includes('.') ? parsed.objectPath.split('.').pop() : 'png';
  const timestamp = Date.now();
  const destPath = `${genreId}/icon_${timestamp}.${extension}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from('genres').move(parsed.objectPath, destPath);
  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from('genres').getPublicUrl(destPath);
  return data.publicUrl;
}
