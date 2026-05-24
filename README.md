# Adaptive Academic Speaking App

A personal AI-powered deliberate speaking practice web app.

The app runs entirely on your machine. There is no backend database, no auth,
and no cloud sync. Sessions are saved in your browser's localStorage. AI
feedback is requested through a Next.js API route on the server side, so your
provider keys never reach the browser.

## MVP features

- Session setup (level, mode, feedback type, session type, AI provider, today's target)
- Manual transcript input
- Timer (start, stop, reset)
- AI Quick Feedback (one main weakness, one piece of evidence, a stronger phrase, and a retry task)
- Retry loop (the user must retry after feedback)
- CSV generation per session
- localStorage history (latest 20 sessions, newest first)
- Weakness activation (last session's retry task auto-fills the next session's target)
- Multi-provider support: Claude, DeepSeek, Gemini

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- localStorage
- Claude API
- DeepSeek API
- Gemini API

## How to run locally

```bash
cd app-web
npm install
npm run dev
```

Then open http://localhost:3000.

For a longer beginner walkthrough, see [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

## Environment variables

The API route reads provider keys from environment variables on the server.
Copy the example file and fill only the providers you actually plan to use.

```bash
cd app-web
copy .env.example .env.local      # Windows cmd
# or
cp .env.example .env.local         # macOS / Linux
```

Open `app-web/.env.local` and set the keys you have:

```env
CLAUDE_API_KEY=
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

`GEMINI_MODEL` is optional. If unset, the app defaults to `gemini-2.0-flash`.
You can change it to any Gemini model your key can access (for example
`gemini-2.5-flash` or `gemini-1.5-flash-latest`).

Restart `npm run dev` after editing `.env.local` so the server picks up the
new values. Environment variables are not hot-reloaded.

## Security notes

- Never commit `.env.local`. The Next.js default `.gitignore` already excludes it.
- Never expose API keys in client code. Provider calls happen only inside `app-web/src/app/api/feedback/route.ts`.
- Do not prefix provider keys with `NEXT_PUBLIC_`. That prefix would expose them to the browser.
- Treat the values you paste in `.env.local` as secrets. Rotate them if you suspect a leak.

## MVP limitations

- No Web Speech API yet (transcripts are typed or pasted)
- No audio recording yet
- No cloud database yet (history lives in localStorage only)
- No authentication yet
- Placeholder scores in the CSV are temporary; automatic scoring is not implemented
- Manual transcript input only
- One feedback round per attempt; no second feedback on retry yet

## Project layout

```
adaptive-academic-speaking-app/
├── app-web/                      # Next.js app
│   ├── src/app/page.tsx          # Single-page UI
│   ├── src/app/api/feedback/     # Server-side AI feedback route
│   ├── .env.example              # Copy to .env.local and fill
│   └── package.json
├── docs/
│   ├── SETUP_GUIDE.md            # Step-by-step beginner setup
│   └── MVP_TEST_CHECKLIST.md     # Manual test checklist
└── README.md                     # This file
```
