"use client";

import {
  createBrowserSupabaseClient,
  isSupabaseConfigured,
  getSupabaseAccessToken,
  createSupabaseAccessTokenProvider,
  type CreateBrowserSupabaseClientOptions,
  type FonetikSupabaseClient,
} from "../supabase";
import {
  upsertVocabItemRow,
  upsertSentenceRows,
  upsertCorrectionRow,
  deleteVocabItemRow,
  loadSupabaseVocabulary,
} from "./supabase-vocab-adapter";
import type { VocabItem, VocabUserSentence, VocabSentenceCorrection } from "../vocabulary";
import type { SessionCloudAuthState } from "./session-cloud-runtime";

export type VocabCloudWriteResult =
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

export type WriteVocabularyChangesToCloudOptions = {
  auth: SessionCloudAuthState;
  previous: ReadonlyArray<VocabItem>;
  next: ReadonlyArray<VocabItem>;
  isConfigured?: () => boolean;
  createClient?: (
    options: CreateBrowserSupabaseClientOptions,
  ) => FonetikSupabaseClient | null;
  upsertItem?: (
    ownerId: string,
    item: VocabItem,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<string>;
  upsertSentences?: (
    ownerId: string,
    vocabItemId: string,
    sentences: VocabUserSentence[],
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<Record<string, string>>;
  upsertCorrection?: (
    ownerId: string,
    sentenceId: string,
    correction: VocabSentenceCorrection,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<void>;
  deleteItem?: (
    ownerId: string,
    clientId: string,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<void>;
};

export async function writeVocabularyChangesToCloud({
  auth,
  previous,
  next,
  isConfigured = isSupabaseConfigured,
  createClient = createBrowserSupabaseClient,
  upsertItem = upsertVocabItemRow,
  upsertSentences = upsertSentenceRows,
  upsertCorrection = upsertCorrectionRow,
  deleteItem = deleteVocabItemRow,
}: WriteVocabularyChangesToCloudOptions): Promise<VocabCloudWriteResult> {
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
    firstToken = await getSupabaseAccessToken(auth.getToken);
  } catch {
    return { status: "skipped", reason: "missing-token" };
  }

  if (!firstToken) {
    return { status: "skipped", reason: "missing-token" };
  }

  let supabaseClient: FonetikSupabaseClient | null = null;
  try {
    supabaseClient = createClient({
      accessToken: createSupabaseAccessTokenProvider(auth.getToken, firstToken),
    });
  } catch {
    return { status: "skipped", reason: "missing-client" };
  }

  if (!supabaseClient) {
    return { status: "skipped", reason: "missing-client" };
  }

  // Calculate deletions and updates/additions
  const previousMap = new Map<string, VocabItem>(previous.map((item) => [item.id, item]));
  const nextMap = new Map<string, VocabItem>(next.map((item) => [item.id, item]));

  const deletions: string[] = [];
  const upserts: VocabItem[] = [];

  for (const id of previousMap.keys()) {
    if (!nextMap.has(id)) {
      deletions.push(id);
    }
  }

  for (const [id, nextItem] of nextMap) {
    const prevItem = previousMap.get(id);
    if (!prevItem || JSON.stringify(nextItem) !== JSON.stringify(prevItem)) {
      upserts.push(nextItem);
    }
  }

  // If no changes exist, return saved immediately
  if (deletions.length === 0 && upserts.length === 0) {
    return { status: "saved" };
  }

  try {
    // Process deletions
    for (const clientId of deletions) {
      await deleteItem(auth.userId, clientId, supabaseClient);
    }

    // Process upserts
    for (const item of upserts) {
      const dbVocabId = await upsertItem(auth.userId, item, supabaseClient);

      if (item.userSentences && item.userSentences.length > 0) {
        const sentenceMapping = await upsertSentences(
          auth.userId,
          dbVocabId,
          item.userSentences,
          supabaseClient,
        );

        for (const sentence of item.userSentences) {
          if (sentence.correction) {
            const dbSentenceId = sentenceMapping[sentence.id];
            if (dbSentenceId) {
              await upsertCorrection(
                auth.userId,
                dbSentenceId,
                sentence.correction,
                supabaseClient,
              );
            }
          }
        }
      }
    }

    return { status: "saved" };
  } catch {
    return { status: "failed", reason: "write-failed" };
  }
}

export type VocabCloudReadResult =
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
  | { status: "loaded"; vocabulary: VocabItem[] }
  | { status: "failed"; reason: "read-failed" };

export type LoadVocabularyFromCloudOptions = {
  auth: SessionCloudAuthState;
  isConfigured?: () => boolean;
  createClient?: (
    options: CreateBrowserSupabaseClientOptions,
  ) => FonetikSupabaseClient | null;
  loadVocabulary?: (
    ownerId: string,
    supabaseClient: FonetikSupabaseClient,
  ) => Promise<VocabItem[]>;
};

export async function loadVocabularyFromCloud({
  auth,
  isConfigured = isSupabaseConfigured,
  createClient = createBrowserSupabaseClient,
  loadVocabulary = loadSupabaseVocabulary,
}: LoadVocabularyFromCloudOptions): Promise<VocabCloudReadResult> {
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
    firstToken = await getSupabaseAccessToken(auth.getToken);
  } catch {
    return { status: "skipped", reason: "missing-token" };
  }

  if (!firstToken) {
    return { status: "skipped", reason: "missing-token" };
  }

  let supabaseClient: FonetikSupabaseClient | null = null;
  try {
    supabaseClient = createClient({
      accessToken: createSupabaseAccessTokenProvider(auth.getToken, firstToken),
    });
  } catch {
    return { status: "skipped", reason: "missing-client" };
  }

  if (!supabaseClient) {
    return { status: "skipped", reason: "missing-client" };
  }

  try {
    const vocabulary = await loadVocabulary(auth.userId, supabaseClient);
    return { status: "loaded", vocabulary };
  } catch {
    return { status: "failed", reason: "read-failed" };
  }
}
