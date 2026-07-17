# Implementation Plan

## Tasks

### 1. Foundation: データ定義と共通ロジック、単体テストの整備
- [x] 1. Foundation: データ定義と共通ロジック、単体テストの整備
- [x] 1.1 `TextInputMode` 型定義の拡張と後方互換対応
  - `src/types/index.ts` にて `TextInputMode` を `'free' | 'kanji' | 'katakana' | 'alphabet' | 'numeric'` へ拡張する
  - `src/services/text-answer-utils.ts` の `resolveTextInputMode` を更新し、旧モード `'text'` および `'char-count'` を `'free'` に安全にマッピングする処理を実装する
  - [Done] 既存の型エラーがなくなり、開発ビルドが正常に起動すること
  - _Requirements: 2.6_
  - _Boundary: Types, TextAnswerUtils_
- [x] 1.2 自動半角・全角変換および文字種・文字数検証関数の実装
  - `text-answer-utils.ts` に `toHalfWidthAlphanumeric` (全角英数→半角) および `toFullWidthKatakana` (半角カナ→全角) を実装する
  - 各文字種 (漢字、カタカナ、アルファベット、数字) の正規表現による判定ロジックと、`textInputCharCount` による固定長一致検証を `isTextInputAnswerCorrect` に実装する
  - `normalizeTextAnswer` に空白除去と文字種に合わせた変換（英数字の半角化、半角カタカナの全角カナ化）を統合する
  - [Done] `text-answer-utils.ts` 内の判定処理および正規化処理が実装され、ビルドが通ること
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - _Boundary: TextAnswerUtils_
- [x] 1.3 `text-answer-utils` の Jest ユニットテスト追加
  - `tests/services/text-answer-utils.test.ts` を新規作成し、各変換関数、正規化処理、正誤判定ロジックに対する単体テストケースを網羅して記述する
  - [Done] `npm run test tests/services/text-answer-utils.test.ts` を実行して、記述したテストケースがすべて正常にパスすること
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - _Boundary: TestSuite_

### 2. Core - Editor: 作問エディタおよび保存前バリデーションの改修
- [x] 2. Core - Editor: 作問エディタおよび保存前バリデーションの改修
- [x] 2.1 (P) 作問エディタUI (TextInputEditor) の文字種・文字数入力欄の改修
  - `text-input-editor.tsx` の「入力タイプ」選択欄を新しい文字種（フリー、漢字、カタカナ、アルファベット、数字）のセレクト/トグルに変更する
  - 要求文字数の入力欄を、選択中の文字種に関わらず常時表示するように改修する
  - [Done] 作問エディタを開いた際、新しい文字種の選択肢が表示され、どの文字種を選択しても文字数入力欄が表示されること
  - _Requirements: 3.1, 3.2_
  - _Boundary: TextInputEditor_
- [x] 2.2 (P) クイズエディタ状態管理および自動変換適用
  - `quiz-editor.tsx` の `handleTextInputModeChange` および `handleTextInputCharCountChange` を新仕様（空欄時に undefined をセットする等）に追従させる
  - 作問時、正解候補の入力・保存のタイミングで `normalizeTextAnswer` を適用し、自動変換を適用する
  - [Done] 作問エディタで全角英数字・半角カナの正解候補を入力した際、自動で正規化（半角英数・全角カナ）されて保存されること
  - _Requirements: 1.4, 3.3_
  - _Boundary: QuizEditor_
- [x] 2.3 クイズ保存前バリデーション (quiz-validation) の更新
  - `src/services/quiz-validation.ts` を更新し、設定された文字種ルールに正解候補が違反していないか、および文字数指定がある場合に一致しているかのチェックを追加する
  - [Done] カタカナモードでひらがなを入力した場合や、文字数指定があるのに異なる長さの正解を入力した場合に、保存ボタン押下時に適切なエラーメッセージが表示され保存が抑止されること
  - _Requirements: 3.4_
  - _Boundary: QuizValidation_
  - _Depends: 2.2_

### 3. Core - Play: クイズ回答画面の改修と解答判定の統合
- [ ] 3. Core - Play: クイズ回答画面の改修と解答判定の統合
- [ ] 3.1 `getTextInputFieldProps` の更新と解答画面への適用
  - `text-answer-utils.ts` の `getTextInputFieldProps` を更新し、数字モードなら `inputMode="decimal"`、文字数指定ありなら `maxLength` やプレースホルダーでの案内文を動的に生成する
  - 実際のプレイ画面 (`quiz-play-client.tsx`)、テストプレイ画面 (`test-play-client.tsx`)、復習画面 (`review-client.tsx`) の `<input>` 要素に、生成された props を正しく渡す
  - [Done] 実際のクイズプレイ画面において、数字モードでテンキー用のキーボードが開き、文字数指定時にその文字数までしか入力できず、プレースホルダーが「〇文字で入力...」になること
  - _Requirements: 4.1, 4.2, 4.3_
  - _Boundary: TextAnswerUtils, PlayFlowUI_
  - _Depends: 1.2_
- [ ] 3.2 回答判定 (isTextInputAnswerCorrect) の解答画面への適用
  - 実際のプレイ時および復習時の解答判定フック (`usePlayState.ts`) や判定ロジックが、Foundationで実装した `isTextInputAnswerCorrect` を用いるように連動を確認する
  - [Done] プレイ画面で全角英数字・半角カナ・空白混じりの正解を入力した際、自動正規化により「正解」と判定されること
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - _Boundary: PlayState_
  - _Depends: 1.2, 3.1_

### 4. Validation: 結合・E2E検証
- [ ] 4. Validation: 結合・E2E検証
- [ ] 4.1 全体ビルドおよび既存テストの回帰検証
  - ローカルで `npm run build` および `npm run test` を実行し、全モジュールのコンパイルが成功し、既存のテスト（Jestの全テスト）にデグレードがないことを確認する
  - [Done] ビルドおよびテストがオールクリアされること
  - _Requirements: 3.4, 4.1_
  - _Boundary: TestSuite_
  - _Depends: 2.3, 3.2_
- [ ] 4.2 Playwright による E2E テストの検証
  - Playwright テストを起動し、作問画面での記述式問題の作成、およびプレイ画面での記述式回答プロセスが意図通りに動作することを検証する
  - [Done] 関連する記述式クイズのテストがパスし、全体的なリグレッションがないこと
  - _Requirements: 3.4, 4.1, 4.2_
  - _Boundary: E2ETest_
  - _Depends: 4.1_
