'use client';

import React from 'react';
import { LinkOutlined } from '@mui/icons-material';

export function ReferenceQuestionBadge() {
  return (
    <span
      data-testid="reference-question-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.75rem',
        fontWeight: 700,
        color: 'var(--color-primary)',
        background: 'rgba(0, 212, 255, 0.1)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: 4,
        padding: '2px 8px',
        marginLeft: 8,
      }}
    >
      <LinkOutlined sx={{ fontSize: 12 }} />
      参照リンク
    </span>
  );
}
