"use client";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseBrowserConfig } from "./config";
import type {
  CreateBrowserSupabaseClientOptions,
  FonetikSupabaseClient,
} from "./types";

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
