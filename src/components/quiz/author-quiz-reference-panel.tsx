'use client';

import React, { useState } from 'react';
import { getQuestionsByQuiz } from '@/services/author-quiz-search';
import { useAuthorQuizReferenceSearch } from '@/hooks/useAuthorQuizReferenceSearch';
import type { Question } from '@/types';
import { ChevronDown, Link2, Search } from 'lucide-react';

export interface AuthorQuizReferencePanelProps {
  authorId: string;
  onLinkQuestion: (question: Question) => void;
  linkedQuestionIds: Set<string>;
}

export function AuthorQuizReferencePanel({
  authorId,
  onLinkQuestion,
  linkedQuestionIds,
}: AuthorQuizReferencePanelProps) {
  const { keyword, setKeyword, tag, setTag, quizzes, loading, error } =
    useAuthorQuizReferenceSearch(authorId);
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
  const [questionsByQuiz, setQuestionsByQuiz] = useState<Record<string, Question[]>>({});
  const [loadingQuizId, setLoadingQuizId] = useState<string | null>(null);

  const handleExpandQuiz = async (quizId: string) => {
    if (expandedQuizId === quizId) {
      setExpandedQuizId(null);
      return;
    }
    setExpandedQuizId(quizId);
    if (questionsByQuiz[quizId]) return;

    setLoadingQuizId(quizId);
    try {
      const questions = await getQuestionsByQuiz(quizId);
      setQuestionsByQuiz((prev) => ({ ...prev, [quizId]: questions }));
    } finally {
      setLoadingQuizId(null);
    }
  };

  const handleLink = (question: Question) => {
    if (linkedQuestionIds.has(question.id)) return;
    onLinkQuestion({ ...question, linkKind: 'reference' });
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
          自作クイズの設問のみリンクできます。保存時に参照として記録されます。
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="クイズタイトル・説明で検索"
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
            {quizzes.map((quiz) => (
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
                {expandedQuizId === quiz.id && (
                  <div style={{ marginTop: 8, paddingLeft: 12 }}>
                    {loadingQuizId === quiz.id ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>設問読み込み中...</span>
                    ) : (
                      (questionsByQuiz[quiz.id] ?? []).map((q) => (
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
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                            disabled={linkedQuestionIds.has(q.id)}
                            onClick={() => handleLink(q)}
                            data-testid={`link-reference-${q.id}`}
                          >
                            リンク
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
