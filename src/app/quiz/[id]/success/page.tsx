import React from 'react';
import { Metadata } from 'next';
import { getQuiz } from '@/services/quiz';
import { SuccessClient } from './success-client';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface SuccessPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * ページのメタデータを動的に生成
 */
export async function generateMetadata({ params }: SuccessPageProps): Promise<Metadata> {
  const { id } = await params;
  const quiz = await getQuiz(id);
  
  return {
    title: quiz ? `投稿完了: ${quiz.title} | quizeum` : 'クイズ投稿完了 | quizeum',
    description: 'quizeumでのクイズ投稿が完了しました。SNSでシェアしましょう！',
  };
}

/**
 * クイズ投稿完了画面のServer Component
 * パラメータからクイズIDを非同期で解決し、クイズ情報を取得してクライアントコンポーネントへ渡します。
 */
export default async function QuizSuccessPage({ params }: SuccessPageProps) {
  const { id } = await params;
  const quiz = await getQuiz(id);

  // 対象のクイズが見つからなかった場合のエラー表示
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
            <AlertTriangle size={48} />
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

  // クイズ情報をクライアントコンポーネントへ引き継ぐ
  return <SuccessClient quiz={quiz} />;
}
