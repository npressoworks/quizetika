import type { NextRequest } from 'next/server';
import type { DocumentReference } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { resolveUserEntitlements } from '@/services/entitlement';
import {
  assertAiAuthoringAccess,
  canAccessAiAuthoring,
  getJstTodayString,
  readDailyAuthoringCount,
  DAILY_AUTHORING_DOC_QUESTIONS,
  DAILY_AUTHORING_DOC_THUMBNAIL,
  DAILY_AUTHORING_DOC_CHAT,
} from '@/services/ai-authoring-utils';
import type { DailyAiAuthoringCountDoc } from '@/services/ai-authoring-types';
import type { AssertAiAuthoringAccessResult } from '@/services/ai-authoring-types';

export type AuthoringAuthFailure = {
  status: 401 | 403;
  error: string;
  message: string;
};

export type AuthoringAuthSuccess = {
  access: AssertAiAuthoringAccessResult;
  todayStr: string;
  questionsCount: number;
  thumbnailCount: number;
  chatCount: number;
  questionsCountRef: DocumentReference;
  thumbnailCountRef: DocumentReference;
  chatCountRef: DocumentReference;
};

export async function authorizeAiAuthoringRequest(
  request: NextRequest,
  userId: string
): Promise<AuthoringAuthSuccess | AuthoringAuthFailure> {
  if (!userId) {
    return {
      status: 401,
      error: 'unauthorized',
      message: 'ログインが必要です',
    };
  }

  const token = extractBearerToken(request);
  const verifiedUid = await verifySupabaseAccessToken(token);

  if (!verifiedUid || verifiedUid !== userId) {
    return {
      status: 401,
      error: 'unauthorized',
      message: '認証に失敗したか、本人の操作ではありません',
    };
  }

  const entitlements = await resolveUserEntitlements(verifiedUid);
  if (!canAccessAiAuthoring(entitlements)) {
    return {
      status: 403,
      error: 'pro-required',
      message: 'AI 作問は Pro プラン契約者のみ利用できます',
    };
  }

  const access = assertAiAuthoringAccess(entitlements, verifiedUid);
  const db = getAdminFirestore();
  const todayStr = getJstTodayString();

  const questionsCountRef = db
    .collection('users')
    .doc(verifiedUid)
    .collection('dailyAiAuthoringCounts')
    .doc(DAILY_AUTHORING_DOC_QUESTIONS);
  const thumbnailCountRef = db
    .collection('users')
    .doc(verifiedUid)
    .collection('dailyAiAuthoringCounts')
    .doc(DAILY_AUTHORING_DOC_THUMBNAIL);
  const chatCountRef = db
    .collection('users')
    .doc(verifiedUid)
    .collection('dailyAiAuthoringCounts')
    .doc(DAILY_AUTHORING_DOC_CHAT);

  const [questionsSnap, thumbnailSnap, chatSnap] = await Promise.all([
    questionsCountRef.get(),
    thumbnailCountRef.get(),
    chatCountRef.get(),
  ]);

  return {
    access,
    todayStr,
    questionsCount: readDailyAuthoringCount(
      questionsSnap.data() as DailyAiAuthoringCountDoc | undefined,
      todayStr
    ),
    thumbnailCount: readDailyAuthoringCount(
      thumbnailSnap.data() as DailyAiAuthoringCountDoc | undefined,
      todayStr
    ),
    chatCount: readDailyAuthoringCount(
      chatSnap.data() as DailyAiAuthoringCountDoc | undefined,
      todayStr
    ),
    questionsCountRef,
    thumbnailCountRef,
    chatCountRef,
  };
}
