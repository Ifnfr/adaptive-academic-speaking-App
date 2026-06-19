import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeEvaluateSession, EvaluateSessionInput } from "../../../lib/drill-session/session-completer";
import { testHooks } from "./route-test-hooks";

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

  // Reject unexpected or client-provided owner fields explicitly before any DB write attempt
  if ("ownerId" in (body as object) || "owner_id" in (body as object)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  // Reject unexpected fields
  const allowedKeys = [
    "briefId",
    "targetPattern",
    "targetSteps",
    "commonMistakes",
    "quickCheck",
    "phase1",
    "phase2",
    "phase3",
  ];
  const bodyKeys = Object.keys(body as Record<string, unknown>);
  if (bodyKeys.some((k) => !allowedKeys.includes(k))) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const {
    briefId,
    targetPattern,
    targetSteps,
    commonMistakes,
    quickCheck,
    phase1,
    phase2,
    phase3,
  } = body as {
    briefId?: unknown;
    targetPattern?: unknown;
    targetSteps?: unknown;
    commonMistakes?: unknown;
    quickCheck?: unknown;
    phase1?: unknown;
    phase2?: unknown;
    phase3?: unknown;
  };

  // Basic validation of structures in route to avoid runtime crashes before calling helper
  if (
    !quickCheck ||
    typeof quickCheck !== "object" ||
    !phase1 ||
    typeof phase1 !== "object" ||
    !phase2 ||
    typeof phase2 !== "object"
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const qc = quickCheck as { status?: unknown };
  const p1 = phase1 as { completedPromptCount?: unknown };
  const p2 = phase2 as { attempts?: unknown };

  if (typeof qc.status !== "string" || typeof p1.completedPromptCount !== "number" || !Array.isArray(p2.attempts)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const supabaseClient = getSupabaseClient();

  try {
    const result = await executeEvaluateSession(
      ownerId,
      supabaseClient,
      {
        briefId: briefId as string,
        targetPattern: targetPattern as string,
        targetSteps: targetSteps as string[],
        commonMistakes: commonMistakes as string[],
        quickCheckStatus: qc.status as "detected" | "not_detected_or_partial" | "skipped",
        phase1CompletedPromptCount: p1.completedPromptCount,
        phase2Attempts: p2.attempts as EvaluateSessionInput["phase2Attempts"],
        phase3: phase3 as EvaluateSessionInput["phase3"],
      }
    );
    return NextResponse.json(result, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "invalid_request" || msg === "incomplete_session") {
      return NextResponse.json({ error: msg }, { status: 400, headers });
    }
    console.error("Evaluate session helper error:", err);
    return NextResponse.json({ error: "evaluation_failed" }, { status: 500, headers });
  }
}
