# Setup Guide

A step-by-step walkthrough for getting the Adaptive Academic Speaking App
running on your own machine. Aimed at first-time setup.

## 1. Install Node.js LTS

Download and install the current LTS version from https://nodejs.org/. After
installation, open a new terminal and verify:

```bash
node --version
npm --version
```

Both commands should print a version number. If they don't, restart the
terminal (or your machine) and try again.

## 2. Open the project

Open the project folder (`adaptive-academic-speaking-app`) in your editor:

- **VS Code**: File → Open Folder → select the folder.
- **Kiro**: File → Open Folder → select the folder.

You should see `app-web/`, `docs/`, and `README.md` at the top level.

## 3. Move into the `app-web` folder

All commands below assume you are inside `app-web`. Open a terminal at the
project root and run:

```bash
cd app-web
```

## 4. Install dependencies

```bash
npm install
```

This downloads everything listed in `app-web/package.json` into
`app-web/node_modules`. It only needs to run once, or whenever dependencies
change.

## 5. Create `.env.local`

The app reads API keys from environment variables. Copy the example file:

```bash
# Windows (cmd)
copy .env.example .env.local

# macOS / Linux
cp .env.example .env.local
```

Open `app-web/.env.local` in your editor and fill the keys for the providers
you want to use. Leave the others blank.

```env
CLAUDE_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

You only need one key to use the app. Pick the provider you have access to.

## 6. Add a Gemini API key (example)

If you don't already have one:

1. Go to https://aistudio.google.com/app/apikey.
2. Sign in with your Google account.
3. Click **Create API key** and copy the value (starts with `AIza`).
4. Paste it into `app-web/.env.local`:

   ```env
   GEMINI_API_KEY=AIza...your-key...
   GEMINI_MODEL=gemini-2.0-flash
   ```

5. Save the file.

The same general flow works for Claude (https://console.anthropic.com/) and
DeepSeek (https://platform.deepseek.com/). Use the variable name that matches
your provider.

## 7. Run the dev server

From inside `app-web`:

```bash
npm run dev
```

You should see output similar to:

```
- Local:        http://localhost:3000
- Ready in ...
```

Open http://localhost:3000 in your browser.

If you change `.env.local` later, **stop and restart** `npm run dev`.
Environment variables are not hot-reloaded.

## 8. Test the app

A short manual run-through:

1. Pick a Level, Mode, Feedback Type, Session Type, and AI Provider.
2. Optionally type a Today's Target. Click **Start Session**.
3. Click **Start Timer** and speak (or just watch the clock advance).
4. Type or paste your transcript and click **Submit Attempt**.
5. Click **Get AI Feedback**. The Quick Feedback panel should appear.
6. Type a retry transcript and click **Submit Retry**.
7. Click **End Session**. The CSV row appears. Click **Copy CSV** to verify.
8. Reload the page. The Recent Sessions panel and Previous Weakness panel
   should still show your last session.

For the full checklist see [`MVP_TEST_CHECKLIST.md`](MVP_TEST_CHECKLIST.md).

## 9. Common errors

### `npm run dev` fails with `ENOENT package.json`

You're in the wrong folder. Run `cd app-web` first.

### Error banner: `Missing API key for selected provider. Add it to .env.local.`

Either no key is set for the selected provider, or `.env.local` was edited
without restarting the dev server. Stop the server (Ctrl+C), confirm the key
is in `app-web/.env.local`, then run `npm run dev` again.

### Error banner: `Gemini model not available. Check GEMINI_MODEL in .env.local.`

The model name in `GEMINI_MODEL` is not enabled for your key, or it's
misspelled. Try `gemini-2.0-flash` or `gemini-1.5-flash-latest`. To list models
your key can use:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"
```

Restart the dev server after editing `.env.local`.

### `.env.local` is set but the app still says the key is missing

This almost always means the dev server was not restarted after the file was
saved. Stop with Ctrl+C, run `npm run dev` again. Confirm the file is named
exactly `.env.local` (not `.env.local.txt`) and that it lives in
`app-web/.env.local`, not the project root.

### Port 3000 is already in use

Another `next dev` is probably still running. Either close that terminal, or
let Next.js pick the next free port (it usually offers `3001`).

### PowerShell refuses to run `npm` with a script policy error

Run npm via `cmd` instead:

```bash
cmd /c npm run dev
```

Or change PowerShell execution policy for the current user (one time):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
