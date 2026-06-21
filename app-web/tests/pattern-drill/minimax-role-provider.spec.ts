import { test, expect } from "@playwright/test";
import { resolveProvider, callRoleProvider, roleTestHooks, ProviderConfigError, ProviderUnavailableError } from "../../src/app/api/pattern-drill/_lib/roleProviders";

test.describe("MiniMax M3 Provider Role Abstraction", () => {
  const originalEnv = { ...process.env };

  test.afterEach(() => {
    // Restore original process.env
    process.env = { ...originalEnv };
    roleTestHooks.callMiniMaxM3 = null;
  });

  test("resolves minimax_m3 for planning role when configured", async () => {
    process.env.AI_PLANNING_PROVIDER = "minimax_m3";
    process.env.MINIMAX_API_KEY = "mock-key";
    process.env.MINIMAX_MODEL = "custom-minimax-model";

    const config = await resolveProvider("planning");
    expect(config.providerId).toBe("minimax_m3");
    expect(config.apiKey).toBe("mock-key");
    expect(config.modelName).toBe("custom-minimax-model");
  });

  test("resolves minimax_m3 for execution role when configured", async () => {
    process.env.AI_EXECUTION_PROVIDER = "minimax_m3";
    process.env.MINIMAX_API_KEY = "mock-key-exec";
    delete process.env.MINIMAX_MODEL; // test default

    const config = await resolveProvider("execution");
    expect(config.providerId).toBe("minimax_m3");
    expect(config.apiKey).toBe("mock-key-exec");
    expect(config.modelName).toBe("MiniMax-M3"); // default
  });

  test("throws ProviderConfigError if minimax_m3 is active but API key is missing", async () => {
    process.env.AI_PLANNING_PROVIDER = "minimax_m3";
    delete process.env.MINIMAX_API_KEY;

    await expect(
      callRoleProvider("planning", "System prompt", "User prompt")
    ).rejects.toThrow(ProviderConfigError);
  });

  test("successfully routes request to MiniMax M3 via mock hook", async () => {
    process.env.AI_PLANNING_PROVIDER = "minimax_m3";
    process.env.MINIMAX_API_KEY = "some-key";

    let calledWith = { system: "", user: "" };
    roleTestHooks.callMiniMaxM3 = async (apiKey, system, user) => {
      expect(apiKey).toBe("some-key");
      calledWith = { system, user };
      return "{\"result\": \"success\"}";
    };

    const res = await callRoleProvider("planning", "sys-val", "user-val");
    expect(res).toBe("{\"result\": \"success\"}");
    expect(calledWith.system).toBe("sys-val");
    expect(calledWith.user).toBe("user-val");
  });

  test("fails with ProviderUnavailableError if real API fetch fails", async () => {
    process.env.AI_PLANNING_PROVIDER = "minimax_m3";
    process.env.MINIMAX_API_KEY = "some-key";
    process.env.MINIMAX_BASE_URL = "http://localhost:9999/invalid-base-url";

    await expect(
      callRoleProvider("planning", "sys-val", "user-val")
    ).rejects.toThrow(ProviderUnavailableError);
  });
});
