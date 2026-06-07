# Research & Design Decisions: quizeum-auth-profile-ui

## Summary
- **Feature**: quizeum-auth-profile-ui（Phase 5: 本人プレイ履歴 / Phase 8: 作成リスト listType 表示）
- **Discovery Scope**: Extension（Light）
- **Key Findings**:
  - Phase 5（プレイ履歴）は `ProfilePlayHistoryPanel` + `play-history-client` で実装済み。
  - Phase 8 ギャップ: プロフィールリストタブが `quizIds.length` 固定表示。`bookmark-list-grid.tsx` に種別ラベル分岐の先行実装あり。
  - `getQuizListsByAuthor` は `listType` フィルタオプション対応済み（`quizeum-core` Phase 8）。プロフィールは初回ロードで全件取得済みのため、任意フィルタはクライアント絞り込みで十分。

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
- `.kiro/specs/quizeum-core/design.md` — `getQuizListsByAuthor`, `resolveListType`
- `.kiro/specs/quizeum-creator-dash-ui/design.md` — listType 作成フロー
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

