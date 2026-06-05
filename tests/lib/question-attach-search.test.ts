import {
  dedupeQuestionCandidates,
  filterQuestionCandidatesByKeyword,
  mergeQuestionCandidates,
  type QuestionAttachCandidate,
} from '../../src/lib/question-attach-search';

function candidate(
  id: string,
  text: string,
  title = '親クイズ'
): QuestionAttachCandidate {
  return {
    questionId: id,
    questionText: text,
    parentQuizId: 'quiz-1',
    parentQuizTitle: title,
    source: 'own-published',
  };
}

describe('question-attach-search', () => {
  test('dedupeQuestionCandidates: questionId 重複を除去', () => {
    const input = [
      candidate('q1', 'A'),
      candidate('q1', 'B'),
      candidate('q2', 'C'),
    ];
    const result = dedupeQuestionCandidates(input);
    expect(result).toHaveLength(2);
    expect(result[0].questionText).toBe('A');
  });

  test('mergeQuestionCandidates: マージ後に重複除去', () => {
    const a = [candidate('q1', 'A')];
    const b = [candidate('q1', 'B'), candidate('q2', 'C')];
    expect(mergeQuestionCandidates(a, b)).toHaveLength(2);
  });

  test('filterQuestionCandidatesByKeyword: 設問文で部分一致', () => {
    const list = [
      candidate('q1', 'JavaScript の基礎'),
      candidate('q2', 'Python 入門'),
    ];
    expect(filterQuestionCandidatesByKeyword(list, 'java')).toHaveLength(1);
  });

  test('filterQuestionCandidatesByKeyword: 親タイトルで部分一致', () => {
    const list = [candidate('q1', '問題', 'React 応用')];
    expect(filterQuestionCandidatesByKeyword(list, 'react')).toHaveLength(1);
  });

  test('filterQuestionCandidatesByKeyword: 空キーワードは全件', () => {
    const list = [candidate('q1', 'A'), candidate('q2', 'B')];
    expect(filterQuestionCandidatesByKeyword(list, '')).toHaveLength(2);
    expect(filterQuestionCandidatesByKeyword(list, '   ')).toHaveLength(2);
  });
});
