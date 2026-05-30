'use client';

import React, { useEffect, useState, use, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Timer, HelpCircle, Send, CheckCircle, AlertTriangle, Play, Check, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getQuiz } from '@/services/quiz';
import { usePlayState } from '@/hooks/usePlayState';
import { useAiPlayState } from '@/hooks/useAiPlayState';
import { saveAttempt, updateFailedQuestionsCount } from '@/services/attempt';
import { addPendingSyncAttempt, generateLocalId } from '@/services/attempt-session';
import { Quiz, Attempt, Question } from '@/types';
import styles from './play.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ContentProps {
  quizId: string;
}

function QuizPlayPageContent({ quizId }: ContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const rawMode = searchParams.get('mode') || 'normal';
  const playMode = rawMode as 'normal' | 'exam' | 'flashcard' | 'lateral';

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [online, setOnline] = useState<boolean>(true);

  // 1. オンライン・オフライン判定の監視
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOnline(navigator.onLine);
      const goOnline = () => setOnline(true);
      const goOffline = () => setOnline(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      return () => {
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }
  }, []);

  // 2. クイズ読み込み
  useEffect(() => {
    async function loadQuiz() {
      try {
        const data = await getQuiz(quizId);
        setQuiz(data);
        
        // ウミガメスープ保護: 未ログインならログインにリダイレクト
        if (playMode === 'lateral' && !user) {
          router.push('/login');
        }
      } catch (e) {
        console.error('[QuizPlay] 読み込み失敗:', e);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [quizId, playMode, user]);

  // 通常・模擬試験・フラッシュカード用のプレイフック
  const {
    currentIdx,
    setCurrentIdx,
    answeredIds,
    failedIds,
    score,
    elapsedSeconds,
    timeLeft,
    showAnswer,
    setShowAnswer,
    handleAnswerSubmit,
    clearSession,
    isFinished,
  } = usePlayState({
    quizId,
    userId: user?.id || 'guest',
    mode: playMode === 'lateral' ? 'normal' : playMode,
    questions: quiz?.questions || [],
  });

  // 3. 通常・試験・フラッシュカード完了時の処理
  const handlePlayComplete = async (finalScore = score, finalFailed = failedIds) => {
    if (!quiz) return;

    // クイズリスト（問題集）のIDを取得。型定義（string | undefined）に合わせるため undefined を維持
    const listId = searchParams.get('listId') || undefined;
    const currentMode = listId ? 'list' : (playMode === 'lateral' ? 'normal' : playMode);

    const attemptData: Omit<Attempt, 'id' | 'completedAt'> = {
      userId: user?.id || 'guest',
      quizId: quiz.id,
      listId,
      mode: currentMode,
      score: finalScore,
      totalQuestions: quiz.questions.length,
      elapsedSeconds,
      failedQuestionIds: finalFailed,
      aiTurnCount: 0,
      aiTurnLimit: null,
    };

    // セッションデータの削除
    clearSession();

    if (online) {
      // オンライン保存
      try {
        const attemptId = await saveAttempt(attemptData);
        // 不正解問題数を更新
        if (user && finalFailed.length > 0) {
          await updateFailedQuestionsCount(user.id, finalFailed.length);
        }
        const listQuery = listId ? `&listId=${listId}` : '';
        router.push(`/quiz/${quiz.id}/result?attemptId=${attemptId}${listQuery}`);
      } catch (error) {
        console.error('[QuizPlay] 保存失敗:', error);
        // 保存失敗時はオフラインフォールバックとして localStorage に保存
        saveOffline(attemptData);
      }
    } else {
      // オフライン保存
      saveOffline(attemptData);
    }
  };

  const saveOffline = (attemptData: Omit<Attempt, 'id' | 'completedAt'>) => {
    if (!quiz) return;
    const localId = generateLocalId();
    addPendingSyncAttempt({
      ...attemptData,
      localId,
      completedAt: new Date().toISOString(),
    });
    const listId = searchParams.get('listId');
    const listQuery = listId ? `&listId=${listId}` : '';
    // オフライン状態でのリダイレクト（結果画面にて同期警告が出る）
    router.push(`/quiz/${quiz.id}/result?localId=${localId}${listQuery}`);
  };

  // ────────── ウミガメスープ問題専用ステート ──────────
  const [lateralAttemptId, setLateralAttemptId] = useState<string | null>(null);
  const [truthSummary, setTruthSummary] = useState<string>('');
  const [questionInput, setQuestionInput] = useState<string>('');
  const [showTruthForm, setShowTruthForm] = useState<boolean>(false);
  const [isTruthChecking, setIsTruthChecking] = useState<boolean>(false);
  const [truthAdvice, setTruthAdvice] = useState<string | null>(null);
  const [truthPassed, setTruthPassed] = useState<boolean>(false);

  // 初回ロード時にウミガメスープ用の空の Attempt を自動生成
  useEffect(() => {
    if (playMode === 'lateral' && quiz && user && !lateralAttemptId) {
      const currentUserId = user.id;
      const currentQuizId = quiz.id;
      const currentQuestionsLength = quiz.questions.length;
      async function initLateralAttempt() {
        try {
          const newAttempt: Omit<Attempt, 'id' | 'completedAt'> = {
            userId: currentUserId,
            quizId: currentQuizId,
            mode: 'normal',
            score: 0,
            totalQuestions: currentQuestionsLength,
            elapsedSeconds: 0,
            failedQuestionIds: [],
            aiQuestionsHistory: [],
            aiTurnCount: 0,
            aiTurnLimit: 20,
          };
          const aid = await saveAttempt(newAttempt);
          setLateralAttemptId(aid);
        } catch (e) {
          console.error('[QuizPlay] ウミガメセッション作成エラー:', e);
        }
      }
      initLateralAttempt();
    }
  }, [playMode, quiz, user, lateralAttemptId]);

  // ウミガメスープ用AIプレイステートフック
  const aiPlay = useAiPlayState({
    attemptId: lateralAttemptId || '',
    userId: user?.id || '',
    isPremium: false,
    initialHistory: [],
    initialTurnCount: 0,
  });

  // ウミガメ 質問送信
  const handleQuestionSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionInput.trim() || aiPlay.pending) return;
    await aiPlay.askQuestion(questionInput);
    setQuestionInput('');
  };

  // ウミガメ 真相回答判定送信
  const handleTruthVerify = async () => {
    if (!truthSummary.trim() || isTruthChecking || !lateralAttemptId || !user) return;
    setIsTruthChecking(true);
    setTruthAdvice(null);
    try {
      const res = await fetch('/api/attempt/verify-truth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: lateralAttemptId,
          userId: user.id,
          truthSummary,
          displayName: user.displayName,
        }),
      });

      const data = await res.json();
      if (data.isCorrect) {
        setTruthPassed(true);
        // クリアアニメーション後、結果画面へ遷移
        setTimeout(() => {
          router.push(`/quiz/${quiz?.id}/result?attemptId=${lateralAttemptId}`);
        }, 3000);
      } else {
        setTruthAdvice(data.advice || '真相にはまだ遠いようです。もう一度AIとの対話を見直してみましょう。');
      }
    } catch (e) {
      console.error('[verify-truth] 送信エラー:', e);
      setTruthAdvice('判定サーバーでエラーが発生しました。時間を置いてから再試行してください。');
    } finally {
      setIsTruthChecking(false);
    }
  };

  // 4. ヒント表示モーダル制御
  const [showHint, setShowHint] = useState<boolean>(false);

  if (loading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>プレイ環境を準備中...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className={styles.container}>
        <p>クイズが見つかりませんでした。</p>
      </div>
    );
  }

  // ────────── UI レンダリング: ウミガメスープ ──────────
  if (playMode === 'lateral') {
    const lateralQuestion = quiz.questions.find((q) => q.type === 'lateral-thinking');
    return (
      <div className={styles.lateralContainer}>
        {/* 左カラム: AIチャット */}
        <div className={styles.chatColumn}>
          <div className={styles.chatHeader}>
            <div className={styles.chatTitle}>👻 ウミガメチャット (AI判定)</div>
            <div className={styles.turnCounter}>質問数: {aiPlay.turnCount} / 20</div>
          </div>

          <div className={styles.chatHistory}>
            {/* 初期メッセージ */}
            <div className={`${styles.chatBubble} ${styles.bubbleAi}`}>
              {lateralQuestion?.questionText}
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ※ 質問は「はい」か「いいえ」で回答可能なクローズドクエスチョンで行うと解決に近づきます。
              </div>
            </div>

            {/* 対話履歴 */}
            {aiPlay.history.map((msg) => (
              <React.Fragment key={msg.id}>
                {/* ユーザー質問 */}
                <div className={`${styles.chatBubble} ${styles.bubbleUser}`}>
                  {msg.questionText}
                </div>
                {/* AI回答 */}
                <div className={`${styles.chatBubble} ${styles.bubbleAi}`}>
                  {msg.aiComment}
                  {msg.answerType && (
                    <div className={styles.aiResponseMeta}>
                      {msg.answerType === 'yes' && <span className={styles.responseYes}>🟢 はい (YES)</span>}
                      {msg.answerType === 'no' && <span className={styles.responseNo}>🔴 いいえ (NO)</span>}
                      {msg.answerType === 'irrelevant' && <span className={styles.responseIrrelevant}>🟡 関係ありません (IRRELEVANT)</span>}
                      {msg.answerType === 'unknown' && <span className={styles.responseUnknown}>⚪ 判断できません</span>}
                      {msg.isFromCache && <span className={styles.cacheBadge}>📋 既存の回答</span>}
                    </div>
                  )}
                </div>
              </React.Fragment>
            ))}

            {/* AIが質問を分析中の表示 (Task 4.2) */}
            {aiPlay.pending && (
              <div className={styles.chatPending}>
                <span>・・・AIが質問を分析中です</span>
              </div>
            )}
            
            {/* 合格クリアアニメーション (Task 4.3) */}
            {truthPassed && (
              <div className={`${styles.chatBubble} ${styles.bubbleSystem}`}>
                🎉 【合格】素晴らしい！見事に真相を解き明かしました！結果画面へ遷移します...
              </div>
            )}
          </div>

          {/* 入力欄 */}
          <div className={styles.chatInputArea}>
            {aiPlay.errorMsg && (
              <div style={{ color: '#ff007f', fontSize: '0.85rem', marginBottom: '8px' }}>
                ⚠️ {aiPlay.errorMsg}
              </div>
            )}
            <form onSubmit={handleQuestionSend} className={styles.chatInputForm}>
              <input
                type="text"
                className={styles.chatInput}
                placeholder={aiPlay.turnCount >= 20 ? "質問の上限に達しました" : "AIに質問する (例: 男は一人でしたか？)..."}
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                disabled={aiPlay.pending || aiPlay.turnCount >= 20 || truthPassed}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={aiPlay.pending || !questionInput.trim() || aiPlay.turnCount >= 20 || truthPassed}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* 右カラム: 真相回答判定エリア */}
        <div className={styles.infoColumn}>
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>ウミガメのスープ（水平思考クイズ）</div>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
              出題された不思議な物語の裏にある「真相」を暴いてください。<br />
              チャットでAIに手がかりとなる質問を投げ、状況を把握できたら、以下のフォームから「最終的な真相の要約」を提出してください。
            </p>
          </div>

          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>真相を解き明かす</div>
            <div className={styles.verifyTruthPanel}>
              <textarea
                className={styles.verifyTextarea}
                placeholder="あなたが解き明かした真相のストーリーを100文字〜1000文字以内で要約して入力してください..."
                value={truthSummary}
                onChange={(e) => setTruthSummary(e.target.value)}
                disabled={isTruthChecking || truthPassed}
              />
              {truthAdvice && (
                <div style={{ color: '#ffb703', fontSize: '0.85rem', background: 'rgba(255, 183, 3, 0.08)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255, 183, 3, 0.2)' }}>
                  💡 <strong>AIからのヒント:</strong> {truthAdvice}
                </div>
              )}
              <button
                className="btn btn-accent"
                onClick={handleTruthVerify}
                disabled={!truthSummary.trim() || isTruthChecking || truthPassed}
                style={{ width: '100%', marginTop: '10px' }}
              >
                {isTruthChecking ? 'AIが真相を判定中...' : '真相を送信する'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────────── UI レンダリング: 通常・試験・フラッシュカード ──────────
  const currentQuestion = quiz.questions[currentIdx];
  const progressPercent = quiz.questions.length > 0 ? (answeredIds.length / quiz.questions.length) * 100 : 0;

  // すべて解答完了時のリダイレクト・完了トリガー
  if (isFinished && currentIdx >= quiz.questions.length) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>全問終了しました！</p>
        <button className="btn btn-primary" onClick={() => handlePlayComplete()}>
          結果を確認する
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* プレイ画面ヘッダー情報 */}
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href={`/quiz/${quiz.id}`} className={styles.backBtn} onClick={clearSession}>
            <ArrowLeft size={16} />
            中断する
          </Link>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>| モード: {playMode}</span>
        </div>

        <div className={styles.statusIndicator}>
          {online ? (
            <span className={styles.online}>🟢 オンライン (同期保護中)</span>
          ) : (
            <span className={styles.offline}>🔴 オフライン (ローカル保存されます)</span>
          )}
        </div>
      </div>

      {/* 進行状況バー */}
      <div className={styles.progressSection}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }}></div>
        </div>
        <div className={styles.progressText}>
          <span>解答済み: {answeredIds.length} / {quiz.questions.length} 問</span>
          <span>経過時間: {elapsedSeconds} 秒</span>
        </div>
      </div>

      {/* 問題表示カード */}
      <div className={styles.quizCard}>
        <div className={styles.questionMeta}>
          <span className={styles.questionType}>
            第 {currentIdx + 1} 問 ({currentQuestion?.type})
          </span>
          {/* 個別カウントダウンタイマー (通常モード) */}
          {playMode === 'normal' && timeLeft !== null && (
            <span className={`${styles.timer} ${timeLeft <= 5 ? styles.timerWarning : ''}`}>
              ⏱️ 残り {timeLeft} 秒
            </span>
          )}
        </div>

        <h2 className={styles.questionText}>{currentQuestion?.questionText}</h2>

        {/* 1. 選択肢表示 (複数選択/○×判定) */}
        {(currentQuestion?.type === 'multiple-choice' || currentQuestion?.type === 'true-false') && (
          <div className={styles.optionsGrid}>
            {currentQuestion.choices?.map((choice) => (
              <button
                key={choice.id}
                className={`${styles.optionBtn} optionBtn`}
                onClick={() => handleAnswerSubmit(choice.id)}
              >
                <span>{choice.choiceText}</span>
              </button>
            ))}
          </div>
        )}

        {/* 2. 短答記述形式の入力 */}
        {currentQuestion?.type === 'text-input' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem('textAnswer') as HTMLInputElement).value;
              handleAnswerSubmit(input);
              e.currentTarget.reset();
            }}
            className={styles.inputForm}
          >
            <input
              type="text"
              name="textAnswer"
              className={styles.textInput}
              placeholder="回答を入力してください..."
              required
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary">送信</button>
          </form>
        )}

        {/* 3. フラッシュカードのフリップ動作 */}
        {playMode === 'flashcard' && (
          <div className={styles.flashcardArea}>
            {!showAnswer ? (
              <button className="btn btn-accent" onClick={() => setShowAnswer(true)}>
                答えを見る
              </button>
            ) : (
              <div className={styles.cardBack}>
                <div className={styles.correctAnswer}>
                  正解: {currentQuestion.choices?.find((c) => c.isCorrect)?.choiceText || currentQuestion.correctTextAnswerList?.[0] || '正解'}
                </div>
                <p className={styles.explanation}>{currentQuestion.explanation}</p>

                <div className={styles.flashcardActionGrid} style={{ marginTop: '20px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, background: '#00f5d4', color: '#111' }}
                    onClick={() => {
                      // 自己申告: 分かった (正解)
                      handleAnswerSubmit('correct');
                    }}
                  >
                    <Check size={18} /> 分かった (正解)
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{ flex: 1, borderColor: '#ff007f', color: '#ff007f' }}
                    onClick={() => {
                      // 自己申告: 分からなかった (不正解)
                      handleAnswerSubmit('incorrect');
                    }}
                  >
                    <X size={18} /> 分からなかった (不正解)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* アクションボタンバー (ヒント表示) */}
      <div className={styles.actionsBar}>
        {currentQuestion?.hint && (
          <button className="btn btn-secondary" onClick={() => setShowHint(true)}>
            💡 ヒントを表示
          </button>
        )}
      </div>

      {/* 模擬試験用の設問ナビゲーション */}
      {playMode === 'exam' && (
        <div className={styles.examNavGrid}>
          {quiz.questions.map((q, idx) => {
            const isAnswered = answeredIds.includes(q.id);
            return (
              <button
                key={q.id}
                className={`${styles.examNavBtn} ${currentIdx === idx ? styles.examNavBtnActive : ''} ${isAnswered ? styles.examNavBtnAnswered : ''}`}
                onClick={() => setCurrentIdx(idx)}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* ヒントモーダルダイアログ */}
      {showHint && (
        <div className={styles.modalOverlay} onClick={() => setShowHint(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>💡 問題のヒント</h3>
            <p className={styles.modalText}>{currentQuestion?.hint}</p>
            <button className="btn btn-primary" onClick={() => setShowHint(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuizPlayPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return (
    <React.Suspense fallback={<div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}><p style={{ color: 'var(--text-muted)' }}>プレイ環境を準備中...</p></div>}>
      <QuizPlayPageContent quizId={resolvedParams.id} />
    </React.Suspense>
  );
}
