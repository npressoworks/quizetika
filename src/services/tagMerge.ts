import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  runTransaction,
  writeBatch,
  increment,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { usersRef, quizzesRef } from '../lib/firebase/firestore';
import { resolveModerationTier } from './reputation';
import { User, Quiz } from '../types';
import {
  MERGE_MIN_APPROVE_RATE,
  MERGE_MIN_APPROVE_WEIGHT,
  GENRE_MIN_APPROVE_RATE,
  GENRE_MIN_APPROVE_WEIGHT,
} from '../lib/metadata-governance';
import initialGenresData from '../data/initial_genres.json';

const mergeRequestsCollection = collection(db, 'mergeRequests');
const genreRequestsCollection = collection(db, 'genreRequests');
const metadataTagsCollection = collection(db, 'metadata_tags');
const metadataGenresCollection = collection(db, 'metadata_genres');

export interface MergeRequest {
  id?: string;
  targetType: 'tag' | 'genre';
  sourceId: string;
  targetId: string;
  requesterId: string;
  requesterName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  votesForCount: number;
  votesAgainstCount: number;
  weightedVotesFor: number;
  weightedVotesAgainst: number;
  votedUserIds: string[];
  votes: Array<{
    voterId: string;
    type: 'for' | 'against';
    weight: number;
    votedAt: Date;
  }>;
  migrationStatus?: 'processing' | 'completed' | 'failed' | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenreRequest {
  id?: string;
  genreId: string;
  displayName: string;
  description: string;
  iconImageUrl: string;
  requesterId: string;
  status: 'pending' | 'approved' | 'rejected';
  votesForCount: number;
  votesAgainstCount: number;
  weightedVotesFor: number;
  weightedVotesAgainst: number;
  votedUserIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ユーザーのティアーから投票の重み（ウェイト）を取得
 * - senior_moderator ➔ 2
 * - その他 ➔ 1
 */
function getVoteWeight(tier: string): number {
  return tier === 'senior_moderator' ? 2 : 1;
}

/**
 * タグ/ジャンルのマージ提案を起案する
 * 起案時点で起案者は自動的に賛成1票（重み付き）
 */
export async function createMergeRequest(
  sourceId: string,
  targetId: string,
  targetType: 'tag' | 'genre',
  reason: string,
  userId: string
): Promise<string> {
  if (sourceId === targetId) {
    throw new Error('同一のタグ/ジャンルをマージすることはできません。');
  }

  // 循環参照チェック (A ➔ B ➔ A や A ➔ B ➔ C ➔ A などの無限ループ防止)
  const masterCollection = targetType === 'tag' ? metadataTagsCollection : metadataGenresCollection;
  const targetMasterRef = doc(masterCollection, targetId);
  const targetMasterSnap = await getDoc(targetMasterRef);

  if (targetMasterSnap.exists()) {
    const targetData = targetMasterSnap.data() as { canonicalId?: string | null };
    let currentCanonicalId = targetData.canonicalId;
    const visited = new Set<string>([targetId]);

    while (currentCanonicalId) {
      if (currentCanonicalId === sourceId) {
        throw new Error('循環マージが発生するため、このマージ提案は起案できません。');
      }
      if (visited.has(currentCanonicalId)) {
        break; // 循環検知時に無限ループを防止
      }
      visited.add(currentCanonicalId);

      const nextSnap = await getDoc(doc(masterCollection, currentCanonicalId));
      if (!nextSnap.exists()) {
        break;
      }
      const nextData = nextSnap.data() as { canonicalId?: string | null };
      currentCanonicalId = nextData.canonicalId;
    }
  }

  // 重複・循環参照チェック
  const proposerSnap = await getDoc(doc(usersRef, userId));
  if (!proposerSnap.exists()) throw new Error('起案ユーザーが見つかりません。');
  const proposer = proposerSnap.data() as User;
  const weight = getVoteWeight(proposer.moderationTier);

  // 重複チェック
  const dupQuery = query(
    mergeRequestsCollection,
    where('sourceId', '==', sourceId),
    where('targetId', '==', targetId),
    where('status', '==', 'pending')
  );
  const dupSnap = await getDocs(dupQuery);
  if (!dupSnap.empty) {
    throw new Error('既に同じマージ提案が進行中です。');
  }

  const now = new Date();
  const requestPayload: Omit<MergeRequest, 'id'> = {
    targetType,
    sourceId,
    targetId,
    requesterId: userId,
    requesterName: proposer.displayName,
    reason,
    status: 'pending',
    votesForCount: 1,
    votesAgainstCount: 0,
    weightedVotesFor: weight,
    weightedVotesAgainst: 0,
    votedUserIds: [userId],
    votes: [
      {
        voterId: userId,
        type: 'for',
        weight,
        votedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const newDocRef = doc(mergeRequestsCollection);
  await setDoc(newDocRef, requestPayload);
  return newDocRef.id;
}

/**
 * マージリクエストに賛成/反対投票を行う
 */
export async function voteMergeRequest(
  requestId: string,
  voterId: string,
  opinion: 'approve' | 'reject'
): Promise<void> {
  const requestRef = doc(mergeRequestsCollection, requestId);
  const voterRef = doc(usersRef, voterId);

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) throw new Error('マージ提案が見つかりません。');
    const request = requestSnap.data() as MergeRequest;

    if (request.status !== 'pending') {
      throw new Error('この提案は既に審査が終了しています。');
    }

    if (request.votedUserIds.includes(voterId)) {
      throw new Error('既にこの提案に投票済みです。');
    }

    const voterSnap = await transaction.get(voterRef);
    if (!voterSnap.exists()) throw new Error('投票者が見つかりません。');
    const voter = voterSnap.data() as User;
    const weight = getVoteWeight(voter.moderationTier);
    const now = new Date();

    const newVotedUserIds = [...request.votedUserIds, voterId];
    const newVotes = [
      ...request.votes,
      {
        voterId,
        type: opinion === 'approve' ? ('for' as const) : ('against' as const),
        weight,
        votedAt: now,
      },
    ];

    const isApprove = opinion === 'approve';
    const forCount = request.votesForCount + (isApprove ? 1 : 0);
    const againstCount = request.votesAgainstCount + (isApprove ? 0 : 1);
    const weightedFor = request.weightedVotesFor + (isApprove ? weight : 0);
    const weightedAgainst = request.weightedVotesAgainst + (isApprove ? 0 : weight);

    const updates: Partial<MergeRequest> & { updatedAt: Date } = {
      votedUserIds: newVotedUserIds,
      votes: newVotes,
      votesForCount: forCount,
      votesAgainstCount: againstCount,
      weightedVotesFor: weightedFor,
      weightedVotesAgainst: weightedAgainst,
      updatedAt: now,
    };

    // 可決/否決判定
    // 可決条件: 重み付き賛成票 >= 5 かつ 賛成率 >= 70%
    const totalWeighted = weightedFor + weightedAgainst;
    const approveRate = weightedFor / totalWeighted;

    if (weightedFor >= MERGE_MIN_APPROVE_WEIGHT && approveRate >= MERGE_MIN_APPROVE_RATE) {
      updates.status = 'approved';
      updates.migrationStatus = 'processing';

      // マスタ適用
      if (request.targetType === 'tag') {
        const sourceTagRef = doc(metadataTagsCollection, request.sourceId);
        const targetTagRef = doc(metadataTagsCollection, request.targetId);

        transaction.update(sourceTagRef, {
          canonicalId: request.targetId,
          updatedAt: Timestamp.fromDate(now),
        });

        transaction.update(targetTagRef, {
          mergedTagIds: arrayUnion(request.sourceId),
          updatedAt: Timestamp.fromDate(now),
        });
      } else {
        const sourceGenreRef = doc(metadataGenresCollection, request.sourceId);
        const targetGenreRef = doc(metadataGenresCollection, request.targetId);

        transaction.update(sourceGenreRef, {
          canonicalId: request.targetId,
          updatedAt: Timestamp.fromDate(now),
        });

        transaction.update(targetGenreRef, {
          mergedGenreIds: arrayUnion(request.sourceId),
          updatedAt: Timestamp.fromDate(now),
        });
      }

      // 非同期（バックグラウンド）移行処理をキック
      setTimeout(() => {
        runMigration(requestId, request.sourceId, request.targetId, request.targetType).catch((err) => {
          console.error('[Migration] 移行ジョブエラー:', err);
        });
      }, 0);
    } else if (weightedAgainst >= 5) {
      // 否決
      updates.status = 'rejected';
    }

    transaction.update(requestRef, updates as any);
  });
}

/**
 * 過去のクイズドキュメントの canonicalTagIds または canonicalGenreId を書き換えるバックグラウンド移行バッチ
 * 1回あたり100件ずつのCursor分割ループで動作します。
 */
export async function runMigration(
  requestId: string,
  sourceId: string,
  targetId: string,
  targetType: 'tag' | 'genre'
): Promise<void> {
  const requestRef = doc(mergeRequestsCollection, requestId);
  const CHUNK_SIZE = 100;

  try {
    let hasMore = true;
    while (hasMore) {
      // 移行対象のクイズを取得
      const targetQuery = targetType === 'tag'
        ? query(quizzesRef, where('tags', 'array-contains', sourceId), limit(CHUNK_SIZE))
        : query(quizzesRef, where('genre', '==', sourceId), limit(CHUNK_SIZE));

      const snap = await getDocs(targetQuery);
      if (snap.empty) {
        hasMore = false;
        break;
      }

      const batch = writeBatch(db);

      snap.docs.forEach((docSnap) => {
        const quiz = docSnap.data() as Quiz;
        if (targetType === 'tag') {
          // tags 配列から sourceId を除去し、targetId を追加、canonicalTagIds に反映
          const updatedTags = quiz.tags.filter((t) => t !== sourceId);
          if (!updatedTags.includes(targetId)) {
            updatedTags.push(targetId);
          }

          const updatedCanonical = quiz.canonicalTagIds.filter((t) => t !== sourceId);
          if (!updatedCanonical.includes(targetId)) {
            updatedCanonical.push(targetId);
          }

          batch.update(docSnap.ref, {
            tags: updatedTags,
            canonicalTagIds: updatedCanonical,
            updatedAt: new Date(),
          });
        } else {
          // genre を targetId に、canonicalGenreId も反映
          batch.update(docSnap.ref, {
            genre: targetId,
            canonicalGenreId: targetId,
            updatedAt: new Date(),
          });
        }
      });

      await batch.commit();

      // もし取得件数が CHUNK_SIZE 未満なら移行完了
      if (snap.docs.length < CHUNK_SIZE) {
        hasMore = false;
      }
    }

    // 移行完了をマーク
    await updateDoc(requestRef, {
      migrationStatus: 'completed',
      updatedAt: new Date(),
    });
  } catch (err) {
    console.error('[Migration] データ移行に失敗しました:', err);
    await updateDoc(requestRef, {
      migrationStatus: 'failed',
      updatedAt: new Date(),
    }).catch((e) => console.error('[Migration] ステータス fail 更新失敗:', e));
    throw err;
  }
}

/**
 * 新しいジャンルの申請を登録する
 */
export async function submitGenreRequest(
  genreId: string,
  displayName: string,
  description: string,
  iconImageUrl: string,
  requesterId: string
): Promise<string> {
  const proposerSnap = await getDoc(doc(usersRef, requesterId));
  if (!proposerSnap.exists()) throw new Error('申請者が見つかりません。');
  const proposer = proposerSnap.data() as User;
  const weight = getVoteWeight(proposer.moderationTier);

  const now = new Date();
  const requestPayload: Omit<GenreRequest, 'id'> = {
    genreId,
    displayName,
    description,
    iconImageUrl,
    requesterId,
    status: 'pending',
    votesForCount: 1,
    votesAgainstCount: 0,
    weightedVotesFor: weight,
    weightedVotesAgainst: 0,
    votedUserIds: [requesterId],
    createdAt: now,
    updatedAt: now,
  };

  const newDocRef = doc(genreRequestsCollection);
  await setDoc(newDocRef, requestPayload);
  return newDocRef.id;
}

/**
 * ジャンル新設申請に賛成/反対投票を行う
 */
export async function voteGenreRequest(
  requestId: string,
  voterId: string,
  opinion: 'approve' | 'reject'
): Promise<void> {
  const requestRef = doc(genreRequestsCollection, requestId);
  const voterRef = doc(usersRef, voterId);

  await runTransaction(db, async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) throw new Error('ジャンル申請が見つかりません。');
    const request = requestSnap.data() as GenreRequest;

    if (request.status !== 'pending') {
      throw new Error('この申請は既に処理済みです。');
    }

    if (request.votedUserIds.includes(voterId)) {
      throw new Error('既にこの申請に投票済みです。');
    }

    const voterSnap = await transaction.get(voterRef);
    if (!voterSnap.exists()) throw new Error('投票者が見つかりません。');
    const voter = voterSnap.data() as User;
    const weight = getVoteWeight(voter.moderationTier);
    const now = new Date();

    const newVotedUserIds = [...request.votedUserIds, voterId];
    const isApprove = opinion === 'approve';
    const forCount = request.votesForCount + (isApprove ? 1 : 0);
    const againstCount = request.votesAgainstCount + (isApprove ? 0 : 1);
    const weightedFor = request.weightedVotesFor + (isApprove ? weight : 0);
    const weightedAgainst = request.weightedVotesAgainst + (isApprove ? 0 : weight);

    const updates: Partial<GenreRequest> & { updatedAt: Date } = {
      votedUserIds: newVotedUserIds,
      votesForCount: forCount,
      votesAgainstCount: againstCount,
      weightedVotesFor: weightedFor,
      weightedVotesAgainst: weightedAgainst,
      updatedAt: now,
    };

    // 可決条件: 賛成票 >= 5 かつ 賛成率 >= 80%
    const totalWeighted = weightedFor + weightedAgainst;
    const approveRate = weightedFor / totalWeighted;

    if (weightedFor >= GENRE_MIN_APPROVE_WEIGHT && approveRate >= GENRE_MIN_APPROVE_RATE) {
      updates.status = 'approved';

      // ジャンルマスタ登録
      const newGenreRef = doc(metadataGenresCollection, request.genreId);
      transaction.set(newGenreRef, {
        id: request.genreId,
        displayName: request.displayName,
        description: request.description || '',
        iconImageUrl: request.iconImageUrl,
        canonicalId: null,
        mergedGenreIds: [],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    } else if (weightedAgainst >= 5) {
      updates.status = 'rejected';
    }

    transaction.update(requestRef, updates as any);
  });
}

/** `initial_genres.json` の1件分 */
export interface InitialGenreSeed {
  id: string;
  displayName: string;
  description?: string;
  iconImageUrl: string | null;
  canonicalId: string | null;
  mergedGenreIds: string[];
  isActive: boolean;
}

export interface SeedInitialGenresResult {
  added: number;
  updated: number;
}

/**
 * 初期ジャンル定義を metadata_genres へ冪等に投入する。
 * 既存IDはマスタフィールドを更新し、未存在IDは新規作成する。
 */
export async function seedInitialGenres(): Promise<SeedInitialGenresResult> {
  const genres = initialGenresData as InitialGenreSeed[];
  let added = 0;
  let updated = 0;
  const now = new Date();

  for (const genre of genres) {
    const genreRef = doc(metadataGenresCollection, genre.id);
    const snap = await getDoc(genreRef);

    const payload = {
      id: genre.id,
      displayName: genre.displayName,
      description: genre.description ?? '',
      iconImageUrl: genre.iconImageUrl,
      canonicalId: genre.canonicalId,
      mergedGenreIds: genre.mergedGenreIds ?? [],
      isActive: genre.isActive,
      updatedAt: now,
    };

    if (snap.exists()) {
      await updateDoc(genreRef, payload);
      updated += 1;
    } else {
      await setDoc(genreRef, { ...payload, createdAt: now });
      added += 1;
    }
  }

  return { added, updated };
}
