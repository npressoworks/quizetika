'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { flagContent } from '@/services/moderation';
import styles from './report-modal.module.css';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  reporterId: string;
}

export function ReportModal({ isOpen, onClose, quizId, reporterId }: ReportModalProps) {
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      await flagContent(quizId, reporterId, reason);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setReason('');
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('[ReportModal] 通報失敗:', err);
      setError(err?.message || '通報の送信に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose} data-testid="report-modal-overlay">
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} data-testid="report-modal-content">
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <AlertTriangle size={18} style={{ color: '#ff007f' }} />
            クイズの通報
          </h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="閉じる" type="button">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className={styles.successMessage} data-testid="report-success-message">
            <CheckCircle size={32} style={{ margin: '0 auto 12px', color: '#00f5d4' }} />
            <p>通報を送信しました。ご協力ありがとうございました。</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <p className={styles.description}>
              このクイズが利用規約やガイドライン（公序良俗に反する内容、著作権侵害、その他不適切な記述など）に違反していると思われる場合は、具体的な理由を入力して通報してください。
            </p>

            <div className={styles.formGroup}>
              <label htmlFor="report-reason" className={styles.label}>通報理由（必須）</label>
              <textarea
                id="report-reason"
                className={styles.textarea}
                placeholder="通報理由を具体的に記述してください..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                disabled={loading}
                data-testid="report-reason-input"
              />
            </div>

            {error && <p className={styles.errorMessage}>{error}</p>}

            <div className={styles.btnRow}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={onClose}
                disabled={loading}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, background: '#ff007f', borderColor: '#ff007f' }}
                disabled={loading || !reason.trim()}
                data-testid="report-submit-btn"
                data-analytics="quiz-report-submit"
              >
                {loading ? '送信中...' : '通報する'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
