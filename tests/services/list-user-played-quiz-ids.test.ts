jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

import { listUserPlayedQuizIds } from '../../src/services/attempt';
import { getDocs } from 'firebase/firestore';

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    collection: jest.fn(() => ({})),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(),
  };
});

describe('listUserPlayedQuizIds', () => {
  it('完了済み attempt の quizId を重複除去して返す', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        {
          data: () => ({
            quizId: 'q1',
            completedAt: new Date(),
            mode: 'normal',
          }),
        },
        {
          data: () => ({
            quizId: 'q1',
            completedAt: new Date(),
            mode: 'normal',
          }),
        },
        {
          data: () => ({
            quizId: 'q2',
            completedAt: null,
            mode: 'normal',
          }),
        },
        {
          data: () => ({
            quizId: 'q3',
            completedAt: new Date(),
            mode: 'test-play',
          }),
        },
      ],
    });

    const ids = await listUserPlayedQuizIds('user-1');
    expect(ids.sort()).toEqual(['q1']);
  });
});
