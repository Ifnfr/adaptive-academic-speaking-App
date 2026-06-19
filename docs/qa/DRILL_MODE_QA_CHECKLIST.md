# Drill Mode QA Checklist

Use this checklist for local release review after Big-4.

## Preconditions

- Branch is `Fonetik_2.1`.
- Worktree is clean before starting QA.
- Latest history includes Big-3: audio feedback and pressure tracking.
- No migrations, schema changes, provider changes, package changes, push, or
  deploy are part of this QA pass.

## Manual Flow

- [ ] Open Active Session.
- [ ] Switch to Drill Mode.
- [ ] Confirm latest weakness loads only after Drill Mode opens.
- [ ] Generate Pattern Brief.
- [ ] Confirm Phase 0 shows Pattern Brief content.
- [ ] Press Start Drill.
- [ ] Confirm Phase 0 content is removed from the DOM, not visually hidden.
- [ ] Complete internal Quick Check.
- [ ] Confirm Quick Check does not show raw transcript.
- [ ] Complete Phase 1 Cold Recall.
- [ ] Confirm Phase 1 is labeled as baseline collection.
- [ ] Confirm Phase 1 does not show Pattern Brief content or raw transcript.
- [ ] Complete a Phase 2 partial/no-credit attempt.
- [ ] Confirm audio feedback plays.
- [ ] Confirm Repeat audio is available.
- [ ] Confirm Repeat audio does not submit a new turn.
- [ ] Confirm visible feedback does not show model text or pattern steps.
- [ ] Simulate or observe TTS unavailable behavior.
- [ ] Confirm fallback copy is generic: "Voice feedback unavailable. Try again
      or continue."
- [ ] Complete Phase 3.
- [ ] Confirm visual timer is visible.
- [ ] Confirm timing result is separate from pattern credit.
- [ ] Confirm pressure fail + full pattern credit can be represented.
- [ ] Complete the session.
- [ ] Confirm Summary appears in-place.
- [ ] Confirm Summary shows baseline, Phase 2 accuracy, pressure accuracy,
      pressure fail rate, improvement signal, recommendation, and saved status
      when available.
- [ ] Press New Session.
- [ ] Confirm a fresh Phase 0 session appears.
- [ ] Start another session and press Exit mid-session.
- [ ] Confirm warning: "Leaving now will discard this drill session."
- [ ] Cancel keeps the session.
- [ ] Confirm exits to Podchat and does not complete/persist.

## No Visual Crutch Checks

During Quick Check, Phase 1, Phase 2, and Phase 3, verify that these are absent:

- [ ] Phase 0 Pattern Brief block
- [ ] response pattern steps
- [ ] mini example
- [ ] common mistakes
- [ ] `spokenModelFragment`
- [ ] corrective model text
- [ ] raw transcript
- [ ] pattern reference/sidebar

## Persistence Checks

- [ ] Start does not persist a completed session.
- [ ] Quick Check does not persist.
- [ ] Phase 1 does not persist.
- [ ] Phase 2 does not persist.
- [ ] Phase 3 turns do not persist.
- [ ] Repeat Feedback does not persist.
- [ ] Exit discard does not call complete.
- [ ] Completion persists only bounded summary metrics.
- [ ] `learner_error_patterns` is not mutated.

## Regression Checks

- [ ] Podchat normal flow still works.
- [ ] Podchat TTS route behavior is unchanged.
- [ ] Weekly Review behavior is unchanged.
- [ ] Context Bridge AUR behavior is unchanged.
- [ ] Legacy Pattern Drill route tests still pass.

## Required Commands

Run from `app-web` unless noted:

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npx.cmd playwright test --reporter=line --workers=1 tests/pattern-drill
npx.cmd playwright test --reporter=line --workers=1 tests/mvp-smoke.spec.ts
npx.cmd playwright test --reporter=line --workers=1 tests/podchat-ui.spec.ts
npx.cmd playwright test --reporter=line --workers=1 tests/podchat-tts-route.spec.ts
npx.cmd playwright test --reporter=line --workers=1
```

From the repo root:

```powershell
git diff --check
git status --short --untracked-files=all
```
