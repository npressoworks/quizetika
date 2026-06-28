'use client';

import React, { useState } from 'react';
import { WarningAmberOutlined, CheckCircleOutlined, BlockOutlined } from '@mui/icons-material';
import { FeedbackReport, Question } from '@/types';
import styles from './feedback-report-sidebar.module.css';

interface UnresolvedReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: FeedbackReport[];
  questions: Question[];
  onResolveReport: (reportId: string) => Promise<void>;
  onRejectReport: (reportId: string) => Promise<void>;
  onForcePublish: () => void;
}

export function UnresolvedReportsModal({
  isOpen,
  onClose,
  reports,
  questions,
  onResolveReport,
  onRejectReport,
  onForcePublish,
}: UnresolvedReportsModalProps) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

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
    };
  };

  return (
    <div className={styles.modalOverlay} data-testid="unresolved-reports-modal">
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <WarningAmberOutlined sx={{ fontSize: 24, color: '#f59e0b' }} />
          <h2 className={styles.modalHeaderTitle}>未解消の指摘があります</h2>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.modalDescription}>
            このクイズには、プレイヤーから寄せられた未解消の間違い指摘が残っています。
            各指摘について、修正して「解決済」にするか、「却下」するか選択してください。
            指摘を残したままでも更新することができます。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reports.map((report) => {
              const qInfo = getQuestionInfo(report.questionId);
              const isProcessing = processingIds.has(report.id);

              return (
                <div key={report.id} className={styles.card} data-testid={`modal-report-card-${report.id}`}>
                  <div className={styles.cardHeader}>
                    <span className={styles.questionBadge}>{qInfo.indexLabel}</span>
                    <span className={styles.categoryBadge}>
                      {getCategoryLabel(report.category)}
                    </span>
                  </div>

                  {qInfo.text && (
                    <div className={styles.inlineQuestionText}>{qInfo.text}</div>
                  )}

                  <div className={styles.content}>{report.content}</div>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.resolveBtn}
                      onClick={() => handleResolve(report.id)}
                      disabled={isProcessing}
                    >
                      <CheckCircleOutlined sx={{ fontSize: 14 }} />
                      解決済
                    </button>
                    <button
                      type="button"
                      className={styles.rejectBtn}
                      onClick={() => handleReject(report.id)}
                      disabled={isProcessing}
                    >
                      <BlockOutlined sx={{ fontSize: 14 }} />
                      却下
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            編集に戻る
          </button>
          <button type="button" className={styles.publishForceBtn} onClick={onForcePublish}>
            このまま更新する
          </button>
        </div>
      </div>
    </div>
  );
}
