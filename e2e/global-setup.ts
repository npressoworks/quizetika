import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID });
  }

  const db = getFirestore();
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

  const e2eUid = 'e2e-test-uid-123456';
  await db
    .collection('users')
    .doc(e2eUid)
    .set(
      {
        id: e2eUid,
        email: 'e2e-test-user@example.com',
        displayName: 'e2e-test-user',
        avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-test-uid-123456',
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
