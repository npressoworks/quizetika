'use client';

import { useState, useEffect, useRef } from 'react';
import { Quiz, Question } from '@/types';
import { LocalAttemptSession, PlayProgressData } from '@/services/attempt-session';

interface UsePlayStateProps {
  quizId: string;
  userId: string;
  mode: 'normal' | 'exam' | 'flashcard';
  questions: Question[];
}

export function usePlayState({ quizId, userId, mode, questions }: UsePlayStateProps) {
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answeredIds, setAnsweredIds] = useState<string[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  // フラッシュカード用のカード裏面表示ステート
  const [showAnswer, setShowAnswer] = useState<boolean>(false);

  // 初回起動時のセッション復元
  const isInitialized = useRef<boolean>(false);
  useEffect(() => {
    if (!quizId || !userId || isInitialized.current) return;
    isInitialized.current = true;

    const saved = LocalAttemptSession.load(quizId, userId);
    if (saved && saved.mode === mode && saved.totalQuestions === questions.length) {
      setAnsweredIds(saved.answeredQuestionIds);
      setFailedIds(saved.failedQuestionIds);
      setQuestionAnswers(saved.questionAnswers ?? {});
      setScore(saved.currentScore);
      setElapsedSeconds(saved.elapsedSeconds);
      
      // 復旧された回答済みの数から次の未解答インデックスを決定
      const nextIdx = saved.answeredQuestionIds.length;
      if (nextIdx < questions.length) {
        setCurrentIdx(nextIdx);
      } else {
        // すべて解答済みの場合は結果画面へ進めるため最後にする
        setCurrentIdx(questions.length - 1);
      }
    }
  }, [quizId, userId, mode, questions]);

  // localStorage への自動シリアライズ保存
  useEffect(() => {
    if (!quizId || !userId || !isInitialized.current) return;

    const progress: PlayProgressData = {
      quizId,
      userId,
      mode,
      startedAt: new Date().toISOString(),
      answeredQuestionIds: answeredIds,
      failedQuestionIds: failedIds,
      questionAnswers,
      currentScore: score,
      totalQuestions: questions.length,
      elapsedSeconds,
    };
    
    // プレイ完了まで常に保存
    if (answeredIds.length < questions.length) {
      LocalAttemptSession.save(quizId, userId, progress);
    }
  }, [quizId, userId, mode, answeredIds, failedIds, questionAnswers, score, elapsedSeconds, questions]);

  // タイマー処理
  useEffect(() => {
    // すべて回答済みの場合はタイマーを動かさない
    if (answeredIds.length >= questions.length) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);

      // 通常モードにおける個別設問の制限時間カウントダウン
      if (mode === 'normal') {
        setTimeLeft((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            // 時間切れ (0秒) -> 自動的に不正解扱いとして次の問題へ
            handleAnswerSubmit(''); 
            return null;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, answeredIds, questions, currentIdx]);

  // 設問が変わる際のタイマー初期化
  useEffect(() => {
    if (questions.length === 0 || currentIdx >= questions.length) return;
    
    const currentQuestion = questions[currentIdx];
    if (mode === 'normal' && currentQuestion?.limitTime) {
      setTimeLeft(currentQuestion.limitTime);
    } else {
      setTimeLeft(null);
    }
    setShowAnswer(false);
  }, [currentIdx, questions, mode]);

  // 解答提出処理
  const handleAnswerSubmit = (answerTextOrChoiceId: string) => {
    if (questions.length === 0 || currentIdx >= questions.length) return;

    const currentQuestion = questions[currentIdx];
    
    // すでに回答済みの設問はスキップ (通常モード・フラッシュカードモードでの重複回答防止)
    if (mode !== 'exam' && answeredIds.includes(currentQuestion.id)) return;

    let isCorrect = false;

    // 正誤判定ロジック
    if (mode === 'flashcard') {
      // 暗記カード（フラッシュカード）モードは自己申告による正誤判定
      isCorrect = answerTextOrChoiceId === 'correct';
    } else if (currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false') {
      const selectedChoice = currentQuestion.choices?.find((c) => c.id === answerTextOrChoiceId);
      isCorrect = !!selectedChoice?.isCorrect;
    } else if (currentQuestion.type === 'text-input' || currentQuestion.type === 'association') {
      const cleanInput = answerTextOrChoiceId.trim().toLowerCase().replace(/\s+/g, '');
      isCorrect = currentQuestion.correctTextAnswerList?.some(
        (ans) => ans.trim().toLowerCase().replace(/\s+/g, '') === cleanInput
      ) ?? false;
    } else if (currentQuestion.type === 'quick-press') {
      const cleanInput = answerTextOrChoiceId.trim().toLowerCase().replace(/\s+/g, '');
      // 早押し問題の正解候補は Base64 難読化されているため、デコードして比較
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
    } else if (currentQuestion.type === 'sorting') {
      // 並び替え要素の正しい順序を検証
      // カンマ区切りの要素ID文字列（例："id1,id2,id3"）を受け取ると想定
      const userSortedIds = answerTextOrChoiceId.split(',');
      const sortingItems = currentQuestion.sortingItems ?? [];
      
      if (userSortedIds.length !== sortingItems.length) {
        isCorrect = false;
      } else {
        isCorrect = userSortedIds.every((id, idx) => {
          const item = sortingItems.find((s) => s.id === id);
          return item?.correctOrder === idx;
        });
      }
    }

    // 回答ログの追加
    const nextAnswered = [...answeredIds];
    if (!nextAnswered.includes(currentQuestion.id)) {
      nextAnswered.push(currentQuestion.id);
      setAnsweredIds(nextAnswered);
    }

    const nextFailed = [...failedIds];
    if (isCorrect) {
      setScore((prev) => prev + 1);
    } else {
      if (!nextFailed.includes(currentQuestion.id)) {
        nextFailed.push(currentQuestion.id);
        setFailedIds(nextFailed);
      }
    }

    setQuestionAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: answerTextOrChoiceId,
    }));

    // 次の設問へ進む (試験モード以外は自動で進む)
    if (mode !== 'exam') {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx((prev) => prev + 1);
      } else {
        // 全問終了
        setCurrentIdx(questions.length); // 完了フラグ用インデックス
      }
    }
  };

  // セッションの強制消去 (クリア完了後など)
  const clearSession = () => {
    LocalAttemptSession.clear(quizId, userId);
  };

  return {
    currentIdx,
    setCurrentIdx,
    answeredIds,
    failedIds,
    questionAnswers,
    score,
    elapsedSeconds,
    timeLeft,
    showAnswer,
    setShowAnswer,
    handleAnswerSubmit,
    clearSession,
    isFinished: answeredIds.length >= questions.length,
  };
}
