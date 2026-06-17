'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { saveQuiz, getQuiz, updateQuiz } from '@/services/quiz';
import {
  validateQuizForPublish,
  collectQuestionTextValidationErrors,
  normalizeTag,
  QuizPublishValidationError,
} from '@/services/quiz-validation';
import {
  FieldValidationMessages,
  QuizEditorErrorSummary,
  scrollToFirstValidationError,
} from '@/components/quiz/editor/quiz-editor-validation';
import { hasAnyQuestionUserInput } from '@/services/quiz-question-input';
import {
  createDefaultChoices,
  MAX_MULTIPLE_CHOICE_COUNT,
  MIN_MULTIPLE_CHOICE_COUNT,
} from '@/services/quiz-choice-utils';
import { Quiz, Question } from '@/types';
import { editorClasses as styles } from '@/components/quiz/editor/quiz-editor-classes';
import { Plus, AlertTriangle, ArrowLeft, Sparkles } from 'lucide-react';
import { reindexCorrectOrder } from '@/components/sorting/sortable-sorting-list';
import {
  buildTestPlayPayload,
  consumeTestPlayDraftForEditor,
  getQuizEditorSourcePath,
  hasPlayableQuestions,
  saveTestPlayPayload,
  TEST_PLAY_RESTORE_QUERY,
} from '@/lib/test-play';
import { resolveQuizFormat, type QuizFormat } from '@/lib/quiz-format';
import {
  createTrueFalseChoices,
  findTrueFalseChoiceId,
  resolveTrueFalseCorrectSide,
} from '@/lib/true-false-defaults';
import { getFormatLabel } from '@/lib/quiz-format-labels';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { AuthorQuizReferencePanel } from '@/components/quiz/author-quiz-reference-panel';
import { isReferenceLinkQuestion } from '@/lib/linked-question';
import { EditorFormSkeleton } from '@/components/quiz/editor-skeleton';
import { QuizFormatSelector } from '@/components/quiz/editor/quiz-format-selector';
import { QuizMetadataSection } from '@/components/quiz/editor/quiz-metadata-section';
import { QuestionCard } from '@/components/quiz/editor/question-card';
import { QuizEditorActionBar } from '@/components/quiz/editor/quiz-editor-action-bar';
import { AiQuizAuthoringPanel } from '@/components/quiz/editor/ai-quiz-authoring-panel';
import { AiQuizProUpsell } from '@/components/quiz/editor/ai-quiz-pro-upsell';
import { useAiQuizAuthoring } from '@/hooks/useAiQuizAuthoring';
import { useAiChatAssistant } from '@/hooks/useAiChatAssistant';
import { AiChatAssistantButton } from '@/components/quiz/editor/ai-chat-assistant-button';
import { AiChatAssistantPanel } from '@/components/quiz/editor/ai-chat-assistant-panel';
import { Button } from '@/components/ui/button';
import { hasUnlimitedAiQuestionsForUser } from '@/lib/pricing-entitlement';
import type { QuestionEditorHandlers } from '@/components/quiz/editor/question-editor-types';
import type { GenreMetadata, TagMetadata } from '@/types';

interface QuizEditorProps {
  quizId?: string;
  initialGenres?: GenreMetadata[];
  initialTags?: TagMetadata[];
  initialQuiz?: Quiz | null;
}

// 類似 canonical タグの定義 (要件 1.3 タグ名寄せ用)
const CANONICAL_TAGS = [
  'React',
  'TypeScript',
  'Next.js',
  'JavaScript',
  'CSS',
  'HTML',
  'Firebase',
  'Python',
  'Go',
  'Rust',
  'Vue',
  'Flutter',
  'React Native',
  'Database',
  'Git'
];

export const QuizEditorContent: React.FC<QuizEditorProps> = ({
  quizId,
  initialGenres,
  initialQuiz,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { genres: activeGenres, loading: genresLoading, error: genresError, refetch: refetchGenres } =
    useActiveGenres(initialGenres);

  const [loading, setLoading] = useState(false);
  const [initialFetchLoading, setInitialFetchLoading] = useState(
    !!quizId && !initialQuiz
  );
  const [validationErrors, setValidationErrors] = useState<QuizPublishValidationError[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  // トースト通知ステート
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // フォームステート
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [genre, setGenre] = useState('');
  const [format, setFormat] = useState<QuizFormat>('mixed');

  // タグ関連ステート
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [originalTags, setOriginalTags] = useState<string[]>([]);
  const [suggestedTag, setSuggestedTag] = useState<string | null>(null);

  // 問題関連ステート
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cowNoticeIds, setCowNoticeIds] = useState<Set<string>>(new Set());
  /** テストプレイ復帰後に Firestore 取得でドラフトを上書きしない */
  const skipServerQuizLoadRef = useRef(false);
  const prevQuizIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const onFocus = () => refetchGenres();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetchGenres]);

  // ウミガメスープ必須キーワード入力用の一時ステート
  const [keywordInputs, setKeywordInputs] = useState<Record<number, string>>({});

  const handleKeywordInputChange = (qIdx: number, val: string) => {
    setKeywordInputs({ ...keywordInputs, [qIdx]: val });
  };

  const handleAddKeyword = (qIdx: number) => {
    const kw = (keywordInputs[qIdx] ?? '').trim();
    if (!kw) return;

    const nextQuestions = [...questions];
    const currentKeywords = nextQuestions[qIdx].truthKeywords ?? [];

    if (currentKeywords.includes(kw)) {
      alert('すでに同じキーワードが登録されています。');
      return;
    }

    nextQuestions[qIdx].truthKeywords = [...currentKeywords, kw];
    setQuestions(nextQuestions);
    setKeywordInputs({ ...keywordInputs, [qIdx]: '' });
  };

  const handleRemoveKeyword = (qIdx: number, kwIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].truthKeywords) {
      nextQuestions[qIdx].truthKeywords = nextQuestions[qIdx].truthKeywords!.filter((_, i) => i !== kwIdx);
      setQuestions(nextQuestions);
    }
  };

  const applyDraftToEditor = (draft: Omit<Quiz, 'id'> & { id?: string }) => {
    setTitle(draft.title);
    setDescription(draft.description);
    setThumbnailUrl(draft.thumbnailUrl);
    setDifficulty(
      draft.difficulty >= 1 && draft.difficulty <= 5 ? draft.difficulty : null
    );
    setGenre(draft.genre);
    setTags(draft.tags ?? []);
    setOriginalTags(draft.originalTags ?? []);
    setQuestions(draft.questions);
    setFormat(resolveQuizFormat(draft));
  };

  useEffect(() => {
    if (prevQuizIdRef.current !== undefined && prevQuizIdRef.current !== quizId) {
      skipServerQuizLoadRef.current = false;
    }
    prevQuizIdRef.current = quizId;
  }, [quizId]);

  // 編集モードの場合のデータ取得と所有者チェック
  useEffect(() => {
    if (authLoading) return;

    const sourcePath = getQuizEditorSourcePath(quizId);
    const restoringFromTestPlay = searchParams.get(TEST_PLAY_RESTORE_QUERY) === '1';

    // 復帰クエリありのときはユーザー確定まで通常ロードを走らせない（競合で問題が重複するのを防ぐ）
    if (restoringFromTestPlay && !user) return;

    if (skipServerQuizLoadRef.current) {
      if (restoringFromTestPlay) {
        router.replace(sourcePath);
      }
      return;
    }

    if (restoringFromTestPlay && user) {
      const draft = consumeTestPlayDraftForEditor(user.id, sourcePath);
      if (draft) {
        skipServerQuizLoadRef.current = true;
        applyDraftToEditor(draft);
        setInitialFetchLoading(false);
        router.replace(sourcePath);
        return;
      }
      // 既に consume 済み、または payload 欠落 — 通常ロードにフォールバックしない
      router.replace(sourcePath);
      return;
    }

    if (!quizId) {
      addDefaultQuestion('mixed');
      return;
    }

    if (initialQuiz) {
      if (user && initialQuiz.authorId !== user.id) {
        setUnauthorized(true);
        setErrorText('このクイズを編集する権限がありません。');
      } else {
        applyDraftToEditor(initialQuiz);
      }
      setInitialFetchLoading(false);
      return;
    }

    let cancelled = false;

    const fetchQuiz = async () => {
      try {
        const quiz = await getQuiz(quizId);
        if (cancelled || skipServerQuizLoadRef.current) return;
        if (quiz) {
          if (user && quiz.authorId !== user.id) {
            setUnauthorized(true);
            setErrorText('このクイズを編集する権限がありません。');
            return;
          }
          applyDraftToEditor(quiz);
        } else {
          setErrorText('対象のクイズが見つかりません。');
        }
      } catch (err: any) {
        if (!cancelled && !skipServerQuizLoadRef.current) {
          setErrorText('クイズの取得に失敗しました。');
        }
      } finally {
        if (!cancelled && !skipServerQuizLoadRef.current) {
          setInitialFetchLoading(false);
        }
      }
    };

    fetchQuiz();

    return () => {
      cancelled = true;
    };
  }, [quizId, user, authLoading, searchParams, router, initialQuiz]);

  // 修正指摘からのスクロール連動 (要件 2.4)
  useEffect(() => {
    if (questions.length > 0) {
      const questionIdxParam = searchParams.get('questionIdx');
      if (questionIdxParam !== null) {
        const idx = parseInt(questionIdxParam);
        if (!isNaN(idx) && idx >= 0 && idx < questions.length) {
          // 少し待ってレンダリング後にスクロール
          setTimeout(() => {
            const element = document.getElementById(`question-card-${idx}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.style.borderColor = 'var(--color-accent)';
              element.style.boxShadow = '0 0 15px var(--color-accent-glow)';
            }
          }, 300);
        }
      }
    }
  }, [questions, searchParams]);

  // デフォルト問題の追加
  const addDefaultQuestion = (customFormat?: typeof format) => {
    const activeFormat = customFormat || format;
    const defaultType = activeFormat === 'mixed' ? 'multiple-choice' : activeFormat;

    const newQuestion: Question = {
      id: Math.random().toString(36).substring(2, 9),
      type: defaultType,
      questionText: '',
      explanation: '',
      imageUrl: null,
      hint: null,
      limitTime: null,
      correctCount: 0,
      incorrectCount: 0,
    };

    // タイプごとの初期値設定
    if (newQuestion.type === 'multiple-choice') {
      newQuestion.choices = createDefaultChoices();
    } else if (newQuestion.type === 'true-false') {
      newQuestion.choices = createTrueFalseChoices('maru');
    } else if (newQuestion.type === 'text-input' || newQuestion.type === 'quick-press') {
      newQuestion.correctTextAnswerList = ['正解テキスト'];
    } else if (newQuestion.type === 'sorting') {
      newQuestion.sortingItems = [
        { id: '1', text: '要素 1', correctOrder: 0 },
        { id: '2', text: '要素 2', correctOrder: 1 },
      ];
    } else if (newQuestion.type === 'association') {
      newQuestion.associationHints = ['ヒント 1'];
      newQuestion.correctTextAnswerList = ['正解テキスト'];
    } else if (newQuestion.type === 'lateral-thinking') {
      newQuestion.aiContextDetails = '';
      newQuestion.truthKeywords = [];
    }

    setQuestions((prev) => [...prev, newQuestion]);
  };

  // 問題の追加
  const handleAddQuestion = () => {
    addDefaultQuestion();
  };

  // クイズ形式が変更された際の処理 (一括変換ロジック含む)
  const handleFormatChange = (newFormat: typeof format) => {
    if (newFormat === format) return;

    if (hasAnyQuestionUserInput(questions)) {
      const confirmMsg = newFormat === 'mixed'
        ? '複合クイズ形式に変更します。既存の問題タイプは維持されますが、各問題のトグルから選択式、記述式、並び替えを自由に選択できるようになります。よろしいですか？'
        : `クイズ全体の出題形式を「${getFormatLabel(newFormat)}」に変更します。既存のすべての問題が「${getFormatLabel(newFormat)}」形式に一括変換されます（一部のデータが初期化される可能性があります）。よろしいですか？`;

      if (!confirm(confirmMsg)) return;
    }

    setFormat(newFormat);

    const defaultType = newFormat === 'mixed' ? 'multiple-choice' : newFormat;
    const nextQuestions = questions.map((q) => {
      let targetType = q.type;
      if (newFormat === 'mixed') {
        const allowedTypes = ['multiple-choice', 'true-false', 'text-input', 'sorting'];
        if (!allowedTypes.includes(q.type)) {
          targetType = 'multiple-choice';
        }
      } else {
        targetType = defaultType;
      }

      const updated: Question = {
        ...q,
        type: targetType,
      };

      if (targetType === 'multiple-choice') {
        updated.choices = q.choices && q.choices.length >= MIN_MULTIPLE_CHOICE_COUNT && q.choices.length <= MAX_MULTIPLE_CHOICE_COUNT
          ? q.choices
          : createDefaultChoices();
        updated.correctTextAnswerList = undefined;
        updated.sortingItems = undefined;
        updated.associationHints = undefined;
        updated.aiContextDetails = undefined;
        updated.truthKeywords = undefined;
      } else if (targetType === 'true-false') {
        updated.choices = createTrueFalseChoices(
          resolveTrueFalseCorrectSide(q.choices)
        );
        updated.correctTextAnswerList = undefined;
        updated.sortingItems = undefined;
        updated.associationHints = undefined;
        updated.aiContextDetails = undefined;
        updated.truthKeywords = undefined;
      } else if (targetType === 'text-input' || targetType === 'quick-press') {
        updated.correctTextAnswerList = q.correctTextAnswerList || ['正解テキスト'];
        updated.choices = undefined;
        updated.sortingItems = undefined;
        updated.associationHints = undefined;
        updated.aiContextDetails = undefined;
        updated.truthKeywords = undefined;
      } else if (targetType === 'sorting') {
        updated.sortingItems = q.sortingItems || [
          { id: '1', text: '要素 1', correctOrder: 0 },
          { id: '2', text: '要素 2', correctOrder: 1 },
        ];
        updated.choices = undefined;
        updated.correctTextAnswerList = undefined;
        updated.associationHints = undefined;
        updated.aiContextDetails = undefined;
        updated.truthKeywords = undefined;
      } else if (targetType === 'association') {
        updated.associationHints = q.associationHints || ['ヒント 1'];
        updated.correctTextAnswerList = q.correctTextAnswerList || ['正解テキスト'];
        updated.choices = undefined;
        updated.sortingItems = undefined;
        updated.aiContextDetails = undefined;
        updated.truthKeywords = undefined;
      } else if (targetType === 'lateral-thinking') {
        updated.aiContextDetails = q.aiContextDetails || '';
        updated.truthKeywords = q.truthKeywords || [];
        updated.choices = undefined;
        updated.correctTextAnswerList = undefined;
        updated.sortingItems = undefined;
        updated.associationHints = undefined;
      }

      return updated;
    });

    setQuestions(nextQuestions);
  };

  // 問題の削除
  const linkedQuestionIds = React.useMemo(
    () => new Set(questions.map((q) => q.id).filter(Boolean) as string[]),
    [questions]
  );

  const canUseAiAuthoring = hasUnlimitedAiQuestionsForUser(user);
  const editorPath = quizId ? `/quiz/${quizId}/edit` : '/quiz/create';

  const aiAuthoring = useAiQuizAuthoring({
    userId: user?.id,
    isProUser: canUseAiAuthoring,
    quizId,
    onAppendQuestions: (generated) => {
      setQuestions((prev) => [...prev, ...generated]);
      setToastMessage(`AI作問が完了し、問題が${generated.length}件追加されました！`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 4000);
    },
    onSetThumbnailUrl: setThumbnailUrl,
  });

  const aiChat = useAiChatAssistant({
    userId: user?.id,
    isProUser: canUseAiAuthoring,
    quizState: {
      title,
      description,
      genre,
      tags,
      questions,
      thumbnailUrl,
    },
    setQuestions,
    setTitle,
    setDescription,
    setThumbnailUrl,
  });

  const aiThumbnailUsageLabel =
    aiAuthoring.usageThumbnail
      ? aiAuthoring.usageThumbnail.limit === null ||
        aiAuthoring.usageThumbnail.remainingToday === null
        ? `本日のサムネ: 無制限（${aiAuthoring.usageThumbnail.usedToday}回使用）`
        : `本日のサムネ残り: ${aiAuthoring.usageThumbnail.remainingToday}/${aiAuthoring.usageThumbnail.limit}回`
      : undefined;

  const handleLinkReferenceQuestion = (question: Question) => {
    if (linkedQuestionIds.has(question.id)) {
      alert('この問題はすでにリンクされています。');
      return;
    }
    setQuestions((prev) => [...prev, { ...question, linkKind: 'reference' }]);
  };

  const handleUnlinkReferenceQuestion = (questionId: string) => {
    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx === -1) return;
    if (questions.length <= 1) {
      alert('最低1問は必要です。');
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    setCowNoticeIds((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  };

  const handleDetachReferenceForEdit = (qIdx: number) => {
    const next = [...questions];
    const q = next[qIdx];
    if (!isReferenceLinkQuestion(q)) return;
    next[qIdx] = { ...q, linkKind: 'owned' };
    setQuestions(next);
    if (q.id) {
      setCowNoticeIds((prev) => new Set(prev).add(q.id));
    }
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert('最低1問は必要です。');
      return;
    }
    const nextQuestions = questions.filter((_, i) => i !== idx);
    setQuestions(nextQuestions);
  };

  // 問題タイプの切り替え (選択式 / 記述式 / 早押し / 並び替え / 連想 / ウミガメのスープ)
  const handleToggleQuestionType = (idx: number, type: 'multiple-choice' | 'true-false' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking') => {
    if (questions[idx].type === type) return;

    const nextQuestions = [...questions];
    nextQuestions[idx].type = type;

    if (type === 'multiple-choice' && !nextQuestions[idx].choices) {
      nextQuestions[idx].choices = createDefaultChoices();
      nextQuestions[idx].correctTextAnswerList = undefined;
      nextQuestions[idx].textInputMode = undefined;
      nextQuestions[idx].textInputCharCount = undefined;
      nextQuestions[idx].sortingItems = undefined;
      nextQuestions[idx].associationHints = undefined;
      nextQuestions[idx].aiContextDetails = undefined;
      nextQuestions[idx].truthKeywords = undefined;
    } else if (type === 'true-false') {
      nextQuestions[idx].choices = createTrueFalseChoices(
        resolveTrueFalseCorrectSide(nextQuestions[idx].choices)
      );
      nextQuestions[idx].correctTextAnswerList = undefined;
      nextQuestions[idx].textInputMode = undefined;
      nextQuestions[idx].textInputCharCount = undefined;
      nextQuestions[idx].sortingItems = undefined;
      nextQuestions[idx].associationHints = undefined;
      nextQuestions[idx].aiContextDetails = undefined;
      nextQuestions[idx].truthKeywords = undefined;
    } else if ((type === 'text-input' || type === 'quick-press') && !nextQuestions[idx].correctTextAnswerList) {
      nextQuestions[idx].correctTextAnswerList = ['正解テキスト'];
      nextQuestions[idx].choices = undefined;
      nextQuestions[idx].sortingItems = undefined;
      nextQuestions[idx].associationHints = undefined;
      nextQuestions[idx].aiContextDetails = undefined;
      nextQuestions[idx].truthKeywords = undefined;
      if (type === 'quick-press') {
        nextQuestions[idx].textInputMode = undefined;
        nextQuestions[idx].textInputCharCount = undefined;
      }
    } else if ((type === 'text-input' || type === 'quick-press') && nextQuestions[idx].correctTextAnswerList) {
      nextQuestions[idx].choices = undefined;
      nextQuestions[idx].sortingItems = undefined;
      nextQuestions[idx].associationHints = undefined;
      nextQuestions[idx].aiContextDetails = undefined;
      nextQuestions[idx].truthKeywords = undefined;
      if (type === 'quick-press') {
        nextQuestions[idx].textInputMode = undefined;
        nextQuestions[idx].textInputCharCount = undefined;
      }
    } else if (type === 'sorting' && !nextQuestions[idx].sortingItems) {
      nextQuestions[idx].sortingItems = [
        { id: '1', text: '要素 1', correctOrder: 0 },
        { id: '2', text: '要素 2', correctOrder: 1 },
      ];
      nextQuestions[idx].choices = undefined;
      nextQuestions[idx].correctTextAnswerList = undefined;
      nextQuestions[idx].textInputMode = undefined;
      nextQuestions[idx].textInputCharCount = undefined;
      nextQuestions[idx].associationHints = undefined;
      nextQuestions[idx].aiContextDetails = undefined;
      nextQuestions[idx].truthKeywords = undefined;
    } else if (type === 'association') {
      if (!nextQuestions[idx].associationHints) {
        nextQuestions[idx].associationHints = ['ヒント 1'];
      }
      if (!nextQuestions[idx].correctTextAnswerList) {
        nextQuestions[idx].correctTextAnswerList = ['正解テキスト'];
      }
      nextQuestions[idx].choices = undefined;
      nextQuestions[idx].sortingItems = undefined;
      nextQuestions[idx].aiContextDetails = undefined;
      nextQuestions[idx].truthKeywords = undefined;
    } else if (type === 'lateral-thinking') {
      nextQuestions[idx].aiContextDetails = '';
      nextQuestions[idx].truthKeywords = [];
      nextQuestions[idx].choices = undefined;
      nextQuestions[idx].correctTextAnswerList = undefined;
      nextQuestions[idx].textInputMode = undefined;
      nextQuestions[idx].textInputCharCount = undefined;
      nextQuestions[idx].sortingItems = undefined;
      nextQuestions[idx].associationHints = undefined;
    }

    setQuestions(nextQuestions);
  };

  // 問題テキストの更新
  const handleQuestionTextChange = (idx: number, text: string) => {
    const nextQuestions = [...questions];
    nextQuestions[idx].questionText = text;
    setQuestions(nextQuestions);
  };

  // 解説テキストの更新
  const handleExplanationChange = (idx: number, text: string) => {
    const nextQuestions = [...questions];
    nextQuestions[idx].explanation = text;
    setQuestions(nextQuestions);
  };

  const handleTrueFalseCorrectChange = (qIdx: number, side: 'maru' | 'batsu') => {
    const nextQuestions = [...questions];
    const q = nextQuestions[qIdx];
    nextQuestions[qIdx] = {
      ...q,
      choices: createTrueFalseChoices(side, {
        maruId: findTrueFalseChoiceId(q.choices, 'maru'),
        batsuId: findTrueFalseChoiceId(q.choices, 'batsu'),
      }),
    };
    setQuestions(nextQuestions);
  };

  // 選択肢のテキスト更新
  const handleChoiceTextChange = (qIdx: number, cIdx: number, text: string) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].choices) {
      nextQuestions[qIdx].choices![cIdx].choiceText = text;
      setQuestions(nextQuestions);
    }
  };

  // 選択肢の正解切り替え（複数正解をチェックで設定可能）
  const handleChoiceCorrectToggle = (qIdx: number, cIdx: number) => {
    const nextQuestions = [...questions];
    const choices = nextQuestions[qIdx].choices;
    if (!choices) return;

    const toggled = choices[cIdx];
    const nextCorrect = !toggled.isCorrect;
    const correctCount = choices.filter((c) => c.isCorrect).length;

    if (!nextCorrect && correctCount <= 1) {
      return;
    }

    choices[cIdx] = { ...toggled, isCorrect: nextCorrect };
    nextQuestions[qIdx].choices = [...choices];
    setQuestions(nextQuestions);
  };

  const handleAddChoice = (qIdx: number) => {
    const nextQuestions = [...questions];
    const choices = nextQuestions[qIdx].choices;
    if (!choices) return;

    if (choices.length >= MAX_MULTIPLE_CHOICE_COUNT) {
      alert(`選択肢は最大${MAX_MULTIPLE_CHOICE_COUNT}個までです。`);
      return;
    }

    const newId = Math.random().toString(36).substring(2, 9);
    nextQuestions[qIdx].choices = [
      ...choices,
      {
        id: newId,
        choiceText: `選択肢 ${choices.length + 1}`,
        isCorrect: false,
        selectedCount: 0,
      },
    ];
    setQuestions(nextQuestions);
  };

  const handleRemoveChoice = (qIdx: number, cIdx: number) => {
    const nextQuestions = [...questions];
    const choices = nextQuestions[qIdx].choices;
    if (!choices) return;

    if (choices.length <= MIN_MULTIPLE_CHOICE_COUNT) {
      alert(`選択肢は最低${MIN_MULTIPLE_CHOICE_COUNT}個必要です。`);
      return;
    }

    const removedWasCorrect = choices[cIdx].isCorrect;
    const filtered = choices.filter((_, idx) => idx !== cIdx);
    if (removedWasCorrect && filtered.length > 0) {
      filtered[0] = { ...filtered[0], isCorrect: true };
    }

    nextQuestions[qIdx].choices = filtered;
    setQuestions(nextQuestions);
  };

  // 記述式・早押し正解のテキスト更新
  const handleTextAnswerChange = (qIdx: number, aIdx: number, text: string) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].correctTextAnswerList) {
      nextQuestions[qIdx].correctTextAnswerList![aIdx] = text;
      setQuestions(nextQuestions);
    }
  };

  // 記述式・早押し正解の追加
  const handleAddTextAnswer = (qIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].correctTextAnswerList) {
      nextQuestions[qIdx].correctTextAnswerList!.push('');
      setQuestions(nextQuestions);
    }
  };

  // 記述式・早押し正解の削除
  const handleRemoveTextAnswer = (qIdx: number, aIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].correctTextAnswerList) {
      if (nextQuestions[qIdx].correctTextAnswerList!.length <= 1) {
        alert('最低1つの正解候補が必要です。');
        return;
      }
      nextQuestions[qIdx].correctTextAnswerList = nextQuestions[qIdx].correctTextAnswerList!.filter((_, i) => i !== aIdx);
      setQuestions(nextQuestions);
    }
  };

  const handleTextInputModeChange = (qIdx: number, mode: 'text' | 'numeric' | 'char-count') => {
    const nextQuestions = [...questions];
    if (mode === 'text') {
      nextQuestions[qIdx].textInputMode = undefined;
      nextQuestions[qIdx].textInputCharCount = undefined;
    } else {
      nextQuestions[qIdx].textInputMode = mode;
      if (mode === 'char-count' && nextQuestions[qIdx].textInputCharCount == null) {
        nextQuestions[qIdx].textInputCharCount = 4;
      }
      if (mode !== 'char-count') {
        nextQuestions[qIdx].textInputCharCount = undefined;
      }
      if (mode === 'numeric') {
        const list = nextQuestions[qIdx].correctTextAnswerList ?? [];
        if (list.length === 1 && list[0] === '正解テキスト') {
          nextQuestions[qIdx].correctTextAnswerList = ['0'];
        }
      }
    }
    setQuestions(nextQuestions);
  };

  const handleTextInputCharCountChange = (qIdx: number, value: string) => {
    const nextQuestions = [...questions];
    const parsed = parseInt(value, 10);
    nextQuestions[qIdx].textInputCharCount = Number.isNaN(parsed) ? undefined : parsed;
    setQuestions(nextQuestions);
  };

  // 並び替え要素のテキスト変更
  const handleSortingItemTextChange = (qIdx: number, itemIdx: number, text: string) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].sortingItems) {
      nextQuestions[qIdx].sortingItems![itemIdx].text = text;
      setQuestions(nextQuestions);
    }
  };

  // 並び替え要素の追加
  const handleAddSortingItem = (qIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].sortingItems) {
      const items = nextQuestions[qIdx].sortingItems!;
      if (items.length >= 6) {
        alert('並び替え要素は最大6個までです。');
        return;
      }
      const newId = Math.random().toString(36).substring(2, 9);
      nextQuestions[qIdx].sortingItems = [
        ...items,
        { id: newId, text: `要素 ${items.length + 1}`, correctOrder: items.length }
      ];
      setQuestions(nextQuestions);
    }
  };

  // 並び替え要素の削除
  const handleRemoveSortingItem = (qIdx: number, itemIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].sortingItems) {
      const items = nextQuestions[qIdx].sortingItems!;
      if (items.length <= 2) {
        alert('並び替え要素は最低2個必要です。');
        return;
      }
      const filtered = items.filter((_, idx) => idx !== itemIdx);
      // correctOrder を再割り当て
      nextQuestions[qIdx].sortingItems = filtered.map((item, idx) => ({
        ...item,
        correctOrder: idx
      }));
      setQuestions(nextQuestions);
    }
  };

  // 並び替え要素のドラッグ＆ドロップ並べ替え
  const handleSortingItemsReorder = (qIdx: number, reorderedItems: { id: string; text: string; correctOrder?: number }[]) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].sortingItems) {
      nextQuestions[qIdx].sortingItems = reindexCorrectOrder(reorderedItems);
      setQuestions(nextQuestions);
    }
  };

  // 連想ヒントのテキスト変更
  const handleAssociationHintTextChange = (qIdx: number, hintIdx: number, text: string) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].associationHints) {
      nextQuestions[qIdx].associationHints![hintIdx] = text;
      setQuestions(nextQuestions);
    }
  };

  // 連想ヒントの追加
  const handleAddAssociationHint = (qIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].associationHints) {
      const hints = nextQuestions[qIdx].associationHints!;
      if (hints.length >= 5) {
        alert('連想ヒントは最大5個までです。');
        return;
      }
      nextQuestions[qIdx].associationHints = [...hints, `ヒント ${hints.length + 1}`];
      setQuestions(nextQuestions);
    }
  };

  // 連想ヒントの削除
  const handleRemoveAssociationHint = (qIdx: number, hintIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].associationHints) {
      const hints = nextQuestions[qIdx].associationHints!;
      if (hints.length <= 1) {
        alert('連想ヒントは最低1個必要です。');
        return;
      }
      nextQuestions[qIdx].associationHints = hints.filter((_, idx) => idx !== hintIdx);
      setQuestions(nextQuestions);
    }
  };

  const handleAiContextDetailsChange = (qIdx: number, text: string) => {
    const nextQuestions = [...questions];
    nextQuestions[qIdx].aiContextDetails = text;
    setQuestions(nextQuestions);
  };

  const handleSourceUrlChange = (qIdx: number, url: string | null) => {
    const nextQuestions = [...questions];
    nextQuestions[qIdx].sourceUrl = url;
    setQuestions(nextQuestions);
  };

  // タグ入力時のリアルタイム正規化・類似サジェスト (要件 1.3)
  const handleTagInputChange = (val: string) => {
    setTagInput(val);

    if (!val.trim()) {
      setSuggestedTag(null);
      return;
    }

    const normalized = normalizeTag(val);

    // 類似 canonical タグを判定
    const foundSimilar = CANONICAL_TAGS.find(canonical => {
      const canonicalNorm = normalizeTag(canonical);
      // 部分一致、または包含関係にあるかチェック
      return normalized.length >= 2 &&
        (normalized.includes(canonicalNorm) || canonicalNorm.includes(normalized)) &&
        normalized !== canonicalNorm;
    });

    if (foundSimilar) {
      setSuggestedTag(foundSimilar);
    } else {
      setSuggestedTag(null);
    }
  };

  // タグの追加
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = tagInput.trim();
    if (!tag) return;

    if (originalTags.length >= 5) {
      alert('タグは最大5つまで登録できます。');
      return;
    }

    const normalized = normalizeTag(tag);
    if (!normalized) return;

    if (tags.includes(normalized)) {
      alert('すでに同じタグが登録されています。');
      return;
    }

    setTags([...tags, normalized]);
    setOriginalTags([...originalTags, tag]);
    setTagInput('');
    setSuggestedTag(null);
  };

  // サジェストされた canonical タグの適用
  const applySuggestedTag = () => {
    if (!suggestedTag) return;

    if (originalTags.length >= 5) {
      alert('タグは最大5つまで登録できます。');
      return;
    }

    const normalized = normalizeTag(suggestedTag);
    if (tags.includes(normalized)) {
      alert('すでに同じタグが登録されています。');
      setTagInput('');
      setSuggestedTag(null);
      return;
    }

    setTags([...tags, normalized]);
    setOriginalTags([...originalTags, suggestedTag]);
    setTagInput('');
    setSuggestedTag(null);
  };

  // タグの削除
  const handleRemoveTag = (idx: number) => {
    setTags(tags.filter((_, i) => i !== idx));
    setOriginalTags(originalTags.filter((_, i) => i !== idx));
  };

  const handleTestPlay = () => {
    if (!user) {
      alert('ログインが必要です。');
      return;
    }
    if (!hasPlayableQuestions(questions)) {
      alert('テストプレイするには、問題文が入力された問題を1問以上追加してください。');
      return;
    }

    const sourcePath = getQuizEditorSourcePath(quizId);
    const now = new Date();
    const quizData = {
      authorId: user.id,
      authorName: user.displayName,
      authorAvatar: user.avatarUrl,
      title,
      description,
      thumbnailUrl,
      difficulty: difficulty ?? 0,
      genre,
      tags,
      originalTags,
      questionIds: questions.map((q) => q.id),
      questions,
      questionCount: questions.length,
      status: 'draft' as const,
      format,
      playCount: 0,
      bookmarksCount: 0,
      flagsCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      tempPositiveCount: 0,
      tempNegativeCount: 0,
      reviewScore: null,
      reviewBadge: null,
      isReviewMasked: false,
      activeResetRequestId: null,
      canonicalGenreId: '',
      canonicalTagIds: [],
      leaderboard: [],
      leaderboardFirstPlay: [],
      leaderboardReplay: [],
      createdAt: now,
      updatedAt: now,
    };

    saveTestPlayPayload(buildTestPlayPayload(quizData, sourcePath, user.id));
    router.push('/quiz/test-play/play?mode=normal');
  };

  // 保存処理 (status = 'draft' | 'published')
  const handleSave = async (status: 'draft' | 'published') => {
    if (!user) {
      alert('ログインが必要です。');
      return;
    }

    setLoading(true);
    setValidationErrors([]);
    setErrorText(null);

    const quizData = {
      authorId: user.id,
      authorName: user.displayName,
      authorAvatar: user.avatarUrl,
      title,
      description,
      thumbnailUrl,
      difficulty: difficulty ?? 0,
      genre,
      tags,
      originalTags,
      questionIds: questions.map((q) => q.id), // 問題の独立化対応に伴い、問題IDの配列をアタッチ
      questions,
      questionCount: questions.length,
      status,
      format, // 追加
      playCount: 0,
      bookmarksCount: 0,
      flagsCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      tempPositiveCount: 0,
      tempNegativeCount: 0,
      reviewScore: null,
      reviewBadge: null,
      isReviewMasked: false,
      activeResetRequestId: null,
      canonicalGenreId: '',
      canonicalTagIds: [],
      leaderboard: [],
      leaderboardFirstPlay: [],
      leaderboardReplay: [],
    };

    // 公開時のみバリデーションチェック
    if (status === 'published') {
      const tempQuiz = { id: quizId || '', ...quizData, createdAt: new Date(), updatedAt: new Date() } as Quiz;
      const errors = validateQuizForPublish(tempQuiz);
      if (errors.length > 0) {
        setValidationErrors(errors);
        setErrorText('公開バリデーションエラーが発生しました。内容を修正してください。');
        setLoading(false);
        scrollToFirstValidationError(errors);
        return;
      }
    } else {
      // 下書きはタイトル・ジャンル必須
      const draftErrors: QuizPublishValidationError[] = [];
      if (!title.trim()) {
        draftErrors.push({ field: 'title', message: '下書き保存するにはタイトルを入力してください' });
      }
      if (!genre.trim()) {
        draftErrors.push({ field: 'genre', message: 'ジャンルを選択してください' });
      }
      questions.forEach((q, idx) => {
        if (isReferenceLinkQuestion(q)) return;
        draftErrors.push(...collectQuestionTextValidationErrors(q, idx));
      });
      if (draftErrors.length > 0) {
        setValidationErrors(draftErrors);
        setErrorText('下書き保存できません。未入力の項目を確認してください。');
        setLoading(false);
        scrollToFirstValidationError(draftErrors);
        return;
      }
    }

    try {
      if (quizId) {
        // 更新処理 (本来は updateQuiz ですが、saveQuizのインターフェースが統合されているためそれに合わせる、
        // もしくは updateQuiz を呼び出します。今回は saveQuiz に寄せています。)
        // ※ saveQuiz は内部で addDoc を行うため、編集のときは updateQuiz または saveQuiz を呼ぶように調整。
        // ここでは QuizService から updateQuiz / saveQuiz の両方が使えるので、新規と編集で使い分けます。
        await updateQuiz(quizId, {
          title,
          description,
          thumbnailUrl,
          difficulty: difficulty ?? 0,
          genre,
          tags,
          originalTags,
          questions,
          questionCount: questions.length,
          status,
          format, // 追加
        });
      } else {
        const newId = await saveQuiz(quizData, status);
        if (status === 'published') {
          router.push(`/quiz/${newId}/success`);
          return;
        }
      }

      if (status === 'published') {
        router.push(`/quiz/${quizId}/success`);
      } else {
        alert('下書きを保存しました！');
        router.push('/creator/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'クイズの保存中にエラーが発生しました。');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const questionEditorHandlers: QuestionEditorHandlers = {
    onRemoveQuestion: handleRemoveQuestion,
    onToggleQuestionType: handleToggleQuestionType,
    onQuestionTextChange: handleQuestionTextChange,
    onExplanationChange: handleExplanationChange,
    onSourceUrlChange: handleSourceUrlChange,
    onTrueFalseCorrectChange: handleTrueFalseCorrectChange,
    onChoiceTextChange: handleChoiceTextChange,
    onChoiceCorrectToggle: handleChoiceCorrectToggle,
    onAddChoice: handleAddChoice,
    onRemoveChoice: handleRemoveChoice,
    onTextAnswerChange: handleTextAnswerChange,
    onAddTextAnswer: handleAddTextAnswer,
    onRemoveTextAnswer: handleRemoveTextAnswer,
    onTextInputModeChange: handleTextInputModeChange,
    onTextInputCharCountChange: handleTextInputCharCountChange,
    onSortingItemTextChange: handleSortingItemTextChange,
    onAddSortingItem: handleAddSortingItem,
    onRemoveSortingItem: handleRemoveSortingItem,
    onSortingItemsReorder: handleSortingItemsReorder,
    onAssociationHintTextChange: handleAssociationHintTextChange,
    onAddAssociationHint: handleAddAssociationHint,
    onRemoveAssociationHint: handleRemoveAssociationHint,
    onAiContextDetailsChange: handleAiContextDetailsChange,
    onKeywordInputChange: handleKeywordInputChange,
    onAddKeyword: handleAddKeyword,
    onRemoveKeyword: handleRemoveKeyword,
    onDetachReferenceForEdit: handleDetachReferenceForEdit,
  };

  if (authLoading || initialFetchLoading) {
    return <EditorFormSkeleton data-testid="quiz-editor-skeleton" />;
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.editorCard}>
          <div className={styles.errorTitle}>
            <AlertTriangle size={24} />
            <h2>アクセス権限がありません</h2>
          </div>
          <p>クイズを作成・編集するにはログインしてください。</p>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => router.push('/login')}>
            ログイン画面へ
          </button>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className={styles.container}>
        <div className={styles.editorCard}>
          <div className={styles.errorTitle}>
            <AlertTriangle size={24} />
            <h2>アクセス権限がありません</h2>
          </div>
          <p>このクイズは他のユーザーが作成したものであるため、編集できません。</p>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => router.push(`/quiz/${quizId}`)}>
            クイズ詳細画面へ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button className={styles.removeQuestionBtn} onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={styles.title}>{quizId ? 'クイズを編集する' : 'クイズを新規作成'}</h1>
      </div>
      <p className={styles.subtitle}>クリエイティブで挑戦者をうならせるクイズや楽しんで解けるクイズを作りましょう。</p>

      <QuizEditorErrorSummary
        errorText={errorText}
        validationErrors={validationErrors}
        questions={questions}
      />

      <div className="flex flex-col gap-6">
        <QuizFormatSelector format={format} onFormatChange={handleFormatChange} />

        <QuizMetadataSection
          title={title}
          description={description}
          thumbnailUrl={thumbnailUrl}
          difficulty={difficulty}
          genre={genre}
          validationErrors={validationErrors}
          genres={activeGenres}
          genresLoading={genresLoading}
          genresError={genresError}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onAiThumbnailGenerate={() => aiAuthoring.generateThumbnail(title, description)}
          isAiThumbnailGenerating={aiAuthoring.isGeneratingThumbnail}
          canUseAiThumbnail={canUseAiAuthoring}
          aiThumbnailUsageLabel={aiThumbnailUsageLabel}
          aiThumbnailError={aiAuthoring.errorMessage}
          onDifficultyChange={setDifficulty}
          onGenreChange={setGenre}
          onGenresRetry={refetchGenres}
          originalTags={originalTags}
          tagInput={tagInput}
          suggestedTag={suggestedTag}
          onTagInputChange={handleTagInputChange}
          onAddTag={handleAddTag}
          onApplySuggestedTag={applySuggestedTag}
          onRemoveTag={handleRemoveTag}
        />

        {canUseAiAuthoring ? (
          <>
            {/* ハイブリッド起動ボタンセクション (コールドスタート対策) */}
            <div className="flex flex-wrap gap-3 mb-6 bg-muted/20 border border-border p-4 rounded-xl items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold flex items-center gap-1.5">
                  <Sparkles size={16} className="text-primary" /> AI アシスタント
                </span>
                <span className="text-xs text-muted-foreground">対話形式またはワンクリックで AI に作問やチェックを依頼できます</span>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer border-primary/40 hover:border-primary/80 transition-colors"
                  onClick={aiChat.triggerAuthoringWelcome}
                >
                  AIで作問開始
                </Button>
                <Button
                  type="button"
                  variant="default"
                  className="cursor-pointer bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                  onClick={() => aiChat.triggerQuickAction('check-all')}
                >
                  全問包括チェック
                </Button>
              </div>
            </div>

            <AiQuizAuthoringPanel
              format={format}
              isGenerating={aiAuthoring.isGeneratingQuestions}
              generationStatus={aiAuthoring.generationStatus}
              isUsageLoading={aiAuthoring.isUsageLoading}
              usageQuestions={aiAuthoring.usageQuestions}
              errorMessage={aiAuthoring.errorMessage}
              onGenerate={(prompt) =>
                aiAuthoring.generateQuestions(prompt, format, {
                  title,
                  description,
                  genre,
                })
              }
              onClearError={aiAuthoring.clearError}
            />
          </>
        ) : (
          <AiQuizProUpsell isLoggedIn={!!user} redirectPath={editorPath} />
        )}

        <div className={styles.editorCard} id="questions-section">
          <div className={styles.questionHeader}>
            <h2 className={styles.sectionTitle} style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
              問題管理
            </h2>
            <button type="button" className={styles.addQuestionBtn} onClick={handleAddQuestion}>
              <Plus size={16} /> 問題を追加
            </button>
          </div>

          {user && (
            <AuthorQuizReferencePanel
              authorId={user.id}
              onLinkQuestion={handleLinkReferenceQuestion}
              onUnlinkQuestion={handleUnlinkReferenceQuestion}
              linkedQuestionIds={linkedQuestionIds}
            />
          )}

          <FieldValidationMessages errors={validationErrors} field="questions" unscopedOnly />

          <div className={styles.questionList}>
            {questions.map((q, qIdx) => (
              <QuestionCard
                key={q.id || qIdx}
                qIdx={qIdx}
                question={q}
                format={format}
                validationErrors={validationErrors}
                cowNoticeIds={cowNoticeIds}
                keywordInputs={keywordInputs}
                handlers={questionEditorHandlers}
                isRefReadOnly={isReferenceLinkQuestion(q)}
              />
            ))}
          </div>
        </div>
      </div>

      <QuizEditorActionBar
        loading={loading}
        onSaveDraft={() => handleSave('draft')}
        onTestPlay={handleTestPlay}
        onPublish={() => handleSave('published')}
      />

      {showToast && (
        <div 
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-card/90 border border-border p-4 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300"
          style={{ minWidth: '320px' }}
          data-testid="ai-toast-notification"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">生成完了</p>
            <p className="text-xs text-muted-foreground">{toastMessage}</p>
          </div>
          <button 
            onClick={() => setShowToast(false)} 
            className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {canUseAiAuthoring && (
        <>
          <AiChatAssistantButton
            isProUser={canUseAiAuthoring}
            isChatOpen={aiChat.isChatOpen}
            setIsChatOpen={aiChat.setIsChatOpen}
          />
          <AiChatAssistantPanel
            isOpen={aiChat.isChatOpen}
            onClose={() => aiChat.setIsChatOpen(false)}
            messages={aiChat.messages}
            input={aiChat.input}
            isGenerating={aiChat.isGenerating}
            handleInputChange={aiChat.handleInputChange}
            handleSubmit={aiChat.handleSubmit}
            chatLimitUsage={aiAuthoring.usageChat}
            pendingApprovals={aiChat.pendingApprovals}
            approveToolCall={aiChat.approveToolCall}
            rejectToolCall={aiChat.rejectToolCall}
          />
        </>
      )}
    </div>
  );
};

export const QuizEditor: React.FC<QuizEditorProps> = (props) => {
  return (
    <Suspense fallback={<EditorFormSkeleton data-testid="quiz-editor-skeleton" />}>
      <QuizEditorContent {...props} />
    </Suspense>
  );
};
