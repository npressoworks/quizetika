# Requirements Document

## Project Description (Input)

Quizetika のクリエイターは、クイズ作成・編集（`/quiz/create`, `/quiz/[id]/edit`）およびリスト作成・編集（`/list/create`, `/list/[id]/edit`）のエディタ UI を利用している。現状、クイズエディタ（約 2,000 LOC）とリストエディタは CSS Modules ベースの高密度フォーム、@dnd-kit による並べ替え、Markdown プレビュー等を含む最も複雑な UI 領域であり、Phase 24 の shadcn/ui + Tailwind 刷新方針と整合しない。

本スペック（`quizetika-ui-editor`）は、`quizetika-ui-foundation` と `quizetika-ui-layout-shell` が提供する shadcn 標準テーマと共通プリミティブの上に、クイズエディタ・リストエディタ・関連サブコンポーネント（ソート、Markdown、添付パネル）を再構築する。問題 CRUD、DnD 並べ替え、ジャンル/タグ選択、Markdown 入力、問題添付検索、バリデーション表示、下書き保存/公開/テストプレイ/リスト保存フローは維持する。Firestore 保存ロジック、Core バリデーション lib、AI 生成 API、プレイ/結果 UI は範囲外とする。

## Introduction

Quizetika は Next.js 16 + React 19 のクイズ SNS である。Phase 24 UI 刷新では strangler パターンによりドメイン単位で CSS Modules を Tailwind + shadcn に置換する。エディタは Phase 24 の `quizetika-ui-editor` スライスとして、`quiz-editor.tsx`、`quiz-list-editor.tsx`、`question-list-attach-panel.tsx` および関連ルート・サブコンポーネントを対象とする。

本スペックは foundation（Tailwind、shadcn テーマ、`cn()`、初期プリミティブ）と layout-shell（シェル内ページ描画）に依存する。移行完了時にエディタ関連 E2E（`quiz-creation.spec.ts`、`quiz-list.spec.ts`、`phase8.spec.ts` 等）および Jest テストがグリーンであることを要求する。ビジュアル方向は shadcn 標準寄せ（neutral/zinc デフォルト、glass/neon 非再現）とする。

**Phase 26（2026-06-10）**: リスト機能廃止に伴い、本スペックの対象を **クイズエディタのみ** に縮小します。`/list/*` ルートおよびリストエディタ UI は除去し、Phase 24 で完了したクイズエディタ shadcn 移行は維持します（要件 4・5 廃止、要件 26 参照）。

## Boundary Context

- **In scope**:
  - `QuizEditor` / `QuizListEditor` / `QuestionListAttachPanel` の shadcn + Tailwind 再実装
  - エディタ関連サブコンポーネント（`SortableSortingList`, Markdown 系, `GenreEditorSelect`, `ListTypeSelector`, エディタスケルトン等）
  - クイズ 8 形式・8 問題タイプの編集 UI、参照問題リンク UI の見た目移行
  - @dnd-kit による sorting 問題の DnD 並べ替え、リスト側 HTML5 DnD 並べ替えの挙動維持
  - バリデーションエラー表示、スクロール-to-エラー、下書き/公開/テストプレイ/リスト保存/エクスポートの UI フロー維持
  - 既存 `data-testid` の維持
  - エディタ関連 `.module.css` の削除
  - エディタ関連 E2E・Jest 回帰確認
- **Out of scope**:
  - Firestore 保存・更新ロジック（`@/services/quiz`, `@/services/quiz-list`, `@/services/question`）
  - バリデーション lib（`@/services/quiz-validation` 等）のロジック変更
  - AI 生成 API（verify-truth 等）
  - プレイ/結果/復習 UI（`quizetika-ui-quiz-lifecycle`）
  - クリエイターダッシュボード本体（`quizetika-ui-admin-creator`）
  - `variables.css` の完全削除（`css-modules-cleanup` 候補）
- **Adjacent expectations**:
  - `quizetika-ui-foundation` は Tailwind、shadcn テーマ、`cn()`、Button/Input/Card/Dialog/Tabs 等の初期プリミティブを提供済みであること
  - `quizetika-ui-layout-shell` はシェル内でエディタルートを描画する前提を維持すること
  - `quizetika-my-quiz-ui` と question pool lib を共有するが、本スペックはエディタ UI のスタイル移行のみを担当する
  - `useQuestionAttachSearch` 等の検索 hook のロジックは変更せず、添付パネルの UI のみ移行する

## Requirements

### Requirement 1: クイズエディタのメタデータと形式選択 UI
**Objective:** As a クリエイター, I want クイズの基本情報と形式を既存と同じ項目で編集できること, so that UI 刷新後も作問フローを継続できる。

#### Acceptance Criteria
1. The Quiz Editor shall タイトル、説明、サムネイル URL、難易度、ジャンル、タグの入力フィールドを提供する。
2. The Quiz Editor shall 8 種のクイズ形式（multiple-choice, true-false, text-input, quick-press, sorting, association, lateral-thinking, mixed）を選択できる UI を維持する。
3. When ユーザーが mixed 形式を選択したとき, the Quiz Editor shall 各問題ごとに問題タイプを切り替え可能にする。
4. The Quiz Editor shall ジャンル選択をプルダウンから検索バーに変更し、入力フィールドに `data-testid="genre-editor-search-input"` を、全体を囲むラッパー要素に `data-testid="genre-editor-select-wrap"` を付与する。
5. The Quiz Editor shall 説明・問題文・解説・正解テキスト等の自動伸長テキスト領域に既存の `auto-grow-*` 系 `data-testid` を維持する。
6. While エディタがデータ読込中であるとき, the Quiz Editor shall `data-testid="quiz-editor-skeleton"` のスケルトン表示を行う。
7. When ユーザーがジャンル検索バーに文字を入力したとき, the Quiz Editor shall 入力値に部分一致するジャンルの候補リストをドロップダウンで表示し、リスト要素に `data-testid="genre-editor-search-dropdown"` を、各候補に `data-testid="genre-editor-search-option-{genreId}"` を付与する。
8. When ユーザーが候補を選択したとき, the Quiz Editor shall そのジャンルを選択状態にし、検索バーに入力値として選択したジャンルの `displayName` を表示する。
9. When ジャンル検索バーにフォーカスしたとき, the Quiz Editor shall 登録されているすべてのジャンルを候補リストとしてドロップダウンに表示する。
10. If ユーザーが入力した文字列に一致するジャンルが存在しないとき, the Quiz Editor shall ドロップダウンに「一致するジャンルがありません」というメッセージを表示する。
11. When 保存済みのクイズのジャンルがマスタに存在しないとき, the Quiz Editor shall その未登録ジャンル名を検索バーの初期値として表示し、警告メッセージ等で識別可能にする。

### Requirement 2: クイズ問題 CRUD と sorting 問題の DnD 並べ替え
**Objective:** As a クリエイター, I want 問題の追加・編集・削除・並べ替えが既存と同様に操作できること, so that 多様な問題形式のクイズを作成できる。

#### Acceptance Criteria
1. The Quiz Editor shall 問題の追加、複製、削除、および問題カード単位の編集 UI を提供する。
2. The Quiz Editor shall multiple-choice, true-false, text-input, quick-press, sorting, association, lateral-thinking の各問題タイプに対応する入力 UI を維持する。
3. When sorting タイプの問題を編集するとき, the Quiz Editor shall @dnd-kit ベースのドラッグ&ドロップで選択肢の並べ替えを可能にする。
4. While sorting 問題で DnD 操作中であるとき, the Sortable List Component shall 8px 以上のポインター移動でドラッグが開始される既存センサー契約を維持する。
5. When 参照問題（reference link）が添付されているとき, the Quiz Editor shall 読み取り専用表示と COW デタッチ通知（`cow-detach-notice`, `detach-reference-{id}`）を維持する。
6. The Quiz Editor shall 参照問題パネルに既存の `data-testid`（`author-quiz-reference-panel`, `reference-search-keyword`, `link-reference-{id}` 等）を維持する。
7. When ユーザーが問題を追加または削除したとき, the Quiz Editor shall 問題カードに `#question-card-{idx}` のアンカー ID を維持する。

### Requirement 3: Markdown 入力とプレビュー
**Objective:** As a クリエイター, I want 問題文等で Markdown を入力しリアルタイムプレビューできること, so that リッチな問題文を作成できる。

#### Acceptance Criteria
1. Where 問題文フィールドが Markdown 対応である, the Quiz Editor shall Markdown 入力ヒントを表示する。
2. When ユーザーが Markdown テキストを入力したとき, the Markdown Preview Component shall サニタイズ済み HTML プレビューをリアルタイム表示する。
3. The Markdown Content Component shall 既存の `parseMarkdownToHtml` / サニタイズ契約を変更せず、表示スタイルのみ shadcn 標準に移行する。
4. When ライト/ダークテーマが切り替わったとき, the Markdown Preview Component shall 十分なコントラストでプレビューを表示する。

### Requirement 4: リストエディタ UI — **Phase 26 で全体廃止**
**Objective:** As a クリエイター, I want クイズリストまたは問題リストを作成・編集できること, so that キュレーションコンテンツを公開できる。

#### Acceptance Criteria
1. ~~The List Editor shall タイトル、説明、カバー画像 URL、公開トグル、リストタイプ（クイズリスト/問題リスト）の入力 UI を提供する。~~ **廃止**
2. ~~The List Editor shall リストタイプ選択に `data-testid="list-type-selector"`, `list-type-quiz`, `list-type-question` を維持する。~~ **廃止**
3. ~~When クイズリストタイプが選択されているとき, the List Editor shall クイズ検索・添付・HTML5 DnD による並べ替え UI を提供する。~~ **廃止**
4. ~~When 問題リストタイプが選択されているとき, the List Editor shall 問題添付パネルを表示する。~~ **廃止**
5. ~~When 新規問題リストを保存し listId が未確定であるとき, the List Editor shall 保存後に編集ルートへリダイレクトする既存フローを維持する。~~ **廃止**
6. ~~The List Editor shall リスト保存・JSON エクスポートのアクションボタンを提供する。~~ **廃止**
7. ~~While エディタがデータ読込中であるとき, the List Editor shall `data-testid="list-editor-skeleton"` のスケルトン表示を行う。~~ **廃止**

### Requirement 5: 問題リスト添付パネル — **Phase 26 で全体廃止**
**Objective:** As a クリエイター, I want 公開済み・ブックマーク・公開探索から問題を検索してリストに添付できること, so that 問題リストを効率的に構築できる。

#### Acceptance Criteria
1. ~~The Question Attach Panel shall `data-testid="question-list-attach-panel"` をルート要素に維持する。~~ **廃止**
2. ~~When listId が未確定であるとき, the Question Attach Panel shall 添付操作を無効化し `question-attach-disabled-hint` を表示する。~~ **廃止**
3. ~~The Question Attach Panel shall 3 タブ（own-published, bookmarked, public-explore）による問題検索 UI を提供し、各タブに `question-attach-tab-{name}` を維持する。~~ **廃止**
4. ~~The Question Attach Panel shall キーワード検索に `question-attach-keyword` を維持する。~~ **廃止**
5. ~~When ユーザーが問題を添付または解除したとき, the Question Attach Panel shall `attach-question-{id}` / `attached-question-{id}` の `data-testid` を維持する。~~ **廃止**
6. ~~When 添付済み問題が存在するとき, the Question Attach Panel shall HTML5 DnD による並べ替え UI を提供する。~~ **廃止**

### Requirement 6: バリデーション表示と保存・公開フロー
**Objective:** As a クリエイター, I want 入力エラーが分かりやすく表示され、下書き保存・公開・テストプレイが既存どおり動作すること, so that 安全にクイズを公開できる。

#### Acceptance Criteria
1. When 下書き保存時に必須項目（タイトル、ジャンル等）が未入力であるとき, the Quiz Editor shall フィールド単位のバリデーションメッセージを表示する。
2. When 公開時にバリデーション lib がエラーを返したとき, the Quiz Editor shall エラー一覧を表示し、最初のエラー位置（`#field-title`, `#field-genre`, `#question-card-{idx}` 等）へスクロールする。
3. When 下書き保存が成功したとき, the Quiz Editor shall 既存の成功通知と `/creator/dashboard` への遷移フローを維持する。
4. When 公開が成功したとき, the Quiz Editor shall `/quiz/{id}/success` への遷移フローを維持する。
5. When ユーザーがテストプレイを実行したとき, the Quiz Editor shall テストプレイ用ペイロード保存と `/quiz/test-play/play` への遷移フローを維持する。
6. ~~When リスト保存時にタイトルが未入力であるとき, the List Editor shall クライアント側バリデーションエラーを表示する。~~ **Phase 26 廃止**
7. ~~When リスト保存が成功したとき, the List Editor shall 既存の成功通知と遷移（新規問題リスト時は編集ルート）フローを維持する。~~ **Phase 26 廃止**
8. The Quiz Editor shall 保存/公開/下書き/エクスポートボタンの `data-analytics` 属性を既存配置から削除しない。

### Requirement 7: shadcn 標準ビジュアルとテーマ対応
**Objective:** As a クリエイター, I want エディタ UI が shadcn 標準のクリーンな見た目でライト/ダーク両方で視認できること, so that Phase 24 UI 刷新の一貫性を体感できる。

#### Acceptance Criteria
1. The Editor UI shall 旧 Quizetika ビジュアル（glass-card、ネオン色クラス、旧 create/edit CSS Modules スタイル）をエディタコンポーネントで使用しない。
2. When ライトモードが適用されているとき, the Editor UI shall shadcn 標準ライトパレットでフォーム・カード・ボタンを表示する。
3. When ダークモードが適用されているとき, the Editor UI shall shadcn 標準ダークパレットでフォーム・カード・ボタンを表示する。
4. Where バリデーションエラーが表示される, the Editor UI shall ライト/ダークいずれでも十分なコントラストでエラー状態を識別できる。
5. The Editor UI shall フォームサーフェスに shadcn 標準の Card、border、Input/Textarea/Select 等を用いる。

### Requirement 8: レガシースタイル削除と回帰テスト
**Objective:** As a 開発者, I want エディタ関連 CSS Modules が削除され DOM 契約が維持されること, so that 後続スライスが Tailwind 正の基盤の上に実装できる。

#### Acceptance Criteria
1. When 本スペックの実装が完了したとき, the Editor UI shall クイズエディタ関連の `create.module.css`, `sortable-sorting-list.module.css`, `markdown.module.css`, `editor-skeleton.module.css` を削除する（`edit.module.css`・`list-skeleton.module.css` はリストエディタ廃止に伴いコンポーネントごと削除）。
2. The Editor UI shall 既存ルート（`/quiz/create`, `/quiz/[id]/edit`）と `quiz-editor-loader` のデータ取得契約を変更しない。
3. ~~When 本スペックの実装がマージされたとき, the Editor UI shall `e2e/quiz-creation.spec.ts` と `e2e/quiz-list.spec.ts` がグリーンである。~~ **Phase 26 改定**: `e2e/quiz-list.spec.ts` は削除。`e2e/quiz-creation.spec.ts`・`e2e/phase8.spec.ts`（クイズ部分）・`e2e/creator-streaming-skeleton.spec.ts`（クイズ部分）がグリーンであること。
4. When 本スペックの実装がマージされたとき, the Editor UI shall `e2e/phase8.spec.ts` および `e2e/creator-streaming-skeleton.spec.ts` がグリーンである。
5. When 本スペックの実装がマージされたとき, the Editor UI shall `npm run build` と `npm run lint` が新規エラーなく成功する。
6. The Editor UI shall Firestore サービス層・バリデーション lib の公開 API を変更しない。
7. When ジャンル選択UIがプルダウンから検索バーに変更されたとき, the Editor UI shall 各 E2E テスト（`e2e/*.spec.ts`）およびコンポーネントテストのジャンル選択操作を検索バーの仕様に合わせて修正する。

---

## Phase 26 境界コンテキスト（改定）

- **対象範囲（In scope）**:
  - Phase 24 完了済みの `QuizEditor` およびクイズエディタ関連サブコンポーネントの維持
  - リストエディタ関連コンポーネント・ルート・import の除去確認
  - エディタ関連 E2E・Jest からリスト作成・編集シナリオの除去
  - クイズエディタ回帰（下書き保存・公開・テストプレイ・参照問題・8 形式）
- **対象外（Out of scope）**:
  - リストエディタ UI の shadcn 移行（**Phase 26 でスコープ外**）
  - リスト探索・ブックマークリスト・リストプレイ UI（`quizetika-play-flow-ui`）
  - クリエイターダッシュボード CTA 除去（`quizetika-creator-dash-ui`）
  - Firestore `quiz-list` サービス削除（`quizetika-core`）
- **隣接システムへの期待（Phase 26）**:
  - `quizetika-play-flow-ui` 28.1 により `/list/*` ルートと `components/quiz-list` が削除済みであること
  - `quizetika-core` 23.6 によりリスト関連 API が存在しない前提
  - `/quiz/create`・`/quiz/[id]/edit` および `quiz-editor-loader` のデータ取得契約は変更しない

### Requirement 26: リストエディタ UI 移行スコープの除去（Phase 26）
**Objective:** As a 開発者, I want Phase 24 エディタ移行スペックからリストエディタを除外し、関連成果物をクリーンアップすること, so that クイズエディタ移行のみが正本として維持される。

#### Acceptance Criteria
1. When Phase 26 が完了したとき, the Editor UI shall `src/components/quiz-list/` 配下のコンポーネント（`quiz-list-editor.tsx`, `question-list-attach-panel.tsx`, `list-skeleton.tsx`, `list-type-selector.tsx` 等）がコードベースに存在しないこと。
2. When Phase 26 が完了したとき, the Editor UI shall `src/app/list/` 配下のルート（`/list/create`, `/list/[id]/edit`）が存在せず、当該 URL が 404 を返すこと。
3. When Phase 26 が完了したとき, the Editor UI shall クイズエディタ関連コンポーネントから `@/services/quiz-list`・`list-editor-classes`・`question-list-attach` 等の import が残っていないこと。
4. When Phase 26 が完了したとき, the Editor UI shall リストエディタ専用 Jest テスト（`list-type-selector.test.tsx`, `question-list-attach-panel.test.tsx` 等）が除去されていること。
5. When Phase 26 が完了したとき, the Editor UI shall `e2e/quiz-list.spec.ts` および E2E 内のリスト作成・編集・`list-editor-skeleton` シナリオが除去されていること。
6. The Editor UI shall `/quiz/create`・`/quiz/[id]/edit` のクイズエディタ shadcn + Tailwind 移行成果（Phase 24）を維持し、下書き保存・公開・テストプレイ・8 形式・参照問題 UI が回帰なく動作すること。
7. The Editor UI shall `quiz-list-skeleton.tsx`（クリエイターダッシュボード用クイズ一覧スケルトン）をリスト機能と混同せず維持すること。

## Phase 31: 複合形式における許容問題形式の拡張 (2026-07)

### Requirement 31: 複合形式における「連想」問題タイプトグルの追加

#### Acceptance Criteria
1. When ユーザーが複合形式（mixed）を選択したとき, the Quiz Editor shall 各問題カードの問題タイプトグル（typeToggle）に「連想」ボタンを表示し、クリック時に「連想」形式へ切り替え可能にする。
2. When クイズ全体の出題形式が mixed に変更されたとき, the Quiz Editor shall 既存の「連想」問題を含めて強制変換せず維持し、「早押し」および「ウミガメのスープ」問題のみをデフォルト形式（multiple-choice）に変換する。
3. The Quiz Editor shall 複合形式の説明文（getFormatDescription）において、「連想」も組み合わせ可能であることを説明に含める。
