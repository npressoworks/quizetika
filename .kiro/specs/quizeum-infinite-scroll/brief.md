# Brief: quizeum-infinite-scroll

## Problem
ユーザーは、クイズの一覧画面（検索、プロフィールなど）で、従来の「前へ/次へ」のページネーションや、いきなり自動で始まる無限スクロールではなく、最初は「もっと見る」ボタンから始まり、それを押した後はスクロールするだけで自動追加ロードされる、一貫したハイブリッド無限スクロール体験を求めている。また、プロフィール画面ではクイズを一括取得してクライアントサイドでページネーションしているため、不要な Firestore 読み取りが発生している。無料会員に対する10件ごとのインライン広告の表示ルールを崩さずにこれらを段階的に読み込める仕組みが必要である。

## Current State
- 検索画面 (`search-client.tsx`): `useIntersectionLoadMore` で初期から自動無限スクロールが動作している。また、複雑な AND/OR 検索のため `searchQuizzesPaginated` は100〜200件をクライアントでマージした後の offset スライスを行っている。
- プロフィール画面 (`profile-client.tsx`): `getQuizzesByAuthor` で作者の全クイズを一括ロードし、クライアントサイドで9件ずつの「前へ/次へ」ボタンでページネーションしている。
- 広告挿入: 検索画面でのみ、クイズカード10件ごとに AdSense 広告がインライン挿入される仕組みがある（`showAds === true` のとき）。

## Desired Outcome
- 検索画面およびプロフィール画面のクイズ一覧に、共通の「ハイブリッド無限スクロール」が適用される。
- 最初は「もっと見る」ボタンが表示され、それを一度クリックすると、それ以降はスクロール監視によって自動的に追加ロードされる。
- プロフィール画面では、クイズ一覧がデフォルト20件ずつ Firestore からカーソルベース（`startAfter`）でフェッチされるようになり、無駄な読み取りコストが削減される。
- プロフィール画面でも無料会員向けに10件ごとに AdSense 広告が挿入される。
- 追加フェッチが走っても、インライン広告が重複したりずれたりしない。

## Approach
- **共通UIコンポーネント `InfiniteScrollLoader` の新設**: 内部で「もっと見る」ボタンの表示、クリック時の無限スクロール移行フラグ、スクロール交差監視（`useIntersectionLoadMore`）をカプセル化する。
- **Firestoreカーソルクエリ `getQuizzesByAuthorPage` の実装**: `orderBy('createdAt', 'desc')`、`startAfter` と `limit(20)` をサポートするクイズ取得関数を `quizeum-core` に追加し、カーソル定義に `'author'` を加える。
- **プロフィール画面への統合**: デフォルトは `getQuizzesByAuthorPage` を用いたカーソルページング。検索語 `searchQuery` が入力された場合は一括ロードに切り替えてクライアント側でフィルタするハイブリッド方式をとる。

## Scope
- **In**:
  - `InfiniteScrollLoader` 共通コンポーネントの新設。
  - `getQuizzesByAuthorPage` 及び `'author'` カーソルの実装。
  - 検索画面 (`search-client.tsx`) への `InfiniteScrollLoader` 統合。
  - プロフィール画面 (`profile-client.tsx`) への `getQuizzesByAuthorPage` 統合と広告（10件ごと）挿入。
  - E2E テストおよびユニットテストの追加・更新。
- **Out**:
  - トップ画面（カルーセルのみ）およびカスタムクイズ画面（`/my-quiz` での問題一覧）の無限スクロール化。

## Boundary Candidates
- ハイブリッド無限スクロール UI / 状態管理 (`InfiniteScrollLoader`)
- Firestore カーソルデータフェッチレイヤー (`getQuizzesByAuthorPage`)
- 広告インライン挿入の共通化ロジック

## Out of Boundary
- Stripe 課金ロジック、ウミガメスープのAI対話プレイ画面、モデレーション投票画面など、本ページング機能に直接関係のない領域。

## Upstream / Downstream
- **Upstream**: `quizeum-core` (`getQuizzesByAuthorPage`, `QuizFeedTabKind` 拡張), `quizeum-ads` (広告状態/コンポーネント)
- **Downstream**: UI各画面 (`quizeum-play-flow-ui`, `quizeum-auth-profile-ui`)

## Existing Spec Touchpoints
- **Extends**: なし (新規スペックとしての定義)
- **Adjacent**: `quizeum-play-flow-ui` (検索画面), `quizeum-auth-profile-ui` (プロフィール画面)

## Constraints
- Vanilla CSS/CSS Modules または TailwindCSS でスタイリングを統一。
- Firestore のインデックスおよびセキュリティルールと整合するクエリ設計。
