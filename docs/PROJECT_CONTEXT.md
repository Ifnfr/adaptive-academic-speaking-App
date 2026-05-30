# fonetik Project Context

## Product

**fonetik**  
**Speak Better**  
AI-Powered academic speaking practice.

fonetik is a local-first MVP for practicing academic speaking. It combines
local session setup, local prompt generation, browser speech-to-text, AI
feedback, retry practice, CSV summaries, local progress review, and several
small coaching features.

## Current Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Browser localStorage
- Web Speech API
- Server-side API routes for Claude, DeepSeek, and Gemini

## Current MVP Scope

- Light fonetik dashboard UI (sidebar navigation and topbar status)
- Active Session and Session Setup (mode cards, level selection, provider choice)
- Browser speech-to-text and manual transcript input
- Local Speaking Prompt generation (by level, mode, and session type)
- AI Feedback with level-specific scores (1-5 range)
- Retry Loop for targeted speaking improvement
- End Session CSV and Copy CSV
- Session Log and Copy Last CSV
- Progress view, Day Streak, and Local Level-Up Check
- Diagnostic Mode (recommended level, bottleneck, plan)
- Weekly Review Agent using recent session summaries
- Mental Model Session for response quality patterns
- Friendly provider errors (handling missing keys, rate limits, model availability)
- Foundation-level calibration for simple outputs
- Robust JSON parsing for Weekly Review and Mental Model
- **Vocabulary Notebook 2.0**: Recent Vocabulary Preview (showing 5 newest items) + View All / Dictionary Mode (detailing POS, collocations, sentence history, and delete/status actions) + Active Recall Practice (5-card queue prioritized by recency/underuse, with skip support, card progress, and input verification).
- **AI Vocabulary Correction**: `/api/vocabulary-correction` API checking user sentences, returning targetUsageRole explanations, and incrementing correctUseCount for natural sentences (no auto-replacing).
- **Gamification Engine**: Local XP events, pending XP tracking, Speaker Levels, and daily claims (includes 20 XP vocab_recall_session_completed reward capped at 2 per day, duplicate-protected).
- **Article Practice**: paste URL, server-side fetch, and generate copyright-safe academic speaking task results
- **Article Vocabulary Save**: save useful vocab cards directly to Vocabulary Notebook (duplicate-safe)
- **Article Practice → Active Session Bridge**: "Practice This Speaking Task" copies details to Today's Target, switches mode to "Reading-to-Speaking", and switches view to Active Session setup without auto-starting the session.
- **Profile & Settings**: owner-only profile/settings view replacing the old Settings placeholder. Signed-out users see a local-only profile card plus safe local stats; signed-in users see account/profile details, private account email, avatar, display name, bio, privacy toggles, local stat summaries, and language preference controls (App Language and Feedback Language). Profile saves persist display name, bio, public profile enabled, leaderboard opt-in, preferredAppLanguage, feedbackLanguage, and targetLanguage to Supabase.
- **UI & AI Feedback Localization**:
  - **App Language**: Renders English and Indonesian UI labels for all core wired views (Sidebar, Topbar, Session Setup, Vocabulary Notebook, Article Practice, Gamification, Session Log, Weekly Review, Mental Model, etc.).
  - **Feedback Language**: Controls the language of explanations, weaknesses, and reviews (English or Indonesian) across all AI API routes. Indonesian feedback is concise and beginner-friendly.
  - **Target Practice Language**: Remains English only. Corrected phrases, examples, target structures, and reference models are not translated. Stored transcripts/history are not translated retroactively.
- **User Leaderboard**: A user-only leaderboard component ranking users by valid XP.
  - Supports Daily, Weekly, Monthly, and All-time filters (Weekly is the default).
  - Only displays users with `leaderboard_opt_in = true` and XP > 0.
  - Opted-out signed-in users see private visibility and a simulated position (`previewRank`) while remaining hidden publicly.
  - No coins, energy, shop, extra points, or house systems are featured.
  - Only safe public fields are exposed (rank, display name/fallback, initials/avatar, level, period XP, badge counts). No email, owner IDs, source IDs, raw XP events, transcripts, or learning details are exposed.

## API Routes

- `/api/feedback` (session feedback)
- `/api/diagnostic` (diagnostic tests)
- `/api/weekly-review` (session trend review)
- `/api/mental-model` (micro drills & quality criteria)
- `/api/vocabulary-correction` (vocabulary usage feedback)
- `/api/article-practice` (URL text processing & prompt generation)
- `/api/leaderboard` (user-only leaderboard query; supports period=daily|weekly|monthly|all-time; runs server-side with a privileged service-role client for read/select only; does not mutate data or leak private learning details)

## Local Data

- Stored primarily in browser `localStorage`.
- Storage keys:
  - `adaptive-speaking-app:sessions` (practice session log)
  - `adaptive-speaking-app:vocabulary` (notebook words & usage history)
  - `adaptive-speaking-app:xp-profile` (total/pending/streak gamification status)
  - `adaptive-speaking-app:xp-events` (history of XP events for caps & diagnostics)
  - `adaptive-speaking-app:badges` (locked/earned badge lists)
- Clerk auth and Supabase client integration is active as a best-effort, non-blocking write path for completed sessions, vocabulary notebook changes, and gamification data (XP profile, XP events, badges).
- Hybrid local-first migration is in progress: `localStorage` remains the local source of truth.

## Database Schema & Cloud Status

- Supabase Postgres schema and RLS policies exist in `supabase/migrations/`.
- Supabase client integration exists under `app-web/src/app/lib/supabase/`.
- The app writes newly completed normal sessions, vocabulary changes, and gamification updates to Supabase as a best-effort, non-blocking cloud save when Clerk is signed in and Supabase is configured.
- Vocabulary deletions in the cloud are diff-based. Gamification events are also diffed to only upload newly added events.
- Cloud duplicate XP prevention relies on a unique database constraint on `(owner_id, type, source_id)` for `xp_events`.
- XP rules remain local and deterministic. AI never decides XP values.
- Database cascade deletes automatically clean up child sentences and corrections for deleted vocabulary items.
- The app supports loading a cloud snapshot preview. Signed-in users can trigger a user-confirmed cloud restore (available only if local browser data is empty) or cloud import (if local data exists, using a conservative merge plan and compatibility guard).
- During restore/import, local storage is never cleared, no cloud data is deleted or mutated, and no XP recalculations occur. CSV payloads, nested vocabulary relationships, and XP source details are preserved exactly. XP events are deduped on import using type and sourceId.
- Profile & Settings loads and saves owner-scoped profile preferences when signed in. `public_profile_enabled`, `leaderboard_opt_in`, `preferred_app_language` (as preferredAppLanguage), `feedback_language` (as feedbackLanguage), and `target_language` (as targetLanguage) are stored. The profile view is not public, the User Leaderboard is implemented to display sanitized rankings, and learning stats shown in Settings are derived from local browser state only.
- Leaderboard Privacy & Security: The leaderboard API uses the server-only `SUPABASE_SERVICE_ROLE_KEY` to perform read/select queries on profiles and XP events. It does not perform mutations or write operations. It filters out non-opted-in or zero-XP users. No private learning data (email, transcripts, corrections, vocabulary, URLs) is ever returned or rendered.
- Profile saves include display name, bio, public profile enabled, leaderboard opt-in, preferredAppLanguage, feedbackLanguage, and targetLanguage. The UI does not write learning data to localStorage and does not expose transcripts, retry transcripts, vocabulary sentence history, AI corrections, article URLs, weaknesses, retry tasks, CSV/session raw content, XP event source IDs, or private notes. Stored history is not retroactively translated.
- RLS policies expect Clerk JWT subject via `auth.jwt()->>'sub'`.
- Clerk's native Supabase integration is used to verify database operations.
- No database credentials should be committed.
- Tables prepared/defined: profiles, speaking_sessions, vocabulary_items,
  vocabulary_sentences, vocabulary_corrections, xp_profiles, xp_events,
  badges, global_ai_response_cache, ai_usage_events, ai_request_idempotency.
- The `global_ai_response_cache` table does **not** store raw HTML or full
  article bodies — only structured, copyright-safe speaking-task metadata.
- **Article Practice Caching**: Exact-match global caching is implemented for `/api/article-practice`. The cache key includes normalized URL, learner level, provider, mode, focus, feedbackLanguage, targetLanguage, and promptVersion. Cache lookup is executed prior to querying providers. Cache writes utilize the server-only `SUPABASE_SERVICE_ROLE_KEY` to prevent cache poisoning, and public write (INSERT/UPDATE/DELETE) privileges are completely disabled. It is not semantic vector caching yet. Global caching is currently limited to `/api/article-practice` only. Personal or semi-personal AI routes, including speaking feedback, diagnostics, weekly reviews, mental model outputs, vocabulary corrections, personal transcripts, and user sentences, are not globally cached.
- **AI Usage Ledger**: The `ai_usage_events` table records metadata-only usage events for `/api/article-practice`. Each row includes feature, provider, model, prompt version, cached flag, request status, estimated input/output tokens, estimated cost (USD), and optional error code. RLS is enabled with no public policies; writes use the server-only service role. Token estimates use chars / 4; cost estimates use a static price map and may be null for unknown models. Usage logging is non-blocking and does not affect route behavior or API responses. Personal route usage logging is future work.
- **Request Idempotency**: The `ai_request_idempotency` table caches status and response JSON for `/api/article-practice` using the `X-Fonetik-Idempotency-Key` header (validated length of 8-128 chars, hashed with SHA-256) and a deterministic hash of the request parameters (incorporating both `feedbackLanguage` and `targetLanguage`). Succeeding requests return the stored JSON within 20 minutes (fail-open safety, no raw HTML/text stored, writes/reads via server-only service role, RLS enabled with no public policies). In-progress requests are treated as misses to avoid blocking. Personal route idempotency is future work.

## Not In Current MVP

- Automated background sync or advanced interactive conflict resolution UI (Clerk and Supabase are configured for best-effort writes, read-only snapshot previews, and user-initiated restore/import; the app is not fully cloud-first yet)
- Public profile pages (privacy toggles exist and default off, but the dedicated profile pages themselves are future-facing only)
- User Leaderboard polish or deeper profile redesigns (the core user-only leaderboard is now fully implemented as MVP)
- Full multi-target-language support (target practice language remains fixed to English only)
- Deployment workflow
- Mobile app
- Dedicated Deep Feedback mode (currently routes to Quick Feedback)
- Advanced RAG or vector database search
- Persisted Weekly Review or Mental Model history
- Pronunciation scoring or audio recording exports
- Article Practice history or article-specific metadata in CSV
- Advanced Active Recall Practice algorithm / SM-2 (uses Active Recall Practice prioritization queue instead)
- Bulk AI classification or tagging of vocabulary items
- Automated "Generate Sentence" or auto-answer templates (users must supply original sentences)

## Working Notes

- API keys belong only in `app-web/.env.local`.
- Provider keys must not use `NEXT_PUBLIC_`.
- `.env.local`, `.next`, and `node_modules` should not be committed.
- Supabase migration files are schema-only; do not add real keys or secrets.
