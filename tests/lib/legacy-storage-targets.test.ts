import { LEGACY_STORAGE_TARGETS, type LegacyStorageTarget } from '@/lib/legacy-storage-targets';

describe('LEGACY_STORAGE_TARGETS', () => {
  test('7件のカラム定義を含む', () => {
    expect(LEGACY_STORAGE_TARGETS).toHaveLength(7);
  });

  const expectedEntries: LegacyStorageTarget[] = [
    { table: 'users', idColumn: 'id', urlColumn: 'avatar_url', bucket: 'users' },
    { table: 'quizzes', idColumn: 'id', urlColumn: 'thumbnail_url', bucket: 'quizzes' },
    { table: 'quizzes', idColumn: 'id', urlColumn: 'author_avatar', bucket: 'quizzes' },
    { table: 'questions', idColumn: 'id', urlColumn: 'image_url', bucket: 'quizzes' },
    { table: 'questions', idColumn: 'id', urlColumn: 'author_avatar', bucket: 'quizzes' },
    { table: 'metadata_genres', idColumn: 'id', urlColumn: 'icon_image_url', bucket: 'genres' },
    { table: 'genre_requests', idColumn: 'id', urlColumn: 'icon_image_url', bucket: 'genres' },
  ];

  test.each(expectedEntries)(
    '$table.$urlColumn がバケット $bucket に対応する定義を含む',
    (expected) => {
      const match = LEGACY_STORAGE_TARGETS.find(
        (entry) => entry.table === expected.table && entry.urlColumn === expected.urlColumn
      );
      expect(match).toBeDefined();
      expect(match).toEqual(expected);
    }
  );

  test('bucket は users / quizzes / genres のいずれかのみ', () => {
    const allowedBuckets = new Set(['users', 'quizzes', 'genres']);
    for (const entry of LEGACY_STORAGE_TARGETS) {
      expect(allowedBuckets.has(entry.bucket)).toBe(true);
      expect(entry.bucket).not.toBe('sns-logos');
    }
  });

  test('idColumn は全件 id である', () => {
    for (const entry of LEGACY_STORAGE_TARGETS) {
      expect(entry.idColumn).toBe('id');
    }
  });
});
