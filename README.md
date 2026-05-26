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
- **Vocabulary Notebook**: Save academic vocabulary items manually or from articles, track status, level, source, and reuse counts. Complete sentence practice and run AI-based usage corrections (`/api/vocabulary-correction`) to check naturalness/correctness (incrementing `correctUseCount` once per sentence).
- **Gamification Engine**: Local XP tracking based on `XP_RULES`. Award pending daily XP for completing sessions, diagnostic tests, weekly reviews, mental models, level-ups, vocabulary sentence practice, and article practice, with a daily claim mechanism and capped limits.
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
```

`GEMINI_MODEL` is optional. If unset, the app uses its default Gemini model.
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
- Do not put provider keys in browser code.
- Provider calls happen only in server-side API routes under `app-web/src/app/api/`.
- Session history is stored locally in the user's browser, not in a database.

## Current Limitations

- No authentication.
- No database, cloud sync, or deployment workflow (Clerk / Supabase are not used).
- Session history is local to the browser and capped by the app.
- Browser speech-to-text depends on browser support. If unsupported, users can type or paste transcripts.
- Deep Feedback is visible as a setup option but currently routes through the Quick Feedback flow.
- Diagnostic Mode does not create Retry, CSV, or localStorage history entries.
- Weekly Review and Mental Model results are shown in the UI but not persisted.
- Retry transcripts are saved in the session summary, but there is no second AI feedback pass on retry yet.
- Article Practice results are stored in React state only (no article history or full article body storage yet).
- No save-all vocabulary button (words must be saved individually).
- No article-specific CSV fields or feedback context.

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
├── docs/
│   ├── SETUP_GUIDE.md
│   ├── MVP_TEST_CHECKLIST.md
│   └── PROJECT_CONTEXT.md
└── README.md
```
