'use client';

import React from 'react';
import { WarningAmberOutlined } from '@mui/icons-material';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';

export interface QuizTagEditorProps {
  originalTags: string[];
  tagInput: string;
  suggestedTag: string | null;
  onTagInputChange: (value: string) => void;
  onAddTag: (e: React.FormEvent) => void;
  onApplySuggestedTag: () => void;
  onRemoveTag: (idx: number) => void;
}

export function QuizTagEditor({
  originalTags,
  tagInput,
  suggestedTag,
  onTagInputChange,
  onAddTag,
  onApplySuggestedTag,
  onRemoveTag,
}: QuizTagEditorProps) {
  return (
    <div className={editorClasses.formGroup}>
      <label className={editorClasses.label}>タグ (最大 5 つ)</label>
      <form onSubmit={onAddTag} className={editorClasses.tagInputWrapper}>
        <input
          type="text"
          className={editorClasses.input}
          placeholder="タグを入力してEnter"
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          disabled={originalTags.length >= 5}
        />
      </form>

      {suggestedTag && (
        <div
          className={`${editorClasses.tagWarning} cursor-pointer`}
          onClick={onApplySuggestedTag}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onApplySuggestedTag()}
        >
          <WarningAmberOutlined sx={{ fontSize: 16 }} />
          <div>
            <span className="font-bold">推奨:</span> 類似するタグ{' '}
            <span className="underline">#{suggestedTag}</span>{' '}
            が既に存在します。既存のタグを使用することをお勧めします。（クリックで適用）
          </div>
        </div>
      )}

      <div className={editorClasses.tagList}>
        {originalTags.map((tag, idx) => (
          <div key={idx} className={editorClasses.tagBadge}>
            #{tag}
            <button type="button" className={editorClasses.removeTagBtn} onClick={() => onRemoveTag(idx)}>
              &times;
            </button>
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex justify-between">
        <span className={editorClasses.tagLimitInfo}>{originalTags.length} / 5 タグ</span>
      </div>
    </div>
  );
}
