import { auth } from '@/lib/firebase/config';
import { listUserPlayHistory } from '@/services/attempt';
import type { Attempt, PlayHistoryPage } from '@/types';

export class PlayHistoryApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'PlayHistoryApiError';
  }
}

const LEGACY_PLAY_MODE_LABELS: Partial<Record<Attempt['mode'], string>> = {
  list: 'レガシープレイ',
  'question-list': 'レガシープレイ',
};

const MODE_LABELS: Record<Attempt['mode'], string> = {
  normal: '通常モード',
  exam: '模擬試験',
  flashcard: 'フラッシュカード',
  review: '弱点克服',
  list: 'レガシープレイ',
  'question-list': 'レガシープレイ',
  'my-quiz': 'マイクイズ',
  'test-play': 'テストプレイ',
};

export function getAttemptModeLabel(mode: Attempt['mode']): string {
  return LEGACY_PLAY_MODE_LABELS[mode] ?? MODE_LABELS[mode] ?? mode;
}

export async function fetchPlayHistoryPage(params: {
  cursor?: string | null;
  limit?: number;
}): Promise<PlayHistoryPage> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new PlayHistoryApiError('ログインが必要です', 401);
  }

  try {
    return await listUserPlayHistory({
      uid,
      cursor: params.cursor,
      limit: params.limit,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'プレイ履歴の取得に失敗しました';
    throw new PlayHistoryApiError(message, 500);
  }
}
