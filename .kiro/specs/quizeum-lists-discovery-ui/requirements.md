# Requirements Document

## Introduction
Quizetika ユーザーは、クイズリスト・問題リストをブックマークやプロフィール以外からも発見・確認したいが、現状は `/list/[id]` の個別詳細とプロフィール内タブのみで、**グローバルなリスト探索画面がない**。また自分の非公開リストを一覧で確認する導線も弱い。
本スペックでは `/lists` ルートにリスト探索ページを新設し、キーワード検索と「公開リスト / 非公開リスト（本人のみ）」のタブ切り替えにより、リスト詳細（`/list/[id]`）へ到達できる導線を提供する。

**Phase 26（2026-06-10）**: `quizetika-core` Phase 26 によるリスト機能完全廃止に伴い、**本スペック全体を obsolete（廃止）** とする。Phase 23 で実装完了していた `/lists` 探索 UI は削除対象となり、以下の要件 1〜6 はすべて **キャンセル済み（履歴参照のみ）** とする。正本は `quizetika-core` / `quizetika-play-flow-ui` Phase 26。

## Boundary Context
- **In scope**:
  - `/lists` ページ（サーバー/クライアント構成）、ページタイトル・説明文
  - キーワード検索入力（デバウンス付き）と結果の絞り込み表示
  - 「公開リスト」「非公開リスト（自分のみ）」タブ切り替え
  - リスト種別バッジ（クイズリスト / 問題リスト）、カード一覧、空状態
  - ローディング・エラー表示、E2E テスト
  - リスト新規作成へのリンク（既存 `/list/create` への導線のみ）
- **Out of scope**:
  - リストの新規作成・編集・並び替えフロー（`quizetika-creator-dash-ui` / 既存 `/list/create`・`/list/[id]/edit`）
  - ブックマーク一覧（既存 `/bookmarks`）
  - カスタムクイズ（`quizetika-my-quiz-ui`）
  - ソート・ページングの高度化（初版は固定件数 limit）
  - 他人の非公開リスト閲覧
  - Sidebar / BottomNav への「リスト」メニュー項目追加（`quizetika-sidebar-layout` が担当）
- **Adjacent expectations**:
  - リスト検索データ取得 API `searchLists` は `quizetika-core` が提供すること（引数: `visibility`, `keyword`, `authorId?`, `limit`）
  - ログイン状態は既存 `useAuth` から取得すること
  - Sidebar から `/lists` へのナビリンクおよびアクティブ状態表示は `quizetika-sidebar-layout` が `/lists` ルート確定後に実装すること
  - 画面遷移ドキュメント（`docs/screen_transition.md`）への `/lists` 追記は Phase 23 の直接実装候補が担当

## Requirements

### Requirement 1: リスト探索ページの基本表示 — **Phase 26 で全体廃止**
**Objective:** As a ユーザー, I want 専用のリスト探索ページにアクセスできること, so that ブックマークやプロフィール以外からもリストを一覧できる。

#### Acceptance Criteria
1. When ユーザーが `/lists` にアクセスしたとき, the Lists Discovery Page shall ページタイトル「リスト」と説明文を日本語で表示する。
2. The Lists Discovery Page shall `data-testid="lists-page-container"` をルートコンテナに付与する。
3. While データ取得中であるとき, the Lists Discovery Page shall スケルトンまたはローディング表示を表示する。
4. The Lists Discovery Page shall リスト作成画面（`/list/create`）へのリンクまたはボタンを提供する（新規作成フロー自体は本要件の範囲外）。

### Requirement 2: 公開/非公開タブによる表示切り替え — **Phase 26 で全体廃止**
**Objective:** As a ユーザー, I want 公開リストと自分の非公開リストをタブで切り替えられること, so that 目的に応じたリスト集合を素早く閲覧できる。

#### Acceptance Criteria
1. The Lists Discovery Page shall 「公開リスト」と「非公開リスト」の2タブを表示する。
2. When ユーザーが「公開リスト」タブを選択したとき, the Lists Discovery Page shall `isPublished === true` のリストのみを一覧表示する。
3. When ログインユーザーが「非公開リスト」タブを選択したとき, the Lists Discovery Page shall 当該ユーザー本人の `isPublished === false` のリストのみを一覧表示する。
4. If ユーザーが未ログイン状態で「非公開リスト」タブへ切り替えようとしたとき, the Lists Discovery Page shall ログイン画面（`/login?redirect=/lists`）へ誘導するか、非公開タブの内容を表示せずログインを促すメッセージを表示する。
5. The Lists Discovery Page shall 公開タブに `data-testid="lists-tab-public"`、非公開タブに `data-testid="lists-tab-private"` を付与する。
6. The Lists Discovery Page shall 他人の非公開リストを一覧に含めてはならない。

### Requirement 3: キーワード検索 — **Phase 26 で全体廃止**
**Objective:** As a ユーザー, I want リストタイトルや説明でキーワード検索できること, so that 目的のリストを素早く見つけられる。

#### Acceptance Criteria
1. The Lists Discovery Page shall キーワード入力用の検索バーをページ上部（タブ近傍）に表示する。
2. When ユーザーが検索キーワードを入力したとき, the Lists Discovery Page shall 入力完了後に短い待機時間（デバウンス）を経て、現在選択中のタブのリスト結果をキーワードで絞り込む。
3. When 検索キーワードが空であるとき, the Lists Discovery Page shall 現在のタブ条件に合致する全件（取得上限内）を表示する。
4. The Lists Discovery Page shall 検索入力に `data-testid="lists-search-input"` を付与する。
5. The Lists Discovery Page shall キーワード一致判定をリストのタイトルおよび説明文に対して行う（大文字小文字の差異は同一とみなす）。

### Requirement 4: リストカード一覧と詳細への導線 — **Phase 26 で全体廃止**
**Objective:** As a ユーザー, I want 一覧上でリスト種別や概要を確認し詳細へ遷移できること, so that 興味のあるリストをプレイまたは編集できる。

#### Acceptance Criteria
1. When 検索結果にリストが1件以上含まれるとき, the Lists Discovery Page shall カード形式のグリッドまたはリストで各項目を表示する。
2. The Lists Discovery Page shall 各カードにリスト種別バッジ（「クイズリスト」または「問題リスト」）を表示する。
3. The Lists Discovery Page shall 各カードにタイトル、説明（存在する場合）、収録件数の概要を表示する。
4. When ユーザーがリストカードをクリックしたとき, the Lists Discovery Page shall 当該リストの詳細ページ（`/list/[id]`）へ遷移する。
5. The Lists Discovery Page shall 各カードに `data-testid="lists-discovery-card"` を付与する。

### Requirement 5: 空状態・エラー表示 — **Phase 26 で全体廃止**
**Objective:** As a ユーザー, I want 結果が0件または取得失敗時に状況が分かること, so that 次に取るべき行動（検索条件変更・リスト作成・再試行）を判断できる。

#### Acceptance Criteria
1. When 現在のタブおよび検索条件に合致するリストが0件であるとき, the Lists Discovery Page shall 日本語の空状態メッセージを表示する。
2. When 公開タブで結果が0件であるとき, the Lists Discovery Page shall リスト作成（`/list/create`）への導線を空状態内に含めてもよい。
3. If リスト取得中にエラーが発生したとき, the Lists Discovery Page shall エラーメッセージと再試行操作（再読み込みボタン等）を表示する。
4. The Lists Discovery Page shall 空状態コンテナに `data-testid="lists-empty-state"` を付与する。

### Requirement 6: データ取得契約（Core 依存） — **Phase 26 で全体廃止**
**Objective:** As a 開発者, I want 一覧データ取得が Core の統一 API 経由であること, so that 公開/非公開のクエリ条件とキーワード絞り込みが一貫する。

#### Acceptance Criteria
1. When Lists Discovery Page がリスト一覧を取得するとき, the Lists Discovery Page shall `quizetika-core` の `searchLists` API を呼び出す。
2. When 「公開リスト」タブが選択されているとき, the Lists Discovery Page shall `searchLists` に `visibility: 'public'` を渡す。
3. When ログインユーザーが「非公開リスト」タブを選択しているとき, the Lists Discovery Page shall `searchLists` に `visibility: 'private'` および `authorId`（ログインユーザー ID）を渡す。
4. When キーワード検索が有効なとき, the Lists Discovery Page shall `searchLists` に `keyword` 引数を渡す。
5. The Lists Discovery Page shall 初版では取得件数上限（`limit`）を固定値で指定する（ページング UI は本要件の範囲外）。

---

## Phase 26: スペック全体の廃止（2026-06-10）

**Phase 26（2026-06-10）**: リスト機能完全廃止に伴い、本スペック（`quizetika-lists-discovery-ui`）の **全要件をキャンセル** する。

### 要件 7: スペック全体の obsolete 化（Phase 26）
**Objective:** As a プロジェクトメンバー, I want リスト探索 UI スペックを obsolete と明示すること, so that 廃止済み機能の新規実装・改修が行われない。

#### Acceptance Criteria
1. The [Lists Discovery UI] shall [要件 1〜6 のすべてを **obsolete（キャンセル済み）** として扱い、新規実装の根拠として引用してはならない]。
2. When [Phase 26 以降にリスト探索 UI が必要と判断された場合], the [Lists Discovery UI] shall [本スペックを復活させず、新規スペックまたはプロダクト判断を経由すること]。
3. The [Lists Discovery UI] shall [`/lists` ルート・`useListsSearch`・`searchLists` の削除を `quizetika-play-flow-ui` / `quizetika-core` Phase 26 に委譲すること]。
4. The [Lists Discovery UI] shall [spec.json に `obsolete: true` および `obsolete_reason` を設定すること]。
5. The [Lists Discovery UI] shall [design.md・tasks.md に obsolete 注記を残し、実装完了タスクは履歴として保持すること]。

**境界・隣接**
6. The [Lists Discovery UI] shall [`quizetika-ui-discovery` Phase 26 からリスト探索スコープが除外されていることと整合すること]。
7. The [Lists Discovery UI] shall [Sidebar「リスト」ナビ除去を `quizetika-sidebar-layout` Phase 26 に委譲すること]。
