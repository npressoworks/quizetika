'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { exportQuizzes } from '@/services/quiz';
import { DownloadOutlined, AddOutlined } from '@mui/icons-material';
import { Button } from '@/components/ui/button';

export function DashboardActions() {
  const router = useRouter();
  const { user } = useAuth();

  const handleExportAll = async () => {
    if (!user) return;
    try {
      const dataPackage = await exportQuizzes(user.id);
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(dataPackage, null, 2),
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `quizetika_export_${user.displayName}_${new Date().toISOString().split('T')[0]}.json`,
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch {
      alert('エクスポートに失敗しました。');
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={handleExportAll}
        data-analytics="creator-export-all"
      >
        <DownloadOutlined sx={{ fontSize: 16 }} className="size-4" />
        クイズ一括エクスポート
      </Button>
      <Button
        type="button"
        onClick={() => router.push('/quiz/create')}
        data-analytics="creator-create-quiz"
      >
        <AddOutlined sx={{ fontSize: 16 }} className="size-4" />
        クイズを新規作成
      </Button>
    </div>
  );
}
