-- =============================================================================
-- fonetik — Supabase Profile Schema Expansion
-- Migration: 20260804_001_add_preferred_tts_voice_profile
--
-- Adds preferred_tts_voice_profile column to profiles table for persisting
-- user-selected TTS voice profiles (e.g. british_female, american_male_generative).
-- =============================================================================

alter table profiles
  add column if not exists preferred_tts_voice_profile text;
