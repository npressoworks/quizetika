# Gap Analysis: quizeum-infinite-scroll

## 1. 現状の codebase 調査 (Current State Investigation)

### 関連する既存アセット
* **検索画面 (`src/app/search/search-client.tsx`)**:
  * クイズ探索用フック `useExploreQuizFeed` を利用してクイズを取得しています。
  * `useIntersectionLoadMore` に基づく `loadMoreSentinelRef` を通じて、初期状態から自動で追加ロードを実行しています。
* **プロフィール画面 (`src/app/profile/[uid]/profile-client.tsx`)**:
  * `getQuizzesByAuthor(uid, isMyProfile)` を使って、作者のすべてのクイズを初期表示時に一括ロードしています。
  * `currentPage` と「前へ」「次へ」ボタンを用いて、クライアントサイドで9件ずつのページネーションを行っています。
* **データロード層 (`src/services/quiz.ts`)**:
  * ホームフィード系 (`latest`, `popular`, `trending`, `timeline`) は、Firestore の `startAfter` を使ったカーソルベースのページネーション API (`getLatestQuizzesPage` 等) が実装済みです。
  * 検索ページネーション `searchQuizzesPaginated` は、最大200件までマテリアライズした配列に対する offset ベースのページネーションを行っています。
  * `getQuizzesByAuthor` は一括取得のみで、カーソル型ページネーションは未実装です。
* **広告機能 (`src/components/ads/adsense-inline-ad.tsx` 等)**:
  * 検索結果のクイズグリッドにおいて、`showAds`（無料会員）の時に10件ごとに `<AdsenseInlineAd>` を reduce 関数でインライン挿入する仕組みが確立されています。

---

## 2. 要求実現可能性の分析 (Requirements Feasibility Analysis)

### 技術的ニーズとギャップ
1. **ハイブリッド無限スクロール UI の新設 (Missing)**:
   * 最初は「もっと見る」ボタン。クリック後に自動スクロール監視に移行するステートと表示ロジックを統合した共通 UI（フック/コンポーネント）が必要です。
2. **作者クイズの段階取得 API (Missing)**:
   * Firestore の `startAfter` を使った段階的取得（limit 20）を行う `getQuizzesByAuthorPage` 関数を `quizeum-core` レイヤーに新設する必要があります。
   * カーソルの型定義 `QuizFeedTabKind` に `'author'` を追加する必要があります。
3. **プロフィール画面の検索時ハイブリッドフェッチ (Constraint)**:
   * プロフィール内の検索語入力時は、Firestore クエリでの中間一致・複数条件検索が難しいため、一括フェッチ ＋ クライアントフィルタリングに動的に切り替えるロジックを UI 側に組み込む必要があります。
4. **プロフィール画面での広告インライン挿入 (Missing)**:
   * 検索画面で動作している「10件ごとの広告挿入」処理をプロフィール画面のクイズ一覧でも動作させる必要があります。

---

## 3. 実装アプローチの評価 (Implementation Options)

### オプションA: 既存コンポーネントのインライン拡張 (Extend)
* **概要**: `search-client.tsx` と `profile-client.tsx` の内部に個別に「もっと見る」ボタンのステート（`isInfinite`）とイベントハンドラを書き込み、`useIntersectionLoadMore` の有効フラグを制御します。
* **メリット**: 新しいファイルを作らず、コード行数を抑えて直接変更できます。
* **デメリット**: `profile-client.tsx` はすでに500行を超える大規模なファイルであり、そこにさらに段階フェッチやハイブリッド検索・広告挿入などの状態管理を追加するとコードの複雑度が著しく増大します。

### オプションB: 共通無限スクロールローダー ＋ プロフィールクイズ一覧のコンポーネント分離 (Hybrid - 推奨)
* **概要**:
  * 共通のハイブリッド動作（もっと見る → 自動スクロール）と監視センチネルを内包したコンポーネント `InfiniteScrollLoader` を新設します。
  * プロフィール画面のクイズ一覧部分を `ProfileQuizzesPanel` コンポーネントとして独立させ、その中でカーソル段階ロード（検索ワードなし）と一括クライアントフィルタ（検索ワードあり）のハイブリッドデータフェッチ、および広告挿入を閉じ込めます。
* **メリット**:
  * 関心事がクリーンに分離され、プロフィール画面全体の可読性とメンテナンス性が劇的に向上します。
  * `InfiniteScrollLoader` は検索画面でもタグを差し替えるだけでそのまま適用できます。
* **デメリット**: 新しいコンポーネントファイルが2つ増えるため、初期のファイル構造設計が必要です。

---

## 4. 開発規模とリスク評価

* **開発規模 (Effort)**: **M (中)**
  * Firestore レイヤーの拡張（`getQuizzesByAuthorPage` 新設、カーソル拡張）、共通 UI コンポーネント作成、プロフィール画面のリファクタリング（コンポーネント分割）、広告表示の追加を伴うため、3〜5日程度の開発規模です。
* **リスク (Risk)**: **Low (低)**
  * 無限スクロールや広告挿入、Firestore の `startAfter` カーソルの基盤はすでに codebase 内に実績パターンが存在するため、技術的な不確実性はありません。

---

## 5. 設計フェーズに向けた推奨事項

* **推奨アプローチ**: オプションB（共通 `InfiniteScrollLoader` の構築とプロフィールクイズ一覧のコンポーネント化）。
* **持ち越しリサーチ項目**:
  * 下書きクイズ（自分自身が作成したクイズ）を含めて `getQuizzesByAuthorPage` を呼ぶ際、`createdAt` インデックスが公開・下書きの混在状態で正しく機能するかどうかのインデックス構成検証。
