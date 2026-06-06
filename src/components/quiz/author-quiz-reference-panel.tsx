'use client';

import React, { useEffect, useState } from 'react';
import { getQuestionsByQuiz } from '@/services/author-quiz-search';
import { useAuthorQuizReferenceSearch } from '@/hooks/useAuthorQuizReferenceSearch';
import {
  quizHasQuestionTextMatch,
  sortQuestionsForKeywordDisplay,
} from '@/lib/question-search-text';
import type { Question } from '@/types';
import { ChevronDown, Link2, Search } from 'lucide-react';

export interface AuthorQuizReferencePanelProps {
  authorId: string;
  onLinkQuestion: (question: Question) => void;
  onUnlinkQuestion: (questionId: string) => void;
  linkedQuestionIds: Set<string>;
}

export function AuthorQuizReferencePanel({
  authorId,
  onLinkQuestion,
  onUnlinkQuestion,
  linkedQuestionIds,
}: AuthorQuizReferencePanelProps) {
  const { keyword, setKeyword, tag, setTag, quizzes, questionsByQuizId, loading, error } =
    useAuthorQuizReferenceSearch(authorId);
  const [expandedQuizIds, setExpandedQuizIds] = useState<Set<string>>(new Set());
  const [questionsByQuiz, setQuestionsByQuiz] = useState<Record<string, Question[]>>({});
  const [loadingQuizId, setLoadingQuizId] = useState<string | null>(null);
  const [linkSuccessMessage, setLinkSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!linkSuccessMessage) return;
    const timer = window.setTimeout(() => setLinkSuccessMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [linkSuccessMessage]);

  useEffect(() => {
    if (loading) return;

    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      setExpandedQuizIds(new Set());
      return;
    }

    const nextExpanded = new Set<string>();
    const nextQuestions: Record<string, Question[]> = {};

    for (const quiz of quizzes) {
      const questions = questionsByQuizId[quiz.id] ?? [];
      if (quizHasQuestionTextMatch(questions, trimmedKeyword)) {
        nextExpanded.add(quiz.id);
        nextQuestions[quiz.id] = questions;
      }
    }

    setExpandedQuizIds(nextExpanded);
    setQuestionsByQuiz((prev) => ({ ...prev, ...nextQuestions }));
  }, [keyword, quizzes, questionsByQuizId, loading]);

  const handleExpandQuiz = async (quizId: string) => {
    setExpandedQuizIds((prev) => {
      const next = new Set(prev);
      if (next.has(quizId)) {
        next.delete(quizId);
      } else {
        next.add(quizId);
      }
      return next;
    });

    if (questionsByQuiz[quizId] || questionsByQuizId[quizId]) {
      const cached = questionsByQuiz[quizId] ?? questionsByQuizId[quizId];
      if (cached) {
        setQuestionsByQuiz((prev) => ({ ...prev, [quizId]: cached }));
      }
      return;
    }

    setLoadingQuizId(quizId);
    try {
      const questions = await getQuestionsByQuiz(quizId);
      setQuestionsByQuiz((prev) => ({ ...prev, [quizId]: questions }));
    } finally {
      setLoadingQuizId(null);
    }
  };

  const getDisplayQuestions = (quizId: string): Question[] => {
    const all = questionsByQuiz[quizId] ?? questionsByQuizId[quizId] ?? [];
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return all;
    if (quizHasQuestionTextMatch(all, trimmedKeyword)) {
      return sortQuestionsForKeywordDisplay(all, trimmedKeyword);
    }
    return all;
  };

  const formatExcerpt = (questionText: string) =>
    questionText.length > 30 ? `${questionText.slice(0, 30)}…` : questionText;

  const handleLink = (question: Question) => {
    if (linkedQuestionIds.has(question.id)) return;
    onLinkQuestion({ ...question, linkKind: 'reference' });
    setLinkSuccessMessage(`設問をリンクしました: ${formatExcerpt(question.questionText)}`);
  };

  const handleUnlink = (question: Question) => {
    if (!linkedQuestionIds.has(question.id)) return;
    onUnlinkQuestion(question.id);
    setLinkSuccessMessage(`リンクを解除しました: ${formatExcerpt(question.questionText)}`);
  };

  return (
    <details
      data-testid="author-quiz-reference-panel"
      style={{
        marginBottom: 24,
        padding: 16,
        border: '1px solid var(--border-light)',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          listStyle: 'none',
        }}
      >
        <Link2 size={18} />
        過去の自作クイズから設問を参照リンク
        <ChevronDown size={16} style={{ marginLeft: 'auto' }} />
      </summary>

      <div style={{ marginTop: 16 }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          自作クイズの設問のみリンクできます。保存時に参照として記録されます。検索はタイトル・説明・問題文・正解テキストが対象です。
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="タイトル・説明・問題文・正解で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            data-testid="reference-search-keyword"
            style={{
              flex: 1,
              minWidth: 160,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
            }}
          />
          <input
            type="text"
            placeholder="タグ"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            data-testid="reference-search-tag"
            style={{
              width: 120,
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
            }}
          />
          <span style={{ display: 'flex', alignItems: 'center', opacity: 0.5 }}>
            <Search size={16} />
          </span>
        </div>

        {linkSuccessMessage && (
          <p
            role="status"
            data-testid="reference-link-success"
            style={{
              color: 'var(--color-primary)',
              fontSize: '0.85rem',
              marginBottom: 8,
            }}
          >
            {linkSuccessMessage}
          </p>
        )}

        {error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}

        {loading ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>読み込み中...</p>
        ) : quizzes.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>該当する自作クイズがありません</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {quizzes.map((quiz) => {
              const isExpanded = expandedQuizIds.has(quiz.id);
              const displayQuestions = isExpanded ? getDisplayQuestions(quiz.id) : [];

              return (
                <li
                  key={quiz.id}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    padding: '8px 0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleExpandQuiz(quiz.id)}
                    data-testid={`reference-quiz-${quiz.id}`}
                    aria-expanded={isExpanded}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: '4px 0',
                    }}
                  >
                    {quiz.title}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                      {quiz.status === 'draft' ? '下書き' : '公開'}
                    </span>
                  </button>
                  {isExpanded && (
                    <div
                      data-testid={`reference-quiz-questions-${quiz.id}`}
                      style={{ marginTop: 8, paddingLeft: 12 }}
                    >
                      {loadingQuizId === quiz.id ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          設問読み込み中...
                        </span>
                      ) : displayQuestions.length === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          該当する設問がありません
                        </span>
                      ) : (
                        displayQuestions.map((q) => (
                          <div
                            key={q.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                              marginBottom: 6,
                            }}
                          >
                            <span style={{ fontSize: '0.85rem' }}>{q.questionText.slice(0, 60)}</span>
                            {linkedQuestionIds.has(q.id) ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                onClick={() => handleUnlink(q)}
                                data-testid={`unlink-reference-${q.id}`}
                              >
                                リンク解除
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                                onClick={() => handleLink(q)}
                                data-testid={`link-reference-${q.id}`}
                              >
                                リンク
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}
