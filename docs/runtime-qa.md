# Runtime QA Guide

Runtime QA verifies deployed behavior with real browser and production route evidence. Do not overclaim runtime verification when the browser, login session, or network evidence is unavailable.

## Article Mock QA

Production currently uses `ARTICLE_AI_PROVIDER=mock`.

Check:

- `POST /api/article-practice` returns HTTP 200.
- Response has `essayQuestions` exactly 5.
- Response includes `speakingTask`.
- `POST /api/article-essay-evaluate` returns HTTP 200.
- Response includes overall feedback, per-question feedback, recurring errors, improved examples, and next writing focus.
- No Claude, Gemini, or DeepSeek call is required.
- Provider keys are not required.

Safe probe pattern: use a valid request with `provider: "Claude"` only when Claude is known to be unconfigured. A successful mock response proves the route bypassed the real provider.

## Authenticated Article Memory QA

This must be done with a real signed-in browser session.

Flow:

1. Open `https://adaptive-academic-speaking-app.vercel.app/`.
2. Sign in with a dev or dedicated QA account.
3. Open Article Practice.
4. Use Prepared Markdown Context mode.
5. Generate Article Practice.
6. Confirm article brief, main idea, key points, vocabulary, exactly 5 essay questions, and speaking task render.
7. Fill all 5 Article Writing answers.
8. Submit Article Writing Evaluation.
9. Inspect browser Network for `POST /api/article-essay-evaluate`.
10. Confirm HTTP 200 and `memory.saved=true`.
11. Use Supabase read-only inspection to confirm rows.

Supabase rows expected:

- 1 latest `article_writing_sessions` row for the authenticated owner.
- Exactly 5 linked `article_writing_answers` rows.
- `learner_error_patterns` rows if recurring errors were returned.

If agent browser automation cannot attach or sign in, report Article memory runtime as not verified. Do not fake success with unauthenticated API calls.

If `memory.saved=false`, inspect sanitized Vercel logs and classify the likely cause:

- auth userId missing
- Supabase env missing
- Supabase insert failed
- helper validation failed
- unknown

## Podchat Memory QA

Podchat mock QA can use:

```env
PODCHAT_AI_PROVIDER=mock
PODCHAT_STT_PROVIDER=mock
```

Manual flow:

1. Open Podchat while signed in.
2. Start a session.
3. Start Recording.
4. Stop Recording.
5. Confirm mock STT creates transcript.
6. Submit Turn.
7. Wait for host response.
8. End Session.
9. Confirm evaluation renders.
10. Inspect Network for `POST /api/podchat/evaluate`.
11. Confirm `memory.saved=true`.

Check Supabase read-only:

- `podchat_sessions`
- `podchat_turns`
- `learner_error_patterns`

## Weekly Review QA

Weekly Review is deterministic and memory-based.

Requirements:

- Enough memory rows must exist first.
- Open Weekly Review while signed in.
- Trigger review.
- Confirm UI renders summary, recurring weakness, best improvement, score trend, next week focus, recommended plan, and warnings.
- `recommendedPlan` must have exactly 7 items when returned.
- `weekly_reviews` cache row should be created.
- A repeated trigger should use cached behavior if observable.

Weekly Review should not require AI provider calls.

## Vercel Logs

Use sanitized logs only. Report route status codes and high-level categories. Do not print cookies, tokens, request headers, auth metadata, raw request bodies, env values, or raw database error objects.

Useful route evidence:

- `/api/article-practice` status
- `/api/article-essay-evaluate` status
- `/api/podchat/evaluate` status
- `/api/weekly-review` status
- memory save success or failure if safely logged

## Supabase Read-Only Checks

Inspect only the relevant tables for the flow under test.

Article writing:

- `article_writing_sessions`
- `article_writing_answers`
- `learner_error_patterns`

Podchat:

- `podchat_sessions`
- `podchat_turns`
- `learner_error_patterns`

Weekly review:

- `weekly_reviews`

Never insert, update, or delete rows during QA unless cleanup is explicitly approved and scoped to a dedicated QA owner.

## Privacy Checks

Confirm no stored or returned data contains:

- API keys
- raw provider payloads
- raw markdown
- full article text
- source URL by default
- audio
- STT/TTS fields
- storage paths
- auth metadata from request bodies

## Validation Policy

Run targeted validation, not full E2E by default:

```cmd
npm.cmd run lint
npx.cmd tsc --noEmit
git diff --check
```

Targeted Playwright examples:

```cmd
npx.cmd playwright test tests/mvp-smoke.spec.ts --reporter=line --workers=1
npx.cmd playwright test tests/article-practice-language.spec.ts --reporter=line --workers=1
npx.cmd playwright test tests/article-essay-evaluate.spec.ts --reporter=line --workers=1
npx.cmd playwright test tests/ai-review-language.spec.ts --reporter=line --workers=1
```

Use `--workers=1` to reduce device heat and resource pressure. Full E2E is for major milestones, broad app-shell changes, dependency/test-runner changes, or when targeted tests leave uncertainty.

Known local issue: on Windows, Playwright can occasionally hang during teardown. If a dev server is already running, use the `PLAYWRIGHT_SKIP_WEB_SERVER=1` workaround to avoid duplicate server startup.

## Current Runtime Limitations

- Authenticated Article Writing memory save is not fully verified because local/agent browser automation failed.
- Authenticated Podchat memory runtime is not fully verified unless manual flow confirms `/api/podchat/evaluate`.
- Preview `ARTICLE_AI_PROVIDER` may not be independently confirmed.
- Real provider keys are unavailable in the current QA context.
- Article and Podchat real-provider flows need future QA.

## Next Recommended Tasks

1. Complete authenticated browser QA for Article memory.
2. Complete authenticated browser QA for Podchat memory.
3. Verify Weekly Review after memory rows exist.
4. Add better UI diagnostics for `memory.saved=false` if needed.
5. Add provider configuration warnings.
6. Add memory dashboard, export, and delete controls later.
