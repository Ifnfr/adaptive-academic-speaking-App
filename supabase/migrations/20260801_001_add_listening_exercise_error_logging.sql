-- Migration: 20260801_001_add_listening_exercise_error_logging.sql
-- Adds error logging columns to listening_exercise_sections table

ALTER TABLE listening_exercise_sections
  ADD COLUMN generation_error text,
  ADD COLUMN generation_error_raw_response text;
