'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeftOutlined, ChevronRightOutlined } from '@mui/icons-material';
import { EXPLORE_FORMAT_OPTIONS } from '@/lib/explore-formats';
import { hasActiveMyQuizFilters, type MyQuizFilterState } from '@/lib/my-quiz-filter';
import type { MyQuizQuestionCandidate, MyQuizSource } from '@/lib/my-quiz-pool';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const MY_QUIZ_TABLE_PAGE_SIZE = 100;

const SOURCE_LABELS: Record<MyQuizSource, string> = {
  own: '自作',
  'bookmarked-quiz': 'BMクイズ',
  'bookmarked-question': 'BM問題',
};

// CSSのline-clampによる表現に変更したため、JavaScriptでのexcerpt関数は廃止しました。

function formatLabel(format: MyQuizQuestionCandidate['format']): string {
  return EXPLORE_FORMAT_OPTIONS.find((o) => o.id === format)?.label ?? format;
}

export interface MyQuizFilteredTableProps {
  filters: MyQuizFilterState;
  candidates: MyQuizQuestionCandidate[];
  genreLabelById: Map<string, string>;
  hasAnySource: boolean;
  poolLoading?: boolean;
}

export function MyQuizFilteredTable({
  filters,
  candidates,
  genreLabelById,
  hasAnySource,
  poolLoading = false,
}: MyQuizFilteredTableProps) {
  const [page, setPage] = useState(1);
  const filtered = hasActiveMyQuizFilters(filters);

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    setPage(1);
  }, [filterKey, candidates.length]);

  const totalPages = Math.max(1, Math.ceil(candidates.length / MY_QUIZ_TABLE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * MY_QUIZ_TABLE_PAGE_SIZE;
    return candidates.slice(start, start + MY_QUIZ_TABLE_PAGE_SIZE);
  }, [candidates, safePage]);

  const rangeStart = candidates.length === 0 ? 0 : (safePage - 1) * MY_QUIZ_TABLE_PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * MY_QUIZ_TABLE_PAGE_SIZE, candidates.length);

  const emptyMessage = !hasAnySource
    ? '取得元を1つ以上選択してください。'
    : filtered
      ? '条件に一致する問題がありません。'
      : '表示できる問題がありません。';

  return (
    <Card data-testid="my-quiz-filtered-table">
      <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 space-y-0">
        <CardTitle>
          {filtered ? '絞り込み結果' : '問題一覧'}
          {!poolLoading && candidates.length > 0 && (
            <span className="ml-2 text-sm font-semibold text-muted-foreground">
              （{candidates.length} 問）
            </span>
          )}
        </CardTitle>
        {!poolLoading && candidates.length > 0 && (
          <p className="text-sm text-muted-foreground" data-testid="my-quiz-table-range">
            {rangeStart}–{rangeEnd} 件を表示
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="max-h-[min(480px,55vh)] overflow-auto rounded-md border">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead className="min-w-[280px]">問題文</TableHead>
                <TableHead className="min-w-[180px]">親クイズ</TableHead>
                <TableHead className="w-24">取得元</TableHead>
                <TableHead className="w-32">ジャンル</TableHead>
                <TableHead className="w-28">形式</TableHead>
                <TableHead className="w-20 text-center">難易度</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {poolLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    —
                  </TableCell>
                </TableRow>
              ) : candidates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row, index) => (
                  <TableRow
                    key={row.questionId}
                    data-testid={`my-quiz-filtered-row-${row.questionId}`}
                  >
                    <TableCell className="w-12 text-center text-muted-foreground">
                      {(safePage - 1) * MY_QUIZ_TABLE_PAGE_SIZE + index + 1}
                    </TableCell>
                    <TableCell className="min-w-[280px] max-w-[400px] whitespace-normal break-words" title={row.questionText}>
                      <span className="line-clamp-3 block text-sm leading-relaxed">{row.questionText}</span>
                    </TableCell>
                    <TableCell className="min-w-[180px] max-w-[240px] break-words" title={row.parentQuizTitle}>
                      <Link
                        href={`/quiz/${row.parentQuizId}`}
                        className="line-clamp-2 block font-semibold text-primary hover:underline leading-relaxed"
                      >
                        {row.parentQuizTitle}
                      </Link>
                    </TableCell>
                    <TableCell className="w-24">{SOURCE_LABELS[row.source]}</TableCell>
                    <TableCell className="w-32">{genreLabelById.get(row.genreId) ?? row.genreId}</TableCell>
                    <TableCell className="w-28">{formatLabel(row.format)}</TableCell>
                    <TableCell className="w-20 text-center">🔥{row.difficulty}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!poolLoading && candidates.length > MY_QUIZ_TABLE_PAGE_SIZE && (
          <nav
            className="flex items-center justify-center gap-4"
            aria-label="問題一覧のページ送り"
            data-testid="my-quiz-table-pagination"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="my-quiz-table-prev"
            >
              <ChevronLeftOutlined sx={{ fontSize: 18 }} aria-hidden />
              前へ
            </Button>
            <span
              className="min-w-[72px] text-center text-sm font-bold text-muted-foreground"
              data-testid="my-quiz-table-page-status"
            >
              {safePage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="my-quiz-table-next"
            >
              次へ
              <ChevronRightOutlined sx={{ fontSize: 18 }} aria-hidden />
            </Button>
          </nav>
        )}
      </CardContent>
    </Card>
  );
}
