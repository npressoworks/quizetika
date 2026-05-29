import {
  doc,
  collection,
  setDoc,
  addDoc,
  runTransaction,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef } from '../lib/firebase/firestore';

/**
 * 難易度投票ドキュメントの型定義
 */
export interface DifficultyVote {
  id?: string;
  userId: string | null;
  quizId: string;
  vote: number; // 1〜10
  createdAt: Date;
}

/**
 * 体感難易度（1〜10）をアトミックに保存する。
 * 同一ユーザーは最新値で上書き保存され、クイズの難易度分布データにアトミック反映される。
 *
 * @param quizId 投票対象のクイズID
 * @param userId 投票ユーザーのID（nullの場合は匿名投票）
 * @param difficultyVote 投票する難易度（1〜10）
 */
export async function submitDifficultyVote(
  quizId: string,
  userId: string | null,
  difficultyVote: number
): Promise<void> {
  if (difficultyVote < 1 || difficultyVote > 10) {
    throw new Error('難易度投票は1から10の範囲で指定してください。');
  }

  const quizDocRef = doc(quizzesRef, quizId);
  const difficultyVotesCollection = collection(db, 'difficultyVotes');

  if (userId) {
    // ユーザーIDがある場合は上書きチェックとトランザクション
    const voteDocId = `${userId}_${quizId}`;
    const voteDocRef = doc(difficultyVotesCollection, voteDocId);

    await runTransaction(db, async (transaction) => {
      const quizSnap = await transaction.get(quizDocRef);
      if (!quizSnap.exists()) {
        throw new Error(`クイズが見つかりません: ${quizId}`);
      }

      const voteSnap = await transaction.get(voteDocRef);
      const now = new Date();

      if (voteSnap.exists()) {
        // 上書き投票
        const oldVoteData = voteSnap.data() as DifficultyVote;
        const oldVote = oldVoteData.vote;
        const diff = difficultyVote - oldVote;

        transaction.update(voteDocRef, {
          vote: difficultyVote,
          updatedAt: Timestamp.fromDate(now),
        });

        transaction.update(quizDocRef, {
          difficultyVotesSum: increment(diff),
          updatedAt: Timestamp.fromDate(now),
        });
      } else {
        // 新規投票
        const newVoteData: Omit<DifficultyVote, 'id'> = {
          userId,
          quizId,
          vote: difficultyVote,
          createdAt: now,
        };

        transaction.set(voteDocRef, newVoteData);
        transaction.update(quizDocRef, {
          difficultyVotesSum: increment(difficultyVote),
          difficultyVotesCount: increment(1),
          updatedAt: Timestamp.fromDate(now),
        });
      }
    });
  } else {
    // 匿名投票の場合は上書きチェックなしでアトミック加算のみ
    await runTransaction(db, async (transaction) => {
      const quizSnap = await transaction.get(quizDocRef);
      if (!quizSnap.exists()) {
        throw new Error(`クイズが見つかりません: ${quizId}`);
      }

      const now = new Date();
      const newVoteData: Omit<DifficultyVote, 'id'> = {
        userId: null,
        quizId,
        vote: difficultyVote,
        createdAt: now,
      };

      // ID自動生成で匿名レコードを作成
      const newVoteDocRef = doc(difficultyVotesCollection);
      transaction.set(newVoteDocRef, newVoteData);
      transaction.update(quizDocRef, {
        difficultyVotesSum: increment(difficultyVote),
        difficultyVotesCount: increment(1),
        updatedAt: Timestamp.fromDate(now),
      });
    });
  }
}
