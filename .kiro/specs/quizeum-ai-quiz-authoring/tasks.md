# Implementation Plan: quizeum-ai-quiz-authoring

> **前提**: Pro エンタイトルメント（`resolveUserEntitlements`）、Bearer 認証（`verifyFirebaseIdToken`）、クイズエディタ（`QuizEditor`）は既存実装を利用する。プレイ AI（`ask-ai`）のカウンタ・Route とは独立して実装する。

## Tasks

### 1. AI 作問基盤（型・ユーティリティ・検証）

- [x] 1.1 `@google/genai` 依存追加と画像モデル env 契約の整備 (P)
  - `package.json` に `@google/genai` を追加する。
  - 既存 `GEMINI_API_KEY` に加え `GEMINI_IMAGE_MODEL_ID`（デフォルト `gemini-2.5-flash-image`）を Route から参照可能にする。
  - 完了時、依存インストール後に TypeScript が `@google/genai` を解決できること。
  - _Requirements: 4.2, 8.1_
  - _Boundary: ai-authoring foundation_

- [x] 1.2 `ai-authoring-types` と `ai-authoring-utils` 純関数の実装 (P)
  - 定数（プロンプト最大 500、10問固定、日次 100/20、`MIXED_ALLOWED_QUESTION_TYPES`）を実装する。
  - JST 日付、`assertAiAuthoringAccess`、`checkDailyAuthoringLimit`、`readDailyAuthoringUsage`、`buildAiQuizGenerationPrompt`、`mapAiJsonToQuestions` を実装する。
  - `tests/services/ai-authoring-utils.test.ts` でカウンタ rollover・mixed allowlist・10件未満 reject を検証する。
  - 完了時、ユニットテストが green で mixed への quick-press 混入が拒否されること。
  - _Requirements: 1.4, 1.5, 2.5, 2.6, 2.8, 3.1, 3.2, 5.1, 5.2, 6.7_
  - _Boundary: ai-authoring-utils_

- [x] 1.3 `validateGeneratedQuestions` export と検証テストの実装 (P)
  - `quiz-validation.ts` に `validateGeneratedQuestions(questions, format)` を追加する（`collectQuestionValidationErrors` + mixed allowlist 再利用）。
  - `tests/services/quiz-validation-ai.test.ts` で単一形式・mixed 4 種・逸脱 type を検証する。
  - 完了時、検証関数の単体テストが green であること。
  - _Requirements: 2.5, 2.6, 6.3, 6.7_
  - _Boundary: quiz-validation_

### 2. Admin Storage と Firestore Rules

- [x] 2.1 Firebase Admin Storage と `storage-admin` の実装 (P)
  - `lib/firebase/admin.ts` に `getAdminStorage()` を追加する。
  - `services/storage-admin.ts` に PNG バイナリのクイズカバーアップロード（`quizzes/{quizId}/` または `quizzes/drafts/{uid}/`）を実装する。
  - 完了時、Admin SDK 経由で Storage にアップロードし download URL が取得できること。
  - _Requirements: 4.3, 8.1_
  - _Boundary: storage-admin_

- [x] 2.2 `dailyAiAuthoringCounts` の Firestore Security Rules
  - `users/{uid}/dailyAiAuthoringCounts/{docId}` の認証ユーザ read（own）許可、クライアント write 拒否を定義する。
  - 完了時、クライアント SDK からのカウンタ直接書き込みが Rules で拒否されること。
  - _Requirements: 3.2, 5.2, 8.1_
  - _Boundary: firestore.rules_

### 3. API Routes（認可・カウンタ・Gemini）

- [x] 3.1 `GET /api/quiz/ai-authoring-usage` の実装 (P)
  - Bearer 認証、`resolveUserEntitlements`、非 Pro は 403。
  - Firestore から作問・サムネの日次 usage を read し `{ questions, thumbnail }` を返す（Gemini 非呼び出し）。
  - `tests/api/ai-authoring-usage.test.ts` で Pro 200 / 非 Pro 403 を検証する。
  - 完了時、モック環境で usage レスポンスが design 契約どおりであること。
  - _Requirements: 1.3, 1.4, 1.5, 3.3, 5.3_
  - _Depends: 1.2, 2.2_
  - _Boundary: ai-authoring-usage Route_

- [x] 3.2 `POST /api/quiz/ai-generate-questions` の実装
  - Pro ゲート、日次 100 回制限、Gemini `responseSchema` で 10 問 JSON 取得。
  - `mapAiJsonToQuestions` → `validateGeneratedQuestions`、エラー時 422 全体拒否、成功後のみカウンタ increment。
  - `lateral-thinking` format は 400、`maxDuration` 60s。
  - `tests/api/ai-generate-questions.test.ts`（Gemini mock）で 200/403/429/422 を検証する。
  - 完了時、モック Gemini で 10 問 + usage が返り、検証失敗時は既存問題相当の state 変更なし（422）であること。
  - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 3.1, 3.4, 3.5, 3.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.1_
  - _Depends: 1.2, 1.3, 2.2_
  - _Boundary: ai-generate-questions Route_

- [x] 3.3 `POST /api/quiz/ai-generate-thumbnail` の実装
  - Pro ゲート、日次 20 回制限、title/description 空は 400。
  - `@google/genai` で画像生成 → `storage-admin` 保存 → `thumbnailUrl` + usage 返却。
  - `tests/api/ai-generate-thumbnail.test.ts`（GenAI + Storage mock）。
  - 完了時、成功時に Storage URL と usage が返り、失敗時は既存 thumbnail 不変であること。
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.4, 5.5, 5.6, 6.1, 6.2, 6.4, 6.5, 6.6, 8.1_
  - _Depends: 1.1, 1.2, 2.1, 2.2_
  - _Boundary: ai-generate-thumbnail Route_

### 4. クライアント Hook

- [x] 4.1 `useAiQuizAuthoring` フックの実装
  - Pro mount 時に GET usage で残り回数を初期化する。
  - `generateQuestions` / `generateThumbnail` で API 呼び出し、401/403/429/422/503 の日本語エラー表示。
  - 429 時は `/pricing` 誘導を出さない（Pro 契約中前提）。
  - 完了時、モック API で `onAppendQuestions` / `onSetThumbnailUrl` が期待どおり呼ばれること。
  - _Requirements: 2.3, 2.10, 2.11, 3.3, 3.5, 4.3, 4.5, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - _Depends: 3.1, 3.2, 3.3_
  - _Boundary: useAiQuizAuthoring_

### 5. エディタ UI コンポーネント

- [x] 5.1 `AiQuizProUpsell` の実装 (P)
  - 未ログインは `/login?redirect=...`、無料 tier は `/pricing` への Pro 購読 CTA を表示する。
  - 完了時、非 Pro ユーザに CTA が表示され AI 生成操作は実行できないこと。
  - _Requirements: 1.1, 1.2, 6.2_
  - _Boundary: AiQuizProUpsell_

- [x] 5.2 `AiQuizAuthoringPanel` の実装
  - プロンプト入力（500 文字上限・超過案内）、残り回数表示、生成中ローディング、成功/失敗フィードバック。
  - `format === 'lateral-thinking'` 時は生成 disabled + 初版未対応メッセージ。
  - `data-testid="ai-quiz-authoring-panel"`, `ai-quiz-prompt-input`, `ai-quiz-generate-button` を付与する。
  - 完了時、Pro ユーザでパネル・残り回数・生成ボタンが表示されること。
  - _Requirements: 1.3, 2.1, 2.7, 2.9, 2.10, 2.11, 3.3, 7.1, 7.2_
  - _Depends: 4.1_
  - _Boundary: AiQuizAuthoringPanel_

- [x] 5.3 サムネイル AI 生成 UI（`QuizMetadataSection`）の実装 (P)
  - `data-testid="ai-thumbnail-generate-button"`、生成中 disabled/loading、title/description 空時の案内。
  - 完了時、Pro ユーザでサムネ生成成功後にプレビュー画像が更新されること。
  - _Requirements: 4.1, 4.4, 4.5, 5.3, 7.3_
  - _Depends: 4.1_
  - _Boundary: QuizMetadataSection_

### 6. エディタ統合

- [x] 6.1 `QuizEditor` への AI 作問統合
  - `AiQuizAuthoringPanel` / `AiQuizProUpsell` を問題編集領域付近に配置する。
  - Hook 接続、`setQuestions(prev => [...prev, ...generated])` 末尾追加、picsum `triggerThumbnail` スタブを削除する。
  - 完了時、作問成功で問題数が 10 増加し、既存問題は保持されること。
  - _Requirements: 2.3, 2.4, 2.12, 4.3, 4.6, 7.1, 7.4, 7.5_
  - _Depends: 5.1, 5.2, 5.3_
  - _Boundary: QuizEditor_

### 7. 料金画面連携

- [x] 7.1 `pricing-display` の Pro 特典文言更新
  - AI 作問（1日100回）・サムネ AI 生成（1日20回）を Pro 特典一覧に追加する。
  - 完了時、`/pricing` に制限付き AI 作問特典が表示されること。
  - _Requirements: 8.3, 8.5_
  - _Boundary: pricing-display_

### 8. E2E 検証

- [x] 8.1 `e2e/ai-quiz-authoring.spec.ts` の実装
  - Pro fixture: パネル残り回数表示 → プロンプト生成 → 問題 +10。
  - 無料 fixture: Upsell 表示、lateral format で生成 disabled。
  - サムネ: title/description 未入力時の案内、入力後のプレビュー更新（API mock 可）。
  - 完了時、Playwright spec が CI ローカルで green であること。
  - _Requirements: 1.1, 1.2, 2.3, 2.7, 3.6, 4.4, 7.2, 7.3_
  - _Depends: 6.1_
  - _Boundary: E2E_

## Requirements Coverage Matrix

| 要件 | タスク |
|------|--------|
| 1.1–1.5 | 1.2, 3.1, 3.2, 3.3, 5.1, 5.2 |
| 2.1–2.12 | 1.2, 3.2, 4.1, 5.2, 6.1 |
| 3.1–3.6 | 1.2, 3.1, 3.2, 4.1, 5.2 |
| 4.1–4.6 | 2.1, 3.3, 4.1, 5.3, 6.1 |
| 5.1–5.6 | 1.2, 3.1, 3.3, 4.1, 5.3 |
| 6.1–6.7 | 3.1–3.3, 4.1, 5.1, 5.2 |
| 7.1–7.5 | 5.2, 5.3, 6.1, 8.1 |
| 8.1–8.5 | 1.1, 2.1, 2.2, 3.1–3.3, 7.1 |

## Implementation Notes

- API テストで非 Pro 403 を検証する際は `verifyFirebaseIdToken` の mock が request の `userId` と一致する UID を返す必要がある。
