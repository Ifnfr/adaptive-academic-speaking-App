# fonetik Setup Guide

This guide walks through running fonetik locally for the first time.

Product name: **fonetik**  
Tagline: **Speak Better**  
Description: **AI-Powered academic speaking practice**

## 1. Install Node.js

Install the current Node.js LTS version from:

```text
https://nodejs.org/
```

Open a new terminal and check:

```bash
node --version
npm --version
```

Both commands should print version numbers.

## 2. Open the Project

Open the repository folder:

```text
adaptive-academic-speaking-app
```

You should see:

- `app-web/`
- `docs/`
- `README.md`

The app itself lives in `app-web`.

## 3. Install Dependencies

From the project root:

```bash
cd app-web
npm install
```

This creates `app-web/node_modules/`.

## 4. Create `.env.local`

Still inside `app-web`, copy the example env file.

Windows cmd:

```bash
copy .env.example .env.local
```

macOS or Linux:

```bash
cp .env.example .env.local
```

Open `app-web/.env.local` and add the provider keys you have. Provider keys remain strictly server-side in Next.js API routes; browser code never accesses Claude, DeepSeek, or Gemini keys directly.

Features like Quick Feedback, Diagnostic Mode, Weekly Review, Mental Model, Vocabulary Correction, and Article Practice require at least one active provider key.

Use placeholders like this:

```env
CLAUDE_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# Optional Clerk auth shell. Leave blank for local-only use.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Optional Supabase client setup for session, vocabulary, and gamification cloud persistence.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

You only need one provider key to test AI features. Leave providers you do not use blank. Always restart the dev server after editing `.env.local` for the changes to take effect.

Clerk keys are optional for the current MVP. If you leave them blank, fonetik runs in Local mode and keeps using browser localStorage only.

Supabase keys are optional. When both Clerk and Supabase credentials are configured, the app best-effort writes newly completed normal sessions, vocabulary modifications (including sentences and corrections), and gamification updates (XP profile, events, and badges) to Supabase. It also supports reading cloud snapshots for user-confirmed restore (when local is empty) and import (using conservative compatibility guards when local data exists). Browser localStorage remains the runtime source of truth, and no local data is cleared or deleted during these actions.
With Clerk and Supabase configured, signed-in users also get the owner-only Profile and Settings views. Profile preferences are separate from learning data: the UI can save and persist display name, bio, public profile enabled, leaderboard opt-in, preferredAppLanguage, feedbackLanguage, and targetLanguage, while localStorage remains the source of truth for learning stats. Public profiles are not implemented yet (privacy toggles default off), but the User Leaderboard is fully implemented as an MVP feature. App/Feedback language selectors support English and Indonesian.
`SUPABASE_SERVICE_ROLE_KEY` is a server-only service role key used for administrative actions (global AI response cache writes, AI usage event logging, AI request idempotency registry writes, and server-side leaderboard aggregation read/select requests). It must never be prefixed with `NEXT_PUBLIC` or exposed client-side. If omitted, global cache writes, usage logging, request idempotency, and leaderboard aggregation are silently disabled.

Do not use real keys in documentation, screenshots, commits, or issue reports.

## 5. Run the App

From inside `app-web`:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If you edit `.env.local`, stop the dev server with `Ctrl+C`, then run
`npm run dev` again.

## 6. Turbopack or Cache Fallback

If the dev server has Turbopack/cache problems, try:

```bash
npm run dev -- --webpack
```

If the problem continues, stop the server, remove the generated `.next` cache,
and start again. Do not commit `.next`.

## 7. Quick Smoke Test

1. Choose a Level, Mode, Feedback Type, Session Type, and AI Provider.
2. Add a short Today's Target.
3. Click **Start Session**.
4. Use the local Speaking Prompt.
5. Start the timer, speak, then type or use browser speech-to-text.
6. Submit the attempt.
7. Click **Get AI Feedback**.
8. Submit a Retry.
9. End the session and copy the CSV.
10. Open Session Log and confirm the session appears.
11. Open Profile or Settings and confirm local-only mode shows a local profile card or progress details.
12. Navigate to **Learning Path** in the sidebar.
13. Ensure **Unit 1** and **Today's Mission** are visible.
14. Complete a Phase 1 card (e.g. Guided Word or Phrase Pattern) and verify that local progress persists and the recommendation advances to the next card. (Note: Learning Path progress is entirely local and does not sync to Supabase in the MVP. Local storage key: `fonetik:learning-path-progress:v1`).

For the full QA list, see [MVP_TEST_CHECKLIST.md](MVP_TEST_CHECKLIST.md).

## Common Errors

### Missing API key

Message:

```text
Missing API key for selected provider. Add it to .env.local.
```

Check:

- The selected provider has a key in `app-web/.env.local`.
- The file is named exactly `.env.local`.
- The file is inside `app-web`, not the project root.
- The dev server was restarted after editing `.env.local`.

### Provider model unavailable

Message:

```text
Gemini model not available. Check GEMINI_MODEL in .env.local.
```

Check:

- `GEMINI_MODEL` is spelled correctly.
- Your key has access to that model.
- The dev server was restarted after changing `.env.local`.

You can leave `GEMINI_MODEL` as the documented placeholder unless you know you
need a different model.

### Gemini output truncation or incomplete JSON responses

If Gemini responses are cut off or incomplete during Article Practice generation:
- The backend API route `/api/article-practice` is configured with a high output budget (`maxOutputTokens: 8192`) and thinking is disabled if supported to prevent truncation issues.
- If you still experience issues, check that your API key is active and try regenerating, or try switching provider if you have Claude or DeepSeek keys.

### Port 3000 already used

Another dev server may already be running.

Options:

- Stop the other server with `Ctrl+C`.
- Use the alternate port that Next.js offers.
- Start manually on another port:

```bash
npm run dev -- -p 3001
```

### `.next` cache or OneDrive issues

If the app behaves strangely, especially inside OneDrive folders:

1. Stop the dev server.
2. Delete `app-web/.next`.
3. Run `npm run dev` again.
4. If needed, try `npm run dev -- --webpack`.

Do not commit `.next`.

### PowerShell execution policy

If PowerShell blocks npm or npx scripts, use the `.cmd` shims:

```powershell
npm.cmd run dev
npm.cmd install
npx.cmd tsc --noEmit
```

You can also run through cmd:

```bash
cmd /c npm run dev
```

### Browser speech input unavailable

Speech input depends on the browser. If the browser does not support it, fonetik
shows a safe fallback message and you can type or paste the transcript manually.

## Security Reminders

- Do not commit `.env.local`.
- Do not share real API keys in screenshots.
- Do not add Claude, DeepSeek, or Gemini provider keys with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is allowed for Clerk because it is public by design.
- Keep `CLERK_SECRET_KEY` server-side only.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is allowed for Supabase only with RLS enabled and tested.
- Never expose a Supabase service-role key or database password in browser code.
- Enable Clerk's native Supabase integration in the Clerk and Supabase dashboards before future cloud persistence work.
- Provider keys stay server-side in Next.js API routes.
- The app stores session history, vocabulary, and gamification data primarily in browser localStorage.
- Profile and Settings views are owner-only. They are not public profile pages. The User Leaderboard displays sanitized details only, and Settings does not publish or leak transcripts, retry transcripts, vocabulary sentence history, AI corrections, article URLs, weaknesses, retry tasks, CSV/session raw content, XP event source IDs, or private notes.
- Leaderboard Privacy: Only public safe fields (rank, display name or safe initials/fallback, avatar/initials, level, period XP, badge counts) are visible. No private learning data or identifiers are exposed. Opted-out users are hidden publicly but can view their simulated position privately.
- The API route runs server-side and uses a privileged service-role client only for read/select operations. It does not mutate XP, profiles, or leaderboard data.
- Do not add real database credentials to Supabase migration files.
- **Feedback Normalization Engine**: (Foundation only) Operates purely in memory as a stateless helper pipeline to sanitize AI output into a safe taxonomy. It does not integrate with UI or storage yet and never persists or leaks transcripts or raw AI text.

## Supabase Schema & Hybrid Cloud Status

The `supabase/migrations/` folder contains Postgres schema and Row Level Security
(RLS) policy SQL files.

Current status:

- Best-effort cloud session, vocabulary, and gamification writing is active: completed normal sessions, vocabulary changes (items, user sentences, and corrections), and gamification updates (XP profile, events, and badges) are upserted to Supabase on the client when the user is signed in and Supabase environment variables are present.
- Browser `localStorage` remains the runtime source of truth. Users can load cloud snapshot previews and trigger manual user-confirmed restore or import actions, but the app does not run automatic background syncs, nor does it automatically clear local data.
- Profile and Settings views use the profile row for signed-in account/preferences only. Email is shown as private/account-only, privacy toggles default off, language preferences allow selecting App Language (English/Indonesian) and Feedback Language (English/Indonesian), and learning stats are local count summaries. Stored history is not retroactively translated when changing languages. leaderboard_opt_in defaults to false and controls whether the user is shown publicly on the User Leaderboard.
- The User Leaderboard runs server-side queries on profiles and XP events, filtering out users with zero XP or opted-out profiles, sorting by total valid XP per selected period. No coins, energy, shop, or house systems are used. No XP rules were changed.
- The migration files define tables, RLS policies, indexes, and triggers.
- RLS policies expect the Clerk JWT subject (`auth.jwt()->>'sub'`) as the owner.

To apply these migrations later, you will need a Supabase project and the
Supabase CLI:

```bash
supabase db push
```

Do not run this command until the app-side integration is ready.
