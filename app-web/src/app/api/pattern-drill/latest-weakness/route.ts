import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { selectLatestWeakness } from "../../../lib/pattern-drill/weaknessSelector";

export const runtime = "nodejs";

export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  getSupabaseClient: null as (() => unknown) | null,
};

async function resolveCurrentUserId(): Promise<string | null> {
  if (testHooks.resolveCurrentUserId) {
    return testHooks.resolveCurrentUserId();
  }

  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

function getSupabaseClient() {
  if (testHooks.getSupabaseClient) {
    return testHooks.getSupabaseClient() as ReturnType<typeof createClient> | null;
  }

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

export async function GET() {
  const headers = { "Cache-Control": "no-store" };

  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401, headers });
  }

  const supabaseClient = getSupabaseClient();
  if (!supabaseClient) {
    return NextResponse.json(
      { error: "latest_weakness_unavailable" },
      { status: 503, headers }
    );
  }

  try {
    const { data: rows, error } = await supabaseClient
      .from("learner_error_patterns")
      .select("id, owner_id, source_kind, source_id, category, label, evidence, correction, practice_focus, created_at")
      .eq("owner_id", ownerId)
      .eq("source_kind", "podchat")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json(
        { error: "latest_weakness_fetch_failed" },
        { status: 502, headers }
      );
    }

    const selectorResult = selectLatestWeakness(rows, { ownerId });

    if (selectorResult.weakness) {
      const { ...safeWeakness } = selectorResult.weakness;
      delete (safeWeakness as Record<string, unknown>).owner_id;
      selectorResult.weakness = safeWeakness;
    }

    return NextResponse.json(selectorResult, { headers });
  } catch {
    return NextResponse.json(
      { error: "latest_weakness_fetch_failed" },
      { status: 502, headers }
    );
  }
}
