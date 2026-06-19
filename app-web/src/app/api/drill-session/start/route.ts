import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePatternBriefContent } from "../../../lib/drill-session/brief-generator";
import { createInitialState } from "../../../lib/drill-session/state";
import { containsOwnerOrInternalFields, validateSessionInputKeys } from "../../../lib/drill-session/validation";
import { testHooks } from "./route-test-hooks";
import crypto from "crypto";

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

  // Allowed keys: level, mode, source, focus, sourceId
  const allowedKeys = ["level", "mode", "source", "focus", "sourceId"];
  if (!validateSessionInputKeys(body, allowedKeys)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const { level, mode, source, focus, sourceId } = body as {
    level?: string;
    mode?: string;
    source?: string;
    focus?: string;
    sourceId?: string;
  };

  if (typeof level !== "string" || typeof mode !== "string" || typeof source !== "string") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (level === "expert") {
    return NextResponse.json({ error: "unsupported_level" }, { status: 400, headers });
  }

  if (!["beginner", "intermediate", "advanced"].includes(level)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (!["fluency_sprint", "structured_response"].includes(mode)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  if (!["manual", "latest_weakness"].includes(source)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers });
  }

  const supabaseClient = getSupabaseClient();

  try {
    const brief = await generatePatternBriefContent(
      ownerId,
      supabaseClient,
      { level, mode, source, focus, sourceId, allowFallbacks: true },
      { callClaude: testHooks.callClaude || undefined }
    );

    const sessionId = crypto.randomUUID();
    const state = createInitialState(sessionId, brief);

    return NextResponse.json({
      ...state,
      drillEntryConfig: brief.drillEntryConfig,
    }, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "focus_required" || msg === "focus_too_long" || msg === "invalid_request") {
      return NextResponse.json({ error: msg }, { status: 400, headers });
    }
    if (msg === "latest_weakness_not_found") {
      return NextResponse.json({ error: msg }, { status: 404, headers });
    }
    if (msg === "latest_weakness_insufficient") {
      return NextResponse.json({ error: msg }, { status: 409, headers });
    }
    if (msg === "pattern_brief_failed") {
      return NextResponse.json({ error: msg }, { status: 500, headers });
    }
    if (msg === "latest_weakness_fetch_failed" || msg === "invalid_provider_response" || msg === "provider_unavailable") {
      return NextResponse.json({ error: msg }, { status: 502, headers });
    }
    if (msg === "provider_not_configured") {
      return NextResponse.json({ error: msg }, { status: 503, headers });
    }
    console.error("Drill session start error:", err);
    return NextResponse.json({ error: "pattern_brief_failed" }, { status: 500, headers });
  }
}
