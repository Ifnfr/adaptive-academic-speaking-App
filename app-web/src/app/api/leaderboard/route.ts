import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildLeaderboardSnapshot,
  type LeaderboardProfileInput,
  type LeaderboardEventInput,
  type LeaderboardBadgeInput,
  type LeaderboardSnapshot,
} from "../../lib/leaderboard/leaderboard-aggregation";

// This route runs on the Node.js runtime so process.env is available
// for server-side keys. Keys never leave the server.
export const runtime = "nodejs";

// ---------- Constants ----------

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

// ---------- Supabase Service Role Client (read-only usage) ----------

interface ServiceClient {
  from(table: string): {
    select(columns: string): PromiseLike<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
}

function getSupabaseServiceClient(): ServiceClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

// ---------- Timezone-aware current date (Asia/Jakarta) ----------

function getJakartaDateString(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
}

// ---------- Row Types (Supabase query results) ----------

interface ProfileRow {
  id: string;
  owner_id: string;
  display_name: string | null;
  avatar_url: string | null;
  leaderboard_opt_in: boolean;
}

interface XpProfileRow {
  owner_id: string;
  total_xp: number;
}

interface XpEventRow {
  owner_id: string;
  type: string;
  source_id: string;
  xp: number;
  local_date: string;
}

interface BadgeRow {
  owner_id: string;
  status: string;
}

// ---------- Testable Handler ----------

/**
 * Core handler for the leaderboard route.
 * Exported for unit tests — the GET handler wraps this with auth and
 * Supabase client creation.
 */
export async function handleLeaderboardGet(deps: {
  period: string | null;
  currentUserId: string | null;
  supabase: ServiceClient;
  currentDateStr: string;
}): Promise<{
  snapshot: LeaderboardSnapshot | null;
  error: string | null;
  status: number;
}> {
  const { period, currentUserId, supabase, currentDateStr } = deps;

  // 1. Read profiles (minimum fields only)
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, owner_id, display_name, avatar_url, leaderboard_opt_in");

  if (profileError) {
    return { snapshot: null, error: "Failed to load profiles.", status: 502 };
  }

  // 2. Read xp_profiles for total_xp
  const { data: xpProfileRows, error: xpProfileError } = await supabase
    .from("xp_profiles")
    .select("owner_id, total_xp");

  if (xpProfileError) {
    return {
      snapshot: null,
      error: "Failed to load XP profiles.",
      status: 502,
    };
  }

  // 3. Read xp_events
  const { data: eventRows, error: eventError } = await supabase
    .from("xp_events")
    .select("owner_id, type, source_id, xp, local_date");

  if (eventError) {
    return { snapshot: null, error: "Failed to load XP events.", status: 502 };
  }

  // 4. Read badges
  const { data: badgeRows, error: badgeError } = await supabase
    .from("badges")
    .select("owner_id, status");

  if (badgeError) {
    return { snapshot: null, error: "Failed to load badges.", status: 502 };
  }

  // 5. Map Supabase rows → aggregation inputs

  const totalXpMap = new Map<string, number>();
  for (const row of (xpProfileRows || []) as XpProfileRow[]) {
    totalXpMap.set(row.owner_id, row.total_xp || 0);
  }

  const profiles: LeaderboardProfileInput[] = (
    (profileRows || []) as ProfileRow[]
  ).map((row) => ({
    ownerId: row.owner_id,
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    leaderboardOptIn: row.leaderboard_opt_in === true,
    totalXp: totalXpMap.get(row.owner_id) || 0,
  }));

  const events: LeaderboardEventInput[] = (
    (eventRows || []) as XpEventRow[]
  ).map((row) => ({
    owner_id: row.owner_id,
    type: row.type,
    source_id: row.source_id,
    xp: row.xp,
    local_date: row.local_date,
  }));

  const badges: LeaderboardBadgeInput[] = (
    (badgeRows || []) as BadgeRow[]
  ).map((row) => ({
    ownerId: row.owner_id,
    status: row.status as "locked" | "earned",
  }));

  // 6. Delegate to the aggregation core — no ranking logic here
  const snapshot = buildLeaderboardSnapshot({
    period,
    currentDateStr,
    profiles,
    events,
    badges,
    currentUserId,
  });

  return { snapshot, error: null, status: 200 };
}

// ---------- Clerk Auth Helper ----------

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    // Dynamic import so the module can be loaded even if Clerk is
    // unavailable (e.g. in unit test contexts).
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    // If Clerk middleware is absent or auth fails, treat as signed out.
    return null;
  }
}

// ---------- Next.js GET Handler ----------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period");

  // Clerk auth — optional. Signed-out users receive a safe response.
  const currentUserId = await resolveCurrentUserId();

  // Supabase service client
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const currentDateStr = getJakartaDateString();

  const result = await handleLeaderboardGet({
    period,
    currentUserId,
    supabase,
    currentDateStr,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(result.snapshot, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}
