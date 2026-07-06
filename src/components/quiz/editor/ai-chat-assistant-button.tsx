'use client';

import React from 'react';
import { SmsOutlined, CloseOutlined } from '@mui/icons-material';
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
      aria-label={isChatOpen ? 'AIアシスタントを閉じる' : 'AIアシスタントを開く'}
    >
      {isChatOpen ? (
        <CloseOutlined sx={{ fontSize: 26 }} />
      ) : (
        <SmsOutlined sx={{ fontSize: 24 }} />
      )}
    </button>
  );
}
