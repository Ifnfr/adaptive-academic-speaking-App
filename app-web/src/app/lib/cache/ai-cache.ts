import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const PROMPT_VERSIONS = {
  articlePractice: "v1.1",
};

/**
 * Normalizes a URL for caching purposes.
 * Trims whitespace, lowercases protocol and hostname, strips query parameters, and normalizes trailing slashes.
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    
    // Remove common tracking parameters
    const paramsToRemove = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "fbclid",
      "gclid",
    ];
    paramsToRemove.forEach((param) => url.searchParams.delete(param));
    
    // Sort query parameters to ensure deterministic order
    const sortedParams = Array.from(url.searchParams.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    url.search = "";
    sortedParams.forEach(([k, v]) => url.searchParams.set(k, v));
    
    let normalized = url.toString();
    // Standardise trailing slash for URLs without paths/queries
    if (
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    ) {
      if (normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
      }
    }
    return normalized;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Computes a SHA-256 hash of the input string.
 */
export function computeHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Generates the cache key for Article Practice requests.
 */
export function getArticlePracticeCacheKey(
  url: string,
  level: string,
  provider: string,
  mode: string,
  focus: string,
  feedbackLanguage: string,
  targetLanguage: string,
  promptVersion: string = PROMPT_VERSIONS.articlePractice
): string {
  const normalized = normalizeUrl(url);
  const inputs = {
    url: normalized,
    level,
    provider,
    mode: mode || "",
    focus: focus || "",
    feedbackLanguage,
    targetLanguage,
  };
  const inputsString = JSON.stringify(inputs);
  const hash = computeHash(inputsString);
  return `global:article-practice:${hash}:${promptVersion}`;
}

/**
 * Instantiates the Supabase client using public browser configuration.
 * Safe to call on the server side in API routes.
 */
function getCacheSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
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

/**
 * Instantiates the Supabase client using the server-only service role key.
 * This is safe to call only server-side.
 */
function getCacheServiceRoleSupabaseClient() {
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

export async function getGlobalCachedResponse(cacheKey: string, supabaseClient?: unknown): Promise<unknown | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (supabaseClient as any) || getCacheSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("global_ai_response_cache")
      .select("response_json")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error || !data) return null;
    return data.response_json;
  } catch {
    return null;
  }
}

/**
 * Saves a response to the global cache using the administrative client.
 * Failures are caught cleanly and are non-blocking.
 */
export async function saveGlobalCachedResponse(
  cacheKey: string,
  feature: string,
  response: unknown,
  supabaseClient?: unknown
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (supabaseClient as any) || getCacheServiceRoleSupabaseClient();
  if (!client) return;

  try {
    await client.from("global_ai_response_cache").upsert(
      {
        cache_key: cacheKey,
        feature,
        response_json: response,
      },
      { onConflict: "cache_key" }
    );
  } catch {
    // Caching failures must be non-blocking
  }
}
