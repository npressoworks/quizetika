'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { exportQuizzes } from '@/services/quiz';
import { Download, Plus } from 'lucide-react';
import styles from './dashboard.module.css';

export function DashboardActions() {
  const router = useRouter();
  const { user } = useAuth();

  const handleExportAll = async () => {
    if (!user) return;
    try {
      const dataPackage = await exportQuizzes(user.id);
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(dataPackage, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `quizeum_export_${user.displayName}_${new Date().toISOString().split('T')[0]}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      alert('エクスポートに失敗しました。');
    }
  };

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleExportAll}
        data-analytics="creator-export-all"
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Download size={16} />
        クイズ一括エクスポート
      </button>
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => router.push('/list/create')}
        data-analytics="creator-create-list"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--text-main)',
          border: '1px solid var(--border-light)',
          background: 'rgba(255, 255, 255, 0.05)',
        }}
      >
        <Plus size={16} />
        リストを新規作成
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => router.push('/quiz/create')}
        data-analytics="creator-create-quiz"
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <Plus size={16} />
        クイズを新規作成
      </button>
    </div>
  );
}
