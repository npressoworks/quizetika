/** 早押しストリームのタイミング（クライアントラベル演出・サーバー本文送信で共通） */
export const QUICK_PRESS_LABEL = '問題：';
export const QUICK_PRESS_LABEL_CHAR_MS = 200;
export const QUICK_PRESS_BODY_PAUSE_MS = 1000;
export const QUICK_PRESS_BODY_CHAR_MS = 200;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
