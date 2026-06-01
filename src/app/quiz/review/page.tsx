'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Check, X, Award, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getFailedQuestions, updateFailedQuestions } from '@/services/attempt';
import { getTextInputFieldProps, isTextInputAnswerCorrect } from '@/services/text-answer-utils';
import { Question } from '@/types';
import styles from './review.module.css';

// 復習ジャンルリスト
const REVIEW_GENRES = [
  { id: '', label: 'オールジャンル', icon: '🌟' },
  { id: 'programming', label: '開発・プログラミング', icon: '💻' },
  { id: 'history', label: '歴史・世界史', icon: '📜' },
  { id: 'science', label: '科学・宇宙', icon: '🌌' },
  { id: 'art', label: 'アート・デザイン', icon: '🎨' },
  { id: 'sports', label: 'スポーツ', icon: '⚽' },
  { id: 'entertainment', label: 'ゲーム', icon: '🎮' },
];

export default function ReviewPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<'setup' | 'playing' | 'completed'>('setup');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [failedQuestions, setFailedQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [noQuestions, setNoQuestions] = useState<boolean>(false);

  // 復習プレイ用ステート
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answeredCount, setAnsweredCount] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [recoveredCount, setRecoveredCount] = useState<number>(0);

  // 正解した問題の quizId ごとのマッピング (一括アトミック削除用)
  const [solvedMap, setSolvedMap] = useState<Record<string, string[]>>({});

   // 2. 間違えた問題のフェッチ
  const startReviewSession = async () => {
    if (!user) return;
    setLoadingQuestions(true);
    setNoQuestions(false);
    try {
      // getFailedQuestions サービスを用いてアトミックに間違い設問をフェッチ (ジャンルフィルタ連動)
      const gatheredQuestions = await getFailedQuestions(user.id, undefined, selectedGenre || null);

      if (gatheredQuestions.length === 0) {
        setNoQuestions(true);
      } else {
        // カンニング防止：quick-press問題の生データを難読化
        const obscured = gatheredQuestions.map((q) => {
          if (q.type === 'quick-press') {
            return {
              ...q,
              questionText: btoa(unescape(encodeURIComponent(q.questionText))),
              correctTextAnswerList: q.correctTextAnswerList?.map((ans) =>
                btoa(unescape(encodeURIComponent(ans)))
              ) || [],
            };
          }
          return q;
        });

        setFailedQuestions(obscured);
        setSolvedMap({});
        setPhase('playing');
        setCurrentIdx(0);
        setCorrectCount(0);
        setAnsweredCount(0);
        setRecoveredCount(0);
      }
    } catch (e) {
      console.error('[Review] 間違い問題フェッチエラー:', e);
      setNoQuestions(true);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // 3. 回答処理
  const handleAnswerSubmit = async (answerTextOrChoiceId: string) => {
    if (failedQuestions.length === 0 || currentIdx >= failedQuestions.length) return;

    const currentQuestion = failedQuestions[currentIdx];
    let isCorrect = false;

    if (currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false') {
      const selectedChoice = currentQuestion.choices?.find((c) => c.id === answerTextOrChoiceId);
      isCorrect = !!selectedChoice?.isCorrect;
    } else if (currentQuestion.type === 'text-input') {
      isCorrect = isTextInputAnswerCorrect(answerTextOrChoiceId, currentQuestion);
    } else if (currentQuestion.type === 'quick-press') {
      const cleanInput = answerTextOrChoiceId.trim().toLowerCase().replace(/\s+/g, '');
      isCorrect = currentQuestion.correctTextAnswerList?.some(
        (ans) => {
          try {
            const decoded = decodeURIComponent(escape(atob(ans)));
            return decoded.trim().toLowerCase().replace(/\s+/g, '') === cleanInput;
          } catch (e) {
            return false;
          }
        }
      ) ?? false;
    }

    setAnsweredCount((prev) => prev + 1);

    // 正解した問題の quizId ごとのマッピング更新用のローカル変数
    let nextSolvedMap = { ...solvedMap };

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      setRecoveredCount((prev) => prev + 1);
      
      const qId = (currentQuestion as any).quizId || 'unknown';
      const list = nextSolvedMap[qId] || [];
      if (!list.includes(currentQuestion.id)) {
        nextSolvedMap[qId] = [...list, currentQuestion.id];
        setSolvedMap(nextSolvedMap);
      }
    } else {
      const nextFailed = [...failedIds];
      if (!nextFailed.includes(currentQuestion.id)) {
        nextFailed.push(currentQuestion.id);
        setFailedIds(nextFailed);
      }
    }

    // 次へ進む
    if (currentIdx < failedQuestions.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      // 復習プレイ完了時に、正解したすべての間違い問題を一括バッチアトミック削除！ (要件 6.2, 1.1)
      try {
        const promises = Object.entries(nextSolvedMap).map(([quizId, solvedQuestionIds]) => {
          if (quizId === 'unknown' || solvedQuestionIds.length === 0) return Promise.resolve();
          return updateFailedQuestions(user!.id, quizId, solvedQuestionIds);
        });
        await Promise.all(promises);
      } catch (err) {
        console.error('[Review] 復習完了時の一括アトミック反映に失敗しました:', err);
      }
      setPhase('completed');
    }
  };

  if (authLoading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>認証チェック中...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <ArrowLeft size={16} />
        ホームに戻る
      </Link>

      {/* 1. セットアップフェーズ */}
      {phase === 'setup' && (
        <div className={styles.setupPanel}>
          <h1 className={styles.panelTitle}>弱点克服プレイ (誤答復習)</h1>
          <p className={styles.panelDesc}>
            過去に間違えてしまった問題を復習し、知識の隙間を埋めましょう。<br />
            まずは復習したいクイズのジャンルを選択してください。
          </p>

          <div className={styles.genreSelector}>
            {REVIEW_GENRES.map((genre) => (
              <div
                key={genre.id}
                className={`${styles.genreCard} ${selectedGenre === genre.id ? styles.genreSelected : ''}`}
                onClick={() => setSelectedGenre(genre.id)}
              >
                <span className={styles.genreIcon}>{genre.icon}</span>
                <span className={styles.genreLabel}>{genre.label}</span>
              </div>
            ))}
          </div>

          {noQuestions && (
            <div style={{ color: '#ffb703', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
              <AlertCircle size={18} />
              選択されたジャンルに未復習の間違い問題はありません。
            </div>
          )}

          <button
            className={`btn btn-primary ${styles.startBtn}`}
            onClick={startReviewSession}
            disabled={loadingQuestions}
            style={{ width: '100%', marginTop: '16px' }}
          >
            {loadingQuestions ? '間違い問題を読み込み中...' : '復習セッションを開始する'}
          </button>
        </div>
      )}

      {/* 2. プレイ中フェーズ */}
      {phase === 'playing' && failedQuestions.length > 0 && (
        <div style={{ background: 'var(--glass-bg)', border: 'var(--glass-border)', padding: '40px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '20px' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
              復習問題 {currentIdx + 1} / {failedQuestions.length} 問目
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              正解数: {correctCount} / {answeredCount}
            </span>
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '24px', lineHeight: 1.5 }}>
            {failedQuestions[currentIdx]?.type === 'quick-press'
              ? (() => {
                  try {
                    return decodeURIComponent(escape(atob(failedQuestions[currentIdx]?.questionText)));
                  } catch (e) {
                    return failedQuestions[currentIdx]?.questionText;
                  }
                })()
              : failedQuestions[currentIdx]?.questionText}
          </h2>

          {/* 選択肢 */}
          {(failedQuestions[currentIdx]?.type === 'multiple-choice' || failedQuestions[currentIdx]?.type === 'true-false') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {failedQuestions[currentIdx]?.choices?.map((choice) => (
                <button
                  key={choice.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-light)',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-main)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                  onClick={() => handleAnswerSubmit(choice.id)}
                >
                  {choice.choiceText}
                </button>
              ))}
            </div>
          )}

          {/* 記述式・早押し */}
          {(failedQuestions[currentIdx]?.type === 'text-input' || failedQuestions[currentIdx]?.type === 'quick-press') && (() => {
            const q = failedQuestions[currentIdx];
            const inputProps = q.type === 'text-input' ? getTextInputFieldProps(q) : { type: 'text' as const, placeholder: '解答を入力してください...' };
            return (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('textAnswer') as HTMLInputElement).value;
                handleAnswerSubmit(input);
                e.currentTarget.reset();
              }}
              style={{ display: 'flex', gap: '12px' }}
            >
              <input
                type={inputProps.type}
                name="textAnswer"
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  color: 'var(--text-main)'
                }}
                placeholder={inputProps.placeholder}
                inputMode={inputProps.inputMode}
                maxLength={inputProps.maxLength}
                minLength={inputProps.minLength}
                required
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary">送信</button>
            </form>
            );
          })()}
        </div>
      )}

      {/* 3. 復習完了フェーズ */}
      {phase === 'completed' && (
        <div className={styles.completedCard}>
          <Award size={64} style={{ color: '#00f5d4', filter: 'drop-shadow(0 0 10px rgba(0,245,212,0.4))' }} />
          <h1 className={styles.completedTitle}>復習完了！</h1>
          <p className={styles.completedDesc}>
            間違い問題の復習セッションが完了しました。<br />
            今回見事に正解した <strong>{recoveredCount}</strong> 問が間違いリストから削除され、弱点が克服されました！
          </p>

          <div style={{ display: 'flex', gap: '16px', width: '100%', marginTop: '16px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPhase('setup')}>
              別の復習を行う
            </button>
            <Link href="/" className="btn btn-primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              ホームに戻る
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
