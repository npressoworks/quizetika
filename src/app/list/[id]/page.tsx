'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getQuizList, getQuizzesInList, getQuestionsInList, QuestionInListEntry } from '@/services/quiz-list';
import { QuizList, Quiz, resolveListType } from '@/types';
import {
  initQuestionListSession,
  buildQuestionListPlayUrl,
} from '@/lib/question-list-session';
import { Play, Edit, ArrowLeft, Layers, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function excerpt(text: string, maxLen = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

export default function QuizListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const listId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [quizList, setQuizList] = useState<QuizList | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<QuestionInListEntry[]>([]);

  const listType = quizList ? resolveListType(quizList) : 'quiz';
  const isQuestionList = listType === 'question';

  useEffect(() => {
    if (!listId) return;

    const fetchListDetails = async () => {
      try {
        setLoading(true);
        const listData = await getQuizList(listId);
        if (!listData) return;

        setQuizList(listData);
        const resolved = resolveListType(listData);

        if (resolved === 'question') {
          const questionData = await getQuestionsInList(listId);
          setQuestions(questionData);
          setQuizzes([]);
        } else {
          const quizzesData = await getQuizzesInList(listId);
          setQuizzes(quizzesData);
          setQuestions([]);
        }
      } catch (err) {
        console.error('Failed to load quiz list:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchListDetails();
  }, [listId]);

  const handleStartSequentialPlay = () => {
    if (quizzes.length === 0) {
      alert('クイズが収録されていません。');
      return;
    }
    const firstQuiz = quizzes[0];
    router.push(`/quiz/${firstQuiz.id}/play?listId=${listId}&mode=list`);
  };

  const handleStartQuestionListPlay = () => {
    if (questions.length === 0) {
      alert('問題が収録されていません。');
      return;
    }
    const entries = questions.map((e) => ({
      questionId: e.question.id,
      parentQuizId: e.parentQuizId,
    }));
    initQuestionListSession(listId, entries);
    const session = { listId, entries, currentIndex: 0 };
    router.push(buildQuestionListPlayUrl(session, 0));
  };

  const handlePlayQuiz = (quizId: string) => {
    router.push(`/quiz/${quizId}/play`);
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-10 text-muted-foreground">読み込み中...</div>
    );
  }

  if (!quizList) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-10">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-5 py-16 text-center text-muted-foreground">
          <Inbox size={48} className="mb-4 opacity-50" />
          <h2 className="text-lg font-semibold text-foreground">リストが見つかりません</h2>
          <p className="mt-2">指定されたリストは削除されたか、存在しない可能性があります。</p>
          <Button className="mt-5" onClick={() => router.push('/')}>
            トップへ戻る
          </Button>
        </div>
      </div>
    );
  }

  const isCreator = user && user.id === quizList.authorId;

  return (
    <div className="mx-auto max-w-[900px] animate-in px-5 py-10 fade-in duration-300">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-6 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={18} />
        <span>戻る</span>
      </button>

      <Card className="mb-8 overflow-hidden py-0">
        <div className="relative flex h-[260px] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary/20 to-accent/10">
          {quizList.coverImageUrl && (
            <img
              src={quizList.coverImageUrl}
              alt={quizList.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-background/95 via-background/40 to-transparent p-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Layers size={14} />
                <span>{isQuestionList ? '問題リスト' : 'リストパッケージ'}</span>
              </div>
              <h1 className="text-3xl font-extrabold leading-tight text-foreground">
                {quizList.title}
              </h1>
              <p className="max-w-[700px] text-base leading-relaxed text-muted-foreground">
                {quizList.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/30 px-8 py-5">
          <div className="flex items-center gap-3">
            <img
              src={
                quizList.authorAvatar ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${quizList.authorId}`
              }
              alt={quizList.authorName}
              className="size-10 rounded-full border-2 border-primary"
            />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">作成者</span>
              <span className="font-semibold text-foreground">{quizList.authorName}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isCreator && (
              <Button
                variant="outline"
                onClick={() => router.push(`/list/${listId}/edit`)}
              >
                <Edit size={16} />
                リストを編集する
              </Button>
            )}

            {isQuestionList ? (
              <Button
                onClick={handleStartQuestionListPlay}
                disabled={questions.length === 0}
                data-testid="question-list-play-start"
                data-analytics="quiz-question-list-play-start"
              >
                <Play size={16} />
                問題リストプレイ開始
              </Button>
            ) : (
              <Button
                onClick={handleStartSequentialPlay}
                disabled={quizzes.length === 0}
                data-analytics="quiz-list-play-start"
              >
                <Play size={16} />
                リストプレイ開始
              </Button>
            )}
          </div>
        </div>
      </Card>

      {isQuestionList ? (
        <div>
          <h2 className="mb-5 flex items-center gap-2.5 text-xl font-bold text-foreground">
            収録問題一覧 ({questions.length}問)
          </h2>
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-5 py-16 text-center text-muted-foreground">
              <Inbox size={48} className="mb-4 opacity-50" />
              <p>問題が収録されていません。</p>
              {isCreator && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push(`/list/${listId}/edit`)}
                >
                  リストを編集する
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {questions.map((entry, idx) => (
                <Card key={entry.question.id} size="sm" className="py-4">
                  <CardContent className="flex items-center gap-5">
                    <span className="min-w-[30px] text-2xl font-extrabold text-primary/80">
                      #{idx + 1}
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="text-[0.95rem] text-foreground">
                        {excerpt(entry.question.questionText)}
                      </p>
                      <span className="text-sm text-muted-foreground">
                        親: {entry.parentQuizTitle}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 className="mb-5 flex items-center gap-2.5 text-xl font-bold text-foreground">
            収録クイズ一覧 ({quizzes.length}個の作品)
          </h2>
          {quizzes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-5 py-16 text-center text-muted-foreground">
              <Inbox size={48} className="mb-4 opacity-50" />
              <p>このリストにはまだクイズが含まれていません。</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {quizzes.map((quiz, idx) => (
                <Card
                  key={quiz.id}
                  size="sm"
                  className={cn(
                    'py-4 transform-gpu backface-hidden',
                    'transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    'hover:-translate-y-1 hover:shadow-md hover:shadow-primary/10 hover:ring-primary/25',
                    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  )}
                >
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-5">
                      <span className="min-w-[30px] text-2xl font-extrabold text-primary/80">
                        #{idx + 1}
                      </span>
                      {quiz.thumbnailUrl && (
                        <img
                          src={quiz.thumbnailUrl}
                          alt={quiz.title}
                          className="h-[60px] w-[90px] rounded-md object-cover"
                        />
                      )}
                      <div className="flex flex-col gap-1">
                        <span className="text-base font-semibold text-foreground">
                          {quiz.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            難易度 {quiz.difficulty}
                          </Badge>
                          <span>問題数: {quiz.questionCount}問</span>
                          <span>プレイ数: {quiz.playCount || 0}回</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={() => handlePlayQuiz(quiz.id)}
                    >
                      <Play size={14} />
                      単体で解く
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
