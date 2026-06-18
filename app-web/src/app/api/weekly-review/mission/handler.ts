import { createClient } from "@supabase/supabase-js";
import {
  buildFallbackWeeklyMissionOutput,
  buildWeeklyMissionAnalyticSystemPrompt,
  buildWeeklyMissionAnalyticUserPrompt,
  buildWeeklyMissionAiInput,
  buildWeeklyMissionOutputFromPlanning,
  buildWeeklyMissionPlanningSystemPrompt,
  buildWeeklyMissionPlanningUserPrompt,
  classifySnapshotDataSufficiency,
  deriveWeeklyMissionReviewStatus,
  finalizeWeeklyMissions,
  parseWeeklyMissionAnalyticOutput,
  parseWeeklyMissionPlanningOutput,
} from "../../../lib/weekly-review-missions/generation";
import { getWeeklyMissionPeriod, type WeeklyMissionReview } from "../../../lib/weekly-review-missions";
import {
  calculateWeeklyMissionProgress,
  getCachedWeeklyMissionReview,
  getWeeklyMissionSourceSnapshot,
  saveWeeklyMissionReview,
  selectEnabledMissionMetrics,
} from "../../../lib/storage/supabase-weekly-mission-review-adapter";
import type { FonetikSupabaseClient } from "../../../lib/supabase";

type WeeklyMissionProviderPhase = "analytic" | "planning";

type HandlerDeps = {
  resolveCurrentUserId?: () => Promise<string | null>;
  getSupabaseClient?: () => FonetikSupabaseClient | null;
  callWeeklyMissionProvider?: (
    phase: WeeklyMissionProviderPhase,
    systemPrompt: string,
    userPrompt: string,
  ) => Promise<string>;
  providerTimeoutMs?: number;
  now?: () => Date;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const DEFAULT_DEEPSEEK_TIMEOUT_MS = 20_000;

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

function getSupabaseClient(): FonetikSupabaseClient | null {
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

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

function readTimezone(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : "UTC";
}

function hasForbiddenOwnerParam(url: URL): boolean {
  return ["ownerId", "owner_id", "userId", "user_id"].some((key) => url.searchParams.has(key));
}

function withProgress(review: WeeklyMissionReview, sourceSnapshot: Awaited<ReturnType<typeof getWeeklyMissionSourceSnapshot>>, now: Date): WeeklyMissionReview {
  const missions = calculateWeeklyMissionProgress({
    missions: review.missions,
    sourceSnapshot,
    now,
  });
  return {
    ...review,
    missions,
    status: deriveWeeklyMissionReviewStatus({
      missions,
      now,
      weekEnd: review.weekEnd,
    }),
  };
}

async function callDefaultWeeklyMissionProvider(
  _phase: WeeklyMissionProviderPhase,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("weekly_mission_provider_unavailable");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("weekly_mission_provider_unavailable");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("weekly_mission_provider_unavailable");
  return content;
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("weekly_mission_provider_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createWeeklyMissionRouteHandlers(deps: HandlerDeps = {}) {
  const authResolver = deps.resolveCurrentUserId ?? resolveCurrentUserId;
  const clientResolver = deps.getSupabaseClient ?? getSupabaseClient;
  const providerCaller = deps.callWeeklyMissionProvider ?? callDefaultWeeklyMissionProvider;
  const providerTimeoutMs = deps.providerTimeoutMs ?? DEFAULT_DEEPSEEK_TIMEOUT_MS;
  const now = deps.now ?? (() => new Date());

  async function GET(request: Request) {
    const ownerId = await authResolver();
    if (!ownerId) return json({ error: "auth_required" }, 401);

    const url = new URL(request.url);
    if (hasForbiddenOwnerParam(url)) return json({ error: "invalid_request" }, 400);

    const supabaseClient = clientResolver();
    if (!supabaseClient) return json({ error: "weekly_mission_unavailable" }, 503);

    const period = getWeeklyMissionPeriod({
      now: now(),
      timezone: readTimezone(url.searchParams.get("timezone")),
    });
    const review = await getCachedWeeklyMissionReview(ownerId, period.weekStart, period.weekEnd, supabaseClient);
    if (!review) {
      return json({ state: "not_generated", period, review: null });
    }

    try {
      const sourceSnapshot = await getWeeklyMissionSourceSnapshot(
        { ownerId, weekStart: period.weekStart, weekEnd: period.weekEnd },
        supabaseClient,
      );
      return json({ state: "existing", review: withProgress(review, sourceSnapshot, now()) });
    } catch {
      return json({ error: "weekly_mission_unavailable" }, 503);
    }
  }

  async function POST(request: Request) {
    const ownerId = await authResolver();
    if (!ownerId) return json({ error: "auth_required" }, 401);

    let parsed: unknown = {};
    try {
      parsed = await request.json();
    } catch {
      return json({ error: "invalid_request" }, 400);
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "invalid_request" }, 400);
    }
    const body = parsed as Record<string, unknown>;
    const bodyKeys = Object.keys(body);
    if (bodyKeys.some((key) => key !== "timezone")) {
      return json({ error: "invalid_request" }, 400);
    }

    const supabaseClient = clientResolver();
    if (!supabaseClient) return json({ error: "weekly_mission_unavailable" }, 503);

    const requestNow = now();
    const period = getWeeklyMissionPeriod({
      now: requestNow,
      timezone: readTimezone(body.timezone),
    });

    const existing = await getCachedWeeklyMissionReview(ownerId, period.weekStart, period.weekEnd, supabaseClient);
    if (existing) {
      try {
        const sourceSnapshot = await getWeeklyMissionSourceSnapshot(
          { ownerId, weekStart: period.weekStart, weekEnd: period.weekEnd },
          supabaseClient,
        );
        return json({ state: "existing", review: withProgress(existing, sourceSnapshot, requestNow) });
      } catch {
        return json({ state: "existing", review: existing });
      }
    }

    let sourceSnapshot: Awaited<ReturnType<typeof getWeeklyMissionSourceSnapshot>>;
    try {
      sourceSnapshot = await getWeeklyMissionSourceSnapshot(
        { ownerId, weekStart: period.weekStart, weekEnd: period.weekEnd },
        supabaseClient,
      );
    } catch {
      return json({ error: "weekly_mission_unavailable" }, 503);
    }

    const enabledMetricTypes = selectEnabledMissionMetrics();
    const serverDataSufficiency = classifySnapshotDataSufficiency(sourceSnapshot);
    const aiInput = buildWeeklyMissionAiInput({
      weekStart: period.weekStart,
      weekEnd: period.weekEnd,
      enabledMetricTypes,
      dataSufficiency: serverDataSufficiency,
      sourceSnapshot,
    });

    let output = buildFallbackWeeklyMissionOutput({
      dataSufficiency: serverDataSufficiency,
      sourceSnapshot,
    });
    let provider: string | null = null;

    try {
      const analyticRaw = await withTimeout(
        providerCaller(
          "analytic",
          buildWeeklyMissionAnalyticSystemPrompt(),
          buildWeeklyMissionAnalyticUserPrompt(aiInput),
        ),
        providerTimeoutMs,
      );
      const analyticOutput = parseWeeklyMissionAnalyticOutput(analyticRaw);
      if (analyticOutput) {
        const planningRaw = await withTimeout(
          providerCaller(
            "planning",
            buildWeeklyMissionPlanningSystemPrompt(),
            buildWeeklyMissionPlanningUserPrompt({ aiInput, analyticOutput }),
          ),
          providerTimeoutMs,
        );
        const planningOutput = parseWeeklyMissionPlanningOutput(planningRaw, enabledMetricTypes);
        if (planningOutput) {
          output = buildWeeklyMissionOutputFromPlanning({
            analyticOutput,
            planningOutput,
            dataSufficiency: serverDataSufficiency,
          });
          provider = "deepseek";
        }
      }
    } catch {
      output = buildFallbackWeeklyMissionOutput({
        dataSufficiency: serverDataSufficiency,
        sourceSnapshot,
      });
    }

    const createdAt = requestNow.toISOString();
    const missions = calculateWeeklyMissionProgress({
      missions: finalizeWeeklyMissions({
        ownerId,
        weekStart: period.weekStart,
        weekEnd: period.weekEnd,
        createdAt,
        serverDataSufficiency,
        sourceSnapshot,
        enabledMetricTypes,
        proposedOutput: output,
        now: requestNow,
      }),
      sourceSnapshot,
      now: requestNow,
    });
    const status = deriveWeeklyMissionReviewStatus({
      missions,
      now: requestNow,
      weekEnd: period.weekEnd,
    });

    const saveResult = await saveWeeklyMissionReview(
      {
        ownerId,
        weekStart: period.weekStart,
        weekEnd: period.weekEnd,
        timezone: period.timezone,
        generatedAt: createdAt,
        diagnosisSummary: output.diagnosisSummary,
        dataSufficiency: serverDataSufficiency,
        missions,
        status,
        sourceSnapshot,
        nextReviewAvailableAt: period.nextReviewAvailableAt,
        provider,
      },
      supabaseClient,
    );

    if (!saveResult.ok) {
      return json({ error: "weekly_mission_save_failed" }, 502);
    }

    const finalReview = withProgress(saveResult.review, sourceSnapshot, requestNow);
    return json({ state: saveResult.existing ? "existing" : "created", review: finalReview });
  }

  return { GET, POST };
}
