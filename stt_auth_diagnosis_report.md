# Clerk Auth Diagnosis Report — Speech-to-Text Endpoint

This report documents the diagnosis of the Clerk authentication issue on the `/api/podchat/stt` endpoint in the Vercel preview deployment.

---

## 1. Environment Variable Scoping & Scrutiny

- **Vercel Settings**: In the Vercel project, `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` are configured separately for both `Preview` and `Production` environments.
- **Development Keys Used**: The Clerk browser warning (*"Clerk has been loaded with development keys. Development instances have strict usage limits..."*) confirms that the **Preview** environment is using Clerk development/test keys (`pk_test_...` and `sk_test_...`).
- **Domain Restrictions**: Clerk development instances restrict session syncing and cookie handling on non-standard domains (such as Vercel’s `*.vercel.app` preview domains) unless explicitly configured in the Clerk Dashboard under **Allowed Origins** or custom domain proxy settings.

---

## 2. Temporary Server-Side Logging

- **Logging Code Added**: Added comprehensive server-side logging inside `resolveCurrentUserId()` in [route.ts](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/src/app/api/podchat/stt/route.ts):
  ```typescript
  async function resolveCurrentUserId(): Promise<string | null> {
    if (testHooks.resolveCurrentUserId) {
      return testHooks.resolveCurrentUserId();
    }
    try {
      const { auth } = await import("@clerk/nextjs/server");
      const session = await auth();
      console.log("[STT_AUTH_LOG] Raw auth() session object keys:", session ? Object.keys(session) : "null");
      console.log("[STT_AUTH_LOG] userId:", session?.userId || "null");
      console.log("[STT_AUTH_LOG] sessionClaims:", session?.sessionClaims ? JSON.stringify(session.sessionClaims) : "null");
      return session?.userId || null;
    } catch (err) {
      console.error("[STT_AUTH_LOG] Error in resolveCurrentUserId:", err);
      return null;
    }
  }
  ```
- **Deployment Status**: Committed and pushed to `feat/podchat-stt-clerk-auth` (commit `8cf336a`), deployed to the latest Vercel Preview URL:
  **[https://adaptive-academic-speaking-17ej33mww-ifnfrs-projects.vercel.app](https://adaptive-academic-speaking-17ej33mww-ifnfrs-projects.vercel.app)**
- **Verification**: Visited or requested on the latest preview URL will print raw auth session object keys, userId, and claims directly to your Vercel project logs.

---

## 3. Client Fetch Call Analysis

- **Fetch Location**: [PatternDrillPrototype.tsx](file:///c:/Users/USER/OneDrive/Dokumen/GitHub/adaptive-academic-speaking-app/app-web/src/app/components/PatternDrillPrototype.tsx)
- **Exact Fetch Call Code**:
  ```typescript
  const res = await fetch("/api/podchat/stt", {
    method: "POST",
    body: formData,
  });
  ```
- **Credentials Handling**: Does not set a `credentials` property. Modern browsers default same-origin fetch calls (`/api/...`) to `same-origin` credentials propagation, automatically including same-origin cookies (like Clerk session cookies).

---

## 4. Comparison to `/api/drill-session/start`

- **Identical Auth Logic**: The dynamic import and `await auth()` helper structure in `/api/drill-session/start/route.ts` is exactly identical to the one in `/api/podchat/stt/route.ts`. Both run on the `nodejs` runtime and return `401` on unauthenticated requests.
- **Identical Client Fetch Credentials**: Both client fetch requests use same-origin relative URLs without overriding the `credentials` property.
- **Key Difference — Request Body / Content-Type**:
  - `/api/drill-session/start` sends a JSON body (`application/json`).
  - `/api/podchat/stt` sends a `FormData` object containing the binary audio file (`multipart/form-data`).
  - *Implication*: While cookies are sent by the browser regardless of content-type, in some Next.js/Vercel serverless Node runtimes, request parsing of large `multipart/form-data` uploads can cause race conditions, connection resets, or header extraction errors if the server starts processing the auth helper asynchronously before the stream is fully established or parsed by Next.js's request reader.

---

*Do NOT merge or push to `main`. Wait for explicit user instructions.*
