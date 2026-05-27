"use client";

import {
  createBrowserSupabaseClient,
  isSupabaseConfigured,
  type CreateBrowserSupabaseClientOptions,
  type FonetikSupabaseClient,
} from "../supabase";
import { addSupabaseSession } from "./supabase-session-adapter";
import type { StoredSessionRecord } from "./types";

export type SessionCloudAuthState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  getToken: (() => Promise<string | null>) | null;
};

export type SessionCloudWriteResult =
  | {
      status: "skipped";
      reason:
        | "auth-loading"
        | "signed-out"
        | "missing-user"
        | "supabase-not-configured"
        | "missing-token"
        | "missing-client";
    }
  | { status: "saved" }
  | { status: "failed"; reason: "write-failed" };

export type WriteCompletedSessionToCloudOptions = {
  auth: SessionCloudAuthState;
  session: StoredSessionRecord;
  isConfigured?: () => boolean;
  createClient?: (
    options: CreateBrowserSupabaseClientOptions,
  ) => FonetikSupabaseClient | null;
  addSession?: (
    ownerId: string,
    session: StoredSessionRecord,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<void>;
};

export const DISABLED_SESSION_CLOUD_AUTH: SessionCloudAuthState = {
  isLoaded: false,
  isSignedIn: false,
  userId: null,
  getToken: null,
};

export async function writeCompletedSessionToCloud({
  auth,
  session,
  isConfigured = isSupabaseConfigured,
  createClient = createBrowserSupabaseClient,
  addSession = addSupabaseSession,
}: WriteCompletedSessionToCloudOptions): Promise<SessionCloudWriteResult> {
  if (!auth.isLoaded) {
    return { status: "skipped", reason: "auth-loading" };
  }

  if (!auth.isSignedIn) {
    return { status: "skipped", reason: "signed-out" };
  }

  if (!auth.userId) {
    return { status: "skipped", reason: "missing-user" };
  }

  if (!auth.getToken) {
    return { status: "skipped", reason: "missing-token" };
  }

  if (!isConfigured()) {
    return { status: "skipped", reason: "supabase-not-configured" };
  }

  let firstToken: string | null = null;
  try {
    firstToken = await auth.getToken();
  } catch {
    return { status: "skipped", reason: "missing-token" };
  }

  if (!firstToken) {
    return { status: "skipped", reason: "missing-token" };
  }

  let supabaseClient: FonetikSupabaseClient | null = null;
  try {
    supabaseClient = createClient({
      accessToken: async () => {
        try {
          return (await auth.getToken?.()) ?? firstToken;
        } catch {
          return firstToken;
        }
      },
    });
  } catch {
    return { status: "skipped", reason: "missing-client" };
  }

  if (!supabaseClient) {
    return { status: "skipped", reason: "missing-client" };
  }

  try {
    await addSession(auth.userId, session, supabaseClient);
    return { status: "saved" };
  } catch {
    return { status: "failed", reason: "write-failed" };
  }
}
