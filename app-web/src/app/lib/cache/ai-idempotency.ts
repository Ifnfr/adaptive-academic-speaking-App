import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeUrl } from "./ai-cache";

/**
 * Validates the raw idempotency key.
 * Must be 8 to 128 characters long.
 */
export function isValidIdempotencyKey(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return trimmed.length >= 8 && trimmed.length <= 128;
}

/**
 * Computes a SHA-256 hash of the input string.
 */
export function computeHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Derives a deterministic request hash from Article Practice inputs.
 */
export function getArticlePracticeRequestHash(inputs: {
  url: string;
  level: string;
  provider: string;
  model: string;
  mode?: string;
  focus?: string;
  promptVersion: string;
  feedbackLanguage: string;
  targetLanguage: string;
}): string {
  const normalized = normalizeUrl(inputs.url);
  const dataToHash = {
    url: normalized,
    level: inputs.level,
    provider: inputs.provider,
    model: inputs.model,
    mode: inputs.mode || "",
    focus: inputs.focus || "",
    promptVersion: inputs.promptVersion,
    feedbackLanguage: inputs.feedbackLanguage,
    targetLanguage: inputs.targetLanguage,
  };
  return computeHash(JSON.stringify(dataToHash));
}

/**
 * Instantiates the Supabase client using the server-only service role key.
 * This is safe to call only server-side.
 */
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

export interface IdempotencyRecord {
  id: string;
  owner_id: string | null;
  scope_key: string;
  feature: string;
  idempotency_key_hash: string;
  request_hash: string;
  request_status: "in_progress" | "succeeded" | "failed";
  response_json: unknown | null;
  error_code: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Attempts to retrieve an existing idempotency record by scope_key and idempotency_key_hash.
 * Also checks if the record has expired. Returns null if expired or missing.
 */
export async function getExistingIdempotencyRecord(
  scopeKey: string,
  idempotencyKeyHash: string,
  supabaseClient?: unknown
): Promise<IdempotencyRecord | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (supabaseClient as any) || getServiceRoleSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("ai_request_idempotency")
      .select("*")
      .eq("scope_key", scopeKey)
      .eq("idempotency_key_hash", idempotencyKeyHash)
      .maybeSingle();

    if (error || !data) return null;

    // Check expiry
    const expiresAt = new Date(data.expires_at).getTime();
    if (expiresAt < Date.now()) {
      return null;
    }

    return data as IdempotencyRecord;
  } catch {
    return null;
  }
}

/**
 * Saves or updates an idempotency record in the database using the admin client.
 * Uses upsert to handle inserts/updates.
 */
export async function saveIdempotencyRecord(
  params: {
    ownerId?: string | null;
    scopeKey: string;
    feature: string;
    idempotencyKeyHash: string;
    requestHash: string;
    requestStatus: "in_progress" | "succeeded" | "failed";
    responseJson?: unknown | null;
    errorCode?: string | null;
    ttlMinutes?: number;
  },
  supabaseClient?: unknown
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (supabaseClient as any) || getServiceRoleSupabaseClient();
  if (!client) return;

  const ttl = params.ttlMinutes || 20;
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000).toISOString();

  try {
    await client.from("ai_request_idempotency").upsert(
      {
        owner_id: params.ownerId ?? null,
        scope_key: params.scopeKey,
        feature: params.feature,
        idempotency_key_hash: params.idempotencyKeyHash,
        request_hash: params.requestHash,
        request_status: params.requestStatus,
        response_json: params.responseJson ?? null,
        error_code: params.errorCode ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope_key,idempotency_key_hash" }
    );
  } catch {
    // Fail open safely: idempotency failure is non-blocking
  }
}
