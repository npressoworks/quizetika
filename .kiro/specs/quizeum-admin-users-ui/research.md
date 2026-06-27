# Research & Design Decisions: quizetika-admin-users-ui

## Summary
- **Feature**: quizetika-admin-users-ui
- **Discovery Scope**: Extension & Complex Integration
- **Key Findings**:
  - 管理者専用の `/admin/users` 画面から、特定のUIDを指定してユーザーの信頼スコアとティアーを手動でリセット、およびアカウントの停止（BAN/UNBAN）を行う仕組み。
  - 監査ログとして `adminLogs` コレクションを新設し、実行者・対象者・アクションタイプ（`reset`, `ban`, `unban`）・理由・日時を記録。
  - BANされたユーザーのアクセスを即時かつ多重防衛で遮断するため、Firestore Security Rules、フロントエンド `AuthContext` での監視による強制ログアウト、Next.js ミドルウェアによる `/banned` 画面への強制リダイレクトを組み合わせる。
  - BANされたユーザーが過去に作成したクイズやデータは物理削除や非公開化せず、そのまま残す仕様とする。

## Research Log

### 1. 管理者アクションの監査ログ (adminLogs) の永続化設計
- **Context**: 管理者の緊急手動リセットやBAN/UNBANが実行されたことを後から追跡可能にする必要性。
- **Sources Consulted**: Firebase Firestore Documentation (Transactions, Subcollections)
- **Findings**:
  - `adminLogs` をトップレベルコレクションとして新設し、各アクションログをフラットに格納するのが集計・監査上最も適している。
  - Security Rules により、クライアントからの書き込み（`create/update/delete`）を完全に `false` に制限し、サーバーサイド（Firebase Admin SDK）からの特権書き込みのみを受け入れる設計にする。
- **Implications**: 
  - `AdminLog` のデータモデル型を `types/index.ts` に追加。
  - `firestore.rules` で `adminLogs` へのクライアント直接書き込みを遮断。

### 2. サーバーサイド認可ガードと多重防衛
- **Context**: クライアントサイドでのモックトークン改ざんや管理者ロールの偽装による特権昇格の防止。
- **Sources Consulted**: Next.js API Routes Middleware, Firebase Admin Authentication
- **Findings**:
  - クライアント側で `moderationTier` や `role` をチェックするだけでなく、Next.js API Route Handler（`/api/admin/users/reset` / `/api/admin/users/ban` など）で Firebase Auth ID Token の JWT を検証し、その UID を用いて Firestore（`users/{uid}`）から最新の権限を再度取得し判定（多重防衛）する必要がある。
- **Implications**: 各管理者用APIエンドポイント内での JWT トークン検証と、実行者である管理者の最新情報の引き直しを必須要件とする。

### 3. BANユーザーの即時アクセス遮断とセキュリティルールの設計
- **Context**: BANされたユーザーが有効なJWTトークンを持っている期間（最大1時間）に、APIやFirestoreに対して不正な書き込みを行うことを完全に防止する。
- **Sources Consulted**: Firebase Security Rules Client Checking, Next.js Middleware Cookie Synchronization
- **Findings**:
  - **Firestoreセキュリティルールによるデータ保護**: ほぼすべての書き込みルールに `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isBanned != true` のチェックを導入することで、トークンが有効であってもFirestoreへの新規書き込み・更新を即座にブロックできる。
  - **フロントエンドとミドルウェアの連携**: `AuthContext` における `onAuthStateChanged` や `refreshUser` で取得したユーザー情報で `isBanned === true` を検知した際、直ちに `auth.signOut()` を実行し、クッキーの `quizetika_banned` を `true` に同期する。`middleware.ts` では `quizetika_banned === 'true'` の場合にアクセスを `/banned` に強制リダイレクトする。
- **Implications**:
  - `firestore.rules` の共通ヘルパー関数 `isNotBanned()` を追加し、各リソースルールに適用。
  - `auth-context.tsx` および `middleware-auth-cookies.ts` のCookie同期ロジックに `isBanned` 対応を追加。

## Architecture Pattern Evaluation

| Option                   | Description                                                                                | Strengths                                                                      | Risks / Limitations                     | Notes                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------- |
| API Route + Core Service | UIがNext.js API Routeを呼び出し、内部で `ReputationService` のトランザクションをキックする | セキュリティがサーバー境界で完全に保護され、フロントエンドとの疎結合が保たれる | API Routeのボイラープレートコードが必要 | プロジェクトの既存のAPI/Service構成と一致 |

## Design Decisions

### Decision: adminLogs コレクションのクライアント書込遮断
- **Context**: 監査ログの改ざんを防ぐ。
- **Selected Approach**: `firestore.rules` 上で `adminLogs` に対する `create/update/delete` を完全に `if false` とし、サーバーサイド API から特権 Admin SDK を用いて書き込みを行う。
- **Rationale**: 監査ログはセキュリティ上、フロントエンドクライアントから一切書き換えられてはならないため。
- **Trade-offs**: テスト時もクライアントSDKから直接ダミーログを作れないが、モックサービスまたはAdmin SDKテストコードで検証可能。

### Decision: BAN検知時の即時ログアウトと /banned 画面へのリダイレクト
- **Context**: BANされたユーザーにアカウント停止状態であることを明確に伝え、それ以上の操作を不可能にする。
- **Selected Approach**: `AuthContext` 内で `dbUser.isBanned === true` を検知した際、直ちに `signOut` を行い、セッションCookie `quizetika_banned: "true"` をセットした上で `/banned` 画面へルーティングする。
- **Rationale**: クライアント側で安全にログアウトさせ、ミドルウェアが検知して保護することで、他のいかなる画面への遷移も遮断するため。
- **Trade-offs**: `/banned` 画面自体は未認証状態でも閲覧可能にする必要があるため、ミドルウェアの matcher から `/banned` を除外し、非BANユーザーが直接アクセスした場合は `/` へリダイレクトするガードを `/banned/page.tsx` 内に実装する。

## Risks & Mitigations
- 管理者権限の偽装による不正アクション — Next.js API Route Handlerで管理者トークンを再検証し、Firestoreから最新の権限を引き直すことで偽装を遮断。
- 存在しないUIDの処理試行 — `users/{targetUid}` の存在チェックをトランザクション内で行い、見つからない場合はエラーをスローしてロールバックする。
- トークン有効期間中のBANユーザーの書き込み試行 — `firestore.rules` のセキュリティルールに `isNotBanned()` チェックを適用し、APIおよびFirestoreのデータストアレベルで書き込み・変更を完全遮断。

## References
- [Firestore Security Rules](https://firebase.google.com/docs/rules) — 監査ログおよびBANユーザーのデータ書き込み保護方針
- [Firebase Admin JWT Verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens) — IDトークンの認証
