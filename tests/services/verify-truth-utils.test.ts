/**
 * Phase 15 単体テスト: AI真相自動判定ロジック（純粋関数）
 *
 * テスト対象:
 * - buildVerifyTruthPrompt: 真相判定プロンプト構築（エッセンスキーワード含む）
 * - parseTruthVerifyResponse: AIレスポンスのパース（合否・アドバイス抽出）
 * - verifyKeywords: テストプレイ向けローカル判定
 */

import {
  buildVerifyTruthPrompt,
  parseTruthVerifyResponse,
  TRUTH_FAILURE_MISSING_ESSENCE,
  TRUTH_FAILURE_UNRELATED,
  verifyKeywords,
} from '../../src/services/verify-truth-utils';

const DEFAULT_KEYWORDS: string[] = [];

function prompt(
  context = '裏設定',
  truth = 'プレイヤーの解答',
  keywords: string[] = DEFAULT_KEYWORDS
): string {
  return buildVerifyTruthPrompt(context, truth, keywords);
}

describe('buildVerifyTruthPrompt', () => {
  test('プロンプトに裏設定が含まれる', () => {
    const result = prompt('男は海の上でスープを飲んでいた', 'スープを飲むのをやめた');
    expect(result).toContain('男は海の上でスープを飲んでいた');
  });

  test('プロンプトにプレイヤーの真相要約が含まれる', () => {
    expect(prompt('裏設定', 'プレイヤーの解答')).toContain('プレイヤーの解答');
  });

  test('プロンプトにCORRECT/INCORRECT の判定指示が含まれる', () => {
    expect(prompt('裏設定', '解答')).toMatch(/CORRECT|INCORRECT/i);
  });

  test('1000文字の真相要約を受け付ける', () => {
    const longAnswer = 'あ'.repeat(1000);
    expect(prompt('裏設定', longAnswer)).toContain(longAnswer);
  });

  test('必須エッセンスキーワードがプロンプトに含まれる', () => {
    const result = prompt('裏設定', '要約', ['ウミガメ', '遭難']);
    expect(result).toContain('ウミガメ');
    expect(result).toContain('遭難');
    expect(result).toContain('必須エッセンス');
  });

  test('エッセンスの意味判定指示がプロンプトに含まれる', () => {
    const result = prompt('裏設定', '要約', ['キーワードA']);
    expect(result).toContain('文言そのものが真相要約に出現していなくても');
    expect(result).toContain('文字列の完全一致を合格条件としない');
  });

  test('不合格時は2種類のREASONのみを出力するよう指示する', () => {
    const result = prompt('裏設定', '要約', ['キーワードA']);
    expect(result).toContain('REASON: MISSING_ESSENCE');
    expect(result).toContain('REASON: UNRELATED');
    expect(result).toContain('3行目以降を一切出力しない');
  });

  test('キーワードが空配列でもプロンプトを生成する', () => {
    const result = prompt('裏設定', '要約', []);
    expect(result).toContain('裏設定');
    expect(result).toContain('要約');
    expect(result).toContain('裏設定のみを参照して判定');
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

  test('MISSING_ESSENCE は必須要素不足の固定メッセージに変換する', () => {
    const result = parseTruthVerifyResponse('VERDICT: INCORRECT\nREASON: MISSING_ESSENCE');
    expect(result.isCorrect).toBe(false);
    expect(result.advice).toBe(TRUTH_FAILURE_MISSING_ESSENCE);
  });

  test('UNRELATED は真相と異なる旨の固定メッセージに変換する', () => {
    const result = parseTruthVerifyResponse('VERDICT: INCORRECT\nREASON: UNRELATED');
    expect(result.isCorrect).toBe(false);
    expect(result.advice).toBe(TRUTH_FAILURE_UNRELATED);
  });

  test('AIが詳細ヒントを返しても固定メッセージに正規化する', () => {
    const result = parseTruthVerifyResponse(
      'VERDICT: INCORRECT\nヒント: 犯人の動機を再考してください。'
    );
    expect(result.advice).toBe(TRUTH_FAILURE_MISSING_ESSENCE);
  });

  test('合格時は advice が null または空', () => {
    const result = parseTruthVerifyResponse('VERDICT: CORRECT\n素晴らしい！');
    expect(result.isCorrect).toBe(true);
  });

  test('判定不明な場合は isCorrect = false として安全側に倒す', () => {
    const result = parseTruthVerifyResponse('何かエラーが起きました');
    expect(result.isCorrect).toBe(false);
    expect(result.advice).toBe(TRUTH_FAILURE_MISSING_ESSENCE);
  });
});

describe('verifyKeywords', () => {
  const keywords = ['ウミガメ', 'スープ', '遭難', 'React18'];

  test('すべてのキーワードが部分一致で含まれている場合に true を返す', () => {
    const summary = '男は遭難し、生き残るためにウミガメのスープを飲んだ。React18も使った。';
    expect(verifyKeywords(summary, keywords)).toBe(true);
  });

  test('キーワードが1つでも欠けている場合に false を返す', () => {
    const summary = '男は遭難し、ウミガメのスープを飲んだ。';
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
