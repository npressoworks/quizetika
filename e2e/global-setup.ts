import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import initialGenresData from '../src/data/initial_genres.json';
import type { InitialGenreSeed } from '../src/services/tagMerge';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'quizeum-77bc6';

/**
 * E2E 実行前に Firestore Emulator へジャンルマスタを投入する。
 * Admin SDK は Emulator 接続時にサービスアカウント不要。
 */
export default async function globalSetup() {
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199';

  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
  }

  const db = getFirestore();
  const auth = getAuth();

  // AI生成モック用のテスト画像を Firebase Storage エミュレータに配置しておく
  try {
    const { getStorage } = await import('firebase-admin/storage');
    const bucket = getStorage().bucket(`${PROJECT_ID}.appspot.com`);
    await bucket.file('genres/temp/e2e-ai-temp.png').save(Buffer.from('dummy image data'), {
      metadata: { contentType: 'image/png' },
      resumable: false,
    });
  } catch (err) {
    console.error('Storageモック画像の事前配置に失敗しました:', err);
  }

  const genres = initialGenresData as InitialGenreSeed[];
  const now = new Date();

  for (const genre of genres) {
    await db
      .collection('metadata_genres')
      .doc(genre.id)
      .set(
        {
          id: genre.id,
          displayName: genre.displayName,
          description: genre.description ?? '',
          iconImageUrl: genre.iconImageUrl,
          canonicalId: genre.canonicalId,
          mergedGenreIds: genre.mergedGenreIds ?? [],
          isActive: genre.isActive,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
  }

  const email = 'e2e-test-user@example.com';
  const password = 'e2e-test-password-999';
  let e2eUid = 'e2e-test-uid-123456';

  try {
    const userRecord = await auth.getUserByEmail(email);
    e2eUid = userRecord.uid;
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      try {
        const userRecord = await auth.createUser({
          uid: e2eUid,
          email,
          password,
          displayName: 'e2e-test-user',
        });
        e2eUid = userRecord.uid;
      } catch (createErr) {
        console.error('E2E Authユーザー自動作成エラー:', createErr);
      }
    } else {
      console.error('E2E Authユーザー取得エラー:', err);
    }
  }

  await db
    .collection('users')
    .doc(e2eUid)
    .set(
      {
        id: e2eUid,
        email: email,
        displayName: 'e2e-test-user',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${e2eUid}`,
        bio: '',
        followedGenres: [],
        badges: [],
        createdQuizzesCount: 0,
        totalPlayCount: 0,
        followersCount: 0,
        followingCount: 0,
        reputationScore: 0,
        moderationTier: 'senior_moderator',
        role: 'admin',
        reputationHistory: [],
        lastReputationCalculatedAt: null,
        totalFailedQuestionsCount: 0,
        deleteStatus: 'active',
        isBanned: false,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

  // 広告テスト用のダミークイズを25件シード（既存データは事前に削除）
  // 前回のテスト実行でデータが蓄積しないよう e2e-ad-test-quiz-* および e2e-ad-test-q-* を事前削除
  const existingQuizSnap = await db.collection('quizzes')
    .where('authorId', '==', e2eUid)
    .get();
  const deleteQuizPromises = existingQuizSnap.docs.map(doc => doc.ref.delete());
  
  const existingQuestionSnap = await db.collection('questions')
    .where('authorId', '==', e2eUid)
    .get();
  const deleteQuestionPromises = existingQuestionSnap.docs.map(doc => doc.ref.delete());

  await Promise.all([...deleteQuizPromises, ...deleteQuestionPromises]);
  if (deleteQuizPromises.length > 0 || deleteQuestionPromises.length > 0) {
    console.log(`[global-setup] 既存E2Eクイズ（${deleteQuizPromises.length}件）と問題（${deleteQuestionPromises.length}件）を削除しました。`);
  }

  for (let i = 1; i <= 25; i++) {
    const qid = `e2e-ad-test-quiz-${i}`;
    const questionId = `e2e-ad-test-q-${i}`;

    const questionData = {
      id: questionId,
      quizId: qid,
      authorId: e2eUid,
      authorName: 'e2e-test-user',
      authorAvatar: '',
      type: 'multiple-choice',
      questionText: `問題_${i} の本文`,
      explanation: '解説の内容です。',
      imageUrl: null,
      hint: null,
      limitTime: null,
      choices: [
        { id: '1', choiceText: '正解', isCorrect: true, selectedCount: 0 },
        { id: '2', choiceText: '不正解', isCorrect: false, selectedCount: 0 }
      ],
      correctCount: 0,
      incorrectCount: 0
    };

    await db.collection('questions').doc(questionId).set(questionData);

    await db.collection('quizzes').doc(qid).set({
      id: qid,
      authorId: e2eUid,
      authorName: 'e2e-test-user',
      authorAvatar: '',
      title: `[AD_TEST] クイズ_${i}`,
      description: `E2E広告テスト用のダミークイズ ${i} です。`,
      thumbnailUrl: null,
      difficulty: 3,
      genre: 'ノンジャンル・総合',
      canonicalGenreId: 'genre-all',
      tags: ['e2e-ad-test'],
      originalTags: ['e2e-ad-test'],
      canonicalTagIds: ['e2e-ad-test'],
      questionIds: [questionId],
      questions: [questionData],
      questionCount: 1,
      status: 'published',
      visibility: 'public',
      flagsCount: 0,
      playCount: 10 + i,
      bookmarksCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      tempPositiveCount: 0,
      tempNegativeCount: 0,
      reviewScore: null,
      reviewBadge: null,
      isReviewMasked: false,
      activeResetRequestId: null,
      leaderboardFirstPlay: [],
      leaderboardReplay: [],
      format: 'multiple-choice',
      createdAt: now,
      updatedAt: now
    });
  }
}

