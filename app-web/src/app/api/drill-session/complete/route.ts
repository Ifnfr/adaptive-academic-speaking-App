import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeEvaluateSession } from "../../../lib/drill-session/session-completer";
import { mapSessionToEvaluateInput } from "../../../lib/drill-session/adapter";
import {
  containsOwnerOrInternalFields,
  isValidDrillSessionState,
} from "../../../lib/drill-session/validation";
import { testHooks } from "./route-test-hooks";
import type { DrillSessionState } from "../../../lib/drill-session/types";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };

  const ownerId = await resolveCurrentUserId();
  if (!ownerId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Reject owner or internal fields
  if (containsOwnerOrInternalFields(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Validate state
  if (!isValidDrillSessionState(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const supabaseClient = getSupabaseClient();

  try {
    const evaluateInput = mapSessionToEvaluateInput(body as DrillSessionState);

    const evaluateResult = await executeEvaluateSession(
      ownerId,
      supabaseClient,
      evaluateInput
    );

    const updatedSession = {
      ...(body as object),
      currentPhase: "complete" as const,
    };

    return NextResponse.json({
      ...evaluateResult,
      session: updatedSession,
    }, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "invalid_request" || msg === "incomplete_session") {
      return NextResponse.json({ error: msg }, { status: 400, headers });
    }
    console.error("Drill session complete error:", err);
    return NextResponse.json({ error: "evaluation_failed" }, { status: 500, headers });
  }
}
