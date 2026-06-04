import type { FonetikSupabaseClient } from "../../lib/supabase";
import {
  buildDeterministicWeeklyReview,
  getCachedWeeklyReview,
  getWeeklyReviewMemory,
  saveWeeklyReview,
  type WeeklyReviewResult,
} from "../../lib/storage/supabase-weekly-review-adapter";

export const runtime = "nodejs";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

type Period = {
  periodStart: string;
  periodEnd: string;
};

type WeeklyReviewRouteDeps = {
  resolveCurrentUserId?: () => Promise<string | null>;
  getSupabaseClient?: () => Promise<FonetikSupabaseClient | null>;
  getMemory?: typeof getWeeklyReviewMemory;
  buildReview?: typeof buildDeterministicWeeklyReview;
  getCachedReview?: typeof getCachedWeeklyReview;
  saveReview?: typeof saveWeeklyReview;
  now?: () => Date;
};

async function getSupabaseServiceClient(): Promise<FonetikSupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
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

async function resolveCurrentUserId(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    return session?.userId || null;
  } catch {
    return null;
  }
}

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && formatDateUtc(parsed) === value;
}

function getDefaultPeriod(now: Date): Period {
  const periodEnd = formatDateUtc(now);
  const periodStart = formatDateUtc(addUtcDays(new Date(`${periodEnd}T00:00:00.000Z`), -6));
  return { periodStart, periodEnd };
}

function parsePeriod(body: Record<string, unknown>, now: Date): Period | string {
  const hasStart = body.periodStart !== undefined;
  const hasEnd = body.periodEnd !== undefined;

  if (!hasStart && !hasEnd) {
    return getDefaultPeriod(now);
  }

  if (!isValidDateString(body.periodStart) || !isValidDateString(body.periodEnd)) {
    return "periodStart and periodEnd must be valid YYYY-MM-DD dates.";
  }

  if (body.periodEnd < body.periodStart) {
    return "periodEnd must be greater than or equal to periodStart.";
  }

  return {
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
  };
}

function isWeeklyReviewResult(value: unknown): value is WeeklyReviewResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.summary === "string" &&
    typeof source.recurringWeakness === "string" &&
    typeof source.bestImprovement === "string" &&
    typeof source.scoreTrend === "string" &&
    typeof source.nextWeekFocus === "string" &&
    Array.isArray(source.recommendedPlan) &&
    source.recommendedPlan.length === 7 &&
    source.recommendedPlan.every((item) => typeof item === "string" && item.trim()) &&
    Array.isArray(source.warnings) &&
    source.warnings.every((item) => typeof item === "string")
  );
}

function readCachedReview(cached: unknown): WeeklyReviewResult | null {
  if (!cached || typeof cached !== "object" || Array.isArray(cached)) {
    return null;
  }

  const summary = (cached as { summary?: unknown }).summary;
  return isWeeklyReviewResult(summary) ? summary : null;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export function createWeeklyReviewPostHandler(deps: WeeklyReviewRouteDeps = {}) {
  const authResolver = deps.resolveCurrentUserId ?? resolveCurrentUserId;
  const clientResolver = deps.getSupabaseClient ?? getSupabaseServiceClient;
  const memoryReader = deps.getMemory ?? getWeeklyReviewMemory;
  const reviewBuilder = deps.buildReview ?? buildDeterministicWeeklyReview;
  const cachedReviewReader = deps.getCachedReview ?? getCachedWeeklyReview;
  const reviewSaver = deps.saveReview ?? saveWeeklyReview;
  const now = deps.now ?? (() => new Date());

  return async function POST(request: Request) {
    let parsedBody: unknown = {};
    try {
      parsedBody = await request.json();
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }

    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return json({ error: "Invalid request body." }, 400);
    }

    const period = parsePeriod(parsedBody as Record<string, unknown>, now());
    if (typeof period === "string") {
      return json({ error: period }, 400);
    }

    const ownerId = await authResolver();
    if (!ownerId) {
      return json({ error: "Sign in to generate a weekly review." }, 401);
    }

    const supabaseClient = await clientResolver();
    if (!supabaseClient) {
      return json({ error: "Weekly Review is temporarily unavailable." }, 503);
    }

    const cached = await cachedReviewReader(
      ownerId,
      period.periodStart,
      period.periodEnd,
      supabaseClient,
    );
    const cachedReview = readCachedReview(cached);
    if (cachedReview) {
      return json(cachedReview);
    }

    const memory = await memoryReader(
      {
        ownerId,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      },
      supabaseClient,
    );

    if (!memory.ok) {
      return json({ error: "Weekly Review memory could not be loaded." }, 502);
    }

    const review = reviewBuilder(memory.data);
    if (!isWeeklyReviewResult(review)) {
      return json({ error: "Weekly Review could not be generated." }, 502);
    }

    try {
      await reviewSaver(
        ownerId,
        period.periodStart,
        period.periodEnd,
        review,
        memory.data.sourceSessionIds,
        supabaseClient,
      );
    } catch {
      // Caching is best-effort. The deterministic review remains usable.
    }

    return json(review);
  };
}

export const POST = createWeeklyReviewPostHandler();
