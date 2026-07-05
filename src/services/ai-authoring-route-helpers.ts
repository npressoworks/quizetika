import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { createAdminClient } from '@/lib/supabase/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { resolveUserEntitlements } from '@/services/entitlement';
import {
  assertAiAuthoringAccess,
  canAccessAiAuthoring,
  getJstTodayString,
  DAILY_AUTHORING_DOC_QUESTIONS,
  DAILY_AUTHORING_DOC_THUMBNAIL,
  DAILY_AUTHORING_DOC_CHAT,
} from '@/services/ai-authoring-utils';
import { readDailyUsageCount } from '@/lib/daily-usage-counters';
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
  supabase: SupabaseClient<Database>;
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
  const supabase = createAdminClient();
  const todayStr = getJstTodayString();

  const [questionsCount, thumbnailCount, chatCount] = await Promise.all([
    readDailyUsageCount(supabase, verifiedUid, DAILY_AUTHORING_DOC_QUESTIONS, todayStr),
    readDailyUsageCount(supabase, verifiedUid, DAILY_AUTHORING_DOC_THUMBNAIL, todayStr),
    readDailyUsageCount(supabase, verifiedUid, DAILY_AUTHORING_DOC_CHAT, todayStr),
  ]);

  return {
    access,
    todayStr,
    questionsCount,
    thumbnailCount,
    chatCount,
    supabase,
  };
}
