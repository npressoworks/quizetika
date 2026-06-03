# Gap Analysis: quizeum-moderation-governance-ui（2026-06-03）

## Analysis Summary

- **スコープ**: 要件 1〜3 は**実装済み**（`/admin/moderation`, `/community/merge`, `/community/genres` + `middleware.ts`）。Phase 6（要件 4）は**挙動はほぼ充足**だが、**共通化・テスト・コメント整合**が未完了。
- **最大ギャップ**: `src/lib/genre-icon-upload.ts` 未作成、ジャンルアイコン検証の単体テストなし、`page.tsx` 先頭コメントに旧「PNG/SVG」残存。
- **重複**: `community/genres/page.tsx` の `ALLOWED_ICON_TYPES` / 2MB 検証と `src/services/storage.ts` の `uploadImage` 検証が二重（意図は正しいが DRY 未達）。
- **上流**: `voteGenreRequest` → `metadata_genres` 登録は `tagMerge.ts`（core）で**実装済み**。
- **推奨**: **Option C（ハイブリッド）** — コメント修正 + `validateGenreIconFile` 抽出 + 単体テスト。工数 **S（0.5〜1 日）**、リスク **低**。

---

## 1. Current State Investigation

### 既存アセット

| 領域 | パス | 状態 |
|------|------|------|
| 管理者審査 | `src/app/admin/moderation/page.tsx` | キュー、復帰/削除、特別ビュー遷移 |
| マージ投票 | `src/app/community/merge/page.tsx` | 起案・投票・x2 バッジ・プログレスバー・`window.open` で一覧 |
| ジャンル申請 | `src/app/community/genres/page.tsx` | 申請・投票・履歴、MIME/2MB 検証、Storage アップロード |
| ルートガード | `src/middleware.ts` | Cookie tier + ページ側 `useAuth` |
| コア投票 | `src/services/tagMerge.ts` | `submitGenreRequest`, `voteGenreRequest`, 可決時 `metadata_genres` |
| Storage | `src/services/storage.ts` | `ALLOWED_MIME_TYPES`（SVG 除外）、2MB |
| E2E | `e2e/moderation-feedback.spec.ts` | 申請フォーム・履歴タブ（SVG 拒否は未検証） |

### ジャンルアイコン（Phase 6 関連コード）

```56:58:src/app/community/genres/page.tsx
/** PNG/JPEG/GIF のみ許可 (SEC-08 SVG-based XSS防御のためSVG形式を排除) */
const ALLOWED_ICON_TYPES = ['image/png', 'image/jpeg', 'image/gif'];
const MAX_ICON_SIZE = 2 * 1024 * 1024; // 2MB
```

- UI ラベル: 「PNG / JPEG / GIF、最大2MB」
- `accept`: `.png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif`
- `handleIconChange`: 非許可 MIME → `iconError`、submit ブロック
- **残存**: ファイル先頭コメント L5 が「PNG/SVGアイコンアップロード」（要件 4.1 未完了）

---

## 2. Requirement-to-Asset Map

| 要件 | 状態 | ギャップ |
|------|------|----------|
| **1.1〜1.5** 管理者審査 | ✅ 充足 | `admin` は `quizeum_role` cookie で判定（tier の `admin` 文字列ではない）— 現行設計どおり |
| **2.1〜2.7** マージ | ✅ おおむね充足 | 2.4「分割ビュー」は `window.open` 新規タブ（厳密な split view ではないが実用上可） |
| **3.1〜3.5** ジャンル申請・投票 | ✅ 充足 | 可決通知・`metadata_genres` は core トランザクション |
| **4.1** スペック SVG 禁止の明記 | ⚠️ 部分 | スペック本文は更新済み。**コードコメント**（`page.tsx` L5）のみ旧表記 |
| **4.2** accept / MIME 一致 | ✅ 充足 | 実装と `storage.ts` 整合 |
| **4.3** SVG 拒否 UX | ✅ 充足 | `file.type` 検証（拡張子偽装は Storage 側でも拒否） |
| **4.4** 可決時 icon コピー | ✅ 充足 | `tagMerge.voteGenreRequest` |
| **4.5** テスト | ❌ 欠落 | `genre-icon-upload` 単体テスト・E2E SVG 拒否なし |

### Phase 6 タスク対応

| タスク | ギャップ |
|--------|----------|
| 5.1 | `page.tsx` 先頭コメント 1 箇所 |
| 5.2 | `genre-icon-upload.ts` 未作成、`storage.ts` との定数重複 |
| 5.3 | Jest 未追加 |
| 5.4 | E2E 任意 |

---

## 3. Implementation Approach Options

### Option A: コメント修正のみ

- `page.tsx` L5 を修正して完了扱い。

| 長所 | 短所 |
|------|------|
| 最小 diff | 要件 4.5・設計の `validateGenreIconFile` 未達 |
| 即日完了 | DRY・回帰テストなし |

**Effort**: XS | **Risk**: Low（挙動変更なし）

### Option B: `storage.ts` のみ共通化

- `uploadImage` の定数を export し genres ページから import。

| 長所 | 短所 |
|------|------|
| サーバー側と一致保証 | ページの `handleIconChange` は依然インライン |

**Effort**: S | **Risk**: Low

### Option C: ハイブリッド（推奨）

- 新規 `src/lib/genre-icon-upload.ts`: `validateGenreIconFile(file) => { ok, error }`、定数 export。
- `community/genres/page.tsx` と（任意）`storage.ts` から利用。
- `tests/lib/genre-icon-upload.test.ts`（PNG OK、SVG NG、2MB+ NG）。
- L5 コメント修正。

| 長所 | 短所 |
|------|------|
| tasks.md 5.1〜5.3 と一致 | 新規ファイル 2 |
| 回帰テストで SEC-08 固定 | `storage.ts` 変更は任意 |

**Effort**: **S（0.5〜1 日）** | **Risk**: **低**

---

## 4. Research Needed（実装時）

| 項目 | 内容 |
|------|------|
| `file.type` 空のケース | 一部ブラウザで MIME 未設定 — 拡張子フォールバック要否（現状は拒否で安全側） |
| E2E SVG | Playwright で `image/svg+xml` の File モックまたは fixture パス |
| マージ 2.4 | split view 要件を「新規タブで一覧」で充足とみなすか spec 文言を更新するか（Phase 6 外） |

---

## 5. Upstream / Downstream

| 依存 | 状態 |
|------|------|
| `quizeum-core` `voteGenreRequest` | ✅ |
| `quizeum-play-flow-ui` / `creator-dash-ui` | 可決後 `listActiveGenres` に反映（別スペック・実装済み） |
| `docs/detailed_design.md` L832 | 旧パス例 `.svg` 記載あり — **docs-sync-genre**（roadmap 直接候補）が別タスク |

---

## 6. Design Phase Recommendations

1. **採用**: Option C。
2. **優先**: 5.1 コメント → 5.2 `genre-icon-upload.ts` → 5.3 テスト。
3. **完了定義**: SVG 選択で `iconError` + submit disabled；`npm test` / `build` PASS。
4. **Out of scope 維持**: 可決時 Storage パス正規化・アイコン移動は core/docs follow-up のまま。

## Document Status

- 手法: コード Grep/Read + 要件 4 トレース + `tasks.md` 照合
- 出力: 本ファイル（新規）
