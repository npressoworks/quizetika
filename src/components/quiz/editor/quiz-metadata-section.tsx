'use client';

import React from 'react';
import { Image, Info, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { DifficultyVoteStars } from '@/components/quiz/difficulty-vote-stars';
import { GenreEditorSelect } from '@/components/quiz/genre-editor-select';
import { QuizTagEditor } from '@/components/quiz/editor/quiz-tag-editor';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import { filterValidationErrors, type QuizPublishValidationError } from '@/services/quiz-validation';
import type { GenreMetadata } from '@/types';

export interface QuizMetadataSectionProps {
  title: string;
  description: string;
  thumbnailUrl: string | null;
  difficulty: number | null;
  genre: string;
  validationErrors: QuizPublishValidationError[];
  genres: GenreMetadata[];
  genresLoading: boolean;
  genresError: string | null;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAiThumbnailGenerate?: () => void;
  isAiThumbnailGenerating?: boolean;
  canUseAiThumbnail?: boolean;
  aiThumbnailUsageLabel?: string;
  aiThumbnailError?: string | null;
  onDifficultyChange: (value: number | null) => void;
  onGenreChange: (value: string) => void;
  onGenresRetry: () => void;
  originalTags: string[];
  tagInput: string;
  suggestedTag: string | null;
  onTagInputChange: (value: string) => void;
  onAddTag: (e: React.FormEvent) => void;
  onApplySuggestedTag: () => void;
  onRemoveTag: (idx: number) => void;
}

export function QuizMetadataSection({
  title,
  description,
  thumbnailUrl,
  difficulty,
  genre,
  validationErrors,
  genres,
  genresLoading,
  genresError,
  onTitleChange,
  onDescriptionChange,
  onAiThumbnailGenerate,
  isAiThumbnailGenerating = false,
  canUseAiThumbnail = false,
  aiThumbnailUsageLabel,
  aiThumbnailError,
  onDifficultyChange,
  onGenreChange,
  onGenresRetry,
  originalTags,
  tagInput,
  suggestedTag,
  onTagInputChange,
  onAddTag,
  onApplySuggestedTag,
  onRemoveTag,
}: QuizMetadataSectionProps) {
  const titleHasError = filterValidationErrors(validationErrors, { field: 'title' }).length > 0;
  const genreHasError = filterValidationErrors(validationErrors, { field: 'genre' }).length > 0;

  return (
    <div className={editorClasses.editorCard}>
      <h2 className={editorClasses.sectionTitle}>
        <Info size={20} />
        クイズの基本設定
      </h2>

      <div className="flex flex-col gap-5">
        <div className={editorClasses.formGroup} id="field-title">
          <label className={editorClasses.label}>
            クイズタイトル <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            className={`${editorClasses.input} ${titleHasError ? editorClasses.inputError : ''}`}
            placeholder="例: React Hooksの基礎知識クイズ"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            maxLength={100}
          />
          <FieldValidationMessages errors={validationErrors} field="title" />
        </div>

        <div className={editorClasses.formGroup}>
          <label className={editorClasses.label}>説明文</label>
          <AutoGrowTextarea
            className={editorClasses.textarea}
            placeholder="クイズの概要や対象読者などを入力してください。"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            minRows={4}
            data-testid="auto-grow-description"
          />
        </div>

        <div className={editorClasses.metaGrid}>
          <div className={editorClasses.formGroup}>
            <label className={editorClasses.label}>サムネイル画像</label>
            <div className={editorClasses.thumbnailUpload}>
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="Thumbnail preview" className={editorClasses.thumbnailPreview} />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Image size={32} />
                  <span className="text-sm">AI でサムネイルを生成</span>
                </div>
              )}
            </div>
            {canUseAiThumbnail && (
              <div className="mt-2 flex flex-col gap-2">
                {aiThumbnailUsageLabel && (
                  <span className="text-xs text-muted-foreground">{aiThumbnailUsageLabel}</span>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  data-testid="ai-thumbnail-generate-button"
                  disabled={isAiThumbnailGenerating || !title.trim() || !description.trim()}
                  onClick={onAiThumbnailGenerate}
                  className="w-fit"
                >
                  {isAiThumbnailGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      生成中…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI でサムネイル生成
                    </>
                  )}
                </Button>
                {!title.trim() || !description.trim() ? (
                  <p className="text-xs text-muted-foreground">
                    タイトルと説明文を入力するとサムネイルを生成できます
                  </p>
                ) : null}
                {aiThumbnailError && (
                  <p className="text-xs text-destructive">{aiThumbnailError}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div className={editorClasses.formGroup} id="field-difficulty">
              <label className={editorClasses.label}>難易度 (1 - 5)</label>
              <DifficultyVoteStars value={difficulty} onVote={onDifficultyChange} />
              <FieldValidationMessages errors={validationErrors} field="difficulty" />
            </div>

            <div className={editorClasses.formGroup} id="field-genre">
              <div className={editorClasses.genreContainer}>
                <label className={editorClasses.label}>
                  ジャンル <span className="text-destructive">*</span>
                </label>
                <GenreEditorSelect
                  value={genre}
                  onChange={onGenreChange}
                  genres={genres}
                  loading={genresLoading}
                  error={genresError}
                  onRetry={onGenresRetry}
                  selectClassName={`${editorClasses.select} ${genreHasError ? editorClasses.inputError : ''}`}
                />
                <a href="/community/genres" className={editorClasses.genreLink}>
                  新しいジャンルを申請する
                </a>
              </div>
              <FieldValidationMessages errors={validationErrors} field="genre" />
            </div>

            <QuizTagEditor
              originalTags={originalTags}
              tagInput={tagInput}
              suggestedTag={suggestedTag}
              onTagInputChange={onTagInputChange}
              onAddTag={onAddTag}
              onApplySuggestedTag={onApplySuggestedTag}
              onRemoveTag={onRemoveTag}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
