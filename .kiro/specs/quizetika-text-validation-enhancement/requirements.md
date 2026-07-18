# Requirements Document

## Introduction
記述式クイズにおいて、従来の「文字数指定」は他の入力モードと排他になっており、文字種と文字数の複合的な制限が不可能でした。また、全角・半角の英数字や半角カタカナの表記揺れによる解答不一致の誤判定が発生していました。

本スペックでは、文字数指定を排他的なモードから任意のオプションへと統合し、文字種（フリー、漢字、カタカナ、アルファベット、数字）の指定と、文字数の指定（ぴったり一致または指定なし）を自由に組み合わせることができるようにします。さらに、入力時と解答判定時に適切な自動半角・全角変換を行うことで、表記揺れによる解答の誤判定を防止します。

## Boundary Context
- **In scope**:
  - `TextInputMode` の新しい文字種への拡張（フリー、漢字、カタカナ、アルファベット、数字）。
  - すべての文字種で文字数指定（`textInputCharCount`）をオプション（任意）として有効にする処理。
  - 解答入力時および作問時の英数字の自動半角変換、半角カタカナから全角カタカナへの自動変換。
  - 作問エディタでの文字種・文字数指定の新しいUIおよび保存前バリデーションの更新。
  - 実際のプレイ画面、テストプレイ画面、復習画面等における、記述式回答時の入力制限（`maxLength`、`inputMode` の動的制御など）と判定処理。
  - 旧データ（`textInputMode` が `'text' | 'numeric' | 'char-count'`）の後方互換マッピング。
- **Out of scope**:
  - 選択式、並び替え、連想、水平思考など、記述式以外の問題タイプに対する検証仕様の変更。
  - 漢字辞書や常用漢字テーブルによる漢字の厳格な正当性検証（UnicodeのCJK統合漢字および々、〇等の文字範囲判定のみ）。

## Requirements

### Requirement 1: 記述式解答の正規化と自動変換 (Text Answer Normalization and Conversion)
**Objective:** As a player, I want my input answers to be normalized (half-width conversion for alphabets and numbers, full-width conversion for katakana) so that typo and full-width/half-width differences do not make my correct answer incorrect.

#### Acceptance Criteria
1. When プレイヤーが解答を入力したとき, the Validation Service shall 全角のアルファベット（Ａ-Ｚ、ａ-ｚ）および全角の数字（０-９）を対応する半角文字に自動変換する。
2. When プレイヤーが解答を入力したとき, the Validation Service shall 半角カタカナを全角カタカナに自動変換する。
3. The Validation Service shall 解答の前後にある空白（全角・半角）を除去し、解答内の不要な空白を無視して判定を行う。
4. When クリエイターが作問エディタで正解候補を追加・変更したとき, the Editor Service shall 同一の自動変換および空白除去ルールを適用した上でデータを保存する。

### Requirement 2: 文字種・文字数制限の検証 (Character Type and Length Validation)
**Objective:** As a creator, I want to restrict the character types and optionally set a fixed length for text answers so that I can create precise fill-in-the-blank questions.

#### Acceptance Criteria
1. Where textInputMode が 'kanji' に設定されている場合, the Validation Service shall 漢字（CJK統合漢字、々、〇等の繰り返し記号）のみで構成される解答を有効とする。
2. Where textInputMode が 'katakana' に設定されている場合, the Validation Service shall 全角カタカナ（長音記号「ー」を含む）のみで構成される解答を有効とする。
3. Where textInputMode が 'alphabet' に設定されている場合, the Validation Service shall 半角アルファベット（大文字・小文字、自動変換後）のみで構成される解答を有効とする。
4. Where textInputMode が 'numeric' に設定されている場合, the Validation Service shall 半角数字（小数点「.」、マイナス記号「-」を含み、自動変換後）としてパース可能な解答を有効とする。
5. Where textInputCharCount（要求文字数）が指定されている（1以上100以下の整数である）場合, the Validation Service shall 正規化後の解答文字数が要求文字数とぴったり一致することを正解の条件とする。
6. Where textInputCharCount が指定されていない（空欄または未定義である）場合, the Validation Service shall 解答文字数のチェックを行わない（任意の長さの解答を許容する）。

### Requirement 3: 作問エディタUIとバリデーション (Editor UI and Validation)
**Objective:** As a creator, I want to easily select character types and optionally configure character counts for text input questions so that I can author questions correctly.

#### Acceptance Criteria
1. The Editor UI shall 記述式問題の設定項目として、入力タイプに「フリー」、「漢字」、「カタカナ」、「アルファベット」、「数字」のいずれかを選択できるUI（トグルボタン等）を表示する。
2. The Editor UI shall 選択された文字種に関わらず、要求文字数を指定できる数値入力欄を表示する。
3. If 要求文字数の入力欄が空欄であるか、またはクリアされた場合, the Editor UI shall textInputCharCount を未設定（undefined または null）として処理する。
4. If クリエイターが設定した文字種・要求文字数に違反する正解候補をエディタで入力した場合, then the Editor UI shall バリデーションエラーメッセージを表示し、クイズの保存を抑止する。

### Requirement 4: 解答画面UIの最適化 (Player Input UI Adaptation)
**Objective:** As a player, I want the input field in the play screen to automatically adapt to the question's validation rules so that I can input answers smoothly.

#### Acceptance Criteria
1. Where textInputMode が 'numeric' に設定されている場合, the Player UI shall 入力フィールドの inputMode 属性を 'decimal' に設定する。
2. Where textInputCharCount が指定されている場合, the Player UI shall 入力フィールドの maxLength 属性に要求文字数を設定し、指定文字数を超える入力を抑止する。
3. Where textInputCharCount が指定されている場合, the Player UI shall プレースホルダーまたは入力フィールド周辺に、要求文字数での入力を促すメッセージ（例：「〇文字で入力してください」）を表示する。
