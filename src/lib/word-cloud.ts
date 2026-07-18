/**
 * ワードクラウド用のタイトルキーワード抽出ユーティリティ（純関数のみ）
 *
 * クイズタイトルを `Intl.Segmenter` で分かち書きし、表示に値するキーワードのみを
 * 抽出する。形態素解析ライブラリは導入せず、標準 API のみを使用する（design.md Phase 42）。
 */

/** ワードクラウドに表示する1語分のデータ */
export interface WordCloudItem {
  text: string;      // 表示する語（タグ名またはキーワード）
  count: number;     // プレイ回数（重み）
  accuracy: number;  // 正答率 0-100（count < 3 のときは参考値）
}

// クイズタイトルに頻出する汎用語（ストップワード）。表示対象から除外する（要件 20.7）
const STOP_WORDS = new Set<string>([
  'クイズ',
  '問題',
  '問題集',
  '検定',
  '入門',
  'まとめ',
  '講座',
  '一問一答',
  'テスト',
  '練習',
  '初級',
  '中級',
  '上級',
  '基礎',
  '基本',
  '応用',
  '完全',
  '総合',
  '厳選',
  'シリーズ',
  'チェック',
  'レベル',
]);

// 数字・記号・空白のみで構成される語（例: "123", "!!!"）にマッチする
const NUMERIC_SYMBOL_ONLY = /^[\p{N}\p{P}\p{S}\s]+$/u;

// ひらがな（長音符含む）のみで構成される語にマッチする
const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/;

// フォールバック分割用: 空白・記号（句読点/約物）区切り
const FALLBACK_SEPARATOR = /[\s\p{P}\p{S}]+/u;

/**
 * クイズタイトルから表示対象キーワードを抽出する（重複除去済み）
 *
 * - `Intl.Segmenter('ja', { granularity: 'word' })` で分かち書きし、`isWordLike` セグメントのみ採用
 * - 除外フィルタ: 2文字未満 / 数字・記号のみ / ひらがなのみ2文字以下 / ストップワード
 * - 同一タイトル内の重複は除去し、出現順を保ったユニークな配列を返す
 * - `Intl.Segmenter` 未定義環境では空白・記号区切りへフォールバックする
 */
export function extractTitleKeywords(title: string): string[] {
  const keywords = new Set<string>();

  for (const segment of segmentTitle(title)) {
    const word = segment.trim();
    if (!isDisplayableKeyword(word)) continue;
    keywords.add(word);
  }

  return Array.from(keywords);
}

/** タイトルを語の配列へ分割する。`Intl.Segmenter` 未定義環境ではフォールバックを使う */
function segmentTitle(title: string): string[] {
  // 実行時に判定する（テストでの未定義化やレガシー環境への対応のため、モジュール読込時に固定しない）
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    const words: string[] = [];
    for (const seg of segmenter.segment(title)) {
      // 単語相当のセグメントのみ採用（空白・記号セグメントを除外）
      if (seg.isWordLike) {
        words.push(seg.segment);
      }
    }
    return words;
  }

  // フォールバック: 空白・記号区切りの単純分割
  return title.split(FALLBACK_SEPARATOR).filter((w) => w.length > 0);
}

/** 語が表示対象キーワードとして妥当かを判定する（要件 20.7 の除外フィルタ） */
function isDisplayableKeyword(word: string): boolean {
  // サロゲートペアを考慮したコードポイント長で判定する
  const length = Array.from(word).length;

  // 2文字未満は除外
  if (length < 2) return false;

  // 数字・記号のみの語は除外
  if (NUMERIC_SYMBOL_ONLY.test(word)) return false;

  // ひらがなのみ2文字以下の語（助詞・助動詞相当）は除外
  if (length <= 2 && HIRAGANA_ONLY.test(word)) return false;

  // 汎用語（ストップワード）は除外
  if (STOP_WORDS.has(word)) return false;

  return true;
}
