# Research & Design Decisions: quizetika-auth-profile-ui

## Summary
- **Feature**: quizetika-auth-profile-ui（Phase 5: 本人プレイ履歴 / Phase 8: 作成リスト listType 表示 / Phase 23: リアクション履歴導線削除 / **Phase 29: マイページ表記・ダッシュボードリンク・プレイ履歴露出ガード**）
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

# Phase 29: マイページ表記変更、ダッシュボードリンク追加、およびプレイ履歴表示ガード（2026-06-28）

## 1. 調査と分析のサマリー
- **機能**: プロフィール（サイドバー）の「マイページ」への表記変更、アバタードロップダウンへの「ダッシュボード」リンク追加、他ユーザーのプロフィールでのプレイ履歴露出防止ガードの強化。
- **実装アプローチ**:
  - `sidebar.tsx` 内の `menuItems` 定義でラベルを「マイページ」に変更する。
  - `sidebar.tsx` のアバタークリック時および `header.tsx` のアバタークリック時に表示される `DropdownMenuContent` の中に `Link` でダッシュボードへのリンクを追加。
  - `profile-client.tsx` の `<TabsContent value="history">` が `isMyProfile` が `false` の場合に描画されないよう、論理積演算子（`isMyProfile && (...)`）によるガードを徹底。

## 2. 設計上の決定とトレードオフ
- **決定: プレイ履歴タブの完全なレンダリング抑止**
  - **Rationale**: 現在のコードでは、タブ（`TabsTrigger`）こそ `isMyProfile` で隠されているが、タブコンテンツ（`TabsContent`）は他人のプロフィール表示時でもDOM上にレンダリングされてしまい、自分自身の履歴が表示されてしまう構造になっていた。これを防ぐため、タブコンテンツそのものを `isMyProfile && (...)` でガードし、他人のプロフィールを開いたときには完全にマウントされないようにする。

## 3. リスクと緩和策
- **テストの破損リスク**: メニュー文言を「プロフィール」から「マイページ」に変更することで、既存の `sidebar.test.tsx` のアサーションが失敗する。
  - **緩和策**: `sidebar.test.tsx` 内の「プロフィール」を含むテストケース（ラベル検証、ツールチップ検証）の期待値を「マイページ」に書き換える。
- **ドロップダウンメニューの配置バランス**: PCとモバイルでそれぞれドロップダウンに項目を追加する際、順番が不整合にならないよう揃える。
  - **緩和策**: 両ドロップダウンで「管理者メニュー」「カスタムクイズ」「ダッシュボード」「マイページ」「設定」「ログアウト」の論理的順序になるよう調整する。


