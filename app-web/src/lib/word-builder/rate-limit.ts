// =============================================================================
// app-web/src/lib/word-builder/rate-limit.ts
// Supabase-backed rate limiter with in-memory fallback.
// Survives server restarts and works across multiple instances.
// =============================================================================

const WINDOW_MINUTES = 60;
const MAX_REQUESTS = 50;

// In-memory fallback when Supabase is unavailable
const memoryFallback = new Map<string, { count: number; windowStart: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(
  supabase: any,
  userId: string,
  maxRequests = MAX_REQUESTS,
  windowMinutes = WINDOW_MINUTES
): Promise<RateLimitResult> {
  const now = new Date();
  const windowMs = windowMinutes * 60 * 1000;

  if (!supabase) {
    return checkMemoryFallback(userId, maxRequests, windowMs);
  }

  try {
    // Try UPSERT: if window expired, reset; otherwise increment
    const { data, error } = await supabase.rpc("check_word_builder_rate_limit", {
      p_user_id: userId,
      p_max_requests: maxRequests,
      p_window_minutes: windowMinutes,
    });

    if (error) {
      // RPC not available — try direct table operations
      return await checkRateLimitDirect(supabase, userId, maxRequests, windowMs);
    }

    return {
      allowed: data?.allowed ?? false,
      remaining: data?.remaining ?? 0,
    };
  } catch {
    return checkMemoryFallback(userId, maxRequests, windowMs);
  }
}

async function checkRateLimitDirect(
  supabase: any,
  userId: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    // Get current state
    const { data: existing } = await supabase
      .from("word_builder_rate_limits")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!existing || new Date(existing.window_start) < windowStart) {
      // Window expired or no record — reset
      await supabase
        .from("word_builder_rate_limits")
        .upsert({ user_id: userId, request_count: 1, window_start: now.toISOString() });

      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (existing.request_count >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    // Increment
    await supabase
      .from("word_builder_rate_limits")
      .update({ request_count: existing.request_count + 1 })
      .eq("user_id", userId);

    return { allowed: true, remaining: maxRequests - existing.request_count - 1 };
  } catch {
    return checkMemoryFallback(userId, maxRequests, windowMs);
  }
}

function checkMemoryFallback(
  userId: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = memoryFallback.get(userId);

  if (!entry || now - entry.windowStart > windowMs) {
    memoryFallback.set(userId, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}
