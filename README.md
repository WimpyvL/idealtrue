# Ideal Stay

Ideal Stay is a proprietary South African accommodation marketplace and host operations platform.

It is owned by Klaasvaakie. This repository is private commercial software. No open-source license is granted.

Author signature: (|/) Klaasvaakie

## Ownership And License

Copyright (c) 2026 Klaasvaakie. All rights reserved.

The source code, product design, workflows, documentation, brand assets, data models, deployment configuration, and related materials in this repository are proprietary property of Klaasvaakie unless a file explicitly states otherwise.

You may not copy, modify, publish, distribute, sublicense, sell, host, deploy, reverse engineer, train models on, or create derivative works from this repository or any part of it without prior written permission from Klaasvaakie.

Access to this repository does not transfer ownership, grant an implied license, or create permission to use the work outside the approved Ideal Stay project context.

Third-party dependencies remain governed by their own licenses. Those dependency licenses do not grant any rights to the Ideal Stay application code, brand, product logic, or proprietary materials.

See [`LICENSE`](LICENSE) for the binding repository license notice.

## Product Scope

Ideal Stay combines a public accommodation marketplace with a private host and admin workspace:

- guest discovery, enquiries, booking requests, payment-state visibility, and stay history
- host listing management, availability operations, enquiry workflows, billing state, and content tooling
- admin workflows for users, listings, KYC, bookings, billing visibility, notifications, and platform settings
- Encore-backed identity, catalog, booking, billing, messaging, referrals, reviews, ops, and analytics services

The project is Encore-first. Firebase template leftovers are not the architecture. The durable system of record is the Encore backend with PostgreSQL, buckets, typed service boundaries, and operational APIs.

## Architecture

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- same-origin API proxy for Encore calls
- HttpOnly cookie-backed auth session handling

### Backend

- Encore TypeScript app in [`encore`](encore)
- services: `identity`, `catalog`, `booking`, `billing`, `messaging`, `referrals`, `reviews`, `ops`, and `analytics`
- provisioned SQL databases
- buckets for listing media, chat attachments, KYC documents, and moderation evidence
- Pub/Sub domain events for platform workflows

## Critical Runtime Contracts

Production and preview environments must set `ENCORE_API_URL`. Local development may fall back to `http://127.0.0.1:4000`.

Production-like builds fail closed when `ENCORE_API_URL` is missing or points at the wrong Encore environment.

Dev login is opt-in only:

```bash
IDEAL_STAY_ENABLE_DEV_LOGIN=true
```

Remote demo seeding is blocked unless explicitly allowed:

```bash
IDEAL_STAY_ALLOW_REMOTE_SEED=true
```

Auth email delivery is optional only for local/dev. Serious environments should configure:

- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`
- `AUTH_EMAIL_REPLY_TO`
- `IDEAL_STAY_APP_URL`
- `GOOGLE_OAUTH_CLIENT_ID`

Google sign-in requires the same web client id in:

- frontend env: `VITE_GOOGLE_CLIENT_ID`
- Encore backend config/secret: `GOOGLE_OAUTH_CLIENT_ID`

Do not commit Google OAuth client secret JSON files, provider secrets, API keys, webhook secrets, or production credentials.

## Payments

Yoco payment handling is server-owned. New paid flows use the standard backend billing payment endpoint and provider status/webhook reconciliation.

Use test mode only when deliberately verifying checkout behavior:

```bash
YOCO_PAYMENT_MODE=test
YOCO_TEST_SECRET_KEY=your-yoco-test-secret
VITE_YOCO_PAYMENT_MODE=test
```

Flip all payment-mode flags back to live before production validation. Mixed test/live payment state is an operational footgun.

## Local Development

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd encore
npm install
```

Run the frontend:

```bash
npm run dev
```

The frontend runs at [http://localhost:3000](http://localhost:3000).

Run the Encore backend locally when needed:

```bash
cd encore
encore run
```

## Verification

Baseline local checks:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
cd encore
npx tsc --noEmit
```

The Playwright specs under `tests/e2e` mock `/api/encore/**`, so they prove frontend workflow behavior, not live backend health.

Before calling preview or production ready, seed disposable smoke users if needed and run the live smoke gate against the deployed frontend:

```bash
IDEAL_STAY_API_URL=https://your-encore-host \
IDEAL_STAY_ALLOW_REMOTE_SEED=true \
IDEAL_STAY_SEED_ADMIN_EMAIL=admin@example.com \
IDEAL_STAY_SEED_ADMIN_PASSWORD=admin-password \
npm run seed:demo

IDEAL_STAY_SMOKE_BASE_URL=https://your-preview-or-production-host \
IDEAL_STAY_SMOKE_REQUIRE_ROLE_CREDENTIALS=true \
IDEAL_STAY_SMOKE_EXPECT_LISTINGS_MIN=1 \
IDEAL_STAY_SMOKE_GUEST_EMAIL=guest.nomusa@idealstay.demo \
IDEAL_STAY_SMOKE_GUEST_PASSWORD='IdealStayDemo123!' \
IDEAL_STAY_SMOKE_HOST_EMAIL=thandi.mokoena@idealstay.demo \
IDEAL_STAY_SMOKE_HOST_PASSWORD='IdealStayDemo123!' \
IDEAL_STAY_SMOKE_ADMIN_EMAIL=admin@example.com \
IDEAL_STAY_SMOKE_ADMIN_PASSWORD=admin-password \
npm run smoke:live
```

To wire live smoke into a release gate:

```bash
IDEAL_STAY_RUN_LIVE_SMOKE=true
```

## GitHub Actions

The staging smoke workflow lives at `.github/workflows/staging-smoke.yml`.

It has two jobs by design:

- `verify` runs on `main` pushes, schedules, and manual dispatches without staging secrets. This keeps the normal repo gate deterministic and preserves the existing `Staging Smoke / verify` check name.
- `staging smoke` runs only on scheduled/manual smoke events after `verify` passes. This is the only job that reads staging secrets, seeds shared smoke data, and probes the deployed frontend.

Required repository secrets:

- `ENCORE_API_URL`
- `IDEAL_STAY_SEED_ADMIN_EMAIL`
- `IDEAL_STAY_SEED_ADMIN_PASSWORD`
- `IDEAL_STAY_DEMO_PASSWORD`
- `IDEAL_STAY_SMOKE_BASE_URL`
- `IDEAL_STAY_SMOKE_ADMIN_EMAIL`
- `IDEAL_STAY_SMOKE_ADMIN_PASSWORD`

If `staging smoke` fails within seconds, read the `Validate staging smoke environment` annotations first. That step is intentionally strict and reports the exact missing or miswired repository secret before any deploy-facing seed/smoke action runs.

## Workflow Documentation

- [`docs/architecture-release-map.md`](docs/architecture-release-map.md)
- [`docs/release-risk-register.md`](docs/release-risk-register.md)
- [`docs/booking-and-enquiry-workflow.md`](docs/booking-and-enquiry-workflow.md)
- [`docs/workflow-validation-matrix.md`](docs/workflow-validation-matrix.md)
- [`docs/developer-handoff.md`](docs/developer-handoff.md)
- [`docs/encore-deployment.md`](docs/encore-deployment.md)

## Current Engineering Priorities

1. Extend stay-payment operations with assignee workflow, SLA handling, and refund orchestration.
2. Tighten KYC operations beyond simple approve/reject. Current KYC has audit-backed submission/review history, but disputes and richer ops case management are still missing.
3. Keep billing/payment reconciliation boring, auditable, and server-owned.
4. Ship real social publishing integrations on top of the content draft workflow.
5. Replace the manual frontend Encore bridge only when generated clients are unblocked.
