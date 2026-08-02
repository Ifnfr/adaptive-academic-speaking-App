-- Migration: 20260802_001_add_pre_listening_prompt.sql
-- Adds pre_listening_prompt column to listening_exercise_sections table

ALTER TABLE listening_exercise_sections
  ADD COLUMN pre_listening_prompt text;
