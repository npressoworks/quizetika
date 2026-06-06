import { searchTextIncludes } from '@/lib/normalize-search-text';

export interface QuestionAttachCandidate {
  questionId: string;
  questionText: string;
  parentQuizId: string;
  parentQuizTitle: string;
  source: QuestionAttachSource;
}

/**
 * 複数ソースの候補をマージし questionId 重複を除去（先勝ち）
 */
export function dedupeQuestionCandidates(
  candidates: QuestionAttachCandidate[]
): QuestionAttachCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.questionId)) return false;
    seen.add(c.questionId);
    return true;
  });
}

export function mergeQuestionCandidates(
  ...groups: QuestionAttachCandidate[][]
): QuestionAttachCandidate[] {
  return dedupeQuestionCandidates(groups.flat());
}

/**
 * 設問文・親タイトルに対するキーワード部分一致フィルタ
 */
export function filterQuestionCandidatesByKeyword(
  candidates: QuestionAttachCandidate[],
  keyword: string
): QuestionAttachCandidate[] {
  const trimmed = keyword.trim();
  if (!trimmed) return candidates;
  return candidates.filter(
    (c) =>
      searchTextIncludes(c.questionText, trimmed) ||
      searchTextIncludes(c.parentQuizTitle, trimmed)
  );
}
