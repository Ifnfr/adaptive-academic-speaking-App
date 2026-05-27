-- =============================================================================
-- fonetik - Profile Foundation Fields
-- Migration: 20260527_005_add_profile_foundation_fields
--
-- Adds privacy-first user profile and preference fields.
-- Existing owner-scoped RLS policies remain unchanged.
-- No public profile or leaderboard read access is added here.
-- =============================================================================

alter table profiles
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists public_profile_enabled boolean not null default false,
  add column if not exists leaderboard_opt_in boolean not null default false,
  add column if not exists preferred_app_language text,
  add column if not exists feedback_language text,
  add column if not exists target_language text;

-- Keep private account data private. Future public profile / leaderboard
-- surfaces should use a dedicated safe view or aggregate table, not broad
-- public SELECT on profiles.
