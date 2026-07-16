/**
 * @jest-environment jsdom
 */

// jsdom は PointerEvent および要素の pointer capture 関連 API を実装していないため、
// base-ui の Select コンポーネントが内部で使用するイベント生成・API 呼び出しに失敗する。
// テスト用に軽量ポリフィルを注入する（tests/components/admin/delete-genre-dialog.test.tsx と同じパターン）。
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error jsdom 環境向けの簡易ポリフィルのため型は緩めに扱う
  window.PointerEvent = PointerEventPolyfill;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.setPointerCapture) {
  window.HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CreatorQuizManagementSections } from '@/app/creator/quizzes/creator-quiz-management-sections';
import type { CreatorQuizManagementFilters } from '@/app/creator/quizzes/creator-quiz-management-client';
import type { Quiz } from '@/types';
import type { UserEntitlements } from '@/types/subscription';

const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: [
      { id: 'genre-1', displayName: 'プログラミング', iconImageUrl: '' },
      { id: 'genre-2', displayName: '歴史', iconImageUrl: '' },
    ],
    loading: false,
    error: null,
    genreLabelById: new Map([
      ['genre-1', 'プログラミング'],
      ['genre-2', '歴史'],
    ]),
    refetch: jest.fn(),
  }),
}));

const DEFAULT_FILTERS: CreatorQuizManagementFilters = {
  keyword: '',
  status: undefined,
  genreId: undefined,
  tag: undefined,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

function makeQuiz(overrides: Partial<Quiz> & { id: string }): Quiz {
  return {
    authorId: 'author-1',
    authorName: '作者',
    authorAvatar: '',
    title: `クイズ ${overrides.id}`,
    description: '',
    thumbnailUrl: null,
    difficulty: 3,
    genre: 'genre-1',
    tags: [],
    originalTags: [],
    questionIds: [],
    questions: [],
    questionCount: 1,
    status: 'published',
    visibility: 'public',
    flagsCount: 0,
    playCount: 10,
    bookmarksCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: null,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: 'genre-1',
    canonicalTagIds: [],
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Quiz;
}

function baseProps(overrides: Partial<React.ComponentProps<typeof CreatorQuizManagementSections>> = {}) {
  return {
    quizzes: [] as Quiz[] | null,
    reportCounts: {} as Record<string, number>,
    reportCountsFailed: false,
    filters: DEFAULT_FILTERS,
    setKeyword: jest.fn(),
    setStatus: jest.fn(),
    setGenreId: jest.fn(),
    setTag: jest.fn(),
    setSort: jest.fn(),
    clearFilters: jest.fn(),
    entitlements: {
      subscriptionTier: 'free',
      subscriptionStatus: null,
      currentPeriodEnd: null,
      hasPaidEntitlements: false,
      hasUnlimitedAiQuestions: false,
    } as UserEntitlements,
    ...overrides,
  };
}

beforeEach(() => {
  mockRouter.push.mockClear();
});

describe('CreatorQuizManagementSections', () => {
  it('5種類の統合ステータスすべてで正しいバッジが表示されること', () => {
    const quizzes: Quiz[] = [
      makeQuiz({ id: 'draft-1', status: 'draft', visibility: undefined }),
      makeQuiz({ id: 'public-1', status: 'published', visibility: 'public' }),
      makeQuiz({ id: 'followers-1', status: 'published', visibility: 'followers' }),
      makeQuiz({ id: 'private-1', status: 'published', visibility: 'private' }),
      makeQuiz({ id: 'suspended-1', status: 'suspended' }),
    ];
    render(<CreatorQuizManagementSections {...baseProps({ quizzes })} />);

    expect(screen.getByTestId('creator-quiz-status-draft')).toBeInTheDocument();
    expect(screen.getByTestId('creator-quiz-status-public')).toBeInTheDocument();
    expect(screen.getByTestId('creator-quiz-status-followers')).toBeInTheDocument();
    expect(screen.getByTestId('creator-quiz-status-private')).toBeInTheDocument();
    expect(screen.getByTestId('creator-quiz-status-suspended')).toBeInTheDocument();
  });

  it('未解決指摘が0件のクイズにはバッジが表示されないこと', () => {
    const quizzes: Quiz[] = [makeQuiz({ id: 'q1' })];
    render(
      <CreatorQuizManagementSections
        {...baseProps({ quizzes, reportCounts: {} })}
      />
    );
    expect(screen.queryByTestId('creator-quiz-report-badge')).not.toBeInTheDocument();
  });

  it('未解決指摘が1件以上のクイズにはバッジが表示されること', () => {
    const quizzes: Quiz[] = [makeQuiz({ id: 'q1' })];
    render(
      <CreatorQuizManagementSections
        {...baseProps({ quizzes, reportCounts: { q1: 3 } })}
      />
    );
    expect(screen.getByTestId('creator-quiz-report-badge')).toBeInTheDocument();
    expect(screen.getByTestId('creator-quiz-report-badge')).toHaveTextContent('3');
  });

  it('指摘件数の取得に失敗した場合、バッジが取得失敗の非強調表示になること', () => {
    const quizzes: Quiz[] = [makeQuiz({ id: 'q1' })];
    render(
      <CreatorQuizManagementSections
        {...baseProps({ quizzes, reportCounts: {}, reportCountsFailed: true })}
      />
    );
    const badge = screen.getByTestId('creator-quiz-report-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('取得失敗');
  });

  it('「編集する」を押すと該当クイズの編集画面へ遷移すること', () => {
    const quizzes: Quiz[] = [makeQuiz({ id: 'q1' })];
    render(<CreatorQuizManagementSections {...baseProps({ quizzes })} />);
    fireEvent.click(screen.getByRole('button', { name: '編集する' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/quiz/q1/edit');
  });

  it('未解決指摘バッジをクリックすると該当クイズの編集画面へ遷移すること', () => {
    const quizzes: Quiz[] = [makeQuiz({ id: 'q1' })];
    render(
      <CreatorQuizManagementSections
        {...baseProps({ quizzes, reportCounts: { q1: 2 } })}
      />
    );
    fireEvent.click(screen.getByTestId('creator-quiz-report-badge'));
    expect(mockRouter.push).toHaveBeenCalledWith('/quiz/q1/edit');
  });

  it('「クイズを新規作成する」導線がクイズ作成画面へ遷移すること', () => {
    render(<CreatorQuizManagementSections {...baseProps({ quizzes: [] })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'クイズを新規作成する' })[0]);
    expect(mockRouter.push).toHaveBeenCalledWith('/quiz/create');
  });

  it('作成したクイズが1件もない場合、真の空状態メッセージと新規作成導線が表示されること', () => {
    render(<CreatorQuizManagementSections {...baseProps({ quizzes: [] })} />);
    expect(screen.getByTestId('creator-quiz-management-empty-no-quizzes')).toBeInTheDocument();
    expect(screen.queryByTestId('creator-quiz-management-empty-filtered')).not.toBeInTheDocument();
  });

  it('絞り込み条件により0件になった場合、条件クリア導線を含む別の空状態が表示され、クリア操作で clearFilters が呼ばれること', () => {
    const clearFilters = jest.fn();
    render(
      <CreatorQuizManagementSections
        {...baseProps({
          quizzes: [],
          filters: { ...DEFAULT_FILTERS, keyword: '存在しないキーワード' },
          clearFilters,
        })}
      />
    );
    expect(screen.getByTestId('creator-quiz-management-empty-filtered')).toBeInTheDocument();
    expect(screen.queryByTestId('creator-quiz-management-empty-no-quizzes')).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('creator-quiz-management-empty-filtered')).getByRole('button', {
        name: '条件をクリア',
      })
    );
    expect(clearFilters).toHaveBeenCalled();
  });

  it('フィルタバーのキーワード入力が setKeyword を呼び出すこと', () => {
    const setKeyword = jest.fn();
    render(
      <CreatorQuizManagementSections
        {...baseProps({ quizzes: [], setKeyword })}
      />
    );
    fireEvent.change(screen.getByTestId('creator-quiz-management-filter-keyword'), {
      target: { value: 'テスト' },
    });
    expect(setKeyword).toHaveBeenCalledWith('テスト');
  });

  it('タグ入力が setTag を呼び出すこと', () => {
    const setTag = jest.fn();
    render(
      <CreatorQuizManagementSections {...baseProps({ quizzes: [], setTag })} />
    );
    fireEvent.click(screen.getByTestId('creator-quiz-management-filter-toggle'));
    fireEvent.change(screen.getByTestId('creator-quiz-management-filter-tag'), {
      target: { value: 'js' },
    });
    expect(setTag).toHaveBeenCalledWith('js');
  });

  it('クリアボタンが clearFilters を呼び出すこと', () => {
    const clearFilters = jest.fn();
    render(
      <CreatorQuizManagementSections
        {...baseProps({ quizzes: [], clearFilters })}
      />
    );
    fireEvent.click(screen.getByTestId('creator-quiz-management-filter-toggle'));
    fireEvent.click(screen.getByTestId('creator-quiz-management-clear-filters'));
    expect(clearFilters).toHaveBeenCalled();
  });

  it('統合ステータスの絞り込みセレクトが setStatus を呼び出すこと', () => {
    const setStatus = jest.fn();
    render(
      <CreatorQuizManagementSections
        {...baseProps({ quizzes: [], setStatus })}
      />
    );
    fireEvent.click(screen.getByTestId('creator-quiz-management-filter-toggle'));
    fireEvent.click(screen.getByTestId('creator-quiz-management-filter-status'));
    fireEvent.keyDown(
      screen.getByTestId('creator-quiz-management-filter-status-option-public'),
      { key: 'Enter' }
    );
    expect(setStatus).toHaveBeenCalledWith('public');
  });

  it('ジャンルカルーセルが useActiveGenres 由来の候補で setGenreId を呼び出すこと', () => {
    const setGenreId = jest.fn();
    render(
      <CreatorQuizManagementSections
        {...baseProps({ quizzes: [], setGenreId })}
      />
    );
    fireEvent.click(screen.getByTestId('creator-quiz-management-filter-toggle'));
    fireEvent.click(screen.getByTestId('genre-carousel-card-genre-1'));
    expect(setGenreId).toHaveBeenCalledWith('genre-1');
  });

  it('並び替えセレクトが setSort を呼び出すこと', () => {
    const setSort = jest.fn();
    render(
      <CreatorQuizManagementSections {...baseProps({ quizzes: [], setSort })} />
    );
    fireEvent.click(screen.getByTestId('creator-quiz-management-filter-toggle'));
    fireEvent.click(screen.getByTestId('creator-quiz-management-sort'));
    fireEvent.keyDown(
      screen.getByTestId('creator-quiz-management-sort-option-playCount-desc'),
      { key: 'Enter' }
    );
    expect(setSort).toHaveBeenCalledWith('playCount', 'desc');
  });

  it('統合ステータス・並び替えセレクトは選択中の値を生の文字列ではなく日本語ラベルで表示し、ジャンルカルーセルは選択中カードが押下状態になること', () => {
    render(
      <CreatorQuizManagementSections
        {...baseProps({
          quizzes: [],
          filters: {
            ...DEFAULT_FILTERS,
            status: 'public',
            genreId: 'genre-1',
            sortBy: 'playCount',
            sortOrder: 'desc',
          },
        })}
      />
    );
    fireEvent.click(screen.getByTestId('creator-quiz-management-filter-toggle'));
    expect(screen.getByTestId('creator-quiz-management-filter-status')).toHaveTextContent('公開');
    expect(screen.getByTestId('creator-quiz-management-filter-status')).not.toHaveTextContent(
      'public'
    );
    expect(screen.getByTestId('genre-carousel-card-genre-1')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('creator-quiz-management-sort')).toHaveTextContent(
      'プレイ回数が多い順'
    );
    expect(screen.getByTestId('creator-quiz-management-sort')).not.toHaveTextContent(
      'playCount-desc'
    );
  });

  it('選択中の絞り込み条件がアクティブフィルタチップとして表示され、個別に解除できること', () => {
    const setStatus = jest.fn();
    render(
      <CreatorQuizManagementSections
        {...baseProps({
          quizzes: [],
          setStatus,
          filters: { ...DEFAULT_FILTERS, status: 'public', keyword: 'テスト' },
        })}
      />
    );
    expect(screen.getByTestId('creator-quiz-management-active-filter-status')).toHaveTextContent(
      '公開'
    );
    expect(screen.getByTestId('creator-quiz-management-active-filter-keyword')).toHaveTextContent(
      'テスト'
    );
    fireEvent.click(
      within(screen.getByTestId('creator-quiz-management-active-filter-status')).getByRole(
        'button'
      )
    );
    expect(setStatus).toHaveBeenCalledWith(undefined);
  });

  it('下書き・凍結ステータスの行には公開範囲切り替えスロットが表示されないこと', () => {
    const quizzes: Quiz[] = [
      makeQuiz({ id: 'draft-1', status: 'draft', visibility: undefined }),
      makeQuiz({ id: 'suspended-1', status: 'suspended' }),
    ];
    render(<CreatorQuizManagementSections {...baseProps({ quizzes })} />);
    expect(
      screen.queryByTestId('creator-quiz-visibility-toggle-slot-draft-1')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('creator-quiz-visibility-toggle-slot-suspended-1')
    ).not.toBeInTheDocument();
  });

  it('公開・限定公開・非公開の行には公開範囲切り替えスロットが表示されること', () => {
    const quizzes: Quiz[] = [
      makeQuiz({ id: 'public-1', status: 'published', visibility: 'public' }),
      makeQuiz({ id: 'followers-1', status: 'published', visibility: 'followers' }),
      makeQuiz({ id: 'private-1', status: 'published', visibility: 'private' }),
    ];
    render(<CreatorQuizManagementSections {...baseProps({ quizzes })} />);
    expect(
      screen.getByTestId('creator-quiz-visibility-toggle-slot-public-1')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('creator-quiz-visibility-toggle-slot-followers-1')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('creator-quiz-visibility-toggle-slot-private-1')
    ).toBeInTheDocument();
  });

  it('一覧領域とフィルタ領域と並び替え領域のtestidが仕様通り付与されること', () => {
    render(<CreatorQuizManagementSections {...baseProps({ quizzes: [makeQuiz({ id: 'q1' })] })} />);
    expect(screen.getByTestId('creator-quiz-management-list')).toBeInTheDocument();
    expect(screen.getByTestId('creator-quiz-management-filters')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('creator-quiz-management-filter-toggle'));
    expect(screen.getByTestId('creator-quiz-management-sort')).toBeInTheDocument();
  });
});
