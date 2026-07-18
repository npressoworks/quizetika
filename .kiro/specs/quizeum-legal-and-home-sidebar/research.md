# Gap Analysis: quizetika-legal-and-home-sidebar

## 1. Current State Investigation (現状調査)

### 既存のレイアウト構造
- [layout-wrapper.tsx](file:///d:/quizetika/src/components/layout/layout-wrapper.tsx) がアプリケーション全体の共通レイアウトを制御しています。
- PC表示時は左側に `Sidebar`（幅 275px または 70px）、モバイル表示時は `BottomNav` および軽量化された `Header` が表示されます。
- メインコンテンツは `LayoutWrapper` 内で `max-w-[1200px]` の幅に制限されています。

### トップページ（ホーム画面）の構造
- [page.tsx](file:///d:/quizetika/src/app/page.tsx) がサーバーコンポーネントとして動作し、非同期データ（おすすめクイズ、新着クイズ、ジャンル）をフェッチして [home-discovery-client.tsx](file:///d:/quizetika/src/app/home-discovery-client.tsx) に流し込みます。
- `HomeDiscoveryClient` は現在、全幅（`flex flex-col gap-10`）のカルーセル表示となっており、右カラムは存在しません。

### 利用可能な依存パッケージ・UIコンポーネント
- **Markdownレンダラー**: `package.json` に `marked` および `isomorphic-dompurify` が既に導入されており、法的文書のマークダウン表示にそのまま活用できます。
- **UIコンポーネント**: `src/components/ui/` に `card.tsx`, `button.tsx`, `separator.tsx`, `skeleton.tsx` などの主要な shadcn/ui プリミティブが既に整備されています。
- **スタイリング**: Tailwind CSS v4 が導入されており、モダンかつプレミアムなスタイリングが可能です。

---

## 2. Requirements Feasibility Analysis (要件の実現性分析)

### 必要となる技術要素
1. **右カラム UI**: PC表示時にはトップページの右側に表示し、モバイル表示時には最下部に流し込むレスポンシブなグリッド/フレックスレイアウト。
2. **法的ページルート**: Next.js App Router に基づく新規ルート `/terms` および `/privacy`。
3. **環境変数連携**: お問い合わせ用の環境変数 `NEXT_PUBLIC_CONTACT_FORM_URL` およびそのフォールバック先となるデフォルトGoogleフォームURL。

### ギャップおよび制約事項
- **Gaps (不足部分)**:
  - トップページ右カラムを表示するための専用コンポーネント（例: `HomeSidebar`）。
  - `/terms` および `/privacy` 用の Next.js ページファイルと、規約ドキュメントデータ（Markdown等）。
- **Constraints (制約)**:
  - `LayoutWrapper` の最大幅 `1200px` の中で、メインコンテンツと右カラム（300px）を適切に収める必要があります。PC表示時に極端にコンテンツ幅が狭くならないよう、余白とフォントサイズの調整が必要になります。

---

## 3. Implementation Approach Options (実装アプローチの選択肢)

### Option A: 既存のホームコンポーネント内への直書き（非推奨）
- **概要**: `home-discovery-client.tsx` に右カラムの HTML/CSS を直接記述します。
- **トレードオフ**:
  - ✅ 新規ファイル数が最小限で済みます。
  - ❌ ホームコンポーネントのコード量が増加し、単一責任の原則に反します。

### Option B: 新規コンポーネントの作成とインポート（推奨）
- **概要**: 新規に `src/components/explore/home-sidebar.tsx` を作成し、各種リンクやコピーライト等のUIロジックをカプセル化します。トップページではこのコンポーネントをインポートしてグリッド/フレックス内に配置します。
- **トレードオフ**:
  - ✅ 関心の分離が明確で、テストが容易です。
  - ✅ `home-discovery-client.tsx` の肥大化を防ぎ、コードの可読性を維持できます。
  - ❌ 新しいファイルが1つ増えます。

---

## 4. Implementation Complexity & Risk (実装の難易度とリスク)

- **難易度**: **S (1–3 days)**
  - 複雑な DB トランザクションや API 連携はなく、純粋な UI 構築と Next.js App Router による静的ページの追加のみであるため、短時間で実装可能です。
- **リスク**: **Low**
  - 既存のグローバルステートやデータフェッチ処理に影響を与えません。レスポンシブなレイアウト崩れだけ検証を行えば問題ありません。

---

## 5. Recommendations for Design Phase (設計フェーズへの推奨事項)

- **推奨アプローチ**: **Option B (新規コンポーネントの作成)**。
- **確認事項**:
  - 新規規約ページ `/terms`, `/privacy` で表示する規約ドキュメントの具体的なテキスト内容（仮文面での構築か、本番用テキストの有無）。
  - デフォルトのGoogle問い合わせフォームのURL値。

---

# Design Discovery & Synthesis (設計ディスカバリーと合成)

## 6. Synthesis Outcomes (設計合成の決定事項)

### 法的文書のデータ配置と管理の簡素化
利用規約（Terms of Service）およびプライバシーポリシー（Privacy Policy）のコンテンツ管理について、Reactコンポーネントに長大なテキストをハードコードするのは、将来的な文章のアップデートの観点から最適ではありません。
そのため、以下の設計合成を行いました。
- **決定**: `src/data/terms.md` および `src/data/privacy.md` というMarkdownファイルを新設します。
- **レンダリング方法**: Next.js の Server Component を用いてローカルファイルを `fs.promises.readFile` で非同期に読み込み、既存の `marked` と `isomorphic-dompurify` を使用してHTMLにパースして表示します。
- **効果**: ドキュメントデータの管理が極めて容易になり、UIコンポーネントのコード肥大化を防ぐことができます。

### お問い合わせURLの決定ロジック
お問い合わせ用の遷移先について、外部APIなどの動的解決手段を設けず、ビルド時または実行時の環境変数 `NEXT_PUBLIC_CONTACT_FORM_URL` の読み込みのみで完結させます。
- **デフォルト値**: 環境変数が未定義の場合、Google Forms の仮URL `https://docs.google.com/forms/d/e/1FAIpQLSfP1E1_dummy_form/viewform` にフォールバックします。

### レスポンシブ2カラムレイアウトの構築
- PC表示時は `1200px` のグリッドで `grid-cols-1 lg:grid-cols-[1fr_300px]` を構成し、右カラム幅を `300px` 固定、メインコンテンツを可変（`1fr`）にします。
- モバイル表示時は、`HomeSidebar` コンポーネントが自動的にカルーセル要素の下部に来るようにします。モバイル時はサイドバーの装飾（BorderやBackground）を若干軽量化してフッターらしく見せるよう、CSSクラスで調整します。
