# Project Rules

## Core Execution Rules

* Keep every task tightly scoped.
* Do not modify unrelated features.
* Do not stage, commit, or push unless the user explicitly approves.
* Do not delete, skip, or weaken tests just to make validation pass.
* Do not expose API keys, environment values, secrets, private data, or raw provider payloads.
* Do not commit `.env.local`, generated logs, debug files, cache files, build output, or secrets.
* If generated files such as `debug.log` appear during validation, report them and remove them only when clearly safe and generated.
* If the working tree is dirty before a task starts, stop and ask for instruction unless the task explicitly includes those dirty files.
* Prefer small commits and small diffs.
* If a task touches more files than expected, stop and explain why before continuing.

## Scope Rules

* Article Practice changes must not modify Podchat, Vocabulary, STT, TTS, or Supabase unless explicitly requested.
* Podchat changes must not modify Article Practice, Vocabulary, or Supabase unless explicitly requested.
* Vocabulary changes must not modify Article Practice, Podchat, STT, TTS, or Supabase unless explicitly requested.
* STT/TTS changes must not add storage, Supabase writes, scoring, biometrics, diarization, or unrelated provider behavior unless explicitly requested.
* Backend route changes should not modify UI unless the task explicitly requires UI integration.
* UI changes should not modify backend routes unless the task explicitly requires contract changes.

## Security and Privacy Rules

* Never expose API keys or secrets in logs, client responses, test output, commits, or documentation examples.
* `.env.example` may contain placeholders only. It must never contain real keys.
* `.env.local` must remain uncommitted.
* Do not send user identity, auth metadata, storage paths, full raw documents, audio blobs, recording URLs, or private data to provider routes unless explicitly required and validated.
* Do not add Supabase writes or persistent storage unless the task is specifically about persistence and includes a schema/privacy plan.
* Do not add pronunciation scoring, phoneme scoring, speaker identification, diarization, or biometrics unless explicitly requested.

## Validation Policy

Use targeted validation instead of running the full E2E suite by default.

### Tier 0 — Always Run

Always run these checks for code or test changes:

* `git status --short --untracked-files=all`
* `npm.cmd run lint`
* `npx.cmd tsc --noEmit`
* `git diff --check`

For documentation‑only changes, run:

* `git status --short --untracked-files=all`
* `npm.cmd run lint`
* `npx.cmd tsc --noEmit`
* `git diff --check`

Do not run full E2E for documentation‑only changes unless there is a clear reason.

### Tier 1 — Targeted Playwright Tests

Run only tests related to the changed files or feature.

Use `--workers=1` for targeted Playwright tests to reduce device heat and resource usage.

Article Practice changes:

```
npx.cmd playwright test tests/article-practice-language.spec.ts tests/mvp-smoke.spec.ts --reporter=line --workers=1
```

Article Essay Evaluation changes:

```
npx.cmd playwright test tests/article-essay-evaluate.spec.ts tests/article-practice-language.spec.ts --reporter=line --workers=1
```

Podchat UI changes:

```
npx.cmd playwright test tests/podchat-ui.spec.ts tests/mvp-smoke.spec.ts --reporter=line --workers=1
```

Podchat turn/evaluate route changes:

```
npx.cmd playwright test tests/podchat-turn-route.spec.ts tests/podchat-evaluate-route.spec.ts --reporter=line --workers=1
```

Podchat STT route changes:

```
npx.cmd playwright test tests/podchat-stt-route.spec.ts --reporter=line --workers=1
```

Podchat TTS route changes:

```
npx.cmd playwright test tests/podchat-tts-route.spec.ts --reporter=line --workers=1
```

Vocabulary changes:

```
npx.cmd playwright test tests/vocabulary-correction-language.spec.ts tests/mvp-smoke.spec.ts --reporter=line --workers=1
```

Layout/sidebar/navigation changes:

```
npx.cmd playwright test tests/mvp-smoke.spec.ts tests/sidebar-simplification.spec.ts --reporter=line --workers=1
```

### Tier 2 — Full E2E

Run full E2E:

```
npm.cmd run test:e2e
```

Only when one or more of these are true:

* app‑wide shell, layout, or navigation changed
* `package.json` or dependencies changed
* Playwright config or test runner changed
* shared provider helpers used by many routes changed
* route contracts used by multiple features changed
* more than 5 source/test files changed
* the task is a major milestone validation
* before release or deployment
* targeted tests leave uncertainty
* the user explicitly asks for full E2E

Do not run repeated full E2E loops without a clear reason.

If a direct Playwright command passes test bodies but times out during teardown on Windows, report it honestly. Prefer the project runner only for final milestone validation.

## Reporting Rules

Every final report must include:

1. Files changed
2. Why each changed file was needed
3. Validation selected and why
4. Lint result
5. TypeScript result
6. Targeted test result
7. Whether full E2E was skipped or required
8. `git diff --check` result
9. Final `git status --short --untracked-files=all`
10. Whether safe to commit
11. Confirmation that no commit or push was performed

If validation fails, report:

* exact command
* failing file/spec
* failing test name
* error message
* whether it appears related to the current diff
* recommended next action

## Device‑Safety Rules

* Prefer targeted tests over full E2E.
* Prefer `--workers=1` for targeted tests.
* Avoid repeated full E2E runs.
* Do not run expensive browser automation unless needed.
* If the device becomes hot or slow, stop and report the last completed validation step.

## Current Project Priorities

This project prioritizes:

* small scoped changes
* privacy‑safe AI routes
* low‑cost provider usage
* compact prompts and compact context
* no unnecessary storage
* no full raw article/document payloads when compact context is available
* no broad refactors unless explicitly requested

