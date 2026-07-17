import {
  toHalfWidthAlphanumeric,
  toFullWidthKatakana,
  normalizeTextAnswer,
  isTextInputAnswerCorrect,
  getTextInputFieldProps,
} from '@/services/text-answer-utils';
import { Question } from '@/types';

describe('text-answer-utils', () => {
  describe('toHalfWidthAlphanumeric', () => {
    it('converts full-width alphanumeric to half-width', () => {
      expect(toHalfWidthAlphanumeric('ＡＢＣ１２３ａｂｃ')).toBe('ABC123abc');
      expect(toHalfWidthAlphanumeric('富士山')).toBe('富士山');
    });
  });

  describe('toFullWidthKatakana', () => {
    it('converts half-width katakana to full-width', () => {
      expect(toFullWidthKatakana('ｱｲｳｴｵ')).toBe('アイウエオ');
      expect(toFullWidthKatakana('ｶﾞｯﾂ')).toBe('ガッツ');
      expect(toFullWidthKatakana('ﾊﾟﾊﾟ')).toBe('パパ');
      expect(toFullWidthKatakana('ｳﾞｧ')).toBe('ヴァ');
      expect(toFullWidthKatakana('ｰ')).toBe('ー');
    });
  });

  describe('normalizeTextAnswer', () => {
    it('normalizes spaces, casing, and full-width/half-width characters', () => {
      expect(normalizeTextAnswer('  ＡｂＣ  ')).toBe('abc');
      expect(normalizeTextAnswer('ｱｲ ｳｴ　ｵ')).toBe('アイウエオ'); // 全角・半角スペースの除去
    });
  });

  describe('isTextInputAnswerCorrect', () => {
    const baseQuestion: Question = {
      id: 'q1',
      type: 'text-input',
      questionText: 'Test Question',
      explanation: 'Test Explanation',
      imageUrl: null,
      hint: null,
      limitTime: null,
      correctCount: 0,
      incorrectCount: 0,
    };

    it('validates kanji mode correctly', () => {
      const q: Question = {
        ...baseQuestion,
        textInputMode: 'kanji',
        correctTextAnswerList: ['富士山', '山々'],
      };
      expect(isTextInputAnswerCorrect('富士山', q)).toBe(true);
      expect(isTextInputAnswerCorrect('山々', q)).toBe(true);
      expect(isTextInputAnswerCorrect('ふじさん', q)).toBe(false); // ひらがなNG
      expect(isTextInputAnswerCorrect('富士山1', q)).toBe(false); // 数字NG
    });

    it('validates katakana mode correctly', () => {
      const q: Question = {
        ...baseQuestion,
        textInputMode: 'katakana',
        correctTextAnswerList: ['ピカチュウ', 'ラーメン'],
      };
      expect(isTextInputAnswerCorrect('ピカチュウ', q)).toBe(true);
      expect(isTextInputAnswerCorrect('ﾋﾟｶﾁｭｳ', q)).toBe(true); // 自動全角変換でOK
      expect(isTextInputAnswerCorrect('ラーメン', q)).toBe(true);
      expect(isTextInputAnswerCorrect('ぴかちゅう', q)).toBe(false); // ひらがなNG
      expect(isTextInputAnswerCorrect('ピカチュウA', q)).toBe(false); // 英字NG
    });

    it('validates alphabet mode correctly', () => {
      const q: Question = {
        ...baseQuestion,
        textInputMode: 'alphabet',
        correctTextAnswerList: ['Apple', 'banana'],
      };
      expect(isTextInputAnswerCorrect('Apple', q)).toBe(true);
      expect(isTextInputAnswerCorrect('apple', q)).toBe(true); // 大文字小文字同一視
      expect(isTextInputAnswerCorrect('Ａｐｐｌｅ', q)).toBe(true); // 自動半角でOK
      expect(isTextInputAnswerCorrect('りんご', q)).toBe(false); // 日本語NG
    });

    it('validates numeric mode correctly', () => {
      const q: Question = {
        ...baseQuestion,
        textInputMode: 'numeric',
        correctTextAnswerList: ['123', '-4.5'],
      };
      expect(isTextInputAnswerCorrect('123', q)).toBe(true);
      expect(isTextInputAnswerCorrect('１２３', q)).toBe(true);
      expect(isTextInputAnswerCorrect('-4.5', q)).toBe(true);
      expect(isTextInputAnswerCorrect('ー４．５', q)).toBe(true); // 全角記号の正規化
      expect(isTextInputAnswerCorrect('123.00', q)).toBe(true); // 数値として等価
      expect(isTextInputAnswerCorrect('abc', q)).toBe(false);
    });

    it('applies char length validation when specified', () => {
      const q: Question = {
        ...baseQuestion,
        textInputMode: 'free',
        textInputCharCount: 4,
        correctTextAnswerList: ['富士山山', 'Apple'], // Appleは5文字なので不一致にする
      };
      expect(isTextInputAnswerCorrect('富士山山', q)).toBe(true); // 4文字で一致
      expect(isTextInputAnswerCorrect('富士山', q)).toBe(false); // 3文字不一致
      expect(isTextInputAnswerCorrect('Apple', q)).toBe(false); // 5文字不一致
    });

    it('does not apply char length validation when unspecified', () => {
      const q: Question = {
        ...baseQuestion,
        textInputMode: 'free',
        textInputCharCount: undefined,
        correctTextAnswerList: ['富士山'],
      };
      expect(isTextInputAnswerCorrect('富士山', q)).toBe(true);
    });
  });

  describe('getTextInputFieldProps', () => {
    it('returns appropriate properties based on mode and char count', () => {
      const q1 = { textInputMode: 'numeric' as const, textInputCharCount: undefined };
      expect(getTextInputFieldProps(q1)).toEqual({
        type: 'text',
        inputMode: 'decimal',
        placeholder: '数値で入力してください...',
      });

      const q2 = { textInputMode: 'katakana' as const, textInputCharCount: 4 };
      expect(getTextInputFieldProps(q2)).toEqual({
        type: 'text',
        inputMode: undefined,
        maxLength: 4,
        minLength: 4,
        placeholder: '4文字で入力してください...',
      });
    });
  });
});
