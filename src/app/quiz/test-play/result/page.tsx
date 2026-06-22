'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { CheckOutlined, CloseOutlined, ArrowBackOutlined, RemoveCircleOutlineOutlined } from '@mui/icons-material';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { MarkdownContent } from '@/components/markdown/markdown-content';
import { useAuth } from '@/context/auth-context';
import {
  loadTestPlayPayload,
  loadTestPlayResult,
  prepareQuizForTestPlay,
  buildTestPlayReturnUrl,
  canJudgeQuestion,
  TestPlayResult,
} from '@/lib/test-play';
import { formatCorrectAnswer, formatUserAnswer, getUserAnswerRaw } from '@/services/attempt-answer-display';
import { Quiz } from '@/types';
import { ResultQuestionDetailsAccordion } from '@/components/quiz/result-question-details-accordion';
import { resultClasses as styles } from '@/app/quiz/[id]/result/result-classes';

function TestPlayResultContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [result, setResult] = useState<TestPlayResult | null>(null);
  const [sourcePath, setSourcePath] = useState('/quiz/create');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent('/quiz/test-play/result')}`);
      return;
    }

    const payload = loadTestPlayPayload(user.id);
    const savedResult = loadTestPlayResult();

    if (!payload || !savedResult) {
      router.replace('/quiz/create');
      return;
    }

    setSourcePath(payload.sourcePath);
    setQuiz(prepareQuizForTestPlay(payload.quizDraft));
    setResult(savedResult);
    setLoading(false);
  }, [user, authLoading, router]);

  const handleBackToEditor = () => {
    router.push(buildTestPlayReturnUrl(sourcePath));
  };

  if (authLoading || loading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>結果を読み込み中...</p>
      </div>
    );
  }

  if (!quiz || !result) {
    return (
      <div className={styles.container}>
        <p>テストプレイ結果が見つかりません。</p>
        <button type="button" className="btn btn-primary" onClick={() => router.push('/quiz/create')}>
          作問画面へ
        </button>
      </div>
    );
  }

  const judgedCount = (quiz.questions ?? []).filter((q) => canJudgeQuestion(q)).length;

  return (
    <div className={styles.container}>
      <div
        style={{
          background: 'rgba(127, 0, 255, 0.08)',
          border: '1px solid rgba(127, 0, 255, 0.25)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '0.9rem',
        }}
      >
        🔬 <strong>テストプレイモード</strong>（統計・履歴には記録されません）
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.scoreCircle}>
          <span className={styles.scoreVal}>{result.correctCount}</span>
          <span className={styles.scoreLabel}>/ {result.totalQuestions} 問 正解</span>
        </div>

        <h1 className={styles.resultTitle}>
          {result.correctCount === result.totalQuestions && judgedCount === result.totalQuestions
            ? '🎉 すべて正解！'
            : 'テストプレイ完了'}
        </h1>

        <div className={styles.metaStats}>
          <span>⏱️ 経過秒数: <strong>{result.elapsedSeconds}</strong> 秒</span>
          {judgedCount < result.totalQuestions && (
            <span>
              ⚠️ 判定スキップ: <strong>{result.totalQuestions - judgedCount}</strong> 問
            </span>
          )}
        </div>
      </div>

      <section className={styles.questionsList}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)' }}>
          問題ごとの解説
        </h2>

        {(quiz.questions ?? []).map((q, idx) => {
          const judgeable = canJudgeQuestion(q);
          const isCorrect = judgeable && !result.failedQuestionIds.includes(q.id);
          const hasStoredAnswers = result.questionAnswers.length > 0;

          return (
            <article key={q.id} className={styles.questionItem}>
              <div className={styles.itemHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>第 {idx + 1} 問</h3>
                  {!judgeable ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#ffb703',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      <RemoveCircleOutlineOutlined sx={{ fontSize: 16 }} /> 判定スキップ
                    </span>
                  ) : isCorrect ? (
                    <span className={styles.correctLabel}>
                      <CheckOutlined sx={{ fontSize: 16 }} /> 正解
                    </span>
                  ) : (
                    <span className={styles.incorrectLabel}>
                      <CloseOutlined sx={{ fontSize: 16 }} /> 不正解
                    </span>
                  )}
                </div>
              </div>

              <MarkdownContent
                markdown={q.questionText}
                className={styles.questionTextResult}
              />

              {(judgeable || q.explanation) && (
                <ResultQuestionDetailsAccordion questionId={q.id}>
                  {judgeable && (
                    <div className={styles.answerSummary}>
                      <div className={styles.answerRow}>
                        <span className={styles.answerLabel}>あなたの回答</span>
                        <span
                          className={`${styles.answerValue} ${isCorrect ? styles.answerValueCorrect : styles.answerValueIncorrect}`}
                        >
                          {formatUserAnswer(
                            q,
                            getUserAnswerRaw(result.questionAnswers, q.id),
                            'normal',
                            hasStoredAnswers
                          )}
                        </span>
                      </div>
                      <div className={styles.answerRow}>
                        <span className={styles.answerLabel}>正解</span>
                        <span className={`${styles.answerValue} ${styles.answerValueCorrect}`}>
                          {formatCorrectAnswer(q)}
                        </span>
                      </div>
                    </div>
                  )}

                  {q.explanation && (
                    <div className={styles.explanationBox}>
                      <div className={styles.explanationTitle}>💡 解説</div>
                      <div
                        className={`${styles.explanationText} prose max-w-none dark:prose-invert`}
                        dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(q.explanation) }}
                      />
                    </div>
                  )}
                </ResultQuestionDetailsAccordion>
              )}
            </article>
          );
        })}
      </section>

      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleBackToEditor}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
        >
          <ArrowBackOutlined sx={{ fontSize: 18 }} />
          編集画面に戻る
        </button>
      </div>
    </div>
  );
}

export default function TestPlayResultPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
          <p style={{ color: 'var(--text-muted)' }}>結果を読み込み中...</p>
        </div>
      }
    >
      <TestPlayResultContent />
    </Suspense>
  );
}
