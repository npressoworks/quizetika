'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getQuizList, getQuizzesInList } from '@/services/quiz-list';
import { QuizList, Quiz } from '@/types';
import styles from './list.module.css';
import { Play, Edit, ArrowLeft, Layers, Bookmark, Heart, Inbox } from 'lucide-react';

export default function QuizListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const listId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [quizList, setQuizList] = useState<QuizList | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  useEffect(() => {
    if (!listId) return;

    const fetchListDetails = async () => {
      try {
        setLoading(true);
        const listData = await getQuizList(listId);
        if (listData) {
          setQuizList(listData);
          const quizzesData = await getQuizzesInList(listId);
          setQuizzes(quizzesData);
        }
      } catch (err) {
        console.error('Failed to load quiz list:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchListDetails();
  }, [listId]);

  // リストの連続プレイ開始 (要件 3.2)
  const handleStartSequentialPlay = () => {
    if (quizzes.length === 0) {
      alert('クイズが収録されていません。');
      return;
    }
    const firstQuiz = quizzes[0];
    
    // プレイ画面へ連続プレイの情報を渡しつつ遷移
    // プレイ画面へのパスは `/quiz/[id]/play?listId=[id]&mode=list` です
    router.push(`/quiz/${firstQuiz.id}/play?listId=${listId}&mode=list`);
  };

  // 個別クイズ単体のプレイ
  const handlePlayQuiz = (quizId: string) => {
    router.push(`/quiz/${quizId}/play`);
  };

  if (authLoading || loading) {
    return <div className={styles.container}>読み込み中...</div>;
  }

  if (!quizList) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Inbox size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h2>リストが見つかりません</h2>
          <p>指定されたリストは削除されたか、存在しない可能性があります。</p>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => router.push('/')}>
            トップへ戻る
          </button>
        </div>
      </div>
    );
  }

  const isCreator = user && user.id === quizList.authorId;

  return (
    <div className={styles.container}>
      {/* 戻るボタン */}
      <button 
        onClick={() => router.back()} 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', color: 'var(--text-muted)', cursor: 'pointer' }}
      >
        <ArrowLeft size={18} />
        <span>戻る</span>
      </button>

      {/* バナーエリア (要件 3.1) */}
      <div className={styles.banner}>
        <div className={styles.coverContainer}>
          {quizList.coverImageUrl && (
            <img src={quizList.coverImageUrl} alt={quizList.title} className={styles.coverImage} />
          )}
          <div className={styles.bannerOverlay}>
            <div className={styles.metaInfo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <Layers size={14} />
                <span>リストパッケージ</span>
              </div>
              <h1 className={styles.title}>{quizList.title}</h1>
              <p className={styles.description}>{quizList.description}</p>
            </div>
          </div>
        </div>

        {/* 作成者情報 & アクションバー (要件 3.1, 3.2, 3.3) */}
        <div className={styles.authorRow}>
          <div className={styles.authorMeta}>
            <img 
              src={quizList.authorAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${quizList.authorId}`} 
              alt={quizList.authorName} 
              className={styles.avatar} 
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>作成者</span>
              <span className={styles.authorName}>{quizList.authorName}</span>
            </div>
          </div>

          <div className={styles.actionButtons}>
            {/* 作成者本人の場合の編集ボタン (要件 3.3) */}
            {isCreator && (
              <button 
                className="btn btn-secondary" 
                onClick={() => router.push(`/list/${listId}/edit`)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Edit size={16} />
                リストを編集する
              </button>
            )}
            
            {/* リスト連続プレイ開始ボタン (要件 3.2) */}
            <button 
              className="btn btn-primary" 
              onClick={handleStartSequentialPlay}
              disabled={quizzes.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Play size={16} />
              リストプレイ開始
            </button>
          </div>
        </div>
      </div>

      {/* 収録クイズ一覧 */}
      <div>
        <h2 className={styles.sectionTitle}>
          収録クイズ一覧 ({quizzes.length}個の作品)
        </h2>

        {quizzes.length === 0 ? (
          <div className={styles.emptyState}>
            <Inbox size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p>このリストにはまだクイズが含まれていません。</p>
          </div>
        ) : (
          <div className={styles.quizGrid}>
            {quizzes.map((quiz, idx) => (
              <div key={quiz.id} className={styles.quizCard}>
                <div className={styles.quizCardLeft}>
                  <span className={styles.quizNumber}>#{idx + 1}</span>
                  {quiz.thumbnailUrl && (
                    <img src={quiz.thumbnailUrl} alt={quiz.title} className={styles.quizThumbnail} />
                  )}
                  <div className={styles.quizCardMeta}>
                    <span className={styles.quizCardTitle}>{quiz.title}</span>
                    <div className={styles.quizStats}>
                      <span className={styles.difficultyBadge}>難易度 {quiz.difficulty}</span>
                      <span>問題数: {quiz.questionCount}問</span>
                      <span>プレイ数: {quiz.playCount || 0}回</span>
                    </div>
                  </div>
                </div>

                <button 
                  className={styles.quizPlayBtn}
                  onClick={() => handlePlayQuiz(quiz.id)}
                >
                  <Play size={14} />
                  単体で解く
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
