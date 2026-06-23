# Requirements Document

## Introduction
無料プラン（一般ユーザー）向けに広告表示（インライン広告および全画面動画広告）を実装し、収益化の基盤を提供します。同時に、Stripe課金による有料会員（Pro/Premium）のユーザーには広告を完全に非表示にし、優れたユーザー体験を提供します。

## Boundary Context
- **In scope**:
  - Google AdSense スクリプトの動的ロード制御。
  - クイズ一覧（ホーム、検索結果、ジャンル別一覧、タグ別一覧）において、クイズカード10件ごとに1件のインライン広告（PRチップ付きのダミー広告枠、または AdSense 広告ユニット）のレンダリング。
  - クイズプレイ完了から結果画面へ遷移する際、確率 1/3 での自前動画広告モーダル（`VideoAdModal`）の表示制御。モーダルは5秒経過後にスキップ可能となる。
  - ローカル開発やE2Eテスト向けの広告非表示・強制表示等のモック機能。
- **Out of scope**:
  - Google AdSense 以外のサードパーティ広告SDKの導入。
  - クイズプレイ中の解答画面内での広告表示。
  - 5秒未満でのスキップ不可能な動画広告。
- **Adjacent expectations**:
  - `quizeum-billing-subscription-ui` / `quizeum-core` が提供するユーザーのサブスクリプション状態（有料会員かどうか）の判定ロジック（`computeHasPaidEntitlements`）に依存。

## Requirements

### Requirement 1: ユーザープランに応じた広告制御
**Objective:** As a システム, I want ユーザーの会員ステータスを判定して広告スクリプトのロード有無を切り替えたい, so that 有料会員に余分なリクエストや表示をさせない

#### Acceptance Criteria
1. While ログイン中のユーザーが有料会員であるとき, the Ad System shall Google AdSenseスクリプトのロードおよび一切の広告描画を行わない。
2. While ログイン中のユーザーが無料会員（または未ログイン）であるとき, the Ad System shall Google AdSenseスクリプトをロードし、広告枠を表示する。
3. When ローカルテスト用のモック（`e2e-mock-pro-user` またはテスト用の無効フラグ）が有効であるとき, the Ad System shall 有料会員と同様に広告表示を行わない。

### Requirement 2: クイズ一覧でのインライン広告表示
**Objective:** As a 一般ユーザー, I want クイズ一覧をスクロールしているときにインライン広告が表示される, so that 無料プランでのコンテンツを閲覧できる

#### Acceptance Criteria
1. While 広告表示対象のユーザーがクイズ一覧（ホーム、検索結果、ジャンル別、タグ別）を表示しているとき, the Ad System shall クイズカード10件ごとに1件の割合でインライン広告を挿入して表示する。
2. The Ad System shall インライン広告カードに「PR」という目立つラベル（チップ）を付与して、通常のクイズカードと視覚的に区別する。
3. When ユーザーが有料会員にアップグレードしたとき, the Ad System shall 一覧に挿入されているインライン広告をすべて非表示にする。

### Requirement 3: クイズ完了時の全画面動画広告表示
**Objective:** As a 一般ユーザー, I want クイズプレイ完了時に動画広告が表示される, so that クイズ結果画面へ進むことができる

#### Acceptance Criteria
1. When 広告表示対象のユーザーがクイズ（通常プレイ、テストプレイ）を完了し、結果画面へ遷移する操作を行ったとき, the Ad System shall 3分の1（1/3）の確率で全画面の自前動画広告モーダルを表示する。
2. While 全画面動画広告モーダルが表示されているとき, the Ad System shall 結果画面への自動的な遷移処理を一時停止し、動画の再生（ダミー）を開始する。
3. While モーダルの表示開始から5秒が経過するまでの間, the Ad System shall 「スキップ」または「閉じる」ボタンを無効化（または非表示）にする。
4. When モーダルの表示開始から5秒が経過したとき, the Ad System shall 「スキップして結果へ」ボタンを活性化（または表示）し、ユーザーがクリックした際、速やかに本来の結果画面への遷移処理を実行する。
5. When 有料会員のユーザーがクイズを完了したとき, the Ad System shall 1/3の確率判定を行わず、直接結果画面へ遷移する。
