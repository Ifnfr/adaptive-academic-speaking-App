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

- Light fonetik dashboard UI
- Sidebar navigation and topbar status
- Active Session and Session Setup
- Mode cards and level selection
- Browser speech-to-text and manual transcript input
- Local Speaking Prompt generation
- AI Feedback with level-specific scores
- Retry Loop
- End Session CSV and Copy CSV
- Session Log and Copy Last CSV
- Progress view and Day Streak
- Local Level-Up Check
- Diagnostic Mode and Diagnostic Result
- Weekly Review Agent
- Mental Model Session
- Friendly provider errors
- Foundation-level calibration for AI outputs
- Robust JSON parsing for Weekly Review and Mental Model

## API Routes

- `/api/feedback`
- `/api/diagnostic`
- `/api/weekly-review`
- `/api/mental-model`

## Local Data

- Session history is stored in browser localStorage.
- The localStorage key is `adaptive-speaking-app:sessions`.
- There is no database, auth system, or cloud sync in the current MVP.

## Not In Current MVP

- Authentication
- Database or cloud sync
- Deployment workflow
- Mobile app
- Article Practice
- Dedicated Deep Feedback mode
- Advanced RAG
- Persisted Weekly Review or Mental Model history

## Working Notes

- API keys belong only in `app-web/.env.local`.
- Provider keys must not use `NEXT_PUBLIC_`.
- `.env.local`, `.next`, and `node_modules` should not be committed.
- Article Practice is planned future work, not an implemented feature.
