'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EXPLORE_FORMAT_OPTIONS } from '@/lib/explore-formats';
import { hasActiveMyQuizFilters, type MyQuizFilterState } from '@/lib/my-quiz-filter';
import type { MyQuizQuestionCandidate, MyQuizSource } from '@/lib/my-quiz-pool';
import styles from './my-quiz.module.css';

export const MY_QUIZ_TABLE_PAGE_SIZE = 100;

const SOURCE_LABELS: Record<MyQuizSource, string> = {
  own: '自作',
  'bookmarked-quiz': 'BMクイズ',
  'bookmarked-list': 'BMリスト',
  'bookmarked-question': 'BM問題',
};

function excerpt(text: string, maxLen = 72): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

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
    <section className={styles.section} data-testid="my-quiz-filtered-table">
      <div className={styles.tableHeader}>
        <h2 className={styles.sectionTitle}>
          {filtered ? '絞り込み結果' : '問題一覧'}
          {!poolLoading && candidates.length > 0 && (
            <span className={styles.tableCount}>（{candidates.length} 問）</span>
          )}
        </h2>
        {!poolLoading && candidates.length > 0 && (
          <p className={styles.tableRange} data-testid="my-quiz-table-range">
            {rangeStart}–{rangeEnd} 件を表示
          </p>
        )}
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} scope="col">
                #
              </th>
              <th className={styles.th} scope="col">
                問題文
              </th>
              <th className={styles.th} scope="col">
                親クイズ
              </th>
              <th className={styles.th} scope="col">
                取得元
              </th>
              <th className={styles.th} scope="col">
                ジャンル
              </th>
              <th className={styles.th} scope="col">
                形式
              </th>
              <th className={styles.th} scope="col">
                難易度
              </th>
            </tr>
          </thead>
          <tbody>
            {poolLoading ? (
              <tr>
                <td className={styles.tdEmpty} colSpan={7}>
                  —
                </td>
              </tr>
            ) : candidates.length === 0 ? (
              <tr>
                <td className={styles.tdEmpty} colSpan={7}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, index) => (
                <tr key={row.questionId} data-testid={`my-quiz-filtered-row-${row.questionId}`}>
                  <td className={styles.tdNum}>
                    {(safePage - 1) * MY_QUIZ_TABLE_PAGE_SIZE + index + 1}
                  </td>
                  <td className={styles.tdQuestion} title={row.questionText}>
                    {excerpt(row.questionText)}
                  </td>
                  <td className={styles.td}>
                    <Link href={`/quiz/${row.parentQuizId}`} className={styles.quizLink}>
                      {row.parentQuizTitle}
                    </Link>
                  </td>
                  <td className={styles.td}>{SOURCE_LABELS[row.source]}</td>
                  <td className={styles.td}>
                    {genreLabelById.get(row.genreId) ?? row.genreId}
                  </td>
                  <td className={styles.td}>{formatLabel(row.format)}</td>
                  <td className={styles.tdNum}>Lv.{row.difficulty}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!poolLoading && candidates.length > MY_QUIZ_TABLE_PAGE_SIZE && (
        <nav
          className={styles.pagination}
          aria-label="問題一覧のページ送り"
          data-testid="my-quiz-table-pagination"
        >
          <button
            type="button"
            className={styles.pageBtn}
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid="my-quiz-table-prev"
          >
            <ChevronLeft size={18} aria-hidden />
            前へ
          </button>
          <span className={styles.pageStatus} data-testid="my-quiz-table-page-status">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            data-testid="my-quiz-table-next"
          >
            次へ
            <ChevronRight size={18} aria-hidden />
          </button>
        </nav>
      )}
    </section>
  );
}
