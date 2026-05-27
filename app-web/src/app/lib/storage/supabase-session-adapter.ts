/**
 * Inactive Supabase session adapter skeleton.
 *
 * This file is intentionally NOT wired into the app runtime. It provides
 * future cloud-session persistence helpers only. Functions execute Supabase
 * queries only when explicitly called by a future integration task.
 *
 * RLS assumption:
 *   speaking_sessions.owner_id = auth.jwt()->>'sub'
 */

import type { FonetikSupabaseClient } from "../supabase";
import type { StoredSessionRecord } from "./types";

const SPEAKING_SESSIONS_TABLE = "speaking_sessions";

export type SupabaseSpeakingSessionRow = {
  id: string;
  owner_id: string;
  client_id: string;
  date: string | null;
  level: string | null;
  mode: string | null;
  feedback_type: string | null;
  session_type: string | null;
  provider: string | null;
  today_target: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  main_weakness: string | null;
  evidence: string | null;
  better_phrase: string | null;
  retry_task: string | null;
  retry_transcript: string | null;
  csv: string | null;
  created_at: string;
};

export type SupabaseSpeakingSessionInsert = {
  owner_id: string;
  client_id: string;
  date: string;
  level: string;
  mode: string;
  feedback_type: string;
  session_type: string;
  provider: string;
  today_target: string;
  duration_seconds: number;
  transcript: string;
  main_weakness: string;
  evidence: string;
  better_phrase: string;
  retry_task: string;
  retry_transcript: string;
  csv: string;
  created_at?: string;
};

export function mapStoredSessionToSupabaseInsert(
  ownerId: string,
  session: StoredSessionRecord,
): SupabaseSpeakingSessionInsert {
  return {
    owner_id: ownerId,
    client_id: session.id,
    date: session.date,
    level: session.level,
    mode: session.mode,
    feedback_type: session.feedbackType,
    session_type: session.sessionType,
    provider: session.provider,
    today_target: session.todayTarget,
    duration_seconds: session.durationSeconds,
    transcript: session.transcript,
    main_weakness: session.mainWeakness,
    evidence: session.evidence,
    better_phrase: session.betterPhrase,
    retry_task: session.retryTask,
    retry_transcript: session.retryTranscript,
    csv: session.csv,
    created_at: session.date,
  };
}

export function mapSupabaseRowToStoredSession(
  row: SupabaseSpeakingSessionRow,
): StoredSessionRecord {
  return {
    id: row.client_id,
    date: row.date ?? "",
    level: row.level ?? "",
    mode: row.mode ?? "",
    feedbackType: row.feedback_type ?? "",
    sessionType: row.session_type ?? "",
    provider: row.provider ?? "",
    todayTarget: row.today_target ?? "",
    durationSeconds: row.duration_seconds ?? 0,
    transcript: row.transcript ?? "",
    mainWeakness: row.main_weakness ?? "",
    evidence: row.evidence ?? "",
    betterPhrase: row.better_phrase ?? "",
    retryTask: row.retry_task ?? "",
    retryTranscript: row.retry_transcript ?? "",
    csv: row.csv ?? "",
  };
}

export async function loadSupabaseSessions(
  ownerId: string,
  supabaseClient: FonetikSupabaseClient,
): Promise<StoredSessionRecord[]> {
  const { data, error } = await supabaseClient
    .from(SPEAKING_SESSIONS_TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as SupabaseSpeakingSessionRow[] | null ?? []).map(
    mapSupabaseRowToStoredSession,
  );
}

export async function saveSupabaseSessions(
  ownerId: string,
  sessions: ReadonlyArray<StoredSessionRecord>,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  const rows = sessions.map((session) =>
    mapStoredSessionToSupabaseInsert(ownerId, session),
  );

  if (rows.length === 0) return;

  const { error } = await supabaseClient
    .from(SPEAKING_SESSIONS_TABLE)
    .upsert(rows, { onConflict: "owner_id,client_id" });

  if (error) {
    throw error;
  }
}

export async function addSupabaseSession(
  ownerId: string,
  session: StoredSessionRecord,
  supabaseClient: FonetikSupabaseClient,
): Promise<void> {
  await saveSupabaseSessions(ownerId, [session], supabaseClient);
}
