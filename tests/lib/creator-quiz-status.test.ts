import {
  resolveCreatorQuizStatus,
  type CreatorQuizStatus,
} from '@/lib/creator-quiz-status';
import type { Quiz } from '@/types';

type QuizStatusInput = Pick<Quiz, 'status' | 'visibility'>;

describe('resolveCreatorQuizStatus', () => {
  test('下書き（status: draft）は draft を返すこと', () => {
    const quiz: QuizStatusInput = { status: 'draft', visibility: undefined };
    expect(resolveCreatorQuizStatus(quiz)).toBe<CreatorQuizStatus>('draft');
  });

  test('凍結（status: suspended）は suspended を返すこと', () => {
    const quiz: QuizStatusInput = { status: 'suspended', visibility: undefined };
    expect(resolveCreatorQuizStatus(quiz)).toBe<CreatorQuizStatus>('suspended');
  });

  test('凍結（status: suspended）は visibility が設定されていても suspended を返す（draftより優先されること）', () => {
    const quiz: QuizStatusInput = { status: 'suspended', visibility: 'public' };
    expect(resolveCreatorQuizStatus(quiz)).toBe<CreatorQuizStatus>('suspended');
  });

  test('公開済み・公開範囲=public は public を返すこと', () => {
    const quiz: QuizStatusInput = { status: 'published', visibility: 'public' };
    expect(resolveCreatorQuizStatus(quiz)).toBe<CreatorQuizStatus>('public');
  });

  test('公開済み・visibility 未設定はデフォルトの public を返すこと', () => {
    const quiz: QuizStatusInput = { status: 'published', visibility: undefined };
    expect(resolveCreatorQuizStatus(quiz)).toBe<CreatorQuizStatus>('public');
  });

  test('公開済み・公開範囲=followers は followers を返すこと', () => {
    const quiz: QuizStatusInput = { status: 'published', visibility: 'followers' };
    expect(resolveCreatorQuizStatus(quiz)).toBe<CreatorQuizStatus>('followers');
  });

  test('公開済み・公開範囲=private は private を返すこと', () => {
    const quiz: QuizStatusInput = { status: 'published', visibility: 'private' };
    expect(resolveCreatorQuizStatus(quiz)).toBe<CreatorQuizStatus>('private');
  });
});
