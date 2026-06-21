export const testHooks: {
  resolveCurrentUserId: (() => Promise<string | null>) | null;
} = {
  resolveCurrentUserId: null,
};
