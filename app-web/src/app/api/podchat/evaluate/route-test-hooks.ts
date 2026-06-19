export const testHooks = {
  resolveCurrentUserId: null as (() => Promise<string | null>) | null,
  getDbClient: null as (() => unknown) | null,
};
