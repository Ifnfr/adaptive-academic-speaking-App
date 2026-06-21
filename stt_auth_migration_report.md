# Speech-to-Text Route Clerk Auth Migration Report

This report documents the migration of `/api/podchat/stt` from the static `X-Internal-Key` header authentication to Clerk session-based authentication (`auth()`).

---

## 1. Summary of Changes

### API Route Changes
1. **Added Route Mocking Hooks**:
   - Created [route-test-hooks.ts](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/src/app/api/podchat/stt/route-test-hooks.ts) containing the `testHooks` export.
2. **Replaced Security Guard**:
   - Modified [route.ts](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/src/app/api/podchat/stt/route.ts).
   - Replaced the static header `X-Internal-Key` validation check with proper Clerk session authentication via `resolveCurrentUserId()`.
   - The route now returns a `401 Unauthorized` response with `{ error: "unauthorized" }` if the resolved `userId` is `null`.
   - Checked that `INTERNAL_SPEECH_SECURITY_KEY` and `NEXT_PUBLIC_INTERNAL_SPEECH_SECURITY_KEY` were **not** removed (they remain intact for `/api/podchat/tts`).

### Client Caller Analysis
1. **PatternDrillPrototype.tsx**:
   - [PatternDrillPrototype.tsx](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/src/app/components/PatternDrillPrototype.tsx) was verified. The `fetch("/api/podchat/stt")` call in this file did not pass `X-Internal-Key` and did not contain any dead security key logic/env var reads. No changes were required.
2. **PodchatView.tsx**:
   - Verified that the `fetch` call to `/api/podchat/stt` in [PodchatView.tsx](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/src/app/components/PodchatView.tsx) does not set `credentials: "omit"` or otherwise block cookies. It is cookie-friendly by default, so it automatically propagates same-origin Clerk session cookies. We left the cosmetic `X-Internal-Key` header sending untouched to minimize blast radius on this working production component.

### E2E Test Suite Changes
1. **Updated Spec Tests**:
   - Modified [podchat-stt-route.spec.ts](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/tests/podchat-stt-route.spec.ts).
   - Switched from testing/mocking the `X-Internal-Key` header to mocking `testHooks.resolveCurrentUserId` (matching the pattern used in the `drill-session` start route spec).
   - Updated the guard tests to verify that unauthenticated requests return `401` and authenticated requests pass through to the Deepgram key check.

---

## 2. Test Verification Results

1. **Specific Route Spec Test** (`npx.cmd playwright test tests/podchat-stt-route.spec.ts`):
   - **Result**: **PASS** (25/25 tests passed)
2. **Full E2E Test Suite** (`npm.cmd run test:e2e`):
   - **Result**: **1287 passed**, **37 failed** (2 tests resolved/flaked back to passing compared to the baseline run, zero new failures).
   - **New Failures Introduced**: **0**

---

## 3. Vercel Preview Deployment

- **Vercel Preview URL**: [https://adaptive-academic-speaking-n6148m7pb-ifnfrs-projects.vercel.app](https://adaptive-academic-speaking-n6148m7pb-ifnfrs-projects.vercel.app)
- **Deployment ID**: `dpl_DEVrddmQRAzLK2Xy1KiLe8Kaq3Cs`
- **Git Branch**: `feat/podchat-stt-clerk-auth` (successfully pushed to remote `origin`)

---

*Do NOT merge or push to `main`. Wait for explicit user confirmation before merging.*
