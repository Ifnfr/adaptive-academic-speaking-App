export const testHooks: {
  resolveCurrentUserId: (() => Promise<string | null>) | null;
  getSupabaseClient: (() => unknown) | null;
  callClaude: ((apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>) | null;
} = {
  resolveCurrentUserId: null,
  getSupabaseClient: null,
  callClaude: null,
};
