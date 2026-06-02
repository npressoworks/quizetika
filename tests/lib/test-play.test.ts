import {
  TEST_PLAY_PAYLOAD_KEY,
  TEST_PLAY_RESULT_KEY,
  buildTestPlayReturnUrl,
  buildTestPlayPayload,
  consumeTestPlayDraftForEditor,
  getQuizEditorSourcePath,
  saveTestPlayPayload,
} from '@/lib/test-play';

function mockSessionStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(global, 'sessionStorage', { value: storage, writable: true });
  Object.defineProperty(global, 'window', { value: global, writable: true });
  return store;
}

describe('test-play editor restore', () => {
  beforeEach(() => {
    mockSessionStorage().clear();
  });

  it('getQuizEditorSourcePath returns create and edit paths', () => {
    expect(getQuizEditorSourcePath()).toBe('/quiz/create');
    expect(getQuizEditorSourcePath('abc123')).toBe('/quiz/abc123/edit');
  });

  it('buildTestPlayReturnUrl appends restore query', () => {
    expect(buildTestPlayReturnUrl('/quiz/create')).toBe('/quiz/create?fromTestPlay=1');
    expect(buildTestPlayReturnUrl('/quiz/x/edit')).toBe('/quiz/x/edit?fromTestPlay=1');
  });

  it('consumeTestPlayDraftForEditor restores matching draft and clears session', () => {
    const draft = {
      authorId: 'user-1',
      authorName: 'Author',
      authorAvatar: null,
      title: 'Draft title',
      description: 'desc',
      thumbnailUrl: null,
      difficulty: 3,
      genre: 'Tech',
      tags: ['a'],
      originalTags: [],
      questionIds: ['q1'],
      questions: [
        {
          id: 'q1',
          type: 'text-input' as const,
          questionText: 'Question?',
          explanation: '',
          imageUrl: null,
          hint: null,
          limitTime: null,
          correctCount: 0,
          incorrectCount: 0,
          correctTextAnswerList: ['ans'],
        },
      ],
      questionCount: 1,
      status: 'draft' as const,
      format: 'mixed' as const,
      playCount: 0,
      bookmarksCount: 0,
      flagsCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      tempPositiveCount: 0,
      tempNegativeCount: 0,
      reviewScore: null,
      reviewBadge: null,
      isReviewMasked: false,
      activeResetRequestId: null,
      canonicalGenreId: '',
      canonicalTagIds: [],
      leaderboard: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    saveTestPlayPayload(
      buildTestPlayPayload(draft, '/quiz/create', 'user-1')
    );

    const restored = consumeTestPlayDraftForEditor('user-1', '/quiz/create');
    expect(restored?.title).toBe('Draft title');
    expect(restored?.questions[0].questionText).toBe('Question?');
    expect(sessionStorage.getItem(TEST_PLAY_PAYLOAD_KEY)).toBeNull();
    expect(sessionStorage.getItem(TEST_PLAY_RESULT_KEY)).toBeNull();
  });

  it('consumeTestPlayDraftForEditor rejects mismatched sourcePath', () => {
    const draft = {
      authorId: 'user-1',
      authorName: 'Author',
      authorAvatar: null,
      title: 'T',
      description: '',
      thumbnailUrl: null,
      difficulty: 5,
      genre: '',
      tags: [],
      originalTags: [],
      questionIds: [],
      questions: [],
      questionCount: 0,
      status: 'draft' as const,
      format: 'mixed' as const,
      playCount: 0,
      bookmarksCount: 0,
      flagsCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      tempPositiveCount: 0,
      tempNegativeCount: 0,
      reviewScore: null,
      reviewBadge: null,
      isReviewMasked: false,
      activeResetRequestId: null,
      canonicalGenreId: '',
      canonicalTagIds: [],
      leaderboard: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    saveTestPlayPayload(
      buildTestPlayPayload(draft, '/quiz/create', 'user-1')
    );

    expect(consumeTestPlayDraftForEditor('user-1', '/quiz/other/edit')).toBeNull();
    expect(sessionStorage.getItem(TEST_PLAY_PAYLOAD_KEY)).not.toBeNull();
  });
});
