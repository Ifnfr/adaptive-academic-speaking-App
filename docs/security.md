# Security and Privacy Notes

## Secrets

Never commit `.env.local` or any real environment values. Never put real keys in `.env.example`, README files, issues, PR descriptions, logs, screenshots, or chat output.

Server-only secrets must not use `NEXT_PUBLIC_`:

- `CLERK_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLAUDE_API_KEY`
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `DEEPGRAM_API_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Public variables may use `NEXT_PUBLIC_` only when they are intended for the browser:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Vercel environment variable changes require a redeploy before the runtime sees them.

## Supabase Memory

Memory writes are server-side only. Do not add client-side Supabase writes for Article Writing, Podchat, Weekly Review, or learner error pattern storage.

Important tables:

- `podchat_sessions`
- `podchat_turns`
- `article_writing_sessions`
- `article_writing_answers`
- `learner_error_patterns`
- `weekly_reviews`

RLS is enabled. Memory rows use:

```text
owner_id = Clerk user id
```

Do not store:

- raw audio
- audio blobs
- recording URLs
- raw STT/TTS payloads
- raw provider payloads
- raw markdown
- full article text
- source URL by default
- API keys
- auth metadata from request bodies
- storage paths
- biometric, diarization, phoneme, or pronunciation data

Article Writing memory should store compact `article_context` only: title, brief, main idea, and key points.

## Clerk Auth and API Routes

API routes that save memory depend on Clerk server auth. The middleware/proxy must exist and cover API routes. If it does not, `auth()` can return null and the route can still return successful feedback with:

```json
{ "memory": { "saved": false } }
```

That is not a successful memory runtime verification.

## Provider Safety

Mock provider modes are the safest QA path:

```env
ARTICLE_AI_PROVIDER=mock
PODCHAT_AI_PROVIDER=mock
PODCHAT_STT_PROVIDER=mock
```

With mock enabled, Article Practice, Article Essay Evaluation, and Podchat mock flows should not require Claude, Gemini, DeepSeek, Deepgram, Polly, or ElevenLabs calls.

When mock is disabled, provider-specific QA is required before claiming production readiness.

## Runtime Evidence Rules

Do not overclaim runtime verification.

Acceptable evidence:

- browser Network response from a signed-in session
- sanitized Vercel route status/log evidence
- Supabase read-only row inspection
- route response shape that excludes secrets and raw provider payloads

Not sufficient for authenticated memory success:

- unauthenticated API probes
- UI visible sign-in without Network evidence
- logs showing only HTTP 200
- local unit tests alone

## Agent Operating Rules

- Do not commit or push without explicit user approval.
- Do not modify unrelated files.
- Do not run full E2E by default.
- Do not expose secrets, cookies, tokens, auth headers, or env values.
- Do not print private user email or real user IDs.
- Do not alter Supabase schema or RLS unless explicitly requested.
- Do not insert, update, or delete database rows unless cleanup is explicitly approved and scoped.
- Do not restore localStorage as a source of truth for Weekly Review.
- Do not add client-side Supabase memory writes.
- Report final git status.
