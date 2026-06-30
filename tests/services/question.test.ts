import { getQuestionsByQuiz } from '@/services/question';
import { getDoc, getDocs } from 'firebase/firestore';

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(),
    getDoc: jest.fn(),
    doc: jest.fn((_ref, ...paths) => ({ id: paths[paths.length - 1] })),
  };
});

describe('question service - getQuestionsByQuiz', () => {
  const quizId = 'quiz-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('問題の個別ドキュメントがすべて正常に存在する場合はそれらを返す', async () => {
    // クイズデータのモック（個別問題IDが2つ存在する）
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        id: quizId,
        questionIds: ['q-1', 'q-2'],
        questions: [
          { id: 'q-1', questionText: '親ドキュメント内の問題1' },
          { id: 'q-2', questionText: '親ドキュメント内の問題2' },
        ],
      }),
    });

    // 個別問題ドキュメントが正常に2件返ってくるモック
    (getDocs as jest.Mock).mockResolvedValue({
      forEach(callback: any) {
        [
          { id: 'q-1', data: () => ({ id: 'q-1', questionText: '個別問題1' }) },
          { id: 'q-2', data: () => ({ id: 'q-2', questionText: '個別問題2' }) },
        ].forEach((docSnap) => callback(docSnap));
      },
    });

    const questions = await getQuestionsByQuiz(quizId);

    expect(questions).toHaveLength(2);
    expect(questions[0].questionText).toBe('個別問題1');
    expect(questions[1].questionText).toBe('個別問題2');
  });

  it('問題の個別ドキュメントが欠落している（不整合）場合は、親の非正規化コピーをフォールバックとして返す', async () => {
    // クイズデータのモック
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        id: quizId,
        questionIds: ['q-1', 'q-2'],
        questions: [
          { id: 'q-1', questionText: '親ドキュメント内の問題1' },
          { id: 'q-2', questionText: '親ドキュメント内の問題2' },
        ],
      }),
    });

    // 個別問題ドキュメントが1件しか返ってこない（q-2が欠落している）モック
    (getDocs as jest.Mock).mockResolvedValue({
      forEach(callback: any) {
        [
          { id: 'q-1', data: () => ({ id: 'q-1', questionText: '個別問題1' }) },
        ].forEach((docSnap) => callback(docSnap));
      },
    });

    const questions = await getQuestionsByQuiz(quizId);

    // フォールバックにより親ドキュメント内の問題コピー（2件）が返ることを確認
    expect(questions).toHaveLength(2);
    expect(questions[0].questionText).toBe('親ドキュメント内の問題1');
    expect(questions[1].questionText).toBe('親ドキュメント内の問題2');
  });
});
