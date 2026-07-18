# Research & Design Decisions: quizetika-creator-dash-ui

## Summary
- **Feature**: quizetika-creator-dash-ui
- **Discovery Scope**: Extension（Phase 12 — 作問エディタ UX 改善）
- **Key Findings**:
  - テキストエリア自動伸長の既存実装なし。`field-sizing: content` は未使用。`scrollHeight` 同期の小さな制御コンポーネントが最も確実。
  - `filterAuthorQuizzes` はタイトル+説明のみ照合。問題照合には `getQuestionsByQuiz` のバッチ取得が必要だが、自作クイズ数は限定的でインデックス不要。
  - リンク成功フィードバックは `success-client.tsx` の `copyToast` パターンを参考に、パネル内インライン `role="status"` で十分。

## Research Log

### 既存 UI ギャップ（Phase 8）
- **Context**: 要件 6・7 の実装起点を特定
- **Sources Consulted**: `quiz-list-editor.tsx`, `quiz-editor.tsx`, `list/[id]/page.tsx`
- **Findings**:
  - `createQuizList` 呼び出しは `listType: 'quiz'` ハードコード（L173）
  - 問題アタッチ・`exportQuestionList`・参照リンクパネルは未実装
  - `GenreEditorSelect` / Phase 6 は完了
  - リスト詳細の問題リスト分岐は play-flow で完了
- **Implications**: Phase 8 タスクは `QuizListEditor` 分岐 + 新コンポーネント + `QuizEditor` パネルが中心

### Core API 利用可能性
- **Context**: 設計の Allowed Dependencies 確定
- **Sources Consulted**: `quiz-list.ts`, `question.ts`, `author-quiz-search.ts`, `linked-question.ts`
- **Findings**:
  - `createQuizList({ listType })`, `addQuestionToList`, `reorderQuestionList`, `exportQuestionList` 利用可能
  - `searchAuthorQuizzes` + `getQuestionsByQuiz` で自作検索（下書き含む）
  - `getBookmarkedQuestions` で BM 問題取得
  - 他者公開問題: `addQuestionToList` は検証済みだが検索 API なし
- **Implications**: `useQuestionAttachSearch` が3ソースを UI 層で統合

### 公開問題探索の代替手段
- **Context**: 要件 6.4 の3ソース目
- **Findings**:
  - `searchQuizzes(keyword, limit)` で公開クイズを取得し、各 `getQuestionsByQuiz` で問題を展開（上限 N=20 でコスト抑制）
  - `authorId !== currentUser` で他者のみにフィルタ
- **Implications**: 設計に `public-explore` タブとして明記。将来 core に専用 API があれば hook 内差し替え可

## Architecture Pattern Evaluation

| Option | Description                                   | Strengths                  | Risks                   | 判定     |
| ------ | --------------------------------------------- | -------------------------- | ----------------------- | -------- |
| A      | `QuizListEditor` 単体肥大化                   | ファイル数少               | 600行超・テスト困難     | 却下     |
| B      | `QuestionListAttachPanel` + hook 分離         | 境界明確、play-flow と同型 | 新規ファイル 4–5        | **採用** |
| C      | 問題リスト専用 `/list/create-question` ルート | URL 分離                   | 要件 4 と重複、ルート増 | 却下     |

## Design Synthesis

### Generalization
- **検索 UI**: 問題リスト（6.4）と参照パネル（7.2）はともに「キーワード → クイズ/問題候補 → 選択」だが、データソースが異なるため hook は分離（`useQuestionAttachSearch` / `useAuthorQuizReferenceSearch`）。共有は `question-attach-search.ts` のテキストフィルタのみ。

### Build vs. Adopt
- **採用**: 既存 HTML5 DnD（クイズリストと同型）、`searchAuthorQuizzes`、`getBookmarkedQuestions`、`searchQuizzes`（読み取り）
- **新規**: `ListTypeSelector`, `QuestionListAttachPanel`, `AuthorQuizReferencePanel` のみ

### Simplification
- リスト詳細（要件 3）の Phase 8 表示は play-flow 実装を信頼し、creator-dash は編集導線（3.5）と作成時 `listType`（6.1）にスコープを限定

## Design Decisions

### Decision: 他者公開問題検索は searchQuizzes 経由
- **Context**: 要件 6.4、専用 API なし
- **Selected Approach**: `searchQuizzes` 上位20件 → 問題フラット化 → 他者・公開のみ
- **Rationale**: core 変更なしで要件充足。リスト編集は低頻度操作のため許容
- **Trade-offs**: 大量ヒット時の網羅性不足 → UI に「探索は上位結果のみ」注記

### Decision: 参照問題は表示コピー + linkKind 送信
- **Context**: 要件 7.4, 7.9, core CoW
- **Selected Approach**: エディタ state に参照メタ付き問題を保持し `saveQuiz` に委譲
- **Rationale**: core `partitionReferenceAndOwned` が永続化を担当（7.10）

## Risks & Mitigations
- **searchQuizzes による問題探索のレイテンシ** — デバウンス 300ms、limit 20、ローディング表示
- **参照問題の誤編集** — 読み取り専用デフォルト + CoW 警告（7.7）
- **listType 作成忘れ** — 新規保存ボタンを `listType` 未選択時 disabled（6.1）

## Research Log（Phase 12）

### テキストエリア自動伸長
- **Context**: 要件 8、既存 `quiz-editor.tsx` は固定 `minHeight`
- **Sources Consulted**: `quiz-editor.tsx`, `create.module.css`, プロジェクト全体 grep（`field-sizing` / `autosize` なし）
- **Findings**:
  - 対象4フィールド: 説明、問題文、真相（`aiContextDetails`）、解説
  - 新規 npm 依存はプロジェクト方針（Vanilla CSS、軽量）と不整合
- **Implications**: `AutoGrowTextarea` を `src/components/ui/` に新設し4箇所に適用

### 過去自作クイズ検索の問題照合
- **Context**: 要件 7.11、現行 `matchesKeyword` は title+description のみ
- **Sources Consulted**: `author-quiz-search.ts`, `lib/author-quiz-search.ts`, `canJudgeQuestion`（`test-play.ts`）
- **Findings**:
  - 正解テキストの型別ルールは `canJudgeQuestion` と対称（choices/correctTextAnswerList/truthKeywords/sortingItems）
  - `aiContextDetails`（真相裏設定）は GM 専用のため検索対象外とする（要件の「正解テキスト」は truthKeywords を指す）
  - `searchAuthorQuizzes` は既に `getQuizzesByAuthor` → `filterAuthorQuizzes` の2段構成
- **Implications**: キーワード時のみ `Promise.all(getQuestionsByQuiz)` を service 層で実行し、lib に questions map を渡す

### リンク成功フィードバック
- **Context**: 要件 7.13、現行 `handleLink` はサイレント
- **Findings**: グローバルトースト基盤なし。`copyToast` はボタン横インライン表示
- **Implications**: パネル内 `linkSuccessMessage` state + 3秒自動消去。`role="status"` でアクセシビリティ確保

## Architecture Pattern Evaluation（Phase 12）

| Option | Description                                       | Strengths                        | Risks                              | 判定             |
| ------ | ------------------------------------------------- | -------------------------------- | ---------------------------------- | ---------------- |
| A      | CSS `field-sizing: content` のみ                  | 実装最小                         | Safari 等の互換・初回高さずれ      | 補助手段に留める |
| B      | `scrollHeight` 同期コンポーネント                 | 全ブラウザで予測可能、テスト容易 | 小コンポーネント追加               | **採用**         |
| C      | textarea ライブラリ（react-textarea-autosize 等） | 実績あり                         | 新規依存、Vanilla CSS 方針と不整合 | 却下             |

## Design Decisions（Phase 12）

### Decision: 問題照合は service 層バッチ取得 + lib 純関数
- **Context**: 要件 7.11、要件書は core 担当と記載
- **Selected Approach**: `searchAuthorQuizzes` 内でキーワード時に問題を並列取得し、`filterAuthorQuizzesWithQuestions` で OR 照合
- **Rationale**: 既存 Phase 8 パターン（`filterAuthorQuizzes` in lib）を拡張。UI hook は変更不要
- **Trade-offs**: 自作クイズ多数時のレイテンシ — ローディング表示で緩和（既存 `loading` state 再利用）

### Decision: 正解テキストから aiContextDetails を除外
- **Context**: 要件 7.11 の「正解テキスト」解釈
- **Selected Approach**: `truthKeywords` のみ（ウミガメ）。`aiContextDetails` は検索対象外
- **Rationale**: 裏設定は長文かつ GM 専用。ユーザー向け「回答文」はキーワード群

## Risks & Mitigations（Phase 12）
- **自作クイズ大量時の検索レイテンシ** — キーワード未指定時は問題取得スキップ。キーワード時は既存 loading UI
- **AutoGrow と手動 resize の競合** — `resize: vertical` 維持、自動伸長は最小高さ以上にのみ適用
- **jsdom での scrollHeight テスト** — テスト内で `Object.defineProperty(el, 'scrollHeight', { value: N })` を使用

## References
- `.kiro/specs/quizetika-core/design.md` — Phase 8 契約
- `.kiro/specs/quizetika-play-flow-ui/design.md` — リスト詳細・問題リストプレイ（Out of boundary）
- `src/lib/test-play.ts` — 問題タイプ別正解判定（Phase 12 正解テキスト抽出の対称ルール）
- `src/components/quiz-list/quiz-list-editor.tsx` — 現行クイズリスト編集

---

# Gap Analysis: クリエイター＆プレイヤー統合ダッシュボード（Phase 27 追記 — 2026-06-28）

## 1. 調査と分析のサマリー
- **機能**: ダッシュボードのタブ切り替え対応と、プレイヤーダッシュボードの追加（よくプレイするジャンル/タグ、および正答率の高いジャンル/タグの集計・表示）。
- **実装アプローチ**:
  - `attempts` コレクションから、ユーザーの直近最大100件の完了したプレイデータを取得する。
  - `attempts` の各レコードには `quizId` が記録されているが、ジャンルおよびタグの情報は含まれていないため、対象となる一意の `quizId` リストを抽出し、Firestore から `quizzes` データをバッチフェッチする。
  - バッチフェッチの際、Firestore の `in` クエリ制限（最大30件）を考慮し、30件ずつのチャンクに分割して `Promise.all` で取得を行う。
  - 取得したクイズデータから `quizId -> { genre, tags }` のキャッシュマップを作成し、クライアントサイドでジャンル別・タグ別の「プレイ回数」および「正答率」（セッション数3回以上を対象）を計算する。

## 2. 設計上の決定とトレードオフ

### 決定: クライアントサイドでの統計集計
- **Context**: プレイ履歴に基づく統計（よくプレイするジャンル、正答率など）の算出。
- **選択アプローチ**: API Routes や Cloud Functions などで集計するのではなく、クライアントの `PlayerDashboardClient` 内の `useEffect` で必要な raw データをバッチロードし、クライアント側のピュア関数（`src/lib/player-stats.ts`）で集計を行う。
- **理由**: 個人ダッシュボードの履歴数は高々100件であり、データの転送量および集計負荷が極めて小さいため、新規のサーバーサイドAPIや集計バックグラウンド処理を追加するオーバーヘッドを排除し、シンプルなクライアント集計で十分なパフォーマンスを得られる。

### 決定: 正答率算出時の最低プレイ回数（3回以上）の足切り
- **Context**: 正答率の高いジャンル/タグの集計。
- **選択アプローチ**: プレイ回数（Attempt数）が3回以上のジャンル・タグのみを「正答率の高い順」の分母対象とする。
- **理由**: 1問だけプレイして1問正解（正答率100%）となったような「たまたま全問正解しただけの低頻度ジャンル/タグ」が上位を占めてしまうのを防ぎ、真にプレイヤーが得意とするジャンル/タグを可視化するため。

## 3. リスクと緩和策
- **クイズ大量取得時の Firestore 読み取りコスト**:
  - 直近100件のプレイ履歴に対して、もしすべて異なるクイズだった場合、最大100件の `quizzes` ドキュメント取得が発生する。
  - **緩和策**: 統計範囲を直近「100件の完了した attempts」に制限することで、最悪ケースでも 100 読み取りに抑える。また、多くのプレイヤーは同じクイズをリプレイしたり、一部のクイズに偏るため、実際のユニークなクイズID数は 100 より大幅に小さくなり、コストは実用上問題ない範囲に収まる。


## Document Status
- 分析: Grep/Read + core API 確認
- Discovery 種別: **Light（Extension）**
- 外部 Web 調査: 不要

---

# Gap Analysis: クリエイターダッシュボード等の非同期表示最適化（Phase 12 追記 — 2026-06-07）

## 1. 調査と分析のサマリー
- **機能**: クリエイターダッシュボード（`/creator/dashboard`）およびクイズ作成・編集（`/quiz/create`, `/quiz/[id]/edit`）、リスト編集（`/list/...`）における Next.js Streaming 機能と Suspense を活用した非同期スケルトン表示。
- **実装アプローチ**:
  - 各ページの `page.tsx` を Server Component に移行し、静的なヘッダー枠、サイドバー、新規作成アクションエリアなどの静的レイアウトフレームをサーバー側で先行してレンダリング・配信。
  - アナリティクス累計統計、作成したクイズ一覧、間違い指摘フィードバックキュー、アナリティクスグラフのフェッチ処理を、それぞれ個別の非同期コンポーネント（または Promise 渡し）に分離。
  - 各非同期ロード部分を個別の `<Suspense fallback={<Skeleton />}>` でラッピングして Streaming 配信。

## 2. 設計上の決定とトレードオフ

### 決定: ダッシュボード内の Suspense 境界の細分化
- **Context**: 累計数値統計、クイズ一覧、指摘キュー、グラフなど、データ取得元が異なる多様なコンポーネントが混在。
- **選択アプローチ**: すべてを一括で Suspense にするのではなく、統計カード、クイズ一覧、指摘キュー、グラフの4つの境界に分離し、個別にスケルトンを表示する。
- **理由**: いずれか一つのデータ取得が遅れても、他の統計数値やクイズ一覧が即座に表示され、作成者の画面操作（クイズ新規作成等）へのストレスを軽減するため。

### 決定: クライアント側ローディングの廃止とサーバーサイドフェッチ化
- **Context**: クイズ作成・編集画面やリスト詳細画面の非同期ロード。
- **選択アプローチ**: `page.tsx` を Server Component 化し、Firestore のクエリ処理をサーバーコンポーネント内の Promise としてフェッチし、それをクライアントコンポーネントに Props（Promise）として渡すか、非同期 RSC の内部で描画する。
- **理由**: これにより、クライアント側での `useEffect` に依存した空画面ローディング（「読み込み中...」のスピナー）を排除し、Next.js の Suspense フォールバックによる洗練されたスケルトン表示に一本化できるため。

## 3. リスクと緩和策
- **テスト自動化 (Playwright/Jest) への影響**:
  - 非同期ロードによって、統計数値などの要素がテスト起動時にレンダリングされていないバグ。
  - **緩和策**: 各スケルトン領域に固有の `data-testid`（`stats-skeleton`, `quiz-list-skeleton`, `feedback-list-skeleton`, `charts-skeleton`）を付与し、テストコード側で「スケルトンの消失」を明示的に待つ（`waitForElementToBeRemoved` 等）設計とする。

---

## Phase 20: 〇×作問 UI（2026-06-09）

### Summary
`quiz-editor.tsx` は `true-false` を mixed の allowedTypes に含むが、形式カード・問題タイプトグル・`handleToggleQuestionType` に未対応。`TrueFalseCorrectToggle` を新設し、`createTrueFalseChoices`（core lib）で choices を生成。選択肢テキスト入力 UI は提供しない。

### Design Decisions
1. 選択式単一形式と同型 — `format === 'true-false'` で全問固定、トグル非表示。
2. 正解変更は choices 丸置換（ID 安定化で採点一貫性を維持）。

**Document Status（Phase 20 設計）**: `design.md` Phase 20 節に反映済。

---

## Phase 26: リスト作成・編集 UI 廃止（2026-06-10）

### Summary
- **Discovery Type**: Extension（削除）。`app/lists/new`・`app/lists/[id]/edit`・`list-editor`・`list-form`・ダッシュボード「リストを作成」CTA を除去。
- **Key Findings**:
  - ダッシュボードの `QuizListSkeleton` はクイズ一覧用 — リスト機能と無関係。
  - リスト編集は creator-dash 所有だが、探索・プレイ側ルート削除と並列実施可能（Core 完了後）。

### Design Decisions
1. **CTA 除去のみ** — ダッシュボードレイアウトは維持、リスト導線だけ削除。
2. **404** — 旧 `/lists/new` 等はルート削除で 404。

**Document Status（Phase 26 設計）**: `design.md` Phase 26 節に反映済。

---

# Gap Analysis: 間違い指摘キューの解消（解決）機能（Phase 28 追記 — 2026-06-28）

## 1. 調査と分析のサマリー
- **機能**: クリエイターダッシュボードの間違い指摘キューで、個別の指摘を解決済みにするアクションの提供、API（`resolveReport`）連携、および通知機能のバグ修正。
- **実装アプローチ**:
  - `dashboard-sections.tsx` の `FeedbackSection` コンポーネント内の各指摘カードに、「解決済みにする」ボタンを追加。
  - ボタンがクリックされた際、`src/services/review.ts` の `resolveReport(report.id)` を非同期で呼び出す。
  - 実行中は、状態管理用のローカルステート（`resolvingId` 等）を使用し、処理中の指摘カード内の「解決済みにする」および「修正する」ボタンを disabled にして二重送信を防止する。
  - 処理が成功した場合、`dashboard-client.tsx` で保持している `feedbacks` 状態（`FeedbackReport[]`）から該当指摘を即座に除外（`setFeedbacks(prev => prev.filter(...))`）するためのコールバック関数（`onResolve`等）を実行し、画面からカードを消去する。
- **発見されたギャップ（バグ）**:
  - `src/services/review.ts` の `resolveReport` 関数において、追加される通知（`notifications`）のデータ構造が現在の `Notification` スキーマ（`src/services/notification.ts`）および `firestore.rules` の認可要件と不整合を起こしている。
    - `recipientId` という古いプロパティが使われているため、認可に必要な `userId` が欠落し、セキュリティルール（`resource.data.userId == request.auth.uid`）によって受信者が通知を読み取ることができない。
    - `type` に `report_resolved` という未定義の文字列が指定されている（正しくは `correction_resolved`）。
    - 遷移先情報として `quizId` / `quizTitle` が使われているが、通知クライアント（`notifications-client.tsx`）側では `targetId` / `targetTitle` が期待されている。
    - `Notification` スキーマで必須とされる `senderId`, `senderName`, `senderAvatar` が通知オブジェクトに存在しない。

## 2. 設計上の決定とトレードオフ

### 決定: resolveReport 側のバグ修正を本フェーズに統合
- **Context**: 既存の `resolveReport` に通知スキーマおよびセキュリティルールとの不整合（バグ）が存在する。
- **選択アプローチ**: UI側のボタン追加だけでなく、依存する `src/services/review.ts` の `resolveReport` 内の通知オブジェクト構築処理のバグ（`userId`, `type: 'correction_resolved'`, `targetId/targetTitle`, `sender*` の付与）を一緒に修正する。
- **理由**: API側の通知作成処理がバグを孕んだままだと、UIから `resolveReport` を呼び出した際にセキュリティ認可違反、あるいはプレイヤー側に通知が届かない問題が発生し、機能の「解消」という要件を実質的に満たせなくなるため。同じリポジトリのコードであるため、一括で修正するのが最も安全かつ効率的。

### 決定: コールバックによるクライアント側状態の同期
- **Context**: 指摘解決成功時のダッシュボード上の状態更新。
- **選択アプローチ**: 解決成功後にダッシュボードのデータを再フェッチするのではなく、親の `CreatorDashboardClientInner` 側で定義したステート更新関数を通じて、クライアントサイドの配列から解決済み指摘をフィルタアウトする。
- **理由**: 無駄な Firestore 読み取りを発生させず、UI を即座に更新することで、軽快なレスポンス（UXの向上）が得られるため。

## 3. リスクと緩和策
- **通知作成時の `sender` 情報不足**:
  - `resolveReport` はクイズの作成者（解決者）が呼び出すが、作成者のユーザー名やアバターを特定するために追加のフェッチが必要になると非効率。
  - **緩和策**: `senderId` はシステムまたは解決者とし、通知クライアント側でアイコン描画などの表示が壊れない最低限のダッシュデータ（例: `senderName: "運営"` などのシステム固定値）を設定することで、追加クエリを最小限に抑える。

## Document Status
- 分析: Grep/Read + コードベースのバグ特定
- Discovery 種別: **Light（Extension / Bugfix）**
- 外部 Web 調査: 不要

---

# Phase 40: 作成したクイズ画面（2026-07-12 追記）

## Summary
- **Discovery Scope**: Extension（軽量ディスカバリー）
- **Key Findings**:
  - 「非公開」相当の機能（`visibility: 'private'`/`'followers'`）と Pro プラン制限（`assertCanSetQuizVisibilitySync` 等）は `src/lib/quiz-access.ts` および `src/services/quiz.ts` の `updateQuiz` に既に実装済みだが、UI からの露出が一切ない。
  - 作成者クイズの検索（`searchAuthorQuizzes`）は全件取得後のクライアント側配列フィルタ方式であり、ジャンル・統合ステータス・並び替えオプションは未対応。DBカーソルページング（`getQuizzesByAuthorPage`）とは別実装で、両者を単純合成できない。
  - クイズ単位の未解決指摘件数を集計する既存関数は存在しない。

## Research Log

### 統合ステータス（公開・限定公開・非公開・下書き）の表現
- **Context**: 要件17は `status`（draft/published/suspended）と `visibility`（public/followers/private）という直交する2軸を1つの統合ステータスとして表示することを求める。
- **Sources Consulted**: `src/types/index.ts`（`Quiz`, `QuizVisibility`）、`src/lib/quiz-access.ts`（`resolveQuizVisibility`, `canViewQuiz`）。
- **Findings**: `visibility` は `published` クイズにのみ意味を持つ（`draft`/`suspended` では UI 上不要）。`resolveQuizVisibility()` が `visibility ?? 'public'` のデフォルト解決を既に提供している。
- **Implications**: 新規の永続化フィールドは不要。`status` と `resolveQuizVisibility(quiz)` から統合ステータスを導出する純粋関数を1つ追加すればよい。

### クイズ検索・絞り込み・並び替えの拡張ポイント
- **Context**: 要件16はキーワード・統合ステータス・ジャンル・タグの AND 絞り込みと、クイズ名・プレイ回数・作成日の並び替えを求める。
- **Sources Consulted**: `src/services/author-quiz-search.ts`, `src/lib/author-quiz-search.ts`, `src/services/quiz.ts`（`getQuizzesByAuthor`, `getQuizzesByAuthorPage`）。
- **Findings**: `searchAuthorQuizzes` は `getQuizzesByAuthor(authorId, includeDrafts)` で作成者の全クイズを一度に取得し、`filterAuthorQuizzes` / `filterAuthorQuizzesWithQuestions`（純関数、`src/lib/author-quiz-search.ts`）でキーワード・タグのみをクライアント側フィルタしている。DB クエリの変更は不要。一方 `getQuizzesByAuthorPage` は `created_at desc` 固定のカーソルページングで、検索パラメータを持たない。
- **Implications**: 統合ステータス・ジャンル・並び替えを追加する場合、`getQuizzesByAuthorPage` のカーソルページングとは統合せず、既存の「全件取得 + クライアント側フィルタ/ソート」方式をそのまま拡張するのが最小変更。作成者本人のクイズ件数は数百件規模を想定し、全件クライアント処理で許容範囲と判断（Performance & Scalability 参照）。

### 未解決指摘件数の集計
- **Context**: 要件18はクイズ単位の未解決指摘件数バッジを求めるが、既存にクイズ単位の集計関数はない。
- **Sources Consulted**: `src/services/review.ts`（`getReportsForCreator`, `getOpenReportsByQuizId` 等）。
- **Findings**: `getReportsForCreator(creatorId)` は作成者の全公開クイズ横断で `status: 'open'` の `FeedbackReport[]` をフラット取得する。クイズ ID ごとの `reduce` 集計は呼び出し側で行っていない。
- **Implications**: 既存関数を変更せず、新規関数 `getOpenReportCountsByCreator(creatorId): Promise<Record<string, number>>` を追加する（`getReportsForCreator` を呼んで `quizId` で集計するラッパー）。既存の「単一クイズ用」「作成者全体用」の関数分離パターンに整合する。

### 公開範囲変更のエラーハンドリング
- **Context**: Pro 未満のユーザーが非公開・限定公開への切替を試みた場合の UI 挙動（要件17.6, 17.7）。
- **Sources Consulted**: `src/lib/quiz-access.ts`（`ProRequiredForVisibilityError`, `assertCanSetQuizVisibilitySync`）、`src/services/quiz.ts`（`updateQuiz` 内 `enforceVisibilityEntitlement`）。
- **Findings**: `updateQuiz` は内部で `assertCanSetQuizVisibilitySync` を呼び、Pro 未満なら `ProRequiredForVisibilityError`（`code: 'pro-required-for-visibility'`）を throw する。UI 側でこの例外を捕捉する既存の呼び出し例は見つからなかった（現状 UI 未実装のため）。
- **Implications**: フロントで `canAccessProVisibility(entitlementFields)` を使い事前にトグルを disabled 化する（要件17.6）のに加え、`updateQuiz` 呼び出しを try/catch し `error.code === 'pro-required-for-visibility'` を判定してエラー表示にフォールバックする（要件17.7、二重防御）。

### アップグレード導線・UI コンポーネントパターン
- **Context**: Pro 未満ユーザー向けのアップグレード導線 UI。
- **Sources Consulted**: `src/components/quiz/editor/ai-quiz-pro-upsell.tsx`、`src/components/explore/explore-search-section.tsx`（336行目 `SelectTrigger title=...` disabled+tooltip パターン）。
- **Findings**: 既存の `ai-quiz-pro-upsell.tsx` が「説明文 + `/pricing` へのリンクボタン」という定型パターンを持つ。Select 系コンポーネントの disabled 状態には `title` 属性で理由を補足する既存パターンがある。
- **Implications**: 新規コンポーネントはこの2つの既存パターンを組み合わせて実装する（新規デザイン言語を持ち込まない）。

### スタイリング方針
- **Context**: `/creator/quizzes` を Tailwind + shadcn/ui にするか CSS Modules にするか。
- **Findings**: `/creator/dashboard` 配下は既に全面 Tailwind + shadcn/ui（`Card`, `Badge`, `Button`, `Select`, `Tabs`）。CSS Modules は `quiz/editor/` の一部にのみ残存。
- **Implications**: 新規画面も Tailwind + shadcn/ui に統一する（steering の Phase 24 方針と整合）。

### 既存ダッシュボードとの統合影響
- **Context**: `creator-quiz-list`（`QuizListSection`）撤去の影響範囲。
- **Sources Consulted**: `src/app/creator/dashboard/dashboard-client.tsx`, `dashboard-sections.tsx`, `e2e/creator-dashboard.spec.ts`。
- **Findings**: `dashboard-client.tsx` は `quizzes` state を `QuizListSection` 表示のためだけに保持しており、他セクション（アナリティクス等）とは独立している。撤去してもアナリティクス系 state 管理には影響しない。既存 E2E（`e2e/creator-dashboard.spec.ts`）が `creator-quiz-list`/`quiz-card` を直接 assert しているため更新必須。
- **Implications**: `dashboard-client.tsx` から `getQuizzesByAuthor` 呼び出しと `quizzes` state を削除し、`QuizListSection` の代わりに軽量な `<Link href="/creator/quizzes">` カードに置き換える。E2E は該当 assertion を新画面向けに移設する。

## Architecture Pattern Evaluation（Phase 40）

| Option | Description | Strengths | Risks / Limitations | 判定 |
|--------|-------------|-----------|---------------------|------|
| 全件取得＋クライアント側フィルタ/ソート/仮想ページング | 既存 `searchAuthorQuizzes` 方式を拡張し、フィルタ・ソート・「もっと見る」による段階表示をすべてメモリ上で行う | 実装が最小、既存パターンと整合、DBクエリ変更不要 | 作成者のクイズ数が非常に多い場合に初回ロードが重くなる | **採用** |
| DBカーソルページング＋サーバー側フィルタ拡張 | `getQuizzesByAuthorPage` にジャンル/ステータス/並び替えパラメータを追加しDBクエリで解決 | 大量データでもスケールする | 既存の「検索はクライアントフィルタ」という設計原則からの逸脱、Supabaseクエリの複雑化、変更範囲が `quizetika-core` 側に及ぶ | 却下（過剰実装、Simplification原則） |

## Design Decisions（Phase 40）

### Decision: 統合ステータスの導出方法
- **Context**: `status` と `visibility` の2軸を1つの表示用ステータスにまとめる必要がある。
- **Alternatives Considered**:
  1. 新規 DB カラム `displayStatus` を追加し、更新のたびに同期する
  2. 表示時に `status`/`visibility` から都度導出する純粋関数
- **Selected Approach**: 2（純粋関数 `resolveCreatorQuizStatus(quiz): CreatorQuizStatus`）
- **Rationale**: 既存の `resolveQuizVisibility` と同じ「保存値を増やさず導出する」パターンに従う。同期漏れ・不整合のリスクがない。
- **Trade-offs**: 導出ロジックを呼び出し側（一覧表示・フィルタ・ソート）で都度実行するが、演算コストは無視できるレベル。
- **Follow-up**: `src/lib/creator-quiz-status.ts` に配置し、`src/lib/quiz-access.ts` の `resolveQuizVisibility` を内部で再利用する。

### Decision: 公開範囲変更のAPI設計
- **Context**: 公開・限定公開・非公開の切替をどう永続化するか。
- **Alternatives Considered**:
  1. 新規専用API（`setQuizVisibility`）を作る
  2. 既存 `updateQuiz(quizId, { visibility })` をそのまま呼ぶ
- **Selected Approach**: 2
- **Rationale**: `updateQuiz` は既に `visibility` 更新とPro制限検証（`enforceVisibilityEntitlement`）を内包しており、新規APIは重複実装になる（Build vs Adopt原則）。
- **Trade-offs**: なし。既存契約をそのまま利用するため後方互換性の懸念もない。
- **Follow-up**: UI側は `updateQuiz` 呼び出し前に `canAccessProVisibility` でトグルのdisabled判定を行い、UX上の二重防御とする。

### Decision: 未解決指摘件数の集計方法
- **Context**: クイズ単位の未解決指摘件数をどう取得するか。
- **Alternatives Considered**:
  1. `getReportsForCreator` の返り値をUI側で `reduce` 集計する
  2. サービス層に新規関数 `getOpenReportCountsByCreator` を追加し、集計済みの `Record<string, number>` を返す
- **Selected Approach**: 2
- **Rationale**: 既存のサービス層は「UIに生データを渡さず、用途に応じた形で返す」パターン（`getOpenReportsByQuizId` 等の専用関数群）を踏襲しており、UI側集計より一貫性が高い。
- **Trade-offs**: サービス層に1関数増えるが、責務分離が明確になる。
- **Follow-up**: `src/services/review.ts` に追加し、内部で `getReportsForCreator` と同等のクエリ結果を `quiz_id` でグルーピングする。

## Risks & Mitigations（Phase 40）
- 作成者のクイズ数が将来的に増加した場合、全件クライアントフィルタ方式のロード時間が悪化する — 既存 `searchAuthorQuizzes` と同一の制約であり新規リスクではない。閾値超過が観測されたら DB 側ページング＋フィルタへの移行を再検討する（Revalidation Trigger）。
- `updateQuiz` の `ProRequiredForVisibilityError` を握りつぶすと「切替が反映されない」ように見えるUXになる — 設計で try/catch 必須化し、エラーメッセージ表示を明示的に要求する。
- ダッシュボードの `creator-quiz-list` 撤去により既存 E2E（`e2e/creator-dashboard.spec.ts`）が壊れる — タスク側で当該テストの更新を必須タスクとして明記する。

## Document Status（Phase 40）
- 分析: Grep/Read によるコードベース調査（Explore subagent 経由）
- Discovery 種別: **Light（Extension）**
- 外部 Web 調査: 不要

### `/kiro-validate-design` レビュー結果の反映（2026-07-12）
- **懸念1（ジャンル絞り込みとレガシー/orphan `canonicalGenreId`）**: `src/services/quiz.ts` の `createQuiz`/`updateQuiz` は `genre` 設定時に `canonicalGenreId` を都度解決するが、要件5.5が想定するレガシー・マージ保留クイズでは現行マスタ外の値のまま残り得る。ユーザー判断により、ジャンル絞り込み指定時はこれらを結果から除外する仕様とし、requirements.md 要件16に基準5を追加、design.md の `author-quiz-search.ts` File Structure Plan 行に明記した。
- **懸念2（`suspended` ステータスの統合ステータス表示）**: `quiz-access.ts` の `canViewQuiz` は `suspended` を作成者本人の `draft` とは異なる特別扱いにしている。ユーザー判断により、統合ステータスに独立した5値目（「審査により非表示」）を追加し、requirements.md 要件17に基準3を追加、design.md の `resolveCreatorQuizStatus` を5値ユニオン型に修正した。
- **軽微指摘（空状態の書き分け）**: 要件15.6（クイズ0件）と要件16.8（絞り込み結果0件）で異なるCTAを出すことを `creator-quiz-management-sections.tsx` の File Structure Plan 行に明記した。

## Design Synthesis: Phase 41 Creator プラン表記への更新（2026-07-13）

### Summary
- **Discovery Type**: Light（表示文言の更新のみ）
- **背景**: `quizetika-core` Phase 41 で `pro` tier が `creator` にリネームされる。本スペックが参照する `canAccessProVisibility()` / `ProRequiredForVisibilityError` は識別子を維持する（`quizetika-core` design.md Phase 41 の決定）ため、本スペック側の変更はエラーメッセージ・ツールチップ文言の Creator 表記化のみに限定される。

### Design Decisions
#### Decision: 識別子は維持し文言のみ更新
- **Context**: `quizetika-core` が関数・クラス名（`canAccessProVisibility`, `ProRequiredForVisibilityError`）を維持する決定をしたため、本スペック側で対応するコード変更は最小限で済む。
- **Selected Approach**: `creator-quiz-visibility-toggle.tsx` 内のツールチップ・エラー表示文言のみ「Pro」→「Creator」に置換する。
- **Rationale**: 識別子リネームまで追随すると `quizetika-core` の決定と重複作業になり、かつ両スペックの実装順序に強い結合が生まれる。文言のみの変更であれば `quizetika-core` の内部判定変更が完了していれば独立して実装できる。

### Document Status（Phase 41）
- 入力: `quizetika-core` design.md Phase 41 節
- 出力: `design.md` Phase 41 節、本節

## Design Synthesis: Phase 42 プレイヤーワードクラウド（2026-07-17）

### Summary
- **Discovery Type**: Light（Extension — 既存プレイヤーダッシュボードのデータフロー延長）
- **調査済み事項**: `computePlayerStats`（`src/lib/player-stats.ts`）は既にタグ別の count/correct/total を `tagStatsMap` で全量集計しており、表示側が上位5件に切っているのみ。ワードクラウドの重み・色データは既存集計の露出拡張で賄える。チャート系は Recharts のみ導入済みで、ワードクラウド専用ライブラリ（d3-cloud, react-wordcloud 等）は未導入。

### Investigations
- **描画ライブラリの要否**: package.json に該当ライブラリなし。d3-cloud はレイアウト計算がクライアント専用で SSR 回避策と依存追加が必要。表示要件（大きさ・色・切り替え・凡例）は flex-wrap + フォントサイズ重み付けで満たせるため、Build（自作 CSS）を採用（ユーザー承認済み）。
- **日本語タイトルの分かち書き**: kuromoji 等の形態素解析は辞書アセットが重い。`Intl.Segmenter('ja', { granularity: 'word' })` はブラウザ主要環境・Node 16+（full-icu）で利用可能で依存追加ゼロ。Jest（Node 実行）でもそのまま動作する。未対応環境向けに空白・記号 split のフォールバックを用意。
- **配色**: 既存チャートは `var(--chart-1..5)` を使用するが、正答率は順序尺度のためカテゴリカルパレットは不適。Tailwind の emerald/amber/red 系クラス（dark バリアント併記）+ muted によるバケット表現を採用。

### Design Decisions
#### Decision: クライアント側集計の継続（サーバー集計は導入しない）
- **Context**: ワードクラウド用の頻度・正答率集計をどこで行うか。
- **Selected Approach**: 既存 `computePlayerStats` の拡張（`tagCloud`/`keywordCloud` フィールド追加、`quizMap` に `title` 追加）。
- **Rationale**: Phase 27 の Boundary Commitments（「attempts のサーバー側自動集計は Out of Boundary」「直近100件クライアント集計」）と整合。入力データは既に取得済みで追加フェッチ不要。
- **Trade-offs**: 集計対象が直近100件に限定されるが、これは要件 20.4 が明示的に許容（要件 13.7 と同一データ源）。

#### Decision: 決定的シャッフルによる配置
- **Context**: クラウドらしい見た目（大きい語の分散）と要件 20.14（再表示で並びが不変）の両立。
- **Selected Approach**: 語の文字列ハッシュをソートキーにした決定的並び替え。`Math.random` 不使用。
- **Rationale**: hydration mismatch を起こさず、スナップショットテストも安定する。

### Document Status（Phase 42）
- 分析: 事前プランニングでの Explore subagent 調査 + main context での既存実装 Read
- 外部 Web 調査: 不要（標準 API のみ）
- 出力: `design.md` Phase 42 節、本節

---

## Gap Analysis: Phase 44 リッチダッシュボード刷新（2026-07-18・`/kiro-validate-gap`）

対象: roadmap.md Phase 44（フィルタリング・ドリルダウン対応のダッシュボード刷新）。requirements.md への Phase 44 要件追記前の事前ギャップ分析。

### 1. Current State Investigation（現状資産）

**UI 層（本スペック所有）**:

- `src/app/creator/dashboard/dashboard-client.tsx` — タブ構成（プレイヤー/クリエイター）。クリエイター側は `getQuizzesByAuthor` + `getReportsForCreator` をクライアントで取得。**注意: 指摘0件時にモック指摘を注入するコードが本番経路に残存**（`mock_fb_1`、69〜84行目）— Phase 44 刷新時に撤去すべき技術的負債。
- `src/app/creator/dashboard/player-dashboard-client.tsx` — `listUserPlayHistory({ limit: 100 })` + ユニーククイズごとの `getQuiz` N+1 取得 → `computePlayerStats` でクライアント集計。
- `src/app/creator/dashboard/dashboard-sections.tsx` — セクション群（KPI グリッド、チャート、ワードクラウド、ジャンル/タグ分析、履歴、指摘キュー）。
- チャート基盤: `recharts` + `src/components/ui/chart.tsx`（shadcn ラッパー）+ `src/components/charts/`（`analytics-chart`, `selection-pie`, `word-cloud`, スケルトン2種）。フィルタ UI 用の shadcn `Select`/`Tabs`/`Badge` は導入済み。
- E2E: `e2e/creator-dashboard.spec.ts`、Jest: `tests/components/dashboard-client.test.tsx` が既存 `data-testid` を assert。

**集計ロジック層（quizeum-core 側資産）**:

- `src/lib/player-stats.ts` — `PlayerStats`（KPI、直近7日推移、モード割合、ジャンル/タグ上位5、ワードクラウド）。全量が「直近100件」母集団。
- `src/lib/dashboard-stats.ts` — `DashboardStats`（クイズのキャッシュ済みカウンタ合算のみ。期間次元なし）。
- `src/services/attempt.ts` — `listUserPlayHistory`（カーソルページング、`completed_at IS NOT NULL` フィルタ）、RPC 呼び出しパターン（`handle_save_attempt` 等）確立済み。

**データモデル（Supabase）**:

- `attempts`: `user_id`, `quiz_id`, `mode`, `score`, `total_questions`, `elapsed_seconds`, `failed_question_ids`, `question_answers`/`question_answer_details`(JSONB), `completed_at`(nullable), `gave_up_lateral`。**完了時のみ INSERT**（例外: ウミガメのスープのみ開始時に未完了行を作成）。
- インデックス: `idx_attempts_user_history (user_id, completed_at DESC)`, `idx_attempts_quiz_id (quiz_id)`。
- `quizzes`: `canonical_genre_id`, `tags TEXT[]`, `format`, `play_count`, `bookmarks_count`, `review_score` 等のキャッシュカウンタ。
- `questions`: `type`（設問単位の形式）, `correct_count`/`incorrect_count`（累計）, `choices` JSONB 内 `selectedCount`（累計）。
- 期間集計に使える生イベント: `attempts.completed_at`, `bookmarks.created_at`, `quiz_reviews.created_at`, `follows.created_at`。
- RPC パターン: マイグレーション内 `handle_*` 関数 + `supabase.rpc()` + `npm run gen:types` による型生成が確立済み。

### 2. Requirement-to-Asset Map（ギャップ表）

| Phase 44 の表示情報 | 既存資産 | ギャップ判定 |
| --- | --- | --- |
| 期間フィルタ付きプレイヤー集計（全期間対応） | クライアント集計（直近100件限定） | **Missing** — サーバーサイド集計 RPC が必要 |
| ジャンル・タグ・形式・モード別の回数/正答率 | ジャンル/タグ上位5のみ（100件母集団） | **Missing** — RPC で `attempts JOIN quizzes` 集計 |
| 問題形式別分析 | `quizzes.format`（クイズ単位）と `questions.type`（設問単位）が併存 | **Unknown** — どちらの粒度で集計するか要件で確定。設問単位は `question_answer_details` JSONB の unnest が必要 |
| ストリーク（連続プレイ日数） | `idx_attempts_user_history` あり | **Missing（実装のみ）** — データは揃っており RPC で算出可能 |
| プレイヤードリルダウン（集計→履歴→設問別正誤） | `question_answer_details` JSONB が attempt ごとに保存済み、RLS で本人参照可 | **Missing（UI/取得関数のみ）** — データ基盤は存在 |
| クリエイター期間トレンド（プレイ/ブックマーク/評価） | `attempts`/`bookmarks`/`quiz_reviews` に created_at 系列あり | **Missing + Constraint** — 下記 RLS 制約により RPC 必須 |
| ユニークプレイヤー数・完走率 | attempts に user_id あり / **未完了レコードなし** | ユニーク数: **Missing（RPC）**。完走率・離脱ポイント: **Missing（データ自体が不在）** — 下記参照 |
| 設問別解答分布の期間フィルタ | `questions.correct_count`・`choices.selectedCount` は累計のみ | **Constraint** — 累計表示は既存資産で可。期間フィルタ対応は `question_answer_details` の集計が必要でコスト大 |
| フォロワー数・推移 | `follows`（現在のフォロー関係のみ、解除で行削除） | 現在数: あり。**推移: Missing（履歴データ不在）** — スナップショット/イベント記録がなく過去時点を復元不可 |
| ワードクラウドのフィルタ連動 | `computePlayerStats` 内で全量集計済み | 集計母集団をフィルタ結果に差し替えれば追随可 |

### 3. 重要な技術的制約（Blocker 級）

1. **attempts の RLS は本人行のみ**（`attempts_all: auth.uid() = user_id`、init.sql 415行目）。クリエイターが自作クイズの他プレイヤーのプレイデータを読む経路がクライアントには存在しない。クリエイター側の期間トレンド・ユニークプレイヤー数・設問別期間分析は **SECURITY DEFINER の RPC（author 本人検証付き）またはサーバーサイド（service role）API Route が必須**。個人情報保護の観点から、RPC は集計値のみを返し、個別プレイヤーの生行を露出しない設計とすること。
2. **完走率・離脱ポイントはデータ不在**。ウミガメ以外の attempt は完了時にのみ INSERT され（`handle_save_attempt`）、開始・中断イベントの記録がない。対応肢: (a) Phase 44 スコープから除外、(b) 全モードに「開始時 INSERT + 完了時 UPDATE」を導入（`handle_save_attempt` 契約の変更＝プレイフロー全体への波及、影響大）、(c) PostHog イベントによる運営向け近似分析で代替しユーザー向けダッシュボードには載せない。**要件フェーズでの判断事項**。
3. **ジャンル集計は「現在のクイズ属性」で行われる**。attempts にジャンル/形式の非正規化がなく JOIN 解決のため、プレイ後にクイズのジャンルが変わると過去プレイも新ジャンルで集計される。roadmap 記載どおり許容可否を要件で確定。
4. **集計パフォーマンス**: クリエイター側集計は `attempts.quiz_id IN (自作クイズ)` の走査になる。`idx_attempts_quiz_id` はあるが `completed_at` との複合ではないため、データ増加時は複合インデックス `(quiz_id, completed_at)` の追加を設計で検討。

### 4. Implementation Approach Options

#### Option A: クライアント集計の拡大（取得件数増 + クライアントフィルタ）

- 現行 `listUserPlayHistory` の limit を拡大し、フィルタもクライアントで実施。
- ✅ 変更最小、既存 Phase 27/42 パターン維持
- ❌ プレイヤー側ですら履歴増で破綻（N+1 も悪化）。**クリエイター側は RLS 制約により原理的に実現不可能**。
- 判定: **却下**（Phase 44 の中核要求を満たせない）

#### Option B: サーバーサイド集計 RPC への全面移行

- フィルタパラメータ（期間・ジャンル・タグ・形式・モード）を受ける集計 RPC 群を新設（プレイヤー用: SECURITY INVOKER で RLS 内動作可 / クリエイター用: SECURITY DEFINER + author 検証）。`src/services/` に対応サービス関数、`src/lib/` の `PlayerStats`/`DashboardStats` を後継契約に置換。
- ✅ 全期間・任意フィルタ・両タブを単一パターンで解決。型生成（gen:types）・RPC 実装パターン確立済み
- ❌ マイグレーション + RPC 設計 + テスト（チェーンモックでなく rpc モック）で変更量大。Phase 27 の「サーバー側集計は Out of Boundary」コミットメントの明示的な上書きが必要
- 判定: **推奨**

#### Option C: ハイブリッド（累計 KPI はキャッシュカウンタ維持 + フィルタ分析のみ RPC）

- 既存の累計 KPI（総プレイ・ブックマーク・評価）と設問別累計分布はキャッシュカウンタ表示を維持し、期間・フィルタ連動セクションのみ新 RPC で提供。
- ✅ 変更範囲を段階化でき、初期リリースが早い。累計値はカウンタの方が安価
- ❌ 「累計は即時・フィルタ集計は attempts 由来」で数値のズレ（過去の削除クイズ・匿名化等）が生じ、同一画面内の整合性説明が必要
- 判定: 次点（Option B のフェーズ分割戦略として設計時に再評価）

### 5. Effort & Risk

- **Effort: XL（2週間超）** — DB マイグレーション（RPC 群 + インデックス）、サービス層新設、両タブ UI 刷新（フィルタバー・ドリルダウン画面）、Jest/E2E 更新（既存 `data-testid` assert が広範囲）を含むため。Option C のフェーズ分割で L×2 に分割可能。
- **Risk: Medium** — 技術要素はすべて確立済みパターン（RPC・recharts・shadcn）だが、SECURITY DEFINER RPC の認可設計（author 検証・集計値のみ露出）と集計クエリのパフォーマンスに設計上の注意を要する。

### 6. Recommendations for Design Phase

- **推奨アプローチ**: Option B（設計時に Option C のフェーズ分割を検討）。
- **要件フェーズで確定すべき判断**（design 前提）:
  1. 完走率・離脱ポイントの扱い（除外 / 開始時レコード導入 / PostHog 代替）
  2. 問題形式別集計の粒度（クイズ単位 `format` か設問単位 `type` か）
  3. 「現在のクイズ属性で集計」トレードオフの許容
  4. フォロワー「推移」の要否（履歴データ不在のため現在数のみを推奨）
  5. 設問別解答分布の期間フィルタ要否（累計のみなら既存資産で低コスト）
- **Research Needed（設計フェーズへ持ち越し）**:
  - `question_answer_details` JSONB unnest 集計の実行計画とインデックス戦略（設問別期間分析を要件に含める場合）
  - クリエイター向け SECURITY DEFINER RPC の認可パターン（既存 `handle_*` 関数には author 検証付き集計の前例がないため新設計）
  - `quizzes.tags TEXT[]` と正規化テーブル `quiz_tags` のどちらをタグフィルタの正とするか（core-data 正規化との整合確認）
- **付随して解消すべき負債**: `dashboard-client.tsx` のモック指摘注入（本番経路）の撤去。

### Document Status（Phase 44 Gap Analysis）

- 分析: main context での Grep/Read によるコードベース・マイグレーション調査
- 外部 Web 調査: 不要（既存スタック内で完結）
- 入力: roadmap.md Phase 44 節（2026-07-18 ディスカバリー）
- 次工程: `/kiro-spec-requirements quizeum-creator-dash-ui`（および quizeum-core 側の要件追記）

## Design Synthesis: Phase 44 リッチダッシュボード UI（2026-07-18）

### Summary
- **Discovery Type**: Extension（本節冒頭の Gap Analysis で調査済み。追加調査なし）
- **前提**: 集計契約は `quizetika-core` Phase 44（design.md 同日節）で確定。ユーザー判断: 完走率=ライフサイクル記録導入 / 形式別=設問単位 / 設問別分布=累計のみ / フォロワー=非表示。

### Design Decisions
1. **新規ルートなしのビュー状態切替** — ドリルダウン・クイズ単体分析は `/creator/dashboard` 内の状態遷移で実現。タブ・フィルタ状態を保持したまま往復でき（要件 23.5/25.6）、E2E のルーティング前提も変わらない。URL 共有可能化は非要件のため見送り（過去 Phase 22 の URL 規則導入とは要件が異なる）。
2. **フィルタは非永続のコンポーネント状態** — `useDashboardFilters` フックをタブごとに保持。`localStorage`/URL 永続化は要件外であり Simplification 原則で見送り。
3. **stale レスポンス破棄** — フィルタ連打時の混在表示（要件 21.5）をリクエスト連番ガードで防止。既存 `cancelled` フラグパターンの延長。
4. **モック指摘注入の撤去** — `dashboard-client.tsx` の `mock_fb_1`（指摘0件時のダミー生成）は Phase 44 要件 24.8 で正式に撤去し空状態カードへ置換。既存 Jest がモック前提の場合はテスト側も更新。
5. **チャートは既存再利用 + `TrendChart` 1本のみ新設** — 複数系列トレンドは既存 `AnalyticsChart`（単一系列棒）で表現できないため recharts LineChart ラッパーを追加。他は既存（Build 最小化）。
6. **クイズ単体分析の累計データは `getQuiz` 再利用** — 設問別累計正答率・選択肢分布は `questions.correct_count`/`choices[].selectedCount` キャッシュカウンタから表示（core 設計と対応）。

### Risks & Mitigations
- 既存 E2E・Jest の testid/モック前提が広範囲に変わる — 既存 testid を維持しつつ新規 testid を追加する方針を要件 22.8 で固定し、E2E 更新をタスクに必須項目として含める。
- core 契約未確定のまま UI 実装が先行するリスク — 実装順を core → UI に固定（design.md Document Status に明記）。

**Document Status（Phase 44 設計）**: `design.md` Phase 44 節に反映（2026-07-18）。

### `/kiro-validate-design` レビュー結果の反映（2026-07-18）
- **指摘1（`player-stats.ts` の共有所有）**: core と UI 両方の File Plan に同一ファイルが登場していたため、改変の所有を core に一本化（core design.md に単独所有を明記、UI 側 File Plan から削除。UI は新契約の import 追随のみ）。
- **指摘2（E2E データ前提）**: モック指摘注入撤去後の E2E はローカル Supabase への実データ投入（試行・ブックマーク・評価）を前提とし、指摘 0 件は空状態を assert する方針を Testing Strategy に追記。
- **指摘3（ドリルダウン中のフィルタ変更）**: ドリルダウン・クイズ単体分析表示中もフィルタバー有効、変更時は当該ビューを新条件で再取得（明細表示中は一覧へ戻す）と Design Decisions に追記。
- 判定: **GO（修正適用済み）**。

