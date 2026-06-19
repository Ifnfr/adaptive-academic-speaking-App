export const testHooks: {
  resolveCurrentUserId: (() => Promise<string | null>) | null;
  callClaude: ((apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>) | null;
  callDeepSeek: ((apiKey: string, systemPrompt: string, userPrompt: string) => Promise<string>) | null;
} = {
  resolveCurrentUserId: null,
  callClaude: null,
  callDeepSeek: null,
};
