'use client';

import React, { useRef, useState } from 'react';
import { ImageOutlined, InfoOutlined, AutoAwesomeOutlined } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { isGovernanceFrozen } from '@/lib/governance-freeze';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { DifficultyVoteStars } from '@/components/quiz/difficulty-vote-stars';
import { GenreEditorSelect } from '@/components/quiz/genre-editor-select';
import { QuizTagEditor } from '@/components/quiz/editor/quiz-tag-editor';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import { filterValidationErrors, type QuizPublishValidationError } from '@/services/quiz-validation';
import type { GenreMetadata } from '@/types';
import { ImageCropper } from '@/components/ui/image-cropper';

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
  quizId?: string;
  onThumbnailChange: (url: string | null, blob: Blob | null) => void;
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
  quizId,
  onThumbnailChange,
}: QuizMetadataSectionProps) {
  const { user } = useAuth();
  const isAdmin = !!user && isAdminUser(user);
  const showGenreLink = isGovernanceFrozen() ? isAdmin : !!user;
  const titleHasError = filterValidationErrors(validationErrors, { field: 'title' }).length > 0;
  const genreHasError = filterValidationErrors(validationErrors, { field: 'genre' }).length > 0;

  // ローカルファイルアップロードとトリミングの状態管理
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [localUploadError, setLocalUploadError] = useState<string | null>(null);
  const [aiThumbnailMissingFields, setAiThumbnailMissingFields] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ファイル形式バリデーション (SVGを排除)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setLocalUploadError('PNG, JPEG, GIF 形式の画像のみアップロード可能です。');
      return;
    }

    // ファイルサイズバリデーション (10MB以下)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setLocalUploadError('ファイルサイズは 10MB 以下にしてください。');
      return;
    }

    setLocalUploadError(null);
    const objectUrl = URL.createObjectURL(file);
    setSelectedImageSrc(objectUrl);
    setCropperOpen(true);

    // 同じファイルを再度選択できるように選択値をリセット
    e.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    try {
      setLocalUploadError(null);
      // 一時的なオブジェクト URL を作成して即時プレビューに反映させる（Storageアップロードは保存時に遅延実行）
      const objectUrl = URL.createObjectURL(croppedBlob);
      onThumbnailChange(objectUrl, croppedBlob);
    } catch (err: any) {
      console.error('画像の切り抜き処理に失敗しました:', err);
      setLocalUploadError(err.message || '画像の切り抜きに失敗しました。');
    } finally {
      if (selectedImageSrc) {
        URL.revokeObjectURL(selectedImageSrc);
        setSelectedImageSrc(null);
      }
    }
  };

  const handleAiThumbnailClick = () => {
    if (!title.trim() || !description.trim()) {
      setAiThumbnailMissingFields(true);
      return;
    }
    setAiThumbnailMissingFields(false);
    onAiThumbnailGenerate?.();
  };

  const handleCropperClose = () => {
    setCropperOpen(false);
    if (selectedImageSrc) {
      URL.revokeObjectURL(selectedImageSrc);
      setSelectedImageSrc(null);
    }
  };

  return (
    <div className={editorClasses.editorCard}>
      <h2 className={editorClasses.sectionTitle}>
        <InfoOutlined sx={{ fontSize: 20 }} />
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
            placeholder="例: 世界の国旗と首都クイズ"
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
            <div
              className={`${editorClasses.thumbnailUpload} relative overflow-hidden group`}
              onClick={() => !isAiThumbnailGenerating && fileInputRef.current?.click()}
            >
              {isAiThumbnailGenerating ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <CircularProgress size={24} />
                  <span className="text-sm font-semibold">AIで生成中…</span>
                </div>
              ) : thumbnailUrl ? (
                <>
                  <img src={thumbnailUrl} alt="Thumbnail preview" className={editorClasses.thumbnailPreview} />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-sm font-semibold">
                    ローカル画像を選択
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageOutlined sx={{ fontSize: 32 }} />
                  <span className="text-sm font-semibold">画像を選択 / ドロップ</span>
                </div>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/gif"
              className="hidden"
            />

            {localUploadError && (
              <p className="text-xs text-destructive mt-1.5">{localUploadError}</p>
            )}

            {selectedImageSrc && (
              <ImageCropper
                imageSrc={selectedImageSrc}
                isOpen={cropperOpen}
                onClose={handleCropperClose}
                onCropComplete={handleCropComplete}
              />
            )}
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
                  disabled={isAiThumbnailGenerating}
                  onClick={handleAiThumbnailClick}
                  className="w-fit"
                >
                  {isAiThumbnailGenerating ? (
                    <>
                      <CircularProgress size={16} className="mr-2" />
                      生成中…
                    </>
                  ) : (
                    <>
                      <AutoAwesomeOutlined sx={{ fontSize: 16 }} className="mr-2" />
                      AIでサムネイル生成
                    </>
                  )}
                </Button>
                {!title.trim() || !description.trim() ? (
                  <p
                    className={
                      aiThumbnailMissingFields
                        ? 'text-xs text-destructive font-semibold'
                        : 'text-xs text-muted-foreground'
                    }
                  >
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
                {showGenreLink && (
                  <a href="/community/genres" className={editorClasses.genreLink}>
                    新しいジャンルを申請する
                  </a>
                )}
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
