import { expect, test } from "@playwright/test";
import { GET } from "../../src/app/api/pattern-drill/latest-weakness/route";
import { testHooks } from "../../src/app/api/pattern-drill/latest-weakness/route-test-hooks";

const baseRow = {
  id: "err-123",
  owner_id: "user-123",
  source_kind: "podchat",
  source_id: "session-123",
  category: "Coherence",
  label: "sentence endings",
  evidence: "Did not finish sentence.",
  practice_focus: "Add clear sentence endings to ensure clarity.",
  created_at: "2026-06-10T12:00:00Z",
};

interface MockOptions {
  data?: Record<string, unknown>[] | null;
  error?: Record<string, unknown> | null;
  onCall?: (call: string) => void;
}

function createMockSupabaseClient(options: MockOptions = {}) {
  const calls: string[] = [];

  function buildQuery(table: string) {
    const query = {
      select(columns: string) {
        const callStr = `select:${table}:${columns}`;
        calls.push(callStr);
        if (options.onCall) options.onCall(callStr);
        return query;
      },
      eq(column: string, value: string) {
        const callStr = `eq:${table}:${column}:${value}`;
        calls.push(callStr);
        if (options.onCall) options.onCall(callStr);
        return query;
      },
      order(column: string, orderOpts: Record<string, unknown>) {
        const callStr = `order:${table}:${column}:${JSON.stringify(orderOpts)}`;
        calls.push(callStr);
        if (options.onCall) options.onCall(callStr);
        return query;
      },
      limit(n: number) {
        const callStr = `limit:${table}:${n}`;
        calls.push(callStr);
        if (options.onCall) options.onCall(callStr);
        return {
          then(resolve: (value: { data: Record<string, unknown>[] | null; error: Record<string, unknown> | null }) => void) {
            resolve({
              data: options.data !== undefined ? options.data : [baseRow],
              error: options.error ?? null,
            });
          }
        };
      }
    };
    return query;
  }

  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      if (options.onCall) options.onCall(`from:${table}`);
      return buildQuery(table);
    },
  };

  return { client, calls };
}

test.describe("Latest Weakness API Route", () => {
  test.afterEach(() => {
    testHooks.resolveCurrentUserId = null;
    testHooks.getSupabaseClient = null;
  });

  test("unauthenticated requests return 401 and do not create client", async () => {
    testHooks.resolveCurrentUserId = async () => null;
    let clientCreated = false;
    testHooks.getSupabaseClient = () => {
      clientCreated = true;
      return null;
    };

    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "auth_required" });
    expect(clientCreated).toBe(false);
  });

  test("missing Supabase client returns 503", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    testHooks.getSupabaseClient = () => null;

    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "latest_weakness_unavailable" });
  });

  test("Supabase read error returns sanitized 502", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const { client } = createMockSupabaseClient({
      error: { message: "Internal DB Error - Permission Denied on tables" },
    });
    testHooks.getSupabaseClient = () => client;

    const response = await GET();
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const json = await response.json();
    expect(json.error).toBe("latest_weakness_fetch_failed");
    expect(json.message).toBeUndefined(); // Ensure no raw database message leak
  });

  test("empty Supabase result returns safe empty status", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const { client } = createMockSupabaseClient({ data: [] });
    testHooks.getSupabaseClient = () => client;

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const json = await response.json();
    expect(json.status).toBe("empty");
    expect(json.reason).toContain("No speaking weakness data yet");
    expect(json.error).toBeUndefined();
  });

  test("generic rows return safe insufficient status without leaking internals", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const { client } = createMockSupabaseClient({
      data: [
        {
          ...baseRow,
          category: "General",
          label: "Needs improvement",
          evidence: "Internal DB Error - private detail should not matter.",
          practice_focus: "Practice more.",
        },
      ],
    });
    testHooks.getSupabaseClient = () => client;

    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe("insufficient");
    expect(json.reason).toContain("not specific enough");
    expect(JSON.stringify(json)).not.toContain("Internal DB Error");
  });

  test("successful rows retrieve calls learner_error_patterns and runs selector", async () => {
    testHooks.resolveCurrentUserId = async () => "user-123";
    const { client, calls } = createMockSupabaseClient({
      data: [
        { ...baseRow, id: "err-1", created_at: "2026-06-10T12:00:00Z" },
        { ...baseRow, id: "err-2", created_at: "2026-06-11T12:00:00Z" },
      ],
    });
    testHooks.getSupabaseClient = () => client;

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const json = await response.json();
    expect(json.status).toBe("found");
    expect(json.weakness).toBeDefined();
    expect(json.weakness.label).toBe("sentence endings");
    expect(json.weakness.failureCount).toBe(2);
    expect((json.weakness as Record<string, unknown>).owner_id).toBeUndefined(); // Ensure owner_id is stripped

    // Assert correct query parameters, ordering, and limit
    expect(calls).toContain("from:learner_error_patterns");
    expect(calls).toContain("eq:learner_error_patterns:owner_id:user-123");
    expect(calls).toContain("eq:learner_error_patterns:source_kind:podchat");
    expect(calls).toContain('order:learner_error_patterns:created_at:{"ascending":false}');
    expect(calls).toContain("limit:learner_error_patterns:50");

    // Ensure no podchat_turns table or other write actions were queried
    const podchatTurnsAccess = calls.some((c) => c.includes("podchat_turns"));
    expect(podchatTurnsAccess).toBe(false);
  });
});
