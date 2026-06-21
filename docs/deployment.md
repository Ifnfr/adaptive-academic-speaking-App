# Deployment Guide

## Project Overview

Fonetik, also called the Adaptive Academic Speaking App, is an academic English practice app. The core learning loop is:

Article or Markdown Context -> Reading -> Writing -> Podchat -> Evaluation -> Memory -> Weekly Review.

Production URL:

```text
https://adaptive-academic-speaking-app.vercel.app/
```

## Vercel Project

- Platform: Vercel
- Project: `adaptive-academic-speaking-app`
- Root Directory: `app-web`
- Framework: Next.js
- Build command: Vercel default for Next.js, usually `npm run build` or `next build`
- Current important deployment status: Production works, and `ARTICLE_AI_PROVIDER=mock` is active in Production.

After any Vercel environment variable change, redeploy Production or the runtime will continue using the previous environment.

## Required Environment Variables

Use placeholders only in docs and examples. Do not print or commit real values.

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Mock and preview-safe QA:

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

Do not use `NEXT_PUBLIC_` for server secrets. `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, and provider keys must stay server-side.

## Deployment Checklist

1. Confirm the worktree is clean:

   ```cmd
   git status --short --untracked-files=all
   ```

2. Confirm the branch and latest commit are intended for deploy.

3. Confirm Vercel Root Directory is `app-web`.

4. Confirm required Clerk and Supabase environment variables are present in the target Vercel environment without printing values.

5. For safe mock runtime, confirm:

   ```env
   ARTICLE_AI_PROVIDER=mock
   PODCHAT_AI_PROVIDER=mock
   PODCHAT_STT_PROVIDER=mock
   ```

6. Redeploy after environment changes.

7. Inspect deployment output for:

   - `Proxy (Middleware)`
   - `/api/article-practice`
   - `/api/article-essay-evaluate`
   - `/api/podchat/evaluate`
   - `/api/weekly-review`

## Clerk Auth and Middleware

API routes that save memory depend on Clerk server auth. The project uses `app-web/src/middleware.ts` with Clerk middleware. The matcher must cover API routes, including article, Podchat, and weekly review routes.

If middleware is missing or does not cover API routes, `auth()` can return null in server routes and responses may show `memory.saved=false` even when the user appears signed in.

The Clerk middleware fix was added in the commit named:

```text
Fix Clerk middleware for memory routes
```

## Mock Modes

`ARTICLE_AI_PROVIDER=mock` enables:

- `POST /api/article-practice` deterministic mock article practice
- `POST /api/article-essay-evaluate` deterministic mock writing feedback
- no Claude/Gemini/DeepSeek keys required for article QA

`PODCHAT_AI_PROVIDER=mock` and `PODCHAT_STT_PROVIDER=mock` enable Podchat QA without real AI or speech-to-text providers.

When mock is disabled, the matching real provider keys are required and must be QA-tested separately.

## Current Known Deployment Limitations

- Authenticated Article Writing memory save still needs real signed-in browser/session verification.
- Authenticated Podchat memory runtime still needs confirmation unless a manual flow verifies `/api/podchat/evaluate`.
- Preview `ARTICLE_AI_PROVIDER` may not be independently confirmed.
- Real provider keys are unavailable in current QA context.
- Article and Podchat real-provider flows need future QA.
