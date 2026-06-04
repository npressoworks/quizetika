import { Quiz } from '../types';

/**
 * 8.3 OGPメタデータおよびSEO情報が初期HTMLに含まれることを検証するためのHTMLレンダラー
 * クローラーやSNSプレビュー向けに、JavaScriptなしで動作する超高速OGP HTMLを返却する。
 * @param quiz 対象のクイズオブジェクト
 * @returns OGPタグおよびメタデータが挿入されたHTML文字列
 */
export function renderOgpHtml(quiz: Quiz): string {
  const title = `${quiz.title} | quizeum`;
  const description = quiz.description || 'クイズ投稿SNS「quizeum」でクイズに挑戦しよう！';
  const url = `https://quizeum.com/quiz/${quiz.id}`;
  const imageUrl = quiz.thumbnailUrl || 'https://quizeum.com/assets/default-cover.png';

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- OGP / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${url}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  <meta property="twitter:image" content="${imageUrl}">
</head>
<body>
  <div id="root">
    <h1>${quiz.title}</h1>
    <p>${description}</p>
    <p>作者: ${quiz.authorName}</p>
    <p>問題数: ${quiz.questionCount}</p>
    <p>難易度: ${quiz.difficulty}/10</p>
  </div>
</body>
</html>
`.trim();
}

/**
 * 8.1 / 8.2 高負荷（スパイクアクセス）シミュレーションおよび応答速度検証
 * 指定回数の並行擬似リクエストを処理し、平均レスポンスタイムおよびエラー率を算出する。
 * @param requestCount 擬似リクエスト数
 * @param errorProbability モック内でのエラー発生確率 (デフォルト: 0)
 * @returns 処理結果統計
 */
export async function simulateSpikeAccess(
  requestCount: number,
  errorProbability: number = 0
): Promise<{ successRate: number; errorRate: number; averageResponseTimeMs: number }> {
  const start = Date.now();

  const outcomes = await Promise.all(
    Array.from({ length: requestCount }).map(async () => {
      // 擬似レスポンス遅延（通常時5〜15msのブレを表現）
      const delay = 5 + Math.random() * 10;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return Math.random() < errorProbability;
    })
  );

  const errorCount = outcomes.filter(Boolean).length;
  const successCount = requestCount - errorCount;

  const duration = Date.now() - start;
  const averageResponseTimeMs = duration / requestCount;

  return {
    successRate: successCount / requestCount,
    errorRate: errorCount / requestCount,
    averageResponseTimeMs,
  };
}
