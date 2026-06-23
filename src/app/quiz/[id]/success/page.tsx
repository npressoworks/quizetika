import React from 'react';
import { Metadata } from 'next';
import { getQuiz } from '@/services/quiz';
import { SuccessClient } from './success-client';
import { WarningAmberOutlined } from '@mui/icons-material';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

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

  // クイズ情報をクライアントコンポーネントへ引き継ぎ、クライアント側で取得させる
  return <SuccessClient quizId={id} />;
}
