import { resolveBucketAndPath, parseSupabasePublicUrl } from '@/lib/storage-path';

describe('resolveBucketAndPath', () => {
  it('先頭セグメントをバケットID、残りをオブジェクトパスとして解決する', () => {
    expect(resolveBucketAndPath('quizzes/q1/cover_1.png')).toEqual({
      bucket: 'quizzes',
      objectPath: 'q1/cover_1.png',
    });
  });

  it('先頭スラッシュ付きパスにも対応する', () => {
    expect(resolveBucketAndPath('/sns-logos/youtube.png')).toEqual({
      bucket: 'sns-logos',
      objectPath: 'youtube.png',
    });
  });

  it('ユーザーアバターパスを正しく解決する', () => {
    expect(resolveBucketAndPath('users/uid-123/avatar_999.png')).toEqual({
      bucket: 'users',
      objectPath: 'uid-123/avatar_999.png',
    });
  });

  it('バケットセグメントのみでオブジェクトパスが無い場合は例外を投げる', () => {
    expect(() => resolveBucketAndPath('quizzes')).toThrow();
  });
});

describe('parseSupabasePublicUrl', () => {
  it('Supabase Storage の公開URLパターンからバケットとオブジェクトパスを抽出する', () => {
    const url =
      'https://project.supabase.co/storage/v1/object/public/quizzes/q1/cover_1.png';
    expect(parseSupabasePublicUrl(url)).toEqual({
      bucket: 'quizzes',
      objectPath: 'q1/cover_1.png',
    });
  });

  it('旧 Firebase Storage の URL は null を返す', () => {
    const url =
      'https://firebasestorage.googleapis.com/v0/b/quizetika.appspot.com/o/quizzes%2Fq1%2Fcover.png';
    expect(parseSupabasePublicUrl(url)).toBeNull();
  });

  it('外部アバター等の無関係なURLは null を返す', () => {
    expect(parseSupabasePublicUrl('https://api.dicebear.com/7.x/avatar.svg')).toBeNull();
  });
});
