'use client';

import React from 'react';
import { PlayArrowOutlined, SaveOutlined, SendOutlined } from '@mui/icons-material';
import { Button } from '@/components/ui/button';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';

export interface QuizEditorActionBarProps {
  loading: boolean;
  onSaveDraft: () => void;
  onTestPlay: () => void;
  onPublish: () => void;
  isEdit?: boolean;
}

export function QuizEditorActionBar({
  loading,
  onSaveDraft,
  onTestPlay,
  onPublish,
  isEdit = false,
}: QuizEditorActionBarProps) {
  return (
    <div className={editorClasses.actionsBar}>
      <Button
        type="button"
        variant="secondary"
        onClick={onSaveDraft}
        disabled={loading}
        data-analytics="quiz-save-draft"
      >
        <SaveOutlined sx={{ fontSize: 18 }} />
        下書き保存
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={onTestPlay}
        disabled={loading}
        data-analytics="quiz-test-play"
      >
        <PlayArrowOutlined sx={{ fontSize: 18 }} />
        テストプレイ
      </Button>
      <Button
        type="button"
        onClick={onPublish}
        disabled={loading}
        data-analytics="quiz-publish"
      >
        <SendOutlined sx={{ fontSize: 18 }} />
        {isEdit ? '更新' : '公開'}
      </Button>
    </div>
  );
}
