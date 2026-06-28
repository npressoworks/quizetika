'use client';

import React, { useState } from 'react';
import { CloseOutlined, CheckCircleOutlined, BlockOutlined, WarningAmberOutlined } from '@mui/icons-material';
import { FeedbackReport, Question } from '@/types';
import styles from './feedback-report-sidebar.module.css';

interface FeedbackReportSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  reports: FeedbackReport[];
  questions: Question[];
  onResolveReport: (reportId: string) => Promise<void>;
  onRejectReport: (reportId: string) => Promise<void>;
}

export function FeedbackReportSidebar({
  isOpen,
  onClose,
  reports,
  questions,
  onResolveReport,
  onRejectReport,
}: FeedbackReportSidebarProps) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const handleResolve = async (reportId: string) => {
    setProcessingIds((prev) => new Set(prev).add(reportId));
    try {
      await onResolveReport(reportId);
    } catch (err) {
      alert('解決処理中にエラーが発生しました。');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  };

  const handleReject = async (reportId: string) => {
    setProcessingIds((prev) => new Set(prev).add(reportId));
    try {
      await onRejectReport(reportId);
    } catch (err) {
      alert('却下処理中にエラーが発生しました。');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(reportId);
        return next;
      });
    }
  };

  // カテゴリの日本語化
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'typo':
        return '誤字・脱字';
      case 'fact':
        return '事実誤認';
      case 'alternative':
        return '別解の存在';
      default:
        return category;
    }
  };

  // 問題番号と文言の特定
  const getQuestionInfo = (questionId: string) => {
    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx === -1) return { indexLabel: '不明な問題', text: '' };
    const q = questions[idx];
    return {
      indexLabel: `問題 ${idx + 1}`,
      text: q.questionText || '',
      index: idx,
    };
  };

  // 問題へのスクロール
  const scrollToQuestion = (questionIdx: number | undefined) => {
    if (questionIdx === undefined) return;
    const element = document.getElementById(`question-card-${questionIdx}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 一時的にハイライトする
      element.style.borderColor = 'var(--color-accent)';
      element.style.boxShadow = '0 0 15px var(--color-accent-glow)';
      setTimeout(() => {
        element.style.borderColor = '';
        element.style.boxShadow = '';
      }, 2000);
      onClose(); // スクロールしたらサイドバーを閉じる
    }
  };

  return (
    <div
      data-testid="feedback-sidebar-panel"
      className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
    >
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <WarningAmberOutlined sx={{ fontSize: 20, color: '#f59e0b' }} />
          <span>クイズへの指摘一覧 ({reports.length})</span>
        </div>
        <button className={styles.closeButton} onClick={onClose} aria-label="閉じる">
          <CloseOutlined sx={{ fontSize: 20 }} />
        </button>
      </div>

      <div className={styles.list}>
        {reports.length === 0 ? (
          <p className={styles.emptyText}>未解決の指摘はありません。</p>
        ) : (
          reports.map((report) => {
            const qInfo = getQuestionInfo(report.questionId);
            const isProcessing = processingIds.has(report.id);

            return (
              <div key={report.id} className={styles.card} data-testid={`report-card-${report.id}`}>
                <div className={styles.cardHeader}>
                  {qInfo.index !== undefined ? (
                    <span
                      className={styles.questionBadge}
                      onClick={() => scrollToQuestion(qInfo.index)}
                      title="この問題へスクロール"
                    >
                      {qInfo.indexLabel} (クリックで移動)
                    </span>
                  ) : (
                    <span className={styles.questionBadge}>{qInfo.indexLabel}</span>
                  )}
                  <span className={styles.categoryBadge}>
                    {getCategoryLabel(report.category)}
                  </span>
                </div>

                {qInfo.text && (
                  <div className={styles.inlineQuestionText}>
                    {qInfo.text.length > 50 ? `${qInfo.text.substring(0, 50)}...` : qInfo.text}
                  </div>
                )}

                <div className={styles.content}>{report.content}</div>

                <div className={styles.meta}>
                  <span>指摘ユーザー: {report.reporterId.substring(0, 6)}</span>
                  <span>{new Date(report.createdAt).toLocaleDateString('ja-JP')}</span>
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.resolveBtn}
                    onClick={() => handleResolve(report.id)}
                    disabled={isProcessing}
                  >
                    <CheckCircleOutlined sx={{ fontSize: 16 }} />
                    解決済
                  </button>
                  <button
                    type="button"
                    className={styles.rejectBtn}
                    onClick={() => handleReject(report.id)}
                    disabled={isProcessing}
                  >
                    <BlockOutlined sx={{ fontSize: 16 }} />
                    却下
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
