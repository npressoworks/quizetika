'use client';

import React from 'react';

interface PieSegment {
  label: string;
  percentage: number;
  color: string;
}

interface SelectionPieProps {
  data: {
    label: string;
    count: number;
  }[];
}

const COLORS = [
  '#9d4edd', // primary
  '#00f5d4', // accent
  '#ff0054', // danger
  '#ffbd00', // warning
  '#00bbf9', // blue
];

export const SelectionPie: React.FC<SelectionPieProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  
  if (total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        解答データがまだありません
      </div>
    );
  }

  // 割合と色を割り当て
  let accumulatedPercent = 0;
  const segments: PieSegment[] = data.map((item, idx) => {
    const percent = Math.round((item.count / total) * 100);
    const color = COLORS[idx % COLORS.length];
    const segment = {
      label: item.label,
      percentage: percent,
      color,
    };
    accumulatedPercent += percent;
    return segment;
  });

  // conic-gradient のスタイリングを動的生成
  let gradientParts: string[] = [];
  let currentAngle = 0;
  
  segments.forEach((seg) => {
    const nextAngle = currentAngle + (seg.percentage / 100) * 360;
    gradientParts.push(`${seg.color} ${currentAngle}deg ${nextAngle}deg`);
    currentAngle = nextAngle;
  });

  const chartStyle = {
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    background: `conic-gradient(${gradientParts.join(', ')})`,
    position: 'relative' as const,
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // ドーナツチャートにするための内円
  const innerCircleStyle = {
    width: '75px',
    height: '75px',
    borderRadius: '50%',
    background: '#151126', // bg-surface-solid と同等
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'inset 0 0 8px rgba(0, 0, 0, 0.6)',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', padding: '10px 0' }}>
      {/* ドーナツチャート */}
      <div style={chartStyle}>
        <div style={innerCircleStyle}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>合計回答</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>{total}</span>
        </div>
      </div>

      {/* 凡例リスト */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {segments.map((seg, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }} title={seg.label}>
                {seg.label}
              </span>
            </div>
            <span style={{ color: 'var(--text-muted)', fontWeight: 700, marginLeft: '8px' }}>{seg.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
