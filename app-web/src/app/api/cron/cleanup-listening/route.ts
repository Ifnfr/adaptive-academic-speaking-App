import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { abandonStaleSessions } from "../../listening-exercise/_lib/abandon-sessions";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vercel Cron endpoint (daily, see vercel.json "crons").
 * Marks abandoned listening sessions (in_progress > 24h) as 'abandoned'.
 * Protected by the x-vercel-cron header that Vercel adds — external callers
 * cannot spoof it, so no CRON_SECRET env var is needed.
 */
export async function GET(request: Request) {
  if (request.headers.get("x-vercel-cron") !== "1") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Database client configuration missing." },
      { status: 500 }
    );
  }

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const count = await abandonStaleSessions(supabase);
  return NextResponse.json({ ok: true, abandoned_sessions: count });
}
