import { Question, TextInputMode } from '@/types';

export const MIN_TEXT_INPUT_CHAR_COUNT = 1;
export const MAX_TEXT_INPUT_CHAR_COUNT = 100;

/** 記述式の入力モード（未設定時は通常テキスト、後方互換マッピングを含む） */
export function resolveTextInputMode(question: Pick<Question, 'textInputMode'>): TextInputMode {
  const mode = question.textInputMode;
  if (!mode || mode === ('text' as any) || mode === ('char-count' as any)) {
    return 'free';
  }
  return mode;
}

export function toHalfWidthAlphanumeric(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
}

export function toFullWidthKatakana(str: string): string {
  const kanaMap: { [key: string]: string } = {
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ',
    'ｰ': 'ー', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
  };
  const voicedMap: { [key: string]: string } = {
    'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
    'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
    'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
    'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
    'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
    'ｳﾞ': 'ヴ',
  };
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i + 1];
    if (nextChar === 'ﾞ' || nextChar === 'ﾟ') {
      const key = char + nextChar;
      if (voicedMap[key]) {
        result += voicedMap[key];
        i++;
        continue;
      }
    }
    if (kanaMap[char]) {
      result += kanaMap[char];
    } else {
      result += char;
    }
  }
  return result;
}

/** 記述式の正規化（全角英数字の半角化、半角カナの全角カナ化、空白除去を含む） */
export function normalizeTextAnswer(input: string): string {
  let cleaned = input.replace(/　/g, ' ').trim().replace(/\s+/g, '');
  cleaned = toHalfWidthAlphanumeric(cleaned);
  cleaned = toFullWidthKatakana(cleaned);
  return cleaned.toLowerCase();
}

/** 数値比較の許容誤差（浮動小数点の誤差吸収） */
export const NUMERIC_ANSWER_EPSILON = 1e-9;

/** 数値入力文字列の正規化（全角数字・小数点・マイナス、カンマ除去） */
export function normalizeNumericInputString(input: string): string {
  return input
    .trim()
    .replace(/　/g, '')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .replace(/[－−ー—]/g, '-')
    .replace(/,/g, '');
}

/** 数値回答のパース（整数・小数、全角数字対応） */
export function parseNumericAnswer(input: string): number | null {
  const cleaned = normalizeNumericInputString(input);
  if (cleaned === '' || cleaned === '-' || cleaned === '+') return null;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return null;
  return num;
}

/** 数値回答の等価判定（小数の浮動誤差を許容） */
export function areNumericAnswersEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < NUMERIC_ANSWER_EPSILON;
}

export function isValidNumericAnswerText(input: string): boolean {
  return parseNumericAnswer(input) !== null;
}

/** 記述式の正誤判定 */
export function isTextInputAnswerCorrect(
  rawInput: string,
  question: Pick<Question, 'correctTextAnswerList' | 'textInputMode' | 'textInputCharCount'>
): boolean {
  const correctList = question.correctTextAnswerList ?? [];
  if (correctList.length === 0) return false;

  const mode = resolveTextInputMode(question);
  const cleanInput = normalizeTextAnswer(rawInput);

  // 1. 各文字種のバリデーション
  if (mode === 'kanji') {
    if (!cleanInput || !/^[一-龠々〇〆ヶ\u3400-\u4dbf]+$/.test(cleanInput)) {
      return false;
    }
  } else if (mode === 'katakana') {
    if (!cleanInput || !/^[ァ-ヶー]+$/.test(cleanInput)) {
      return false;
    }
  } else if (mode === 'alphabet') {
    if (!cleanInput || !/^[a-zA-Z]+$/.test(cleanInput)) {
      return false;
    }
  } else if (mode === 'numeric') {
    const userNum = parseNumericAnswer(rawInput);
    if (userNum === null) return false;
  }

  // 2. 要求文字数（固定長）との一致検証（オプション）
  const expectedLen = question.textInputCharCount;
  if (expectedLen != null && expectedLen > 0) {
    if (cleanInput.length !== expectedLen) {
      return false;
    }
  }

  // 3. 値の等価判定
  if (mode === 'numeric') {
    const userNum = parseNumericAnswer(rawInput);
    if (userNum === null) return false;
    return correctList.some((ans) => {
      const correctNum = parseNumericAnswer(ans);
      return correctNum !== null && areNumericAnswersEqual(userNum, correctNum);
    });
  }

  return correctList.some((ans) => normalizeTextAnswer(ans) === cleanInput);
}

export function getTextInputFieldProps(
  question: Pick<Question, 'textInputMode' | 'textInputCharCount'>,
  options?: { placeholder?: string }
): {
  type: 'text';
  inputMode?: 'text' | 'decimal';
  maxLength?: number;
  minLength?: number;
  placeholder: string;
  pattern?: string;
} {
  const mode = resolveTextInputMode(question);
  const charCount = question.textInputCharCount;

  let inputMode: 'text' | 'decimal' | undefined = undefined;
  let placeholder = options?.placeholder ?? '回答を入力してください...';

  if (mode === 'numeric') {
    inputMode = 'decimal';
    placeholder = options?.placeholder ?? '数値で入力してください...';
  } else if (mode === 'kanji') {
    placeholder = options?.placeholder ?? '漢字で入力してください...';
  } else if (mode === 'katakana') {
    placeholder = options?.placeholder ?? 'カタカナで入力してください...';
  } else if (mode === 'alphabet') {
    placeholder = options?.placeholder ?? 'アルファベットで入力してください...';
  }

  if (charCount != null && charCount > 0) {
    placeholder = `${charCount}文字で入力してください...`;
    return {
      type: 'text',
      inputMode,
      maxLength: charCount,
      minLength: charCount,
      placeholder,
    };
  }

  return {
    type: 'text',
    inputMode,
    placeholder,
  };
}
