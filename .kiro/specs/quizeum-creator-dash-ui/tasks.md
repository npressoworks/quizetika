# Implementation Plan: quizeum-creator-dash-ui

## Tasks

### 1. クイズ作成・編集画面のUI実装
- [x] 1.1 クイズ基本メタデータ入力とタグ名寄せUIの実装 (P)
  - `src/app/quiz/create/page.tsx` および `create.module.css` を作成し、タイトル、難易度（1-10）、ジャンルセレクトボックスなどのメタデータ入力を実装する。
  - タグ入力時にリアルタイムで正規化（名寄せ）を行い、類似 canonical タグを検知した際に「推奨: 類似するタグ #React が既に存在します...」と親切なサジェスト警告をインライン表示するUIを構築する。
  - _Requirements: 1.1, 1.2, 1.3_
  - _Boundary: QuizEditor-Metadata_
- [x] 1.2 動的設問エディタと下書き保存機能の実装
  - 設問の動的な追加・削除、設問タイプ（選択式 / 短答文字入力式）の切り替えUIを構築する。
  - Zodバリデーションに抵触しない状態での「下書き保存」による Firestore 保存機能を実装する。
  - _Requirements: 1.4, 1.6_
  - _Boundary: QuizEditor-Questions_
- [x] 1.3 公開バリデーションとエラーインライン表示の実装
  - 「公開」申請時、Zodを用いて「各設問の入力」「正解が1つ以上設定されていること」を厳格に検証し、バリデーションエラーがある場合に画面上部にエラー一覧をスクロール表示する。
  - _Requirements: 1.5_
  - _Boundary: QuizEditor-Validation_

### 2. 作家ダッシュボードのUI実装
- [x] 2.1 累計アナリティクスグラフおよび個別設問解答割合グラフの実装 (P)
  - `src/app/creator/dashboard/page.tsx` および `dashboard.module.css` に、プレイ数等の累計アナリティクス用ライングラフ・バーグラフを実装する。
  - クイズ個別詳細パネル内に、各設問の解答選択肢別割合を表示するパイチャート風CSSコンポーネントを構築する。
  - _Requirements: 2.1, 2.2_
  - _Boundary: CreatorDashboard-Charts_
- [x] 2.2 クローズド間違い指摘のキュー管理と修正動線の実装
  - プレイヤーから送信された指摘レポートの一覧を表示し、「修正する」クリック時に該当クイズのエディタ画面に問題がプリロードされて遷移する動線を実装する。
  - _Requirements: 2.3, 2.4_
  - _Boundary: CreatorDashboard-Feedback_
- [x] 2.3 クイズ一括エクスポート機能の実装
  - 自身が作成したすべてのクイズ（下書き・公開中）を1つの JSON ファイルとしてクライアントサイドで構築し、ブラウザ経由でダウンロードするダウンロード処理を実装する。※インポート用UIは配置しない。
  - _Requirements: 2.5_
  - _Boundary: CreatorDashboard-Export_

### 3. クイズリスト詳細画面のUI実装
- [x] 3.1 クイズリスト基本情報と収録クイズ表示の実装 (P)
  - `src/app/list/[id]/page.tsx` および `list.module.css` を作成し、リストタイトル、作成者アバター、カバー画像、および収録クイズ of カード一覧を表示する。
  - _Requirements: 3.1_
  - _Boundary: QuizListDetail_
- [x] 3.2 リスト連続プレイおよび編集動線の実装
  - 「リストプレイ開始」クリック時に `attempts.listId` にリストIDを設定し、`mode = 'list'` として記録しながら順番にプレイを連続トラッキングするUI接続を実装する。
  - ログイン中の作成者本人である場合に「リストを編集する」ボタンを表示するガードを構築する。
  - _Requirements: 3.2, 3.3_
  - _Boundary: QuizListDetail-Actions_
 
### 4. リスト作成・編集画面のUI実装
- [x] 4.1 リストメタデータフォームとクイズ検索アタッチUIの実装 (P)
  - `src/app/list/create/page.tsx` および `edit.module.css` を作成し、タイトル、説明、公開/非公開トグルなどのフォームを実装する。
  - 自作クイズやお気に入りから検索し、リストにアタッチ/デタッチするUIを構築する。
  - _Requirements: 4.1_
  - _Boundary: QuizListEditor_
- [x] 4.2 HTML5 Drag and Dropによる並び替えとパッケージエクスポートの実装
  - アタッチしたクイズを HTML5 D&D API を用いてビジュアルに並べ替えるドラッグハンドルUIを実装する。
  - リスト情報および自作収録クイズをパッケージングした JSON のダウンロードエクスポート処理を実装する。※インポート用UIは設置しない。
  - _Requirements: 4.2, 4.3_
  - _Boundary: QuizListEditor-DragAndDrop_

---

### 5. Phase 6 拡張 — クイズエディタのジャンルマスタ連携（2026-06）

> **前提**: `quizeum-core` Phase 6 完了（`listActiveGenres`）。`useActiveGenres` は `quizeum-play-flow-ui` 実装済みフックを再利用可。

- [x] 5.1 (P) `GenreEditorSelect` コンポーネント
  - `useActiveGenres` で取得した `displayName` / `id` を `<select>` に描画する。
  - loading / error / 空一覧 / 再試行 UI を提供し、ハードコード option へフォールバックしない。
  - 制御値が active 一覧に無いときは orphan 用の追加 `<option>` を 1 件表示する（レガシー下書き対応）。
  - `data-testid="genre-editor-select"` を付与する。
  - **完了状態**: マスタ由来の option のみが正本であること。
  - _Requirements: 5.1, 5.2, 5.5, 5.6_
  - _Boundary: GenreEditorSelect_
  - _Depends: quizeum-core Phase 6_

- [x] 5.2 `QuizEditor` への統合と承認後リフレッシュ
  - `quiz-editor.tsx` の固定 6 件 option を `GenreEditorSelect` に置換する。
  - `window` の `focus` イベントで `useActiveGenres().refetch()` を呼び、ジャンル新設可決後に選択肢が更新されること。
  - 「新しいジャンルを申請する」リンクを維持する。
  - **完了状態**: 作成・編集画面で新設ジャンルが refetch 後に選択可能であること。
  - _Requirements: 5.3, 5.4, 5.7, 1.2_
  - _Depends: 5.1_

- [x] 5.3 Phase 6 統合検証
  - `GenreEditorSelect` の RTL テスト（loading / options / orphan / error）。
  - 既存 Zod・公開フローの回帰がないこと（`npm test` / `npm run build`）。
  - **完了状態**: 関連 Jest がグリーンであること。
  - _Requirements: 5.1, 5.4, 5.6_
  - _Depends: 5.2_

- [ ]* 5.4 Phase 6 E2E スモーク（任意）
  - エディタでジャンル select が動的であること、申請画面リンクが有効であることを E2E または手動チェックリストで記録する。
  - _Depends: 5.3_
  - _Requirements: 5.1, 5.3_

---

### 6. Phase 8 拡張 — 設問リスト編集と参照リンク作問 UI（2026-06）

> **前提**: `quizeum-core` Phase 8 完了（`createQuizList` + `listType`, `addQuestionToList`, `exportQuestionList`, `searchAuthorQuizzes`, 参照リンク `saveQuiz`）。`quizeum-play-flow-ui` Phase 8 でリスト詳細の `listType` 表示・設問リストプレイは実装済み。

- [x] 6.1 (P) `question-attach-search` 純関数ライブラリ
  - 3ソース由来の `QuestionAttachCandidate` をマージし、`questionId` 重複を除去する。
  - `questionText` / 親タイトルに対するキーワード部分一致フィルタを提供する。
  - Jest で重複除去・キーワードフィルタ・空キーワード時の全件通過を検証する。
  - **完了状態**: 単体テストがグリーンであり、フックから import 可能であること。
  - _Requirements: 6.4_
  - _Boundary: question-attach-search_
  - _Depends: quizeum-core Phase 8_

- [x] 6.2 (P) `useQuestionAttachSearch` フック
  - タブ `own-published` / `bookmarked` / `public-explore` ごとに候補を非同期取得する。
  - `own-published`: `searchAuthorQuizzes` → 公開のみ → `getQuestionsByQuiz`。
  - `bookmarked`: `getBookmarkedQuestions`。
  - `public-explore`: `getLatestQuizzes(N)` → 設問フラット化 → 他者・公開のみ（設計どおり `searchQuizzes` は補助のみ）。
  - キーワード変更を 300ms デバウンス後に `question-attach-search` でフィルタする。
  - **完了状態**: タブ切替とキーワード入力で候補リストが更新されること（モックテスト可）。
  - _Requirements: 6.4_
  - _Depends: 6.1_
  - _Boundary: useQuestionAttachSearch_

- [x] 6.3 (P) `ListTypeSelector` コンポーネント
  - 新規リスト作成時に `quiz` / `question` をラジオ選択する。編集モードでは読み取り専用表示。
  - `data-testid`（`list-type-selector`, `list-type-quiz`, `list-type-question`）を付与する。
  - RTL でタブ切替（選択通知）と disabled 状態を検証する。
  - **完了状態**: 新規作成画面で2種類が選択でき、編集画面では変更不可表示になること。
  - _Requirements: 6.1, 6.2_
  - _Boundary: ListTypeSelector_

- [x] 6.4 `QuizListEditor` の listType 分岐と初回保存フロー
  - 新規作成時 `ListTypeSelector` を統合し、保存時に `createQuizList({ listType, questionIds: [] })` を送信する（設問リストは空で作成）。
  - 編集時は `resolveListType` を表示のみとし、`listType` 変更 UI を出さない。
  - `listType === 'question'` のときクイズアタッチパネルを非表示にし、`listId` 未取得時は `QuestionListAttachPanel` を disabled + 案内文を表示する。
  - `listType === 'quiz'` は従来のクイズアタッチ・並び替え・`exportQuizList` を維持する（6.10）。
  - **完了状態**: 設問リストを新規作成すると `listType: 'question'` で保存され、初回保存後に設問パネルが有効になること。
  - _Requirements: 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 6.10, 3.5_
  - _Depends: 6.3_
  - _Boundary: QuizListEditor_

- [x] 6.5 (P) `QuestionListAttachPanel`（検索・アタッチ・解除）
  - 3タブ検索 UI と `useQuestionAttachSearch` を接続し、候補から `addQuestionToList` を呼び出す。
  - アタッチ一覧に問題文抜粋・親クイズタイトルを表示する。`removeQuestionFromList` で楽観的または再取得で UI 更新する。
  - 非公開親などコア検証エラー時はインラインエラーを表示し一覧を変更しない（6.6）。
  - 公開探索タブに「直近公開クイズの設問から検索（全件保証なし）」注記を表示する。
  - **完了状態**: 設問リスト編集で3タブから設問を追加・削除できること。
  - _Requirements: 6.4, 6.5, 6.6, 6.7_
  - _Depends: 6.2, 6.4_
  - _Boundary: QuestionListAttachPanel_

- [x] 6.6 設問リストの DnD 並び替えとエクスポート
  - アタッチ済み設問行に HTML5 DnD ハンドルを追加し、完了時に `reorderQuestionList` を呼び出す（既存クイズリスト DnD パターンを踏襲）。
  - 設問リスト保存済みの場合、エクスポートボタンで `exportQuestionList` を呼び出し JSON をダウンロードする。
  - **完了状態**: DnD 後に再読み込みでも順序が保持され、エクスポート JSON にリストメタと設問参照が含まれること。
  - _Requirements: 6.8, 6.9_
  - _Depends: 6.5_
  - _Boundary: QuestionListAttachPanel, QuizListEditor_

- [x] 6.7 (P) 参照リンク作問パネル群
  - `ReferenceQuestionBadge` で「参照リンク」バッジを表示する。
  - `useAuthorQuizReferenceSearch` が `searchAuthorQuizzes` にキーワード・タグを渡す。
  - `AuthorQuizReferencePanel`（折りたたみ）でクイズ展開 → 設問選択 → `onLinkQuestion` を発火（自作のみ、7.5）。
  - **完了状態**: パネルから設問をリンク選択するとコールバックが `linkKind: 'reference'` 付き設問を返すこと。
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - _Depends: quizeum-core Phase 8_
  - _Boundary: AuthorQuizReferencePanel, ReferenceQuestionBadge, useAuthorQuizReferenceSearch_

- [x] 6.8 `QuizEditor` 参照リンク統合と CoW 状態機械
  - `AuthorQuizReferencePanel` を統合し、参照設問を `reference-readonly`（デフォルト readOnly + 削除のみ）で表示する。
  - 「内容を編集（コピーに切り離し）」で `reference-detaching` に遷移し 7.7 通知を表示後、編集可能にする。
  - 保存時 `saveQuiz` に `linkKind` と元 `id` を送信する。Zod 公開検証は `reference-readonly` 行をスキップする。
  - 参照解除はローカル配列からの除去のみ（7.8, 7.10）。
  - **完了状態**: 参照設問がバッジ付きで readOnly 表示され、編集切り離し後に保存できること。永続化ロジックは UI に追加されていないこと。
  - _Requirements: 7.6, 7.7, 7.8, 7.9, 7.10_
  - _Depends: 6.7_
  - _Boundary: QuizEditor_

- [x] 6.9 Phase 8 統合検証
  - 設問リスト作成（listType 選択→初回保存→アタッチ→DnD→エクスポート）、参照リンク追加・CoW 通知、クイズリスト回帰を Jest / コンポーネントテストで検証する。
  - `npm test` / `npm run build` がグリーンであること。
  - **完了状態**: Phase 8 関連テストがグリーンであり、手動スモークで設問リスト編集と参照リンク保存が成功すること。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_
  - _Depends: 6.4, 6.6, 6.8_

- [ ]* 6.10 Phase 8 E2E スモーク（任意）
  - `[data-testid="list-type-question"]` で設問リスト作成、参照パネルからリンク追加を Playwright またはチェックリストで記録する。
  - _Depends: 6.9_
  - _Requirements: 6.1, 7.1_

---

### 7. Phase 12 拡張 — 作問エディタ UX 改善（2026-06）

> **前提**: Phase 8 参照パネル・`searchAuthorQuizzes` パイプラインは実装済み。本フェーズは設問文・正解テキスト照合拡張、テキストエリア自動伸長、リンク成功フィードバックを追加する。

- [x] 7.1 (P) 設問検索テキスト抽出ライブラリ
  - 設問タイプごとにキーワード照合対象の正解テキスト（正解選択肢文、正解候補、並び替え要素文、必須正解キーワード）を抽出する純関数を実装する。
  - 問題文および正解テキストに対する部分一致判定関数を提供する。ウミガメのスープの裏設定（`aiContextDetails`）は検索対象に含めない。
  - 各設問タイプの抽出ルールと一致・不一致判定を Jest で検証する。
  - **完了状態**: 単体テストがグリーンであり、`author-quiz-search` から import 可能であること。
  - _Requirements: 7.11_
  - _Boundary: question-search-text_

- [x] 7.2 過去自作クイズ検索の設問文・正解テキスト照合拡張
  - キーワード指定時に自作クイズ全件の設問を並列取得し、クイズメタ（タイトル・説明）またはいずれかの設問が一致すれば検索結果に含めるフィルタを実装する。
  - キーワード未指定時は従来どおりタイトル・説明・タグのみでフィルタする。個別クイズの設問取得失敗時はメタ照合のみで継続する。
  - タイトル不一致・設問文一致でヒットするケース、双方不一致で除外されるケースを Jest で検証する。
  - **完了状態**: 設問文または正解テキストのみで過去クイズが検索結果に現れること。
  - _Requirements: 7.11_
  - _Depends: 7.1_
  - _Boundary: author-quiz-search_

- [x] 7.3 (P) 自動伸長テキストエリアコンポーネント
  - 入力内容の行数に応じて表示高さを自動同期する制御コンポーネントを実装する。初回マウント時および既存下書きロード時にも高さを同期する。
  - 手動リサイズ（`resize: vertical`）を許可し、最小行数から算出した最小高さを維持する。
  - jsdom 環境で複数行 `value` 設定時に高さ同期が動作することをコンポーネントテストで検証する。
  - **完了状態**: コンポーネントが `value` / `onChange` / `className` / `minRows` を受け取り、テストがグリーンであること。
  - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - _Boundary: AutoGrowTextarea_

- [x] 7.4 クイズエディタへの自動伸長テキストエリア適用
  - 説明文、各設問の問題文、ウミガメのスープ設問の真相入力、各設問の解説文の4テキストエリアを自動伸長コンポーネントに置換する。
  - タイトル・タグ・必須正解キーワード等の単一行フィールドは対象外とする。固定 `minHeight` のインライン指定を除去する。
  - **完了状態**: 4フィールドすべてで複数行入力時に高さが自動拡張し、既存下書きを開いた際も初回表示で内容に見合った高さになること。
  - _Requirements: 8.1, 8.2, 8.4, 8.5_
  - _Depends: 7.3_
  - _Boundary: QuizEditor_

- [x] 7.5 (P) 参照リンクパネルの検索表示とリンク成功フィードバック
  - キーワード入力欄のプレースホルダーまたは説明文を、タイトル・説明・問題文・正解テキストが検索対象である旨に更新する。
  - リンク操作成功時に `role="status"` の成功メッセージを表示し、3秒後に自動消去する。問題文抜粋を含める。
  - 既にリンク済みの設問はボタン無効化とハンドラ先頭ガードで重複リンクを防止する（既存動作の維持確認）。
  - リンククリック後に成功メッセージが表示されること、プレースホルダー文言が更新されていることをコンポーネントテストで検証する。
  - **完了状態**: `[data-testid="reference-link-success"]` がリンク成功時に表示され、重複リンクが防止されること。
  - _Requirements: 7.12, 7.13, 7.14_
  - _Boundary: AuthorQuizReferencePanel_

- [x] 7.6 Phase 12 統合検証
  - 設問文・正解テキスト検索、自動伸長4フィールド、リンク成功メッセージの関連 Jest がすべてグリーンであること。
  - `npm test` / `npm run build` がグリーンであること。Phase 8 参照リンク・設問リストの回帰がないこと。
  - **完了状態**: Phase 12 関連テストがグリーンであり、手動スモークで過去クイズ検索・自動伸長・リンク通知が動作すること。
  - _Requirements: 7.11, 7.12, 7.13, 7.14, 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Depends: 7.2, 7.4, 7.5_

- [ ]* 7.7 Phase 12 E2E スモーク（任意）
  - 作問エディタで過去クイズを設問文で検索しリンク追加、テキストエリアの自動伸長、リンク成功メッセージを Playwright またはチェックリストで記録する。
  - _Depends: 7.6_
  - _Requirements: 7.11, 7.13, 8.2_

## Implementation Notes

- Phase 6 は **読み取り専用**（`metadata_genres` 書き込みは governance / core）。
- `useActiveGenres` を `src/hooks/` に既に置いている場合は import 共有のみで新規フック不要。
- play-flow のホームジャンル ID とエディタの `genre` 保存値は同一キー（英小文字 doc ID）を用いる。
- Phase 6 実装（2026-06-03）: `GenreEditorSelect` + `useActiveGenres`、focus 時 refetch。Jest 300 件・build PASS。
- **Phase 8**: 設問リストは **初回保存で `listId` 取得後** にアタッチ可能。公開探索は `getLatestQuizzes` ベース + 設問文フィルタ。参照設問は readOnly デフォルト + 明示的切り離しで CoW（7.7）。リスト詳細表示は play-flow 実装を信頼（3.1–3.4 は 6.9 で回帰確認）。
- Phase 8 実装（2026-06-05）: `ListTypeSelector` / `QuestionListAttachPanel` / 参照パネル群、`QuizListEditor` listType 分岐、設問リスト作成後 `/edit` 遷移。Jest 366 件・build PASS。
- **Phase 12**: 設問照合は `question-search-text.ts` + `filterAuthorQuizzesWithQuestions`。キーワード時のみ全自作クイズの設問を並列取得。`AutoGrowTextarea` は説明・問題文・真相・解説の4フィールドのみ。`aiContextDetails` は検索対象外（`truthKeywords` のみ）。
- Phase 12 実装（2026-06-06）: `question-search-text` / `filterAuthorQuizzesWithQuestions` / `AutoGrowTextarea` / 参照パネル成功メッセージ。Jest 518 件・build PASS。
