import { createAdminClient } from '@/lib/supabase/server';
import initialGenresData from '../data/initial_genres.json';

/** `initial_genres.json` の1件分 */
export interface InitialGenreSeed {
  id: string;
  displayName: string;
  description?: string;
  iconImageUrl: string | null;
  canonicalId: string | null;
  mergedGenreIds: string[];
  isActive: boolean;
}

export interface SeedInitialGenresResult {
  added: number;
  updated: number;
}

/**
 * Supabase Admin クライアント（サービスロール、RLSバイパス）で metadata_genres へ初期ジャンルを冪等に投入する
 */
export async function seedInitialGenresWithAdmin(): Promise<SeedInitialGenresResult> {
  const supabase = createAdminClient();
  const genres = initialGenresData as InitialGenreSeed[];
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const genre of genres) {
    const { data: existing } = await supabase
      .from('metadata_genres')
      .select('id')
      .eq('id', genre.id)
      .maybeSingle();

    const payload = {
      id: genre.id,
      display_name: genre.displayName,
      description: genre.description ?? '',
      icon_image_url: genre.iconImageUrl,
      canonical_id: genre.canonicalId,
      merged_genre_ids: genre.mergedGenreIds ?? [],
      is_active: genre.isActive,
      updated_at: now,
    };

    if (existing) {
      const { error } = await supabase.from('metadata_genres').update(payload).eq('id', genre.id);
      if (error) {
        throw new Error(`ジャンル「${genre.id}」の更新に失敗しました: ${error.message}`);
      }
      updated += 1;
    } else {
      const { error } = await supabase
        .from('metadata_genres')
        .insert({ ...payload, created_at: now });
      if (error) {
        throw new Error(`ジャンル「${genre.id}」の新規作成に失敗しました: ${error.message}`);
      }
      added += 1;
    }
  }

  return { added, updated };
}
