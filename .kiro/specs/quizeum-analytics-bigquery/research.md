# ギャップ分析 (Gap Analysis) — quizetika-analytics-bigquery

## 1. 現状の調査 (Current State Investigation)

### ディレクトリレイアウトと主要ファイル
- **型定義**: [src/types/index.ts](file:///d:/quizetika/src/types/index.ts) に `Attempt` および `QuestionAnswerRecord` が定義されています。
- **データ保存サービス**: [src/services/attempt.ts](file:///d:/quizetika/src/services/attempt.ts) に `saveAttempt` トランザクション処理があり、スコア検証やチート防止のための二重検証が行われています。
- **セッションとオフライン同期**: [src/services/attempt-session.ts](file:///d:/quizetika/src/services/attempt-session.ts) にプレイ中進捗 `PlayProgressData` およびオフライン退避データ `PendingSyncAttempt` の定義があり、`localStorage` と連動しています。
- **状態管理フック**: [src/hooks/usePlayState.ts](file:///d:/quizetika/src/hooks/usePlayState.ts) がクイズプレイ画面の進行、解答決定、合計経過時間の計測ステートを管理しています。
- **ウミガメスープAPI**: [src/app/api/attempt/verify-truth/route.ts](file:///d:/quizetika/src/app/api/attempt/verify-truth/route.ts) および `give-up-lateral/route.ts` が AI 判定と結果の Firestore 保存を処理しています。

### 技術パターンとセキュリティルール
- `firestore.rules` の `attempts` コレクションルールは、送信された `userId` が認証ユーザー本人であることのみをチェックしており、スキーマに対する厳密なフィールド制限は設定されていないため、セキュリティルール側の変更なしで新フィールドの追加が可能です。
- クイズプレイ結果の BigQuery 連携には Firebase Extension `firestore-bigquery-export` を利用することが決定しています。

---

## 2. 要件と既存コードのギャップマップ (Requirement-to-Asset Map)

| 要件番号と要件名                                                    | 関連する既存コード・資産                                                                                                                                                                                                                                      | ギャップ状態 (Missing / Unknown / Constraint)                                                                                                                                                                     |
| :------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Requirement 1**: 問題解答詳細データのトラッキングと蓄積           | [usePlayState.ts](file:///d:/quizetika/src/hooks/usePlayState.ts)<br>[attempt.ts](file:///d:/quizetika/src/services/attempt.ts)<br>[types/index.ts](file:///d:/quizetika/src/types/index.ts)                                                                  | **Missing**: 設問ごとの解答開始・終了時間の測定、ヒント表示、回答変更有無の判定。<br>**Constraint**: `saveAttempt` 内での `questionAnswerDetails` の検証とアトミックな保存。                                      |
| **Requirement 2**: すべての問題形式に対する詳細情報の収集           | [usePlayState.ts](file:///d:/quizetika/src/hooks/usePlayState.ts)<br>[verify-truth/route.ts](file:///d:/quizetika/src/app/api/attempt/verify-truth/route.ts)<br>[give-up-lateral/route.ts](file:///d:/quizetika/src/app/api/attempt/give-up-lateral/route.ts) | **Missing**: 各設問形式（シャッフル、並べ替え、早押し、ウミガメ）特有の操作ログ取得ロジック。<br>**Missing**: ウミガメスープAPI側での `questionAnswerDetails` 生成・保存処理。                                    |
| **Requirement 3**: オフラインプレイ時のデータ永続化とオンライン同期 | [attempt-session.ts](file:///d:/quizetika/src/services/attempt-session.ts)<br>[quiz-play-client.tsx](file:///d:/quizetika/src/app/quiz/\[id\]/play/quiz-play-client.tsx)                                                                                      | **Missing**: `PlayProgressData` および `PendingSyncAttempt` インターフェースの型拡張とシリアライズ。<br>**Constraint**: オフライン時のローカルストレージ容量制限（設問数×詳細データでも数KB程度のため問題なし）。 |
| **Requirement 4**: BigQuery への自動データ同期と分析スキーマ        | *新規作成*                                                                                                                                                                                                                                                    | **Missing**: Firebase Extension の構成設定、BigQuery ビュー SQL、および既存データ移行手順書の整備。                                                                                                               |

---

## 3. 実装アプローチの検討 (Implementation Options)

### Option A: 既存の状態管理フックとサービスの拡張 (推奨)
既存の `usePlayState` フックに問題ごとのタイマーやイベントトラッキングロジックを統合し、`saveAttempt` およびオフライン同期サービス側でそれらを受け取って検証・保存します。
- **Trade-offs**:
  - ✅ **メリット**: 既存の進行ライフサイクルに完全に相乗りできるため、タイミングの不整合やデータ欠損のリスクが極めて低く、実装もシンプルになります。
  - ❌ **デメリット**: `usePlayState` フックのコード行数が増加し、状態管理の認知負荷がやや上がります。

### Option B: 分析専用トラッキングフックの新規分離
解答時間やクリックログなどのトラッキングのみを行う専用フック `usePlayAnalytics` を新規作成し、プレイ画面側で `usePlayState` と組み合わせて使用します。
- **Trade-offs**:
  - ✅ **メリット**: プレイの状態管理（進行）と分析（トラッキング）の関心が綺麗に分離され、既存フックのコード肥大化を防げます。
  - ❌ **デメリット**: インデックス進行や解答アクション（`recordAnswer`）のイベントを二重管理することになり、フック間の状態同期のずれによるデータ不整合や、オフライン同期時の結合処理が複雑化します。

---

## 4. 設計フェーズでの追加調査項目 (Research Needed)
1. **早押しクイズ (`quick-press`) でのタイムトラッキング**:
   問題文のストリーミング表示開始（または読み上げ開始）からユーザーが「早押しボタン」を押すまでの正確な経過秒数を、`usePlayState` 内でフックし、`QuestionAnswerDetail` に正しくマッピングする詳細シーケンス。
2. **既存データとの互換性と BigQuery ビュー設計**:
   既に保存されている過去の `attempts` ドキュメントには `questionAnswerDetails` フィールドが存在しないため、BigQuery の SQL ビュー側で `LEFT JOIN UNNEST` した際に過去データがエラーにならず、かつ適切にフォールバック表示できるようなクエリ構文の検証。

---

## 5. 実装の難易度とリスク (Complexity & Risk)

- **開発規模 (Effort)**: **M (3〜7日間)**
  - アプリケーション側の変更（状態のトラッキング、オフライン同期、バリデーション追加）と、インフラ側の設定（Firebase Extension、BigQuery スキーマ設計、移行手順整備）の両方にまたがって動作検証を行う必要があるため。
- **リスク (Risk)**: **Low**
  - 技術的には Firebase の既存パターン（Extension、Firestore）の延長線上であり、セキュリティルールやデータベース移行などの大きなアーキテクチャ変更は発生しません。 `usePlayState` 内のタイマー整合性をしっかりテストすることで安全に実装できます。
