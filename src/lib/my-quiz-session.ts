export const MY_QUIZ_SESSION_KEY = 'quizetika_my_quiz_session';

export interface MyQuizSessionEntry {
  questionId: string;
  parentQuizId: string;
}

export interface MyQuizSession {
  sessionId: string;
  entries: MyQuizSessionEntry[];
  currentIndex: number;
}

function hasSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

export function initMyQuizSession(
  sessionId: string,
  entries: MyQuizSessionEntry[]
): void {
  if (!hasSessionStorage()) return;
  const session: MyQuizSession = { sessionId, entries, currentIndex: 0 };
  sessionStorage.setItem(MY_QUIZ_SESSION_KEY, JSON.stringify(session));
}

export function readMyQuizSession(): MyQuizSession | null {
  if (!hasSessionStorage()) return null;
  const raw = sessionStorage.getItem(MY_QUIZ_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MyQuizSession;
  } catch {
    return null;
  }
}

function writeMyQuizSession(session: MyQuizSession): void {
  if (!hasSessionStorage()) return;
  sessionStorage.setItem(MY_QUIZ_SESSION_KEY, JSON.stringify(session));
}

export function clearMyQuizSession(): void {
  if (!hasSessionStorage()) return;
  sessionStorage.removeItem(MY_QUIZ_SESSION_KEY);
}

/** URL の qIndex とセッションの currentIndex を同期 */
export function syncMyQuizSessionIndex(index: number): void {
  const session = readMyQuizSession();
  if (!session) return;
  session.currentIndex = index;
  writeMyQuizSession(session);
}

/** インデックスを進め、次のエントリを返す。最終問題後は null */
export function advanceMyQuizSession(): MyQuizSessionEntry | null {
  const session = readMyQuizSession();
  if (!session) return null;
  const nextIndex = session.currentIndex + 1;
  if (nextIndex >= session.entries.length) return null;
  session.currentIndex = nextIndex;
  writeMyQuizSession(session);
  return session.entries[nextIndex];
}

/** 現在インデックスの次エントリを参照のみ（インデックスは進めない） */
export function peekNextMyQuizEntry(): MyQuizSessionEntry | null {
  const session = readMyQuizSession();
  if (!session) return null;
  const nextIndex = session.currentIndex + 1;
  if (nextIndex >= session.entries.length) return null;
  return session.entries[nextIndex];
}

export function buildMyQuizPlayUrl(session: MyQuizSession, index: number): string {
  const entry = session.entries[index];
  if (!entry) return '/';
  const params = new URLSearchParams({
    mode: 'my-quiz',
    sessionId: session.sessionId,
    questionId: entry.questionId,
    qIndex: String(index),
  });
  return `/quiz/${entry.parentQuizId}/play?${params.toString()}`;
}
