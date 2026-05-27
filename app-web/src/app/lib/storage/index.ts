/**
 * Storage adapter boundary for fonetik.
 *
 * Re-exports the adapter interfaces and the active localStorage implementation.
 *
 * Current state:
 *   - Only `LocalStorageAdapter` is available.
 *   - The app is NOT connected to Supabase.
 *   - localStorage remains the sole source of truth.
 *
 * Future:
 *   - A `SupabaseAdapter` implementing `StorageAdapter` will be added here
 *     once the app-side Supabase integration is ready. It will use the RLS
 *     policies defined in `supabase/migrations/` and Clerk JWT auth.
 */

// Types
export type {
  StorageAdapter,
  SessionStore,
  VocabularyStore,
  GamificationStore,
  StoredSessionRecord,
} from "./types";

// Local adapter (active implementation)
export { createLocalStorageAdapter } from "./local-storage-adapter";

// ---------------------------------------------------------------------------
// Default adapter instance
// ---------------------------------------------------------------------------

import { createLocalStorageAdapter } from "./local-storage-adapter";

/**
 * The default storage adapter for the app.
 *
 * Currently returns a localStorage-backed adapter. When Supabase integration
 * is ready, this can be swapped based on auth state (signed-in users get the
 * cloud adapter, signed-out users keep localStorage).
 */
export const storage = createLocalStorageAdapter();
