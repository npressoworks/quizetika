import React, { useState, useEffect } from 'react';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DashboardFilters } from './use-dashboard-filters';

interface DashboardFilterBarProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onReset: () => void;
  type: 'player' | 'creator';
}

export function DashboardFilterBar({
  filters,
  onChange,
  onReset,
  type,
}: DashboardFilterBarProps) {
  const { genres } = useActiveGenres();
  const [localTag, setLocalTag] = useState(filters.tag || '');

  // タグのデバウンス制御
  useEffect(() => {
    setLocalTag(filters.tag || '');
  }, [filters.tag]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localTag !== (filters.tag || '')) {
        onChange({ ...filters, tag: localTag || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localTag, onChange, filters]);

  const handlePeriodChange = (val: string) => {
    onChange({ ...filters, period: val as any });
  };

  const handleGenreChange = (val: string) => {
    onChange({ ...filters, genreId: val === 'all' ? undefined : val });
  };

  const handleQuestionTypeChange = (val: string) => {
    onChange({ ...filters, questionType: val === 'all' ? undefined : val });
  };

  const handleModeChange = (val: string) => {
    onChange({ ...filters, mode: val === 'all' ? undefined : val });
  };

  const handleFormatChange = (val: string) => {
    onChange({ ...filters, format: val === 'all' ? undefined : val });
  };

  const handleVisibilityChange = (val: string) => {
    onChange({ ...filters, visibility: val === 'all' ? undefined : (val as any) });
  };

  const hasActiveFilters =
    filters.period !== '30d' ||
    filters.genreId !== undefined ||
    filters.tag !== undefined ||
    filters.questionType !== undefined ||
    filters.mode !== undefined ||
    filters.format !== undefined ||
    filters.visibility !== undefined;

  return (
    <div
      data-testid="dashboard-filter-bar"
      className="flex flex-wrap items-end gap-4 p-4 rounded-xl border bg-card text-card-foreground shadow-sm mb-6"
    >
      {/* 期間選択 */}
      <div className="flex flex-col gap-1.5 min-w-[120px]">
        <label className="text-xs font-medium text-muted-foreground">期間</label>
        <Select value={filters.period} onValueChange={handlePeriodChange}>
          <SelectTrigger data-testid="filter-period-select">
            <SelectValue placeholder="期間を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">直近7日間</SelectItem>
            <SelectItem value="30d">直近30日間</SelectItem>
            <SelectItem value="90d">直近90日間</SelectItem>
            <SelectItem value="all">全期間</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ジャンル選択 */}
      <div className="flex flex-col gap-1.5 min-w-[150px]">
        <label className="text-xs font-medium text-muted-foreground">ジャンル</label>
        <Select value={filters.genreId || 'all'} onValueChange={handleGenreChange}>
          <SelectTrigger data-testid="filter-genre-select">
            <SelectValue placeholder="ジャンルを選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべてのジャンル</SelectItem>
            {genres?.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* プレイヤー専用のフィルタ */}
      {type === 'player' && (
        <>
          {/* タグ入力 */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <label className="text-xs font-medium text-muted-foreground">タグ</label>
            <Input
              type="text"
              placeholder="タグ名で絞り込み"
              value={localTag}
              onChange={(e) => setLocalTag(e.target.value)}
              data-testid="filter-tag-input"
              className="h-9"
            />
          </div>

          {/* 設問形式 */}
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-xs font-medium text-muted-foreground">設問形式</label>
            <Select value={filters.questionType || 'all'} onValueChange={handleQuestionTypeChange}>
              <SelectTrigger data-testid="filter-question-type-select">
                <SelectValue placeholder="形式を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての形式</SelectItem>
                <SelectItem value="multiple-choice">選択式</SelectItem>
                <SelectItem value="write-in">短答式</SelectItem>
                <SelectItem value="true-false">〇✕問題</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* プレイモード */}
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-xs font-medium text-muted-foreground">プレイモード</label>
            <Select value={filters.mode || 'all'} onValueChange={handleModeChange}>
              <SelectTrigger data-testid="filter-mode-select">
                <SelectValue placeholder="モードを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべてのモード</SelectItem>
                <SelectItem value="normal">通常プレイ</SelectItem>
                <SelectItem value="exam">試験モード</SelectItem>
                <SelectItem value="flashcard">暗記カード</SelectItem>
                <SelectItem value="review">復習モード</SelectItem>
                <SelectItem value="list">リストプレイ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* クリエイター専用のフィルタ */}
      {type === 'creator' && (
        <>
          {/* 出題形式 */}
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-xs font-medium text-muted-foreground">出題形式</label>
            <Select value={filters.format || 'all'} onValueChange={handleFormatChange}>
              <SelectTrigger data-testid="filter-format-select">
                <SelectValue placeholder="形式を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての形式</SelectItem>
                <SelectItem value="multiple-choice">選択式</SelectItem>
                <SelectItem value="write-in">短答式</SelectItem>
                <SelectItem value="true-false">〇✕問題</SelectItem>
                <SelectItem value="lateral">水平思考</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 公開範囲 */}
          <div className="flex flex-col gap-1.5 min-w-[130px]">
            <label className="text-xs font-medium text-muted-foreground">公開範囲</label>
            <Select value={filters.visibility || 'all'} onValueChange={handleVisibilityChange}>
              <SelectTrigger data-testid="filter-visibility-select">
                <SelectValue placeholder="公開範囲を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての範囲</SelectItem>
                <SelectItem value="public">公開</SelectItem>
                <SelectItem value="followers">限定公開</SelectItem>
                <SelectItem value="private">非公開</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* 一括クリアボタン */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          data-testid="filter-reset-btn"
          className="h-9 px-3 text-muted-foreground hover:text-foreground ml-auto"
        >
          リセット
        </Button>
      )}
    </div>
  );
}
