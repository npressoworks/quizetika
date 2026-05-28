/**
 * AI真相自動判定ユーティリティ（純粋関数群）
 *
 * Boundary: VerifyTruthAPI (Task 2.5)
 * Requirements: 4.5, 4.6, 4.7
 */

/* ==========================================================================
   型定義
   ========================================================================== */

export interface TruthVerifyResult {
  /** AIによる真相判定: true = 合格, false = 不合格 */
  isCorrect: boolean;
  /** 不合格時のAIアドバイス（合格時は null） */
  advice: string | null;
}

/* ==========================================================================
   プロンプト構築
   ========================================================================== */

/**
 * ステートレスなAI真相判定プロンプトを構築する
 *
 * @param aiContextDetails クイズの裏設定（正解情報）
 * @param playerTruth プレイヤーが入力した真相要約（最大1000文字）
 * @returns Gemini API に渡すプロンプト文字列
 */
export function buildVerifyTruthPrompt(aiContextDetails: string, playerTruth: string): string {
  return `あなたは「ウミガメのスープ」（水平思考パズル）のゲームマスターです。
プレイヤーが提出した「真相の要約」を【裏設定】と照合し、核心に到達しているかを判定してください。

【裏設定（正解の真相）】
${aiContextDetails}

【プレイヤーの真相要約】
${playerTruth}

【判定基準】
- プレイヤーの要約が裏設定の「核心的な因果関係」を正しく説明していれば合格（CORRECT）
- 細部の表現の違いは許容するが、原因・結果・重要な登場人物の役割が正しいことが必要
- 重大な矛盾や欠落がある場合は不合格（INCORRECT）

【回答形式】
1行目: 必ず「VERDICT: CORRECT」または「VERDICT: INCORRECT」のどちらかを記載してください。
2行目以降: 
- 合格の場合: 簡潔な称賛コメント（30文字以内）
- 不合格の場合: プレイヤーが矛盾を解消するための具体的なアドバイス（100文字以内、裏設定を直接ばらさないこと）`;
}

/* ==========================================================================
   レスポンスパース
   ========================================================================== */

/**
 * Gemini API の真相判定レスポンスをパースする
 *
 * @param responseText Gemini API から返ってきた生テキスト
 * @returns { isCorrect, advice }
 */
export function parseTruthVerifyResponse(responseText: string): TruthVerifyResult {
  const lines = responseText.trim().split('\n');
  const firstLine = lines[0]?.toUpperCase() ?? '';

  const isCorrect = firstLine.includes('VERDICT: CORRECT');
  const advice = isCorrect
    ? null
    : lines.slice(1).join('\n').trim() || 'もう少し考えてみてください。';

  return { isCorrect, advice };
}
