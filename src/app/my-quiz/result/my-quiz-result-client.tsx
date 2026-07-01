'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckOutlined,
  CloseOutlined,
  WarningAmberOutlined,
  CheckCircleOutlined,
  SmsOutlined,
} from '@mui/icons-material';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { MarkdownContent } from '@/components/markdown/markdown-content';
import { useAuth } from '@/context/auth-context';
import { getQuestion } from '@/services/question';
import { formatCorrectAnswer, formatUserAnswer, getUserAnswerRaw } from '@/services/attempt-answer-display';
import { Question, QuestionAnswerDetail, FeedbackReport } from '@/types';
import { isBookmarked } from '@/services/bookmark';
import { QuestionBookmarkToggle } from '@/components/bookmark/question-bookmark-toggle';
import { ResultQuestionDetailsAccordion } from '@/components/quiz/result-question-details-accordion';
import { ResultSkeleton } from '@/components/quiz/result-skeleton';
import { resultClasses as styles } from '../../quiz/[id]/result/result-classes';
import { submitFeedbackReport, getOpenReportsForQuiz, updateFeedbackReport } from '@/services/review';

interface MyQuizPlayResultData {
  score: number;
  totalQuestions: number;
  elapsedSeconds: number;
  details: QuestionAnswerDetail[];
}

export function MyQuizResultClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [result, setResult] = useState<MyQuizPlayResultData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [bookmarkedQuestionIds, setBookmarkedQuestionIds] = useState<Set<string>>(new Set());
  const [openReports, setOpenReports] = useState<FeedbackReport[]>([]);

  // 一括開閉用
  const [allOpen, setAllOpen] = useState<boolean>(false);

  // 指摘モーダル関連
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState<'typo' | 'fact' | 'alternative'>('typo');
  const [feedbackContent, setFeedbackContent] = useState<string>('');
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  // 1. 結果データのロード
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('quizetika_my_quiz_result');
    if (!raw) {
      setError('結果データが見つかりません。プレイをやり直してください。');
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as MyQuizPlayResultData;
      setResult(parsed);
    } catch (e) {
      setError('結果データの読み込みに失敗しました。');
      setLoading(false);
    }
  }, []);

  // 2. 問題データのフェッチとブックマーク状態・指摘レポートのロード
  useEffect(() => {
    if (!result) return;

    async function loadQuestionsData() {
      setLoading(true);
      try {
        const list = await Promise.all(
          result.details.map(async (detail) => {
            const q = await getQuestion(detail.questionId);
            return q;
          })
        );
        const validQuestions = list.filter((q): q is Question => q !== null);
        setQuestions(validQuestions);

        // ブックマーク状態の確認
        if (user) {
          const bookmarkedIds: string[] = [];
          await Promise.all(
            validQuestions.map(async (q) => {
              const bookmarked = await isBookmarked(user.id, q.id);
              if (bookmarked) bookmarkedIds.push(q.id);
            })
          );
          setBookmarkedQuestionIds(new Set(bookmarkedIds));

          // 指摘レポートの確認 (各親クイズIDに基づいてフェッチ)
          const parentQuizIds = [...new Set(result.details.map(d => (d as any).parentQuizId).filter(Boolean))];
          const reportsList = await Promise.all(
            parentQuizIds.map(async (qId) => {
              try {
                return await getOpenReportsForQuiz(qId, user.id);
              } catch {
                return [];
              }
            })
          );
          setOpenReports(reportsList.flat());
        }
      } catch (err) {
        console.error('[MyQuizResultClient] データロード失敗:', err);
        setError('問題データのフェッチに失敗しました。');
      } finally {
        setLoading(false);
      }
    }

    loadQuestionsData();
  }, [result, user]);

  const openFeedbackModal = (q: Question | null) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setSelectedQuestion(q);
    const targetId = q ? q.id : 'unknown';
    const existingReport = openReports.find((r) => r.questionId === targetId);
    if (existingReport) {
      setFeedbackCategory(existingReport.category);
      setFeedbackContent(existingReport.content);
    } else {
      setFeedbackCategory('typo');
      setFeedbackContent('');
    }
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !feedbackContent.trim() || feedbackLoading || !selectedQuestion) return;

    setFeedbackLoading(true);
    try {
      const targetQuestionId = selectedQuestion.id;
      const existingReport = openReports.find((r) => r.questionId === targetQuestionId);

      // 解答詳細から親クイズIDを逆引き
      const detail = result?.details.find(d => d.questionId === targetQuestionId);
      const parentQuizId = (detail as any)?.parentQuizId || 'unknown';

      if (existingReport && existingReport.id) {
        await updateFeedbackReport(existingReport.id, feedbackCategory, feedbackContent);
      } else {
        const report: Omit<FeedbackReport, 'id' | 'status' | 'createdAt'> = {
          quizId: parentQuizId,
          quizTitle: 'カスタムクイズ親',
          questionId: targetQuestionId,
          questionText: selectedQuestion.questionText,
          reporterId: user.id,
          creatorId: 'unknown', // 親クイズ作者が不明な場合は unknown にフォールバック
          category: feedbackCategory,
          content: feedbackContent,
        };
        await submitFeedbackReport(report);
      }

      // レポートリスト再取得
      const reports = await getOpenReportsForQuiz(parentQuizId, user.id);
      setOpenReports((prev) => {
        const filtered = prev.filter((r) => r.questionId !== targetQuestionId);
        return [...filtered, ...reports];
      });

      setFeedbackSubmitted(true);
      setTimeout(() => {
        setShowFeedbackModal(false);
        setFeedbackSubmitted(false);
        setFeedbackContent('');
      }, 2000);
    } catch (e) {
      console.error('[MyQuizResultClient] 指摘送信失敗:', e);
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (loading) {
    return <ResultSkeleton data-testid="quiz-result-skeleton" />;
  }

  if (error || !result) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '60px 0' }}>
        <h2 style={{ color: 'var(--text-main)', marginBottom: '24px' }}>{error || '結果データが見つかりません'}</h2>
        <Link href="/my-quiz" className="btn btn-primary">
          カスタムクイズへ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 総合スコアサマリー */}
      <div className={styles.summaryCard}>
        <div className={styles.scoreCircle} data-testid="my-quiz-result-score-circle">
          <span className={styles.scoreVal}>{result.score}</span>
          <span className={styles.scoreLabel}>/ {result.totalQuestions} 問 正解</span>
        </div>

        <h1 className={styles.resultTitle}>
          {result.score === result.totalQuestions
             ? '🎉 パーフェクト達成！素晴らしい！'
             : '👍 お疲れ様でした！ナイスプレイ！'}
        </h1>

        <div className={styles.metaStats}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⏱️ 経過秒数: <strong>{result.elapsedSeconds}</strong> 秒
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            🎯 クリア率: <strong>{Math.round((result.score / result.totalQuestions) * 100)}</strong>%
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '300px', marginTop: '8px' }}>
          <Link
            href="/my-quiz"
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            カスタムクイズへ戻る
          </Link>
        </div>
      </div>

      {/* 問題正誤リストおよび解説表示 */}
      <section className={styles.questionsList}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)' }}>
            問題ごとの解説
          </h2>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setAllOpen((prev) => !prev)}
            data-testid="expand-all-btn"
          >
            {allOpen ? 'すべて折りたたむ' : 'すべて展開する'}
          </button>
        </div>

        {questions.map((q, idx) => {
          const detail = result.details.find((d) => d.questionId === q.id);
          const isCorrect = detail?.isCorrect ?? false;
          const userAnswerText = detail ? (detail.userAnswer || detail.selectedChoiceId || '') : '';

          return (
            <article key={q.id} className={styles.questionItem}>
              <div className={styles.itemHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    第 {idx + 1} 問
                  </h3>
                  {isCorrect ? (
                    <span className={styles.correctLabel}>
                      <CheckOutlined sx={{ fontSize: 16 }} /> 正解
                    </span>
                  ) : (
                    <span className={styles.incorrectLabel}>
                      <CloseOutlined sx={{ fontSize: 16 }} /> 不正解
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <QuestionBookmarkToggle
                    questionId={q.id}
                    initialBookmarked={bookmarkedQuestionIds.has(q.id)}
                    onToggle={async (bookmarked) => {
                      if (!user) return;
                      setBookmarkedQuestionIds((prev) => {
                        const next = new Set(prev);
                        if (bookmarked) next.add(q.id);
                        else next.delete(q.id);
                        return next;
                      });
                    }}
                  />
                  <button
                    className="btn btn-outline"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      borderColor: '#ffb703',
                      color: openReports.some((r) => r.questionId === q.id) ? '#1a1a2e' : '#ffb703',
                      background: openReports.some((r) => r.questionId === q.id) ? '#ffb703' : 'transparent'
                    }}
                    onClick={() => openFeedbackModal(q)}
                  >
                    <SmsOutlined sx={{ fontSize: 12, marginRight: '4px', display: 'inline', verticalAlign: 'text-bottom' }} />
                    {openReports.some((r) => r.questionId === q.id) ? '問題指摘済' : 'この問題を指摘'}
                  </button>
                </div>
              </div>

              <MarkdownContent
                markdown={q.questionText}
                className={styles.questionTextResult}
              />

              <ResultQuestionDetailsAccordion
                key={`${q.id}_${allOpen}`}
                questionId={q.id}
                defaultOpen={allOpen}
              >
                <div className={styles.answerSummary}>
                  <div className={styles.answerRow}>
                    <span className={styles.answerLabel}>あなたの回答</span>
                    <span className={`${styles.answerValue} ${isCorrect ? styles.answerValueCorrect : styles.answerValueIncorrect}`}>
                      {formatUserAnswer(
                        q,
                        userAnswerText,
                        'my-quiz',
                        true
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

                {q.explanation && (
                  <div className={styles.explanationBox}>
                    <div className={styles.explanationTitle}>💡 解説</div>
                    <div
                      className="prose max-w-none dark:prose-invert"
                      style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}
                      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(q.explanation) }}
                    />
                  </div>
                )}
              </ResultQuestionDetailsAccordion>
            </article>
          );
        })}
      </section>

      {/* 間違い指摘モーダル */}
      {showFeedbackModal && (
        <div className={styles.modalOverlay} onClick={() => setShowFeedbackModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              <WarningAmberOutlined sx={{ fontSize: 18, color: '#ffb703' }} />
              問題の間違い・別解の指摘
            </h3>

            {feedbackSubmitted ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-accent)' }}>
                <CheckCircleOutlined sx={{ fontSize: 32 }} style={{ margin: '0 auto 12px' }} />
                指摘レポートを送信しました。ご協力ありがとうございました！
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className={styles.form}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>指摘カテゴリ</label>
                  <select
                    className={styles.select}
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value as any)}
                  >
                    <option value="typo">誤字脱字・表現の修正</option>
                    <option value="fact">事実誤認・解答の間違い</option>
                    {selectedQuestion !== null && (
                      <option value="alternative">別解の追加要望</option>
                    )}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>指摘の具体的な内容</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="修正箇所や正しい解答などの詳細情報を具体的に記述してください..."
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setShowFeedbackModal(false)}
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={feedbackLoading || !feedbackContent.trim()}
                  >
                    {feedbackLoading ? '送信中...' : '送信する'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
