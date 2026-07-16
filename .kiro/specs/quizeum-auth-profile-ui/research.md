# Research & Design Decisions: quizetika-auth-profile-ui

## Summary
- **Feature**: quizetika-auth-profile-ui（Phase 5: 本人プレイ履歴 / Phase 8: 作成リスト listType 表示 / Phase 23: リアクション履歴導線削除 / **Phase 29: プロフィール表記・ダッシュボードリンク・プレイ履歴露出ガード**）
- **Discovery Scope**: Extension（Light）
- **Key Findings**:
  - Phase 5（プレイ履歴）は `ProfilePlayHistoryPanel` + `play-history-client` で実装済み。
  - Phase 8 ギャップ: プロフィールリストタブが `quizIds.length` 固定表示。`bookmark-list-grid.tsx` に種別ラベル分岐の先行実装あり。
  - `getQuizListsByAuthor` は `listType` フィルタオプション対応済み（`quizetika-core` Phase 8）。プロフィールは初回ロードで全件取得済みのため、任意フィルタはクライアント絞り込みで十分。

## Research Log

### プロフィールタブ構成（Phase 5）
- **Context**: ユーザー指定「履歴は専用タブに」。
- **Findings**: 既存2タブと同じ `tabsContainer` に第3ボタンを追加するのが最小差分。
- **Implications**: `ProfileContentTab` に `'history'` を追加。他人プロフィールではボタン非表示。
- **Status**: 実装済み。

### リストカード種別表示（Phase 8）
- **Context**: 要件 8 — クイズリストと問題リストの区別。
- **Findings**: `src/app/profile/[uid]/page.tsx` L417 が `list.quizIds?.length` のみ表示。`resolveListType` は `@/types` で後方互換定義済み。
- **Alternatives**: (A) ページ内インライン修正のみ (B) `ProfileListCard` + 純関数抽出。
- **Selected**: (B) — テスト容易性・`bookmark-list-grid` との文言統一・タスク境界明確化。
- **Implications**: `profile-list-display.ts` でラベルと件数ロジックを集約。

### フィルタ UI（要件 8.7 任意）
- **Alternatives**: フィルタ変更時に `getQuizListsByAuthor(uid, isMyProfile, { listType })` 再取得 / クライアント filter。
- **Selected**: クライアント filter（初版）— 既に全リストを `loadProfileData` で取得。Firestore インデックス追加不要。
- **Trade-offs**: リスト件数が極端に多い場合は将来サーバフィルタへ移行可能（Revalidation Trigger に記載済み）。

### 件数ラベル文言
- **Selected**: クイズリスト「収録クイズ: N 件」、問題リスト「収録問題: N 件」（現状「収録問題」から種別明示へ変更）。

## Design Decisions

### Decision: ProfileListsPanel 抽出
- **Rationale**: リストタブの JSX が肥大化。フィルタ state と空状態を1コンポーネントに閉じる。
- **Trade-offs**: `ProfilePage` から数十行移動 — 可読性向上。

### Decision: resolveListType を唯一の種別解決
- **Rationale**: core と play-flow / creator-dash で共有済み。プロフィールでも直参照 `list.listType` を避ける。

## Risks & Mitigations
- **レガシーリスト（listType 未設定）** — `resolveListType` → `quiz`、件数は `quizIds`（8.2 充足）。
- **空 questionIds の問題リスト** — 0 件表示で正しい（作成直後は creator-dash 側でアタッチ）。
- **フィルタとタブ件数表示** — タブラベル `(N)` は全件数固定とし、フィルタは一覧のみに適用（UX 混乱防止）。

## References
- `.kiro/specs/quizetika-core/design.md` — `getQuizListsByAuthor`, `resolveListType`
- `.kiro/specs/quizetika-creator-dash-ui/design.md` — listType 作成フロー
- `src/components/bookmark/bookmark-list-grid.tsx` — 種別ラベル先行パターン
- `src/app/profile/[uid]/page.tsx` — 現行リストタブ（ギャップ箇所）

---

# Gap Analysis: 認証・プロフィール等の非同期表示最適化（Phase 12 追記 — 2026-06-07）

## 1. 調査と分析のサマリー
- **機能**: ブックマーク一覧（`/bookmarks`）、通知（`/notifications`）、プロフィール（`/profile/[uid]`）、ログイン（`/login`）等の画面における、Next.jsのStreaming機能とSuspenseを活用した静的フレームの先行配信と非同期スケルトン表示。
- **実装アプローチ**:
  - `page.tsx` をサーバーコンポーネント（Server Component）として構成し、ヘッダー、戻るボタン、タブのガワ、コンテナのアウトラインなどをサーバーサイドで即時描画・配信。
  - Firebase 認証状態や Firestore の非同期フェッチ部分を個別の `<Suspense fallback={<Skeleton />}>` に分離。
  - `/bookmarks` や `/notifications` 等の認証必須画面について、マウント後のクライアントサイドでのチラつきを防ぐため、Middleware (`src/middleware.ts`) で Cookie ベースのサーバーサイド認証保護・即時リダイレクトを制御。

## 2. 設計上の決定とトレードオフ

### 決定: プロフィール詳細画面における Suspense の階層分離
- **Context**: プロフィール詳細には、アバターや自己紹介などの基本情報、および作成クイズ/リスト/履歴の各タブコンテンツが存在。
- **選択アプローチ**: 基本情報（アウター枠）を1つの Suspense 境界とし、各タブ内のコンテンツフェッチについてはタブのインラインレンダリングで個別の Suspense もしくは非同期ロードハンドラーを配置。
- **理由**: プロフィールの上半分（ユーザー情報）がすぐに表示されれば、下半分のタブのデータ取得が非同期であってもユーザーがストレスを感じにくく、ページのロード体感が向上するため。

### 決定: ログイン画面での Suspense 排除
- **Context**: ログイン画面（`/login`）の非同期表示。
- **選択アプローチ**: ログイン画面は認証状態の解決のみであり、外部 API の動的フェッチに依存しないため、Suspense は適用せず、静的フレームをそのまま即時レンダリングする。
- **理由**: 不要な遅延アニメーション（スケルトン）を排除し、サインインボタンを即座に操作可能にするため。

## 3. リスクと緩和策
- **リダイレクト時のレイアウトシフト**:
  - 認証チェックが遅れて一瞬だけ保護画面のスケルトンが見えた後にログイン画面へ遷移するリスク。
  - **緩和策**: Middleware で事前に Cookie をチェックしてリダイレクトさせることで、白紙や保護画面のスケルトンを一切挟まず、即時に `/login` を描画させる。
- **テスト自動化 (Playwright/Jest) への影響**:
  - 各非同期スケルトンに testid (`bookmarks-skeleton`, `notifications-skeleton`, `profile-skeleton`, `connections-skeleton`) を付与し、テストのロード待機処理を確実に行えるようにする。

---

# Phase 23: リアクション履歴導線削除（2026-06-09）

## Summary
- **Feature**: 本人プロフィールから「リアクション履歴」UI 導線の削除（要件 10）
- **Discovery Scope**: Extension（Minimal）— 単一コンポーネントの Link 削除
- **Key Findings**:
  - 導線は `profile-client.tsx` L250–257 の `isMyProfile` 分岐内 `Link` + `Heart` アイコンのみ。
  - `/profile/[uid]/likes` ルートと `LikesClient` はレガシー存続。改修不要。
  - E2E F-407（`e2e/social-features.spec.ts`）はプロフィール導線前提のため、直接実装候補 `remove-reaction-history-e2e` と連携して skip/削除。

## Research Log

### リアクション履歴導線の所在（Phase 23）
- **Context**: 要件 10 — 廃止機能への迷い込み防止。
- **Sources Consulted**: `src/app/profile/[uid]/profile-client.tsx` L240–272、`requirements.md` 要件 2.7 / 6 / 10。
- **Findings**: 本人 `profileActions` に「プロフィールの編集」と「リアクション履歴」の2ボタン。他ユーザーはフォローボタンのみ。likes ルートは `likes/page.tsx` + `likes-client.tsx` で独立存続。
- **Implications**: 最小差分は `Link` ブロック削除と `Heart` import 削除のみ。ルート・サービス層は触らない。
- **Status**: 設計確定。

### E2E F-407 との整合（Phase 23）
- **Context**: 要件 10.7、roadmap 直接実装候補 `remove-reaction-history-e2e`。
- **Findings**: F-407 は `/profile/test-user` から「リアクション|いいね」リンクをクリックし `/likes` へ遷移する流れ。導線削除後はリンク不可。
- **Selected**: E2E 更新は直接実装候補が担当。本スペック実装タスクでは F-407 整理を同一 PR または直後の follow-up で行う旨をタスク境界に明記。
- **Status**: 設計確定。

## Design Decisions

### Decision: 導線のみ削除、ルートはレガシー存続
- **Rationale**: 要件 10.4 — 即時 404 化は follow-up。直接 URL ブックマーク等への配慮と変更最小化。
- **Trade-offs**: likes 画面は discoverability なく残る — 意図的（廃止方向機能）。

### Decision: ProfileClient 単体変更に限定
- **Rationale**: 導線は1ファイル1箇所。`page.tsx`（RSC シェル）は `ProfileClient` 委譲のため変更不要。
- **Trade-offs**: 将来 likes ルート削除時は別フェーズで一括整理。

## Risks & Mitigations
- **F-407 E2E 失敗** — 導線削除と E2E skip/削除の実装順序をタスクで明示。直接実装候補と同一 Wave で実施推奨。
- **Heart import 未削除** — ESLint unused import で検出。実装時に import 整理を必須化。

## References
- `src/app/profile/[uid]/profile-client.tsx` — 削除対象導線
- `src/app/profile/[uid]/likes/likes-client.tsx` — レガシー（変更なし）
- `e2e/social-features.spec.ts` L262–286 — F-407
- `.kiro/steering/roadmap.md` — Direct Implementation Candidates

---

# Phase 27: 作成したクイズのページングと検索機能（2026-06-23）

## 1. 調査と分析のサマリー
- **機能**: プロフィール詳細（`/profile/[uid]`）の「作成したクイズ」タブにおいて、クイズ一覧のキーワード検索（タイトル、説明、ジャンル、タグ）およびページング（1ページあたり9件）のUIを追加する。
- **実装アプローチ**:
  - `profile-client.tsx` 内で、検索キーワード（`searchQuery`）と現在のページ番号（`currentPage`）の state を管理する。
  - クイズ取得API (`getQuizzesByAuthor`) で全件取得された `quizzes` 配列に対して、クライアントサイドで検索フィルタとページング処理を適用する（パフォーマンス影響は小さいため、Firestoreへの追加クエリは行わない）。
  - 「前へ」「次へ」ボタンおよびページ番号を並べたページングUIを自作し、Shadcn UIの `Button` コンポーネントでスタイリングする。
  - フィルタリングが空の際、ページングUIを非活性または非表示とし、検索時のページインデックスリセット処理を確実に実装する。

## 2. 設計上の決定とトレードオフ

### 決定: クライアントサイドでのフィルタリング＆ページング
- **Rationale**: プロフィール画面に表示される自作クイズ数は通常数十〜数百件程度であり、クライアント側で一括取得済みの配列に対して配列操作を行うだけで十分に高速に処理できる。追加のFirestoreインデックスの構成やAPIの改修コストを削減できるため、この方法を採用した。

### 決定: 1ページあたり9件の分割表示
- **Rationale**: クイズカードがグリッド（smで2列、lgで3列）で表示されるため、3の倍数である「9件」がレイアウトの崩れを防ぐのに最適である。

## 3. リスクと緩和策
- **検索時のページズレリスク**: 3ページ目を表示している時に検索を行い、該当クイズが数件しかなかった場合、空のページが表示されてしまうリスクがある。
  - **緩和策**: 検索キーワードが変更された際、自動的に `currentPage` を1ページ目にリセットする。
- **E2Eテスト用の testid 確保**: 要件で指定された `profile-quiz-search-input`、`profile-quiz-pagination`、`profile-quiz-card` を正しくアタッチし、E2Eテストでの要素探索を安定させる。

## 4. 参照 (References)
- `src/app/profile/[uid]/profile-client.tsx` — 変更対象コンポーネント

---

# Phase 28: 好きなジャンルの設定と表示（2026-06-27）

## 1. 調査と分析のサマリー
- **機能**: プロフィール編集（`/profile/edit`）で好きなジャンルを設定し、プロフィール詳細（`/profile/[uid]`）で設定したジャンルをチップ表示するUI要件の追加。
- **データ層**:
  - `User` ドキュメントの `followedGenres: string[]`（ジャンルIDの配列）を「好きなジャンル」の保存先として利用する。
  - プロフィール更新用APIである `updateProfile` メソッド（`src/services/user.ts`）は、すでに `followedGenres` の部分更新をサポートしている。
- **ジャンル一覧取得**:
  - 有効なジャンル一覧は、`@/hooks/useActiveGenres` フック（または `listActiveGenres` サービス）を用いて `metadata_genres` コレクションから動的に取得できる。

## 2. 設計上の決定とトレードオフ

### 決定: データ層の `followedGenres` を好きなジャンルとしてマッピング
- **Rationale**: 既にユーザーモデル内に `followedGenres`（フォロー中のジャンル名の配列）が存在し、DB設計ドキュメントでも「ユーザーがフォロー・関心のあるジャンル名の配列」として定義されている。新しく `favoriteGenres` フィールドを追加するのではなく、既存の `followedGenres` を「好きなジャンル」として再利用することで、スキーマ変更コストおよびマイグレーションの必要性を排除できる。

### 決定: プロフィール編集画面での複数選択UIの提供
- **Rationale**: ユーザーは複数のジャンルに関心があることが一般的であるため、チェックボックスや選択可能チップなどの複数選択UI（Multi-select）を提供する。
- **実装手法**: `ProfileEditClient` 内で `useActiveGenres` を用いて有効なジャンル一覧を読み込み、現在登録されているジャンルを初期チェック状態にする。チェック状態のトグルで選択状態を管理し、保存時に `updateProfile` へ送信する。

### 決定: プロフィール表示画面でのアイコン画像付きチップの表示
- **Rationale**: 単なるテキスト表示ではなく、ジャンルに設定されているアイコン画像（`iconImageUrl`）をチップ内に表示することで、プレミアム感のある美しいデザインを実現する。
- **実装手法**: `ProfileClient` 内で `useActiveGenres` を利用し、マスタデータの ID-表示名・アイコンのマッピングを解決して、対象ユーザーがフォロー中のジャンルをチップ表示する。

## 3. Risks & Mitigations
- **ジャンルマスタ読み込み中のUI表示**: マスタデータの読み込み中にUIが壊れたり、保存が完了する前に不整合が起きるリスクがある。
  - **緩和策**: 編集画面および詳細画面において、ジャンル一覧の取得中はローディング状態を適切にハンドリングし、マスタの取得が失敗した場合はログを出力してフォールバック表示（テキストのみのチップ等）を行う。
- **表示崩れリスク**: 好きなジャンルの数が多い場合、プロフィールカード内で表示が崩れたりあふれたりするリスクがある。
  - **緩和策**: チップの一覧は `flex-wrap` を用いて適切に折り返すレスポンシブレイアウトとし、スクロール/折り返しで綺麗に収まる Vanilla CSS を実装する。

## 4. 参照 (References)
- `src/services/user.ts` — `updateProfile`, `UpdateProfileData`
- `src/hooks/useActiveGenres.ts` — `useActiveGenres`
- `src/app/profile/edit/profile-edit-client.tsx` — 編集画面
- `src/app/profile/[uid]/profile-client.tsx` — 表示画面

---

# Phase 29: プロフィール表記変更、ダッシュボードリンク追加、およびプレイ履歴表示ガード（2026-06-28）

## 1. 調査と分析のサマリー
- **機能**: プロフィール（サイドバー）の「プロフィール」への表記変更、アバタードロップダウンへの「ダッシュボード」リンク追加、他ユーザーのプロフィールでのプレイ履歴露出防止ガードの強化。
- **実装アプローチ**:
  - `sidebar.tsx` 内の `menuItems` 定義でラベルを「プロフィール」に変更する。
  - `sidebar.tsx` のアバタークリック時および `header.tsx` のアバタークリック時に表示される `DropdownMenuContent` の中に `Link` でダッシュボードへのリンクを追加。
  - `profile-client.tsx` の `<TabsContent value="history">` が `isMyProfile` が `false` の場合に描画されないよう、論理積演算子（`isMyProfile && (...)`）によるガードを徹底。

## 2. 設計上の決定とトレードオフ
- **決定: プレイ履歴タブの完全なレンダリング抑止**
  - **Rationale**: 現在のコードでは、タブ（`TabsTrigger`）こそ `isMyProfile` で隠されているが、タブコンテンツ（`TabsContent`）は他人のプロフィール表示時でもDOM上にレンダリングされてしまい、自分自身の履歴が表示されてしまう構造になっていた。これを防ぐため、タブコンテンツそのものを `isMyProfile && (...)` でガードし、他人のプロフィールを開いたときには完全にマウントされないようにする。

## 3. リスクと緩和策
- **テストの破損リスク**: メニュー文言を「プロフィール」から「プロフィール」に変更することで、既存の `sidebar.test.tsx` のアサーションが失敗する。
  - **緩和策**: `sidebar.test.tsx` 内の「プロフィール」を含むテストケース（ラベル検証、ツールチップ検証）の期待値を「プロフィール」に書き換える。
- **ドロップダウンメニューの配置バランス**: PCとモバイルでそれぞれドロップダウンに項目を追加する際、順番が不整合にならないよう揃える。
  - **緩和策**: 両ドロップダウンで「管理者メニュー」「カスタムクイズ」「ダッシュボード」「プロフィール」「設定」「ログアウト」の論理的順序になるよう調整する。

---

# Phase 30: アバター画像変更とプロフィールタブ視認性向上（2026-07-14）

## Summary
- **Feature**: プロフィール編集画面からのアバター画像変更（要件16）、プロフィールコンテンツタブの視認性向上（要件17）
- **Discovery Scope**: Extension（Light）— 既存のクライアント直接アップロードパターンとタブコンポーネントを流用
- **Key Findings**:
  - `src/services/storage.ts` に `uploadQuizCover`（クイズカバー）と同型のクライアント直接アップロード関数が既に存在し、`getUserAvatarPath(uid, extension)` というアバター専用パスヘルパーも既に定義済み（未使用）。同パターンを `uploadUserAvatar` として追加すれば新規サーバーエンドポイントは不要。
  - `src/services/user.ts` の `mapUserToRow` は既に `user.avatarUrl` を `avatar_url` へマッピング済み。ギャップは `UpdateProfileData`（`updateProfile()` の入力型）に `avatarUrl` が未定義な点のみ。
  - `AuthContext` に `refreshUser()`（「プロフィール更新時などの手動リロード用」とコメント済み）が既に用意されており、ヘッダー/サイドバーのアバター即時反映に利用できる。
  - `components/ui/tabs.tsx`（`@base-ui/react/tabs` ラッパー）は12箇所で共有利用されている。プロフィールタブのみの視覚改善は共有コンポーネント本体ではなく `ProfileClient` 側の `className` 上書きで実現するのが安全。

## Research Log

### アバターアップロードの既存パターン
- **Context**: 要件16 — アバター画像変更の実装方式選定。
- **Sources Consulted**: `src/services/storage.ts`（`uploadImage`, `uploadQuizCover`, `getUserAvatarPath`）、`src/lib/genre-icon-upload.ts`、`src/components/quiz/quiz-editor.tsx`（`pendingThumbnailBlob` → `uploadQuizCover` パターン）、`src/app/admin/genres/admin-genres-client.tsx`（管理者専用の一時アップロードAPI経由パターン）。
- **Findings**: 管理者ジャンルアイコンは `/api/genres/upload-icon` を介した一時アップロード＋確定パターンだが、これは管理者権限チェックが必要な運用のため。クイズカバーは一般ユーザーが自身の所有物（クイズ）に対しクライアントから直接 Supabase Storage へアップロードする方式であり、アバター（ユーザー自身の所有物）はこちらのパターンにより近い。
- **Implications**: `uploadUserAvatar(file, uid)` を `uploadQuizCover` と同型で追加し、`users/{uid}/avatar_{timestamp}.{ext}` パスへ直接アップロードする。サーバーAPIルートの新規追加は不要。
- **Status**: 設計確定。

### `UpdateProfileData` への `avatarUrl` 追加箇所
- **Context**: アップロード後のURLをユーザーレコードへ永続化する経路の確認。
- **Findings**: `updateProfile(uid, data: UpdateProfileData)` は `displayName` / `bio` / `snsLinks` / `followedGenres` のみを `updates` に積んで `updateUserProfile` へ渡す。`mapUserToRow` 自体は `avatarUrl` 対応済みのため、`UpdateProfileData` 型と `updateProfile()` 関数本体に `avatarUrl` の受け渡しを追加するだけで済む。
- **Implications**: `src/services/user.ts` の変更は最小（型定義1行＋条件分岐1箇所）。
- **Status**: 設計確定。

### タブ視認性向上の適用範囲
- **Context**: 要件17 — 「もっとわかりやすいタブ」の具体化。
- **Findings**: `components/ui/tabs.tsx` は 12 ファイルから import されており、グローバル変更は他画面（admin, dashboard, search, notifications 等）に副作用を及ぼす。
- **Alternatives**: (A) 共有 `tabs.tsx` のデフォルトスタイルを強化する（全画面へ影響） (B) `ProfileClient` の `TabsList`/`TabsTrigger` にのみ `className` を追加する（プロフィール限定）。
- **Selected**: (B) — 要件17の範囲はプロフィール画面のみであり、他画面への意図しない見た目変更を避けるため。
- **Status**: 設計確定。

## Design Decisions

### Decision: アバター上限サイズは 5MB
- **Rationale**: 既存の類似アップロードはジャンルアイコン 2MB（小さな装飾画像）、クイズカバー 10MB（詳細画面の主要ビジュアル）。アバターは正方形の小〜中サイズ画像であり、両者の中間かつ許容範囲として 5MB を採用。
- **Trade-offs**: 将来的にモバイル回線での体感速度が問題になった場合、さらに引き下げる余地がある（Revalidation Trigger 対象外の軽微な調整のため設計変更は不要）。

### Decision: プレビューは保存確定まで非破壊
- **Rationale**: 要件16.2・16.7 — 保存前に誤って別画像を選んでも既存アバターに影響を与えないようにするため、`avatarFile` はローカル state のみで保持し、保存実行時にのみアップロード・永続化する。
- **Trade-offs**: 選択のたびにアップロードする即時反映方式に比べ実装はシンプルだが、保存を押すまでアップロードが行われないため保存操作自体に若干の待ち時間が生じる（許容範囲）。

### Decision: 旧アバター画像の物理削除は対象外
- **Rationale**: 要件定義の境界コンテキストで明示的に対象外としたとおり、`deleteImage`（`src/services/storage.ts`）を用いた旧画像削除は退会クレンジング等の別スペックと重複しうるため、本フェーズでは実施しない。
- **Trade-offs**: アバターを頻繁に変更するユーザーでは Storage 上に孤立画像が蓄積するが、機能上の実害はない（将来のクレンジング処理対象として Risks に記録）。

## Risks & Mitigations
- **アップロード成功・DB更新失敗の不整合** — Storage に孤立画像が残るが、`avatarUrl` は更新されないため表示上の実害はない。将来のクレンジング/ガベージコレクション処理の検討対象として記録。
- **Object URL のメモリリーク** — `URL.createObjectURL` の解放漏れ。実装時に `URL.revokeObjectURL` をアンマウント時・再選択時に呼ぶことを徹底する。
- **タブ視覚改善の他画面への波及** — 共有 `tabs.tsx` を変更しないことで回避済み。

## References
- `src/services/storage.ts` — `uploadQuizCover`, `getUserAvatarPath`, `deleteImage`
- `src/services/user.ts` — `UpdateProfileData`, `updateProfile`, `mapUserToRow`
- `src/context/auth-context.tsx` — `refreshUser`
- `src/lib/genre-icon-upload.ts` — 検証ロジックの参照パターン
- `src/components/ui/tabs.tsx` — 共有タブコンポーネント（12箇所で利用）

---

# Gap Analysis: Phase 31 — アバター画像の円形トリミング機能（2026-07-16）

## 1. 現状調査サマリ

### 既存資産（再利用可能）
| 資産 | パス | 現状の実装内容 |
|---|---|---|
| `ImageCropper` コンポーネント | `src/components/ui/image-cropper.tsx` | `react-easy-crop`（`^6.0.2`）ベース。`CROP_ASPECT = 1.91` が**モジュールレベル定数としてハードコード**されており、`aspect`・`cropShape` は現状 Props 化されていない。`calculateTargetDimensions(width, height, maxWidth=1920, maxHeight=1005)` も内部で `CROP_ASPECT` を直接参照して分岐しており、正方形（1:1）・512px上限への対応には引数拡張が必須。 |
| クロップ確定→Blob生成ロジック | 同上 `getCroppedImg()` | Canvas 2D APIで `pixelCrop` を切り出し、`calculateTargetDimensions` でリサイズ計算後に再描画、`canvas.toBlob(..., 'image/jpeg', 0.85)` でJPEG化。ロジック自体はアスペクト比非依存で流用可能。 |
| ズーム制御（`minZoom`初期化） | 同上 `onMediaLoaded` | コンテナ・メディアサイズから最小ズームを算出し「枠にぴったり収まる」制御を実現。要件18-3のロジックと同一パターン。既存ロジックはアスペクト比のみに依存し、正方形にもそのまま適用可能。 |
| アバター検証 | `src/lib/avatar-upload.ts` | `validateAvatarFile`/`assertAvatarFileValid`（PNG/JPEG/GIF、5MB上限）。クロップ前の選択時点のゲートとして流用可能、変更不要。 |
| アバターアップロード | `src/services/storage.ts` `uploadUserAvatar(file, uid)` (L87-105) | `assertAvatarFileValid` 通過後にそのまま Supabase Storage へアップロード。`File \| Blob` 対応済みのため、クロップ後のJPEG Blobを渡す形にすればそのまま利用可能（関数シグネチャ変更不要）。 |
| プロフィール編集フロー | `src/app/profile/edit/profile-edit-client.tsx` | `handleAvatarChange`(L72-89) は検証後に直接 `URL.createObjectURL` でプレビュー。`handleSubmit`(L159-187) は保存時に無条件で `uploadUserAvatar(avatarFile, ...)` を呼び出す。クロップモーダルを挟む改修が必要。 |
| クイズ側の呼び出しパターン参考 | `src/components/quiz/editor/quiz-metadata-section.tsx` (L17, L47, L78, L124, L228) | ファイル選択→`ImageCropper`表示→`onCropComplete`でBlobを親に伝播、というUIパターンの実例。profile側もほぼ同型の統合が可能。 |
| 既存テスト | `tests/components/image-cropper.test.tsx`（`calculateTargetDimensions`の純関数テストのみ）、`tests/lib/avatar-upload.test.ts`、`tests/components/profile-edit-client.test.tsx` | クロップ結果のE2E/RTLテストはまだ存在しない。`calculateTargetDimensions`のテストは1.91:1固定を前提にしているため、汎用化時に既存テストのシグネチャ互換性を壊さないよう注意。 |

### Requirement-to-Asset マップ（要件18）

| 要件18 AC | 対応資産 | ギャップ種別 |
|---|---|---|
| AC1: 選択時にトリミングモーダル表示（円形枠・ズーム・位置調整） | `ImageCropper` + `react-easy-crop`（`cropShape="round"` 標準サポート） | **Constraint**: `cropShape`未Props化 → 拡張が必要（Missing機能ではなくConstraint） |
| AC2: 正方形(1:1)領域への制約 | `CROP_ASPECT`定数のハードコード | **Missing**: `aspect` のProps化が必要 |
| AC3: 短辺フィットの最小ズーム初期化 | `onMediaLoaded`ロジック | 既存ロジックがアスペクト比非依存で動作 → **Constraint（軽微）**: `CROP_ASPECT`参照箇所をProps値に置換するのみ |
| AC4: 512px上限・JPEG変換 | `calculateTargetDimensions`のデフォルト引数(1920/1005) | **Missing**: 呼び出し側で`maxWidth=512, maxHeight=512`を渡せるようにする拡張が必要。関数内部の`CROP_ASPECT`比較ロジックがアスペクト比引数化されていないと1:1では不正確な分岐になりうる |
| AC5: キャンセル時に変更前維持 | `ImageCropper`の`onClose`、`profile-edit-client.tsx`の既存パターン | 既存パターンをそのまま踏襲可能 |
| AC6: 失敗時エラー表示 | `ImageCropper`内`handleConfirm`のcatch（現状`alert()`使用） | **Constraint**: クイズ側は`alert()`によるエラー表示。profile側の他エラー表示は`avatarError`ステート+インライン表示パターン。UIパターンの不一致があり、汎用化時にコールバック化（`onError`）等の設計判断が必要 |
| AC7: トリミング後画像のみアップロード対象 | `profile-edit-client.tsx`の`avatarFile`/`handleSubmit` | **Missing**: 現状`avatarFile: File`をそのまま保持する設計。クロップ後は`Blob`を保持する形へのstate型変更が必要（quiz側`pendingThumbnailBlob`と同型パターンあり） |
| AC8: testid付与 | 新規 | **Missing**: 新規追加のみ |

### 未知・要調査事項（Research Needed）
- **`ImageCropper`汎用化の後方互換性**: `calculateTargetDimensions`は`tests/components/image-cropper.test.tsx`で直接importされ1.91:1前提でテストされている。アスペクト比を引数化する場合、既存テストのシグネチャ（`calculateTargetDimensions(width, height, maxWidth, maxHeight)`）を壊さない形（例: 第5引数に`aspect`を追加、または別名の汎用関数を新設）を設計フェーズで確定する必要がある。
- **円形マスクの出力画像**: `cropShape="round"`はUI表示上のマスクのみで、実際に`canvas.toBlob`で書き出される画像データは常に**正方形**（角がある）。要件18-4は正方形切り出し+JPEG変換を明記済みだが、円形PNG透過切り出しを行わないことを設計書で改めて明示する必要がある。
- **エラー表示方式の統一**: クイズ側`ImageCropper`は`alert()`、profile編集画面は既存の`avatarError`インラインステートパターン。汎用化時にコールバックProps化（`onError?: (message: string) => void`）するか、`alert()`のまま許容するかは設計判断。

## 2. 実装アプローチの選択肢

### Option A: `ImageCropper` を汎用化して両ドメインで共有
**内容**: `image-cropper.tsx`に`aspect`・`cropShape`・`maxWidth`/`maxHeight`・`quality`をPropsとして追加し、デフォルト値を現行のOGP仕様(1.91/`rect`/1920/1005/0.85)に設定。quiz側は無変更で動作し続け、profile側は`aspect={1}` `cropShape="round"` `maxWidth={512}` `maxHeight={512}`を明示的に渡す。

- ✅ 単一の実装・テスト対象で保守性が高い。クイズ側の実績あるロジック（`minZoom`計算等）をそのまま享受できる。
- ✅ 新規ファイル最小限（`profile-edit-client.tsx`の改修 + `image-cropper.tsx`の拡張のみ）。
- ❌ `image-cropper.tsx`は`quizetika-quiz-image-upload`スペックの所有物（Boundary Commitments: "This Spec Owns"）。他specが同一ファイルを拡張するのは越境になるため、設計フェーズで所有権の再定義（共有UIプリミティブとして両spec間で合意された拡張、と明記するか）が必要。
- ❌ `calculateTargetDimensions`のテスト（1.91:1前提）に影響するため、シグネチャ変更時の後方互換確認が必要。

### Option B: profile専用の新規コンポーネントとして複製・特化
**内容**: `src/components/ui/avatar-cropper.tsx`（仮）を新規作成し、`react-easy-crop`を用いて円形・1:1専用のロジックを実装。`ImageCropper`のコードパターン（`getCroppedImg`, `onMediaLoaded`のズーム計算）を参考にしつつ、正方形・512px専用にシンプル化して複製。

- ✅ `quizeum-auth-profile-ui`のBoundary内で完結し、他specのファイルに触れない。設計・実装のindependenceが高い。
- ✅ クイズ側の将来変更（OGP比率変更等）による意図しない影響を受けない。
- ❌ Canvas切り抜き・リサイズロジックの重複（保守コスト増、将来的なバグ修正の二重対応リスク）。
- ❌ 「クイズサムネのアップロード同様のロジックで」という当初要望の趣旨（ロジック共有）からはやや外れる。

### Option C: ハイブリッド — 共通ロジックのみ抽出し、UIコンポーネントは分離
**内容**: `getCroppedImg`/`calculateTargetDimensions`相当の純粋なCanvas処理ロジックを`src/lib/image-crop.ts`（仮、汎用ヘルパー）に抽出し、アスペクト比・出力サイズを引数化。`ImageCropper`（quiz用）と新規のprofile用コンポーネントは、それぞれこの共通ヘルパーを呼び出しつつ、UIのProps・Dialog構成は独立させる。

- ✅ ロジックの重複を避けつつ、UIコンポーネントの所有権はspec境界を跨がない。
- ✅ 将来他ドメイン（ジャンルアイコン等）でクロップUIが必要になった場合の拡張性が高い。
- ❌ 新規ファイル（`src/lib/image-crop.ts`）が増え、既存`ImageCropper`のリファクタも伴うため実装ボリュームはOption A/Bの中間。
- ❌ `image-cropper.tsx`側のリファクタが必須になるため、`quizetika-quiz-image-upload`スペックとの調整（Revalidation Triggers該当）が発生する可能性がある。

## 3. 実装複雑度とリスク

- **Effort**: **S〜M（2〜4日）** — 既存パターン（`react-easy-crop`、Canvas処理、遅延Blob管理）が確立済みで新規技術導入は不要。主な作業はProps拡張・呼び出し側の状態管理変更・テスト追加。
- **Risk**: **Low〜Medium**
  - Low要因: 使用ライブラリ（`react-easy-crop`）は`package.json`に既存導入済みで`cropShape="round"`は標準サポート。Canvas APIによる正方形切り出しは技術的に自明。
  - Medium要因: `image-cropper.tsx`の所有権がspec境界を跨ぐ可能性（Option A選択時）、および既存の`calculateTargetDimensions`テストとの後方互換確保が必要な点。

## 4. 設計フェーズへの推奨事項

- **推奨アプローチ**: **Option A（`ImageCropper`汎用化）**を軸に、design.mdの Boundary Commitments で `image-cropper.tsx` の所有権を「共有UIプリミティブとして両spec間で合意された拡張」と明記する（quiz側の既存契約・デフォルト値を破壊しないことをRevalidation Triggersとして明示）。Option C（ロジック抽出）は、将来的な再利用箇所が増えるまでは過剰設計と判断し見送り候補とする。
- **設計時に確定すべき事項**:
  1. `calculateTargetDimensions`のシグネチャ拡張方法（アスペクト比引数追加 vs オーバーロード）と既存テストへの影響
  2. クロップ結果画像の出力形式（正方形JPEG + CSS円形表示の継続、円形PNG透過切り出しは行わない、の明記）
  3. エラー表示方式の統一（`alert()` vs コールバックProps化）
  4. `avatarFile: File`ステートを`Blob`ベースに変更する際の型・命名（quiz側`pendingThumbnailBlob`との命名整合）
- **Research Needed（設計フェーズで解消）**: 上記「未知・要調査事項」3点。

## Design Synthesis（設計フェーズで確定・2026-07-16）

- **Generalization**: `ImageCropper` の「アスペクト比固定のトリミングモーダル」という能力を一般化し、`aspect`/`cropShape`/`maxWidth`/`maxHeight`/`quality`/`onError`/`confirmTestId`/`cancelTestId` をPropsとして抽出した。クイズ用途（1.91:1・矩形）はデフォルト値として無変更のまま残り、profile用途（1:1・円形）は明示的なProps指定で対応する。将来別ドメイン（ジャンルアイコン等）で同様のクロップUIが必要になった場合も、同じPropsの枠組みで拡張可能。
- **Build vs Adopt**: 円形クロップUIは新規ライブラリを導入せず、既存導入済み `react-easy-crop`（`^6.0.2`）の標準機能 `cropShape="round"` を採用した（Adopt）。Canvas切り抜き・リサイズロジックも既存の `getCroppedImg`/`calculateTargetDimensions` をパラメータ化して再利用し、新規実装は行わない。
- **Simplification**: Gap分析で提示したOption C（共通ロジックを`src/lib/`へ抽出する案）は、現時点で再利用箇所がquiz/profileの2箇所に留まるため見送り、Option A（`ImageCropper`直接汎用化）を採用した。エラー表示も新規UIパターンを増やさず、既存の`avatarError`インライン表示（profile）と`alert()`（quiz、無変更）をそれぞれ`onError`コールバックの有無で切り替えるだけに留めた。

## 確定した設計判断（Decision Log）

### Decision: `ImageCropper` をProps拡張で汎用化（Option A採用）
- **Rationale**: ロジック重複を避けつつ実装ボリュームを最小化できる。既存Propsにすべてデフォルト値を設定することでクイズ側の呼び出しを無変更のまま維持できる。
- **Trade-offs**: `image-cropper.tsx` の所有権が `quizetika-quiz-image-upload` と `quizeum-auth-profile-ui` の2spec間で共有される。design.mdのRevalidation TriggersにProps契約変更を明記して緩和。

### Decision: クロップ結果は正方形JPEG（円形PNG透過切り出しは行わない）
- **Rationale**: `cropShape="round"`はUI表示上のマスクに過ぎず、実データの円形切り抜きにはCanvas上でのクリッピングパス処理が別途必要になり複雑化する。既存のアバター表示は`rounded-full object-cover`のCSSで円形に見せているため、正方形JPEGのままで要件を満たせる。
- **Trade-offs**: 将来的に円形以外の背景（非正方形コンテナ等）にアバターを配置する場合はCSS側で改めて対応が必要になるが、現状のアバター表示要件では発生しない。

### Decision: `avatarFile: File` を `avatarCroppedBlob: Blob` に置換
- **Rationale**: 要件18-7（トリミング後画像のみをアップロード対象とする）を型レベルで保証する。quiz側の`pendingThumbnailBlob`と命名思想を揃えた。
- **Trade-offs**: なし（Phase 30時点の型を置き換えるのみで、他箇所からの参照はない）。

