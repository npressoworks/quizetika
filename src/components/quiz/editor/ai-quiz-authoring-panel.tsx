'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import { AI_QUIZ_PROMPT_MAX_LENGTH } from '@/services/ai-authoring-types';
import type { AiAuthoringUsage } from '@/services/ai-authoring-types';
import type { QuizFormat } from '@/lib/quiz-format';

interface AiQuizAuthoringPanelProps {
  format: QuizFormat;
  isGenerating: boolean;
  isUsageLoading: boolean;
  usageQuestions: AiAuthoringUsage | null;
  errorMessage: string | null;
  onGenerate: (prompt: string) => void;
  onClearError: () => void;
}

function formatUsageLabel(usage: AiAuthoringUsage | null, loading: boolean): string {
  if (loading) return '残り回数を読み込み中…';
  if (!usage) return '';
  if (usage.limit === null || usage.remainingToday === null) {
    return `本日の作問: 無制限（${usage.usedToday}回使用）`;
  }
  return `本日の作問残り: ${usage.remainingToday}/${usage.limit}回`;
}

export function AiQuizAuthoringPanel({
  format,
  isGenerating,
  isUsageLoading,
  usageQuestions,
  errorMessage,
  onGenerate,
  onClearError,
}: AiQuizAuthoringPanelProps) {
  const [prompt, setPrompt] = useState('');
  const isLateral = format === 'lateral-thinking';
  const isPromptTooLong = prompt.length > AI_QUIZ_PROMPT_MAX_LENGTH;
  const usageLabel = formatUsageLabel(usageQuestions, isUsageLoading);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLateral || isGenerating || isPromptTooLong || !prompt.trim()) return;
    onClearError();
    onGenerate(prompt.trim());
  };

  return (
    <div
      className="mb-6 rounded-lg border border-border bg-muted/30 p-4"
      data-testid="ai-quiz-authoring-panel"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles size={18} className="text-primary" />
          AI 作問（10問一括）
        </h3>
        {usageLabel && (
          <span className="text-sm text-muted-foreground" data-testid="ai-quiz-usage-label">
            {usageLabel}
          </span>
        )}
      </div>

      {isLateral ? (
        <p className="text-sm text-muted-foreground">
          水平思考形式では AI 一括作問は初版未対応です。問題を手動で追加してください。
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            data-testid="ai-quiz-prompt-input"
            className={editorClasses.textarea}
            placeholder="例: 日本の歴史に関する初級レベルの問題を作ってください"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={isGenerating}
          />
          {isPromptTooLong && (
            <p className="text-sm text-destructive">
              プロンプトは{AI_QUIZ_PROMPT_MAX_LENGTH}文字以内で入力してください（現在 {prompt.length} 文字）
            </p>
          )}
          <Button
            type="submit"
            data-testid="ai-quiz-generate-button"
            disabled={isGenerating || isPromptTooLong || !prompt.trim()}
            className="w-fit"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中…
              </>
            ) : (
              '10問を生成して追加'
            )}
          </Button>
        </form>
      )}

      {errorMessage && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
