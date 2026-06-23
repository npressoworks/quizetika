# Research & Design Decisions: quizeum-ads

## Summary
- **Feature**: quizeum-ads
- **Discovery Scope**: Extension & Complex Integration
- **Key Findings**:
  - Stripe による有料会員の判定ロジック（`pro` / `premium` 且つ active）はすでに `src/lib/pricing-entitlement.ts` に実装されている。これにモック（`e2e-mock-pro-user`）のチェックも統合されている。
  - Next.js (App Router) で Google AdSense を統合する場合、`next/script` を使用し、非同期かつインタラクティブ後にスクリプトをロードすることでパフォーマンス劣化を抑えられる。有料プラン時はスクリプト自体のロードを完全に防ぐ。
  - クイズ一覧（CSS Grid / Carousel）で広告を挿入する場合、有料プラン有無によって配列生成時に条件分岐で差し込むことで、CSS側で `display: none` にするよりも不要な DOM 生成やグリッドレイアウト上の余白バグを避けることができる。
  - 結果画面遷移時の 1/3 確率動画広告は、クライアントサイドで `Math.random() < 1/3` を用いて判定し、自前モーダル（5秒スキップ不可）を表示してから本来の `router.push` を実行する割り込みパターンが最も制御しやすく、E2Eテスト時の強制フラグも仕込みやすい。

## Research Log

### Google AdSense の Next.js App Router への統合
- **Context**: パフォーマンスやハイドレーションに配慮しつつ、かつ有料会員には一切広告スクリプトをロードさせないためのベストプラクティスを調査。
- **Sources Consulted**: Next.js Official Documentation (`next/script`), Google AdSense ヘルプ。
- **Findings**:
  - `next/script` の `strategy="afterInteractive"` または `lazyOnload` を使うことで、メインスレッドのブロックを回避可能。
  - クライアントコンポーネントである `AdsenseProvider` を作成し、`useAds` 内の `showAds` 状態に基づいて `<Script>` タグを条件付きレンダリングすることで、有料会員にはスクリプトが一切マウントされず、不要なネットワーク通信やデータ送信を防ぐことができる。
  - インライン広告枠は `<ins className="adsbygoogle" ...>` を配置し、マウント時に `(window.adsbygoogle = window.adsbygoogle || []).push({})` を呼び出す。
- **Implications**: `AdsenseProvider` を `src/app/providers.tsx` または `layout.tsx` の直下でラップし、`useAuth` に連動させる必要がある。

### 1/3 確率の自前動画広告モーダルの制御
- **Context**: 確率的な割り込みと、5秒のカウントダウン、およびE2Eテスト時の一貫したテスト方法の確立。
- **Sources Consulted**: React `useState` / `useEffect` タイマー制御、LocalStorage モックパターン。
- **Findings**:
  - タイマーによるカウントダウンを `setInterval` または `setTimeout` で制御し、5秒経過後に `isSkippable` 状態を `true` にする。
  - E2Eテストでは確率 1/3 だとテストが不安定になるため、LocalStorage の `e2e-mock-force-video-ad` が `true` の場合は確率を無視して必ず広告をトリガーするようにする。
- **Implications**: `useAds` フックに `shouldShowVideoAd()` メソッドを持たせ、テスト用のオーバーライドロジックを組み込む。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Client-Side Intercept (Approach 1) | クライアントUIレイヤーでの条件付きレンダリングと遷移割り込み | 既存API変更不要、実装・テストが容易、パフォーマンスに優れる | Hydration時の判定ラグにより一瞬広告がちらつくリスク | 有料判定状態のロード中は広告を非表示にするガードが必要 |
| Server-Side Inject (Approach 2) | API レスポンスに広告スロットを混ぜる | クライアント側インデックス計算不要、中央集権管理 | 有料・無料のキャッシュ分離が困難、データと表示の密結合 | 却下 |

## Design Decisions

### Decision: `AdsenseProvider` による条件付きスクリプトロード
- **Context**: 有料会員には一切広告関連のリソースをロードさせない。
- **Alternatives Considered**:
  1. `layout.tsx` に静的 `<script>` タグを直接書き込み、クライアント側で CSS 非表示にする。 (却下：不要なロードが発生し有料会員の価値が下がるため)
  2. `useAds` フックの状態を監視して `<Script>` をマウントする `AdsenseProvider` を作成。 (採用)
- **Selected Approach**: `useAds` から返される `showAds` が `true` の場合のみ `<Script>` をレンダリングする。
- **Rationale**: ユーザー体験とパフォーマンスの最大化。

### Decision: LocalStorage を使った E2E テストモック
- **Context**: 広告非表示や動画広告モーダルを Playwright 等の E2E テストで一貫して検証したい。
- **Alternatives Considered**:
  1. テスト用に特別なAPIやビルドフラグを仕込む。 (却下：コードベースが汚れる)
  2. LocalStorage（`e2e-mock-pro-user` および `e2e-mock-force-video-ad`）をテストコード側から注入して制御する。 (採用)
- **Selected Approach**: `useAds` 内で LocalStorage のテストキーを優先判定する。
- **Rationale**: 既存の Pro 会員モックパターン（`pricing-entitlement`）と対称的で理解しやすいため。

## Risks & Mitigations
- 有料会員なのに一瞬広告枠が見えてしまう（ハイドレーション時のラグ）
  - **対策**: `useAuth` の `loading` 中は `showAds` を `false` にし、ログイン状況が確定するまで広告を描画しない。
- AdSense スクリプト読み込み時のエラーや広告ブロッカーによるクラッシュ
  - **対策**: `window.adsbygoogle.push` を `try-catch` で囲み、読み込み失敗時にもエラーが伝播して画面が白紙にならないように防御する。

## References
- [Next.js Script Component](https://nextjs.org/docs/app/api-reference/components/script) — スクリプト最適化ガイド
- [Google AdSense API Reference](https://developers.google.com/adsense/platforms) — クライアント統合方法
