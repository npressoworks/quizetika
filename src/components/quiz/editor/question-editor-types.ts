import type { QuizPublishValidationError } from '@/services/quiz-validation';
import type { Question, FeedbackReport } from '@/types';
import type { QuizFormat } from '@/lib/quiz-format';

export type QuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'text-input'
  | 'quick-press'
  | 'sorting'
  | 'association'
  | 'lateral-thinking';

export interface QuestionEditorHandlers {
  onRemoveQuestion: (idx: number) => void;
  onToggleQuestionType: (idx: number, type: QuestionType) => void;
  onQuestionTextChange: (idx: number, text: string) => void;
  onExplanationChange: (idx: number, text: string) => void;
  onSourceUrlChange: (idx: number, url: string | null) => void;
  onTrueFalseCorrectChange: (qIdx: number, side: 'maru' | 'batsu') => void;
  onChoiceTextChange: (qIdx: number, cIdx: number, text: string) => void;
  onChoiceCorrectToggle: (qIdx: number, cIdx: number) => void;
  onAddChoice: (qIdx: number) => void;
  onRemoveChoice: (qIdx: number, cIdx: number) => void;
  onTextAnswerChange: (qIdx: number, aIdx: number, text: string) => void;
  onAddTextAnswer: (qIdx: number) => void;
  onRemoveTextAnswer: (qIdx: number, aIdx: number) => void;
  onTextInputModeChange: (qIdx: number, mode: 'text' | 'numeric' | 'char-count') => void;
  onTextInputCharCountChange: (qIdx: number, value: string) => void;
  onSortingItemTextChange: (qIdx: number, itemIdx: number, text: string) => void;
  onAddSortingItem: (qIdx: number) => void;
  onRemoveSortingItem: (qIdx: number, itemIdx: number) => void;
  onSortingItemsReorder: (
    qIdx: number,
    items: { id: string; text: string; correctOrder?: number }[]
  ) => void;
  onAssociationHintTextChange: (qIdx: number, hintIdx: number, text: string) => void;
  onAddAssociationHint: (qIdx: number) => void;
  onRemoveAssociationHint: (qIdx: number, hintIdx: number) => void;
  onAiContextDetailsChange: (qIdx: number, text: string) => void;
  onKeywordInputChange: (qIdx: number, val: string) => void;
  onAddKeyword: (qIdx: number) => void;
  onRemoveKeyword: (qIdx: number, kwIdx: number) => void;
  onDetachReferenceForEdit: (qIdx: number) => void;
}

export interface QuestionTypeEditorProps {
  qIdx: number;
  question: Question;
  validationErrors: QuizPublishValidationError[];
  handlers: QuestionEditorHandlers;
}

export interface QuestionCardProps {
  qIdx: number;
  question: Question;
  format: QuizFormat;
  validationErrors: QuizPublishValidationError[];
  cowNoticeIds: Set<string>;
  keywordInputs: Record<number, string>;
  handlers: QuestionEditorHandlers;
  isRefReadOnly: boolean;
  /** 折りたたみ状態（親から制御） */
  isCollapsed: boolean;
  /** 折りたたみトグルコールバック */
  onToggleCollapse: () => void;
  reports?: FeedbackReport[];
  onResolveReport?: (reportId: string) => Promise<void>;
  onRejectReport?: (reportId: string) => Promise<void>;
}
