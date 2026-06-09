'use client';

import React from 'react';
import type { MyQuizPlaySettingsState } from '@/hooks/useMyQuizPool';
import styles from './my-quiz.module.css';

interface MyQuizPlaySettingsProps {
  settings: MyQuizPlaySettingsState;
  filteredCount: number;
  effectivePlayCount: number;
  poolLoading?: boolean;
  onChange: (settings: MyQuizPlaySettingsState) => void;
}

const PRESETS: { value: MyQuizPlaySettingsState['countPreset']; label: string }[] = [
  { value: '10', label: '10問' },
  { value: '20', label: '20問' },
  { value: 'all', label: '全件' },
  { value: 'custom', label: 'カスタム' },
];

export function MyQuizPlaySettings({
  settings,
  filteredCount,
  effectivePlayCount,
  poolLoading = false,
  onChange,
}: MyQuizPlaySettingsProps) {
  const clamped =
    settings.countPreset !== 'all' &&
    effectivePlayCount < (settings.countPreset === 'custom' ? settings.customCount : Number(settings.countPreset));

  return (
    <section className={styles.section} data-testid="my-quiz-play-settings">
      <h2 className={styles.sectionTitle}>出題設定</h2>

      <div className={styles.segmentGroup} role="radiogroup" aria-label="出題数">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={settings.countPreset === p.value}
            className={`${styles.segmentBtn} ${
              settings.countPreset === p.value ? styles.segmentBtnActive : ''
            }`}
            onClick={() => onChange({ ...settings, countPreset: p.value })}
          >
            {p.label}
          </button>
        ))}
      </div>

      {settings.countPreset === 'custom' && (
        <input
          type="number"
          min={1}
          className={styles.filterInput}
          value={settings.customCount}
          onChange={(e) =>
            onChange({ ...settings, customCount: Math.max(1, Number(e.target.value) || 1) })
          }
          data-testid="my-quiz-custom-count"
        />
      )}

      <div className={styles.toggleRow}>
        <label className={styles.toggleSwitch} htmlFor="my-quiz-shuffle">
          <input
            id="my-quiz-shuffle"
            type="checkbox"
            checked={settings.shuffle}
            onChange={(e) => onChange({ ...settings, shuffle: e.target.checked })}
            data-testid="my-quiz-shuffle-toggle"
          />
          <span className={styles.toggleSlider} aria-hidden />
        </label>
        <span className={styles.toggleLabel}>シャッフルして出題</span>
      </div>

      {!poolLoading && (
        <p className={styles.previewText} data-testid="my-quiz-question-count-preview">
          対象 {filteredCount} 問 / 出題 {effectivePlayCount} 問
          {clamped && filteredCount > 0 && (
            <span className={styles.hint}>（プール件数に合わせて自動調整）</span>
          )}
        </p>
      )}
    </section>
  );
}
