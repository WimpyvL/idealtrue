# Ideal Stay Architecture And Release Map

Author signature: (|/) Klaasvaakie

This map shows how a browser action moves through the frontend, Vercel/local proxy, Encore services, storage, database, events, and release gates. Use it before changing routes, API clients, backend service contracts, deployment config, or production-facing workflows.

## Runtime Request Path

| Layer | Owner files | Responsibility |
| --- | --- | --- |
| Browser shell | `src/main.tsx`, `src/App.tsx`, `src/components/AppRoutes.tsx` | Mounts React, redirects to the canonical host, restores auth, owns top-level route state, and opens shared modals. |
| Route pages | `src/pages/**`, `src/features/**`, `src/components/**` | Implements guest, host, admin, planner, pricing, legal, listing, booking, and content-studio surfaces. |
| Shared data hook | `src/hooks/use-platform-data.ts` | Loads public listings, session bookings, host listings, and referrals through React Query. Keeps optimistic booking/listing state aligned after mutations. |
| Frontend API clients | `src/lib/*-client.ts`, `src/lib/domain-mappers.ts` | Calls the same-origin Encore proxy, validates backend contracts with Zod, maps Encore records into UI domain types. |
| Same-origin proxy | `api/encore-proxy.js`, `server.ts`, `lib/server/session-cookie.js` | Resolves `ENCORE_API_URL`, forwards `/api/encore/**`, injects the HttpOnly cookie token as `Authorization`, persists new session tokens, strips raw tokens from JSON responses, and logs request IDs. |
| Encore auth boundary | `encore/shared/auth.ts`, `encore/identity/auth.ts` | Verifies bearer tokens, exposes auth data to Encore endpoints, and enforces role checks with `requireAuth` / `requireRole`. |
| Encore services | `encore/identity`, `encore/catalog`, `encore/booking`, `encore/billing`, `encore/messaging`, `encore/ops`, `encore/referrals`, `encore/reviews`, `encore/analytics` | Own durable business rules, SQL persistence, object buckets, scheduled jobs, Pub/Sub events, and provider integrations. |

## Primary Workflow Map

| Workflow | Frontend entry points | Frontend client boundary | Encore service boundary | Durable/external boundary |
| --- | --- | --- | --- | --- |
| Auth and account lifecycle | `/signup`, `/account`, app bootstrap | `src/lib/identity-client.ts`, `src/contexts/AuthContext.tsx` | `encore/identity/api.ts` | Identity DB, auth tokens, email provider, Google OAuth client id. |
| Public discovery | `/`, listing detail modal | `src/lib/platform-client.ts`, `src/lib/domain-mappers.ts` | `encore/catalog/api.ts` | Catalog DB, listing media bucket, availability records. |
| Booking and payment proof | Listing modal, `/guest`, `/host/enquiries`, `/host/inbox` | `src/lib/platform-client.ts`, `src/lib/messaging-client.ts` | `encore/booking/api.ts`, `encore/messaging/api.ts` | Booking DB, booking evidence bucket, notifications, availability sync. |
| Host listings and availability | `/host/listings`, `/host/create-listing`, `/host/edit-listing/:id`, `/host/availability` | `src/lib/platform-client.ts`, `src/lib/media-client.ts` | `encore/catalog/api.ts` | Catalog DB, listing media bucket, host quota and billing access checks. |
| Billing, plans, and Yoco | `/pricing`, host billing/admin surfaces | `src/lib/billing-client.ts`, `src/lib/admin-client.ts` | `encore/billing/api.ts` | Billing DB, Yoco checkout/payment/webhooks, referral conversion rewards. |
| KYC and ops | Host onboarding/account, `/admin` | `src/lib/ops-client.ts`, `src/lib/admin-client.ts` | `encore/ops/api.ts`, `encore/identity/api.ts` | KYC document bucket, ops DB, notifications, audit/history records. |
| Content Studio and social drafts | `/host/social` | `src/lib/billing-client.ts`, server `/api/ai/social-image` | `encore/billing/api.ts`, server AI helpers | Billing DB, content credit ledger, Gemini/image provider, listing snapshots. |
| Trip planner | `/planner` | server `/api/ai/trip-planner` | session lookup through Encore proxy | Gemini/Search AI, local fallback, in-memory rate limits. |
| Notifications | app navigation and dashboards | `src/context/NotificationContext.tsx`, `src/lib/notification-client.ts` | `encore/ops/notifications.ts` and service callers | Ops DB notification records and domain-event producers. |
| Reviews and referrals | `/guest`, `/referral`, `/host/referrals`, `/admin` | `src/lib/platform-client.ts`, `src/lib/admin-client.ts` | `encore/reviews/api.ts`, `encore/referrals/api.ts` | Reviews DB, referrals DB, moderation and payout state. |

## Contract Change Checklist

Use this checklist when changing any API request/response shape, workflow state, enum, or database-backed record.

1. Update the Encore service type and implementation.
2. Update frontend Zod schemas and mappers in `src/lib/domain-mappers.ts` or the relevant client module.
3. Update focused contract tests in `tests/*.test.ts`.
4. Update route/page/UI tests when visible behavior changes.
5. Update `tests/fixtures/workflows.ts` and `docs/workflow-validation-matrix.md` when workflow ownership, states, entry points, or required coverage changes.
6. Keep old endpoint names out of docs and diagrams when replacing backend routes.

## Proxy And Session Invariants

These are production-sensitive and should not change casually.

- Browser code calls `/api/encore/**`; direct browser calls to the Encore host are not the standard path.
- `ENCORE_API_URL` is required in Vercel preview/production.
- Local dev may fall back to `http://127.0.0.1:4000` through `server.ts` only.
- `idealstay_session` is HttpOnly, `SameSite=Lax`, path-wide, seven-day max age, and `Secure` in production/HTTPS contexts.
- Auth-bearing Encore responses may set the cookie, but the raw `token` must be removed from JSON responses sent to the SPA.
- Forwarded cookies and hop-by-hop/proxy headers must not be passed upstream as-is.

## Release Confidence Ladder

Run the narrowest useful check first while developing, then climb this ladder before calling a production-sensitive change ready.

| Stage | Command or gate | What it proves |
| --- | --- | --- |
| Focused unit/contract | `npx tsx --test tests/<file>.test.ts` | The touched business rule, client mapping, proxy utility, provider contract, or workflow fixture behaves as expected. |
| Frontend/backend static gate | `npm run lint` and `cd encore && npx tsc --noEmit` | TypeScript and ESLint agree across frontend, server helpers, and Encore. |
| Full local test gate | `npm run test` | Node contract tests and Vitest UI tests pass. Live smoke is skipped unless explicitly enabled. |
| Browser workflow gate | `npm run test:e2e` | Mocked Playwright journeys still match frontend workflow contracts. This does not prove live Encore health. |
| Build gate | `npm run build` | Production config checks pass, the Vite build succeeds, and the bundle budget remains acceptable. |
| Repo acceptance gate | `npm run verify` | Drift, lint, tests, and build all pass together. |
| Live deployment gate | `npm run smoke:live` or scheduled/manual `Staging Smoke / staging smoke` | A deployed frontend can reach the configured Encore backend and complete seeded smoke journeys. |

## Refactor Guidance

The largest backend API files are domain-rich and should be simplified opportunistically, not rewritten broadly. When touching `encore/billing/api.ts`, `encore/booking/api.ts`, or `encore/catalog/api.ts`, prefer extracting pure helpers for one workflow slice at a time: state transitions, provider normalization, row mapping, permission checks, or notification orchestration. Keep each extraction covered by focused tests before moving the next slice.

Generated Encore clients remain a desirable future direction, but manual contract validation is the current safety rail. Do not remove the mappers until generated clients can cover the same runtime parsing and frontend type guarantees.
