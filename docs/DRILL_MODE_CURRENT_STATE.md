# Drill Mode Current State

Last updated: 2026-06-19

This document is a handoff note for future agents working on Drill Mode.

## Implemented Milestones

Big-1 - Drill Session Foundation
- Added `spokenModelFragment`.
- Added `DrillSessionState`.
- Added `/api/drill-session/start`, `/api/drill-session/turn`, and
  `/api/drill-session/complete`.
- Preserved legacy Pattern Drill route compatibility.

Big-2 - Single-Flow Spoken UI
- Added single-flow Drill Mode UI.
- Added Phase 0 Pattern Brief.
- Added internal Quick Check.
- Routed Phase 1, Phase 2, and Phase 3 through the Drill Session API.
- Removed Phase 0 from the DOM after Start Drill.
- Avoided raw transcript display during Phase 1-3.
- Added in-place summary.
- Added New Session reset.

Big-3 - Audio Feedback + Persistence Memory
- Added audio-first Drill feedback through existing `/api/podchat/tts`.
- Added Repeat Feedback.
- Added best-effort `startLatencyMs`.
- Added `pressurePassed` separate from pattern credit.
- Added generic TTS unavailable copy.
- Kept persistence completion-only.
- Did not mutate `learner_error_patterns`.

## Current Known Limitations

- `startLatencyMs` is best-effort client timing from round start to recording
  start. It is not precise speech-onset detection.
- Canonical weakness memory update is deferred because the current schema and
  active flow do not provide a safe owner-scoped weakness row update path.
- Drill Mode has no history page.
- Drill Mode has no adaptive difficulty.
- Latest Weakness selection still uses existing Podchat-derived weakness rows.
- Production deployment/release decision is still separate from local QA.

## Deferred Features

- History page.
- Adaptive difficulty.
- New weakness sources.
- Canonical `learner_error_patterns` update after Drill completion.
- More precise voice activity detection.
- Production release deployment decision.

## Guardrails For Future Agents

- Do not reveal transcript, `spokenModelFragment`, response steps, mini example,
  common mistakes, or corrective model text during Phase 1-3.
- Do not store raw audio, raw STT transcript, raw TTS payload, raw provider
  output, or prompts.
- Do not persist mid-session.
- Do not make Repeat Feedback count as a turn.
- Do not mutate `learner_error_patterns` without an explicit safe helper,
  trusted owner-scoped row identity, and approved product scope.
- Do not create `weakness_history`.
- Do not add Convex.
- Do not create migrations or change Supabase schema for Drill Mode unless a
  later milestone explicitly approves it.
- Do not change Podchat, Weekly Review, or Context Bridge AUR behavior while
  stabilizing Drill Mode.
- Do not delete legacy Pattern Drill routes.

## Release Review Notes

Big-4 should leave the feature ready for local commit review if all targeted
checks pass and any full E2E failures are classified as unrelated legacy
harness/auth/navigation issues.

Do not claim production readiness unless manual audio QA has been completed or
the release owner explicitly accepts automated-only audio validation.
