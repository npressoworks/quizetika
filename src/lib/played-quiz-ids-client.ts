import { auth } from '@/lib/firebase/config';

export async function fetchPlayedQuizIds(): Promise<string[]> {
  const user = auth.currentUser;
  if (!user) {
    return [];
  }

  const token = await user.getIdToken();
  const res = await fetch('/api/user/played-quiz-ids', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`played-quiz-ids: ${res.status}`);
  }

  const body = (await res.json()) as { quizIds: string[] };
  return body.quizIds ?? [];
}
