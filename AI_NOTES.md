# AI Implementation Notes

## Architecture Decisions & Rationale

### 1. Unified Next.js Architecture
We transitioned from an initial multi-service idea (Express + React) to a unified **Next.js (App Router)** architecture. 
**Why?**
- Simplifies deployment to a single Vercel instance.
- Avoids the "cold start" delay issues that separate Render backends commonly face.
- Deep integration with `Auth.js` (NextAuth) for session management without the overhead of manually managing JWTs across boundaries.

### 2. Security Enhancements
- **Idempotency:** Webhooks can be retried by GitHub. To prevent duplicate processing, every event is tracked via its `x-github-delivery` ID. A unique constraint in the `events` table ensures a webhook is only processed once.
- **HMAC Signature Verification:** The core `/api/webhooks/github` endpoint strictly verifies the `x-hub-signature-256` header. Unauthorized payloads are immediately dropped.
- **Token Security:** Instead of storing OAuth access tokens as plaintext in a custom table, we utilized the `accounts` table provided by the Auth.js Drizzle adapter. This abstracts token management securely. *Note for production: Consider encrypting token fields at rest in the database.*
- **Rate Limiting:** Implemented an in-memory sliding-window rate limiter tailored for Vercel functions to prevent webhook spam or abuse.

### 3. Database Proxy for Build Constraints
**The Problem:** Next.js attempts to statically analyze and prerender routes during `npm run build`. During this phase, `DATABASE_URL` is typically absent. If the DB adapter eagerly attempts to connect, the build fails.
**The Solution:** We implemented a `Proxy` around the Drizzle instance. The proxy gracefully intercepts property accesses during the build phase and returns `undefined`, allowing Next.js to compile without crashing. The actual DB connection is only made lazily at runtime when the proxy is accessed in a live environment.

### 4. Robust Logging
Implemented `pino` for structured, JSON-formatted logging. We explicitly configured redactors to mask sensitive keys like `authorization`, `accessToken`, and `secret` to ensure zero token leakage in server logs.

### 5. Asynchronous Resilience via "Retry"
Instead of a complex cron-based background job queue (e.g., BullMQ + Redis) which overcomplicates the stack, we opted for a UI-driven retry mechanism. If a webhook triggers an action (like a Slack notification) that fails due to a network blip, the action is marked as `failed`. The user can simply click "Retry" in the dashboard, triggering a dedicated retry API route.

## Stretch Goal Implementation
We integrated **Google Gemini 2.0 Flash** into the webhook pipeline. If a rule has `aiTriage` enabled, the bot calls the Gemini API to analyze the issue/PR text, generating a short summary and suggesting GitHub labels. This is displayed prominently in the dashboard UI and formatted into the Slack notification.
