export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  callClaude: null as ((apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>) | null,
};
