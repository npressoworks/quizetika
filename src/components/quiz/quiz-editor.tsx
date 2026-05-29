'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { saveQuiz, getQuiz, updateQuiz } from '@/services/quiz';
import { validateQuizForPublish, normalizeTag, QuizPublishValidationError } from '@/services/quiz-validation';
import { Quiz, Question, Choice } from '@/types';
import styles from '@/app/quiz/create/create.module.css';
import { Trash2, Plus, Info, AlertTriangle, Image, ArrowLeft, Save, Send } from 'lucide-react';

interface QuizEditorProps {
  quizId?: string; // 編集モードの場合はIDが渡される
}

// 類似 canonical タグの定義 (要件 1.3 タグ名寄せ用)
const CANONICAL_TAGS = [
  'React',
  'TypeScript',
  'Next.js',
  'JavaScript',
  'CSS',
  'HTML',
  'Firebase',
  'Python',
  'Go',
  'Rust',
  'Vue',
  'Flutter',
  'React Native',
  'Database',
  'Git'
];

export const QuizEditorContent: React.FC<QuizEditorProps> = ({ quizId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [initialFetchLoading, setInitialFetchLoading] = useState(!!quizId);
  const [validationErrors, setValidationErrors] = useState<QuizPublishValidationError[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);

  // フォームステート
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState(5);
  const [genre, setGenre] = useState('programming');
  
  // タグ関連ステート
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [originalTags, setOriginalTags] = useState<string[]>([]);
  const [suggestedTag, setSuggestedTag] = useState<string | null>(null);

  // 設問関連ステート
  const [questions, setQuestions] = useState<Question[]>([]);

  // 編集モードの場合のデータ取得
  useEffect(() => {
    if (!quizId) {
      // 新規作成時はデフォルトで1問追加しておく
      addDefaultQuestion();
      return;
    }

    const fetchQuiz = async () => {
      try {
        const quiz = await getQuiz(quizId);
        if (quiz) {
          setTitle(quiz.title);
          setDescription(quiz.description);
          setThumbnailUrl(quiz.thumbnailUrl);
          setDifficulty(quiz.difficulty);
          setGenre(quiz.genre);
          setTags(quiz.tags);
          setOriginalTags(quiz.originalTags);
          setQuestions(quiz.questions);
        } else {
          setErrorText('対象のクイズが見つかりません。');
        }
      } catch (err: any) {
        setErrorText('クイズの取得に失敗しました。');
      } finally {
        setInitialFetchLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  // 修正指摘からのスクロール連動 (要件 2.4)
  useEffect(() => {
    if (questions.length > 0) {
      const questionIdxParam = searchParams.get('questionIdx');
      if (questionIdxParam !== null) {
        const idx = parseInt(questionIdxParam);
        if (!isNaN(idx) && idx >= 0 && idx < questions.length) {
          // 少し待ってレンダリング後にスクロール
          setTimeout(() => {
            const element = document.getElementById(`question-card-${idx}`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              element.style.borderColor = 'var(--color-accent)';
              element.style.boxShadow = '0 0 15px var(--color-accent-glow)';
            }
          }, 300);
        }
      }
    }
  }, [questions, searchParams]);

  // デフォルト設問の追加
  const addDefaultQuestion = () => {
    const newQuestion: Question = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'multiple-choice',
      questionText: '',
      explanation: '',
      imageUrl: null,
      hint: null,
      limitTime: null,
      choices: [
        { id: '1', choiceText: '選択肢 1', isCorrect: true, selectedCount: 0 },
        { id: '2', choiceText: '選択肢 2', isCorrect: false, selectedCount: 0 },
        { id: '3', choiceText: '選択肢 3', isCorrect: false, selectedCount: 0 },
        { id: '4', choiceText: '選択肢 4', isCorrect: false, selectedCount: 0 },
      ],
      correctCount: 0,
      incorrectCount: 0,
    };
    setQuestions([...questions, newQuestion]);
  };

  // 設問の追加
  const handleAddQuestion = () => {
    addDefaultQuestion();
  };

  // 設問の削除
  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert('最低1問は必要です。');
      return;
    }
    const nextQuestions = questions.filter((_, i) => i !== idx);
    setQuestions(nextQuestions);
  };

  // 設問タイプの切り替え (選択式 / 短答文字入力式 / ウミガメのスープ)
  const handleToggleQuestionType = (idx: number, type: 'multiple-choice' | 'text-input' | 'lateral-thinking') => {
    const nextQuestions = [...questions];
    nextQuestions[idx].type = type;
    
    if (type === 'multiple-choice' && !nextQuestions[idx].choices) {
      nextQuestions[idx].choices = [
        { id: '1', choiceText: '選択肢 1', isCorrect: true, selectedCount: 0 },
        { id: '2', choiceText: '選択肢 2', isCorrect: false, selectedCount: 0 },
        { id: '3', choiceText: '選択肢 3', isCorrect: false, selectedCount: 0 },
        { id: '4', choiceText: '選択肢 4', isCorrect: false, selectedCount: 0 },
      ];
      nextQuestions[idx].correctTextAnswerList = undefined;
      nextQuestions[idx].aiContextDetails = undefined;
    } else if (type === 'text-input' && !nextQuestions[idx].correctTextAnswerList) {
      nextQuestions[idx].correctTextAnswerList = ['正解テキスト'];
      nextQuestions[idx].choices = undefined;
      nextQuestions[idx].aiContextDetails = undefined;
    } else if (type === 'lateral-thinking') {
      nextQuestions[idx].aiContextDetails = '';
      nextQuestions[idx].choices = undefined;
      nextQuestions[idx].correctTextAnswerList = undefined;
    }
    
    setQuestions(nextQuestions);
  };

  // 設問テキストの更新
  const handleQuestionTextChange = (idx: number, text: string) => {
    const nextQuestions = [...questions];
    nextQuestions[idx].questionText = text;
    setQuestions(nextQuestions);
  };

  // 解説テキストの更新
  const handleExplanationChange = (idx: number, text: string) => {
    const nextQuestions = [...questions];
    nextQuestions[idx].explanation = text;
    setQuestions(nextQuestions);
  };

  // 選択肢のテキスト更新
  const handleChoiceTextChange = (qIdx: number, cIdx: number, text: string) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].choices) {
      nextQuestions[qIdx].choices![cIdx].choiceText = text;
      setQuestions(nextQuestions);
    }
  };

  // 選択肢の正解切り替え (ラジオボタン的に動作)
  const handleChoiceCorrectToggle = (qIdx: number, cIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].choices) {
      nextQuestions[qIdx].choices = nextQuestions[qIdx].choices!.map((choice, idx) => ({
        ...choice,
        isCorrect: idx === cIdx,
      }));
      setQuestions(nextQuestions);
    }
  };

  // 短答式正解のテキスト更新
  const handleTextAnswerChange = (qIdx: number, aIdx: number, text: string) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].correctTextAnswerList) {
      nextQuestions[qIdx].correctTextAnswerList![aIdx] = text;
      setQuestions(nextQuestions);
    }
  };

  // 短答式正解の追加
  const handleAddTextAnswer = (qIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].correctTextAnswerList) {
      nextQuestions[qIdx].correctTextAnswerList!.push('');
      setQuestions(nextQuestions);
    }
  };

  // 短答式正解の削除
  const handleRemoveTextAnswer = (qIdx: number, aIdx: number) => {
    const nextQuestions = [...questions];
    if (nextQuestions[qIdx].correctTextAnswerList) {
      if (nextQuestions[qIdx].correctTextAnswerList!.length <= 1) {
        alert('最低1つの正解候補が必要です。');
        return;
      }
      nextQuestions[qIdx].correctTextAnswerList = nextQuestions[qIdx].correctTextAnswerList!.filter((_, i) => i !== aIdx);
      setQuestions(nextQuestions);
    }
  };

  // タグ入力時のリアルタイム正規化・類似サジェスト (要件 1.3)
  const handleTagInputChange = (val: string) => {
    setTagInput(val);
    
    if (!val.trim()) {
      setSuggestedTag(null);
      return;
    }

    const normalized = normalizeTag(val);
    
    // 類似 canonical タグを判定
    const foundSimilar = CANONICAL_TAGS.find(canonical => {
      const canonicalNorm = normalizeTag(canonical);
      // 部分一致、または包含関係にあるかチェック
      return normalized.length >= 2 && 
        (normalized.includes(canonicalNorm) || canonicalNorm.includes(normalized)) &&
        normalized !== canonicalNorm;
    });

    if (foundSimilar) {
      setSuggestedTag(foundSimilar);
    } else {
      setSuggestedTag(null);
    }
  };

  // タグの追加
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = tagInput.trim();
    if (!tag) return;

    if (originalTags.length >= 5) {
      alert('タグは最大5つまで登録できます。');
      return;
    }

    const normalized = normalizeTag(tag);
    if (!normalized) return;

    if (tags.includes(normalized)) {
      alert('すでに同じタグが登録されています。');
      return;
    }

    setTags([...tags, normalized]);
    setOriginalTags([...originalTags, tag]);
    setTagInput('');
    setSuggestedTag(null);
  };

  // サジェストされた canonical タグの適用
  const applySuggestedTag = () => {
    if (!suggestedTag) return;
    
    if (originalTags.length >= 5) {
      alert('タグは最大5つまで登録できます。');
      return;
    }

    const normalized = normalizeTag(suggestedTag);
    if (tags.includes(normalized)) {
      alert('すでに同じタグが登録されています。');
      setTagInput('');
      setSuggestedTag(null);
      return;
    }

    setTags([...tags, normalized]);
    setOriginalTags([...originalTags, suggestedTag]);
    setTagInput('');
    setSuggestedTag(null);
  };

  // タグの削除
  const handleRemoveTag = (idx: number) => {
    setTags(tags.filter((_, i) => i !== idx));
    setOriginalTags(originalTags.filter((_, i) => i !== idx));
  };

  // サムネイル用ダミーアップロード
  const triggerThumbnail = () => {
    const dummyUrl = `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/600/400`;
    setThumbnailUrl(dummyUrl);
  };

  // 保存処理 (status = 'draft' | 'published')
  const handleSave = async (status: 'draft' | 'published') => {
    if (!user) {
      alert('ログインが必要です。');
      return;
    }

    setLoading(true);
    setValidationErrors([]);
    setErrorText(null);

    const quizData = {
      authorId: user.id,
      authorName: user.displayName,
      authorAvatar: user.avatarUrl,
      title,
      description,
      thumbnailUrl,
      difficulty,
      genre,
      tags,
      originalTags,
      questions,
      questionCount: questions.length,
      status,
      playCount: 0,
      bookmarksCount: 0,
      flagsCount: 0,
      positiveCount: 0,
      negativeCount: 0,
      tempPositiveCount: 0,
      tempNegativeCount: 0,
      reviewScore: null,
      reviewBadge: null,
      isReviewMasked: false,
      activeResetRequestId: null,
      canonicalGenreId: '',
      canonicalTagIds: [],
      leaderboard: [],
    };

    // 公開時のみバリデーションチェック
    if (status === 'published') {
      const tempQuiz = { id: quizId || '', ...quizData, createdAt: new Date(), updatedAt: new Date() } as Quiz;
      const errors = validateQuizForPublish(tempQuiz);
      if (errors.length > 0) {
        setValidationErrors(errors);
        setErrorText('公開バリデーションエラーが発生しました。内容を修正してください。');
        setLoading(false);
        // エラーボックスへスクロール
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    } else {
      // 下書きはタイトル必須
      if (!title.trim()) {
        setErrorText('下書き保存するにはタイトルを入力してください。');
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    try {
      if (quizId) {
        // 更新処理 (本来は updateQuiz ですが、saveQuizのインターフェースが統合されているためそれに合わせる、
        // もしくは updateQuiz を呼び出します。今回は saveQuiz に寄せています。)
        // ※ saveQuiz は内部で addDoc を行うため、編集のときは updateQuiz または saveQuiz を呼ぶように調整。
        // ここでは QuizService から updateQuiz / saveQuiz の両方が使えるので、新規と編集で使い分けます。
        await updateQuiz(quizId, {
          title,
          description,
          thumbnailUrl,
          difficulty,
          genre,
          tags,
          originalTags,
          questions,
          questionCount: questions.length,
          status,
        });
      } else {
        await saveQuiz(quizData, status);
      }
      
      alert(status === 'published' ? 'クイズを公開しました！' : '下書きを保存しました！');
      router.push('/creator/dashboard');
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'クイズの保存中にエラーが発生しました。');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || initialFetchLoading) {
    return <div className={styles.container}>読み込み中...</div>;
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.editorCard}>
          <div className={styles.errorTitle}>
            <AlertTriangle size={24} />
            <h2>アクセス権限がありません</h2>
          </div>
          <p>クイズを作成・編集するにはログインしてください。</p>
          <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={() => router.push('/login')}>
            ログイン画面へ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button className={styles.removeQuestionBtn} onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={styles.title}>{quizId ? 'クイズを編集する' : 'クイズを新規作成'}</h1>
      </div>
      <p className={styles.subtitle}>作家ならではのクリエイティブで挑戦者をうならせるクイズを作りましょう。</p>

      {/* エラー表示エリア (要件 1.5) */}
      {(errorText || validationErrors.length > 0) && (
        <div className={styles.errorBox}>
          <div className={styles.errorTitle}>
            <AlertTriangle size={20} />
            <span>保存できませんでした。以下の項目をご確認ください：</span>
          </div>
          {errorText && <p style={{ fontSize: '0.95rem', marginBottom: '10px' }}>{errorText}</p>}
          {validationErrors.length > 0 && (
            <ul className={styles.errorList}>
              {validationErrors.map((err, i) => (
                <li key={i}>{err.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles.grid}>
        {/* メイン編集エリア */}
        <div className={styles.leftColumn}>
          {/* 基本メタデータ入力 (要件 1.1) */}
          <div className={styles.editorCard}>
            <h2 className={styles.sectionTitle}>
              <Info size={20} />
              クイズの基本設定
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className={styles.formGroup}>
                <label className={styles.label}>クイズタイトル <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="例: React Hooksの基礎知識クイズ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>説明文</label>
                <textarea
                  className={styles.textarea}
                  placeholder="クイズの概要や対象読者などを入力してください。"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 設問管理エリア (要件 1.4) */}
          <div className={styles.editorCard}>
            <div className={styles.questionHeader}>
              <h2 className={styles.sectionTitle} style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                設問管理
              </h2>
              <button type="button" className={styles.addQuestionBtn} onClick={handleAddQuestion}>
                <Plus size={16} /> 問題を追加
              </button>
            </div>

            <div className={styles.questionList}>
              {questions.map((q, qIdx) => (
                <div key={q.id || qIdx} id={`question-card-${qIdx}`} className={styles.questionCard}>
                  <div className={styles.questionCardHeader}>
                    <span className={styles.questionNumber}>第 {qIdx + 1} 問</span>
                    <button
                      type="button"
                      className={styles.removeQuestionBtn}
                      onClick={() => handleRemoveQuestion(qIdx)}
                      title="問題を削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {/* 設問タイプ切り替えトグル (要件 1.4) */}
                  <div className={styles.typeToggle}>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${q.type === 'multiple-choice' ? styles.toggleBtnActive : ''}`}
                      onClick={() => handleToggleQuestionType(qIdx, 'multiple-choice')}
                    >
                      選択式 (4択)
                    </button>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${q.type === 'text-input' ? styles.toggleBtnActive : ''}`}
                      onClick={() => handleToggleQuestionType(qIdx, 'text-input')}
                    >
                      短答文字入力式
                    </button>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${q.type === 'lateral-thinking' ? styles.toggleBtnActive : ''}`}
                      onClick={() => handleToggleQuestionType(qIdx, 'lateral-thinking')}
                    >
                      ウミガメのスープ (GM型AI)
                    </button>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>問題文</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="例: Reactにおいて、コンポーネントのステートを管理するためのフックは？"
                      value={q.questionText}
                      onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                      style={{ minHeight: '80px', resize: 'vertical' }}
                    />
                  </div>

                  {/* 選択式の設問入力 */}
                  {q.type === 'multiple-choice' && q.choices && (
                    <div className={styles.choicesList}>
                      <label className={styles.label}>選択肢と正解設定（左のチェックが正解になります）</label>
                      {q.choices.map((choice, cIdx) => (
                        <div key={choice.id || cIdx} className={styles.choiceRow}>
                          <input
                            type="checkbox"
                            className={styles.choiceCheckbox}
                            checked={choice.isCorrect}
                            onChange={() => handleChoiceCorrectToggle(qIdx, cIdx)}
                          />
                          <input
                            type="text"
                            className={styles.input}
                            value={choice.choiceText}
                            onChange={(e) => handleChoiceTextChange(qIdx, cIdx, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 短答入力式の設問入力 */}
                  {q.type === 'text-input' && q.correctTextAnswerList && (
                    <div className={styles.textAnswersContainer}>
                      <label className={styles.label}>正解テキスト候補（大文字・小文字表記揺れなど複数設定可能）</label>
                      {q.correctTextAnswerList.map((ans, aIdx) => (
                        <div key={aIdx} className={styles.textAnswerRow}>
                          <input
                            type="text"
                            className={styles.input}
                            placeholder="例: useState"
                            value={ans}
                            onChange={(e) => handleTextAnswerChange(qIdx, aIdx, e.target.value)}
                          />
                          <button
                            type="button"
                            className={styles.removeQuestionBtn}
                            onClick={() => handleRemoveTextAnswer(qIdx, aIdx)}
                            title="この正解を削除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.addTextAnswerBtn}
                        onClick={() => handleAddTextAnswer(qIdx)}
                      >
                        <Plus size={14} /> 正解候補を追加する
                      </button>
                    </div>
                  )}

                  {/* ウミガメスープ専用の真相（裏設定）入力エリア */}
                  {q.type === 'lateral-thinking' && (
                    <div className={styles.formGroup} style={{ marginTop: '20px' }}>
                      <label className={styles.label}>
                        真相（ゲームマスター用の裏設定・解決情報）
                        <span style={{ color: 'var(--color-danger)' }}> *</span>
                      </label>
                      <textarea
                        className={styles.textarea}
                        placeholder="AIがプレイヤーからの自由な質問に答える基準となる「真相（裏設定）」を、20文字以上2000文字以内で詳しく記述してください。"
                        value={q.aiContextDetails || ''}
                        onChange={(e) => {
                          const nextQuestions = [...questions];
                          nextQuestions[qIdx].aiContextDetails = e.target.value;
                          setQuestions(nextQuestions);
                        }}
                        style={{ minHeight: '120px' }}
                      />
                    </div>
                  )}

                  <div className={styles.formGroup} style={{ marginTop: '20px' }}>
                    <label className={styles.label}>正解後の解説文</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"
                      value={q.explanation}
                      onChange={(e) => handleExplanationChange(qIdx, e.target.value)}
                      style={{ minHeight: '80px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右サイド設定カラム (難易度、ジャンル、タグ、サムネイル等) */}
        <div className={styles.rightColumn}>
          {/* サムネイル設定 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>サムネイル画像</label>
            <div className={styles.thumbnailUpload} onClick={triggerThumbnail}>
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="Thumbnail preview" className={styles.thumbnailPreview} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                  <Image size={32} />
                  <span style={{ fontSize: '0.85rem' }}>クリックしてサムネイルを自動生成</span>
                </div>
              )}
            </div>
          </div>

          {/* 難易度スライダー (要件 1.1) */}
          <div className={styles.formGroup}>
            <label className={styles.label}>難易度 (1 - 10)</label>
            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="1"
                max="10"
                className={styles.slider}
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value))}
              />
              <span className={styles.sliderValue}>{difficulty}</span>
            </div>
          </div>

          {/* ジャンル選択 (要件 1.1, 1.2) */}
          <div className={styles.formGroup}>
            <div className={styles.genreContainer}>
              <label className={styles.label}>ジャンル</label>
              <select className={styles.select} value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="programming">プログラミング / IT</option>
                <option value="history">歴史 / 世界史</option>
                <option value="science">科学 / 自然科学</option>
                <option value="anime">アニメ / エンタメ</option>
                <option value="sports">スポーツ / 運動</option>
                <option value="general">一般常識 / 雑学</option>
              </select>
              {/* ジャンル新設申請画面へのリンク (要件 1.2) */}
              <a href="/moderation/genre-request" className={styles.genreLink}>
                新しいジャンルを申請する
              </a>
            </div>
          </div>

          {/* タグ設定 (要件 1.1, 1.3) */}
          <div className={styles.formGroup}>
            <label className={styles.label}>タグ (最大 5 つ)</label>
            <form onSubmit={handleAddTag} className={styles.tagInputWrapper}>
              <input
                type="text"
                className={styles.input}
                placeholder="タグを入力してEnter"
                value={tagInput}
                onChange={(e) => handleTagInputChange(e.target.value)}
                disabled={originalTags.length >= 5}
              />
            </form>
            
            {/* 類似 canonical タグのサジェスト警告 (要件 1.3) */}
            {suggestedTag && (
              <div className={styles.tagWarning} onClick={applySuggestedTag} style={{ cursor: 'pointer' }}>
                <AlertTriangle size={16} />
                <div>
                  <span style={{ fontWeight: 'bold' }}>推奨:</span> 類似するタグ <span style={{ textDecoration: 'underline' }}>#{suggestedTag}</span> が既に存在します。既存のタグを使用することをお勧めします。（クリックで適用）
                </div>
              </div>
            )}

            <div className={styles.tagList}>
              {originalTags.map((tag, idx) => (
                <div key={idx} className={styles.tagBadge}>
                  #{tag}
                  <button type="button" className={styles.removeTagBtn} onClick={() => handleRemoveTag(idx)}>
                    &times;
                  </button>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <span className={styles.tagLimitInfo}>{originalTags.length} / 5 タグ</span>
            </div>
          </div>
        </div>
      </div>

      {/* アクションバー (要件 1.6 下書き保存, 公開) */}
      <div className={styles.actionsBar}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleSave('draft')}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Save size={18} />
          下書き保存
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleSave('published')}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Send size={18} />
          公開申請する
        </button>
      </div>
    </div>
  );
};

export const QuizEditor: React.FC<QuizEditorProps> = (props) => {
  return (
    <Suspense fallback={<div>エディタを読み込み中...</div>}>
      <QuizEditorContent {...props} />
    </Suspense>
  );
};
