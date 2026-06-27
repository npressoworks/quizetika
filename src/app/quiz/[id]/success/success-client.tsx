'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Quiz } from '@/types';
import { getQuiz } from '@/services/quiz';
import { successClasses as styles } from './success-classes';
import {
  CheckOutlined,
  ContentCopyOutlined,
  PlayArrowOutlined,
  DashboardOutlined,
  AddOutlined,
  SmsOutlined,
  WarningAmberOutlined
} from '@mui/icons-material';
import Link from 'next/link';

interface SuccessClientProps {
  quizId: string;
}

/**
 * クイズ投稿完了画面のクライアントコンポーネント
 * 祝祭感のあるUIと、SNS（X / LINE）でのシェア機能を提供します。
 */
export const SuccessClient: React.FC<SuccessClientProps> = ({ quizId }) => {
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // クライアントサイドでクイズをロードする
  useEffect(() => {
    async function loadQuiz() {
      try {
        const data = await getQuiz(quizId);
        setQuiz(data);
      } catch (err) {
        console.error('Failed to load quiz:', err);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [quizId]);

  // クライアントサイドでのみ実行し、正しいorigin URLを構築する
  useEffect(() => {
    if (typeof window !== 'undefined' && quiz) {
      setShareUrl(`${window.location.origin}/quiz/${quiz.id}`);
    }
  }, [quiz?.id]);

  // URLをクリップボードにコピーする処理
  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        // 3秒後にツールチップ/トースト表示を非表示にする
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error('URLのコピーに失敗しました:', err);
    }
  };

  // X（旧Twitter）へのシェア用テキストとURLの生成
  const getTwitterShareUrl = () => {
    const text = `【クイズ公開！】「${quiz?.title || ''}」を公開しました！あなたは何問解ける？挑戦を待っています！\n#quizetika #クイズ\n`;
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
  };

  // LINEへのシェア用URLの生成
  const getLineShareUrl = () => {
    return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`;
  };

  // ジャンルの日本語ラベルマッピング
  const getGenreLabel = (genreName: string) => {
    const genres: { [key: string]: string } = {
      programming: 'プログラミング / IT',
      history: '歴史 / 世界史',
      science: '科学 / 自然科学',
      anime: 'アニメ / ゲーム',
      sports: 'スポーツ / 運動',
      general: '一般常識 / 雑学',
    };
    return genres[genreName] || genreName;
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          border: 'var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', color: 'var(--color-danger)' }}>
            <WarningAmberOutlined sx={{ fontSize: 48 }} />
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px' }}>クイズが見つかりません</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
            指定されたIDのクイズ情報が取得できないか、削除された可能性があります。
          </p>
          <Link href="/creator/dashboard" className="btn btn-primary" style={{ width: '100%' }}>
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.successCard}>
        <div className={styles.cardContent}>
          {/* お祝い用アイコンバッジと波紋演出 */}
          <div className={styles.badgeWrapper}>
            <div className={styles.badgeGlow} />
            <div className={styles.badge}>
              <CheckOutlined sx={{ fontSize: 48 }} />
            </div>
          </div>

          <h1 className={styles.title}>クイズの投稿が完了しました！</h1>
          <p className={styles.subtitle}>
            おめでとうございます！作成したクイズが正常に公開されました。さっそくSNSでシェアして、多くの挑戦者を募りましょう！
          </p>

          {/* クイズ簡易プレビューカード */}
          <div className={styles.quizPreview}>
            {quiz.thumbnailUrl ? (
              <img src={quiz.thumbnailUrl} alt={quiz.title} className={styles.thumbnailImage} />
            ) : (
              <div className={styles.thumbnailPlaceholder}>
                <span>No Image</span>
              </div>
            )}
            <div className={styles.quizMeta}>
              <h3 className={styles.quizTitle}>{quiz.title}</h3>
              <div className={styles.metaRow}>
                <span className={styles.genreBadge}>{getGenreLabel(quiz.genre)}</span>
                <span className={styles.difficultyText}>難易度: ★ {quiz.difficulty}</span>
                <span className={styles.genreBadge}>{quiz.questionCount} 問</span>
              </div>
            </div>
          </div>

          {/* SNSシェアセクション */}
          <div className={styles.shareSection}>
            <h2 className={styles.shareTitle}>このクイズをシェアする</h2>
            <div className={styles.shareButtons}>
              {/* X（Twitter）ボタン */}
              <a
                href={getTwitterShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.btnShare} ${styles.btnX}`}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Xでシェア
              </a>

              {/* LINEボタン */}
              <a
                href={getLineShareUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.btnShare} ${styles.btnLine}`}
              >
                <SmsOutlined sx={{ fontSize: 18 }} />
                LINEで送る
              </a>

              {/* URLコピーボタン */}
              <button
                onClick={handleCopyUrl}
                className={`${styles.btnShare} ${styles.btnCopy}`}
              >
                <ContentCopyOutlined sx={{ fontSize: 18 }} />
                URLをコピー
                {copied && <span className={styles.copyToast}>コピーしました！</span>}
              </button>
            </div>
          </div>

          {/* ナビゲーションアクションセクション */}
          <div className={styles.actionSection}>
            <div className={styles.actionRow}>
              {/* 自分で遊んでみるボタン */}
              <button
                onClick={() => router.push(`/quiz/${quiz.id}`)}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <PlayArrowOutlined sx={{ fontSize: 18 }} />
                自分でプレイする
              </button>

              {/* 作家ダッシュボードボタン */}
              <button
                onClick={() => router.push('/creator/dashboard')}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                <DashboardOutlined sx={{ fontSize: 18 }} />
                ダッシュボードに戻る
              </button>
            </div>

            {/* 新しいクイズを作るボタン */}
            <button
              onClick={() => router.push('/quiz/create')}
              className="btn btn-outline"
              style={{ width: '100%' }}
            >
              <AddOutlined sx={{ fontSize: 18 }} />
              新しいクイズを新規作成する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
