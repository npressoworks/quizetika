'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, Play, Award, Timer, Layers, HelpCircle, Edit } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { getDifficultyColor } from '@/lib/difficulty-color';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { Quiz } from '@/types';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { resolveQuizFormat } from '@/lib/quiz-format';
import { getFormatLabel, getFormatIcon } from '@/lib/quiz-format-labels';
import styles from './page.module.css';

interface QuizDetailClientProps {
  quiz: Quiz;
}

export function QuizDetailClient({ quiz }: QuizDetailClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { genres: activeGenres } = useActiveGenres();

  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<'normal' | 'exam' | 'flashcard'>('normal');
  const [showInstantFeedback, setShowInstantFeedback] = useState<boolean>(true);
  const [bookmarkLoading, setBookmarkLoading] = useState<boolean>(false);

  // クイックプレイでのブックマーク状態の初期取得
  useEffect(() => {
    async function checkBookmark() {
      if (user) {
        try {
          const status = await isBookmarked(user.id, quiz.id);
          setBookmarked(status);
        } catch (e) {
          console.error('[QuizDetailClient] ブックマーク状態取得失敗:', e);
        }
      }
    }
    checkBookmark();
  }, [quiz.id, user]);

  const handleBookmarkToggle = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (bookmarkLoading) return;

    setBookmarkLoading(true);
    try {
      const nextStatus = await toggleBookmark(user.id, quiz.id, 'quiz');
      setBookmarked(nextStatus);
    } catch (e) {
      console.error('[QuizDetailClient] ブックマークエラー:', e);
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handlePlayStart = () => {
    // ウミガメスープ問題（lateral-thinking）が含まれているかを判定
    const isLateral = quiz.questions?.some((q) => q.type === 'lateral-thinking') ?? false;
    // 早押し問題が含まれているかを判定
    const isQuick = quiz.format === 'quick-press' || (quiz.questions?.some((q) => q.type === 'quick-press') ?? false);

    if (isLateral) {
      if (!user) {
        router.push(`/login?redirect=/quiz/${quiz.id}/play?mode=lateral`);
        return;
      }
      router.push(`/quiz/${quiz.id}/play?mode=lateral`);
    } else if (isQuick) {
      router.push(`/quiz/${quiz.id}/play?mode=normal&feedback=${showInstantFeedback}`);
    } else {
      router.push(`/quiz/${quiz.id}/play?mode=${selectedMode}`);
    }
  };

  const genreMeta = activeGenres.find((g) => g.id === quiz.genre);

  const diffVal = typeof quiz.difficulty === 'number' ? quiz.difficulty : parseInt(quiz.difficulty as any || '0', 10);
  const diffNum = isNaN(diffVal) ? 0 : diffVal;

  const isLateralThinkingQuiz = quiz.questions?.some((q) => q.type === 'lateral-thinking') ?? false;
  const isQuickPressQuiz = quiz.format === 'quick-press' || (quiz.questions?.some((q) => q.type === 'quick-press') ?? false);

  return (
    <>
      {/* メイン詳細カード */}
      <div className={styles.detailCard}>
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <span className={styles.genre}>
              {genreMeta?.iconImageUrl ? (
                <img
                  src={genreMeta.iconImageUrl}
                  alt=""
                  className={styles.genreIconMini}
                />
              ) : (
                <span className={styles.genreIconMiniFallback}>📚</span>
              )}
              {genreMeta ? genreMeta.displayName : quiz.genre}
            </span>
            <h1 className={styles.title}>{quiz.title}</h1>
          </div>
          <button
            className={`${styles.bookmarkBtn} ${bookmarked ? styles.bookmarked : ''}`}
            onClick={handleBookmarkToggle}
            disabled={bookmarkLoading}
            title="ブックマーク"
            data-analytics="quiz-bookmark-toggle"
          >
            <Bookmark
              size={20}
              color={bookmarked ? '#00ff66' : 'var(--text-muted)'}
              fill={bookmarked ? '#00ff66' : 'none'}
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
          <div className={styles.difficultyBadge} style={{ fontFamily: 'monospace' }}>
            難易度: <span style={{ color: getDifficultyColor(diffNum) }}>{'★'.repeat(diffNum)}</span><span style={{ color: 'var(--text-muted)' }}>{'☆'.repeat(Math.max(0, 5 - diffNum))}</span>
          </div>
          <div className={styles.difficultyBadge}>
            形式: {getFormatIcon(resolveQuizFormat({ format: quiz.format, questions: quiz.questions ?? [] }))} {getFormatLabel(resolveQuizFormat({ format: quiz.format, questions: quiz.questions ?? [] }))}
          </div>
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
        ) : isQuickPressQuiz ? (
          <div className={`${styles.modeOption} ${styles.modeSelected}`} style={{ cursor: 'default' }}>
            <div className={styles.modeHeader}>
              <Timer size={18} className="text-neon-accent" />
              <span>早押し通常プレイ</span>
            </div>
            <p className={styles.modeDesc} style={{ marginBottom: '12px' }}>
              1文字ずつ表示される早押し問題に対応した専用プレイモードです。
              問題が読めた瞬間にボタンを押し、回答を記述しましょう！
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-light)',
              marginTop: '12px'
            }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                解答後にその場で正誤・解説を表示
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showInstantFeedback}
                  onChange={(e) => setShowInstantFeedback(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-primary)',
                    cursor: 'pointer'
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
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
                個別の時間制限はなく、全体制限時間内で自由に問題を往復して見直しができる本番形式モードです。
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

        <button className={`btn btn-primary ${styles.playBtn}`} onClick={handlePlayStart} style={{ width: '100%', marginTop: '10px' }} data-analytics="quiz-play-start-detail">
          {isLateralThinkingQuiz ? 'チャットを開始する' : isQuickPressQuiz ? '早押しを開始する' : 'プレイを開始する'}
        </button>
      </div>
    </>
  );
}
