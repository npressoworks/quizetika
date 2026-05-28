'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Check, X, Award, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { updateFailedQuestionsCount } from '@/services/attempt';
import { Question, Quiz } from '@/types';
import styles from './review.module.css';
import { Header } from '@/components/layout/header';

// 復習ジャンルリスト
const REVIEW_GENRES = [
  { id: '', label: 'オールジャンル', icon: '🌟' },
  { id: 'programming', label: '開発・プログラミング', icon: '💻' },
  { id: 'history', label: '歴史・世界史', icon: '📜' },
  { id: 'science', label: '科学・宇宙', icon: '🌌' },
  { id: 'art', label: 'アート・デザイン', icon: '🎨' },
  { id: 'sports', label: 'スポーツ', icon: '⚽' },
  { id: 'entertainment', label: 'エンタメ', icon: '🎮' },
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

  // 1. 未ログイン保護
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // 2. 間違えた問題のフェッチ
  const startReviewSession = async () => {
    if (!user) return;
    setLoadingQuestions(true);
    setNoQuestions(false);
    try {
      // attempts コレクションから該当ユーザーのプレイ履歴を取得
      const attemptsRef = collection(db, 'attempts');
      const q = query(attemptsRef, where('userId', '==', user.id));
      const querySnap = await getDocs(q);

      const allFailedIds = new Set<string>();
      querySnap.forEach((docSnap) => {
        const att = docSnap.data();
        if (att.failedQuestionIds && Array.isArray(att.failedQuestionIds)) {
          att.failedQuestionIds.forEach((id) => allFailedIds.add(id));
        }
      });

      if (allFailedIds.size === 0) {
        setNoQuestions(true);
        setLoadingQuestions(false);
        return;
      }

      // クイズ一覧から間違えた設問を回収
      const quizzesRef = collection(db, 'quizzes');
      const quizSnap = await getDocs(quizzesRef);
      const gatheredQuestions: Question[] = [];

      quizSnap.forEach((docSnap) => {
        const quiz = docSnap.data() as Quiz;
        // ジャンルフィルタが一致、またはオールジャンル
        if (!selectedGenre || quiz.genre === selectedGenre) {
          if (quiz.questions && Array.isArray(quiz.questions)) {
            quiz.questions.forEach((question) => {
              if (allFailedIds.has(question.id)) {
                gatheredQuestions.push(question);
              }
            });
          }
        }
      });

      if (gatheredQuestions.length === 0) {
        setNoQuestions(true);
      } else {
        setFailedQuestions(gatheredQuestions);
        setPhase('playing');
        setCurrentIdx(0);
        setCorrectCount(0);
        setAnsweredCount(0);
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
      const cleanInput = answerTextOrChoiceId.trim().toLowerCase();
      isCorrect = currentQuestion.correctTextAnswerList?.some(
        (ans) => ans.trim().toLowerCase() === cleanInput
      ) ?? false;
    }

    setAnsweredCount((prev) => prev + 1);

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      setRecoveredCount((prev) => prev + 1);
      
      // アトミックに間違いリストカウントを減算 (Task 6.2)
      if (user) {
        await updateFailedQuestionsCount(user.id, -1);
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
    <>
      <Header />
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
            className="btn btn-primary styles.startBtn"
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
            {failedQuestions[currentIdx]?.questionText}
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

          {/* 短答記述 */}
          {failedQuestions[currentIdx]?.type === 'text-input' && (
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
                type="text"
                name="textAnswer"
                style={{
                  flex: 1,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  color: 'var(--text-main)'
                }}
                placeholder="解答を入力してください..."
                required
                autoComplete="off"
              />
              <button type="submit" className="btn btn-primary">送信</button>
            </form>
          )}
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
    </>
  );
}
