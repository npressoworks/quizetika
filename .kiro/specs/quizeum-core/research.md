# Research & Design Decisions

## Summary
- **Feature**: `quizeum-core`
- **Discovery Scope**: New Feature (Greenfield)
- **Key Findings**:
  - 月間100万PVのSEO・パフォーマンス要件を満たすため、Next.js (App Router) の Server-side Rendering (SSR) および Incremental Static Regeneration (ISR) を活用して、クローラー向けにJavaScriptなしでOGP・SEOメタデータを含むHTMLを即時応答する。
  - データ永続化には Firestore を採用し、N+1問題を回避するためクイズドキュメント内に「作成者情報」や「問題・選択肢の配列」をネスト保持する非正規化設計が極めて有効である。
  - 不正スコア・改ざんの防止やコミュニティの健全性を担保するため、通報や指摘システム等の状態管理やカウント更新は Firestore トランザクションを用いてアトミックに実行する。

## Research Log

### 1. 月間100万PVを支える高スケーラブル・SEOアーキテクチャ
- **Context**: ユーザー・クローラーに対して高速な読み込み（0.5秒以内）を提供しつつ、SEO/OGPメタデータを動的かつ即時に返却する必要がある。
- **Sources Consulted**: Next.js App Router Documentation (Rendering, Caching), Firebase Firestore Performance Best Practices.
- **Findings**:
  - クライアントサイドでのみデータを取得するSPA方式では、SNSクローラーや検索エンジンがページを正しくインデックスできない（OGPが表示されない）問題がある。
  - Next.js App Router の Server Components で Firestore SDK を用いて直接データをフェッチすることで、完全な静的/サーバーレンダリングHTMLを生成・応答できる。
  - キャッシュ戦略として、読み込み頻度が高く更新頻度が低いクイズ詳細や新着一覧には ISR (Incremental Static Regeneration) を適用し、オンデマンドで再検証 (`revalidateTag`) を行う。
- **Implications**:
  - `src/app/quiz/[id]/page.tsx` などの公開画面は Server Components として設計し、サーバー側で直接 Firestore からデータ取得・HTMLレンダリングを実行する。
  - 動的メタデータ生成には `generateMetadata` 関数を使用する。

### 2. クイズ問題・メタ情報のデータモデリングとFirestore最適化
- **Context**: クイズ、問題、選択肢、および画像の参照関係をどう管理し、読み取り回数（Read Operations）を削減するか。
- **Sources Consulted**: Firestore subcollections vs nested maps, Dicebear APIs.
- **Findings**:
  - 問題 (`Question`) と選択肢 (`Choice`) をサブコレクションとして別ドキュメントにすると、1回のクイズ読み込みで多数の読み取り処理が発生し、Firestore の費用とレスポンス性能が劇的に悪化する。
  - クイズドキュメント内に `questions` 配列としてネスト格納することで、1回のリクエスト（1 Read）でクイズのすべての問題、選択肢、およびカバー画像URLを取得でき、大幅な高速化とコスト削減につながる。
  - 一方、ユーザーのプレイ結果 (`Attempt`) やフォロー (`Follow`)、ブックマーク (`Bookmark`) は、データ量が大きく成長するため独立したコレクションとして定義する。
- **Implications**:
  - `Quiz` ドキュメントのスキーマに `questions: Question[]` を直接持たせる。
  - 間違い指摘（`reports`）と通報（`flags`）は、独立したコレクションとして定義し、クイズドキュメントとは分離する。

### 3. モデレーション（通報・NGワード）および別解指摘フィードバックのデータフロー
- **Context**: 荒らしや不適切表現の防止、および作成者へのクローズドな問題間違い指摘の仕組み。
- **Sources Consulted**: Firebase Security Rules, Content Moderation patterns.
- **Findings**:
  - ユーザー間でオープンに間違いを議論させると、コミュニティが荒れやすくなるため、コメント欄ではなく「クローズドな指摘レポートシステム」が最も効果的である。
  - 不適切表現（NGワード）は、クライアント・サーバー双方で正規表現や指定辞書による軽量なチェックを行う。
  - クイズの自動非公開（通報蓄積による自動保留）は、悪意あるコンテンツの拡散を迅速に防ぐため、ドキュメントの通報カウンター (`flagsCount`) をトリガーにしてFirestoreのクエリ対象から即座に外すようにする。
- **Implications**:
  - `reports` コレクションのドキュメント構造を定義：`id`, `quizId`, `questionId`, `reporterId`, `category` (typo/fact/alternative), `content`, `status` (open/resolved), `createdAt`。
  - `flags` コレクションのドキュメント構造を定義：`id`, `quizId`, `reporterId`, `reason` (spam/harassment/copyright/etc), `content`, `createdAt`。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| **Next.js SSR/ISR + Client-side Services (Adopted)** | サーバーコンポーネントでSEO/メタデータを即時応答し、クライアントサービスで Firestore と通信するハイブリッド構成 | 高いSEOパフォーマンス、優れた表示速度、クライアント側の滑らかな対話性 | サーバーとクライアントの境界での型共有に注意が必要 | プロジェクトの Next.js (App Router) スタックに完全適合 |
| Single Page Application (SPA only) | すべてクライアントサイドでデータを取得し、画面遷移する構成 | 開発がシンプルでサーバーリソースが不要 | クローラーがJSを解釈しない場合にSEO/OGPが機能せず、100万PVの獲得目標に不利 | 却下。SEOが必須のため |

## Design Decisions

### Decision: クイズドキュメントへの問題データ内包 (Document Nesting)
- **Context**: クイズプレイや検索時のデータ取得効率を最高レベルに引き上げる。
- **Alternatives Considered**:
  1. 問題をサブコレクション `quizzes/{quizId}/questions` として分離する。
  2. クイズドキュメント内に `questions` を JSON またはオブジェクト配列として直接内包する（採用）。
- **Selected Approach**: オブジェクト配列 `questions: Question[]` を `quizzes` コレクション内にネストする。
- **Rationale**: クイズ表示や解答開始時にドキュメントを1回読み込むだけで全データが取得可能になり、Firestore のデータ読み取り回数（Read Operations）がサブコレクション方式に比べて激減し、パフォーマンスが最大化するため。
- **Trade-offs**: クイズドキュメント全体のサイズが大きくなるが、Firestore のドキュメント制限である 1MB に対し、クイズ問題（1クイズあたり最大20問程度を想定）であれば数KB〜数十KB程度で収まり、制限を大きく下回るため問題ない。

### Decision: コメント機能の排除とクローズドな間違い・別解指摘レポートの採用
- **Context**: コミュニティが荒れるのを防ぎつつ、クイズの品質向上を推進する。
- **Alternatives Considered**:
  1. 一般的なコメント掲示板をクイズ下に設置する。
  2. 作成者に直接届く、送信専用のクローズドな指摘フォームを設ける（採用）。
- **Selected Approach**: クローズドな指摘レポートコレクション (`reports`) の新設と、通知システムの導入。
- **Rationale**: コメント欄は荒れやマウンティングの温床になりやすく、クイズ作成者のモチベーション低下に直結する。非公開のレポートとすることで、真摯なフィードバックが作家に確実に届き、修正時の通知によって指摘者と作家の良好な関係が構築されるため。

## Risks & Mitigations
- **スパイクアクセスによる Firestore コストの急増** — クイズ詳細など頻繁に読み取られるページに対し、Next.js の ISR（Incremental Static Regeneration）キャッシュレイヤを適用して、Firestore への直接クエリ回数を最小限に抑える。
- **悪意ある通報による正当なクイズの自動非公開（保留）** — 通報による自動非公開のしきい値を適切に設定（例: 5回）し、通報したユーザーのID重複をチェックするとともに、運営管理者への通知と迅速なレビュープロセスを設ける。
- **NGワードフィルタの漏れや誤検知** — 厳しい自動フィルタは創作の幅を狭める可能性があるため、投稿時は警告を表示するか、通報・人手によるモデレーションと組み合わせて運用する。

## References
- [Next.js App Router Metadata](https://nextjs.org/docs/app/building-your-application/optimizing/metadata) — Dynamic metadata and SEO optimization.
- [Firebase Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices) — Document size limit and querying optimization guidelines.
