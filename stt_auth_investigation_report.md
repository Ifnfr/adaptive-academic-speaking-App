# Clerk Auth Investigation Report

This report outlines the status of our Clerk session authentication investigation for `/api/podchat/stt` and `/api/drill-session/start`, including agent environment limitations and testing next steps.

---

## 1. Triggering the Route for Real

> [!IMPORTANT]
> **Environment Limitation**: As a headless agentic assistant, I **cannot** simulate a real browser session containing actual Clerk session cookies, nor can I log in as a real user. I also do not have a Vercel bypass token to navigate Vercel's Preview Deployment Protection (which returns `Authentication Required` for curl/fetch calls).
>
> Therefore, I cannot trigger the live endpoints using a real authenticated browser session from my environment.

---

## 2. Pulling Vercel Runtime Logs

> [!IMPORTANT]
> **Environment Limitation**: Because I cannot generate requests with a valid Clerk session, and the Vercel CLI historical logs command returns `No logs found` (due to API token limitations or log retention constraints), I cannot pull or paste real log outputs from my environment.
>
> However, both routes have been instrumented with logging. When you test them in your browser, the logs will output to your Vercel console.

---

## 3. Clerk Dashboard Verification

> [!IMPORTANT]
> **Environment Limitation**: I **cannot** log into the Clerk Dashboard for this project because I do not have the credentials or access tokens for your Clerk account.
>
> Please log into your Clerk Dashboard and check the **Allowed Origins** / domain configuration for the development instance. Verify if the Vercel preview domain pattern (`*.vercel.app`) is explicitly allowed or blocked.

---

## 4. Cross-Check with `/api/drill-session/start`

To determine if `/api/drill-session/start` genuinely succeeds while `/api/podchat/stt` fails, I have added matching console logs to [route.ts](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/src/app/api/drill-session/start/route.ts).

### Logging Code in `/api/drill-session/start/route.ts`
```typescript
async function resolveCurrentUserId(): Promise<string | null> {
  if (testHooks.resolveCurrentUserId) {
    return testHooks.resolveCurrentUserId();
  }
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const session = await auth();
    console.log("[DRILL_START_AUTH_LOG] Raw auth() session object keys:", session ? Object.keys(session) : "null");
    console.log("[DRILL_START_AUTH_LOG] userId:", session?.userId || "null");
    console.log("[DRILL_START_AUTH_LOG] sessionClaims:", session?.sessionClaims ? JSON.stringify(session.sessionClaims) : "null");
    return session?.userId || null;
  } catch (err) {
    console.error("[DRILL_START_AUTH_LOG] Error in resolveCurrentUserId:", err);
    return null;
  }
}
```

### Deployed Testing URL
Both routes are deployed and ready to test on:
**[https://adaptive-academic-speaking-69818omjh-ifnfrs-projects.vercel.app](https://adaptive-academic-speaking-69818omjh-ifnfrs-projects.vercel.app)**

### Suggested Verification Steps:
1. Open the Vercel project logs dashboard.
2. Visit the preview URL in your browser and log in.
3. Start a drill session (triggers `/api/drill-session/start`).
4. Record and submit audio (triggers `/api/podchat/stt`).
5. Compare `[DRILL_START_AUTH_LOG]` and `[STT_AUTH_LOG]` in Vercel logs to see if they both output identical session keys, or if one is null/throws an error.
