import { expect, test } from "@playwright/test";
import {
  writeCompletedSessionToCloud,
  type SessionCloudAuthState,
} from "../src/app/lib/storage/session-cloud-runtime";
import type {
  CreateBrowserSupabaseClientOptions,
  FonetikSupabaseClient,
} from "../src/app/lib/supabase";
import type { StoredSessionRecord } from "../src/app/lib/storage";

const csvWithEscaping = [
  "Date,Level,Mode,Main_Weakness,Evidence,Next_Target",
  '2026-05-27,Foundation,Fluency Sprint,"Comma, quote ""inside"", and newline',
  'kept","Evidence, with comma","Try again"',
].join("\n");

const completedSession: StoredSessionRecord = {
  id: "local-session-cloud-write",
  date: "2026-05-27",
  level: "Foundation",
  mode: "Fluency Sprint",
  feedbackType: "Quick",
  sessionType: "Standard",
  provider: "Claude",
  todayTarget: "Use one clear topic sentence.",
  durationSeconds: 90,
  transcript: "I want to explain one idea clearly because it matters.",
  mainWeakness: "Needs clearer sentence control.",
  evidence: "The response has one incomplete idea.",
  betterPhrase: "My main point is clear because I explain one idea.",
  retryTask: "Say one sentence with because.",
  retryTranscript: "My main point is clear because I explain one idea.",
  csv: csvWithEscaping,
};

const signedInAuth: SessionCloudAuthState = {
  isLoaded: true,
  isSignedIn: true,
  userId: "user_clerk_123",
  getToken: async () => "clerk-session-token",
};

function createClientMock() {
  let options: CreateBrowserSupabaseClientOptions | null = null;
  const client = { marker: "supabase-client" } as unknown as FonetikSupabaseClient;

  return {
    createClient(nextOptions: CreateBrowserSupabaseClientOptions) {
      options = nextOptions;
      return client;
    },
    getOptions: () => options,
    client,
  };
}

test.describe("best-effort session cloud runtime", () => {
  test("skips while auth is still loading", async () => {
    const clientMock = createClientMock();
    let addCalled = false;

    const result = await writeCompletedSessionToCloud({
      auth: {
        isLoaded: false,
        isSignedIn: false,
        userId: null,
        getToken: null,
      },
      session: completedSession,
      isConfigured: () => true,
      createClient: clientMock.createClient,
      addSession: async () => {
        addCalled = true;
      },
    });

    expect(result).toEqual({ status: "skipped", reason: "auth-loading" });
    expect(clientMock.getOptions()).toBeNull();
    expect(addCalled).toBe(false);
  });

  test("skips signed-out users without creating a Supabase client", async () => {
    const clientMock = createClientMock();
    let addCalled = false;

    const result = await writeCompletedSessionToCloud({
      auth: {
        isLoaded: true,
        isSignedIn: false,
        userId: null,
        getToken: null,
      },
      session: completedSession,
      isConfigured: () => true,
      createClient: clientMock.createClient,
      addSession: async () => {
        addCalled = true;
      },
    });

    expect(result).toEqual({ status: "skipped", reason: "signed-out" });
    expect(clientMock.getOptions()).toBeNull();
    expect(addCalled).toBe(false);
  });

  test("skips when Supabase browser env is not configured", async () => {
    const clientMock = createClientMock();
    let addCalled = false;

    const result = await writeCompletedSessionToCloud({
      auth: signedInAuth,
      session: completedSession,
      isConfigured: () => false,
      createClient: clientMock.createClient,
      addSession: async () => {
        addCalled = true;
      },
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "supabase-not-configured",
    });
    expect(clientMock.getOptions()).toBeNull();
    expect(addCalled).toBe(false);
  });

  test("skips when Clerk cannot provide an access token", async () => {
    const clientMock = createClientMock();
    let addCalled = false;

    const result = await writeCompletedSessionToCloud({
      auth: {
        ...signedInAuth,
        getToken: async () => null,
      },
      session: completedSession,
      isConfigured: () => true,
      createClient: clientMock.createClient,
      addSession: async () => {
        addCalled = true;
      },
    });

    expect(result).toEqual({ status: "skipped", reason: "missing-token" });
    expect(clientMock.getOptions()).toBeNull();
    expect(addCalled).toBe(false);
  });

  test("upserts the completed session with user id and exact CSV when available", async () => {
    const clientMock = createClientMock();
    const addCalls: Array<{
      ownerId: string;
      session: StoredSessionRecord;
      client: FonetikSupabaseClient;
    }> = [];

    const result = await writeCompletedSessionToCloud({
      auth: signedInAuth,
      session: completedSession,
      isConfigured: () => true,
      createClient: clientMock.createClient,
      addSession: async (ownerId, session, supabaseClient) => {
        addCalls.push({ ownerId, session, client: supabaseClient });
      },
    });

    const accessToken = clientMock.getOptions()?.accessToken;

    expect(result).toEqual({ status: "saved" });
    expect(addCalls).toHaveLength(1);
    expect(addCalls[0]).toEqual({
      ownerId: "user_clerk_123",
      session: completedSession,
      client: clientMock.client,
    });
    expect(addCalls[0].session.csv).toBe(csvWithEscaping);
    await expect(accessToken?.()).resolves.toBe("clerk-session-token");
  });

  test("returns failed without throwing when the Supabase write fails", async () => {
    const clientMock = createClientMock();

    const result = await writeCompletedSessionToCloud({
      auth: signedInAuth,
      session: completedSession,
      isConfigured: () => true,
      createClient: clientMock.createClient,
      addSession: async () => {
        throw new Error("cloud write failed");
      },
    });

    expect(result).toEqual({ status: "failed", reason: "write-failed" });
  });
});
