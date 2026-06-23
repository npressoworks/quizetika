# Implementation Plan

- [x] 1. Foundation: カーソル仕様の拡張
  - `QuizFeedTabKind` 型定義に `'author'` を追加する
  - `orderFieldForTabKind` 関数に `'author'` を追加し、ソート順として `'createdAt'` を返すようにする
  - `'author'` カーソルを用いたエンコードおよびデコード処理が正常に動作するかのユニットテストを追加する
  - ユニットテスト `npm run test` が全件通過すること
  - _Requirements: 2.1, 2.2_
  - _Boundary: quiz-feed-cursor_

- [x] 2. Core: データロードAPIと共通スクロールローダーコンポーネントの実装
- [x] 2.1 (P) 作者クイズ段階取得サービス関数の実装
  - `getQuizzesByAuthorPage` を `src/services/quiz.ts` に実装する
  - `authorId`、`limit`、`cursor`、`includeUnpublished` をオプションとして受け取る
  - 指定された作者のクイズを `createdAt` 降順でロードし、指定 limit 件数と次ページ用カーソルを持つ `PaginatedQuizResult` 形式を返す
  - 本人の場合は下書きを含む全ステータス、他人の場合は公開のみを取得するクエリ制限を適用する
  - `getQuizzesByAuthorPage` のシグネチャおよび戻り値の型定義が TypeScript コンパイルを通過すること
  - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - _Boundary: quiz-service_

- [x] 2.2 (P) 共通ハイブリッド無限スクロールローダーコンポーネントの構築
  - `InfiniteScrollLoader` コンポーネントを `src/components/ui/infinite-scroll-loader.tsx` に新設する
  - 内部ステートとして `isInfinite` (無限スクロール有効フラグ) を持ち、初期状態は `false` とする
  - 初期状態（`isInfinite === false`）の時は「もっと見る」ボタンをレンダリングし、クリック時に `onLoadMore()` を呼び出して自動無限スクロールモード（`isInfinite = true`）に移行する
  - `isInfinite === true` の時は、スクロール交差監視（`useIntersectionLoadMore`）を有効にし、交差時に自動で `onLoadMore()` をトリガーする
  - `hasMore` が `false` の時はボタンやセンチネルを非表示にする
  - Storybook等またはコンポーネント単体で「もっと見る」ボタン表示からスクロール監視への遷移が動作すること
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Boundary: UI Components_

- [/] 3. Integration: 各画面への統合とインライン広告挿入
- [x] 3.1 検索画面へのハイブリッド無限スクロール統合
  - `src/app/search/search-client.tsx` を修正し、従来の自動無限スクロール監視 `loadMoreSentinelRef` の直接埋め込みを廃止する
  - 検索一覧 of クイズの最下部に `InfiniteScrollLoader` コンポーネントを組み込み、ロード中プレースホルダー（`GridSkeleton`）を統合する
  - 検索画面を開いた時、最初はスクロールしても自動ロードされず、「もっと見る」ボタンをクリックした後に自動スクロールロードされることをブラウザで確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Depends: 2.2_
  - _Boundary: search-client_

- [ ] 3.2 プロフィール画面用クイズパネルコンポーネントの実装と統合
  - プロフィール画面用のクイズ表示パネル `ProfileQuizzesPanel` を `src/components/profile/profile-quizzes-panel.tsx` に新設する
  - `searchQuery`（検索語）が空の時は `getQuizzesByAuthorPage` による段階取得と `InfiniteScrollLoader` によるハイブリッドスクロールを行う
  - `searchQuery` が入力された時は `getQuizzesByAuthor` を使って一括取得（最大200件）し、メモリ上でフィルタした分を20件ずつ切り出して表示する
  - `showAds` が `true` の場合、クイズ配列の10件ごとに `<AdsenseInlineAd>` をreduce関数等でインライン挿入し、追加ロード時に広告位置を再計算する
  - `profile-client.tsx` から従来のクイズロード処理やメモリページングを削除し、この `ProfileQuizzesPanel` を配置する
  - プロフィール画面にアクセスした際、20件のクイズが表示され、「もっと見る」クリック後に無限スクロールと無料広告挿入が動作することを確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3_
  - _Depends: 2.1, 2.2_
  - _Boundary: profile-client_

- [ ] 4. Validation: E2Eテストの作成・実行
  - `e2e/infinite-scroll.spec.ts` を作成する
  - 検索画面において、初期表示が20件で「もっと見る」があり、クリックすると追加ロードされ、それ以降はスクロールで自動ロードされる一連の流れをテストする
  - プロフィール画面において、同様に「もっと見る」から無限スクロールが機能し、無料ユーザーに対してクイズ10件ごとに広告枠がインライン表示されることをテストする
  - `npm run test:e2e` が正常にパスすること
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_
  - _Boundary: e2e-tests_
