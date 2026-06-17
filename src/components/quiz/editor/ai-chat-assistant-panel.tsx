'use client';

import React, { useRef, useEffect } from 'react';
import { Sparkles, X, Send, Globe, Check, Loader2 } from 'lucide-react';
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
}

function getJapaneseToolName(name: string): string {
  switch (name) {
    case 'generateBulkQuestions': return '問題の一括生成';
    case 'createQuestion': return '問題の追加';
    case 'updateQuestion': return '問題の更新';
    case 'deleteQuestion': return '問題の削除';
    case 'generateThumbnail': return 'サムネイル画像の自動生成';
    case 'checkQuestion': return '問題の包括チェック';
    case 'checkAllQuestions': return '全問題の一括包括チェック';
    case 'googleSearch': return 'Google検索の実行';
    default: return name;
  }
}

export function AiChatAssistantPanel({
  isOpen,
  onClose,
  messages,
  input,
  isGenerating,
  handleInputChange,
  handleSubmit,
  chatLimitUsage,
}: AiChatAssistantPanelProps) {
  const historyRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      data-testid="ai-chat-assistant-panel"
      data-open={isOpen ? 'true' : 'false'}
      className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <Sparkles size={18} className={styles.headerIcon} />
          <span>AI作問アシスタント</span>
        </div>
        <button
          type="button"
          data-testid="ai-chat-close-button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="チャットを閉じる"
        >
          <X size={18} />
        </button>
      </div>

      {/* Chat History */}
      <div ref={historyRef} className={styles.history}>
        {messages
          .filter((msg) => msg.role !== 'system')
          .map((msg) => {
            const isUser = msg.role === 'user';
            const textContent = getMessageText(msg);
            const toolInvocations = getToolInvocations(msg);
            
            return (
              <div
                key={msg.id}
                className={`${styles.message} ${
                  isUser ? styles.messageUser : styles.messageAssistant
                }`}
              >
                {textContent && (
                  <div
                    className={`${styles.bubble} ${
                      isUser ? styles.bubbleUser : styles.bubbleAssistant
                    }`}
                  >
                    {isUser ? (
                      textContent
                    ) : (
                      <MarkdownContent markdown={textContent} />
                    )}
                  </div>
                )}

                {/* Tool Invocations log representation */}
                {toolInvocations?.map((tool: any) => {
                  const isCall = tool.state === 'call';
                  const isSearch = tool.toolName === 'googleSearch';
                  
                  return (
                    <div key={tool.toolCallId} className="flex flex-col">
                      <div
                        className={`${styles.toolInvocation} ${
                          !isCall ? styles.toolSuccess : ''
                        }`}
                      >
                        {isCall ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        <span>
                          {getJapaneseToolName(tool.toolName)}
                          {isCall ? 'を実行中…' : 'が完了しました'}
                        </span>
                      </div>

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
            type="text"
            className={styles.input}
            placeholder={isLimitReached ? '本日の制限回数に達しました' : 'AIに指示を送る...'}
            value={input || ''}
            onChange={handleInputChange}
            disabled={isGenerating || isLimitReached}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isGenerating || !input?.trim() || isLimitReached}
            aria-label="メッセージを送信"
          >
            <Send size={16} />
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
    </div>
  );
}
