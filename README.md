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

# Optional Supabase client setup for session cloud persistence.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`GEMINI_MODEL` is optional. If unset, the app uses its default Gemini model.
Clerk keys are optional for the current local MVP; when omitted, the app shows
Local mode and keeps using browser storage only.
Supabase keys are optional. When both Clerk and Supabase credentials are configured, the app best-effort writes newly completed normal sessions and vocabulary modifications (including user sentences and corrections) to Supabase (non-blocking, fallback-safe).
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
  Extracts text from a URL and generates a structured, copyright-safe speaking task.

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
- Session history and vocabulary are stored primarily in the user's browser, with newly completed normal sessions and vocabulary changes best-effort copied to the cloud database.

## Current Limitations

- **Hybrid local-first migration in progress**: Completed normal sessions and vocabulary changes are best-effort written to Supabase as a non-blocking cloud save, but the app does NOT load sessions or vocabulary from the cloud yet, nor does it import/sync existing local history, handle merge conflicts, or clear local storage.
- LocalStorage remains the runtime source of truth for all app data.
- XP gamification data utilizes `localStorage` only.
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
  - No advanced spaced repetition algorithm (uses a simple recency-based prioritization).
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
