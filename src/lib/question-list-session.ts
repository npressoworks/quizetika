export const QUESTION_LIST_SESSION_KEY = 'quizeum_question_list_session';

export interface QuestionListSessionEntry {
  questionId: string;
  parentQuizId: string;
}

export interface QuestionListSession {
  listId: string;
  entries: QuestionListSessionEntry[];
  currentIndex: number;
}

function hasSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

export function initQuestionListSession(
  listId: string,
  entries: QuestionListSessionEntry[]
): void {
  if (!hasSessionStorage()) return;
  const session: QuestionListSession = { listId, entries, currentIndex: 0 };
  sessionStorage.setItem(QUESTION_LIST_SESSION_KEY, JSON.stringify(session));
}

export function readQuestionListSession(): QuestionListSession | null {
  if (!hasSessionStorage()) return null;
  const raw = sessionStorage.getItem(QUESTION_LIST_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuestionListSession;
  } catch {
    return null;
  }
}

function writeQuestionListSession(session: QuestionListSession): void {
  if (!hasSessionStorage()) return;
  sessionStorage.setItem(QUESTION_LIST_SESSION_KEY, JSON.stringify(session));
}

export function clearQuestionListSession(): void {
  if (!hasSessionStorage()) return;
  sessionStorage.removeItem(QUESTION_LIST_SESSION_KEY);
}

/** URL の qIndex とセッションの currentIndex を同期 */
export function syncQuestionListSessionIndex(index: number): void {
  const session = readQuestionListSession();
  if (!session) return;
  session.currentIndex = index;
  writeQuestionListSession(session);
}

/** インデックスを進め、次のエントリを返す。最終設問後は null */
export function advanceQuestionListSession(): QuestionListSessionEntry | null {
  const session = readQuestionListSession();
  if (!session) return null;
  const nextIndex = session.currentIndex + 1;
  if (nextIndex >= session.entries.length) return null;
  session.currentIndex = nextIndex;
  writeQuestionListSession(session);
  return session.entries[nextIndex];
}

/** 現在インデックスの次エントリを参照のみ（インデックスは進めない） */
export function peekNextQuestionListEntry(): QuestionListSessionEntry | null {
  const session = readQuestionListSession();
  if (!session) return null;
  const nextIndex = session.currentIndex + 1;
  if (nextIndex >= session.entries.length) return null;
  return session.entries[nextIndex];
}

export function buildQuestionListPlayUrl(
  session: QuestionListSession,
  index: number
): string {
  const entry = session.entries[index];
  if (!entry) return '/';
  const params = new URLSearchParams({
    listId: session.listId,
    mode: 'question-list',
    questionId: entry.questionId,
    qIndex: String(index),
  });
  return `/quiz/${entry.parentQuizId}/play?${params.toString()}`;
}
