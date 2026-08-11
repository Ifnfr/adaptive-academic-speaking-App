import { NextResponse } from "next/server";
import { resolveCurrentUserId, getSupabaseClient } from "../_lib/route-helpers";
import { calculateUserMetrics } from "@/lib/word-builder/metrics";

export const runtime = "nodejs";

// GET /api/word-builder/metrics
export async function GET(req: Request) {
  try {
    const userId = await resolveCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unconfigured" }, { status: 500 });
    }

    const metrics = await calculateUserMetrics(supabase, userId);
    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("Word Builder Metrics GET Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
