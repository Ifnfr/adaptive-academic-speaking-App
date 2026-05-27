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

## API Routes

- `/api/feedback` (session feedback)
- `/api/diagnostic` (diagnostic tests)
- `/api/weekly-review` (session trend review)
- `/api/mental-model` (micro drills & quality criteria)
- `/api/vocabulary-correction` (vocabulary usage feedback)
- `/api/article-practice` (URL text processing & prompt generation)

## Local Data

- Stored entirely in browser `localStorage`.
- Storage keys:
  - `adaptive-speaking-app:sessions` (practice session log)
  - `adaptive-speaking-app:vocabulary` (notebook words & usage history)
  - `adaptive-speaking-app:xp-profile` (total/pending/streak gamification status)
  - `adaptive-speaking-app:xp-events` (history of XP events for caps & diagnostics)
  - `adaptive-speaking-app:badges` (locked/earned badge lists)
- There is no database, auth system, or cloud sync in the current local-first MVP.

## Not In Current MVP

- Authentication (Supabase / Clerk)
- Database or cloud sync (stored strictly in local browser `localStorage`)
- Deployment workflow
- Mobile app
- Dedicated Deep Feedback mode (currently routes to Quick Feedback)
- Advanced RAG or vector database search
- Persisted Weekly Review or Mental Model history
- Pronunciation scoring or audio recording exports
- Article Practice history or article-specific metadata in CSV
- Advanced spaced repetition algorithm (uses simple recency/underuse queue prioritizer instead)
- Bulk AI classification or tagging of vocabulary items
- Automated "Generate Sentence" or auto-answer templates (users must supply original sentences)

## Working Notes

- API keys belong only in `app-web/.env.local`.
- Provider keys must not use `NEXT_PUBLIC_`.
- `.env.local`, `.next`, and `node_modules` should not be committed.
