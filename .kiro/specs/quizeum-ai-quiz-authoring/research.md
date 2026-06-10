# Research & Design Decisions: quizeum-ai-quiz-authoring

## Summary
- **Feature**: `quizeum-ai-quiz-authoring`
- **Discovery Scope**: Extension（既存 Gemini プレイ AI・Pro エンタイトルメント・クイズエディタへの追加）
- **Key Findings**:
  - 作問 API は未実装。Gemini 利用は `ask-ai` / `verify-truth` のテキスト生成のみ（`@google/generative-ai` ^0.24.1）
  - サムネは `triggerThumbnail` が picsum ダミー。Storage `uploadImage` はジャンルアイコンのみ
  - 画像生成は `@google/generative-ai` では非対応。`@google/genai` + 画像対応モデル（例: `gemini-2.5-flash-image`、env で上書き）が必要
  - Admin SDK に Storage ヘルパー未整備 — サムネ API は `firebase-admin/storage` 経由のサーバーアップロードを新設
  - 新規作成クイズ（`quizId` 未確定）でもサムネ生成可能にするため `quizzes/drafts/{uid}/` パスを採用

## Research Log

### 既存 Gemini 統合（プレイ AI）
- **Context**: 作問 API の認証・レート制限パターンを揃える
- **Sources Consulted**: `src/app/api/attempt/ask-ai/route.ts`, `src/services/ask-ai-utils.ts`, `src/services/entitlement.ts`
- **Findings**:
  - Bearer + `verifyFirebaseIdToken` + `resolveUserEntitlements`
  - JST 日付文字列 + `users/{uid}/dailyAiTurnCounts/{docId}` トランザクション更新
  - モデレータ `moderationTier` による無制限免除
- **Implications**: 作問用は `dailyAiAuthoringCounts` に docId `questions` / `thumbnail` で同型実装。プレイカウンタと分離

### 問題型・エディタ初期化
- **Context**: AI 出力を `Question[]` にマッピング
- **Sources Consulted**: `src/types/index.ts`, `src/components/quiz/quiz-editor.tsx` (`addDefaultQuestion`), `src/services/quiz-choice-utils.ts`, `src/lib/true-false-defaults.ts`
- **Findings**:
  - 形式別必須フィールドが明確（choices, sortingItems, associationHints 等）
  - 新規 `id` はクライアント同型のランダム文字列で付与
  - `correctCount` / `incorrectCount` は 0 初期化
- **Implications**: `mapAiJsonToQuestions` は `addDefaultQuestion` と同型のデフォルト埋め + AI フィールド上書き

### サムネイル・Storage
- **Context**: AI 生成画像の永続化
- **Sources Consulted**: `src/services/storage.ts`, `src/lib/firebase/admin.ts`, `src/lib/genre-icon-upload.ts`
- **Findings**:
  - クライアント `uploadImage` は PNG/JPEG/GIF 2MB 制限（SVG 禁止）
  - Admin Storage 未使用。API Route からバイナリ保存が必要
  - `getQuizCoverPath(quizId)` は quizId 必須 — 下書き用パス拡張が必要
- **Implications**: `uploadQuizCoverBuffer`（Admin）新設。draft は `getQuizDraftCoverPath(uid)`

### Gemini 画像生成 SDK
- **Context**: サムネ AI 生成の技術選定
- **Sources Consulted**: [Gemini API Image Generation](https://ai.google.dev/gemini-api/docs/image-generation), `@google/generative-ai` package.json
- **Findings**:
  - 画像出力は `@google/genai` SDK + 画像対応モデルが推奨
  - 既存 `@google/generative-ai` はテキスト作問に継続利用可
  - モデル ID は env `GEMINI_IMAGE_MODEL_ID` で設定（デフォルト `gemini-2.5-flash-image`、デプロイ時に ListModels で検証）
- **Implications**: 依存追加 `@google/genai`（サムネ Route のみ）。テキスト作問は既存 SDK を維持し移行リスクを最小化

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. 単一 Route + utils（採用） | 3 API Route + 共有 `ai-authoring-utils` | ask-ai パターン踏襲、テスト容易 | Route 重複（ゲート処理） | ゲートは `assertAiAuthoringAccess` に集約 |
| B. 10回逐次 Gemini | 問題ごと API | 品質向上余地 | 遅延・コスト・100回/日の実効値低下 | 要件で却下済み |
| C. クライアント Gemini | ブラウザ直接呼び出し | 実装簡易 | キー漏洩・改ざん | セキュリティ上却下 |

## Design Decisions

### Decision: 作問は既存 SDK + JSON 構造化出力
- **Context**: 要件 2 — 10問一括、形式別 JSON
- **Alternatives**: 10回個別呼び出し / プレーンテキスト + 正規表現パース
- **Selected Approach**: `@google/generative-ai` の `responseMimeType: application/json` + `responseSchema` で10問配列を1回取得
- **Rationale**: 既存 env・SDK・Route パターンと一致。パース失敗リスクを schema で低減
- **Trade-offs**: 大出力 truncation リスク — プロンプトで簡潔指示 + 422 で全体拒否（要件 6.7）
- **Follow-up**: 実装時に `GEMINI_MODEL_ID` を `gemini-2.0-flash` 等現行利用可能モデルへ更新推奨

### Decision: サムネは @google/genai + Admin Storage
- **Context**: 要件 4 — タイトル・説明から画像生成・Storage URL
- **Alternatives**: picsum 継続 / クライアント upload / 外部 URL のみ
- **Selected Approach**: `@google/genai` で PNG バイナリ取得 → Admin Storage 保存 → download URL 返却
- **Rationale**: OGP 永続化・既存 `thumbnailUrl` 契約・セキュリティ
- **Trade-offs**: 新 SDK 依存・Admin Storage 新設
- **Follow-up**: E2E は Storage エミュレータ or API モック

### Decision: 日次カウンタ doc 分離
- **Context**: 要件 3.2, 5.2
- **Selected Approach**: `users/{uid}/dailyAiAuthoringCounts/questions` と `.../thumbnail`
- **Rationale**: プレイ AI `dailyAiTurnCounts` と混同防止
- **Follow-up**: Firestore Rules でクライアント書き込み deny

### Decision: 反映モードは末尾追加のみ
- **Context**: ユーザー確認済み（discovery）
- **Selected Approach**: API は `Question[]` のみ返却。UI は `setQuestions(prev => [...prev, ...generated])`
- **Rationale**: 要件 2.3, 6.7（部分反映禁止）と整合

### Decision: 残り回数初回表示 — GET `/api/quiz/ai-authoring-usage`（design review 2026-06-10）
- **Context**: 要件 3.3 / 5.3
- **Selected Approach**: 読み取り専用 GET。Firestore カウンタ read のみ
- **Rationale**: 生成 POST だけでは初回表示を満たせない
- **Follow-up**: Hook mount 時 fetch + POST 成功後 usage 上書き

### Decision: `validateGeneratedQuestions` export（design review 2026-06-10）
- **Context**: private `collectQuestionValidationErrors` では 422 判定がぶれる
- **Selected Approach**: `quiz-validation.ts` に export 追加
- **Rationale**: 要件 6.7 の一括拒否を単一正本で担保

### Decision: mixed allowlist 4 種固定（design review 2026-06-10）
- **Context**: `quiz-validation.ts` mixed は MC/〇×/記述/並べ替えのみ
- **Selected Approach**: Gemini schema enum + `mapAiJsonToQuestions` 二重チェック
- **Rationale**: 要件 2.6 とコード正本の一致

## Synthesis Outcomes

### Generalization
- `assertAiAuthoringAccess` + `incrementDailyAuthoringCount` を作問・サムネ両 API で共有
- `AiAuthoringUsage` 型で残り回数レスポンスを統一

### Build vs. Adopt
- **Adopt**: `resolveUserEntitlements`, `verifyFirebaseIdToken`, `createDefaultChoices`, `createTrueFalseChoices`, JST 日付 util（ask-ai から抽出共通化可）
- **Build**: `mapAiJsonToQuestions`, Admin Storage upload, AI 作問パネル UI（ドメイン固有）

### Simplification
- 専用 Service クラスは作らず Route + utils パターン（ask-ai 同型）
- 残り回数は **GET usage（初回）+ POST レスポンス（更新）** で同型 `AiAuthoringUsage` を共有

## Risks & Mitigations
- **Gemini JSON truncation** — schema でフィールド最小化、10問固定、不足時 422 全体拒否
- **画像モデル利用不可** — env 切替 + 503 `ai-unavailable` + ログ
- **新規クイズ quizId なし** — draft Storage パス + 公開保存時に cover 再アップロードは out of scope（URL はそのまま有効）
- **@google/genai 追加** — サムネ Route のみ import、バンドル影響は Route 単位で隔離

## References
- [Gemini API Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
- `src/app/api/attempt/ask-ai/route.ts` — 認証・カウンタ・Gemini 呼び出しパターン
- `src/services/entitlement.ts` — Pro 判定
- `.kiro/specs/quizeum-ai-quiz-authoring/requirements.md` — 要件正本
