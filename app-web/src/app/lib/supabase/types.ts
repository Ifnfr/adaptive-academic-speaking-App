import type { SupabaseClient } from "@supabase/supabase-js";

export type SupabaseAccessTokenProvider = () => Promise<string | null>;

export type FonetikSupabaseClient = SupabaseClient;

export type CreateBrowserSupabaseClientOptions = {
  accessToken?: SupabaseAccessTokenProvider;
};
