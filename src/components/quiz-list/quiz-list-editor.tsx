'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { getQuizzesByAuthor } from '@/services/quiz';
import {
  createQuizList,
  getQuizList,
  updateQuizList,
  getQuizzesInList,
  exportQuizList,
  exportQuestionList,
  getQuestionsInList,
  type QuestionInListEntry,
} from '@/services/quiz-list';
import { QuizList, Quiz, QuizListType, resolveListType } from '@/types';
import { ListTypeSelector } from '@/components/quiz-list/list-type-selector';
import { QuestionListAttachPanel } from '@/components/quiz-list/question-list-attach-panel';
import { ListEditorSkeleton } from '@/components/quiz-list/list-skeleton';
import styles from '@/app/list/create/edit.module.css';
import {
  Save,
  Download,
  Plus,
  Trash2,
  Search,
  GripVertical,
  Image,
  ArrowLeft,
  Layers,
  Info
} from 'lucide-react';

interface QuizListEditorProps {
  listId?: string;
  initialList?: QuizList | null;
}

export const QuizListEditor: React.FC<QuizListEditorProps> = ({ listId, initialList }) => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(false);
  const [initialFetchLoading, setInitialFetchLoading] = useState(!!listId);
  const [errorText, setErrorText] = useState<string | null>(null);

  // フォームステート
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(true);
  const [listType, setListType] = useState<QuizListType>('quiz');
  const [attachedQuizzes, setAttachedQuizzes] = useState<Quiz[]>([]);
  const [attachedQuestions, setAttachedQuestions] = useState<QuestionInListEntry[]>([]);

  // クイズ検索関連ステート
  const [searchQuery, setSearchQuery] = useState('');
  const [allMyQuizzes, setAllMyQuizzes] = useState<Quiz[]>([]);
  const [searchResults, setSearchResults] = useState<Quiz[]>([]);

  // ドラッグ＆ドロップ用の一時ステート
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // 編集モード時の初期データ取得、および自作クイズ一覧の取得
  useEffect(() => {
    if (authLoading || !user) return;

    const fetchMyQuizzes = async () => {
      try {
        const myQuizzes = await getQuizzesByAuthor(user.id, true);
        setAllMyQuizzes(myQuizzes);
        setSearchResults(myQuizzes); // 初期状態は全クイズを表示
      } catch (err) {
        console.error(err);
      }
    };

    const fetchList = async () => {
      if (!listId) return;
      try {
        const listData = initialList ?? (await getQuizList(listId));
        if (listData) {
          setTitle(listData.title);
          setDescription(listData.description);
          setCoverImageUrl(listData.coverImageUrl || null);
          setIsPublished(listData.isPublished);
          const resolved = resolveListType(listData);
          setListType(resolved);

          if (resolved === 'question') {
            const questionEntries = await getQuestionsInList(listId);
            setAttachedQuestions(questionEntries);
          } else {
            const embeddedQuizzes = await getQuizzesInList(listId);
            setAttachedQuizzes(embeddedQuizzes);
          }
        } else {
          setErrorText('リストが見つかりません。');
        }
      } catch (err) {
        setErrorText('データ取得に失敗しました。');
      } finally {
        setInitialFetchLoading(false);
      }
    };

    fetchMyQuizzes();
    fetchList();
  }, [listId, user, authLoading, initialList]);

  // 検索フィルタ
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(allMyQuizzes);
      return;
    }
    const filtered = allMyQuizzes.filter((q) =>
      q.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setSearchResults(filtered);
  };

  // クイズのアタッチ
  const handleAttachQuiz = (quiz: Quiz) => {
    if (attachedQuizzes.some((q) => q.id === quiz.id)) {
      alert('すでにこのクイズはリストに登録されています。');
      return;
    }
    setAttachedQuizzes([...attachedQuizzes, quiz]);
  };

  // クイズのデタッチ
  const handleDetachQuiz = (quizId: string) => {
    setAttachedQuizzes(attachedQuizzes.filter((q) => q.id !== quizId));
  };

  // HTML5 Drag and Drop 並び替えロジック (要件 4.2)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const nextAttached = [...attachedQuizzes];
    const [draggedItem] = nextAttached.splice(draggedIndex, 1);
    nextAttached.splice(targetIndex, 0, draggedItem);

    setAttachedQuizzes(nextAttached);
    setDraggedIndex(null);
  };

  // カバー画像自動生成
  const triggerCoverImage = () => {
    const dummyUrl = `https://picsum.photos/seed/${Math.random().toString(36).substring(7)}/800/250`;
    setCoverImageUrl(dummyUrl);
  };

  // リストの保存
  const handleSave = async () => {
    if (!user) {
      alert('ログインが必要です。');
      return;
    }

    if (!title.trim()) {
      setErrorText('タイトルを入力してください。');
      return;
    }

    setLoading(true);
    setErrorText(null);

    const isQuestionList = listType === 'question';
    const listData = {
      authorId: user.id,
      authorName: user.displayName,
      authorAvatar: user.avatarUrl,
      title,
      description,
      coverImageUrl: coverImageUrl || undefined,
      listType,
      quizIds: isQuestionList ? [] : attachedQuizzes.map((q) => q.id),
      questionIds: isQuestionList
        ? attachedQuestions.map((e) => e.question.id)
        : [],
      isPublished,
    };

    try {
      if (listId) {
        await updateQuizList(listId, listData);
        alert('リストを更新しました！');
        router.push(`/list/${listId}`);
      } else {
        const newListId = await createQuizList(listData);
        alert('リストを作成しました！');
        if (isQuestionList) {
          router.push(`/list/${newListId}/edit`);
        } else {
          router.push(`/list/${newListId}`);
        }
      }
    } catch (err: any) {
      setErrorText(err.message || '保存に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // パッケージエクスポート (要件 4.3)
  const handleExportList = async () => {
    if (!user) return;

    try {
      let exportData;
      if (listType === 'question') {
        if (!listId) {
          alert('問題リストは保存後にエクスポートできます。');
          return;
        }
        exportData = await exportQuestionList(listId, user.id);
      } else if (listId) {
        exportData = await exportQuizList(listId, user.id);
      } else {
        // 新規作成時はクライアント上のデータで動的にパッケージ構築
        const ownedQuizzes = attachedQuizzes.filter((q) => q.authorId === user.id);
        const externalQuizIds = attachedQuizzes
          .filter((q) => q.authorId !== user.id)
          .map((q) => q.id);

        exportData = {
          exportedAt: new Date().toISOString(),
          listMetadata: {
            title,
            description,
            coverImageUrl,
            isPublished,
          },
          ownedQuizzes,
          externalQuizIds,
        };
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      )}`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `quizeum_list_export_${title || 'untitled'}_${new Date().toISOString().split('T')[0]}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('パッケージエクスポートに失敗しました。');
    }
  };

  if (authLoading || initialFetchLoading) {
    return <ListEditorSkeleton data-testid="list-editor-skeleton" />;
  }

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button className={styles.detachBtn} onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className={styles.title}>{listId ? 'リストを編集' : '新しいリストを作成'}</h1>
      </div>
      <p className={styles.subtitle}>お気に入りのクイズや自作クイズをパッケージして、テーマに沿ったリストを作りましょう。</p>

      {errorText && (
        <div style={{ background: 'rgba(255, 0, 84, 0.1)', border: '1px solid rgba(255, 0, 84, 0.3)', color: '#ff3366', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          {errorText}
        </div>
      )}

      <div className={styles.grid}>
        {/* 左カラム: リスト情報フォーム */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <Layers size={20} />
            <span>リストの基本設定</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>リストタイトル <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input
              type="text"
              className={styles.input}
              placeholder="例: JavaScript中級者向けリスト"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>説明文</label>
            <textarea
              className={styles.textarea}
              placeholder="このリストの内容や特徴、どのようなクイズを集めているかなどを説明してください。"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>カバー画像</label>
            <div className={styles.coverUpload} onClick={triggerCoverImage}>
              {coverImageUrl ? (
                <img src={coverImageUrl} alt="Cover preview" className={styles.coverPreview} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                  <Image size={24} />
                  <span style={{ fontSize: '0.8rem' }}>クリックしてカバー画像を自動生成</span>
                </div>
              )}
            </div>
          </div>

          <div className={styles.toggleRow}>
            <div>
              <span style={{ fontWeight: 600, display: 'block', fontSize: '0.9rem' }}>一般公開する</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ONにすると全プレイヤーに公開されます。</span>
            </div>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              <span className={styles.slider}></span>
            </label>
          </div>

          <div className={styles.formGroup} style={{ marginTop: 24 }}>
            <label className={styles.label}>リスト種別</label>
            <ListTypeSelector
              value={listType}
              onChange={setListType}
              disabled={!!listId}
            />
          </div>

          {listType === 'question' ? (
            <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
              <span className={styles.label} style={{ marginBottom: '12px', display: 'block' }}>
                問題をアタッチする
              </span>
              <QuestionListAttachPanel
                listId={listId ?? ''}
                authorId={user?.id ?? ''}
                attached={attachedQuestions}
                onAttachedChange={setAttachedQuestions}
                disabled={!listId}
              />
            </div>
          ) : (
            /* クイズ検索・アタッチパネル (要件 4.1) */
            <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-light)' }}>
              <span className={styles.label} style={{ marginBottom: '12px', display: 'block' }}>クイズをアタッチする</span>
              <form onSubmit={handleSearch} className={styles.searchBar}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="自作クイズをタイトル検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '10px 14px', fontSize: '0.9rem' }}
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: '10px' }}>
                  <Search size={16} />
                </button>
              </form>

              <div className={styles.searchList}>
                {searchResults.length === 0 ? (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '20px' }}>
                    該当するクイズが見つかりません。
                  </span>
                ) : (
                  searchResults.map((quiz) => (
                    <div key={quiz.id} className={styles.searchItem}>
                      <div className={styles.searchItemInfo}>
                        <span className={styles.searchItemTitle}>{quiz.title}</span>
                        <span className={styles.searchItemMeta}>問題数: {quiz.questionCount}問 / 難易度: {quiz.difficulty}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.attachBtn}
                        onClick={() => handleAttachQuiz(quiz)}
                      >
                        追加
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {listType === 'quiz' && (
          <div className={styles.card} style={{ minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
            <div className={styles.cardTitle}>
              <GripVertical size={20} />
              <span>収録クイズの順序並べ替え (ドラッグして移動)</span>
            </div>

            <div className={styles.attachedList}>
              {attachedQuizzes.length === 0 ? (
                <div className={styles.emptyListState}>
                  <Layers size={32} style={{ opacity: 0.3 }} />
                  <span>収録クイズがありません。左のパネルからクイズを追加してください。</span>
                </div>
              ) : (
                attachedQuizzes.map((quiz, idx) => (
                  <div
                    key={quiz.id}
                    className={`${styles.attachedItem} ${draggedIndex === idx ? styles.attachedItemDragging : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                  >
                    <div className={styles.attachedItemLeft}>
                      <div className={styles.dragHandle}>
                        <GripVertical size={16} />
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '0.9rem' }}>#{idx + 1}</span>
                      <span className={styles.attachedItemTitle}>{quiz.title}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.detachBtn}
                      onClick={() => handleDetachQuiz(quiz.id)}
                      title="リストから除外"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '16px', background: 'rgba(255, 255, 255, 0.01)', padding: '10px', borderRadius: '4px' }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>カードをドラッグして放すことで、リスト内の並び順をいつでもスムーズに入れ替えられます。</span>
            </div>
          </div>
        )}

        {/* アクションバー (要件 4.3 エクスポート, 保存) */}
        <div className={styles.actionsBar}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportList}
            disabled={
              loading ||
              (listType === 'quiz' ? attachedQuizzes.length === 0 : !listId)
            }
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={18} />
            リストパッケージエクスポート
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={18} />
            リストを保存する
          </button>
        </div>
      </div>
    </div>
  );
};
