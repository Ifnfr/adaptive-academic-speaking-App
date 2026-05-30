# fonetik

**Speak Better**  
AI-Powered academic speaking practice.

fonetik is a local-first academic speaking practice app. It helps learners set
up short speaking sessions, generate local practice prompts, get AI feedback,
retry the same weakness, and review progress from browser-stored history.

The repository is named `adaptive-academic-speaking-app`, but the product name
shown in the UI is **fonetik**.

## MVP Features

- Light fonetik dashboard UI with sidebar navigation and topbar status chips
- Active Session flow with Session Setup, mode cards, level selection, provider selection, and Today's Target
- Local Speaking Prompt generation by level, mode, and session type
- Browser speech-to-text input plus manual transcript input
- Timer with start, stop, and reset controls
- AI Feedback with main weakness, evidence, better phrase, retry task, and level-specific 1-5 scores
- Retry Loop before ending a normal feedback session
- End Session CSV, Copy CSV, Session Log, and Copy Last CSV
- Browser localStorage history under `adaptive-speaking-app:sessions`
- Progress view with local stats, Day Streak, and Level-Up Check
- Diagnostic Mode with recommended level, bottleneck, score profile, and 7-day focus plan
- Weekly Review Agent using compact recent session summaries
- Mental Model Session for learning response standards and patterns before practice
- Friendly provider errors for missing keys, rejected keys, rate limits, and model availability
- Foundation-level calibration for Feedback, Diagnostic, Weekly Review, and Mental Model outputs
- Robust JSON parsing for Weekly Review and Mental Model provider responses
- **Vocabulary Notebook 2.0**: A local-first notebook featuring:
  - **Recent Vocabulary Preview**: Displays only the 5 most recently added items on the dashboard to prevent overcrowding.
  - **View All / Dictionary Mode**: Shows all saved vocabulary items and displays comprehensive metadata (part of speech, level, source, example, usage note/collocations, reuse counts, correct use counts, saved date, last practiced date, and sentence history), with delete and status controls.
  - **Active Recall Practice**: Starts a 5-card queue based on a recency/scoring prioritization algorithm. Features step-by-step progress tracking, optional hint disclosures (reveals meaning, part of speech, examples, and collocations), and strict sentence validation (empty/whitespace sentences or sentences omitting the target word are rejected).
  - **AI Vocabulary Correction**: Integrates with `/api/vocabulary-correction` (sends target vocabulary, part of speech, meaning, and user sentence) to evaluate grammatical naturalness, returning target usage roles and detailed correction feedback without auto-replacing the original sentence.
- **Gamification Engine**: Local XP tracking based on `XP_RULES`. Award pending daily XP for completing sessions, diagnostic tests, weekly reviews, mental models, level-ups, vocabulary sentence practice (5 XP), vocabulary recall session completion (20 XP, awarded only for a full 5-card session with 0 skips and duplicate-protected), and article practice, with a daily claim mechanism and capped limits.
- **Article Practice**: Paste an article URL to extract text server-side and generate copyright-safe academic speaking practice (snapshot, brief, main idea, key points, useful vocabulary candidates, comprehension checks, speaking task, follow-up questions, and warnings).
- **Article Vocabulary Save**: Save useful vocabulary candidates directly to the Vocabulary Notebook with the source set to `"article"`, carrying over the word, meaning, selected level, and usage examples from the article context (duplicate-safe).
- **Article Practice → Active Session Bridge**: Click "Practice This Speaking Task" in the Article Practice result to switch views, set mode to "Reading-to-Speaking", and populate Today's Target with a compact prompt containing task details, source, instructions, structure, vocabulary, and URL, without auto-starting the session.
- **Profile and Settings**: Dedicated, separate owner-only views replacing the old combined Settings layout. Profile acts as a read-only learner identity / achievement page (rendering avatars/initials, display names, bios, speaker levels, XP progress, streaks, sessions count, vocabulary counts, badges list, and summaries). Settings is dedicated to editable details (display name, bio), private account email labeling, language preferences (App Language and Feedback Language), target language fixed to English, public profile toggle, and leaderboard opt-in toggle. Profile preferences are saved to Supabase when signed in.
- **UI & AI Feedback Localization**:
  - **App Language**: Allows toggling UI labels between English and Indonesian for all core wired panels (Sidebar, Topbar, Session Setup, Vocabulary Notebook, Article Practice, Gamification/Progress, Session Log, Weekly Review, Mental Model, etc.).
  - **Feedback Language**: Configures AI responses to explain concepts, weaknesses, and corrections in English or Indonesian across all AI routes (`/api/feedback`, `/api/diagnostic`, `/api/weekly-review`, `/api/mental-model`, `/api/vocabulary-correction`, `/api/article-practice`). Indonesian feedback is tailored to be concise and beginner-friendly.
  - **Target Practice Language**: Fixed to English (`"en"`) to preserve academic English speaking practice focus. Target structures, corrected phrases, examples, and reference models remain strictly in English. Stored session history, transcripts, and vocab lists are not retroactively translated.
- **User Leaderboard**: A privacy-first, user-only leaderboard ranking system.
  - Supports period filters: Daily, Weekly, Monthly, and All-time (default: Weekly).
  - Derived from valid XP events (no coins, energy, extra points, shop, or house systems). Duplicate-protected XP events (by owner, type, and source) do not double-count.
  - User-controlled visibility: only users with `leaderboard_opt_in = true` and greater than zero XP appear in public rankings.
  - Opted-out signed-in users can view their own private ranking stats and a simulated position (`previewRank`) while remaining hidden from the public leaderboard.
  - Prevents exposing private data: only safe public fields (rank, display name/initials fallback, avatar, level, period XP, and badges) are shown. No emails, user IDs, raw XP events, transcripts, vocabulary, AI corrections, URLs, or notes are exposed.
- **Learning Path (Phase 1 MVP)**: A local-first, static-curriculum guided journey (Beginner Confidence Ladder).
  - Features a 14-day progressive journey through Unit 1 (Introduce Yourself) and Unit 2 (My Daily Life) with a "Today's Mission" focus.
  - Safe, deterministic local progress and recommendation engine stored in `fonetik:learning-path-progress:v1` localStorage key.
  - Includes `Guided Word`, `Phrase Pattern`, `Sentence Builder`, and a basic simulated `Micro Speaking` lesson flow, wrapped in a generic `MicroLessonShell`.
  - Privacy-first: Stores only safe progress (card IDs, statuses, attempt counts, timestamps) locally. Never stores transcripts, recordings, raw usage, email, or owner IDs.
  - MVP limitations: No real speech/pronunciation scoring, no AI semantic grading, no adaptive AI planner, and no Supabase sync yet.
- **Feedback Normalization Engine (Foundation)**: A pure, side-effect-free helper pipeline that safely converts untrusted AI feedback signals into structured, normalized taxonomy categories (fluency, clarity, structure, grammar, vocabulary, reasoning, listening, academic_tone, confidence, engagement). It enforces strict privacy (stripping raw AI text and PII) and provides deterministic retry actions, safe summary aggregations, and Learning Path advisory hints, without modifying UI or storage yet.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Browser localStorage
- Web Speech API for browser speech-to-text
- Server-side API routes for Claude, DeepSeek, and Gemini

## Local Setup

```bash
cd app-web
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

For a beginner walkthrough, see [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

## Environment Variables

Provider keys are read only on the server from `app-web/.env.local`.

Copy the example file:

```bash
cd app-web
copy .env.example .env.local
```

On macOS or Linux:

```bash
cd app-web
cp .env.example .env.local
```

Use placeholders like these. Fill only the providers you plan to use:

```env
CLAUDE_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

# Optional Clerk auth shell. Leave blank for local-only use.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Optional Supabase client setup for session, vocabulary, and gamification cloud persistence.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`GEMINI_MODEL` is optional. If unset, the app uses its default Gemini model.
Clerk keys are optional for the current local MVP; when omitted, the app shows
Local mode and keeps using browser storage only.
Supabase keys are optional. When both Clerk and Supabase credentials are configured, the app best-effort writes newly completed normal sessions, vocabulary modifications (including user sentences and corrections), and gamification updates (XP profile, XP events, and badges) to Supabase (non-blocking, fallback-safe).
`SUPABASE_SERVICE_ROLE_KEY` is a server-only key used for administrative database operations (such as global AI response cache writes). It must never be prefixed with `NEXT_PUBLIC` or exposed client-side. If omitted, global cache writes are silently disabled.
Restart `npm run dev` after editing `.env.local`; environment variables are not
hot-reloaded.

## API Routes

- `POST /api/feedback`  
  Generates Quick Feedback, retry task, and level-specific scores.

- `POST /api/diagnostic`  
  Runs a diagnostic assessment and returns a recommended level, bottleneck,
  scores, and 7-day focus plan.

- `POST /api/weekly-review`  
  Reviews the latest 4 to 7 completed session summaries. It does not store the
  review result.

- `POST /api/mental-model`  
  Generates teaching guidance about response quality standards. It does not
  store the result and does not receive full transcripts.

- `POST /api/vocabulary-correction`  
  Checks a user's practice sentence for vocabulary naturalness, grammar correctness, and collocations.

- `POST /api/article-practice`  
  Extracts text from a URL and generates a structured, copyright-safe speaking task. Employs exact-match global response caching via Supabase to minimize AI provider costs. Records metadata-only AI usage events (estimated tokens, cost, status) for cost visibility.

- `GET /api/leaderboard`  
  Retrieves sanitized public rankings and optional current-user preview rank. Supports `period=daily|weekly|monthly|all-time` query parameters (default: weekly). The API route runs server-side and uses a privileged service-role client only for read/select operations. It does not mutate XP, profiles, or leaderboard data. It does not expose private learning data.

## Security Notes

- Keep provider keys in `app-web/.env.local`.
- Do not commit `.env.local`.
- Do not use `NEXT_PUBLIC_` for provider API keys.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is allowed for Clerk because it is a public browser key.
- Keep `CLERK_SECRET_KEY` server-side only.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is allowed for Supabase only with RLS enabled and tested.
- Never expose a Supabase service-role key, database password, or provider AI key to browser code.
- Clerk's native Supabase integration must be configured in Clerk and Supabase dashboards so RLS can compare `owner_id` with `auth.jwt()->>'sub'`.
- Do not put provider keys in browser code.
- Provider calls happen only in server-side API routes under `app-web/src/app/api/`.
- Session history, vocabulary, and gamification data are stored primarily in the user's browser, with newly completed normal sessions, vocabulary changes, and gamification updates best-effort copied to the cloud database.
- Profile and Settings views are owner-only. They do not create public profile pages, and never publish or render transcripts, retry transcripts, vocabulary sentence history, AI corrections, article URLs, weaknesses, retry tasks, CSV/session raw content, XP event source IDs, or private notes.
- Leaderboard Privacy: Only safe public fields (rank, display name or fallback, initials/avatar, level, period XP, and badge counts) are exposed. It does not expose emails, owner IDs, source IDs, raw XP events, transcripts, user sentences, AI corrections, article URLs, CSVs, weaknesses, retry tasks, or private notes. Only users who opt in via `leaderboard_opt_in = true` and have non-zero XP appear publicly. Signed-in opted-out users see their simulated position privately.
- Global cache writes are locked down: anonymous and public authenticated clients cannot perform `INSERT`, `UPDATE`, or `DELETE` operations on `global_ai_response_cache`. Write privileges are restricted to server-side code instantiating a client with `SUPABASE_SERVICE_ROLE_KEY`.
- AI usage logging (`ai_usage_events`) has RLS enabled with no public policies. Usage writes are server-only via service role. Usage rows store metadata only (feature, provider, model, prompt version, status, estimated tokens and cost). No raw article text, HTML, transcripts, user sentences, or personal content is stored.

## Current Limitations

- **Article Caching & Idempotency**: Caching is currently exact-match only (not semantic/vector-based yet). Global caching is currently limited to `/api/article-practice` only. Request idempotency is implemented for `/api/article-practice` using the `X-Fonetik-Idempotency-Key` header, caching request status and successful response JSON for 20 minutes (no raw article text/HTML stored). The cache key and idempotency request hash are language-aware and incorporate both `feedbackLanguage` and `targetLanguage` to prevent cross-language replays. In-progress requests are treated as misses to avoid blocking. Personal or semi-personal AI routes, including speaking feedback, diagnostics, weekly reviews, mental model outputs, vocabulary corrections, personal transcripts, and user sentences, are not globally cached or idempotent. Raw fetched HTML or extracted article bodies are never cached or persisted in the database.
- **AI Usage Ledger**: AI usage/cost tracking is currently scoped to `/api/article-practice` only. Token and cost values are estimates (chars / 4 for tokens; static price map for cost). Unknown model costs are recorded as null. Usage logging failure does not affect Article Practice behavior or API responses. Usage ledger rollout to personal routes and a user-facing usage UI are future work. This does not change API response shapes or app UI.
- **Hybrid local-first migration in progress**: Completed normal sessions, vocabulary changes, and gamification updates (XP profile, XP events, and badges) are best-effort written to Supabase when configured. It supports loading cloud snapshots for user-confirmed restore (for empty local browsers) and import (using conservative compatibility guards and XP deduplication). Browser `localStorage` remains the runtime source of truth, and no local data is cleared or deleted, nor is the cloud mutated during restore/import.
- **Profile, Settings & Localization**: The views are owner-only and store profile preferences (including display name, bio, public_profile_enabled, leaderboard_opt_in, preferredAppLanguage, feedbackLanguage, and targetLanguage) in Supabase when signed in. App Language and Feedback Language can be switched between English and Indonesian, but the target practice language is fixed to English only. Stored transcripts/history/vocabulary items are not retroactively translated when changing languages. public_profile_enabled defaults to false, and public profile pages are still future work. Full multi-target-language support is future work. Learning stats shown in the Profile view are local count summaries only, derived from the browser source of truth. Empty display name/bio normalization is a minor polish item for a later pass.
- **Leaderboard Scope**: The User Leaderboard is user-only (no house system, coins, energy, shop, or extra points). Public profiles are not yet implemented. Future work may include deeper profile redesign and leaderboard polish. No XP rules were changed.
- LocalStorage remains the runtime source of truth for all app data.
- XP rules remain local and deterministic, and cloud write failures do not affect local XP behavior or progression.
- Session history is local to the browser and capped by the app.
- Browser speech-to-text depends on browser support. If unsupported, users can type or paste transcripts.
- Deep Feedback is visible as a setup option but currently routes through the Quick Feedback flow.
- Diagnostic Mode does not create Retry, CSV, or localStorage history entries.
- Weekly Review and Mental Model results are shown in the UI but not persisted.
- Retry transcripts are saved in the session summary, but there is no second AI feedback pass on retry yet.
- Article Practice results are stored in React state only (no article history or full article body storage yet).
- No save-all vocabulary button (words must be saved individually).
- No article-specific CSV fields or feedback context.
- Vocabulary Notebook 2.0 limitations:
  - No advanced Active Recall Practice algorithm (uses a simple recency-based prioritization).
  - No bulk AI classification or automatic tagging of vocabulary.
  - No automated "Generate Sentence" or auto-answer templates (users must write their own sentences).
  - No pronunciation scoring or audio recording exports yet.

## Roadmap

- Dedicated Deep Feedback mode
- Optional persisted review history
- Stronger browser QA coverage
- Import/export tools for local practice history
- Optional auth, database, or cloud sync in a later product phase

## Project Layout

```text
adaptive-academic-speaking-app/
├── app-web/
│   ├── src/app/page.tsx
│   ├── src/app/components/
│   ├── src/app/lib/
│   ├── src/app/api/feedback/
│   ├── src/app/api/diagnostic/
│   ├── src/app/api/weekly-review/
│   ├── src/app/api/mental-model/
│   ├── .env.example
│   └── package.json
├── supabase/
│   └── migrations/
│       └── 20260527_001_initial_schema.sql
├── docs/
│   ├── SETUP_GUIDE.md
│   ├── MVP_TEST_CHECKLIST.md
│   └── PROJECT_CONTEXT.md
└── README.md
```
