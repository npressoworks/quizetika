import {
  createMergeRequest,
  voteMergeRequest,
  submitGenreRequest,
  voteGenreRequest,
} from '../../src/services/tagMerge';

jest.mock('../../src/lib/supabase/client', () => {
  const mock: any = {
    rpc: jest.fn(),
  };
  return { createClient: () => mock };
});

import { createClient } from '../../src/lib/supabase/client';
const supabase = createClient() as any;

describe('TagMergeService - createMergeRequest', () => {
  const sourceId = 'source-tag';
  const targetId = 'target-tag';
  const userId = 'user-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('マージ提案の起案が正常に完了し、新規リクエストIDを返すこと', async () => {
    supabase.rpc.mockResolvedValue({ data: 'new-request-id', error: null });

    const newRequestId = await createMergeRequest(sourceId, targetId, 'tag', '重複のため', userId);

    expect(newRequestId).toBe('new-request-id');
    expect(supabase.rpc).toHaveBeenCalledWith('handle_create_merge_request', {
      p_target_type: 'tag',
      p_source_id: sourceId,
      p_target_id: targetId,
      p_reason: '重複のため',
    });
  });

  test('同一ID同士のマージは起案時エラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'same-id' } });

    await expect(
      createMergeRequest(sourceId, sourceId, 'tag', '同じタグ', userId)
    ).rejects.toThrow('同一のタグ/ジャンルをマージすることはできません。');
  });

  test('循環参照が発生する場合、起案が拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'circular-merge' } });

    await expect(
      createMergeRequest(sourceId, targetId, 'tag', '循環マージテスト', userId)
    ).rejects.toThrow('循環マージが発生するため、このマージ提案は起案できません。');
  });

  test('同一提案が進行中の場合、一意制約違反として拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });

    await expect(
      createMergeRequest(sourceId, targetId, 'tag', '重複提案', userId)
    ).rejects.toThrow('既に同じマージ提案が進行中です。');
  });

  test('凍結時は起案が拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'governance-frozen' } });

    await expect(
      createMergeRequest(sourceId, targetId, 'tag', '凍結テスト', userId)
    ).rejects.toThrow('コミュニティガバナンスは現在凍結中です。');
  });
});

describe('TagMergeService - voteMergeRequest', () => {
  const requestId = 'request-id';
  const voterId = 'voter-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('投票がRPC経由で正しく送信されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await voteMergeRequest(requestId, voterId, 'approve');

    expect(supabase.rpc).toHaveBeenCalledWith('handle_vote_merge_request', {
      p_request_id: requestId,
      p_opinion: 'approve',
    });
  });

  test('既に投票済みの場合は一意制約違反として拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });

    await expect(voteMergeRequest(requestId, voterId, 'approve')).rejects.toThrow(
      '既にこの提案に投票済みです。'
    );
  });

  test('既に審査終了済みの提案への投票はエラーになること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'already-resolved' } });

    await expect(voteMergeRequest(requestId, voterId, 'approve')).rejects.toThrow(
      'この提案は既に審査が終了しています。'
    );
  });

  test('凍結時は投票が拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'governance-frozen' } });

    await expect(voteMergeRequest(requestId, voterId, 'approve')).rejects.toThrow(
      'コミュニティガバナンスは現在凍結中です。'
    );
  });
});

describe('TagMergeService - submitGenreRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ジャンル新設申請がRPC経由で正しく送信されること', async () => {
    supabase.rpc.mockResolvedValue({ data: 'genre-request-id', error: null });

    const requestId = await submitGenreRequest('retro', 'レトロゲーム', '説明', 'icon-url', 'user-uid');

    expect(requestId).toBe('genre-request-id');
    expect(supabase.rpc).toHaveBeenCalledWith('handle_submit_genre_request', {
      p_genre_id: 'retro',
      p_display_name: 'レトロゲーム',
      p_description: '説明',
      p_icon_image_url: 'icon-url',
    });
  });

  test('凍結時は申請が拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'governance-frozen' } });

    await expect(
      submitGenreRequest('retro', 'レトロゲーム', '説明', 'icon-url', 'user-uid')
    ).rejects.toThrow('コミュニティガバナンスは現在凍結中です。');
  });
});

describe('TagMergeService - voteGenreRequest', () => {
  const requestId = 'req-id';
  const voterId = 'voter-uid';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ジャンル新設投票がRPC経由で正しく送信されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    await voteGenreRequest(requestId, voterId, 'approve');

    expect(supabase.rpc).toHaveBeenCalledWith('handle_vote_genre_request', {
      p_request_id: requestId,
      p_opinion: 'approve',
    });
  });

  test('既に投票済みの場合は一意制約違反として拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });

    await expect(voteGenreRequest(requestId, voterId, 'approve')).rejects.toThrow(
      '既にこの申請に投票済みです。'
    );
  });

  test('凍結時は投票が拒否されること', async () => {
    supabase.rpc.mockResolvedValue({ error: { message: 'governance-frozen' } });

    await expect(voteGenreRequest(requestId, voterId, 'approve')).rejects.toThrow(
      'コミュニティガバナンスは現在凍結中です。'
    );
  });
});
