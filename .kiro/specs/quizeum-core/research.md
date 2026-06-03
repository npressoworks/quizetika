# Research & Design Decisions: quizeum-core (Phase 5)

## Summary
- **Feature**: quizeum-core - dual leaderboard and play-history API
- **References (Phase 5)**: docs F-801/F-802, api updateLeaderboard, roadmap Phase 5

---

# Gap Analysis: quizeum-core - Phase 6 genre metadata alignment (2026-06-03)

## Analysis Summary

- **Scope**: Phase 6 roadmap + docs canonical: genre virtual merge, write-time canonicalGenreId, canonical query optimization, Security Rules, saveQuiz pipeline (quizeum-core boundary).
- **Current**: tagMerge governance mostly done; quiz save/queries/rules diverge from docs/api_specification.md.
- **Top gap**: saveQuiz does not set canonicalGenreId/canonicalTagIds; getQuizzesByGenre/Tag and getFailedQuestions use raw genre/tags only.
- **Recommended for design**: Option C Hybrid - new src/lib/metadata-resolution.ts, extend quiz.ts saveQuiz and queries, port firestore.rules from detailed_design section 6.5.
- **Size/Risk**: L effort, Medium risk (empty canonical on legacy quizzes, indexes, dual-query fallback tests).

## Document Status

- Inputs: requirements.md (req 7,2), design.md, docs/api_specification.md, db_design.md, detailed_design.md section 6, roadmap Phase 6 (canonical optimization In)
- Method: gap-analysis.md framework, codebase grep/read
- Steering: only roadmap.md + security.md; docs treated as canonical

## 1. Current State

| Module | Genre relevance |
|--------|-----------------|
| tagMerge.ts | High - merge, genre requests, voteGenreRequest |
| quiz.ts | Low - saveQuiz no canonical; getQuizzesByGenre genre== only |
| quiz-validation.ts | Low - genre non-empty only |
| moderation.ts | Harmful duplicate genre APIs (unused) |
| attempt.ts | Low - genreFilter uses quiz.genre |
| firestore.rules | Missing metadata_genres, genreRequests, mergeRequests |
| firestore.indexes.json | Missing canonicalGenreId composites |

## 2. Requirement-to-Asset Gaps

| Source | Expected | Gap |
|--------|----------|-----|
| api_spec save | master validation + canonical fields | Missing in saveQuiz |
| api_spec search perf | canonicalGenreId == / canonicalTagIds | Missing (In scope per user) |
| detailed_design 6.4.2 | mergedGenreIds + genre in | Missing |
| detailed_design 6.5 | metadata rules | Missing |
| spec req 2.1 vs docs F-203 | draft genre required | Constraint - pick canonical source |
| searchQuizzes | composite search service | Not implemented in src |

## 3. Options

### A: Extend quiz.ts inline - M / Medium risk
### B: New genre-metadata services - M-L / Low-Medium risk
### C: Hybrid (recommended candidate)
- metadata-resolution.ts + quiz/attempt extensions + rules/indexes
- Read C2: canonical query + genre-in fallback for legacy
- Write: always resolve canonicalGenreId on publish/update

## 4. Research Needed

- Draft genre required: requirements 2.1 vs docs
- Merge approval 70% vs genre 80%
- Include searchQuizzes in Phase 6 core?
- Optional backfill batch for empty canonicalGenreId

## 5. Effort

| Workstream | Effort | Risk |
|------------|--------|------|
| metadata-resolution + saveQuiz | M | Medium |
| queries + canonical C2 | M | Medium |
| firestore.rules | M | High |
| indexes + searchQuizzes optional | M-L | Medium |
| tests + dead code removal | S | Low |

Overall: L / Medium

## 6. Design Phase Recommendations

1. Option C + read C2 + write-time canonical required
2. APIs: listActiveGenres(), resolveCanonicalGenreId(), extended getQuizzesByGenre()
3. Indexes: status + canonicalGenreId + createdAt|playCount|bookmarksCount
4. Tests: metadata-resolution.test.ts, quiz-genre-query.test.ts
5. UI specs depend on core listActiveGenres (roadmap order)

## References (Phase 6)

- .kiro/steering/roadmap.md Phase 6
- docs/api_specification.md L140-148
- docs/detailed_design.md section 6.4.2, 6.5
- src/services/quiz.ts, tagMerge.ts, firestore.rules

---

# Design Synthesis: Phase 6 (2026-06-04)

## Summary
- **Approach**: Option C Hybrid + read C2 (canonical query + genre-in fallback)
- **Central module**: `src/lib/metadata-resolution.ts`
- **Governance**: `tagMerge.ts` only; remove `moderation.ts` genre stubs

## Design Decisions

### Decision: metadata-resolution lib
- **Rationale**: Same pattern as `leaderboard-ranking.ts` for Phase 5
- **Follow-up**: Unit tests in `metadata-resolution.test.ts`

### Decision: C2 read path for getQuizzesByGenre
- **Rationale**: Legacy quizzes with empty `canonicalGenreId` stay visible without mandatory batch
- **Trade-off**: Up to 2x queries per sort until backfill optional task

### Decision: searchQuizzes in core
- **Rationale**: Requirement 11.5; genre filter uses `resolveCanonicalGenreId` + expand

## Risks
- Missing firestore.rules blocks client tag create on save ? Phase 6 must ship rules with saveQuiz changes
- Index deployment lag causes query failures until indexes propagated
