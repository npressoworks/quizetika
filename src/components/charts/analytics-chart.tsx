'use client';

import React from 'react';

interface ChartDataPoint {
  label: string;
  value: number;
}

interface AnalyticsChartProps {
  data: ChartDataPoint[];
  title: string;
  unit?: string;
  color?: 'primary' | 'accent';
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  data,
  title,
  unit = '回',
  color = 'primary'
}) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const colorHex = color === 'primary' ? 'var(--color-primary)' : 'var(--color-accent)';
  const colorGlow = color === 'primary' ? 'var(--color-primary-glow)' : 'var(--color-accent-glow)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>直近7日間</span>
      </div>

      {/* グラフのプロットエリア */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: '180px',
        padding: '10px 10px 0 10px',
        background: 'rgba(255, 255, 255, 0.01)',
        borderBottom: '2px solid var(--border-light)',
        gap: '12px',
      }}>
        {data.map((dp, idx) => {
          const heightPercent = `${Math.max((dp.value / maxValue) * 100, 4)}%`;
          
          return (
            <div key={idx} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              justifyContent: 'flex-end',
              position: 'relative',
            }}>
              {/* ホバー時のツールチップまたは数値 */}
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: color === 'primary' ? 'var(--color-primary-hover)' : 'var(--color-accent)',
                marginBottom: '8px',
                animation: 'fadeIn 0.3s ease-out',
              }}>
                {dp.value}
              </span>

              {/* 棒 (バー) */}
              <div style={{
                width: '100%',
                maxWidth: '30px',
                height: heightPercent,
                background: `linear-gradient(to top, ${colorHex}, ${color === 'primary' ? '#7b2cbf' : '#00bbf9'})`,
                borderRadius: '6px 6px 0 0',
                boxShadow: `0 0 15px ${colorGlow}`,
                transition: 'height 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)',
                cursor: 'pointer',
              }}
              title={`${dp.label}: ${dp.value}${unit}`}
              />
            </div>
          );
        })}
      </div>

      {/* X軸のラベル */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 10px' }}>
        {data.map((dp, idx) => (
          <span key={idx} style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            width: '100%',
            maxWidth: '30px',
            textAlign: 'center',
            fontWeight: 500
          }}>
            {dp.label}
          </span>
        ))}
      </div>
    </div>
  );
};
