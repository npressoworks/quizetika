const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockMove = jest.fn();

const mockStorageFrom = jest.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
  move: mockMove,
}));

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    storage: {
      from: mockStorageFrom,
    },
  }),
}));

import {
  uploadQuizCoverBuffer,
  uploadTemporaryGenreIconBuffer,
  moveTemporaryGenreIcon,
} from '../../src/services/storage-admin';

describe('uploadQuizCoverBuffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('quizId 指定時は quizzes/{quizId}/ パスへ保存し公開URLを返すこと', async () => {
    const dummyBuffer = Buffer.from('dummy-image-data');
    mockUpload.mockResolvedValue({ data: { path: 'quiz-1/cover_1.png' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/quizzes/quiz-1/cover_1.png' },
    });

    const url = await uploadQuizCoverBuffer(dummyBuffer, { quizId: 'quiz-1', uid: 'user-1' });

    expect(mockStorageFrom).toHaveBeenCalledWith('quizzes');
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^quiz-1\/cover_\d+\.png$/),
      dummyBuffer,
      { contentType: 'image/png', upsert: false }
    );
    expect(url).toBe('https://project.supabase.co/storage/v1/object/public/quizzes/quiz-1/cover_1.png');
  });

  test('quizId 未指定時は quizzes/drafts/{uid}/ パスへ保存すること', async () => {
    const dummyBuffer = Buffer.from('dummy-image-data');
    mockUpload.mockResolvedValue({ data: { path: 'drafts/user-1/cover_1.png' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/quizzes/drafts/user-1/cover_1.png' },
    });

    await uploadQuizCoverBuffer(dummyBuffer, { uid: 'user-1' });

    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^drafts\/user-1\/cover_\d+\.png$/),
      dummyBuffer,
      { contentType: 'image/png', upsert: false }
    );
  });
});

describe('uploadTemporaryGenreIconBuffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('バッファデータを genres/temp パスに保存し、公開URLを返すこと', async () => {
    const dummyBuffer = Buffer.from('dummy-image-data');
    mockUpload.mockResolvedValue({ data: { path: 'temp/user-123_1.png' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/genres/temp/user-123_1.png' },
    });

    const url = await uploadTemporaryGenreIconBuffer(dummyBuffer, 'user-123');

    expect(mockStorageFrom).toHaveBeenCalledWith('genres');
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^temp\/user-123_\d+\.png$/),
      dummyBuffer,
      { contentType: 'image/png', upsert: false }
    );
    expect(url).toBe('https://project.supabase.co/storage/v1/object/public/genres/temp/user-123_1.png');
  });
});

describe('moveTemporaryGenreIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('正常系: temp配下の一時アイコンを genres/{genreId}/ 配下へ移動し公開URLを返すこと', async () => {
    mockMove.mockResolvedValue({ data: {}, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/genres/genre-1/icon_1.png' },
    });

    const tempUrl = 'https://project.supabase.co/storage/v1/object/public/genres/temp/user-123_1.png';
    const url = await moveTemporaryGenreIcon(tempUrl, 'genre-1');

    expect(mockStorageFrom).toHaveBeenCalledWith('genres');
    expect(mockMove).toHaveBeenCalledWith(
      'temp/user-123_1.png',
      expect.stringMatching(/^genre-1\/icon_\d+\.png$/)
    );
    expect(url).toBe('https://project.supabase.co/storage/v1/object/public/genres/genre-1/icon_1.png');
  });

  test('異常系: 移動元URLが genres/temp/ 配下でない場合は例外をスローすること', async () => {
    const invalidUrl = 'https://project.supabase.co/storage/v1/object/public/quizzes/temp/user-123_1.png';

    await expect(moveTemporaryGenreIcon(invalidUrl, 'genre-1')).rejects.toThrow();
    expect(mockMove).not.toHaveBeenCalled();
  });

  test('異常系: Supabase 公開URLパターンに一致しない場合は例外をスローすること', async () => {
    const invalidUrl = 'https://firebasestorage.googleapis.com/v0/b/quizetika.appspot.com/o/genres%2Ftemp%2Fx.png';

    await expect(moveTemporaryGenreIcon(invalidUrl, 'genre-1')).rejects.toThrow();
    expect(mockMove).not.toHaveBeenCalled();
  });
});
