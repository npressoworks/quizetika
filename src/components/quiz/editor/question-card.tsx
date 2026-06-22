'use client';

import React from 'react';
import { WarningAmberOutlined, DeleteOutlineOutlined, ExpandMoreOutlined, ExpandLessOutlined } from '@mui/icons-material';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { ReferenceQuestionBadge } from '@/components/quiz/reference-question-badge';
import { MarkdownFieldHint } from '@/components/markdown/markdown-field-hint';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';
import { filterValidationErrors } from '@/services/quiz-validation';
import { getFormatLabel } from '@/lib/quiz-format-labels';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { ReferenceQuestionView } from '@/components/quiz/editor/reference-question-view';
import { MultipleChoiceEditor } from '@/components/quiz/editor/question-type-editors/multiple-choice-editor';
import { TrueFalseEditor } from '@/components/quiz/editor/question-type-editors/true-false-editor';
import { TextInputEditor } from '@/components/quiz/editor/question-type-editors/text-input-editor';
import { QuickPressEditor } from '@/components/quiz/editor/question-type-editors/quick-press-editor';
import { SortingQuestionEditor } from '@/components/quiz/editor/question-type-editors/sorting-question-editor';
import { AssociationEditor } from '@/components/quiz/editor/question-type-editors/association-editor';
import { LateralThinkingEditor } from '@/components/quiz/editor/question-type-editors/lateral-thinking-editor';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import type { QuestionCardProps } from '@/components/quiz/editor/question-editor-types';

/** 問題文プレビュー用に最大文字数で切り詰める */
function truncatePreview(text: string, max = 30): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > max ? singleLine.slice(0, max) + '…' : singleLine;
}

export function QuestionCard({
  qIdx,
  question,
  format,
  validationErrors,
  cowNoticeIds,
  keywordInputs,
  handlers,
  isRefReadOnly,
  isCollapsed,
  onToggleCollapse,
}: QuestionCardProps) {

  const questionTextHasError =
    filterValidationErrors(validationErrors, {
      field: 'questions',
      questionIndex: qIdx,
      questionField: 'questionText',
    }).length > 0;

  const previewText = question.questionText.trim()
    ? truncatePreview(question.questionText)
    : null;

  return (
    <div id={`question-card-${qIdx}`} className={editorClasses.questionCard}>
      {/* ── ヘッダー（常に表示） ── */}
      <div className={editorClasses.questionCardHeader}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className={`${editorClasses.questionNumber} shrink-0`}>
            第 {qIdx + 1} 問
            {isRefReadOnly && <ReferenceQuestionBadge />}
          </span>
          {/* 問題文が入力済みのときだけプレビューを表示 */}
          {previewText && (
            <span className="truncate text-sm text-muted-foreground">
              {previewText}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* アコーディオン トグル */}
          <button
            type="button"
            className={editorClasses.removeQuestionBtn}
            onClick={() => onToggleCollapse()}
            title={isCollapsed ? '展開する' : '折りたたむ'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ExpandMoreOutlined sx={{ fontSize: 18 }} /> : <ExpandLessOutlined sx={{ fontSize: 18 }} />}
          </button>

          {/* 削除ボタン */}
          <button
            type="button"
            className={editorClasses.removeQuestionBtn}
            onClick={() => handlers.onRemoveQuestion(qIdx)}
            title="問題を削除"
          >
            <DeleteOutlineOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      {/* ── アコーディオン本体（折りたたみ対象） ── */}
      {!isCollapsed && (
        <>
          {cowNoticeIds.has(question.id) && (
            <div className={editorClasses.tagWarning} role="status" data-testid="cow-detach-notice">
              <WarningAmberOutlined sx={{ fontSize: 16 }} />
              <span>保存時に独自コピーとして切り離されます</span>
            </div>
          )}

          {isRefReadOnly ? (
            <ReferenceQuestionView
              question={question}
              qIdx={qIdx}
              onDetach={handlers.onDetachReferenceForEdit}
            />
          ) : (
            <>
              {format === 'mixed' ? (
                <div className={editorClasses.typeToggle}>
                  <button
                    type="button"
                    className={`${editorClasses.toggleBtn} ${question.type === 'multiple-choice' ? editorClasses.toggleBtnActive : ''}`}
                    onClick={() => handlers.onToggleQuestionType(qIdx, 'multiple-choice')}
                  >
                    選択式
                  </button>
                  <button
                    type="button"
                    className={`${editorClasses.toggleBtn} ${question.type === 'true-false' ? editorClasses.toggleBtnActive : ''}`}
                    onClick={() => handlers.onToggleQuestionType(qIdx, 'true-false')}
                    data-testid="question-type-true-false"
                  >
                    〇✕
                  </button>
                  <button
                    type="button"
                    className={`${editorClasses.toggleBtn} ${question.type === 'text-input' ? editorClasses.toggleBtnActive : ''}`}
                    onClick={() => handlers.onToggleQuestionType(qIdx, 'text-input')}
                  >
                    記述式
                  </button>
                  <button
                    type="button"
                    className={`${editorClasses.toggleBtn} ${question.type === 'sorting' ? editorClasses.toggleBtnActive : ''}`}
                    onClick={() => handlers.onToggleQuestionType(qIdx, 'sorting')}
                  >
                    並び替え
                  </button>
                </div>
              ) : (
                <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 text-sm text-muted-foreground">
                  ⚡ この問題の形式はクイズ全体の出題形式（<strong>{getFormatLabel(format)}</strong>）に固定されています。
                </div>
              )}
              <FieldValidationMessages
                errors={validationErrors}
                field="questions"
                questionIndex={qIdx}
                questionField="type"
              />

              <div className={editorClasses.formGroup}>
                <label className={editorClasses.label}>問題文（必須）</label>
                <AutoGrowTextarea
                  className={`${editorClasses.textarea} ${questionTextHasError ? editorClasses.inputError : ''}`}
                  placeholder="例: Reactにおいて、**useState** で管理するのは？"
                  value={question.questionText}
                  onChange={(e) => handlers.onQuestionTextChange(qIdx, e.target.value)}
                  style={{ resize: 'vertical' }}
                  minRows={3}
                  required
                  minLength={5}
                  maxLength={500}
                  data-testid={`auto-grow-question-text-${qIdx}`}
                />
                <MarkdownFieldHint />
                <MarkdownPreview markdown={question.questionText} />
                <FieldValidationMessages
                  errors={validationErrors}
                  field="questions"
                  questionIndex={qIdx}
                  questionField="questionText"
                />
              </div>

              {question.type === 'true-false' && (
                <TrueFalseEditor
                  qIdx={qIdx}
                  question={question}
                  validationErrors={validationErrors}
                  handlers={handlers}
                />
              )}
              {question.type === 'multiple-choice' && (
                <MultipleChoiceEditor
                  qIdx={qIdx}
                  question={question}
                  validationErrors={validationErrors}
                  handlers={handlers}
                />
              )}
              {question.type === 'text-input' && (
                <TextInputEditor
                  qIdx={qIdx}
                  question={question}
                  validationErrors={validationErrors}
                  handlers={handlers}
                />
              )}
              {question.type === 'quick-press' && (
                <QuickPressEditor
                  qIdx={qIdx}
                  question={question}
                  validationErrors={validationErrors}
                  handlers={handlers}
                />
              )}
              {question.type === 'sorting' && (
                <SortingQuestionEditor
                  qIdx={qIdx}
                  question={question}
                  validationErrors={validationErrors}
                  handlers={handlers}
                />
              )}
              {question.type === 'association' && (
                <AssociationEditor
                  qIdx={qIdx}
                  question={question}
                  validationErrors={validationErrors}
                  handlers={handlers}
                />
              )}
              {question.type === 'lateral-thinking' && (
                <LateralThinkingEditor
                  qIdx={qIdx}
                  question={question}
                  validationErrors={validationErrors}
                  handlers={handlers}
                  keywordInput={keywordInputs[qIdx] || ''}
                />
              )}

              <div className={`${editorClasses.formGroup} mt-5`}>
                <label className={editorClasses.label}>正解後の解説文(任意)</label>
                <AutoGrowTextarea
                  className={editorClasses.textarea}
                  placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"
                  value={question.explanation}
                  onChange={(e) => handlers.onExplanationChange(qIdx, e.target.value)}
                  style={{ resize: 'vertical' }}
                  minRows={3}
                  data-testid={`auto-grow-explanation-${qIdx}`}
                />
              </div>

              <div className={`${editorClasses.formGroup} mt-4`}>
                <label className={editorClasses.label}>出典・参考URL(任意)</label>
                <input
                  type="url"
                  className={editorClasses.input}
                  placeholder="https://example.com/reference"
                  value={question.sourceUrl ?? ''}
                  onChange={(e) => handlers.onSourceUrlChange(qIdx, e.target.value || null)}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
