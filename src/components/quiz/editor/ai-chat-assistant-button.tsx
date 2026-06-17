'use client';

import React from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';
import styles from './ai-chat-assistant.module.css';

interface AiChatAssistantButtonProps {
  isProUser: boolean;
  isChatOpen: boolean;
  /** チャットを開くときのコールバック（初期メッセージ表示などを含む） */
  onOpen: () => void;
  /** チャットを閉じるときのコールバック */
  onClose: () => void;
}

export function AiChatAssistantButton({
  isProUser,
  isChatOpen,
  onOpen,
  onClose,
}: AiChatAssistantButtonProps) {
  if (!isProUser) return null;

  return (
    <button
      data-testid="ai-chat-assistant-button"
      className={`${styles.floatingButton} ${isChatOpen ? styles.floatingButtonOpen : ''}`}
      onClick={() => (isChatOpen ? onClose() : onOpen())}
      aria-label="AIアシスタントを開く"
    >
      {isChatOpen ? (
        <Sparkles size={24} className={styles.headerIcon} />
      ) : (
        <MessageSquare size={24} />
      )}
    </button>
  );
}
