'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BookmarkOutlined, BookmarkRounded, PlayArrowOutlined, EmojiEventsOutlined, TimerOutlined, LayersOutlined, HelpOutlineOutlined, EditOutlined, WarningAmberOutlined, CheckCircleOutlined } from '@mui/icons-material';
import { useAuth } from '@/context/auth-context';
import { getDifficultyColor } from '@/lib/difficulty-color';
import { toggleBookmark, isBookmarked } from '@/services/bookmark';
import { Quiz } from '@/types';
import { useActiveGenres } from '@/hooks/useActiveGenres';
import { usePlayedQuizIds } from '@/hooks/usePlayedQuizIds';
import { resolveQuizFormat } from '@/lib/quiz-format';
import { formatReviewScorePercent } from '@/services/review-utils';
import { FormatLabel } from '@/components/quiz/format-label';
import { detailClasses as styles } from './detail-classes';

import { getQuiz } from '@/services/quiz';

interface QuizDetailClientProps {
  quizId: string;
}

export function QuizDetailClient({ quizId }: QuizDetailClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { genres: activeGenres } = useActiveGenres();
  const { playedQuizIds, loading: playedStatusLoading } = usePlayedQuizIds(user?.id);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizLoading, setQuizLoading] = useState<boolean>(true);
  const [bookmarked, setBookmarked] = useState<boolean>(false);
  const [selectedMode, setSelectedMode] = useState<'normal' | 'exam' | 'flashcard'>('normal');
  const [bookmarkLoading, setBookmarkLoading] = useState<boolean>(false);

  // クライアントサイドでクイズをロード
  useEffect(() => {
    async function loadQuiz() {
      try {
        const data = await getQuiz(quizId);
        setQuiz(data);
      } catch (e) {
        console.error('[QuizDetailClient] ロード失敗:', e);
      } finally {
        setQuizLoading(false);
      }
    }
    loadQuiz();
  }, [quizId]);

  // クイックプレイでのブックマーク状態の初期取得
  useEffect(() => {
    async function checkBookmark() {
      if (user && quiz) {
        try {
          const status = await isBookmarked(user.id, quiz.id);
          setBookmarked(status);
        } catch (e) {
          console.error('[QuizDetailClient] ブックマーク状態取得失敗:', e);
        }
      }
    }
    checkBookmark();
  }, [quiz?.id, user]);

  const handleBookmarkToggle = async () => {
    if (!quiz) return;
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

  if (quizLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0', width: '100%' }}>
        <p style={{ color: 'var(--text-muted)' }}>読み込み中...</p>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', width: '100%' }}>
        <h2 style={{ color: 'var(--text-main)', marginBottom: '16px' }}>クイズが見つかりませんでした</h2>
        <p style={{ color: 'var(--text-muted)' }}>指定されたクイズは削除されたか、公開されていません。</p>
      </div>
    );
  }

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
      router.push(`/quiz/${quiz.id}/play?mode=normal`);
    } else {
      router.push(`/quiz/${quiz.id}/play?mode=${selectedMode}`);
    }
  };

  const genreMeta = activeGenres.find((g) => g.id === quiz.genre);

  const diffVal = typeof quiz.difficulty === 'number' ? quiz.difficulty : parseInt(quiz.difficulty as any || '0', 10);
  const diffNum = isNaN(diffVal) ? 0 : diffVal;

  const isLateralThinkingQuiz = quiz.questions?.some((q) => q.type === 'lateral-thinking') ?? false;
  const isQuickPressQuiz = quiz.format === 'quick-press' || (quiz.questions?.some((q) => q.type === 'quick-press') ?? false);
  const hasPlayedThisQuiz = Boolean(user && playedQuizIds?.has(quiz.id));
  const showPlayStatus = Boolean(user && !playedStatusLoading && playedQuizIds !== null);
  const showLeaderboardWarning =
    !isLateralThinkingQuiz && !isQuickPressQuiz && !hasPlayedThisQuiz;
  const formatValue = resolveQuizFormat({ format: quiz.format, questions: quiz.questions ?? [] });

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
            {bookmarked
              ? <BookmarkRounded sx={{ fontSize: 20, color: '#00ff66' }} className="fill-current" />
              : <BookmarkOutlined sx={{ fontSize: 20 }} />}
          </button>
        </div>

        {/* バッジ・メタ情報 */}
        <div className={styles.badgesSection}>
          {quiz.reviewBadge && (
            quiz.isReviewMasked ? (
              <div className={styles.badgeMasked}>⏳ 評価再集計中...</div>
            ) : (
              <div className={styles.badgeGlow}>
                <EmojiEventsOutlined sx={{ fontSize: 16 }} />
                🏅 {quiz.reviewBadge} (良問率: {formatReviewScorePercent(quiz.reviewScore) ?? '0%'})
              </div>
            )
          )}
          <div className={styles.difficultyBadge} style={{ fontFamily: 'monospace' }}>
            難易度: <span style={{ color: getDifficultyColor(diffNum) }}>{'★'.repeat(diffNum)}</span><span style={{ color: 'var(--text-muted)' }}>{'☆'.repeat(Math.max(0, 5 - diffNum))}</span>
          </div>
          <div className={styles.difficultyBadge}>
            形式: <FormatLabel format={formatValue} testId="quiz-detail-format" />
          </div>
          <div className={styles.difficultyBadge}>問題数: {quiz.questionCount}問</div>
          {showPlayStatus && (
            <div
              className={`${styles.playStatusBadge} ${hasPlayedThisQuiz ? styles.playStatusPlayed : styles.playStatusUnplayed}`}
              data-testid="quiz-detail-play-status"
            >
              {hasPlayedThisQuiz ? (
                <>
                  <CheckCircleOutlined sx={{ fontSize: 14 }} aria-hidden />
                  プレイ済み
                </>
              ) : (
                '未プレイ'
              )}
            </div>
          )}
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
              <EditOutlined sx={{ fontSize: 16 }} />
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
              <HelpOutlineOutlined sx={{ fontSize: 18 }} className="text-neon-accent" />
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
              <TimerOutlined sx={{ fontSize: 18 }} className="text-neon-accent" />
              <span>早押し通常プレイ</span>
            </div>
            <p className={styles.modeDesc}>
              1文字ずつ表示される早押し問題に対応した専用プレイモードです。
              問題が読めた瞬間にボタンを押し、回答を記述しましょう！
            </p>
          </div>
        ) : (
          <>
            <div
              className={`${styles.modeOption} ${selectedMode === 'normal' ? styles.modeSelected : ''}`}
              onClick={() => setSelectedMode('normal')}
            >
              <div className={styles.modeHeader}>
                <PlayArrowOutlined sx={{ fontSize: 16 }} />
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
                <TimerOutlined sx={{ fontSize: 16 }} />
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
                <LayersOutlined sx={{ fontSize: 16 }} />
                <span>フラッシュカードモード</span>
              </div>
              <p className={styles.modeDesc}>
                正解を確認しながら、暗記カード感覚でサクサク学習できる復習・学習特化モードです。
              </p>
            </div>
          </>
        )}

        <button className={`btn btn-primary ${styles.playBtn}`} onClick={handlePlayStart} style={{ width: '100%', marginTop: '10px' }} data-analytics="quiz-play-start-detail">
          {isLateralThinkingQuiz
            ? user
              ? 'チャットを開始する'
              : '会員登録してプレイする'
            : isQuickPressQuiz
              ? '早押しを開始する'
              : 'プレイを開始する'}
        </button>

        {showLeaderboardWarning && (
          <div
            className={styles.modeLeaderboardWarning}
            data-testid="play-mode-leaderboard-warning"
          >
            <WarningAmberOutlined sx={{ fontSize: 16 }} aria-hidden />
            <p>
              模擬試験モード・フラッシュカードモードの記録は、初回プレイランキングおよびリプレイランキングのいずれにも掲載されません。先にこれらのモードでプレイした場合、のちに通常モードでプレイしても初回プレイランキングには掲載されません（リプレイランキングのみ対象となります）。
            </p>
          </div>
        )}
      </div>
    </>
  );
}
