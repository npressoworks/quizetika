'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Star, Play, Award, Trophy, Timer, Layers, HelpCircle, Edit } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getQuiz } from '@/services/quiz';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { Quiz } from '@/types';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QuizDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  // React 19 / Next.js 15 の params 解消
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<'normal' | 'exam' | 'flashcard'>('normal');
  const [bookmarkLoading, setBookmarkLoading] = useState<boolean>(false);

  // クイズデータの読み込み
  useEffect(() => {
    async function loadQuiz() {
      try {
        const data = await getQuiz(quizId);
        setQuiz(data);
        if (user && data) {
          const status = await isBookmarked(user.id, data.id);
          setBookmarked(status);
        }
      } catch (e) {
        console.error('[QuizDetail] データ読み込み失敗:', e);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [quizId, user]);

  // ブックマークトグル
  const handleBookmarkToggle = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (bookmarkLoading || !quiz) return;

    setBookmarkLoading(true);
    try {
      const nextStatus = await toggleBookmark(user.id, quiz.id, 'quiz');
      setBookmarked(nextStatus);
    } catch (e) {
      console.error('[QuizDetail] ブックマークエラー:', e);
    } finally {
      setBookmarkLoading(false);
    }
  };

  // プレイ画面へ遷移
  const handlePlayStart = () => {
    if (!quiz) return;
    
    // ウミガメスープ問題（lateral-thinking）が含まれているかを判定
    const isLateral = quiz.questions.some((q) => q.type === 'lateral-thinking');
    
    if (isLateral) {
      // ウミガメスープ問題は専用のプレイ遷移（モードは lateral となる）
      // ゲストプレイアクセス制限：未ログインならログイン画面へリダイレクト
      if (!user) {
        router.push(`/login?redirect=/quiz/${quiz.id}/play?mode=lateral`);
        return;
      }
      router.push(`/quiz/${quiz.id}/play?mode=lateral`);
    } else {
      router.push(`/quiz/${quiz.id}/play?mode=${selectedMode}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ textAlign: 'center', padding: '100px 0' }}>
        <p style={{ color: 'var(--text-muted)' }}>クイズ詳細をロード中...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className={styles.container}>
        <Link href="/" className={styles.backBtn}>
          <ArrowLeft size={16} />
          ホームへ戻る
        </Link>
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <h2 style={{ color: 'var(--text-main)', marginBottom: '16px' }}>クイズが見つかりませんでした</h2>
          <p style={{ color: 'var(--text-muted)' }}>指定されたクイズは削除されたか、公開されていません。</p>
        </div>
      </div>
    );
  }

  // ウミガメスープ判定
  const isLateralThinkingQuiz = quiz.questions.some((q) => q.type === 'lateral-thinking');

  // リーダーボードを完了タイム（秒数）の昇順でソート（上位10名）
  const sortedLeaderboard = quiz.leaderboard
    ? [...quiz.leaderboard].sort((a, b) => a.elapsedSeconds - b.elapsedSeconds).slice(0, 10)
    : [];

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backBtn}>
        <ArrowLeft size={16} />
        探索に戻る
      </Link>

      <div className={styles.layout}>
        {/* メイン詳細カード */}
        <div className={styles.detailCard}>
          <div className={styles.header}>
            <div className={styles.titleArea}>
              <span className={styles.genre}>{quiz.genre}</span>
              <h1 className={styles.title}>{quiz.title}</h1>
            </div>
            <button
              className={`${styles.bookmarkBtn} ${bookmarked ? styles.bookmarked : ''}`}
              onClick={handleBookmarkToggle}
              disabled={bookmarkLoading}
              title="ブックマーク"
            >
              <Star 
                size={20} 
                color={bookmarked ? '#ff007f' : 'var(--text-muted)'}
                fill={bookmarked ? '#ff007f' : 'none'} 
              />
            </button>
          </div>

          {/* バッジ・メタ情報 */}
          <div className={styles.badgesSection}>
            {quiz.reviewBadge && (
              quiz.isReviewMasked ? (
                <div className={styles.badgeMasked}>⏳ 評価再集計中...</div>
              ) : (
                <div className={styles.badgeGlow}>
                  <Award size={16} />
                  🏅 {quiz.reviewBadge} (良問率: {Math.round((quiz.reviewScore ?? 0) * 100)}%)
                </div>
              )
            )}
            <div className={styles.difficultyBadge}>難易度: {quiz.difficulty} / 10</div>
            <div className={styles.difficultyBadge}>問題数: {quiz.questionCount}問</div>
          </div>

          {/* サムネイル */}
          <div className={styles.thumbnailWrapper}>
            {quiz.thumbnailUrl ? (
              <Image
                src={quiz.thumbnailUrl}
                alt={quiz.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 600px"
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '4rem',
                  background: 'linear-gradient(135deg, #1d1b26, #2d2640)',
                  opacity: 0.4
                }}
              >
                💡
              </div>
            )}
          </div>

          {/* 作者情報 */}
          <div className={styles.authorSection} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <Link href={`/profile/${quiz.authorId}`} className={styles.authorLink}>
              <img 
                src={quiz.authorAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${quiz.authorId}`} 
                alt={quiz.authorName} 
                className={styles.authorAvatar} 
              />
              <div className={styles.authorInfo}>
                <span className={styles.authorLabel}>作成者</span>
                <span className={styles.authorName}>{quiz.authorName}</span>
              </div>
            </Link>
            {user && quiz.authorId === user.id && (
              <Link 
                href={`/quiz/${quiz.id}/edit`} 
                className="btn btn-secondary" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-light)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  transition: 'var(--transition-smooth)',
                  cursor: 'pointer'
                }}
              >
                <Edit size={16} />
                クイズを編集
              </Link>
            )}
          </div>

          {/* 説明 */}
          <div className={styles.description}>
            <p>{quiz.description}</p>
          </div>

          {/* タグ */}
          {quiz.tags && quiz.tags.length > 0 && (
            <div className={styles.tags}>
              {quiz.tags.map((tag, idx) => (
                <Link key={idx} href={`/tags/${encodeURIComponent(tag)}`} className={styles.tag}>
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* サイドバー: プレイパネル */}
        <div className={styles.playPanel}>
          <h2 className={styles.playPanelTitle}>プレイモード選択</h2>

          {isLateralThinkingQuiz ? (
            /* ウミガメスープ問題の場合はモード選択を固定して専用案内 */
            <div className={`${styles.modeOption} ${styles.modeSelected}`}>
              <div className={styles.modeHeader}>
                <HelpCircle size={18} className="text-neon-accent" />
                <span>水平思考チャットモード</span>
              </div>
              <p className={styles.modeDesc}>
                ウミガメのスープ問題専用のAIチャット対話モードです。
                「はい」「いいえ」で答えられる質問をAIに投げ、真相を解き明かしましょう！
              </p>
            </div>
          ) : (
            /* 通常クイズの場合は3つのモードをトグル */
            <>
              <div
                className={`${styles.modeOption} ${selectedMode === 'normal' ? styles.modeSelected : ''}`}
                onClick={() => setSelectedMode('normal')}
              >
                <div className={styles.modeHeader}>
                  <Play size={16} />
                  <span>通常モード</span>
                </div>
                <p className={styles.modeDesc}>
                  1問ずつ解答し、タイマー制限とヒントを活用しながらクリアを目指す標準モードです。
                </p>
              </div>

              <div
                className={`${styles.modeOption} ${selectedMode === 'exam' ? styles.modeSelected : ''}`}
                onClick={() => setSelectedMode('exam')}
              >
                <div className={styles.modeHeader}>
                  <Timer size={16} />
                  <span>模擬試験モード</span>
                </div>
                <p className={styles.modeDesc}>
                  個別の時間制限はなく、全体制限時間内で自由に設問を往復して見直しができる本番形式モードです。
                </p>
              </div>

              <div
                className={`${styles.modeOption} ${selectedMode === 'flashcard' ? styles.modeSelected : ''}`}
                onClick={() => setSelectedMode('flashcard')}
              >
                <div className={styles.modeHeader}>
                  <Layers size={16} />
                  <span>フラッシュカードモード</span>
                </div>
                <p className={styles.modeDesc}>
                  正解を確認しながら、暗記カード感覚でサクサク学習できる復習・学習特化モードです。
                </p>
              </div>
            </>
          )}

          <button className="btn btn-primary styles.playBtn" onClick={handlePlayStart} style={{ width: '100%', marginTop: '10px' }}>
            {isLateralThinkingQuiz ? 'チャットを開始する' : 'プレイを開始する'}
          </button>
        </div>
      </div>

      {/* リーダーボード */}
      <section className={styles.leaderboardSection}>
        <div className={styles.leaderboardTitle}>
          <Trophy size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          パーフェクト達成者リーダーボード (上位10名)
        </div>

        {sortedLeaderboard.length === 0 ? (
          <div className={styles.emptyLeaderboard}>
            まだパーフェクト達成者がいません。最初の達成者になりましょう！
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>順位</th>
                  <th className={styles.th}>ユーザー名</th>
                  <th className={styles.th}>クリアタイム</th>
                  <th className={styles.th}>達成日</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.map((record, index) => {
                  const rankClass =
                    index === 0
                      ? styles.rank1
                      : index === 1
                      ? styles.rank2
                      : index === 2
                      ? styles.rank3
                      : '';
                  return (
                    <tr key={index}>
                      <td className={`${styles.td} ${rankClass}`}>#{index + 1}</td>
                      <td className={styles.td}>{record.displayName || '名無しさん'}</td>
                      <td className={styles.td}>{record.elapsedSeconds} 秒</td>
                      <td className={styles.td}>
                        {new Date(record.completedAt).toLocaleDateString('ja-JP')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
