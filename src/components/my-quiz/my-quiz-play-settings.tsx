'use client';

import React from 'react';
import type { MyQuizPlaySettingsState } from '@/hooks/useMyQuizPool';
import styles from './my-quiz.module.css';

interface MyQuizPlaySettingsProps {
  settings: MyQuizPlaySettingsState;
  filteredCount: number;
  effectivePlayCount: number;
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
  onChange,
}: MyQuizPlaySettingsProps) {
  const clamped =
    settings.countPreset !== 'all' &&
    effectivePlayCount < (settings.countPreset === 'custom' ? settings.customCount : Number(settings.countPreset));

  return (
    <section className={styles.section} data-testid="my-quiz-play-settings">
      <h2 className={styles.sectionTitle}>出題設定</h2>

      <div className={styles.presetRow}>
        {PRESETS.map((p) => (
          <label key={p.value} className={styles.presetLabel}>
            <input
              type="radio"
              name="countPreset"
              checked={settings.countPreset === p.value}
              onChange={() => onChange({ ...settings, countPreset: p.value })}
            />
            {p.label}
          </label>
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

      <label className={styles.sourceLabel}>
        <input
          type="checkbox"
          checked={settings.shuffle}
          onChange={(e) => onChange({ ...settings, shuffle: e.target.checked })}
          data-testid="my-quiz-shuffle-toggle"
        />
        <span>シャッフルして出題</span>
      </label>

      <p className={styles.previewText} data-testid="my-quiz-question-count-preview">
        対象 {filteredCount} 問 / 出題 {effectivePlayCount} 問
        {clamped && filteredCount > 0 && (
          <span className={styles.hint}>（プール件数に合わせて自動調整）</span>
        )}
      </p>
    </section>
  );
}
