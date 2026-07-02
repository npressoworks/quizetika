import { createClient } from '../lib/supabase/client';
import { Database } from '../lib/supabase/database.types';
import type { Announcement } from '../types';
export type { Announcement };

const supabase = createClient();

function mapRowToAnnouncement(row: Database['public']['Tables']['announcements']['Row']): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    status: row.status as Announcement['status'],
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    authorId: row.author_id ?? '',
  };
}

export interface PaginatedAnnouncements {
  items: Announcement[];
  lastVisible: any; // ページング用のタイムスタンプまたは id など
}

/**
 * 一般ユーザー向け: 公開済みのお知らせ一覧を降順で取得（ページング対応）
 */
export async function getAnnouncements(
  limitCount?: number,
  startAfterDoc?: any // テスト互換性を考慮して any。作成日時のISO文字列またはドキュメントスナップショット
): Promise<PaginatedAnnouncements> {
  let queryBuilder = supabase
    .from('announcements')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (startAfterDoc) {
    let cursorTime: string;
    if (typeof startAfterDoc === 'object') {
      const data = typeof startAfterDoc.data === 'function' ? startAfterDoc.data() : startAfterDoc;
      const rawPublishedAt = data.publishedAt || data.published_at;
      if (rawPublishedAt instanceof Date) {
        cursorTime = rawPublishedAt.toISOString();
      } else if (typeof rawPublishedAt === 'object' && typeof rawPublishedAt.toDate === 'function') {
        cursorTime = rawPublishedAt.toDate().toISOString();
      } else {
        cursorTime = new Date(rawPublishedAt).toISOString();
      }
    } else {
      cursorTime = new Date(startAfterDoc).toISOString();
    }
    queryBuilder = queryBuilder.lt('published_at', cursorTime);
  }

  if (limitCount && limitCount > 0) {
    queryBuilder = queryBuilder.limit(limitCount);
  }

  const { data, error } = await queryBuilder;

  if (error || !data) {
    return { items: [], lastVisible: null };
  }

  const items = data.map(mapRowToAnnouncement);
  const lastVisible = data.length > 0 ? data[data.length - 1].published_at : null;

  return { items, lastVisible };
}

/**
 * 特定のお知らせをIDで取得
 */
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapRowToAnnouncement(data);
}

/**
 * 管理者向け: すべてのお知らせ（下書き含む）を降順で取得
 */
export async function adminGetAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(mapRowToAnnouncement);
}

/**
 * 新規お知らせを作成
 */
export async function createAnnouncement(
  announcementData: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const publishedAt = announcementData.status === 'published'
    ? (announcementData.publishedAt || now)
    : null;

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title: announcementData.title,
      content: announcementData.content,
      category: announcementData.category,
      status: announcementData.status,
      published_at: publishedAt ? publishedAt.toISOString() : null,
      author_id: announcementData.authorId,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`お知らせの作成に失敗しました: ${error?.message}`);
  }
  return data.id;
}

/**
 * お知らせを更新
 */
export async function updateAnnouncement(
  id: string,
  announcementData: Partial<Announcement>
): Promise<void> {
  const now = new Date();
  const payload: Database['public']['Tables']['announcements']['Update'] = {
    updated_at: now.toISOString(),
  };

  if (announcementData.title !== undefined) payload.title = announcementData.title;
  if (announcementData.content !== undefined) payload.content = announcementData.content;
  if (announcementData.category !== undefined) payload.category = announcementData.category;
  if (announcementData.status !== undefined) {
    payload.status = announcementData.status;
    if (announcementData.status === 'published') {
      payload.published_at = (announcementData.publishedAt || now).toISOString();
    } else if (announcementData.status === 'draft') {
      payload.published_at = null;
    }
  }
  if (announcementData.authorId !== undefined) payload.author_id = announcementData.authorId;

  const { error } = await supabase
    .from('announcements')
    .update(payload)
    .eq('id', id);

  if (error) {
    throw new Error(`お知らせの更新に失敗しました: ${error.message}`);
  }
}

/**
 * お知らせを削除
 */
export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`お知らせの削除に失敗しました: ${error.message}`);
  }
}

/**
 * 未読のお知らせ件数を取得
 * lastReadAt 以降に公開されたお知らせを最大30件取得し、
 * そのうち readIds（既読お知らせIDリスト）に含まれない件数をカウントする。
 */
export async function getUnreadAnnouncementsCount(
  lastReadAt: Date | null,
  readIds: string[]
): Promise<number> {
  if (!lastReadAt) {
    return 0;
  }

  const { data, error } = await supabase
    .from('announcements')
    .select('id')
    .eq('status', 'published')
    .gt('published_at', lastReadAt.toISOString())
    .order('published_at', { ascending: false })
    .limit(30);

  if (error || !data) return 0;

  const items = data.map((d) => d.id);
  const unreadCount = items.filter((id) => !readIds.includes(id)).length;

  return unreadCount;
}
