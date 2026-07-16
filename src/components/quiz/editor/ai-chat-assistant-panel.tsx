'use client';

import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AutoAwesomeOutlined, CloseOutlined, SendOutlined, LanguageOutlined, CheckOutlined, ReplayOutlined } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { MarkdownContent } from '@/components/markdown/markdown-content';
import styles from './ai-chat-assistant.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
    state: 'call' | 'result';
    result?: any;
  }>;
}

interface ChatLimitUsage {
  limit: number | null;
  usedToday: number;
  remainingToday: number | null;
}

interface AiChatAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  input: string;
  isGenerating: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  chatLimitUsage: ChatLimitUsage | null;
  pendingApprovals: Record<string, {
    toolCallId: string;
    toolName: string;
    args: any;
    resolve: (result: any) => void;
  }>;
  approveToolCall: (toolCallId: string) => void;
  rejectToolCall: (toolCallId: string) => void;
  /** サムネイル生成ツール呼び出しごとの実生成の進捗状態 */
  thumbnailGenerations: Record<string, {
    status: 'generating' | 'ready' | 'error';
    imageUrl?: string;
    errorMessage?: string;
  }>;
  /** イントロメッセージのアクションボタンからメッセージおよび入力ヒントをセットする */
  onSuggest: (localMessage: string, inputHint: string) => void;
  /** 会話履歴をリセットしてイントロメッセージを表示する */
  onReset: () => void;
}

function getJapaneseToolName(name: string): string {
  switch (name) {
    case 'generateBulkQuestions': return '問題の一括生成';
    case 'createQuestion': return '問題の追加';
    case 'updateQuestion': return '問題の更新';
    case 'deleteQuestions': return '問題の削除';
    case 'generateThumbnail': return 'サムネイル画像の自動生成';
    case 'checkQuestion': return '問題の包括チェック';
    case 'checkAllQuestions': return '全問題の一括包括チェック';
    case 'googleSearch': return 'Google検索の実行';
    default: return name;
  }
}

// イントロメッセージ後に表示するアクションボタン定義
const INTRO_ACTIONS = [
  {
    id: 'create',
    icon: '📝',
    label: '問題を作成',
    localMessage: '**問題を作成**するには、テーマや条件を伝えてください：\n\n> 「（テーマ）について（難易度）の問題を（形式）で1問作成して」\n\n**例：**\n- 「日本の歴史について初級の4択問題を1問作成して」\n- 「Pythonについて中級の記述問題を作成して」\n- 「世界の首都について問題を10問まとめて作って」\n\n入力欄にテーマを入れて送信してください！',
    inputHint: '（テーマ）について問題を1問作成して',
  },
  {
    id: 'check',
    icon: '🔍',
    label: 'ファクトチェック',
    localMessage: '**ファクトチェック**は、問題内容の正確性を検証します：\n\n> 「（問題番号 または「全問題」）のファクトチェックをして」\n\n**例：**\n- 「全問題のファクトチェックをして」\n- 「1番目の問題の内容を確認して」\n\nエディタに問題がある状態で指示を送ると、Google検索と組み合わせて検証します！',
    inputHint: '全問題のファクトチェックをして',
  },
  {
    id: 'edit',
    icon: '✏️',
    label: '問題を編集',
    localMessage: '**問題を編集・修正**するには、対象と修正内容を伝えてください：\n\n> 「（問題番号 または ID）の問題を（修正内容）に変えて」\n\n**例：**\n- 「1問目の問題文をより難しく書き直して」\n- 「2問目の解説をわかりやすく修正して」\n- 「3問目に選択肢を2つ追加して」\n\n変更前に必ずプレビューが表示されるので、確認してから反映できます！',
    inputHint: '（問題番号）の問題を修正して',
  },
  {
    id: 'delete',
    icon: '🗑️',
    label: '問題を削除',
    localMessage: '**問題を削除**するには、削除したい問題を指定してください：\n\n> 「（問題番号 または ID）の問題を削除して」\n\n**例：**\n- 「1問目の問題を削除して」\n- 「最後の問題を削除して」\n\n削除前にプレビューが表示され、確認してからエディタに反映されます！',
    inputHint: '（問題番号）の問題を削除して',
  },
  {
    id: 'thumbnail',
    icon: '🖼️',
    label: 'サムネイル生成',
    localMessage: '**サムネイル画像を生成**するには、イメージを伝えてください：\n\n> 「サムネイルを生成して」または「（イメージ）でカバー画像を作って」\n\n**例：**\n- 「サムネイルを生成して」\n- 「宇宙をテーマにしたクールなカバー画像を作って」\n\nタイトル・説明文があるとより適切な画像が生成されます！',
    inputHint: 'サムネイルを生成して',
  },
] as const;

export function AiChatAssistantPanel({
  isOpen,
  onClose,
  messages,
  input,
  isGenerating,
  handleInputChange,
  handleSubmit,
  chatLimitUsage,
  pendingApprovals,
  approveToolCall,
  rejectToolCall,
  thumbnailGenerations,
  onSuggest,
  onReset,
}: AiChatAssistantPanelProps) {
  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // プレビューポップアップの状態管理
  const [previewModal, setPreviewModal] = useState<{
    toolName: string;
    args: any;
  } | null>(null);

  const getMessageText = (msg: any) => {
    if (msg.content) return msg.content;
    if (Array.isArray(msg.parts)) {
      return msg.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
    }
    return '';
  };

  const getToolInvocations = (msg: any) => {
    if (Array.isArray(msg.toolInvocations)) return msg.toolInvocations;
    if (Array.isArray(msg.parts)) {
      return msg.parts
        .filter((part: any) => part.type.startsWith('tool-') || part.type === 'dynamic-tool')
        .map((part: any) => {
          let toolName = '';
          if (part.type === 'dynamic-tool') {
            toolName = part.toolName;
          } else if (part.type.startsWith('tool-')) {
            toolName = part.type.slice(5);
          }
          return {
            toolCallId: part.toolCallId,
            toolName: toolName,
            args: part.input,
            state: part.state === 'output-available' ? 'result' : 'call',
            result: part.output,
          };
        });
    }
    return [];
  };

  // 新しいメッセージが追加されたら一番下までスクロール
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // コードブロックのコピーボタン追加処理
  useEffect(() => {
    if (!historyRef.current) return;

    const preElements = historyRef.current.querySelectorAll('pre');
    preElements.forEach((pre) => {
      if (pre.querySelector(`.${styles.codeCopyButton}`)) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = styles.codeCopyButton;
      button.innerHTML = 'コピー';
      pre.style.position = 'relative';

      button.addEventListener('click', async () => {
        const codeElement = pre.querySelector('code');
        if (!codeElement) return;

        const textToCopy = codeElement.textContent || '';
        try {
          await navigator.clipboard.writeText(textToCopy);
          button.innerHTML = 'コピー完了';
          button.classList.add(styles.codeCopyButtonCopied);

          setTimeout(() => {
            button.innerHTML = 'コピー';
            button.classList.remove(styles.codeCopyButtonCopied);
          }, 2000);
        } catch (err) {
          console.error('Failed to copy text: ', err);
          button.innerHTML = 'エラー';
        }
      });

      pre.appendChild(button);
    });
  }, [messages, isGenerating]);

  const usageLabel = (() => {
    if (!chatLimitUsage) return '利用回数を読み込み中...';
    const { limit, usedToday, remainingToday } = chatLimitUsage;
    if (limit === null || remainingToday === null) {
      return `本日: 無制限（${usedToday}回使用）`;
    }
    return `${usedToday}/${limit}回使用中`;
  })();

  const isLimitReached = chatLimitUsage
    ? chatLimitUsage.limit !== null && chatLimitUsage.usedToday >= chatLimitUsage.limit
    : false;

  const hasPendingApproval = Object.keys(pendingApprovals).length > 0;

  const getJapaneseFormatName = (type: string) => {
    switch (type) {
      case 'multiple-choice': return '選択クイズ';
      case 'true-false': return '〇✕クイズ';
      case 'text-input': return '記述クイズ';
      case 'quick-press': return '早押しクイズ';
      case 'sorting': return '並び替えクイズ';
      case 'association': return '連想クイズ';
      case 'lateral-thinking': return 'ウミガメのスープ';
      default: return type;
    }
  };

  const renderToolPreview = (toolName: string, args: any, isModal = false) => {
    const textQuestionSentenceClass = isModal ? 'text-xl font-semibold' : 'text-base';

    const textBaseClass = isModal ? 'text-sm' : 'text-xs';
    const detailTextClass = isModal ? 'text-sm text-muted-foreground' : 'text-xs text-muted-foreground';

    // 正解・正答用の緑色クラス
    const correctAnswerClass = isModal ? 'text-green-500 font-semibold' : 'text-green-500 font-semibold';

    switch (toolName) {
      case 'createQuestion': {
        const q = args.question;
        if (!q) return null;
        return (
          <div className={styles.questionPreview}>
            <div className={styles.previewBadge}>問題の追加</div>
            <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
              <strong>形式:</strong> {getJapaneseFormatName(q.type)}
            </div>
            <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
              <strong>問題文:</strong> {q.questionText || '（空欄）'}
            </div>
            {q.choices && q.choices.length > 0 && (
              <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
                <strong>選択肢:</strong>
                <ul className={`list-disc pl-4 ${textBaseClass}`}>
                  {q.choices.map((c: any, i: number) => (
                    <li key={c.id || i} className={c.isCorrect ? correctAnswerClass : ''}>
                      {c.choiceText} {c.isCorrect ? '✓' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {q.correctTextAnswerList && q.correctTextAnswerList.length > 0 && (
              <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
                <strong>答え:</strong> <span className={correctAnswerClass}>{q.correctTextAnswerList.join(', ')}</span>
              </div>
            )}
            {q.explanation && (
              <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
                <strong>解説:</strong> {q.explanation}
              </div>
            )}
          </div>
        );
      }

      case 'updateQuestion': {
        const updates = args.updates;
        if (!updates) return null;
        return (
          <div className={styles.questionPreview}>
            <div className={styles.previewBadge}>問題の変更 (ID: {args.id?.substring(0, 6)}...)</div>
            {updates.questionText !== undefined && (
              <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
                <strong>問題文:</strong> {updates.questionText || '（空欄）'}
              </div>
            )}
            {updates.choices && updates.choices.length > 0 && (
              <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
                <strong>選択肢の更新:</strong>
                <ul className={`list-disc pl-4 ${textBaseClass}`}>
                  {updates.choices.map((c: any, i: number) => (
                    <li key={c.id || i} className={c.isCorrect ? correctAnswerClass : ''}>
                      {c.choiceText} {c.isCorrect ? '✓' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {updates.correctTextAnswerList && (
              <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
                <strong>答えの更新:</strong> <span className={correctAnswerClass}>{updates.correctTextAnswerList.join(', ')}</span>
              </div>
            )}
            {updates.explanation !== undefined && (
              <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
                <strong>解説:</strong> {updates.explanation}
              </div>
            )}
            {updates.hint !== undefined && (
              <div className={`${styles.previewField} ${isModal ? 'text-base' : ''}`}>
                <strong>ヒント:</strong> {updates.hint || '（なし）'}
              </div>
            )}
          </div>
        );
      }

      case 'deleteQuestions': {
        const targetLabel = (() => {
          if (args.questionIndexes && args.questionIndexes.length > 0) {
            return `${args.questionIndexes.join(', ')}問目の問題`;
          }
          if (args.questionIndex !== undefined) {
            return `${args.questionIndex}問目の問題`;
          }
          if (args.ids && args.ids.length > 0) {
            return args.ids.map((id: string) => `ID: ${id.substring(0, 6)}...`).join(', ');
          }
          if (args.id) {
            return `ID: ${args.id.substring(0, 6)}...`;
          }
          return '指定された問題';
        })();

        const count = args.questionIndexes?.length || args.ids?.length || 1;

        return (
          <div className={styles.questionPreviewDanger}>
            <div className={styles.previewBadgeDanger}>問題の削除 (計 {count} 問)</div>
            <p className={`${textBaseClass} text-destructive`}>
              {targetLabel} をエディタから削除します。
            </p>
          </div>
        );
      }

      case 'generateBulkQuestions': {
        const list = args.questions;
        if (!Array.isArray(list)) return null;
        const listHeightClass = isModal ? 'max-h-[55vh]' : 'max-h-32';
        return (
          <div className={styles.questionPreview}>
            <div className={styles.previewBadge}>一括作問 (計 {list.length} 問)</div>
            <ul className={`list-decimal pl-4 ${textBaseClass} ${listHeightClass} overflow-y-auto`}>
              {list.map((q: any, i: number) => {
                const getCorrectAnswerLabel = () => {
                  if (q.type === 'multiple-choice' || q.type === 'true-false') {
                    const correctChoice = q.choices?.find((c: any) => c.isCorrect);
                    return correctChoice ? `正解: ${correctChoice.choiceText}` : '正解: 未設定';
                  }
                  if (q.type === 'text-input' || q.type === 'quick-press') {
                    return q.correctTextAnswerList && q.correctTextAnswerList.length > 0
                      ? `正解: ${q.correctTextAnswerList.join(', ')}`
                      : '正解: 未設定';
                  }
                  if (q.type === 'sorting') {
                    const sortedItems = [...(q.sortingItems || [])].sort((a: any, b: any) => a.correctOrder - b.correctOrder);
                    return sortedItems.length > 0
                      ? `正解順: ${sortedItems.map((item: any) => item.text).join(' → ')}`
                      : '正解順: 未設定';
                  }
                  if (q.type === 'association') {
                    return q.correctTextAnswerList && q.correctTextAnswerList.length > 0
                      ? `正解: ${q.correctTextAnswerList.join(', ')} (ヒント: ${q.associationHints?.join(', ') || ''})`
                      : '正解: 未設定';
                  }
                  return '';
                };

                const answerLabel = getCorrectAnswerLabel();

                return (
                  <li key={i} className="mb-3">
                    <div className={textQuestionSentenceClass}>
                      [{getJapaneseFormatName(q.type)}] {q.questionText || '（空欄）'}
                    </div>
                    {answerLabel && (
                      <div className={`${correctAnswerClass} mt-0.5 ml-2`}>
                        ✓ {answerLabel}
                      </div>
                    )}
                    {q.choices && q.choices.length > 0 && (
                      <div className={`mt-0.5 ml-2 ${detailTextClass}`}>
                        <strong>選択肢:</strong>{' '}
                        {q.choices.map((c: any, idx: number) => (
                          <span key={c.id || idx}>
                            {idx > 0 && ' / '}
                            <span className={c.isCorrect ? correctAnswerClass : ''}>
                              {c.choiceText}{c.isCorrect ? ' (正解)' : ''}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                    {q.explanation && (
                      <div className={`mt-0.5 ml-2 italic ${detailTextClass}`}>
                        <strong>解説:</strong> {q.explanation}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }

      case 'generateThumbnail': {
        return (
          <div className={styles.questionPreview}>
            <div className={styles.previewBadge}>カバー画像生成</div>
            {args.imageUrl ? (
              <img
                src={args.imageUrl}
                alt="生成されたサムネイル"
                style={{ width: '100%', borderRadius: 8, marginTop: 4 }}
              />
            ) : (
              <p className={isModal ? 'text-base' : 'text-xs'}>AIカバー画像を生成してエディタに設定します。</p>
            )}
            {args.userInstruction && <p className={`${textBaseClass} text-muted-foreground`}>指示: {args.userInstruction}</p>}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      data-testid="ai-chat-assistant-panel"
      data-open={isOpen ? 'true' : 'false'}
      className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <AutoAwesomeOutlined sx={{ fontSize: 18 }} className={styles.headerIcon} />
          <span>AI作問アシスタント</span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            data-testid="ai-chat-reset-button"
            className={styles.closeButton}
            onClick={onReset}
            aria-label="会話をリセット"
            title="会話をリセット"
          >
            <ReplayOutlined sx={{ fontSize: 15 }} />
          </button>
          <button
            type="button"
            data-testid="ai-chat-close-button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="チャットを閉じる"
          >
            <CloseOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      {/* Chat History */}
      <div ref={historyRef} className={styles.history}>
        {messages
          .filter((msg) => msg.role !== 'system')
          .map((msg) => {
            const isUser = msg.role === 'user';
            const textContent = getMessageText(msg);
            const toolInvocations = getToolInvocations(msg);
            const isIntroMsg = msg.id === 'intro-message';

            return (
              <div
                key={msg.id}
                className={`${styles.message} ${isUser ? styles.messageUser : styles.messageAssistant
                  }`}
              >
                {textContent && (
                  <div
                    className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant
                      }`}
                  >
                    {isUser ? (
                      textContent
                    ) : (
                      <MarkdownContent markdown={textContent} />
                    )}
                  </div>
                )}

                {/* intro-message の直後に機能ボタンを表示 */}
                {isIntroMsg && (
                  <div className={styles.introActions}>
                    {INTRO_ACTIONS.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={styles.introActionButton}
                        onClick={() => onSuggest(action.localMessage, action.inputHint)}
                        disabled={isGenerating}
                      >
                        <span className={styles.introActionIcon}>{action.icon}</span>
                        <span className={styles.introActionLabel}>{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Tool Invocations log representation */}
                {toolInvocations?.map((tool: any) => {
                  const isCall = tool.state === 'call';
                  const isSearch = tool.toolName === 'googleSearch';
                  const pending = pendingApprovals[tool.toolCallId];
                  const isPendingApproval = isCall && !!pending;
                  const isThumbnail = tool.toolName === 'generateThumbnail';
                  const thumbGen = isThumbnail ? thumbnailGenerations[tool.toolCallId] : undefined;

                  // 承認・却下の確定状態
                  const isApproved = tool.state === 'result' && tool.result?.success === true;
                  const isRejected = tool.state === 'result' && tool.result?.error === 'rejected';
                  const isFailed = tool.state === 'result' && tool.result?.success === false && tool.result?.error !== 'rejected';

                  // 承認対象のツールかどうか
                  const approvalRequiredTools = [
                    'updateQuestion',
                    'deleteQuestions',
                    'generateBulkQuestions',
                    'generateThumbnail'
                  ];
                  const isApprovalRequired = approvalRequiredTools.includes(tool.toolName);

                  // 状態に応じた表示文言
                  const labelText = (() => {
                    if (isThumbnail && isPendingApproval) {
                      if (!thumbGen || thumbGen.status === 'generating') return 'サムネイル画像を生成中…';
                      if (thumbGen.status === 'error') return 'サムネイル画像の生成に失敗しました';
                      return 'サムネイル画像が完成しました。反映しますか？';
                    }
                    if (isApprovalRequired) {
                      if (isPendingApproval) return `${getJapaneseToolName(tool.toolName)}の承認待ち…`;
                      if (isApproved) return `${getJapaneseToolName(tool.toolName)}を反映しました`;
                      if (isRejected) return `${getJapaneseToolName(tool.toolName)}をキャンセルしました`;
                      if (isFailed) return `${getJapaneseToolName(tool.toolName)}の反映に失敗しました`;
                    }
                    return `${getJapaneseToolName(tool.toolName)}${isCall ? 'を実行中…' : 'が完了しました'}`;
                  })();

                  const statusClass = (() => {
                    if (isThumbnail && isPendingApproval) {
                      if (thumbGen?.status === 'error') return styles.toolError;
                      return styles.toolWarning || '';
                    }
                    if (isCall && !isPendingApproval) return '';
                    if (isPendingApproval) return styles.toolWarning || '';
                    if (isApproved) return styles.toolSuccess;
                    if (isRejected || isFailed) return styles.toolError;
                    return styles.toolSuccess;
                  })();

                  return (
                    <div key={tool.toolCallId} className="flex flex-col">
                      <div className={`${styles.toolInvocation} ${statusClass}`}>
                        {isThumbnail && isPendingApproval ? (
                          (!thumbGen || thumbGen.status === 'generating') ? (
                            <CircularProgress size={12} />
                          ) : thumbGen.status === 'error' ? (
                            <CloseOutlined sx={{ fontSize: 12 }} className="text-destructive" />
                          ) : (
                            <AutoAwesomeOutlined sx={{ fontSize: 12 }} className="text-amber-500" style={{ animation: 'pulse 2s infinite' }} />
                          )
                        ) : isCall && !isPendingApproval ? (
                          <CircularProgress size={12} />
                        ) : isPendingApproval ? (
                          <AutoAwesomeOutlined sx={{ fontSize: 12 }} className="text-amber-500" style={{ animation: 'pulse 2s infinite' }} />
                        ) : isRejected || isFailed ? (
                          <CloseOutlined sx={{ fontSize: 12 }} className="text-destructive" />
                        ) : (
                          <CheckOutlined sx={{ fontSize: 12 }} />
                        )}
                        <span>{labelText}</span>
                      </div>

                      {/* 承認待ち時のプレビュー＆ボタン */}
                      {isPendingApproval && isThumbnail && (
                        <div className={styles.approvalContainer}>
                          {(!thumbGen || thumbGen.status === 'generating') && (
                            <div className={styles.approvalPreviewButton} style={{ cursor: 'default' }}>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <CircularProgress size={14} />
                                <span>画像を生成しています。数十秒ほどお待ちください…</span>
                              </div>
                            </div>
                          )}
                          {thumbGen?.status === 'error' && (
                            <div className={styles.approvalPreviewButton} style={{ cursor: 'default' }}>
                              <p className="text-xs text-destructive">{thumbGen.errorMessage || '画像の生成に失敗しました'}</p>
                            </div>
                          )}
                          {thumbGen?.status === 'ready' && thumbGen.imageUrl && (
                            <button
                              type="button"
                              className={styles.approvalPreviewButton}
                              onClick={() => setPreviewModal({ toolName: tool.toolName, args: { ...tool.args, imageUrl: thumbGen.imageUrl } })}
                              title="クリックして拡大"
                            >
                              <div className={styles.previewTitle}>🖼️ 生成された画像 <span className={styles.previewExpandHint}>(タップで拡大)</span></div>
                              {renderToolPreview(tool.toolName, { ...tool.args, imageUrl: thumbGen.imageUrl })}
                            </button>
                          )}
                          <div className={styles.approvalActions}>
                            <button
                              type="button"
                              className={styles.approveButton}
                              onClick={() => approveToolCall(tool.toolCallId)}
                              disabled={thumbGen?.status !== 'ready'}
                            >
                              フォームに反映する
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              onClick={() => rejectToolCall(tool.toolCallId)}
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 承認待ち時のプレビュー＆ボタン（サムネイル以外） */}
                      {isPendingApproval && !isThumbnail && (
                        <div className={styles.approvalContainer}>
                          {/* クリックで拡大プレビューを開くカード */}
                          <button
                            type="button"
                            className={styles.approvalPreviewButton}
                            onClick={() => setPreviewModal({ toolName: tool.toolName, args: tool.args })}
                            title="クリックして詳細を見る"
                          >
                            <div className={styles.previewTitle}>📋 提案内容のプレビュー <span className={styles.previewExpandHint}>(タップで拡大)</span></div>
                            {renderToolPreview(tool.toolName, tool.args)}
                          </button>
                          <div className={styles.approvalActions}>
                            <button
                              type="button"
                              className={styles.approveButton}
                              onClick={() => approveToolCall(tool.toolCallId)}
                            >
                              フォームに反映する
                            </button>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              onClick={() => rejectToolCall(tool.toolCallId)}
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Display Google Search citations */}
                      {isSearch && tool.state === 'result' && tool.result?.results && (
                        <div className={styles.sources}>
                          <div className={styles.sourceTitle}>🔍 検索ソース:</div>
                          {tool.result.results.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground pl-2">
                              該当事実の裏付けが得られませんでした
                            </span>
                          ) : (
                            tool.result.results.map((src: any, idx: number) => (
                              <a
                                key={idx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.sourceLink}
                                title={src.snippet}
                              >
                                {src.title || src.url}
                              </a>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

        {/* Streaming/Loading Indicator */}
        {isGenerating && (
          <div className={styles.loadingContainer}>
            <div className={styles.dot} />
            <div className={styles.dot} />
            <div className={styles.dot} />
            <span className="text-xs">AIが思考中...</span>
          </div>
        )}
      </div>

      {/* Footer Form */}
      <div className={styles.footer}>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={
              isLimitReached
                ? '本日の制限回数に達しました'
                : hasPendingApproval
                  ? '提案の承認/却下を選択してください'
                  : 'AIに指示を送る...'
            }
            value={input || ''}
            onChange={handleInputChange}
            disabled={isGenerating || isLimitReached || hasPendingApproval}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isGenerating || !input?.trim() || isLimitReached || hasPendingApproval}
            aria-label="メッセージを送信"
          >
            <SendOutlined sx={{ fontSize: 16 }} />
          </button>
        </form>
        <div className={styles.limitInfo}>
          <span>{usageLabel}</span>
          {isLimitReached && (
            <span className="text-destructive font-semibold">
              翌日0時以降に再度ご利用ください
            </span>
          )}
        </div>
      </div>

      {/* プレビュー拡大ポップアップ */}
      {previewModal && typeof document !== 'undefined' && createPortal(
        <div
          className={styles.previewModalOverlay}
          onClick={() => setPreviewModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label="提案内容の詳細プレビュー"
        >
          <div
            className={styles.previewModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.previewModalHeader}>
              <span className={styles.previewModalTitle}>📋 提案内容の詳細</span>
              <button
                type="button"
                className={styles.previewModalClose}
                onClick={() => setPreviewModal(null)}
                aria-label="閉じる"
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className={styles.previewModalBody}>
              {renderToolPreview(previewModal.toolName, previewModal.args, true)}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
