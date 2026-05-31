import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { handleLeaderboardGet, type ServiceClient } from "./helper";

// This route runs on the Node.js runtime so process.env is available
// for server-side keys. Keys never leave the server.
export const runtime = "nodejs";

// ---------- Constants ----------

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

// ---------- Supabase Service Role Client (read-only usage) ----------

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
