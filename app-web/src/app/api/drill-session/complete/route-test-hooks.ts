export const testHooks: {
  resolveCurrentUserId: (() => Promise<string | null>) | null;
  getSupabaseClient: (() => unknown) | null;
} = {
  resolveCurrentUserId: null,
  getSupabaseClient: null,
};
