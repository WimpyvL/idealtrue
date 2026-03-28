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

- Socket.IO is still used for live notification delivery
- the durable source of truth for bookings, listings, identity, KYC, reviews, referrals, notifications, and admin workflows is Encore

This is now an Encore-first repo, not a Firebase bridge with new paint.

## What already routes through Encore

- session sync and profile resolution
- local session bootstrap and account creation
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

The frontend expects an Encore API at `http://127.0.0.1:4100` by default. Override with `VITE_ENCORE_API_URL` if needed.

The Encore app typechecks cleanly, but there are two environment caveats in the current machine state:

- `encore gen client` still fails because Encore client generation is rejecting the current auth metadata shape
- local `encore run` / `encore test` can fail if the local Encore daemon is unhealthy

That is why the frontend currently uses a manual fetch client in [`src/lib/encore-client.ts`](/C:/Git%20Repos/IdealTrue/src/lib/encore-client.ts) instead of a generated one.

## Verification

The following pass in the current repo state:

```bash
npm run lint
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
