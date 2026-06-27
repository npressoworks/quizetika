# Research & Design Decisions: quizetika-ui-quiz-lifecycle

## Summary
- **Feature**: `quizetika-ui-quiz-lifecycle`
- **Discovery Scope**: Extension（既存クイズライフサイクル UI のスタイル層置換）
- **Key Findings**:
  - `play.module.css`（約 773 行）が最大リスク。プレイ画面は `quiz-play-client.tsx`（約 1,450 行）と `test-play-client.tsx` が共有スタイルに依存
  - 回答 UI は `ChoiceAnswerPanel`（radio/checkbox）、`TrueFalseAnswerPanel`、`PostAnswerFeedback` の 3 コンポーネントが中核。shadcn `RadioGroup` + `Button` で再現可能
  - E2E は `e2e/quiz-play.spec.ts`（フルプレイ→結果フロー）、`e2e/leaderboard.spec.ts` が主要回帰ポイント。`data-testid` 維持が必須
  - 移行順序は brief 通り詳細→結果→復習→プレイ。プレイを最後にすることで低リスク画面で Tailwind パターンを確立してから高リスク域に適用

## Research Log

### 既存コードベース分析
- **Context**: ライフサイクル画面のファイル境界と CSS Modules 依存を特定
- **Sources Consulted**: `src/app/quiz/**`, `src/components/quiz/**`, `src/app/leaderboard/**`, `grep .module.css`
- **Findings**:
  - ページ CSS Modules: `page.module.css`, `play.module.css`, `result.module.css`, `success.module.css`, `review.module.css`, `leaderboard.module.css`
  - コンポーネント CSS Modules（ライフサイクル対象）: choice/true-false/post-answer-feedback/report-modal/accordion/dual-leaderboard/skeletons/format-label/difficulty-vote-stars/quiz-card/quick-press-question-text 等（計 18 ファイル）
  - エディタ除外: `quiz-editor.tsx`, `editor-skeleton`, `genre-editor-select`, `author-quiz-reference-panel`, `create.module.css`
  - プレイ hooks（`usePlayState`, `useAiPlayState`）と services（`attempt`）は UI 層から参照されるが本スペックでは変更しない
- **Implications**: スタイル層のみ Strangler 置換。props/コールバック契約は維持

### shadcn コンポーネント選定
- **Context**: 回答パネル・結果アコーディオン・通報・進捗表示に必要なプリミティブ
- **Sources Consulted**: shadcn/ui 公式ドキュメント、foundation design（既存 Button/Dialog/Card/Skeleton）
- **Findings**:
  - `RadioGroup` + `Label`: 選択式回答（単一/複数は checkbox 相当を shadcn パターンで実装）
  - `Progress`: プレイ進捗バー・タイマー視覚化
  - `Accordion`: 結果画面の問題詳細（既存 `result-question-details-accordion.tsx`）
  - `Dialog`: `ReportModal` の overlay/content 置換（foundation の Dialog を利用）
  - `Tabs`: リーダーボードタブ（グローバル・クイズ内デュアル）
  - `Badge`: 難易度・フォーマットラベル補助
- **Implications**: foundation 7 種に加え本スペックで RadioGroup, Progress, Accordion, Tabs, Label を `shadcn add` する

### E2E・テスト依存分析
- **Context**: プレイ UX 退行防止の検証ポイント
- **Sources Consulted**: `e2e/quiz-play.spec.ts`, `e2e/leaderboard.spec.ts`, `e2e/streaming-skeleton.spec.ts`
- **Findings**:
  - `quiz-play.spec.ts` は editor 作成→検索→詳細→プレイ→結果のフルフロー。`play-mode-leaderboard-warning`, `play-answer-feedback`, `difficulty-vote-stars` 等を参照
  - 一部 selector が `class*="choiceRow"` 等 class 依存 — 移行時は `data-testid` 優先維持、class 依存は必要時のみ更新
  - `layout.spec.ts` は layout-shell 管轄。本スペックは `/play` でシェル非表示が維持されることを E2E で間接確認
- **Implications**: タスク末尾に E2E 回帰と手動プレイ QA を必須化

### 移行順序リスク評価
- **Context**: brief の「詳細→結果→復習→プレイ」順序の妥当性
- **Sources Consulted**: brief.md, layout-shell tasks パターン
- **Findings**:
  - 詳細・結果はシェル内表示で CSS 量中程度。パターン確立に適する
  - プレイは没入型・最大 CSS・最多インタラクション。最後に集中検証が効率的
  - test-play は本番 play と `play.module.css` を共有 — play 移行と同時に更新
- **Implications**: tasks.md の major task 順序に反映

## Architecture Pattern Evaluation

| Option                     | Description                     | Strengths                             | Risks / Limitations                            | Notes                                  |
| -------------------------- | ------------------------------- | ------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| 一括置換                   | 全ライフサイクル画面を同時 PR   | 短期間で CSS Modules 完全削除         | レビュー不能・プレイ退行リスク最大             | 却下                                   |
| 水平（コンポーネント先行） | 回答パネル等を先に全画面適用    | 再利用確立                            | ページとコンポーネントの中途半端混在期間が長い | 部分採用（共有コンポーネント先行は可） |
| 垂直（画面順）             | 詳細→結果→復習→プレイの画面単位 | 各段階で E2E 確認可能・リスク段階低減 | 期間中 CSS Modules 共存                        | **採用**                               |

## Design Decisions

### Decision: 垂直スライス移行順序
- **Context**: プレイ UX 退行不可制約と最大 CSS 量
- **Alternatives Considered**:
  1. プレイ先行 — 早期に核心 UX 検証
  2. 詳細→結果→復習→プレイ — brief 推奨
- **Selected Approach**: 2 を採用。共有コンポーネント（回答パネル・スケルトン・ReportModal）は詳細移行前に foundation タスクで整備
- **Rationale**: 低リスク画面で Tailwind パターンを確立後、プレイに適用。各段階で部分 E2E 可能
- **Trade-offs**: 移行完了まで `.module.css` 共存継続
- **Follow-up**: プレイ移行後に `play.module.css` 削除と test-play 同期

### Decision: 回答 UI の shadcn マッピング
- **Context**: ChoiceAnswerPanel / TrueFalseAnswerPanel の視覚的フィードバック
- **Alternatives Considered**:
  1. カスタム Tailwind のみ（Radix なし）
  2. shadcn RadioGroup + Button + Progress
- **Selected Approach**: 2 — shadcn 標準寄せを正とする
- **Rationale**: Phase 24 Visual Direction 準拠。アクセシビリティ（Radix）維持
- **Trade-offs**: 複数選択は RadioGroup の checkbox パターンまたは独自 checkbox + shadcn Label で実装
- **Follow-up**: 正誤フィードバック色は shadcn `destructive` / カスタム success トークン（最小限）で表現

### Decision: ReportModal を shadcn Dialog に移行
- **Context**: 独自 overlay/modal CSS の置換
- **Selected Approach**: foundation `Dialog` を使用。`data-testid` は Dialog 子要素に付与
- **Rationale**: フォーカストラップ・アクセシビリティを Radix に委譲
- **Trade-offs**: overlay の `data-testid="report-modal-overlay"` は DialogOverlay に移設

## Risks & Mitigations
- **プレイ UX 退行** — プレイを最後に移行、E2E + 手動 QA 必須、視覚回帰重点
- **class 依存 E2E selector 破損** — `data-testid` 優先維持、破損時は `e2e/quiz-play.spec.ts` を同スペックで更新
- **test-play と本番 play の乖離** — 共有 `play.module.css` を同時削除、同一 Tailwind クラスを使用
- **エディタ CSS 誤削除** — `create.module.css`, `editor-skeleton.module.css` を Out of Boundary で明示除外

## References
- [shadcn/ui Radio Group](https://ui.shadcn.com/docs/components/radio-group) — 選択式回答
- [shadcn/ui Progress](https://ui.shadcn.com/docs/components/progress) — プレイ進捗
- [shadcn/ui Accordion](https://ui.shadcn.com/docs/components/accordion) — 結果詳細
- `.kiro/specs/quizetika-ui-foundation/design.md` — 基盤プリミティブ・テーマ bridge
- `.kiro/specs/quizetika-ui-layout-shell/design.md` — `/play` シェル非表示契約
