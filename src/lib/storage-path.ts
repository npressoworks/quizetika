export interface BucketAndPath {
  bucket: string;
  objectPath: string;
}

/**
 * バケット名を先頭セグメントに含むパス文字列を、Supabase Storage の bucket/path 分離モデルに解決する
 */
export function resolveBucketAndPath(path: string): BucketAndPath {
  const trimmed = path.replace(/^\/+/, '');
  const slashIndex = trimmed.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(`無効なストレージパスです（バケット/オブジェクトパスを分解できません）: ${path}`);
  }
  return {
    bucket: trimmed.slice(0, slashIndex),
    objectPath: trimmed.slice(slashIndex + 1),
  };
}

const SUPABASE_PUBLIC_URL_PATTERN = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;

/**
 * Supabase Storage の公開URLパターンからバケットとオブジェクトパスを抽出する
 * 一致しない場合（旧 Firebase Storage URL・外部URL等）は null を返す
 */
export function parseSupabasePublicUrl(url: string): BucketAndPath | null {
  const match = url.match(SUPABASE_PUBLIC_URL_PATTERN);
  if (!match) {
    return null;
  }
  return {
    bucket: match[1],
    objectPath: match[2],
  };
}
