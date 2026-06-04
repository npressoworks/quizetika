import { getAdminFirestore } from '@/lib/firebase/admin';
import initialGenresData from '../data/initial_genres.json';
import type { InitialGenreSeed, SeedInitialGenresResult } from './tagMerge';

/**
 * Firebase Admin SDK で metadata_genres へ初期ジャンルを投入（Security Rules をバイパス）
 */
export async function seedInitialGenresWithAdmin(): Promise<SeedInitialGenresResult> {
  const db = getAdminFirestore();
  const genres = initialGenresData as InitialGenreSeed[];
  let added = 0;
  let updated = 0;
  const now = new Date();

  for (const genre of genres) {
    const ref = db.collection('metadata_genres').doc(genre.id);
    const snap = await ref.get();

    const payload = {
      id: genre.id,
      displayName: genre.displayName,
      description: genre.description ?? '',
      iconImageUrl: genre.iconImageUrl,
      canonicalId: genre.canonicalId,
      mergedGenreIds: genre.mergedGenreIds ?? [],
      isActive: genre.isActive,
      updatedAt: now,
    };

    if (snap.exists) {
      await ref.update(payload);
      updated += 1;
    } else {
      await ref.set({ ...payload, createdAt: now });
      added += 1;
    }
  }

  return { added, updated };
}
