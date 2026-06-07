# Fonetik App Setup

Fonetik is the main Next.js app for the Adaptive Academic Speaking App. It helps learners move through a compact academic practice loop:

Article or Markdown Context -> Reading -> Writing -> Podchat -> Evaluation -> Memory -> Weekly Review.

The production app is deployed on Vercel at:

```text
https://adaptive-academic-speaking-app.vercel.app/
```

## Tech Stack

- Next.js App Router
- TypeScript
- Clerk for authentication
- Supabase for memory and persistence
- Vercel for hosting
- Playwright for targeted validation
- Mock provider modes for safe QA without real AI provider keys

## Local Development

```cmd
cd app-web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Run targeted local checks from `app-web`:

```cmd
npm.cmd run lint
npx.cmd tsc --noEmit
```

From the repository root, also run:

```cmd
git diff --check
git status --short --untracked-files=all
```

## Environment Variables

Use `app-web/.env.local` for local secrets. Never commit `.env.local`, and never put real keys in `.env.example`.

Required for authenticated memory runtime:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Mock and preview-safe modes:

```env
PODCHAT_AI_PROVIDER=mock
PODCHAT_STT_PROVIDER=mock
ARTICLE_AI_PROVIDER=mock
```

Optional real providers:

```env
CLAUDE_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
DEEPGRAM_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
POLLY_VOICE_ID=Brian
POLLY_ENGINE=neural
```

Server secrets must not use `NEXT_PUBLIC_`. Vercel environment changes require a redeploy before the runtime sees them.

## Repository Structure

- `src/app`: App Router pages, shell, and API routes.
- `src/app/api`: Server routes for article practice, article essay evaluation, Podchat, weekly review, provider status, and related features.
- `src/app/components`: UI components and feature views.
- `src/app/lib/storage`: Supabase adapters and privacy-aware memory write helpers.
- `tests`: Targeted Playwright route and UI tests.
- `../supabase`: Supabase migrations and schema history.
- `../docs`: Deployment, runtime QA, security, and project context docs.

## Mock Modes

`ARTICLE_AI_PROVIDER=mock` makes Article Practice and Article Essay Evaluation return deterministic mock responses without Claude, Gemini, or DeepSeek keys.

`PODCHAT_AI_PROVIDER=mock` and `PODCHAT_STT_PROVIDER=mock` support Podchat QA without real AI/STT providers.

If mock modes are disabled, the relevant provider keys must be present and future runtime QA must confirm real provider behavior.

## Memory Runtime

Supabase memory writes are server-side only. Client-side Supabase writes must not be added for memory flows.

Important memory tables:

- `podchat_sessions`
- `podchat_turns`
- `article_writing_sessions`
- `article_writing_answers`
- `learner_error_patterns`
- `weekly_reviews`

Rows use `owner_id` from the Clerk user id. Do not store raw audio, raw provider payloads, raw markdown, full article text, source URLs by default, API keys, request auth metadata, or storage paths.

## Validation Policy

Use targeted validation instead of full E2E by default:

```cmd
npm.cmd run lint
npx.cmd tsc --noEmit
git diff --check
```

Targeted examples:

```cmd
npx.cmd playwright test tests/mvp-smoke.spec.ts --reporter=line --workers=1
npx.cmd playwright test tests/article-practice-language.spec.ts --reporter=line --workers=1
npx.cmd playwright test tests/article-essay-evaluate.spec.ts --reporter=line --workers=1
npx.cmd playwright test tests/ai-review-language.spec.ts --reporter=line --workers=1
```

Use `--workers=1` to reduce heat. Run full E2E only for major milestones or app-wide changes. On Windows, Playwright can occasionally hang during teardown; when a dev server is already running, `PLAYWRIGHT_SKIP_WEB_SERVER=1` can avoid duplicate server startup.

## More Docs

- Deployment: `../docs/deployment.md`
- Runtime QA: `../docs/runtime-qa.md`
- Security: `../docs/security.md`
