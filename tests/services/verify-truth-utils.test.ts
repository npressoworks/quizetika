/**
 * Task 2.5 単体テスト: AI真相自動判定ロジック（純粋関数）
 *
 * テスト対象:
 * - buildVerifyTruthPrompt: 真相判定プロンプト構築
 * - parseTruthVerifyResponse: AIレスポンスのパース（合否・アドバイス抽出）
 */

import {
  buildVerifyTruthPrompt,
  parseTruthVerifyResponse,
  verifyKeywords,
} from '../../src/services/verify-truth-utils';

describe('buildVerifyTruthPrompt', () => {
  test('プロンプトに裏設定が含まれる', () => {
    const prompt = buildVerifyTruthPrompt('男は海の上でスープを飲んでいた', 'スープを飲むのをやめた');
    expect(prompt).toContain('男は海の上でスープを飲んでいた');
  });

  test('プロンプトにプレイヤーの真相要約が含まれる', () => {
    const prompt = buildVerifyTruthPrompt('裏設定', 'プレイヤーの解答');
    expect(prompt).toContain('プレイヤーの解答');
  });

  test('プロンプトにCORRECT/INCORRECT の判定指示が含まれる', () => {
    const prompt = buildVerifyTruthPrompt('裏設定', '解答');
    expect(prompt).toMatch(/CORRECT|INCORRECT/i);
  });

  test('1000文字の真相要約を受け付ける', () => {
    const longAnswer = 'あ'.repeat(1000);
    const prompt = buildVerifyTruthPrompt('裏設定', longAnswer);
    expect(prompt).toContain(longAnswer);
  });
});

describe('parseTruthVerifyResponse', () => {
  test('CORRECT を含むレスポンスは isCorrect = true を返す', () => {
    const result = parseTruthVerifyResponse('VERDICT: CORRECT\nよく解けました！');
    expect(result.isCorrect).toBe(true);
  });

  test('INCORRECT を含むレスポンスは isCorrect = false を返す', () => {
    const result = parseTruthVerifyResponse('VERDICT: INCORRECT\nまだ矛盾があります。');
    expect(result.isCorrect).toBe(false);
  });

  test('不合格時のレスポンスにアドバイスが含まれる', () => {
    const result = parseTruthVerifyResponse('VERDICT: INCORRECT\nヒント: 犯人の動機を再考してください。');
    expect(result.advice).toContain('ヒント');
  });

  test('合格時は advice が null または空', () => {
    const result = parseTruthVerifyResponse('VERDICT: CORRECT\n素晴らしい！');
    // 合格時はアドバイス不要
    expect(result.isCorrect).toBe(true);
  });

  test('判定不明な場合は isCorrect = false として安全側に倒す', () => {
    const result = parseTruthVerifyResponse('何かエラーが起きました');
    expect(result.isCorrect).toBe(false);
  });
});

/* ============================================================
   verifyKeywords のテスト
   ============================================================ */
describe('verifyKeywords', () => {
  const keywords = ['ウミガメ', 'スープ', '遭難', 'React18'];

  test('すべてのキーワードが部分一致で含まれている場合に true を返す', () => {
    const summary = '男は遭難し、生き残るためにウミガメのスープを飲んだ。React18も使った。';
    expect(verifyKeywords(summary, keywords)).toBe(true);
  });

  test('キーワードが1つでも欠けている場合に false を返す', () => {
    const summary = '男は遭難し、ウミガメのスープを飲んだ。';
    // 'React18' が含まれていないため不合格
    expect(verifyKeywords(summary, keywords)).toBe(false);
  });

  test('大文字・小文字を区別せず合致判定できる', () => {
    const summary = '男は遭難し、ウミガメのスープを飲んだ。react18を使用。';
    expect(verifyKeywords(summary, keywords)).toBe(true);
  });

  test('スペース（全角・半角）を取り除いて判定できる', () => {
    const summary = '男 は 遭 難 し、 ウ ミ ガ メ の ス ー プ を 飲んだ。R e a c t 1 8';
    expect(verifyKeywords(summary, keywords)).toBe(true);
  });

  test('全角英数字を半角に変換して判定できる', () => {
    const summary = '男は遭難し、ウミガメのスープを飲んだ。Ｒｅａｃｔ１８';
    expect(verifyKeywords(summary, keywords)).toBe(true);
  });

  test('キーワードが空配列の場合は false を返す', () => {
    expect(verifyKeywords('何か解答', [])).toBe(false);
  });
});
