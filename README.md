# Ideal Stay

Ideal Stay is a South Africa-focused accommodation marketplace and host workspace. The repo now has two clear halves:

- a React/Vite frontend in the root
- an Encore TypeScript backend in [`encore`](/C:/Git%20Repos/IdealTrue/encore)

This is no longer a Gemini template repo, and it is no longer pretending Firebase should own the product. The frontend now runs against Encore-backed services, PostgreSQL databases, buckets, and typed API boundaries.

## Current architecture

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4

### Backend

- Encore TypeScript app in [`encore`](/C:/Git%20Repos/IdealTrue/encore)
- Service split across `identity`, `catalog`, `booking`, `billing`, `messaging`, `referrals`, `reviews`, `ops`, and `analytics`
- Multiple provisioned SQL databases
- Provisioned buckets for listing media, chat attachments, KYC docs, and moderation evidence
- Pub/Sub topic for platform domain events

### Realtime notes

- notification delivery currently uses backend-backed polling through the same-origin Encore proxy
- read state is persisted per user in Encore, so notifications stay consistent across devices
- the durable source of truth for bookings, listings, identity, KYC, reviews, referrals, notifications, and admin workflows is Encore

This is now an Encore-first repo, not a Firebase bridge with new paint.

## What already routes through Encore

- session sync and profile resolution
- local session bootstrap and account creation
- password signup and password login
- email verification and password reset flows
- profile updates and role changes
- public listing reads
- host listing reads
- listing create/update
- booking creation
- guest/host booking reads
- referral reward history reads
- listing reviews read/write
- referral leaderboard reads
- admin reads and writes for users, bookings, listings, reviews, referrals, subscriptions, notifications, and platform settings
- listing media uploads through Encore bucket URLs
- profile photo uploads through Encore bucket URLs
- KYC submission review and secure asset previews through Encore ops APIs
- subscription upgrades and downgrades through Encore billing APIs
- content studio entitlements, monthly included usage, credit top-ups, and saved drafts through Encore billing APIs

## Booking and availability rules

- listing availability now uses a durable ledger of availability blocks, not just a fragile `blocked_dates` array
- host manual blocks, approved enquiry holds, and confirmed booked stays are tracked separately in Encore `catalog`
- manual host blocks are now stored as interval records with optional notes, not just flat date arrays
- stay dates are end-exclusive for occupancy logic, so checkout day is not treated as a blocked overnight
- the frontend uses shared availability logic in [`src/lib/listing-availability.ts`](/C:/Git%20Repos/IdealTrue/src/lib/listing-availability.ts) so explore filtering and booking validation stay consistent
- the host enquiries screen is now treated as a workflow board with `Needs Response`, `Awaiting Guest Payment`, `Awaiting Payment Confirmation`, `Confirmed Stays`, and `Closed Loop` buckets
- the host availability calendar now supports bulk range actions, notes on manual block intervals, selected-day inspection, and backend summary tracking instead of only single-day toggles

See [`docs/booking-and-enquiry-workflow.md`](/C:/Git%20Repos/IdealTrue/docs/booking-and-enquiry-workflow.md) for the full workflow and operational expectations.

See [`docs/workflow-validation-matrix.md`](/C:/Git%20Repos/IdealTrue/docs/workflow-validation-matrix.md) for the maintained workflow inventory, coverage gaps, fixture contract, and CI acceptance gate.

## What does not fully route through Encore yet

- KYC document submission still needs a more complete ops workflow around review history and disputes
- stay-payment coordination is implemented, but off-platform payment proof review can still be tightened
- billing/subscriptions are scaffolded on the backend but not commercially complete
- AI content engine still needs real social publishing integrations beyond draft scheduling and publish tracking
- generated Encore frontend clients are still blocked, so the frontend uses a manual request client

## Local development

### Prerequisites

- Node.js 20+
- npm
- Encore CLI installed and authenticated if you want to run the backend locally

### Install frontend dependencies

```bash
npm install
```

### Install backend dependencies

```bash
cd encore
npm install
```

### Run frontend

```bash
npm run dev
```

The frontend runs at [http://localhost:3000](http://localhost:3000).

### Backend notes

The local dev proxy defaults to `http://127.0.0.1:4000` only in local development.

If you want to be explicit in your local env file, set:

```bash
ENCORE_API_URL=http://127.0.0.1:4000
```

Preview and production must set `ENCORE_API_URL` explicitly. They fail closed if the variable is missing, and production-like environments refuse to start if the value points at the staging Encore host.

Dev login is now opt-in only and should never be enabled in a shared environment:

```bash
IDEAL_STAY_ENABLE_DEV_LOGIN=true
```

The demo seed script also defaults to local and refuses to hit a non-local API target unless you opt in:

```bash
IDEAL_STAY_ALLOW_REMOTE_SEED=true
```

Backend auth email delivery is optional in local/dev but should be configured in any serious environment:

- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`
- `AUTH_EMAIL_REPLY_TO`
- `IDEAL_STAY_APP_URL`

The Encore app typechecks cleanly, but there are two environment caveats in the current machine state:

- `encore gen client` still fails because Encore client generation is rejecting the current auth metadata shape
- local `encore run` / `encore test` can fail if the local Encore daemon is unhealthy

That is why the frontend currently uses a manual fetch client in [`src/lib/encore-client.ts`](/C:/Git%20Repos/IdealTrue/src/lib/encore-client.ts) instead of a generated one.

## Production env contract

These are the important runtime expectations now:

- `ENCORE_API_URL`
  Required for preview and production.
  Optional only for local dev, where the proxy falls back to `http://127.0.0.1:4000`.
- auth runs through the same-origin proxy and is stored in an HttpOnly cookie.
- proxy logs are structured and include request id, upstream path, status, and duration.
- proxy logs never include bearer tokens or cookie contents.
- production and preview builds run a config guard that rejects missing `ENCORE_API_URL` and any staging Encore host reference.
- frontend builds also run a bundle-budget check so large JS regressions fail the build instead of sneaking through.

## Verification

The following pass in the current repo state:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
cd encore
npx tsc --noEmit
```

## Immediate next engineering work

1. Finish the host/guest payment-coordination flow around proof-of-payment and dispute handling.
2. Tighten KYC ops workflows beyond simple approve/reject.
3. Add real payment provider integration for subscriptions and content-credit purchases.
4. Ship actual social platform publishing integrations on top of the new content draft workflow.
5. Solve the Encore auth metadata shape so generated frontend clients can replace the manual fetch bridge.

## Already cleaned up

- Gemini client usage removed
- AI Studio/template residue removed
- deterministic content and trip-planning helpers added
- root app identity rewritten toward Ideal Stay
- mock listing fallback removed from the marketplace shell
- Firebase auth/storage/firestore app dependencies removed from the frontend code path
