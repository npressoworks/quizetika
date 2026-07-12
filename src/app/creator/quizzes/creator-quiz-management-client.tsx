'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
  searchAuthorQuizzes,
  type AuthorQuizSearchResult,
} from '@/services/author-quiz-search';
import { getOpenReportCountsByCreator } from '@/services/review';
import { computeUserEntitlements } from '@/services/entitlement-shared';
import type { CreatorQuizStatus } from '@/lib/creator-quiz-status';
import type { Question, Quiz, QuizVisibility, User } from '@/types';
import type { UserEntitlements } from '@/types/subscription';
import { CreatorQuizManagementSections } from './creator-quiz-management-sections';
import { CreatorQuizVisibilityToggle } from './creator-quiz-visibility-toggle';

export interface CreatorQuizManagementFilters {
  keyword: string;
  status: CreatorQuizStatus | undefined;
  genreId: string | undefined;
  tag: string | undefined;
  sortBy: 'title' | 'playCount' | 'createdAt';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_FILTERS: CreatorQuizManagementFilters = {
  keyword: '',
  status: undefined,
  genreId: undefined,
  tag: undefined,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export interface UseCreatorQuizManagementResult {
  quizzes: Quiz[] | null;
  questionsByQuizId: Record<string, Question[]>;
  quizzesLoading: boolean;
  quizzesError: string | null;
  retryFetchQuizzes: () => void;
  reportCounts: Record<string, number>;
  reportCountsFailed: boolean;
  filters: CreatorQuizManagementFilters;
  setKeyword: (keyword: string) => void;
  setStatus: (status: CreatorQuizStatus | undefined) => void;
  setGenreId: (genreId: string | undefined) => void;
  setTag: (tag: string | undefined) => void;
  setSort: (
    sortBy: CreatorQuizManagementFilters['sortBy'],
    sortOrder: CreatorQuizManagementFilters['sortOrder']
  ) => void;
  clearFilters: () => void;
  entitlements: UserEntitlements;
  /**
   * 公開範囲切り替え成功時に、一覧上の該当クイズの `visibility` のみを
   * ローカル state 上で即時更新する（要件17.5）。全件再フェッチは行わない。
   * 対象クイズが現在の一覧に存在しない場合は何もしない。
   */
  updateQuizVisibility: (quizId: string, nextVisibility: QuizVisibility) => void;
}

/**
 * `/creator/quizzes` 用のデータ取得・状態管理フック。
 *
 * - 作成者の全クイズ（統合ステータス問わず）と未解決指摘件数を並行して取得する。
 * - 一覧取得（`searchAuthorQuizzes`）と指摘件数取得（`getOpenReportCountsByCreator`）は
 *   独立した try/catch で扱い、指摘件数取得のみの失敗が一覧本体の表示をブロックしないようにする。
 * - キーワード・統合ステータス・ジャンル・タグ・並び替え条件はローカル state として管理し、
 *   変更のたびに `searchAuthorQuizzes` を再実行する。
 */
export function useCreatorQuizManagement(
  user: User | null
): UseCreatorQuizManagementResult {
  const [filters, setFilters] = useState<CreatorQuizManagementFilters>(
    DEFAULT_FILTERS
  );

  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null);
  const [questionsByQuizId, setQuestionsByQuizId] = useState<
    Record<string, Question[]>
  >({});
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);

  const [reportCounts, setReportCounts] = useState<Record<string, number>>({});
  const [reportCountsFailed, setReportCountsFailed] = useState(false);

  // 再試行トリガー用のカウンタ（filters 変更時とは別に再取得したい場合の明示的トリガー）
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!user) return;

    const authorId = user.id;
    const cancelledRef = { current: false };

    const loadQuizzes = async () => {
      setQuizzesLoading(true);
      setQuizzesError(null);
      try {
        const result: AuthorQuizSearchResult = await searchAuthorQuizzes({
          authorId,
          includeDrafts: true,
          keyword: filters.keyword || undefined,
          status: filters.status,
          genreId: filters.genreId,
          tag: filters.tag,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        });
        if (cancelledRef.current) return;
        setQuizzes(result.quizzes);
        setQuestionsByQuizId(result.questionsByQuizId);
      } catch (err) {
        console.error('[useCreatorQuizManagement] クイズ一覧の取得に失敗:', err);
        if (!cancelledRef.current) {
          setQuizzesError(
            '作成したクイズの一覧を取得できませんでした。時間をおいて再試行してください。'
          );
        }
      } finally {
        if (!cancelledRef.current) {
          setQuizzesLoading(false);
        }
      }
    };

    const loadReportCounts = async () => {
      try {
        const counts = await getOpenReportCountsByCreator(authorId);
        if (cancelledRef.current) return;
        setReportCounts(counts);
        setReportCountsFailed(false);
      } catch (err) {
        console.error('[useCreatorQuizManagement] 未解決指摘件数の取得に失敗:', err);
        if (!cancelledRef.current) {
          // 一覧本体の表示はブロックせず、指摘件数バッジのみ「取得失敗」を示す
          // 非強調表示にフォールバックするための独立フラグ。
          setReportCounts({});
          setReportCountsFailed(true);
        }
      }
    };

    loadQuizzes();
    loadReportCounts();

    return () => {
      cancelledRef.current = true;
    };
    // filters の内容が変わるたびに再取得する（統合ステータス問わず全件取得が基本、
    // フィルタ指定時はサーバー/クライアント側で絞り込みを適用する）。
  }, [
    user,
    filters.keyword,
    filters.status,
    filters.genreId,
    filters.tag,
    filters.sortBy,
    filters.sortOrder,
    retryToken,
  ]);

  const retryFetchQuizzes = useCallback(() => {
    setRetryToken((prev) => prev + 1);
  }, []);

  const setKeyword = useCallback((keyword: string) => {
    setFilters((prev) => ({ ...prev, keyword }));
  }, []);

  const setStatus = useCallback((status: CreatorQuizStatus | undefined) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  const setGenreId = useCallback((genreId: string | undefined) => {
    setFilters((prev) => ({ ...prev, genreId }));
  }, []);

  const setTag = useCallback((tag: string | undefined) => {
    setFilters((prev) => ({ ...prev, tag }));
  }, []);

  const setSort = useCallback(
    (
      sortBy: CreatorQuizManagementFilters['sortBy'],
      sortOrder: CreatorQuizManagementFilters['sortOrder']
    ) => {
      setFilters((prev) => ({ ...prev, sortBy, sortOrder }));
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({
      ...DEFAULT_FILTERS,
      sortBy: prev.sortBy,
      sortOrder: prev.sortOrder,
    }));
  }, []);

  const entitlements = computeUserEntitlements(user ?? {});

  const updateQuizVisibility = useCallback(
    (quizId: string, nextVisibility: QuizVisibility) => {
      setQuizzes((prev) => {
        if (!prev) return prev;
        const index = prev.findIndex((quiz) => quiz.id === quizId);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = { ...next[index], visibility: nextVisibility };
        return next;
      });
    },
    []
  );

  return {
    quizzes,
    questionsByQuizId,
    quizzesLoading,
    quizzesError,
    retryFetchQuizzes,
    reportCounts,
    reportCountsFailed,
    filters,
    setKeyword,
    setStatus,
    setGenreId,
    setTag,
    setSort,
    clearFilters,
    entitlements,
    updateQuizVisibility,
  };
}

/**
 * `/creator/quizzes` のデータ取得オーケストレーションと画面組み立てを担うクライアントコンポーネント。
 *
 * 未認証ユーザーは復帰クエリ付きでログイン画面へリダイレクトする（要件15.2）。
 * データ取得・状態管理は `useCreatorQuizManagement` が担い、表示専用の一覧・フィルタ UI は
 * `CreatorQuizManagementSections`（タスク14.5）へ委譲する。公開範囲切り替え UI
 * （`CreatorQuizVisibilityToggle`、タスク14.6）は `renderVisibilityToggle` スロット経由で接続し、
 * 切り替え成功時は `updateQuizVisibility` により一覧の該当行のみをローカル state 上で即時更新する
 * （要件17.5・全件再フェッチは行わない）。
 */
export function CreatorQuizManagementClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const management = useCreatorQuizManagement(user);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/creator/quizzes');
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return null;
  }

  if (management.quizzesLoading) {
    return (
      <div data-testid="creator-quiz-management-loading">読み込み中...</div>
    );
  }

  if (management.quizzesError) {
    return (
      <div data-testid="creator-quiz-management-error">
        <p>{management.quizzesError}</p>
        <button
          type="button"
          data-testid="creator-quiz-management-retry"
          onClick={management.retryFetchQuizzes}
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <div data-testid="creator-quiz-management-page">
      <CreatorQuizManagementSections
        quizzes={management.quizzes}
        reportCounts={management.reportCounts}
        reportCountsFailed={management.reportCountsFailed}
        filters={management.filters}
        setKeyword={management.setKeyword}
        setStatus={management.setStatus}
        setGenreId={management.setGenreId}
        setTag={management.setTag}
        setSort={management.setSort}
        clearFilters={management.clearFilters}
        entitlements={management.entitlements}
        renderVisibilityToggle={(quiz) => (
          <CreatorQuizVisibilityToggle
            quiz={quiz}
            entitlements={management.entitlements}
            onVisibilityChange={(quizId, next) =>
              management.updateQuizVisibility(quizId, next)
            }
          />
        )}
      />
    </div>
  );
}
