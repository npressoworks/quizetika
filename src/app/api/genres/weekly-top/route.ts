import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const revalidate = 1800; // 30分キャッシュ (1800秒)

export interface GenreWeeklyEntry {
  genreId: string;
  playCount: number;
}

export async function GET(): Promise<NextResponse> {
  try {
    const db = getAdminFirestore();

    // 7日前の日付を計算
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 過去7日間の全プレイ完了（attempts）を取得
    const attemptsRef = db.collection('attempts');
    const snapshot = await attemptsRef
      .where('completedAt', '>=', sevenDaysAgo)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ genres: [] });
    }

    // attempts から quizId 別のプレイ数を集計し、同時に一意の quizId セットを作成
    const quizPlayCounts: Record<string, number> = {};
    const quizIdsSet = new Set<string>();

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const quizId = data.quizId;
      if (quizId) {
        quizPlayCounts[quizId] = (quizPlayCounts[quizId] || 0) + 1;
        quizIdsSet.add(quizId);
      }
    });

    const uniqueQuizIds = Array.from(quizIdsSet);

    // 一意の quizId に対応するクイズ情報を並行してロード
    const quizzesRef = db.collection('quizzes');
    const quizDocs = await Promise.all(
      uniqueQuizIds.map((id) => quizzesRef.doc(id).get())
    );

    // クイズIDからジャンルIDへのマッピングを作成 (status === 'published' のみ対象)
    const quizIdToGenre: Record<string, string> = {};
    quizDocs.forEach((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data && data.status === 'published') {
          // canonicalGenreId を優先し、なければ genre を使用する
          const genreId = data.canonicalGenreId || data.genre;
          if (genreId) {
            quizIdToGenre[doc.id] = genreId;
          }
        }
      }
    });

    // ジャンル別の合計プレイ数を集計
    const genrePlayCounts: Record<string, number> = {};
    Object.keys(quizPlayCounts).forEach((quizId) => {
      const genreId = quizIdToGenre[quizId];
      if (genreId) {
        genrePlayCounts[genreId] = (genrePlayCounts[genreId] || 0) + quizPlayCounts[quizId];
      }
    });

    // 集計データを配列化し、プレイ件数降順でソートしてTop5を抽出
    const genresList: GenreWeeklyEntry[] = Object.keys(genrePlayCounts).map((genreId) => ({
      genreId,
      playCount: genrePlayCounts[genreId]!,
    }));

    genresList.sort((a, b) => b.playCount - a.playCount);
    const topGenres = genresList.slice(0, 5);

    return NextResponse.json({ genres: topGenres });
  } catch (error) {
    console.error('[weekly-top-genres] error:', error);
    return NextResponse.json(
      { error: 'internal-error', message: '週間人気ジャンルの集計に失敗しました' },
      { status: 500 }
    );
  }
}
