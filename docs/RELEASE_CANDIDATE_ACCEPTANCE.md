# Fonetik Release Candidate Acceptance

## 1. Release Status & Metadata
* **Production URL**: https://adaptive-academic-speaking-app.vercel.app/
* **Accepted Production Commit**: `36691a8` (latest local environment organization commit: `98f2d41`)
* **P0 Blockers**: None
* **P1 Issues**: None
* **Safe to Release**: Yes

## 2. Production Smoke Summary
* **Authentication**: Clerk authentication and post-login redirection loops successfully validated.
* **Layout & Responsiveness**: App shell layout and responsive views verified on desktop (1366x768) and mobile (390x844). Shell scroll reachability confirmed (no clipped content or footer overlaps).
* **Settings**: App appearance theme toggles (Light/Dark/System) and Commonplace palettes (Forest/Navy/Terracotta) verified as fully reactive and persistent.
* **Podchat**: Timed academic speaking practice, AI feedback evaluation, and CSV logs verified.
* **Commonplace**: Library Grid notes CRUD, Main Maps/Sub Mind Maps (React Flow) canvas, Inventory notes sidebar, card themes, and "Kembali ke Fonetik" sidebar handoff navigation fully operational.
* **Vocabulary**: Word addition, active recall practice, dictionary definitions, and daily quest status updates verified.
* **Article Practice**: Copyright-safe speaking task generation from URL source extraction and flow bridge to Active Session verified.
* **Weekly Review**: Summary of session statistics, vocabulary retention, and XP progress charts verified.
* **Progress & Quest**: Daily Quest module functioning (Sentence Practice quest verified, disabled Learning Path quest successfully replaced).
* **Profile & Leaderboard**: Global leaderboard opt-in, public card details, and privacy boundaries verified.
* **Mental Model**: Accepted-risk check verified (does not auto-trigger AI, no XP exploit pathways, no console leaks).
* **Privacy & Console Audit**: Confirmed zero API keys, Supabase role keys, or sensitive customer tokens leaked in console warnings or network logs.

## 3. Source-of-Truth Status
All core data is server-backed via Supabase RLS schemas:

### Supabase-Backed (Active Source of Truth)
* User Profile and App Settings (including server-persisted appearance mode)
* Commonplace Notes, Maps, Nodes, and Edges
* Commonplace Map visual colors and layout themes
* Commonplace Map -> Podchat session discussion handoff context
* Practice Session History (Podchat speaking logs)
* Vocabulary Notebook records and Daily Quest states
* Weekly Reviews
* Article Essay memory
* Podchat AI feedback/evaluation history
* XP profile balances, daily quest logs, and badges earned

### Local/Session Storage (Allowed fallback/UI state only)
* Temporary client UI states (e.g. current navigation tabs)
* Signed-out/offline fallback placeholders
* Compact node handoff reference pointers
* Local mock data (when local-only testing is selected)

### Deprecated (No longer active source of truth)
* LocalStorage-backed Session History (`adaptive-speaking-app:session-history`)
* LocalStorage-backed Vocabulary Notebook (`adaptive-speaking-app:vocabulary`)
* LocalStorage-backed XP events, badges, levels (`adaptive-speaking-app:xp-profile`, `adaptive-speaking-app:xp-events`, `adaptive-speaking-app:badges`)
* SessionStorage-backed full Commonplace note payload payloads

## 4. Gamification Summary
* **XP-1 Complete**: Supabase server-backed persistence is active for XP profiles, events, and badges.
* **XP-2 Complete**: Meaningful XP reward taxonomy applied to speech practices, vocab saves, and reviews.
* **XP-3 Complete**: Badges and Speaker Level thresholds aligned with reward progression.
  * **Level Thresholds**: `[0, 100, 250, 500, 900, 1500, 2500, 4000, 6500, 10000]`
  * **Daily XP Cap**: 220 XP.
* **XP-4 Complete**: Leaderboard, profiles, and daily quest modules audited and verified.
* **Daily Quests**: Replaced static/disabled "Learning Path" quest with active "Sentence Practice" quest.
* **Mental Model**: Excluded from gamification triggers (does not grant XP or progress badges).

## 5. Environment Variables Organization
* **Structure**: Restructured environment configurations into clear sections utilizing comment headers:
  * `APP / PUBLIC RUNTIME`
  * `AUTHENTICATION — CLERK`
  * `DATABASE — SUPABASE`
  * `AI PROVIDERS — GEMINI`
  * `AI PROVIDERS — CLAUDE / ANTHROPIC`
  * `AI PROVIDERS — DEEPSEEK`
  * `TTS — ELEVENLABS`
  * `TTS — AMAZON POLLY` (including placeholders `AWS_POLLY_VOICE_ID`, `AWS_POLLY_ENGINE`, `AWS_POLLY_OUTPUT_FORMAT`)
  * `STT / SPEECH-TO-TEXT`
  * `FEATURE FLAGS / CONFIGURATION TOGGLES`
  * `TEST / QA`
* **Secret Handling**: Strict exclusion of secure API keys from version control. `.env.local` remains ignored and stored locally on the machine.

## 6. Mental Model Release Decision
* **Decision**: Released as-is for the initial personal app deployment.
* **Reasoning**: Evaluated as an early teaching surface. A full redesign is scheduled for Fonetik 2.1 to prevent complex navigation overlaps.
* **Status**: Fully accessible but isolated from gamification loops, with zero immediate product code adjustments.

## 7. Known Non-Blocking Issues (P2/P3)
1. **React Flow Warnings**: Console outputs may emit warnings regarding `nodeTypes` or `edgeTypes` missing React memoization bounds. Has zero impact on canvas visual functionality or state persistence.
2. **Clerk Dev-Key Warning**: Prompts in local development regarding standard Clerk test environments are expected.
3. **Legacy Test Harness Assumptions**: Legacy configuration targets for full-suite CoverPage test suites may mismatch the restructured App Router auth redirection path.
4. **Mental Model Scope**: Early visual layout state represents a conceptual tool, not a fully integrated tutor module.

## 8. Recommended Next Roadmap (Fonetik 2.1+)
1. **Final Manual verification**: Optional quick verification run by the app owner.
2. **Launch**: Promote production build for personal learning.
3. **React Flow Memoization Polish**: Clean up console alerts regarding node/edge memoization.
4. **Mental Model Redesign**: Integrate the speaking mentor mental model directly into the Podchat workspace context.
5. **Real Clerk E2E Testing**: Update browser integration suites using Playwright `storageState` to bypass credentials on automated test loops.
6. **Telemetry & Log Monitoring**: Monitor server-side latency and audio transcription accuracy statistics.
