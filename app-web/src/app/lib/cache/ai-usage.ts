import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Provider / model resolution
// ---------------------------------------------------------------------------

type Provider = "Claude" | "DeepSeek" | "Gemini";

/**
 * Resolves the actual model identifier that the route would use for a given
 * provider.  Mirrors the model strings used in the article-practice route.
 */
export function resolveProviderModel(provider: Provider): string {
  switch (provider) {
    case "Claude":
      return "claude-3-5-sonnet-latest";
    case "DeepSeek":
      return "deepseek-chat";
    case "Gemini":
      return process.env.GEMINI_MODEL || "gemini-2.0-flash";
  }
}

// ---------------------------------------------------------------------------
// Token / cost estimation
// ---------------------------------------------------------------------------

/**
 * Deterministic token estimate: ceil(chars / 4).
 * This is a coarse approximation suitable for cost tracking, not billing.
 */
export function estimateTokensFromText(value: string): number {
  return Math.ceil(value.length / 4);
}

/**
 * Token estimate for an arbitrary JSON-serialisable value.
 */
export function estimateTokensFromJson(value: unknown): number {
  try {
    return estimateTokensFromText(JSON.stringify(value));
  } catch {
    return 0;
  }
}

/**
 * Static per-model pricing in USD per 1 000 tokens.
 * Values are approximate list prices as of mid-2025.
 * Returns null for unknown provider/model combinations so callers can
 * distinguish "unknown cost" from "zero cost".
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-3-5-sonnet-latest": { input: 0.003, output: 0.015 },
  "deepseek-chat": { input: 0.00014, output: 0.00028 },
  "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
  "gemini-2.5-flash": { input: 0.00015, output: 0.00035 },
};

export function estimateAiCost(params: {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): number | null {
  const pricing = MODEL_PRICING[params.model];
  if (!pricing) return null;
  return (
    (params.inputTokens / 1000) * pricing.input +
    (params.outputTokens / 1000) * pricing.output
  );
}

// ---------------------------------------------------------------------------
// Usage event types
// ---------------------------------------------------------------------------

export type AiRequestStatus =
  | "cache_hit"
  | "provider_success"
  | "provider_failed"
  | "provider_parse_failed"
  | "request_rejected"
  | "article_fetch_failed";

export interface AiUsageEvent {
  ownerId?: string | null;
  feature: string;
  provider: string;
  model: string;
  promptVersion: string;
  cached: boolean;
  requestStatus: AiRequestStatus;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  estimatedCostUsd?: number | null;
  errorCode?: string | null;
}

// ---------------------------------------------------------------------------
// Supabase service-role client (reuses existing pattern from ai-cache.ts)
// ---------------------------------------------------------------------------

function getServiceRoleSupabaseClient() {
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

// ---------------------------------------------------------------------------
// Record usage event — best-effort, non-blocking
// ---------------------------------------------------------------------------

/**
 * Inserts a single row into `ai_usage_events`.
 * All errors are caught and swallowed.
 * An optional supabaseClient parameter is accepted for testing.
 */
export async function recordAiUsageEvent(
  event: AiUsageEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseClient?: any,
): Promise<void> {
  const client = supabaseClient || getServiceRoleSupabaseClient();
  if (!client) return;

  try {
    await client.from("ai_usage_events").insert({
      owner_id: event.ownerId ?? null,
      feature: event.feature,
      provider: event.provider,
      model: event.model,
      prompt_version: event.promptVersion,
      cached: event.cached,
      request_status: event.requestStatus,
      estimated_input_tokens: event.estimatedInputTokens ?? null,
      estimated_output_tokens: event.estimatedOutputTokens ?? null,
      estimated_cost_usd: event.estimatedCostUsd ?? null,
      error_code: event.errorCode ?? null,
    });
  } catch {
    // Usage logging must be non-blocking
  }
}

// ---------------------------------------------------------------------------
// Convenience: compute hash (re-export for consistency)
// ---------------------------------------------------------------------------

export function computeHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
