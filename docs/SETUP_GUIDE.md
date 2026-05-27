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
```

You only need one provider key to test AI features. Leave providers you do not use blank. Always restart the dev server after editing `.env.local` for the changes to take effect.

Clerk keys are optional for the current MVP. If you leave them blank, fonetik runs in Local mode and keeps using browser localStorage only.

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
- Provider keys stay server-side in Next.js API routes.
- The app stores session history in browser localStorage, not in a cloud database.
