# fonetik MVP Test Checklist

Manual checks to run before declaring the local MVP stable.

## 1. App Shell and Navigation

- [ ] Sidebar renders the fonetik logo, Speak Better tagline, Current Level card, nav groups, and Day Streak card
- [ ] Topbar title, subtitle, active/idle chip, mode chip, and level chip update correctly
- [ ] Active Session opens from the sidebar
- [ ] Session Log opens from the sidebar
- [ ] Progress opens from the sidebar
- [ ] Level-Up Check opens the Progress view
- [ ] Weekly Review opens from the sidebar
- [ ] Diagnostic shortcut selects Diagnostic mode and opens Active Session
- [ ] Mental Model opens from the sidebar
- [ ] Profile opens from the sidebar
- [ ] Settings opens from the sidebar
- [ ] Article Practice opens from the sidebar

## 2. Session Setup

- [ ] User can select Level: Foundation, Beginner, Intermediate, Advanced, Expert
- [ ] User can select Mode: Fluency Sprint, Argument Drill, Reading-to-Speaking, Debate, Diagnostic
- [ ] Diagnostic mode card is visible and clearly marked as assessment
- [ ] User can select Feedback Type: Quick, Deep
- [ ] User can select Session Type: Micro, Standard, Deep
- [ ] User can select AI Provider: Claude, DeepSeek, Gemini
- [ ] User can type a Today's Target
- [ ] Start Session button is visible
- [ ] After Start Session, the button becomes Restart Session
- [ ] Current setup values remain controlled when navigating away and back

## 3. Prompt Generation

- [ ] Normal modes render a local Speaking Prompt after Start Session
- [ ] Speaking Prompt shows task, constraints, target structure, and time limit
- [ ] Diagnostic mode renders the A/B/C diagnostic prompt
- [ ] Diagnostic prompt does not include sample answers
- [ ] Regenerate Local Prompt works
- [ ] Regenerate Local Prompt does not clear the transcript
- [ ] Regenerate Local Prompt does not reset the timer
- [ ] Local prompt generation does not call an AI API

## 4. Speaking Attempt and Speech Input

- [ ] Active Session panel shows the chosen setup values
- [ ] Timer starts at 00:00 and counts up
- [ ] Start Timer is disabled while running
- [ ] Stop Timer pauses the count
- [ ] Reset Timer returns to 00:00
- [ ] User can type or paste a transcript
- [ ] Speech input controls appear when the browser supports speech recognition
- [ ] Start Speech Input begins listening and appends recognized text to the transcript
- [ ] Stop Speech Input stops listening
- [ ] Unsupported browsers show a safe fallback and manual transcript input still works
- [ ] Speech errors show a short friendly message
- [ ] Submit Attempt is disabled when transcript is empty or whitespace only
- [ ] Submit Attempt becomes enabled after typing real text
- [ ] Captured Attempt shows duration, word count, and transcript preview

## 5. AI Feedback

> Quick Feedback is implemented. The Deep Feedback setup option currently uses
> the same Quick Feedback route; dedicated Deep Feedback is future work.

- [ ] Get AI Feedback button appears after capturing a normal attempt
- [ ] While loading, button is disabled and reads "Generating feedback..."
- [ ] Successful response shows Main Weakness, Evidence, Better Phrase, Retry Task, Provider Used, and Scores
- [ ] Foundation Scores show only Fluency and Coherence
- [ ] Beginner Scores show Fluency, Grammar, and Coherence
- [ ] Intermediate, Advanced, and Expert Scores show all six dimensions
- [ ] Each score is an integer between 1 and 5
- [ ] Missing or invalid scores fall back safely to 3 for that dimension
- [ ] Evidence references a real moment from the transcript
- [ ] Foundation feedback does not correct grammar or vocabulary directly
- [ ] Foundation Better Phrase is short, simple, and repeatable
- [ ] Foundation Retry Task is doable in 30-60 seconds

## 6. Retry Loop

- [ ] Retry Attempt panel appears after feedback
- [ ] Retry task from feedback is shown above the textarea
- [ ] Submit Retry is disabled when retry transcript is empty
- [ ] After Submit Retry, Retry Captured panel appears
- [ ] Retry Captured shows transcript preview and "Retry saved" copy
- [ ] No second AI call is triggered on retry submission

## 7. End Session CSV

- [ ] End Session button appears in Retry Captured
- [ ] Clicking End Session generates the Session Summary panel
- [ ] CSV block contains header line and data row
- [ ] Date cell uses YYYY-MM-DD
- [ ] Foundation CSV uses no Grammar, Vocabulary, Argument, or AcademicTone score columns
- [ ] Beginner CSV adds Grammar
- [ ] Intermediate, Advanced, and Expert CSV include all six score columns
- [ ] Score columns match the Quick Feedback panel
- [ ] Missing or invalid API score values become `3` in CSV
- [ ] Main_Weakness, Evidence, and Next_Target match AI feedback
- [ ] Copy CSV copies the full CSV
- [ ] Copy confirmation appears briefly

## 8. localStorage History and Session Log

- [ ] Normal End Session saves a new entry to `adaptive-speaking-app:sessions`
- [ ] Refresh keeps Recent Sessions visible
- [ ] Session Log shows up to 5 latest items in newest-first order
- [ ] Session Log count reflects total stored sessions
- [ ] Total stored entries never exceeds 20
- [ ] Each item displays date, level, mode, Main Weakness, and Next Target
- [ ] Copy Last CSV copies the newest session CSV
- [ ] Restart Session does not delete saved history
- [ ] Corrupted localStorage JSON does not crash the page

## 9. Progress, Day Streak, and Level-Up Check

- [ ] Progress view renders total sessions, current streak, latest level, and recent activity
- [ ] Day Streak card renders in the sidebar
- [ ] Day Streak is 0 when there are no completed sessions
- [ ] Day Streak is derived from local session dates without new storage
- [ ] Level-Up Check shows Current Level, Next Level, Status, Evidence, Missing requirements, and Recommended next action
- [ ] Malformed or incomplete session CSV entries are ignored safely
- [ ] Almost ready appears only when enough valid sessions exist and averages are close
- [ ] Expert shows Max level reached and no Apply Next Level button
- [ ] Apply Next Level appears only when status is Ready and updates only Level, Today's Target, and view
- [ ] Apply Next Level does not modify localStorage history or CSV data

## 10. Coach Recommendation and Previous Weakness

> Coach Recommendation is deterministic and local. It reads existing session
> history and does not call an AI model.

- [ ] Coach Recommendation appears before a session is active
- [ ] Coach Recommendation hides once a session is active
- [ ] With no history, recommendation suggests a beginner-friendly starting point
- [ ] With history, focus uses latest retryTask or mainWeakness
- [ ] Use Recommendation updates Mode, Session Type, and Today's Target
- [ ] Recommendation never auto-applies
- [ ] Previous Weakness appears after at least one completed session
- [ ] Previous Weakness shows Main Weakness and Next Target from the latest session
- [ ] Empty Today's Target auto-fills from previous retry task when starting a session
- [ ] Manually filled Today's Target is preserved

## 11. Diagnostic Mode

> Diagnostic Mode is a standalone assessment through `/api/diagnostic`. It does
> not produce Retry, CSV, or history entries.

- [ ] Diagnostic appears as a Mode option
- [ ] Diagnostic prompt shows three sections: A, B, C
- [ ] Captured panel shows Run Diagnostic instead of Get AI Feedback
- [ ] Run Diagnostic loading state works
- [ ] Diagnostic Result shows Recommended Level, Main Bottleneck, Summary, Scores, and 7-Day Focus Plan
- [ ] Recommended Level is Foundation, Beginner, Intermediate, Advanced, or Expert
- [ ] Missing or invalid diagnostic scores fall back to 3
- [ ] Apply Recommended Level updates Level and Today's Target
- [ ] Diagnostic does not show Retry, CSV, or Session Summary panels
- [ ] Diagnostic does not add a localStorage history entry
- [ ] Foundation diagnostic plan uses simple 10-20 minute speaking drills
- [ ] Foundation diagnostic plan does not recommend journal abstracts, academic papers, or advanced research tasks

## 12. Weekly Review Agent

> Weekly Review sends compact recent session summaries to `/api/weekly-review`.
> It does not store review results.

- [ ] Weekly Review opens without auto-running
- [ ] With fewer than 4 sessions, the requirement message appears
- [ ] With 4+ sessions, Run Weekly Review is enabled
- [ ] Request sends latest 4 to 7 session summaries, not full transcripts or retry transcripts
- [ ] Successful review shows Summary, Recurring Weakness, Best Improvement, Score Trend, Next Week Focus, and 7-Day Recommended Plan
- [ ] Warnings appear only when non-empty warnings are returned
- [ ] Foundation Weekly Review plan is simple, practical, and speaking-drill based
- [ ] Weekly Review accepts valid JSON inside markdown fences or short surrounding provider text
- [ ] Weekly Review provider errors are friendly and do not expose raw upstream JSON
- [ ] Running Weekly Review does not change localStorage history, CSV data, feedback, diagnostic, retry, or speech input behavior

## 13. Mental Model Session

> Mental Model sends setup context plus latest weakness/retry text to
> `/api/mental-model`. It does not store results.

- [ ] Mental Model opens without auto-running
- [ ] View shows current Level, current Mode, and editable Focus / Weakness
- [ ] Blank focus falls back to current target, latest retry task, latest weakness, or generic academic response focus
- [ ] Request sends provider, level, mode, focus, latestWeakness, and latestRetryTask only
- [ ] Successful result shows Core Standard, Quality Criteria, Weak Pattern, Strong Pattern, Self-Check Questions, Micro Drill, and Reference Model
- [ ] Invalid criteria/question counts or overly long reference model are rejected with friendly errors
- [ ] Mental Model accepts valid JSON inside markdown fences or short surrounding provider text
- [ ] Foundation Mental Model uses simple speaking standards and avoids abstract theory, counterarguments, advanced vocabulary lists, and essay-like structure
- [ ] UI does not provide a copy/use-as-answer action for the reference model
- [ ] Running Mental Model does not change localStorage history, CSV data, feedback, diagnostic, weekly review, retry, or speech input behavior

## 14. Provider Errors and Security

- [ ] Missing API key shows a clear short error
- [ ] Rejected API key shows a friendly message, not raw provider JSON
- [ ] Rate limit shows a friendly retry/wait message
- [ ] Model unavailable shows a provider-specific friendly message
- [ ] Network failure shows a short error, not a stack trace
- [ ] `.env.local` is not tracked by Git
- [ ] No real API keys appear in docs, `.env.example`, request bodies, or JS bundles
- [ ] No provider key uses `NEXT_PUBLIC_`
- [ ] Provider calls happen only through server-side API routes
- [ ] LocalStorage remains source of truth, and optional Clerk/Supabase connection works in a best-effort cloud-write manner. Manual user-confirmed restore (when local is empty) and import (using compatibility checks and XP deduplication) work without clearing local data or modifying cloud data.

## 15. Foundation Calibration

- [ ] Foundation Feedback avoids advanced vocabulary upgrades, counterarguments, complex evidence tasks, and long polished rewrites
- [ ] Foundation Diagnostic plans are concrete speaking drills
- [ ] Foundation Weekly Review plans are practical 10-20 minute speaking drills
- [ ] Foundation Mental Model teaches simple pattern recognition, not essay-like standards
- [ ] Foundation outputs do not recommend journal abstracts, academic papers, or advanced research tasks

## 16. Performance and UX

- [ ] Page scroll remains lightweight on desktop and mobile widths
- [ ] UI text remains readable over the light grid/card texture
- [ ] No chart library, canvas, heavy animation, or blur/backdrop-filter is required
- [ ] No polling or background intervals run beyond timer/copy-status behavior
- [ ] Cards and buttons remain usable at mobile widths

## 17. Profile

> Profile is a read-only learner identity / achievement page. It does not contain edit controls, input boxes, or save buttons.

- [ ] Sidebar opens Profile from the Analytics section
- [ ] Profile renders the learner identity card (avatar/initials fallback, bio, display name, joined date when available)
- [ ] Profile renders Level progress (current level, progress bar to next level, total XP)
- [ ] Profile renders local stats card with counts only: sessions, day streak, vocab words, badges
- [ ] Profile renders 7-day activity visualizer chart
- [ ] Profile renders practice mode breakdown distribution chart
- [ ] Profile renders earned badges preview tags
- [ ] Profile renders visibility status and privacy reassuring copy (transcripts, CSV, corrections, URL are safe)

## 17b. Settings

> Settings is dedicated to preferences and privacy configurations. It does not render progress statistics cards.

- [ ] Sidebar opens Settings from the System section
- [ ] Signed-out mode shows local profile card explaining learning data remains local to the browser
- [ ] Signed-out mode shows no cloud profile controls and no privacy toggles
- [ ] Signed-in mode shows account card with avatar, display name, bio, and joined date when available
- [ ] Signed-in email is labeled private/account-only
- [ ] Editable fields allow changing display name and bio (with character counter)
- [ ] Privacy toggles render public profile toggle and leaderboard opt-in toggle (both defaulting to false)
- [ ] Language selectors allow choosing App Language (English/Indonesian) and Feedback Language (English/Indonesian)
- [ ] Target language selector is disabled and fixed to English
- [ ] Save updates optimistic profile preferences in database (displayName, bio, publicProfileEnabled, leaderboardOptIn, preferredAppLanguage, feedbackLanguage, and targetLanguage)
- [ ] Save failure shows non-blocking message and does not affect local learning data
- [ ] Settings view does not render progress statistics card
- [ ] No public profile route, public profile link, or unauthorized access to private data is visible
- [ ] Known minor polish: empty display name/bio normalization can be improved later

## 18. Gamification Foundation

> Gamification helpers are deterministic and local, fully integrated with session actions, vocabulary practice, and article practice.

- [ ] XP helpers do not modify existing session history or CSV data
- [ ] Malformed gamification localStorage values normalize safely
- [ ] XP amounts come only from `XP_RULES`, never from AI output
- [ ] Claim XP is blocked after one claim per local day
- [ ] Sidebar shows Speaker Level separately from English Level
- [ ] Progress view shows total XP, pending XP, previous unclaimed XP, and claim state
- [ ] No fake/test XP buttons are present
- [ ] Completing a normal session awards deterministic pending XP once per session (40 XP)
- [ ] Completing a valid retry, diagnostic, weekly review, mental model, or level-up awards deterministic pending XP with daily caps
- [ ] Diagnostic sessions do not create normal session history XP
- [ ] Article Practice XP uses deterministic local date + normalized source URL (`article-{localDate}-{stableHash(normalizedUrl)}`) for duplicate protection
- [ ] Vocabulary sentence XP is awarded only after an accepted saved sentence (5 XP)
- [ ] First-action badges and Speaker Level 5 badge are visual only and do not award XP

### 19. Vocabulary Notebook 2.0

> Vocabulary Notebook is local and deterministic, integrated with AI sentence correction and XP rules.

- [ ] Vocabulary helpers use only `adaptive-speaking-app:vocabulary`
- [ ] Malformed vocabulary localStorage values normalize safely
- [ ] Old vocabulary records without `partOfSpeech` load with an `other` fallback
- [ ] Sidebar opens Vocabulary Notebook from the Practice section
- [ ] Main view displays **Recent Vocabulary** containing only the 5 most recently added items to prevent cluttering
- [ ] Add Vocabulary form saves word, meaning, level, source, optional example, and collocations
- [ ] **View All / Dictionary Mode** opens to show the entire list of saved vocabulary items with comprehensive metadata, sentence histories, status updates, and delete controls
- [ ] **Active Recall Practice** constructs a 5-card queue prioritizing underused/new/practicing items, excluding paused ones
- [ ] Cards display step progress (e.g. Card 1 of 5)
- [ ] Hints are hidden by default, revealing meaning, POS, example, and collocations on disclosure
- [ ] Practice sentence submission rejects empty or target-vocab-omitted sentences
- [ ] Practice sentence submission accepts correct usage sentences, incrementing reuse count, saving history, and transitioning items from `new` to `practicing`
- [ ] **Skip Card** advances practice, calling recency updating behavior but bypassing XP rewards, reuse counts, and correct use counts
- [ ] **XP Recall Completion** awards 20 XP (`vocab_recall_session_completed`) only for a 5-card session completed with 0 skips
- [ ] Same practice queue completed on the same day is blocked from duplicate XP via date-plus-queue-hash event `sourceId` checks
- [ ] Daily cap of 2 recall completed sessions (40 XP) is enforced
* **Vocabulary Correction and Usage Check**:
  - [ ] Sentence history displays a Check Usage button, calling `/api/vocabulary-correction`
  - [ ] AI correction saves results locally in the notebook sentence history without modifying the user's input
  - [ ] AI correction status of natural/understandable increments `correctUseCount` exactly once per sentence (deduplicated on re-checks)
  - [ ] Usage checking does not award XP or modify CSV summaries

## 20. Vocabulary Correction API

> Vocabulary Correction checks one learner-written sentence and saves short feedback locally in Vocabulary Notebook.

- [ ] `/api/vocabulary-correction` rejects invalid provider, level, empty word, and empty sentence
- [ ] Sentence must include the target vocabulary word or phrase before provider call
- [ ] Provider keys stay server-side and missing keys return friendly errors
- [ ] Route accepts raw, fenced, or surrounded JSON provider output
- [ ] Corrected sentence is one short sentence, not a paragraph or multiple alternatives
- [ ] Optional `targetUsageRole` explaining the word's function is returned and displays safely in the UI
- [ ] Old correction records missing `targetUsageRole` display safely without crash
- [ ] Foundation correction uses simple wording and one main correction
- [ ] UI does not auto-replace the user's original sentence or provide a copy-as-answer flow
- [ ] Route does not modify XP, session history, CSV data, or Article Practice behavior

## 21. Article Practice and Bridge

> Article Practice turns a user-provided article URL into copyright-safe speaking practice, and allows bridging speaking tasks to Active Session.

### Article Practice API
- [ ] `/api/article-practice` accepts only HTTP/HTTPS article URLs
- [ ] Obvious local/private hosts are rejected before server-side fetch
- [ ] Non-HTML, oversized, blocked, dynamic, or paywalled pages return friendly errors
- [ ] Full article text is never returned to the client or stored (complying with copyright policies)
- [ ] Result contains article snapshot (title, domain, URL), brief, main idea, key points, useful vocabulary candidates, comprehension checks, speaking task, follow-up questions, and warnings
- [ ] Foundation speaking tasks stay simple, 30-60 seconds, and avoid research/counterargument/evidence-evaluation tasks
- [ ] Provider JSON parsing handles raw, fenced, or surrounded JSON while keeping schema validation strict

### Article Practice UI
- [ ] Article Practice UI requires a URL before request, displaying validation error on empty submit
- [ ] Article Practice UI displays source title, domain, and URL, but never the full extracted article body
- [ ] Article Practice result clears on page refresh (state is React only)

### Save Article Vocabulary Candidates
- [ ] Cards in the Useful Vocabulary section show a "Save to Notebook" button
- [ ] Clicking "Save to Notebook" creates a `VocabItem` in Vocabulary Notebook with `source: "article"`
- [ ] Saved vocabulary candidate matches the active English Level, meaning is saved, and example uses `whyUseful`
- [ ] Clicking "Save to Notebook" updates the button text to `"Saved ✓"` synchronously
- [ ] Re-entering Article Practice shows already-saved words as `"Saved ✓"` (case-insensitive and trimmed)
- [ ] Duplicate words are not added again to the notebook, and saving does not award XP

### Article Practice XP Integration
- [ ] Successfully generating an Article Practice result awards 25 XP (pending daily XP)
- [ ] Same URL generated on the same day produces the identical `sourceId` and is blocked from earning duplicate XP
- [ ] Different URLs generated on the same day are eligible for XP, subject to the daily cap of 3 completions per day

### Article Practice to Active Session Bridge
- [ ] Result displays a "Practice This Speaking Task" button
- [ ] Clicking "Practice This Speaking Task" automatically switches view to Active Session setup
- [ ] Sets active session practice mode to `"Reading-to-Speaking"`
- [ ] Populates Today's Target with a compact, structured summary of the task:
  - Task title, source details (title, domain), instructions, target structures, suggested vocabulary words (up to 5), and source URL
- [ ] Today's Target does NOT include the article brief, key points, or full article text
- [ ] Active session is NOT auto-started, and recording does not begin automatically
- [ ] Bridge button click awards 0 XP
- [ ] If an active session is already running, clicking the bridge button updates the setup/target but does not reset the session prematurely (displays active session bridge warning: "Article speaking task copied to Session setup. Click Restart Session when you are ready to switch tasks.")
- [ ] Manually editing Today's Target or starting/restarting a session clears the bridge status message

### Article Practice Caching and Security
- [ ] Caching is exact-match and checks Supabase before provider API calls
- [ ] Cache key is a deterministic SHA-256 hash of URL (normalized), level, provider, mode, focus, and promptVersion
- [ ] URL normalization strips query tracking parameters, normalizes case, and trailing slashes for root domains
- [ ] Cache fails silently and falls back to normal AI generation if the database is offline/unconfigured
- [ ] Cache writes utilize the server-only `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Public `INSERT`, `UPDATE`, or `DELETE` policies on the global cache table are disabled to prevent cache poisoning
- [ ] Changing `PROMPT_VERSIONS.articlePractice` in code invalidates previous cache entries automatically
- [ ] Only copyright-safe structured JSON is cached; raw HTML and extracted article bodies are never persisted
- [ ] Personal or semi-personal AI routes, including speaking feedback, diagnostics, weekly reviews, mental model outputs, vocabulary corrections, personal transcripts, and user sentences, are not globally cached.

### AI Usage Ledger (Article Practice)
- [ ] Usage events are recorded for cache hit, provider success, article fetch failure, provider failure, and parse/validation failure
- [ ] Usage rows contain only metadata: feature, provider, model, prompt version, cached, request status, estimated tokens, estimated cost, and error code
- [ ] No raw article text, HTML, transcripts, user sentences, CSV, or personal content is stored in usage rows
- [ ] Usage writes use server-only `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `ai_usage_events` has RLS enabled with no public INSERT, UPDATE, DELETE, or SELECT policies
- [ ] Usage logging failure does not affect Article Practice route behavior or API responses
- [ ] Token estimates use deterministic chars / 4 approximation
- [ ] Cost estimates use a static provider/model price map; unknown models produce null cost
- [ ] Missing `SUPABASE_SERVICE_ROLE_KEY` silently disables usage logging without errors
- [ ] Usage ledger is currently scoped to `/api/article-practice` only; personal routes do not have usage logging yet
- [ ] No API response shapes changed by usage logging

### AI Request Idempotency (Article Practice)
- [ ] Idempotency is enabled only for `/api/article-practice` when `X-Fonetik-Idempotency-Key` is provided
- [ ] Header key is trimmed and validated (must be between 8 and 128 characters)
- [ ] Valid key is hashed using SHA-256 (`idempotency_key_hash`)
- [ ] Request parameters are deterministically hashed to compute `request_hash`
- [ ] If an unexpired succeeded row exists, it replays the stored `response_json` without calling the AI provider
- [ ] If a row is missing, expired, or has in_progress or failed status, the request proceeds normally
- [ ] Successful AI generation saves the result to `ai_request_idempotency` with status `succeeded` and `response_json`
- [ ] Prior failed attempts or client errors write status `failed` to the table but do not block future requests or replay as success
- [ ] Missing database configurations, service role keys, or network connection failures fail open safely
- [ ] The `ai_request_idempotency` table has RLS enabled with no public select/insert/update/delete policies
- [ ] All database actions use the server-only `SUPABASE_SERVICE_ROLE_KEY`
- [ ] No raw article text, HTML, transcripts, user sentences, CSV, or personal content is stored in idempotency rows
- [ ] Personal/semi-personal AI routes are not globally cached or idempotent

## 22. Localization and Multi-Language Support

- [ ] Selecting App Language "id" immediately changes UI text and labels to Indonesian across the Sidebar, Topbar, Session Setup, Vocabulary Notebook, Article Practice, Progress, Session Log, Weekly Review, Mental Model, Profile, and Settings views
- [ ] Selecting App Language "en" restores all UI text and labels back to English
- [ ] Missing app language localization keys default safely to English UI text without crashing
- [ ] Changing Feedback Language to "id" and performing a session attempt returns AI feedback explanations in Indonesian, while keeping the corrected sentence, words, target structures, and reference models in English
- [ ] Changing Feedback Language to "id" for diagnostic tests, weekly reviews, mental models, vocabulary corrections, and article practice returns explanations/instructions in Indonesian, keeping English target sentences and vocabulary terms untranslated
- [ ] Indonesian AI feedback is concise and beginner-friendly
- [ ] Missing or invalid incoming `feedbackLanguage` values on AI routes fall back safely to English ("en")
- [ ] Missing or invalid incoming `targetLanguage` values on AI routes fall back safely to English ("en")
- [ ] Target practice language is restricted to English only (no options for other target languages in Settings)
- [ ] Stored session transcripts, history logs, vocabulary lists, and previous AI corrections are not translated retroactively when changing App Language or Feedback Language
- [ ] Changing Feedback Language or Target Language correctly isolates cache keys and request hashes in Article Practice (e.g. English vs Indonesian requests map to different keys, preventing improper replay)
- [ ] Changing Feedback Language or Target Language correctly isolates idempotency request hashes in Article Practice

## 23. User Leaderboard

> The User Leaderboard aggregates valid XP events from Supabase Postgres server-side and displays a sanitized public ranking.

- [ ] Sidebar renders the "Leaderboard" navigation link in the progress/analytics section
- [ ] Clicking the "Leaderboard" link displays the LeaderboardView shell
- [ ] Signed-out view displays a prompt to sign in to see the leaderboard with a working Sign In link
- [ ] Signed-in view displays the Leaderboard header, subtitle, period tabs, and current user status summary card
- [ ] Period tabs render Daily, Weekly, Monthly, and All-time filters, with Weekly selected by default
- [ ] Switch between Daily, Weekly, Monthly, All-time tabs triggers a reload of ranking data with the correct query param (`?period=...`)
- [ ] Current user status summary card displays rank (or preview rank), display name fallback, level, period XP, badges count, and status (e.g. "Opted In", "Opted Out - Private Visibility")
- [ ] When opted out (`leaderboard_opt_in = false`), user status summary displays private visibility, their simulated position (`previewRank`), and a link to change this in Settings
- [ ] When opted in (`leaderboard_opt_in = true`), user status summary displays their public rank, public visibility, and a link to change this in Settings
- [ ] Rankings table lists ranking position (1, 2, 3, etc.), display name fallback, level, period XP, and badges count
- [ ] Only users with `leaderboard_opt_in = true` and non-zero period XP appear publicly on the rankings table
- [ ] Zero-XP users are hidden from the rankings table
- [ ] Only safe public fields are rendered in the DOM; no emails, owner IDs, source IDs, raw XP events, transcripts, vocabulary sentences, or AI corrections are present
- [ ] Loading state is displayed during data fetching
- [ ] Empty state is handled gracefully when no public users are ranked
- [ ] Error fallback handles network or database offline states gracefully without crashing the UI
- [ ] API route `/api/leaderboard` handles missing/invalid period parameters by defaulting to `weekly`
- [ ] API route performs administrative queries server-side using `SUPABASE_SERVICE_ROLE_KEY` but performs only read/select operations (no writes, increments, or mutations)
- [ ] No XP rules or gamification calculations are changed or overridden by the leaderboard components

## 24. Learning Path (Phase 1 MVP)

> Learning Path is a local-first, static-curriculum journey designed to build beginner confidence.

- [ ] Sidebar navigation includes a "Learning Path" link
- [ ] Phase 1 renders Unit 1 (Introduce Yourself) and Unit 2 (My Daily Life)
- [ ] All 14 days render in the correct sequential order
- [ ] Today's Mission updates dynamically as progress changes
- [ ] Card statuses correctly reflect completed, current, recommended, available, or upcoming states
- [ ] Interactive cards launch the `MicroLessonShell`
- [ ] Guided Word, Phrase Pattern, Sentence Builder, and Micro Speaking specialized renderers work securely
- [ ] Progress persists successfully to `fonetik:learning-path-progress:v1` in `localStorage`
- [ ] Completing a card advances the recommendation engine correctly
- [ ] Privacy strictness: No transcripts, recordings, raw usage, email, owner IDs, or AI corrections appear in DOM or storage
- [ ] Safe completion state appears upon finishing all Phase 1 cards
- [ ] No AI scoring claims, final exams, or auto-pass mechanisms are presented

## 25. Feedback Normalization Engine (Foundation)

> The Feedback Normalization Engine is currently a pure helper foundation. It has no UI or storage integration yet.

- [ ] Taxonomy defines exactly 10 safe categories (fluency, clarity, structure, grammar, vocabulary, reasoning, listening, academic_tone, confidence, engagement)
- [ ] Normalization helpers correctly filter out unknown categories and sanitize inputs
- [ ] Retry action mapper returns deterministic, safe practice recommendations based on categories
- [ ] Summary helpers correctly aggregate signals by latest, 7-day, and all-local windows
- [ ] Learning Path adapter converts summaries into safe advisory hints
- [ ] Pipeline enforces privacy by dropping raw AI text, user transcripts, and PII
- [ ] All 378 foundation tests pass without modifying existing AI routes or UI

## 26. Adaptive Tutor Memory (Foundation)

> The Adaptive Tutor Memory engine is currently a pure helper foundation. It has no UI, storage, Supabase schema, API routes, AI model dependencies, environment variable updates, or third-party packages.

- [ ] Type contracts strictly serialize only whitelisted category-level signals and metadata.
- [ ] Builder helpers correctly ingest safe `FeedbackSignalSummary` inputs and current Learning Path progress snapshots to create safe `TutorMemoryProfile` objects.
- [ ] Recommendation helpers produce deterministic advisory `TutorMemoryRecommendation` objects mapping target category signals to retry modes.
- [ ] Learning Path advisory bridge combines sequential progress with tutor memory recommendations while strictly preserving the sequential card recommendation order without hard-locking or bypassing it.
- [ ] Privacy QA tests (`tests/tutor-memory-privacy.spec.ts`) confirm that zero forbidden data elements (transcripts, raw corrections, article URLs, vocabulary sentences, emails, owner/source IDs, CSV/session raw content, raw provider responses, prompt text, recordings, or negative learner labels) are serialized or exposed.

## 27. Human-Approved Improvement Loop (Foundation)

> The Human-Approved Improvement Loop engine is currently a pure helper foundation. It has no UI, storage, Supabase schema, API routes, AI model dependencies, environment variable updates, or third-party packages.

- [ ] Type contracts strictly serialize only whitelisted category-level signals and proposal metadata.
- [ ] Builder helpers correctly generate structured proposals with deterministic `proposalId` formats.
- [ ] Friction detection helpers identify pacing, retries, documentation, and category recurrence triggers accurately from mock aggregates.
- [ ] Checklist formatting outputs standard developer checklists with validation command strings (`npm run test:e2e`).
- [ ] Privacy QA tests (`tests/improvement-loop-privacy.spec.ts`) verify that zero raw user text, transcripts, URLs, emails, or credentials are leaked or stored.
- [ ] Code is audited to verify zero auto-execution, self-modification, filesystem writes, or database queries.

## 28. Developer Diagnostics (Foundation)

> The Developer Diagnostics engine is currently a pure helper foundation. It has no UI, storage, Supabase schema, API routes, AI model dependencies, environment variable updates, or third-party packages.

- [ ] Developer Diagnostics type contracts serialize only whitelisted fields.
- [ ] Snapshot helpers create safe foundation readiness summaries.
- [ ] Report builder produces advisory developer-facing reports only.
- [ ] Phase 2 readiness evaluator returns safe readiness status and blockers.
- [ ] Improvement Loop connector maps diagnostics to human-approved proposal candidates only.
- [ ] Privacy QA confirms no transcripts, emails, owner/source IDs, raw event payloads, article URLs, raw AI corrections, recordings, provider responses, or clinical/negative labels are serialized.
- [ ] Developer Diagnostics introduces no UI, storage, Supabase schema, API route, analytics tracking, AI/model call, package, or environment changes.

