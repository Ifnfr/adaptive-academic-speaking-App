export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  getSupabaseClient: null as (() => unknown) | null,
  callClaude: null as
    | ((
        apiKey: string,
        systemPrompt: string,
        userPrompt: string,
      ) => Promise<string>)
    | null,
};
