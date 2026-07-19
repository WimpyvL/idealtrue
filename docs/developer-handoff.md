# Ideal Stay Developer Handoff

Author signature: (|/) Klaasvaakie

This document is the fastest safe entry point for a new developer. It explains what owns what, which tests prove which behavior, and where to extend coverage without creating spaghetti.

## System Shape

Ideal Stay is an Encore-first accommodation marketplace and host operations platform.

- Frontend: React, TypeScript, Vite, Tailwind.
- Backend: Encore TypeScript in `encore/`.
- Runtime state: Encore PostgreSQL services plus object buckets.
- API access from the browser: same-origin proxy through `/api/encore/**`.
- Auth session: HttpOnly cookie, restored through `identity.getSession`.
- Payments: server-owned Yoco Checkout-backed payment intents through `POST /billing/payments`.
- Architecture and release path: `docs/architecture-release-map.md`.

Do not rebuild old Firebase/template assumptions. The durable architecture is the Encore backend.

## Workflow Ownership

The source-of-truth workflow inventory is `docs/workflow-validation-matrix.md`. The executable mirror is `tests/fixtures/workflows.ts`, verified by `tests/workflow-coverage.test.ts`.

Core workflow owners:

- Identity: signup, login, email verification, password reset, sessions, account restriction.
- Catalog: listing CRUD, listing media, availability, quotas, public discovery.
- Booking: enquiries, approval, decline, payment proof, confirmation, expiry, disputes.
- Billing: host plans, vouchers, payment intents, Yoco checkout/webhooks, content credits, greylisting.
- Messaging: booking-scoped chat and attachments.
- Ops: KYC, notifications, admin operations, settings, moderation evidence.
- Referrals: reward records, leaderboard, subscription conversion reward hooks.
- Reviews: completed-stay reviews and admin moderation.
- Analytics: platform events and operational telemetry.

## Test Layers

Use the narrowest layer that proves the behavior:

- Pure business logic: `tests/*.test.ts`.
- Client/API mapping: `tests/api-clients.test.ts`, `tests/workflow-client-contracts.test.ts`, and focused contract files.
- Component/page behavior: `tests/ui/*.test.tsx`.
- Cross-role browser journeys: `tests/e2e/*.spec.ts`.
- Provider/webhook/signature behavior: backend-focused contract tests, usually not full browser tests.
- Live deployment health: `scripts/live-smoke.mjs`, not Playwright mocks.

Playwright tests mock `/api/encore/**`. They prove browser workflow behavior and route contracts. They do not prove the deployed backend is healthy.

## Current Coverage Map

Use this as a navigation index, not as a substitute for reading the matrix:

- Auth: `tests/e2e/auth-account.spec.ts`, `tests/ui/auth-context.test.tsx`, `tests/session-cookie.test.ts`, `tests/signup-flow.test.ts`.
- Booking/enquiries/payment proof: `tests/e2e/booking-payment-review.spec.ts`, `tests/booking-workflow.test.ts`, `tests/inquiry-state.test.ts`, `tests/ui/host-enquiries.test.tsx`.
- Host billing/Yoco: `tests/e2e/host-billing.spec.ts`, `tests/payment-yoco-contracts.test.ts`, `tests/host-billing-lifecycle.test.ts`.
- KYC: `tests/e2e/kyc-admin-review.spec.ts`, `tests/kyc-history-contract.test.ts`.
- Content Studio: `tests/e2e/content-studio.spec.ts`, `tests/ui/social-dashboard.test.tsx`, `tests/content-entitlements.test.ts`.
- Admin dashboard data: `tests/ui/admin-dashboard-data.test.tsx`.
- Notifications: `tests/ui/notification-context.test.tsx`, `tests/backend-notification-helpers.test.ts`.
- AI/planner/provider rails: `tests/ai-rails.test.ts`, `tests/ai-client.test.ts`, `tests/trip-planner.test.ts`, `tests/trip-planner-api.test.ts`.

## How To Add Coverage

1. Update `tests/fixtures/workflows.ts` when the workflow state model changes.
2. Update `docs/workflow-validation-matrix.md` in the same change.
3. Add the smallest useful test first.
4. Put provider-specific tests in focused contract files instead of kitchen-sink client tests.
5. Keep Playwright route mocks deterministic and based on canonical fixture shapes.
6. Run the focused tests first, then the relevant baseline gate.

If a workflow row says a test exists, `tests/workflow-coverage.test.ts` should be able to find that file. If a route or endpoint is removed, delete it from the matrix in the same commit.

## Verification Commands

Fast focused checks:

```bash
npx tsx --test tests/workflow-coverage.test.ts
npx tsx --test tests/payment-yoco-contracts.test.ts
npx playwright test tests/e2e/host-billing.spec.ts
npm run lint
```

Full local baseline:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
cd encore
npx tsc --noEmit
```

Live deployment gate:

```bash
npm run smoke:live
```

## Current Gaps

The platform is not at “every possible thing that can happen is tested.” That is a slogan, not an engineering state. The actionable bar is: every workflow has a happy path, a key rejection path, permission rules, async side effects, notification side effects, and external boundaries documented and covered at the right layer.

Known next coverage areas remain in `docs/workflow-validation-matrix.md` under `Required next coverage`. Highest leverage gaps:

- backend auth token expiry/reuse tests
- backend booking and dispute permission/state-transition tests
- host availability Playwright flow with locked booking dates
- listing create/edit Playwright flow with quota and media rules
- messaging Playwright flow plus backend party-permission tests
- reviews eligibility/moderation tests
- referral duplicate/self-referral tests
- admin destructive action and platform-settings validation tests
- trip planner browser error/rate-limit state tests

Do not pretend those are done. Add them deliberately, one workflow slice at a time.