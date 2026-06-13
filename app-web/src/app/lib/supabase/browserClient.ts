"use client";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "./config";
import type {
  CreateBrowserSupabaseClientOptions,
  FonetikSupabaseClient,
} from "./types";

const SUPABASE_CLERK_JWT_TEMPLATE = "supabase";

type ClerkTokenGetter = () => Promise<string | null>;
type ClerkTemplatedTokenGetter = (
  options?: { template?: string },
) => Promise<string | null>;

export async function getSupabaseAccessToken(
  getToken: ClerkTokenGetter,
): Promise<string | null> {
  const templatedGetToken = getToken as ClerkTemplatedTokenGetter;

  try {
    const token = await templatedGetToken({
      template: SUPABASE_CLERK_JWT_TEMPLATE,
    });
    if (token) return token;
  } catch {
    // Fall back for test harnesses or environments without a Supabase template.
  }

  try {
    return await getToken();
  } catch {
    return null;
  }
}

export function createSupabaseAccessTokenProvider(
  getToken: ClerkTokenGetter,
  fallbackToken?: string | null,
) {
  return async () => (await getSupabaseAccessToken(getToken)) ?? fallbackToken ?? null;
}

export function createBrowserSupabaseClient(
  options: CreateBrowserSupabaseClientOptions = {},
): FonetikSupabaseClient | null {
  const config = getSupabaseBrowserConfig();
  if (!config.enabled) return null;

  return createClient(config.url, config.publishableKey, {
    accessToken: options.accessToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
