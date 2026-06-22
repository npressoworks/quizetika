'use client';

import React from 'react';
import { SmsOutlined, AutoAwesomeOutlined } from '@mui/icons-material';
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
        <AutoAwesomeOutlined sx={{ fontSize: 24 }} className={styles.headerIcon} />
      ) : (
        <SmsOutlined sx={{ fontSize: 24 }} />
      )}
    </button>
  );
}
