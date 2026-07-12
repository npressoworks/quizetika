'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { resolveCreatorQuizStatus, type CreatorQuizStatus } from '@/lib/creator-quiz-status';
import type { Quiz } from '@/types';
import type { UserEntitlements } from '@/types/subscription';
import type { CreatorQuizManagementFilters } from '@/app/creator/quizzes/creator-quiz-management-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  InboxOutlined as InboxIcon,
  EditOutlined as EditIcon,
  AddOutlined as AddIcon,
  ErrorOutlineOutlined as AlertCircleIcon,
} from '@mui/icons-material';

const STATUS_LABELS: Record<CreatorQuizStatus, string> = {
  draft: '下書き',
  public: '公開',
  followers: '限定公開',
  private: '非公開',
  suspended: '審査により非表示',
};

const STATUS_FILTER_OPTIONS: { value: CreatorQuizStatus; label: string }[] = [
  { value: 'draft', label: '下書き' },
  { value: 'public', label: '公開' },
  { value: 'followers', label: '限定公開' },
  { value: 'private', label: '非公開' },
  { value: 'suspended', label: '審査により非表示' },
];

const STATUS_FILTER_ALL = 'all';

const SORT_OPTIONS: {
  value: string;
  sortBy: CreatorQuizManagementFilters['sortBy'];
  sortOrder: CreatorQuizManagementFilters['sortOrder'];
  label: string;
}[] = [
  { value: 'createdAt-desc', sortBy: 'createdAt', sortOrder: 'desc', label: '作成日（新しい順）' },
  { value: 'createdAt-asc', sortBy: 'createdAt', sortOrder: 'asc', label: '作成日（古い順）' },
  { value: 'title-asc', sortBy: 'title', sortOrder: 'asc', label: 'クイズ名（昇順）' },
  { value: 'title-desc', sortBy: 'title', sortOrder: 'desc', label: 'クイズ名（降順）' },
  { value: 'playCount-desc', sortBy: 'playCount', sortOrder: 'desc', label: 'プレイ回数が多い順' },
  { value: 'playCount-asc', sortBy: 'playCount', sortOrder: 'asc', label: 'プレイ回数が少ない順' },
];

function isVisibilityToggleEligible(status: CreatorQuizStatus): boolean {
  return status !== 'draft' && status !== 'suspended';
}

function isAnyFilterActive(filters: CreatorQuizManagementFilters): boolean {
  return (
    filters.keyword.trim() !== '' ||
    filters.status !== undefined ||
    !!filters.genreId ||
    !!filters.tag
  );
}

export interface CreatorQuizManagementSectionsProps {
  quizzes: Quiz[] | null;
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
   * 公開範囲切り替え UI（タスク14.6 `CreatorQuizVisibilityToggle`）を挿入するためのレンダースロット。
   * 未指定時は公開範囲切り替え対象の行に空のプレースホルダー領域のみを表示する。
   */
  renderVisibilityToggle?: (quiz: Quiz, status: CreatorQuizStatus) => React.ReactNode;
}

/**
 * `/creator/quizzes` の一覧・フィルタ・並び替え表示専用コンポーネント群。
 *
 * データ取得・状態管理は `useCreatorQuizManagement`（`creator-quiz-management-client.tsx`）が担当し、
 * 本コンポーネントは props 経由で受け取った値の表示にのみ専念する（サービス層への直接依存を持たない）。
 * ジャンル絞り込みの候補一覧のみ、`useActiveGenres` を自己完結的なデータソースとして内部で呼び出す。
 */
export function CreatorQuizManagementSections({
  quizzes,
  reportCounts,
  reportCountsFailed,
  filters,
  setKeyword,
  setStatus,
  setGenreId,
  setTag,
  setSort,
  clearFilters,
  renderVisibilityToggle,
}: CreatorQuizManagementSectionsProps) {
  const router = useRouter();
  const { genres } = useActiveGenres();

  const goToEdit = (quizId: string) => {
    router.push(`/quiz/${quizId}/edit`);
  };

  const goToCreate = () => {
    router.push('/quiz/create');
  };

  const list = quizzes ?? [];
  const filterActive = isAnyFilterActive(filters);
  const showTrueEmpty = quizzes !== null && list.length === 0 && !filterActive;
  const showFilteredEmpty = quizzes !== null && list.length === 0 && filterActive;

  const currentSortValue = `${filters.sortBy}-${filters.sortOrder}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button type="button" onClick={goToCreate}>
          <AddIcon className="size-4" />
          クイズを新規作成する
        </Button>
      </div>

      <Card data-testid="creator-quiz-management-filters">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">絞り込み・並び替え</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-row flex-wrap items-end gap-4">
            <div className="flex min-w-[200px] flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">キーワード</span>
              <Input
                type="text"
                value={filters.keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="タイトル・説明文を検索"
                data-testid="creator-quiz-management-filter-keyword"
                aria-label="キーワード検索"
              />
            </div>

            <div className="flex min-w-[160px] flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">統合ステータス</span>
              <Select
                value={filters.status ?? STATUS_FILTER_ALL}
                onValueChange={(value) =>
                  setStatus(value === STATUS_FILTER_ALL ? undefined : (value as CreatorQuizStatus))
                }
              >
                <SelectTrigger
                  className="w-full"
                  data-testid="creator-quiz-management-filter-status"
                >
                  <SelectValue>
                    {filters.status
                      ? STATUS_FILTER_OPTIONS.find((option) => option.value === filters.status)
                          ?.label
                      : '未指定'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value={STATUS_FILTER_ALL}
                    data-testid="creator-quiz-management-filter-status-option-all"
                  >
                    未指定
                  </SelectItem>
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      data-testid={`creator-quiz-management-filter-status-option-${option.value}`}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-[160px] flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">ジャンル</span>
              <Select
                value={filters.genreId ?? STATUS_FILTER_ALL}
                onValueChange={(value) =>
                  setGenreId(value === STATUS_FILTER_ALL ? undefined : (value ?? undefined))
                }
              >
                <SelectTrigger
                  className="w-full"
                  data-testid="creator-quiz-management-filter-genre"
                >
                  <SelectValue>
                    {filters.genreId
                      ? genres.find((genre) => genre.id === filters.genreId)?.displayName
                      : '未指定'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value={STATUS_FILTER_ALL}
                    data-testid="creator-quiz-management-filter-genre-option-all"
                  >
                    未指定
                  </SelectItem>
                  {genres.map((genre) => (
                    <SelectItem
                      key={genre.id}
                      value={genre.id}
                      data-testid={`creator-quiz-management-filter-genre-option-${genre.id}`}
                    >
                      {genre.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-[160px] flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">タグ</span>
              <Input
                type="text"
                value={filters.tag ?? ''}
                onChange={(e) => setTag(e.target.value || undefined)}
                placeholder="タグで絞り込み"
                data-testid="creator-quiz-management-filter-tag"
                aria-label="タグで絞り込み"
              />
            </div>

            <div className="flex min-w-[220px] flex-1 flex-col gap-2">
              <span className="text-sm font-semibold text-muted-foreground">並び替え</span>
              <Select
                value={currentSortValue}
                onValueChange={(value) => {
                  const option = SORT_OPTIONS.find((o) => o.value === value);
                  if (!option) return;
                  setSort(option.sortBy, option.sortOrder);
                }}
              >
                <SelectTrigger
                  className="w-full"
                  data-testid="creator-quiz-management-sort"
                >
                  <SelectValue>
                    {SORT_OPTIONS.find((option) => option.value === currentSortValue)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      data-testid={`creator-quiz-management-sort-option-${option.value}`}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              data-testid="creator-quiz-management-clear-filters"
            >
              条件をクリア
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">作成したクイズ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <div data-testid="creator-quiz-management-list" className="divide-y">
            {showTrueEmpty && (
              <div
                data-testid="creator-quiz-management-empty-no-quizzes"
                className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
              >
                <InboxIcon className="size-12 opacity-40" />
                <p>まだクイズを作成していません。最初のクイズを作成してみましょう。</p>
                <Button type="button" onClick={goToCreate}>
                  <AddIcon className="size-4" />
                  クイズを新規作成する
                </Button>
              </div>
            )}

            {showFilteredEmpty && (
              <div
                data-testid="creator-quiz-management-empty-filtered"
                className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground"
              >
                <InboxIcon className="size-12 opacity-40" />
                <p>絞り込み条件に一致するクイズが見つかりませんでした。条件を緩和してお試しください。</p>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  条件をクリア
                </Button>
              </div>
            )}

            {list.map((quiz) => {
              const status = resolveCreatorQuizStatus(quiz);
              const reportCount = reportCounts[quiz.id] ?? 0;
              return (
                <div
                  key={quiz.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  data-testid={`creator-quiz-management-row-${quiz.id}`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {quiz.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={quiz.thumbnailUrl}
                        alt=""
                        className="size-12 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div
                        className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                        data-testid={`creator-quiz-management-thumbnail-placeholder-${quiz.id}`}
                      >
                        <InboxIcon className="size-5 opacity-50" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate font-medium">{quiz.title}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant={status === 'public' ? 'default' : 'secondary'}
                          data-testid={`creator-quiz-status-${status}`}
                        >
                          {STATUS_LABELS[status]}
                        </Badge>
                        <span>プレイ: {quiz.playCount || 0}回</span>
                        {reportCountsFailed ? (
                          <Badge
                            variant="outline"
                            className="cursor-pointer"
                            data-testid="creator-quiz-report-badge"
                            onClick={() => goToEdit(quiz.id)}
                          >
                            <AlertCircleIcon className="size-3" />
                            取得失敗
                          </Badge>
                        ) : (
                          reportCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="cursor-pointer"
                              data-testid="creator-quiz-report-badge"
                              onClick={() => goToEdit(quiz.id)}
                            >
                              <AlertCircleIcon className="size-3" />
                              未解決の指摘 {reportCount}件
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isVisibilityToggleEligible(status) && (
                      <div
                        data-testid={`creator-quiz-visibility-toggle-slot-${quiz.id}`}
                        className="min-w-[140px]"
                      >
                        {renderVisibilityToggle ? renderVisibilityToggle(quiz, status) : null}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => goToEdit(quiz.id)}
                    >
                      <EditIcon className="size-3.5" />
                      編集する
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
