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

  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
  }

  const db = getFirestore();
  const auth = getAuth();
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
}

