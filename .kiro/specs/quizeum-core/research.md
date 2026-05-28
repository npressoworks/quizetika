# Research & Design Decisions

## Summary
- **Feature**: `quizeum-core`
- **Discovery Scope**: Extension
- **Key Findings**:
  - FirestoreのNoSQL特性とN+1問題に対応するため、投稿（クイズ、クイズリスト等）に作成者の名前とアバター情報を非正規化して冗長保持する。
  - アカウント削除（退会）時にAuthを即時物理削除し、関連データ（クイズ、リスト、指摘、通知、リアクション）を非同期タスクキュー（Cloud Tasks）により分割実行（Chunked Execution）で安全に匿名化クレンジングする設計を採用する。
  - 水平思考クイズのAI判定（Gemini API）において、APIキーの保護およびプロンプト汚染を防ぐためセキュアなサーバーサイドAPI（Next.js API Route）を経由し、同一セッション内での「完全一致質問のキャッシュ」と「1日20回制限」を実装してトークン消費を最小化する。

## Research Log

### ユーザー退会時の大規模データクレンジング
- **Context**: ユーザーがアカウントを削除した際、そのユーザーが作成した大量のコンテンツ（クイズ、リスト等）を即座に同期的にクレンジングしようとすると、Firestoreのアトミックバッチ処理上限（500件）を超過してタイムアウトやトランザクション失敗が発生するリスクがある。
- **Sources Consulted**: Firebase Admin SDK ユーザー削除ベストプラクティス、Firestoreのバッチ分割処理パターン、Cloud Tasksによる非同期タスクキュー実装。
- **Findings**:
  - Firebase Authentication のアカウント物理削除は即時に実行可能。これにより同じメールアドレスでの再登録が可能になる。
  - 残されたFirestoreドキュメントの更新・クレンジング処理は、非同期で Cloud Tasks から呼び出される Cloud Functions で分割実行（Chunked Execution）することで、レート制限を回避できる。
- **Implications**: 退会処理を「即時Auth物理削除＆Cloud Tasksジョブ登録（同期）」と「Cloud Functionsによる分割匿名化＆アバター画像削除（非同期）」の2層アーキテクチャに分離する。

### 水平思考クイズ（ウミガメのスープ）AI自動判定の最適化
- **Context**: 水平思考クイズでは、自由入力の質問に対してAI（Gemini等）が「はい」「いいえ」等の判定を行うが、悪意あるプロンプト注入や、同じ質問を繰り返すことによるAPIトークンの無駄な消費、1日のAPI利用コスト急増が課題となる。
- **Sources Consulted**: Google Gemini API ドキュメント、セキュアなサーバーサイドプロキシパターン、文字列キャッシュ戦略。
- **Findings**:
  - AI APIの呼び出しは、APIキーを隠蔽するために必ずサーバーサイドAPIルートを経由してセキュアに呼び出す。
  - 会話履歴を毎回送信せず「1問題の裏設定＋現在の質問」のみを送信する「ステートレス一問一答」にすることで、トークン消費を抑え判定のブレを防ぐ。
  - セッション内の過去の質問（`aiQuestionsHistory`）と「文字列が完全一致」する場合は、AIを呼び出さずにキャッシュされた過去 of 回答を即座に返す。
- **Implications**: ターン制限（無料ユーザー1日20回、有料プラン無制限）および同一質問キャッシュを組み込んだサーバーサイドAPIルートを設計する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| クライアント直書き込み | クライアントSDKから直接Firestoreを更新 | 開発スピードが極めて速く、サーバーレス | セキュリティ監査が困難、不正なカウンター書き換えやNGワード回避が容易 | セキュリティ要件（チート防止、NGワード二重検証）を満たせないため不採用。 |
| ハイブリッド (推奨) | 参照はクライアントSDK、更新はFirestore Security RulesおよびサーバーAPI | クエリ速度（NoSQL参照）を最大化しつつ、重要なロジック（更新、退会、AI判定）をサーバーサイドで保護 | 設計とルールの厳格な二重管理が必要 | 本プロジェクトのコア要件（高速表示、チート防止、セキュリティ、AI連携）に完全に合致するため採用。 |

## Design Decisions

### Decision: 退会時非同期分割匿名化クレンジング
- **Context**: F-106 のアカウント削除において、退会体験（即時再登録可能）と、Firestoreデータの不整合防止（アトミック制限回避）を両立する。
- **Alternatives Considered**:
  1. クライアント側から再帰的にすべて削除 ➔ Security Rules が複雑になり、途中で切断された場合に破損データが残るため却下。
  2. クイズデータもすべて物理削除 ➔ 他のユーザーがプレイ中の Attempt 履歴やクイズリストの整合性が崩れるため却下。
- **Selected Approach**: Authを即時削除し、Firestoreの `deleteStatus` を `'delete_pending'` にしてアクセス制限をかけた上で、Cloud Tasksで分割実行し、クイズ/リストの `authorId` を `"deleted_user"`、`authorName` を `"退会済みユーザー"` に匿名化して存続させ、最後にプロフィールドキュメントを物理削除する。
- **Rationale**: ユーザーは即座に同じメールアドレスで再登録でき、プラットフォーム内の優良コンテンツは安全に存続するため。
- **Trade-offs**: 非同期の過渡状態（`delete_pending`）が存在するため、画面側で一時的なガードやフォールバック（「退会済みユーザー」としての擬似表示）が必要になる。
- **Follow-up**: Cloud Functions トリガーによるエラー発生時のリトライ上限（5回）と、失敗時の `'failed'` ステータス監視アラートを定義する。

## Risks & Mitigations
- **不適切なコンテンツのすり抜けリスク** ➔ 画面側での一時チェックに加え、Firestore保存時のトリガーとなる Cloud Functions トランザクション内でサーバーサイドNGワード二重検証を強制実行し、検知時は強制保留（`suspended`）化する。
- **Firestore N+1 クエリによる表示遅延** ➔ クイズやクイズリストドキュメント側に、作成者の `authorName` や `authorAvatar` を非正規化して冗長保持し、プロフィール更新時に同期処理を走らせる。

## References
- [Firestore Security Rules best practices](https://firebase.google.com/docs/firestore/security/best-practices)
- [Cloud Tasks integration with Firebase](https://firebase.google.com/docs/functions/task-queue-events)
