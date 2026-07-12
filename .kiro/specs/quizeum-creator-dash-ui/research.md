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

# Gap Analysis: 作家＆プレイヤー統合ダッシュボード（Phase 27 追記 — 2026-06-28）

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

# Gap Analysis: 作家ダッシュボード等の非同期表示最適化（Phase 12 追記 — 2026-06-07）

## 1. 調査と分析のサマリー
- **機能**: 作家ダッシュボード（`/creator/dashboard`）およびクイズ作成・編集（`/quiz/create`, `/quiz/[id]/edit`）、リスト編集（`/list/...`）における Next.js Streaming 機能と Suspense を活用した非同期スケルトン表示。
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
- **機能**: 作家ダッシュボードの間違い指摘キューで、個別の指摘を解決済みにするアクションの提供、API（`resolveReport`）連携、および通知機能のバグ修正。
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

# Phase 40: 作成クイズ管理画面（2026-07-12 追記）

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

