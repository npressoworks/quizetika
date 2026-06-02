'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { saveQuiz, getQuiz, updateQuiz } from '@/services/quiz';
import { validateQuizForPublish, collectQuestionTextValidationErrors, normalizeTag, QuizPublishValidationError, QuizValidationQuestionField, filterValidationErrors, formatValidationErrorSummary } from '@/services/quiz-validation';
import { hasAnyQuestionUserInput } from '@/services/quiz-question-input';
import { getTextInputFieldProps } from '@/services/text-answer-utils';
import {
  createDefaultChoices,
  MAX_MULTIPLE_CHOICE_COUNT,
  MIN_MULTIPLE_CHOICE_COUNT,
} from '@/services/quiz-choice-utils';
import { Quiz, Question } from '@/types';
import styles from '@/app/quiz/create/create.module.css';
import { MarkdownFieldHint } from '@/components/markdown/markdown-field-hint';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';
import { Trash2, Plus, Info, AlertTriangle, Image, ArrowLeft, Save, Send, HelpCircle, Play } from 'lucide-react';
import { SortableSortingList, reindexCorrectOrder } from '@/components/sorting/sortable-sorting-list';
import {
  buildTestPlayPayload,
  consumeTestPlayDraftForEditor,
  getQuizEditorSourcePath,
  hasPlayableQuestions,
  saveTestPlayPayload,
  TEST_PLAY_RESTORE_QUERY,
} from '@/lib/test-play';
import { resolveQuizFormat } from '@/lib/quiz-format';

interface QuizEditorProps {
  quizId?: string; // 編集モードの場合はIDが渡される
}

const FieldValidationMessages: React.FC<{
  errors: QuizPublishValidationError[];
  field: QuizPublishValidationError['field'];
  questionIndex?: number;
  questionField?: QuizValidationQuestionField;
  answerIndex?: number;
  unscopedOnly?: boolean;
}> = ({ errors, field, questionIndex, questionField, answerIndex, unscopedOnly }) => {
  const matched = filterValidationErrors(errors, {
    field,
    questionIndex,
    questionField,
    answerIndex,
    unscopedOnly,
  });
  if (matched.length === 0) return null;
  return (
    <div className={styles.fieldError} role="alert">
      {matched.map((err, i) => (
        <p key={i}>{err.message}</p>
      ))}
    </div>
  );
};

function scrollToFirstValidationError(errors: QuizPublishValidationError[]) {
  const first = errors[0];
  if (!first) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const targetId =
    first.field === 'title' ? 'field-title'
    : first.field === 'difficulty' ? 'field-difficulty'
    : first.field === 'genre' ? 'field-genre'
    : first.questionIndex != null ? `question-card-${first.questionIndex}`
    : first.field === 'questions' ? 'questions-section'
    : null;
  if (targetId) {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

export const QuizEditorContent: React.FC<QuizEditorProps> = ({ quizId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [initialFetchLoading, setInitialFetchLoading] = useState(!!quizId);
  const [validationErrors, setValidationErrors] = useState<QuizPublishValidationError[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  // フォームステート
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(5);
  const [genre, setGenre] = useState('');
  const [format, setFormat] = useState<'mixed' | 'multiple-choice' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking'>('mixed');
  
  // タグ関連ステート
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [originalTags, setOriginalTags] = useState<string[]>([]);
  const [suggestedTag, setSuggestedTag] = useState<string | null>(null);

  // 設問関連ステート
  const [questions, setQuestions] = useState<Question[]>([]);
  /** テストプレイ復帰後に Firestore 取得でドラフトを上書きしない */
  const skipServerQuizLoadRef = useRef(false);

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
    setDifficulty(draft.difficulty);
    setGenre(draft.genre);
    setTags(draft.tags ?? []);
    setOriginalTags(draft.originalTags ?? []);
    setQuestions(draft.questions);
    setFormat(resolveQuizFormat(draft));
  };

  useEffect(() => {
    skipServerQuizLoadRef.current = false;
  }, [quizId]);

  // 編集モードの場合のデータ取得と所有者チェック
  useEffect(() => {
    if (authLoading) return;

    if (skipServerQuizLoadRef.current) {
      return;
    }

    const sourcePath = getQuizEditorSourcePath(quizId);
    const restoringFromTestPlay = searchParams.get(TEST_PLAY_RESTORE_QUERY) === '1';

    if (restoringFromTestPlay && user) {
      const draft = consumeTestPlayDraftForEditor(user.id, sourcePath);
      if (draft) {
        skipServerQuizLoadRef.current = true;
        applyDraftToEditor(draft);
        setInitialFetchLoading(false);
        router.replace(sourcePath);
        return;
      }
    }

    if (!quizId) {
      addDefaultQuestion('mixed');
      return;
    }

    const fetchQuiz = async () => {
      try {
        const quiz = await getQuiz(quizId);
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
        setErrorText('クイズの取得に失敗しました。');
      } finally {
        setInitialFetchLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, user, authLoading, searchParams, router]);

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

  // デフォルト設問の追加
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

  // 設問の追加
  const handleAddQuestion = () => {
    addDefaultQuestion();
  };

  // クイズ形式が変更された際の処理 (一括変換ロジック含む)
  const handleFormatChange = (newFormat: typeof format) => {
    if (newFormat === format) return;

    if (hasAnyQuestionUserInput(questions)) {
      const confirmMsg = newFormat === 'mixed'
        ? '複合クイズ形式に変更します。既存の問題タイプは維持されますが、各設問のトグルから選択式、記述式、並び替えを自由に選択できるようになります。よろしいですか？'
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

  const getFormatLabel = (fmt: string) => {
    switch (fmt) {
      case 'mixed': return '複合';
      case 'multiple-choice': return '選択式';
      case 'text-input': return '記述式';
      case 'quick-press': return '早押し';
      case 'sorting': return '並び替え';
      case 'association': return '連想';
      case 'lateral-thinking': return 'ウミガメのスープ';
      default: return fmt;
    }
  };

  // 設問の削除
  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert('最低1問は必要です。');
      return;
    }
    const nextQuestions = questions.filter((_, i) => i !== idx);
    setQuestions(nextQuestions);
  };

  // 設問タイプの切り替え (選択式 / 記述式 / 早押し / 並び替え / 連想 / ウミガメのスープ)
  const handleToggleQuestionType = (idx: number, type: 'multiple-choice' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking') => {
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

  // 設問テキストの更新
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

  // サムネイル用ダミーアップロード
  const triggerThumbnail = () => {
    const dummyUrl = `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/600/400`;
    setThumbnailUrl(dummyUrl);
  };

  const handleTestPlay = () => {
    if (!user) {
      alert('ログインが必要です。');
      return;
    }
    if (!hasPlayableQuestions(questions)) {
      alert('テストプレイするには、問題文が入力された設問を1問以上追加してください。');
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
      difficulty,
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
      difficulty,
      genre,
      tags,
      originalTags,
      questionIds: questions.map((q) => q.id), // 設問の独立化対応に伴い、設問IDの配列をアタッチ
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
          difficulty,
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

  if (authLoading || initialFetchLoading) {
    return <div className={styles.container}>読み込み中...</div>;
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

      {/* エラー表示エリア (要件 1.5) */}
      {(errorText || validationErrors.length > 0) && (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>
            <AlertTriangle size={20} />
            <span>保存できませんでした。以下の項目をご確認ください：</span>
          </div>
          {errorText && <p style={{ fontSize: '0.95rem', marginBottom: '10px' }}>{errorText}</p>}
          {validationErrors.length > 0 && (
            <ul className={styles.errorList}>
              {validationErrors.map((err, i) => (
                <li key={i}>{formatValidationErrorSummary(err, { questions })}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* クイズ全体の出題形式設定 */}
          <div className={styles.editorCard}>
            <h2 className={styles.sectionTitle}>
              <HelpCircle size={20} />
              クイズ全体の出題形式 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              クイズ全体のルールと設問タイプを決定します。単一形式を選ぶと、全ての設問がそのタイプに固定されます。「複合」を選ぶと設問ごとに形式を選択できます。
            </p>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '12px',
              marginTop: '8px'
            }}>
              {[
                { id: 'mixed', label: '複合', icon: '🌀', desc: '選択式・記述式・並び替えを自由に組み合わせ可能' },
                { id: 'multiple-choice', label: '選択式', icon: '📝', desc: '複数の選択肢から1つの正解を選ぶ定番クイズ' },
                { id: 'text-input', label: '記述式', icon: '✍️', desc: 'テキスト入力で正確な正解ワードを記述する問題' },
                { id: 'quick-press', label: '早押し', icon: '⚡', desc: '問題が一文字ずつ表示され、回答ボタンを押して答える' },
                { id: 'sorting', label: '並び替え', icon: '↕️', desc: 'バラバラの要素を正しい順番に並び替える形式' },
                { id: 'association', label: '連想', icon: '💡', desc: '段階的に開示されるヒントから正解を推測する' },
                { id: 'lateral-thinking', label: 'ウミガメのスープ', icon: '🐢', desc: 'AIが真相の判定を行う状況構築型・水平思考' },
              ].map((item) => {
                const isActive = format === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleFormatChange(item.id as any)}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(157, 78, 221, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: isActive ? '2px solid var(--color-primary)' : '1px solid var(--border-light)',
                      boxShadow: isActive ? '0 0 15px rgba(157, 78, 221, 0.2)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      transform: isActive ? 'translateY(-2px)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                        e.currentTarget.style.borderColor = 'var(--border-light)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
                      <span style={{ fontWeight: 'bold', fontSize: '1.05rem', color: isActive ? 'var(--color-primary)' : 'var(--text-main)' }}>
                        {item.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 基本メタデータ入力 */}
          <div className={styles.editorCard}>
            <h2 className={styles.sectionTitle}>
              <Info size={20} />
              クイズの基本設定
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* タイトル・説明文 */}
              <div className={styles.formGroup} id="field-title">
                <label className={styles.label}>クイズタイトル <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="text"
                  className={`${styles.input} ${filterValidationErrors(validationErrors, { field: 'title' }).length > 0 ? styles.inputError : ''}`}
                  placeholder="例: React Hooksの基礎知識クイズ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
                <FieldValidationMessages errors={validationErrors} field="title" />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>説明文</label>
                <textarea
                  className={styles.textarea}
                  placeholder="クイズの概要や対象読者などを入力してください。"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* サムネイル・難易度・ジャンル・タグ */}
              <div className={styles.metaGrid}>
                {/* 左: サムネイル */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>サムネイル画像</label>
                  <div className={styles.thumbnailUpload} onClick={triggerThumbnail}>
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt="Thumbnail preview" className={styles.thumbnailPreview} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                        <Image size={32} />
                        <span style={{ fontSize: '0.85rem' }}>クリックしてサムネイルを自動生成</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 右: 難易度・ジャンル・タグ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 難易度スライダー */}
                  <div className={styles.formGroup} id="field-difficulty">
                    <label className={styles.label}>難易度 (1 - 10)</label>
                    <div className={styles.sliderContainer}>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        className={styles.slider}
                        value={difficulty}
                        onChange={(e) => setDifficulty(parseInt(e.target.value))}
                      />
                      <span className={styles.sliderValue}>{difficulty}</span>
                    </div>
                    <FieldValidationMessages errors={validationErrors} field="difficulty" />
                  </div>

                  {/* ジャンル選択 */}
                  <div className={styles.formGroup} id="field-genre">
                    <div className={styles.genreContainer}>
                      <label className={styles.label}>
                        ジャンル <span style={{ color: 'var(--color-danger)' }}>*</span>
                      </label>
                      <select
                        className={`${styles.select} ${filterValidationErrors(validationErrors, { field: 'genre' }).length > 0 ? styles.inputError : ''}`}
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        required
                      >
                        <option value="" disabled>ジャンルを選択してください</option>
                        <option value="programming">プログラミング / IT</option>
                        <option value="history">歴史 / 世界史</option>
                        <option value="science">科学 / 自然科学</option>
                        <option value="anime">アニメ / ゲーム</option>
                        <option value="sports">スポーツ / 運動</option>
                        <option value="general">一般常識 / 雑学</option>
                      </select>
                      <a href="/community/genres" className={styles.genreLink}>
                        新しいジャンルを申請する
                      </a>
                    </div>
                    <FieldValidationMessages errors={validationErrors} field="genre" />
                  </div>

                  {/* タグ設定 */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>タグ (最大 5 つ)</label>
                    <form onSubmit={handleAddTag} className={styles.tagInputWrapper}>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="タグを入力してEnter"
                        value={tagInput}
                        onChange={(e) => handleTagInputChange(e.target.value)}
                        disabled={originalTags.length >= 5}
                      />
                    </form>
                    
                    {suggestedTag && (
                      <div className={styles.tagWarning} onClick={applySuggestedTag} style={{ cursor: 'pointer' }}>
                        <AlertTriangle size={16} />
                        <div>
                          <span style={{ fontWeight: 'bold' }}>推奨:</span> 類似するタグ <span style={{ textDecoration: 'underline' }}>#{suggestedTag}</span> が既に存在します。既存のタグを使用することをお勧めします。（クリックで適用）
                        </div>
                      </div>
                    )}

                    <div className={styles.tagList}>
                      {originalTags.map((tag, idx) => (
                        <div key={idx} className={styles.tagBadge}>
                          #{tag}
                          <button type="button" className={styles.removeTagBtn} onClick={() => handleRemoveTag(idx)}>
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span className={styles.tagLimitInfo}>{originalTags.length} / 5 タグ</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 設問管理エリア */}
          <div className={styles.editorCard} id="questions-section">
            <div className={styles.questionHeader}>
              <h2 className={styles.sectionTitle} style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                設問管理
              </h2>
              <button type="button" className={styles.addQuestionBtn} onClick={handleAddQuestion}>
                <Plus size={16} /> 問題を追加
              </button>
            </div>
            <FieldValidationMessages errors={validationErrors} field="questions" unscopedOnly />

            <div className={styles.questionList}>
              {questions.map((q, qIdx) => (
                <div key={q.id || qIdx} id={`question-card-${qIdx}`} className={styles.questionCard}>
                  <div className={styles.questionCardHeader}>
                    <span className={styles.questionNumber}>第 {qIdx + 1} 問</span>
                    <button
                      type="button"
                      className={styles.removeQuestionBtn}
                      onClick={() => handleRemoveQuestion(qIdx)}
                      title="問題を削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* 設問タイプ切り替えトグル (複合形式のみ) */}
                  {format === 'mixed' ? (
                    <div className={styles.typeToggle}>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${q.type === 'multiple-choice' ? styles.toggleBtnActive : ''}`}
                        onClick={() => handleToggleQuestionType(qIdx, 'multiple-choice')}
                      >
                        選択式
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${q.type === 'text-input' ? styles.toggleBtnActive : ''}`}
                        onClick={() => handleToggleQuestionType(qIdx, 'text-input')}
                      >
                        記述式
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${q.type === 'sorting' ? styles.toggleBtnActive : ''}`}
                        onClick={() => handleToggleQuestionType(qIdx, 'sorting')}
                      >
                        並び替え
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginBottom: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      ⚡ この問題の形式はクイズ全体の出題形式（<strong>{getFormatLabel(format)}</strong>）に固定されています。
                    </div>
                  )}
                  <FieldValidationMessages
                    errors={validationErrors}
                    field="questions"
                    questionIndex={qIdx}
                    questionField="type"
                  />

                  <div className={styles.formGroup}>
                    <label className={styles.label}>問題文（必須）</label>
                    <textarea
                      className={`${styles.textarea} ${filterValidationErrors(validationErrors, { field: 'questions', questionIndex: qIdx, questionField: 'questionText' }).length > 0 ? styles.inputError : ''}`}
                      placeholder="例: Reactにおいて、**useState** で管理するのは？"
                      value={q.questionText}
                      onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                      style={{ minHeight: '80px', resize: 'vertical' }}
                      required
                      minLength={5}
                      maxLength={500}
                    />
                    <MarkdownFieldHint />
                    <MarkdownPreview markdown={q.questionText} />
                    <FieldValidationMessages
                      errors={validationErrors}
                      field="questions"
                      questionIndex={qIdx}
                      questionField="questionText"
                    />
                  </div>

                  {/* 選択式の設問入力 */}
                  {q.type === 'multiple-choice' && q.choices && (
                    <div className={styles.choicesList}>
                      <label className={styles.label}>
                        選択肢と正解設定（正解となる選択肢にすべてチェック。{MIN_MULTIPLE_CHOICE_COUNT}〜{MAX_MULTIPLE_CHOICE_COUNT}択・複数正解可）
                      </label>
                      {q.choices.map((choice, cIdx) => (
                        <div key={choice.id || cIdx} className={styles.choiceRow}>
                          <input
                            type="checkbox"
                            className={styles.choiceCheckbox}
                            checked={choice.isCorrect}
                            onChange={() => handleChoiceCorrectToggle(qIdx, cIdx)}
                          />
                          <input
                            type="text"
                            className={styles.input}
                            value={choice.choiceText}
                            onChange={(e) => handleChoiceTextChange(qIdx, cIdx, e.target.value)}
                          />
                          <button
                            type="button"
                            className={styles.removeQuestionBtn}
                            onClick={() => handleRemoveChoice(qIdx, cIdx)}
                            title="この選択肢を削除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.addTextAnswerBtn}
                        onClick={() => handleAddChoice(qIdx)}
                        disabled={q.choices.length >= MAX_MULTIPLE_CHOICE_COUNT}
                      >
                        <Plus size={14} /> 選択肢を追加する
                      </button>
                      <FieldValidationMessages
                        errors={validationErrors}
                        field="questions"
                        questionIndex={qIdx}
                        questionField="answers"
                      />
                    </div>
                  )}

                  {/* 記述式（旧短答入力式）の設問入力 */}
                  {q.type === 'text-input' && q.correctTextAnswerList && (
                    <div className={styles.textAnswersContainer}>
                      <label className={styles.label}>入力タイプ</label>
                      <div className={styles.toggleGroup} style={{ marginBottom: '12px' }}>
                        {([
                          { id: 'text' as const, label: '通常' },
                          { id: 'numeric' as const, label: '数値' },
                          { id: 'char-count' as const, label: '文字数指定' },
                        ]).map(({ id, label }) => (
                          <button
                            key={id}
                            type="button"
                            className={`${styles.toggleBtn} ${(q.textInputMode ?? 'text') === id ? styles.toggleBtnActive : ''}`}
                            onClick={() => handleTextInputModeChange(qIdx, id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {(q.textInputMode ?? 'text') === 'char-count' && (
                        <div style={{ marginBottom: '12px' }}>
                          <label className={styles.label}>要求文字数（1〜100文字）</label>
                          <input
                            type="number"
                            className={`${styles.input} ${filterValidationErrors(validationErrors, { field: 'questions', questionIndex: qIdx, questionField: 'textInputCharCount' }).length > 0 ? styles.inputError : ''}`}
                            min={1}
                            max={100}
                            value={q.textInputCharCount ?? ''}
                            onChange={(e) => handleTextInputCharCountChange(qIdx, e.target.value)}
                            placeholder="例: 4"
                          />
                          <FieldValidationMessages
                            errors={validationErrors}
                            field="questions"
                            questionIndex={qIdx}
                            questionField="textInputCharCount"
                          />
                        </div>
                      )}
                      <label className={styles.label}>
                        {(q.textInputMode ?? 'text') === 'numeric'
                          ? '正解数値候補（複数設定可能）'
                          : '正解テキスト候補（大文字・小文字表記揺れなど複数設定可能）'}
                      </label>
                      {q.correctTextAnswerList.map((ans, aIdx) => {
                        const textInputMode = q.textInputMode ?? 'text';
                        const answerFieldProps = textInputMode === 'numeric'
                          ? getTextInputFieldProps(q, { placeholder: '例: 3.14' })
                          : textInputMode === 'char-count'
                            ? getTextInputFieldProps(q)
                            : { type: 'text' as const, placeholder: '例: useState' };
                        const answerHasError = filterValidationErrors(validationErrors, {
                          field: 'questions',
                          questionIndex: qIdx,
                          questionField: 'correctTextAnswer',
                          answerIndex: aIdx,
                        }).length > 0;
                        return (
                        <div key={aIdx}>
                        <div className={styles.textAnswerRow}>
                          <input
                            type={answerFieldProps.type}
                            className={`${styles.input} ${answerHasError ? styles.inputError : ''}`}
                            placeholder={answerFieldProps.placeholder}
                            inputMode={answerFieldProps.inputMode}
                            maxLength={answerFieldProps.maxLength}
                            minLength={answerFieldProps.minLength}
                            value={ans}
                            onChange={(e) => handleTextAnswerChange(qIdx, aIdx, e.target.value)}
                          />
                          <button
                            type="button"
                            className={styles.removeQuestionBtn}
                            onClick={() => handleRemoveTextAnswer(qIdx, aIdx)}
                            title="この正解を削除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <FieldValidationMessages
                          errors={validationErrors}
                          field="questions"
                          questionIndex={qIdx}
                          questionField="correctTextAnswer"
                          answerIndex={aIdx}
                        />
                        </div>
                        );
                      })}
                      <button
                        type="button"
                        className={styles.addTextAnswerBtn}
                        onClick={() => handleAddTextAnswer(qIdx)}
                      >
                        <Plus size={14} /> 正解候補を追加する
                      </button>
                      <FieldValidationMessages
                        errors={validationErrors}
                        field="questions"
                        questionIndex={qIdx}
                        questionField="answers"
                      />
                    </div>
                  )}

                  {/* 早押し式の設問入力 */}
                  {q.type === 'quick-press' && q.correctTextAnswerList && (
                    <div className={styles.textAnswersContainer}>
                      <label className={styles.label}>正解テキスト候補（大文字・小文字表記揺れなど複数設定可能）</label>
                      {q.correctTextAnswerList.map((ans, aIdx) => (
                        <div key={aIdx}>
                        <div className={styles.textAnswerRow}>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="例: useState"
                            value={ans}
                            onChange={(e) => handleTextAnswerChange(qIdx, aIdx, e.target.value)}
                          />
                          <button
                            type="button"
                            className={styles.removeQuestionBtn}
                            onClick={() => handleRemoveTextAnswer(qIdx, aIdx)}
                            title="この正解を削除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <FieldValidationMessages
                          errors={validationErrors}
                          field="questions"
                          questionIndex={qIdx}
                          questionField="correctTextAnswer"
                          answerIndex={aIdx}
                        />
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.addTextAnswerBtn}
                        onClick={() => handleAddTextAnswer(qIdx)}
                      >
                        <Plus size={14} /> 正解候補を追加する
                      </button>
                      <FieldValidationMessages
                        errors={validationErrors}
                        field="questions"
                        questionIndex={qIdx}
                        questionField="answers"
                      />
                    </div>
                  )}

                  {/* 並び替えの設問入力 */}
                  {q.type === 'sorting' && q.sortingItems && (
                    <div className={styles.choicesList}>
                      <label className={styles.label}>
                        並び替え要素（ドラッグで上から正しい順序に並べてください。2〜6要素）
                      </label>
                      <SortableSortingList
                        items={q.sortingItems}
                        showIndex={false}
                        onReorder={(reordered) => handleSortingItemsReorder(qIdx, reordered)}
                        renderItemContent={(item) => (
                          <div className={styles.choiceRow}>
                            <input
                              type="text"
                              className={styles.input}
                              value={item.text}
                              onChange={(e) => {
                                const itemIdx = q.sortingItems!.findIndex((s) => s.id === item.id);
                                if (itemIdx >= 0) handleSortingItemTextChange(qIdx, itemIdx, e.target.value);
                              }}
                            />
                            <button
                              type="button"
                              className={styles.removeQuestionBtn}
                              onClick={() => {
                                const itemIdx = q.sortingItems!.findIndex((s) => s.id === item.id);
                                if (itemIdx >= 0) handleRemoveSortingItem(qIdx, itemIdx);
                              }}
                              title="この要素を削除"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      />
                      <button
                        type="button"
                        className={styles.addTextAnswerBtn}
                        onClick={() => handleAddSortingItem(qIdx)}
                        style={{ marginTop: '8px' }}
                      >
                        <Plus size={14} /> 要素を追加する
                      </button>
                      <FieldValidationMessages
                        errors={validationErrors}
                        field="questions"
                        questionIndex={qIdx}
                        questionField="sortingItems"
                      />
                    </div>
                  )}

                  {/* 連想クイズの設問入力 */}
                  {q.type === 'association' && q.associationHints && (
                    <div className={styles.choicesList}>
                      <label className={styles.label}>段階的連想ヒント（ヒント1から順にプレイヤーに開示されます。1〜5ヒント）</label>
                      {q.associationHints.map((hint, hIdx) => (
                        <div key={hIdx} className={styles.choiceRow}>
                          <span style={{ fontSize: '0.9rem', minWidth: '60px', color: 'var(--text-muted)' }}>
                            ヒント {hIdx + 1}
                          </span>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder={`例: ヒント ${hIdx + 1} の内容`}
                            value={hint}
                            onChange={(e) => handleAssociationHintTextChange(qIdx, hIdx, e.target.value)}
                          />
                          <button
                            type="button"
                            className={styles.removeQuestionBtn}
                            onClick={() => handleRemoveAssociationHint(qIdx, hIdx)}
                            title="このヒントを削除"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.addTextAnswerBtn}
                        onClick={() => handleAddAssociationHint(qIdx)}
                        style={{ marginTop: '8px', marginBottom: '16px' }}
                      >
                        <Plus size={14} /> ヒントを追加する
                      </button>
                      <FieldValidationMessages
                        errors={validationErrors}
                        field="questions"
                        questionIndex={qIdx}
                        questionField="associationHints"
                      />

                      {/* 連想の正解設定 (記述式の correctTextAnswerList と同一構造) */}
                      {q.correctTextAnswerList && (
                        <div className={styles.textAnswersContainer} style={{ marginTop: '16px', borderTop: '1px dashed var(--border-light)', paddingTop: '16px' }}>
                          <label className={styles.label}>正解テキスト候補（大文字・小文字表記揺れなど複数設定可能）</label>
                          {q.correctTextAnswerList.map((ans, aIdx) => (
                            <div key={aIdx} className={styles.textAnswerRow}>
                              <input
                                type="text"
                                className={styles.input}
                                placeholder="例: 正解文字列"
                                value={ans}
                                onChange={(e) => handleTextAnswerChange(qIdx, aIdx, e.target.value)}
                              />
                              <button
                                type="button"
                                className={styles.removeQuestionBtn}
                                onClick={() => handleRemoveTextAnswer(qIdx, aIdx)}
                                title="この正解を削除"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className={styles.addTextAnswerBtn}
                            onClick={() => handleAddTextAnswer(qIdx)}
                          >
                            <Plus size={14} /> 正解候補を追加する
                          </button>
                          <FieldValidationMessages
                            errors={validationErrors}
                            field="questions"
                            questionIndex={qIdx}
                            questionField="answers"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ウミガメスープ専用の真相（裏設定）および必須キーワード入力エリア */}
                  {q.type === 'lateral-thinking' && (
                    <>
                      <div className={styles.formGroup} style={{ marginTop: '20px' }}>
                        <label className={styles.label}>
                          真相（ゲームマスター用の裏設定・解決情報）
                          <span style={{ color: 'var(--color-danger)' }}> *</span>
                        </label>
                        <textarea
                          className={`${styles.textarea} ${filterValidationErrors(validationErrors, { field: 'questions', questionIndex: qIdx, questionField: 'aiContextDetails' }).length > 0 ? styles.inputError : ''}`}
                          placeholder="AIがプレイヤーからの自由な質問に答える基準となる「真相（裏設定）」を、20文字以上2000文字以内で詳しく記述してください。"
                          value={q.aiContextDetails || ''}
                          onChange={(e) => {
                            const nextQuestions = [...questions];
                            nextQuestions[qIdx].aiContextDetails = e.target.value;
                            setQuestions(nextQuestions);
                          }}
                          style={{ minHeight: '120px' }}
                        />
                        <FieldValidationMessages
                          errors={validationErrors}
                          field="questions"
                          questionIndex={qIdx}
                          questionField="aiContextDetails"
                        />
                      </div>

                      <div className={styles.formGroup} style={{ marginTop: '20px' }}>
                        <label className={styles.label}>
                          必須正解キーワード（真相判定に使用するエッセンス。複数指定可能）
                          <span style={{ color: 'var(--color-danger)' }}> *</span>
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="例: スープ (Enterで追加)"
                            value={keywordInputs[qIdx] || ''}
                            onChange={(e) => handleKeywordInputChange(qIdx, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddKeyword(qIdx);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleAddKeyword(qIdx)}
                            style={{ padding: '0 16px', height: '40px', minWidth: '80px' }}
                          >
                            追加
                          </button>
                        </div>

                        <div className={styles.tagList} style={{ marginTop: '10px' }}>
                          {(q.truthKeywords ?? []).map((kw, kwIdx) => (
                            <div key={kwIdx} className={styles.tagBadge} style={{ background: 'var(--color-primary-glow)', borderColor: 'var(--color-primary)' }}>
                              {kw}
                              <button
                                type="button"
                                className={styles.removeTagBtn}
                                onClick={() => handleRemoveKeyword(qIdx, kwIdx)}
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                        <span className={styles.tagLimitInfo} style={{ marginTop: '4px', display: 'block' }}>
                          {(q.truthKeywords ?? []).length} 個の必須キーワード
                        </span>
                        <FieldValidationMessages
                          errors={validationErrors}
                          field="questions"
                          questionIndex={qIdx}
                          questionField="truthKeywords"
                        />
                      </div>
                    </>
                  )}

                  <div className={styles.formGroup} style={{ marginTop: '20px' }}>
                    <label className={styles.label}>正解後の解説文(任意)</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"
                      value={q.explanation}
                      onChange={(e) => handleExplanationChange(qIdx, e.target.value)}
                      style={{ minHeight: '80px' }}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '16px' }}>
                    <label className={styles.label}>出典・参考URL(任意)</label>
                    <input
                      type="url"
                      className={styles.input}
                      placeholder="https://example.com/reference"
                      value={q.sourceUrl ?? ''}
                      onChange={(e) => {
                        const nextQuestions = [...questions];
                        nextQuestions[qIdx].sourceUrl = e.target.value || null;
                        setQuestions(nextQuestions);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
      </div>

      {/* アクションバー (要件 1.6 下書き保存, 公開) */}
      <div className={styles.actionsBar}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleSave('draft')}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Save size={18} />
          下書き保存
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleTestPlay}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Play size={18} />
          テストプレイ
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleSave('published')}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Send size={18} />
          公開
        </button>
      </div>
    </div>
  );
};

export const QuizEditor: React.FC<QuizEditorProps> = (props) => {
  return (
    <Suspense fallback={<div>エディタを読み込み中...</div>}>
      <QuizEditorContent {...props} />
    </Suspense>
  );
};
