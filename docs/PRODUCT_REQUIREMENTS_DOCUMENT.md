# Ideal Stay Product Requirements Document

**Document status:** As-built product baseline and forward requirements  
**Version:** 1.0  
**Date:** 13 July 2026  
**Owner and author:** Klaasvaakie  
**Product:** Ideal Stay  

> Ideal Stay is a South African accommodation marketplace and host-operations platform. It connects guests, hosts, platform operators, and support staff in one system covering discovery, enquiries, availability, payment evidence, subscriptions, KYC, messaging, reviews, referrals, analytics, and AI-assisted tools.

## 1. Purpose of this document

This PRD explains the product that exists in the repository, the user and business problems it addresses, its implemented capabilities, its system and workflow boundaries, and the requirements that should govern its next production stages. It distinguishes three states:

- **Implemented:** represented in application code and backed by tests or documented runtime contracts.
- **Partially implemented:** a usable foundation exists, but the operational loop is incomplete.
- **Required next:** a product requirement inferred from a visible workflow gap or stated engineering priority; it is not claimed as current behavior.

The repository is the primary source of truth. The React frontend, Encore services, SQL migrations, API contracts, workflow matrix, and automated tests were analysed together to avoid describing design intent as shipped reality.

## 2. Executive summary

Ideal Stay is not merely a listing directory. It is a multi-sided transaction and operations system designed around South African accommodation workflows. Guests discover and enquire about stays; hosts manage inventory, enquiries, off-platform payment evidence, and paid platform access; administrators control trust, moderation, billing visibility, and platform settings.

The product’s distinguishing operational model is enquiry-first rather than instant-book-first. A guest requests dates, the host approves or declines, the guest submits payment evidence, and the host confirms the stay. The backend preserves state changes, availability holds, deadlines, proof access, disputes, and notifications. Separately, hosts pay Ideal Stay through Yoco-backed subscription and service payment flows.

The architecture is Encore-first. PostgreSQL databases, object buckets, typed service APIs, Pub/Sub events, and scheduled jobs form the durable backend. The frontend is a React 19 single-page application deployed through Vercel-compatible routing and a same-origin Encore proxy. Authentication uses an HttpOnly session cookie.

The codebase already has substantial breadth. Its largest production gaps are depth and operational closure: payment disputes lack full case management and refund orchestration; social publishing is tracked but not sent to social networks; several critical workflows lack backend permission and live-environment tests; availability lacks recurring/import controls; and the repository security policy is still placeholder text.

## 3. Product vision

### 3.1 Vision statement

Build the trusted operating layer for independent South African accommodation: simple enough for a first-time host, rigorous enough for a professional portfolio, and transparent enough for guests and operators to understand exactly where every enquiry, payment, and stay stands.

### 3.2 Product principles

1. **Server-owned truth.** Availability, workflow transitions, billing fulfilment, ownership, and permissions are decided by the backend.
2. **Trust before volume.** KYC, moderation, audit trails, and protected evidence are core product functions.
3. **Operational clarity.** Every active enquiry must have an owner, state, next action, and deadline.
4. **Fail closed around money and access.** Missing proof, invalid ownership, uncertain provider state, or incomplete entitlements must not silently grant value.
5. **Local-market fit.** South African currency, Yoco payments, manual transfer evidence, and host realities are first-class rather than afterthoughts.
6. **One workflow, multiple surfaces.** Guest, host, admin, notification, analytics, and background jobs must agree on the same state.

## 4. Goals and non-goals

### 4.1 Product goals

- Enable a guest to discover a suitable listing and complete an enquiry-to-confirmed-stay journey with transparent states.
- Enable a verified host to publish and operate listings, availability, enquiries, messages, payment review, and reports from one workspace.
- Monetise host access and add-on services through auditable subscriptions, vouchers, managed-hosting payments, and content credits.
- Give administrators the controls required to manage users, listings, KYC, bookings, billing, referrals, reviews, notifications, settings, and audit context.
- Preserve trustworthy system records across asynchronous providers, user actions, scheduled expiry, and retries.
- Maintain a deployable, testable product with deterministic local gates and a separate live-deployment gate.

### 4.2 Non-goals for the current product stage

- Acting as a bank, escrow provider, or automated host payout network.
- Guaranteeing instant booking for all inventory.
- Operating a full social-network publishing platform before provider integrations exist.
- Replacing specialist accounting, tax, or property-management systems.
- Supporting arbitrary international payment providers and currencies in the first production market.
- Treating mocked browser tests as evidence that production providers or the live Encore backend are healthy.

## 5. Users and roles

### 5.1 Guest

Needs to find a suitable property, understand price and availability, send an enquiry, track the host response, submit payment proof securely, message the host, manage stays, and review a completed stay. A guest may also use trip planning and referral features.

### 5.2 Host

Needs to complete identity and KYC requirements, choose a plan, create and moderate listing inventory, control availability, respond to enquiries, review payment evidence, communicate with guests, understand operational deadlines, and monitor performance. Hosts may be self-service or managed by the platform.

### 5.3 Administrator

Needs a cross-platform command surface for user status, listing moderation, KYC review, booking and dispute visibility, subscription and host-billing operations, reviews, referrals, notifications, settings, audit logs, and observability.

### 5.4 Support operator

The domain model includes a support role. Support can participate in selected booking dispute and operational paths, but the visible product surface is less developed than the administrator experience. Permission boundaries must remain explicit rather than inheriting all administrator powers.

### 5.5 Platform owner/operator

Needs reliable revenue state, deployment confidence, policy control, abuse resistance, traceable interventions, and actionable operating metrics.

## 6. End-to-end product journeys

### 6.1 Guest booking journey

1. The guest searches and filters active, visible listings.
2. The guest opens listing details, reviews attributes, price, availability, map context, and approved reviews.
3. If unauthenticated, the application preserves the intended booking destination through sign-up or sign-in.
4. The guest submits dates and party size. The backend validates the listing, ownership conflict, date range, capacity, and availability.
5. A pending enquiry is created and the host is notified.
6. The host views and approves or declines the enquiry. Declines require a structured reason.
7. Approval creates a time-limited availability hold and exposes the listing’s payment instructions and reference.
8. The guest makes payment outside the booking flow and uploads proof to private object storage.
9. The host can confirm payment only when proof is accessible and no open dispute blocks confirmation.
10. Confirmation converts the enquiry to a booked stay and locks availability using end-exclusive occupancy rules.
11. The guest and host can communicate in booking-scoped chat.
12. After an eligible completed stay, the guest can submit a review for moderation and public display.

### 6.2 Host activation journey

1. A person registers, verifies email, and adopts the host role.
2. The host completes profile information and KYC document/selfie submission.
3. An administrator approves or rejects KYC with recorded history and audit context.
4. The host selects a plan or redeems an assigned voucher.
5. Listing creation is gated by KYC, account state, billing state, plan quota, and media entitlement.
6. A listing progresses through draft/pending/moderation to active visibility.
7. The host operates enquiries, availability, inbox, reports, content tools, billing, and referrals from the host workspace.

### 6.3 Subscription payment journey

1. The host chooses a plan, interval, credit pack, or managed-hosting purchase.
2. The frontend calls the server-owned standard billing payment endpoint.
3. Billing creates a local idempotent payment-intent record and a Yoco Checkout session.
4. The browser redirects to Yoco and later returns through the backend return endpoint.
5. Signed webhooks are the primary activation path. Return polling and scheduled reconciliation are recovery paths.
6. All successful paths converge on one fulfilment seam.
7. Subscription fulfilment writes the exact subscription row and updates the host plan; managed hosting also sets management mode.
8. Cancellation or plan change applies to the exact owned subscription and is scheduled at period end where applicable.

### 6.4 Admin trust and operations journey

1. The admin dashboard loads domain data independently so one failed section does not destroy the whole console.
2. Administrators inspect users, account status, KYC, listings, bookings, disputes, subscriptions, host billing, reviews, referrals, notifications, settings, logs, and observability.
3. Destructive or high-impact actions identify the exact target and require confirmation.
4. Backend role and ownership checks remain authoritative; UI hiding is not treated as security.
5. Actions that change trust or access create durable audit/notification effects where required.

## 7. Functional requirements by domain

### 7.1 Identity and account lifecycle

**Implemented baseline**

- Email/password sign-up and login, Google authentication, email verification, password reset, session restoration, profile updates, and profile-photo uploads.
- Roles for guest, host, admin, and support.
- Account states: active, suspended, and deactivated.
- HttpOnly cookie-backed sessions and server-side account-status enforcement.
- Admin user listing, profile updates, account restriction, deletion, and password management.
- Development login is opt-in and must not silently activate in serious environments.

**Requirements**

- ID-1: Anonymous users shall be able to register, verify email, authenticate, and recover access without exposing tokens in client storage.
- ID-2: Protected routes shall preserve and restore safe return intent after authentication.
- ID-3: Suspended or deactivated accounts shall be blocked server-side even if a stale client session exists.
- ID-4: Google authentication shall validate the provider token against the configured web client ID shared consistently across frontend and backend.
- ID-5: Administrative account actions shall be role-restricted, target-specific, and auditable.
- ID-6: Verification and reset tokens shall be single-purpose, expiring, and resistant to replay.

### 7.2 Marketplace discovery and listing detail

**Implemented baseline**

- Public explore route, listing cards/detail, category and search filters, featured carousel, map display, pricing helpers, availability filtering, and responsive navigation.
- Active listing visibility depends on listing status and host operational eligibility; greylisted-host inventory is excluded.
- Listings include location, area, province, type, pricing, discounts, deposit, media, amenities, capacity, category, ratings, coordinates, availability, settlement details, and admin tags.

**Requirements**

- CAT-1: Public discovery shall return only active, eligible listings.
- CAT-2: Search results shall reflect requested dates, party size, category, price, and location filters consistently with backend availability.
- CAT-3: Displayed total price shall use the same night-count, discount, and deposit rules used at enquiry creation.
- CAT-4: Listing detail shall clearly separate nightly accommodation cost, discounts, breakage deposit, and payment instructions that become relevant later.
- CAT-5: Media failure shall degrade gracefully without blocking essential listing information.

### 7.3 Listing creation, moderation, and quota

**Implemented baseline**

- Host create/edit/delete paths, images and video upload, coordinate picking, plan quotas, KYC gate, settlement profiles, status moderation, rejection reason, admin tags, and billing/greylist constraints.
- Listing states include draft, pending, active, inactive, rejected, and archived.

**Requirements**

- LIST-1: Only an eligible host shall mutate owned listings.
- LIST-2: Listing publication shall require valid mandatory fields, coordinates, pricing, capacity, and media rules.
- LIST-3: Plan quota and media entitlements shall be checked by the backend at mutation/upload time.
- LIST-4: Rejection shall include a visible reason and permit correction/resubmission.
- LIST-5: Greylisting shall prevent live host operations and remove affected inventory from public discovery without destroying listing data.
- LIST-6: Object uploads shall use short-lived signed URLs, allowlisted content types, size limits, and ownership-bound object keys.

### 7.4 Availability and inventory

**Implemented baseline**

- Manual date/range blocking, optional notes, interval persistence, server-computed summaries, approved-hold and booked-stay locks, quick block presets, and selected-day inspection.
- Manual actions skip locked nights; booked stays use an end-exclusive checkout date.

**Requirements**

- AVL-1: Backend availability checks shall be authoritative during both enquiry creation and host approval.
- AVL-2: Manual blocks shall not overwrite booking-owned holds or booked inventory.
- AVL-3: Availability mutations shall be idempotent and preserve unchanged interval notes.
- AVL-4: The UI shall identify the source of every locked date and link booking-derived blocks to the owning enquiry.
- AVL-5: The next version should support recurring rules, calendar import/export, conflict explanation, and bulk seasonal controls.

### 7.5 Enquiry, booking, payment proof, and disputes

**Implemented baseline**

- State model: PENDING, VIEWED, RESPONDED, APPROVED, DECLINED, EXPIRED, and BOOKED.
- Payment state: UNPAID, INITIATED, COMPLETED, and FAILED.
- Structured decline reasons, ledger events, last-actor/last-event summaries, response/payment deadlines, expiry jobs, private proof upload/access, host confirmation, and durable payment disputes.
- Host enquiry buckets provide operational queues: Needs Response, Awaiting Guest Payment, Awaiting Payment Confirmation, Confirmed Stays, and Closed Loop.

**Requirements**

- BOOK-1: Every transition shall validate actor role, ownership, current state, and required evidence.
- BOOK-2: Approval shall atomically create the approved hold or fail without changing the enquiry.
- BOOK-3: Proof submission shall store private evidence and make access available only to the guest, owning host, admin, or authorised support.
- BOOK-4: Payment confirmation shall fail closed if proof cannot be accessed or an open dispute exists.
- BOOK-5: Expiry shall release holds, preserve history, and notify affected parties.
- BOOK-6: Guest and host screens shall use backend-derived deadlines and event summaries when available.
- BOOK-7: A dispute shall preserve opener, reason, evidence context, status, resolution, resolver, and timestamps.
- BOOK-8: The next operational version shall add assignee, priority, SLA, internal notes, evidence timeline, refund/outcome tracking, and escalation.
- BOOK-9: If automated guest payment collection is introduced, it shall remain a separate, reconciled money flow from host subscription billing.

### 7.6 Messaging and reusable replies

**Implemented baseline**

- Booking-scoped guest/host messages, system-message metadata, attachment upload, and host quick replies for check-in, checkout, payment information, directions, and house rules.

**Requirements**

- MSG-1: Only booking participants and authorised operators shall access a booking conversation.
- MSG-2: Attachments shall use private signed access and content validation.
- MSG-3: Message sending shall be idempotent enough to prevent duplicate visible messages after retry.
- MSG-4: New-message notifications shall deep-link to the exact conversation.
- MSG-5: Closed-booking retention and messaging policy shall be explicitly defined and consistently enforced.

### 7.7 Reviews and reputation

**Implemented baseline**

- Multi-dimension reviews for cleanliness, accuracy, communication, location, and value; moderation states; public listing reads; admin approve/reject/delete; and AI review-summary support.

**Requirements**

- REV-1: Only the guest on an eligible completed stay shall create one review for that stay.
- REV-2: Public scores shall use approved reviews only.
- REV-3: Moderation actions shall not silently rewrite the guest’s review content.
- REV-4: AI summaries shall be labelled as generated, grounded only in approved reviews, and resilient to provider failure.

### 7.8 Host subscriptions, vouchers, and billing operations

**Implemented baseline**

- Standard, professional, and premium plans; monthly/annual intervals; subscription rows; plan changes; cancellation scheduling; expiry/grace lifecycle; vouchers; card metadata; reminders; greylisting; content entitlements; managed-hosting payment; admin subscription visibility and exact-row actions.
- Yoco-backed standard payment intents with signed webhook handling, checkout/order reconciliation, provider-mode separation, idempotency, and unified fulfilment.

**Requirements**

- BILL-1: Provider payment state shall never be inferred from a query string alone.
- BILL-2: Webhook verification shall use the exact raw payload and configured secret.
- BILL-3: Successful fulfilment shall be idempotent and converge on one function per purchase purpose.
- BILL-4: Status polling shall return the stored state even when provider reconciliation fails; internal failure shall be logged rather than exposed as a generic customer-facing 500.
- BILL-5: Subscription cancellation/change shall validate ownership of the exact subscription ID.
- BILL-6: Plan entitlements shall derive from active subscription/billing state, not client-selected labels.
- BILL-7: Test and live provider modes shall never mix credentials, return state, or fulfilment records.
- BILL-8: Operators shall be able to identify pending, paid, failed, cancelled, expired, grace-period, and reconciliation-stuck records.
- BILL-9: Financial reporting shall separate platform subscription revenue, managed-hosting revenue, content credits, and any future guest-stay payment flow.

### 7.9 KYC, trust, and administrative operations

**Implemented baseline**

- KYC upload requests, submission/resubmission, user and admin history, review, secure asset previews, encrypted sensitive fields, identity status sync, notifications, and audit logs.
- Admin sections cover users, listings, bookings, KYC, financials, reviews, referrals, notifications, platform settings, audit information, and observability.

**Requirements**

- OPS-1: KYC evidence shall be encrypted where sensitive, private in storage, and exposed only through short-lived authorised access.
- OPS-2: Review shall record reviewer, decision, reason, and timestamp without destroying prior submission history.
- OPS-3: Admin sections shall fail independently and expose partial-data errors clearly.
- OPS-4: Destructive actions shall use exact identifiers, confirmation, server-side constraints, and audit records.
- OPS-5: Platform settings shall be validated server-side and changes attributed to the operator.
- OPS-6: The next version shall support KYC/dispute cases, assignees, SLAs, escalation, and structured internal notes.

### 7.10 Notifications

**Implemented baseline**

- User notifications with info/warning/success/error types, action paths, read state, bulk read, dismissal, and administrator-created notifications.

**Requirements**

- NOTIF-1: Domain notifications shall be generated from durable workflow events, not only frontend actions.
- NOTIF-2: Read and dismissal state shall be user-specific and persistent.
- NOTIF-3: Action paths shall be safe internal routes and deep-link to the relevant object.
- NOTIF-4: Duplicate event delivery shall not create unbounded duplicate notifications.
- NOTIF-5: Email/SMS/push channels, if added, shall respect preference, consent, delivery, and retry policy.

### 7.11 Referrals and growth

**Implemented baseline**

- Referral codes, signup/booking/subscription triggers, guest and host programs, reward statuses, account balances, tier/leaderboard display, subscription conversion hooks, and admin reward management.

**Requirements**

- REF-1: Self-referral and duplicate reward attempts shall be rejected.
- REF-2: Each qualifying event shall award at most once through an idempotency key.
- REF-3: Reward status, value, trigger, program, and beneficiary shall remain traceable.
- REF-4: Withdrawal is not considered complete until payout identity, fraud checks, settlement, and reversal policy are designed.

### 7.12 Content Studio and AI trip planning

**Implemented baseline**

- Host content draft generation, editable drafts, scheduling/publish-state tracking, plan-based entitlements and credit top-ups, social image helper, review summary helper, and authenticated holiday planner.
- Gemini and DeepSeek provider adapters, input validation, rate limiting, bounded prompts, provider fallback, and explicit provider-error handling.

**Requirements**

- AI-1: AI requests shall validate length, shape, actor, entitlement, and rate limit before provider invocation.
- AI-2: Provider secrets shall remain server-side and errors shall be mapped to safe product messages.
- AI-3: Generated travel or marketing content shall be presented as assistance, not verified fact.
- AI-4: Credit consumption shall be atomic with successful generation or compensatable after provider failure.
- AI-5: “Published” shall mean state tracking only until real platform APIs exist; the UI shall not imply external delivery.
- AI-6: Real publishing requires OAuth connection management, channel permissions, provider-specific validation, delivery IDs, retry policy, and failure reporting.

### 7.13 Analytics, reporting, and observability

**Implemented baseline**

- Analytics event ingestion/subscriptions, event counters, compaction, host reports, admin observability, structured workflow state, and Sentry-enabled frontend monitoring.

**Requirements**

- DATA-1: Product events shall use stable names and exclude secrets, raw identity documents, payment proof, and unnecessary personal data.
- DATA-2: Revenue, conversion, SLA, dispute, KYC, inventory, and engagement metrics shall derive from durable backend state.
- DATA-3: Provider calls and background jobs shall expose success/failure counts, latency, retries, and stuck-record indicators.
- DATA-4: Operators shall be able to trace a workflow by user, listing, enquiry, payment intent, subscription, and provider reference without exposing data across roles.

### 7.14 Legal and policy surfaces

**Implemented baseline**

- Public privacy, terms, host agreement, guest agreement, liability waiver, and cancellation-policy routes.

**Requirements**

- LEGAL-1: Legal documents shall remain publicly reachable and versioned.
- LEGAL-2: Material policy acceptance shall record document version, actor, and timestamp where legally required.
- LEGAL-3: Product behavior, especially cancellation, refunds, deposits, data retention, and host/guest liability, shall match published policy.

## 8. Information model

The principal product entities are:

- **User/Profile:** identity, role, account state, referral identity, plan, host management mode, KYC state, and settlement preferences.
- **Listing:** host-owned accommodation inventory, media, capacity, pricing, moderation, coordinates, availability, settlement profile, and operational tags.
- **Availability block:** interval owned by a manual action, approved hold, or booked stay.
- **Booking/Enquiry:** guest, host, listing, dates, party, prices, inquiry state, payment state, evidence access, decline data, and workflow timestamps.
- **Inquiry ledger and ops summary:** durable movement history, latest actor/event, deadlines, and dispute count.
- **Payment dispute:** issue, opener, state, resolution, resolver, and audit timestamps.
- **Message:** booking-scoped communication, system metadata, suggestion type, and attachment.
- **Review:** stay-linked rating dimensions, comment, and moderation status.
- **Subscription and host-billing account:** plan, interval, lifecycle, source, card metadata, grace/greylist state, and next action.
- **Billing payment intent/checkout:** local purchase identity, purpose, provider references, status, mode, idempotency, and fulfilment state.
- **KYC submission:** current and historical protected evidence, review status, and audit context.
- **Referral reward:** referrer, referred user, program, trigger, amount, and lifecycle.
- **Notification:** user-targeted message, type, action, read/dismissal state.
- **Content draft/entitlement:** generated marketing content, scheduling state, included usage, and purchased credits.
- **Platform settings/audit/analytics:** operator-controlled configuration and system traceability.

All monetary values require an unambiguous currency and storage unit. Current product copy and Yoco positioning imply South African rand; database/API contracts should explicitly standardise whether amounts are decimal rand or integer cents per entity to prevent cross-flow errors.

## 9. Architecture and service ownership

### 9.1 Frontend and edge

- React 19, TypeScript, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS v4, Leaflet, Recharts, and Sentry.
- Vite build with Express development server.
- Vercel rewrites `/api/encore/*` to a same-origin serverless proxy and routes non-API paths to the SPA.
- Local server and Vercel functions provide AI endpoints, session-cookie handling, health checks, and Encore proxying.

### 9.2 Encore backend services

- **identity:** authentication, profiles, account status, Google sign-in, password/email lifecycle, referral leaderboard, and profile media.
- **catalog:** listings, media, quotas, settlement profiles, moderation metadata, and availability.
- **booking:** enquiries, workflow transitions, evidence, ledger, expiry, operational summaries, and disputes.
- **billing:** plans, subscriptions, vouchers, host billing, payment intents, Yoco, content entitlements, and scheduled reconciliation.
- **messaging:** booking conversations, attachments, quick replies, and event subscriptions.
- **referrals:** referral programs, rewards, admin management, and conversion hooks.
- **reviews:** stay reviews and moderation.
- **ops:** KYC, notifications, settings, audit logs, storage, and observability.
- **analytics:** event subscriptions, counters, and compaction.

Each service owns its PostgreSQL schema and should expose typed APIs or events instead of permitting implicit cross-domain database coupling.

### 9.3 Storage and asynchronous processing

- Object buckets hold listing media, profile photos, chat attachments, KYC documents, payment proof, and moderation evidence with visibility appropriate to each data class.
- Pub/Sub connects domain changes to notifications, analytics, referrals, and other secondary effects.
- Scheduled jobs expire enquiries, reconcile billing payments, expire subscriptions, send billing reminders, and compact analytics.

## 10. Security, privacy, and compliance requirements

- SEC-1: Authentication and authorisation shall be enforced by every protected backend endpoint.
- SEC-2: Ownership checks shall use server-derived actor identity and exact row identifiers.
- SEC-3: Session cookies shall be HttpOnly, Secure in production, SameSite-appropriate, scoped, and revocable.
- SEC-4: Secrets shall be loaded through environment/Encore secret management and never shipped to the browser or repository.
- SEC-5: Production configuration shall fail closed when `ENCORE_API_URL`, OAuth identity, provider mode, or critical encryption keys are missing/mismatched.
- SEC-6: Signed uploads shall constrain object key, content type, size, lifetime, and actor ownership.
- SEC-7: KYC, payment proof, and private attachments shall never use public bucket URLs.
- SEC-8: Yoco webhooks shall verify signature against the raw body and tolerate duplicate delivery safely.
- SEC-9: AI inputs/outputs shall be bounded, rate-limited, logged without sensitive payload leakage, and protected from arbitrary upstream URL selection.
- SEC-10: Audit records shall be append-oriented, attributable, and access-restricted.
- SEC-11: Retention and deletion rules shall be defined per data class, especially KYC, proof, messages, audit records, and deactivated accounts.
- SEC-12: The placeholder `SECURITY.md` shall be replaced before public production with supported-version policy, a private reporting channel, response expectations, disclosure policy, and contact ownership.

## 11. Non-functional requirements

### 11.1 Reliability

- Critical mutations must be idempotent or carry idempotency keys.
- Provider/network failure must not corrupt local state or grant entitlement.
- Background jobs must be retry-safe and report checked/succeeded/failed/stuck counts.
- The admin console must tolerate partial service failure.

### 11.2 Performance

- Public catalogue interactions should reach usable content quickly on typical South African mobile networks.
- Route-level code splitting must be retained.
- Large media must be constrained and delivered in appropriate sizes/formats.
- High-fan-out admin and report views should use pagination, bounded queries, and aggregates rather than unbounded entity loading.

### 11.3 Accessibility and responsive behavior

- All core journeys shall be keyboard operable and screen-reader understandable.
- Dialogs must trap and restore focus, expose labels, and avoid action ambiguity.
- Color shall not be the sole carrier of status.
- Guest, host, and admin critical workflows must remain usable on narrow mobile screens.

### 11.4 Observability

- Every request/job/provider call should carry a traceable correlation identifier where supported.
- Logs must identify the domain entity and outcome without leaking credentials or protected evidence.
- Sentry and backend metrics should distinguish validation, permission, provider, database, and unknown failures.

### 11.5 Maintainability

- Shared workflow rules belong in tested domain helpers, not duplicated page conditions.
- API response types must remain concrete enough for Encore code generation and compile-time validation.
- Cross-service workflows should use typed events/APIs and avoid cross-database joins.
- New features must name the tests that prove both the happy path and the principal rejection path.

## 12. Success metrics

The initial measurement framework should track:

### Marketplace

- Search-to-listing-detail rate.
- Listing-detail-to-enquiry conversion.
- Enquiry approval rate and median host response time.
- Approved-to-proof-submitted and proof-to-confirmed conversion.
- Expiry rate by stage and reason.
- Occupied nights, booked value, and active inventory by province/category.

### Host success

- Registration-to-KYC-submitted and KYC-approved conversion.
- KYC approval turnaround time and rejection/resubmission rate.
- Approved-host-to-first-active-listing time.
- Active listing count and enquiry response SLA compliance.
- Subscription conversion, renewal, cancellation, grace, and greylist rates.

### Trust and operations

- Payment-proof access failures.
- Dispute rate, age, resolution time, outcome, and recurrence.
- Moderation queue age and reversal rate.
- Notification delivery/read/action rate.
- Provider webhook success, reconciliation recovery, and stuck-payment count.

### Quality

- Error-free session rate, API error rate, and frontend crash rate.
- Core workflow test pass rate and live smoke pass rate.
- P95 latency for discovery, session restoration, booking mutation, and admin queue reads.
- Accessibility defects and mobile critical-flow failures.

Targets should be set after a clean instrumentation baseline. Invented targets before measurement would create false precision.

## 13. Current quality and verification model

The repository uses layered evidence:

- Unit tests for state machines, pricing, entitlements, availability, provider configuration, and helpers.
- Client/contract tests for frontend-to-backend mappings and critical source seams.
- Vitest UI tests for routes, dashboards, billing, onboarding, KYC-adjacent states, notifications, and content tools.
- Mocked Playwright journeys for authentication, booking/payment review, host billing, KYC/admin review, content studio, and happy paths.
- TypeScript, ESLint, drift analysis, bundle budget, build, and production-config checks.
- Separate live smoke tooling for deployed frontend-to-Encore behavior.

Required baseline:

```text
npm run lint
npm run test
npm run test:e2e
npm run build
cd encore
npx tsc --noEmit
```

Mocked Playwright tests prove browser workflow behavior, not production backend or provider health. Production readiness additionally requires seeded disposable accounts and the live smoke gate through the deployed same-origin proxy.

## 14. Constraints, assumptions, and dependencies

- The initial commercial and payment market is South Africa.
- Yoco is the current platform-payment provider.
- Guest stay payment is presently coordinated through host instructions and uploaded proof rather than a complete marketplace settlement rail.
- Encore supplies backend service, database, bucket, Pub/Sub, cron, and deployment primitives.
- Vercel-compatible edge functions proxy Encore and host AI helpers.
- Google OAuth, Resend, Gemini/DeepSeek, maps/geocoding, Sentry, and object storage require correctly managed runtime configuration.
- Listing quality, payment confirmation, and host response still depend partly on human operational discipline.
- Legal, tax, payment-service, POPIA/privacy, and accommodation-sector obligations require qualified review outside source-code analysis.

## 15. Risks and mitigations

### Financial state divergence

**Risk:** Yoco succeeds while local fulfilment remains pending, or a duplicate event applies value twice.  
**Mitigation:** signed webhook primary path, idempotent intent and fulfilment records, return/status recovery, scheduled reconciliation, exact provider references, and stuck-payment operations view.

### Off-platform stay payment ambiguity

**Risk:** proof is falsified, inaccessible, disputed, or confirmed inconsistently.  
**Mitigation:** private evidence, fail-closed confirmation, durable dispute trail, structured case management, and future provider/payout design that explicitly separates guest funds from platform revenue.

### Trust-data exposure

**Risk:** KYC, proof, or attachments leak through public URLs, logs, or broad operator access.  
**Mitigation:** private buckets, encrypted sensitive fields, short-lived URLs, least privilege, retention rules, audit, and log redaction.

### Workflow disagreement

**Risk:** guest, host, admin, notifications, and availability show different interpretations.  
**Mitigation:** backend state machine, domain events, server-derived summaries, tested shared helpers, and deterministic cross-role fixtures.

### Breadth outrunning depth

**Risk:** many visible features appear complete while permissions, live integration, or failure recovery remain shallow.  
**Mitigation:** release gates based on complete journeys and rejection paths, not page presence; prioritise operational closure before new breadth.

### Policy/code mismatch

**Risk:** legal pages or platform claims diverge from implemented cancellations, refunds, evidence, or data retention.  
**Mitigation:** version policy acceptance, legal review, requirement-to-policy mapping, and release checklist ownership.

## 16. Prioritised roadmap

### Phase 0: Production credibility

- Replace the placeholder security policy.
- Verify environment/secret parity across Vercel and Encore, including encryption and OAuth identities.
- Complete backend permission and transition tests for booking disputes, KYC, uploads, reviews, referrals, notifications, and destructive admin actions.
- Run deterministic repo verification and live smoke against the intended deployment.
- Add stuck-payment, failed-job, and partial-admin-data operational alerts.

### Phase 1: Close the core transaction loop

- Add dispute/case assignee, SLA, priority, internal notes, evidence timeline, escalation, and refund/outcome tracking.
- Add Playwright dispute open/resolve and completed-stay review journeys.
- Add backend notification generation tests per core booking transition.
- Make currency and amount units explicit across booking, billing, referral, and reporting schemas.

### Phase 2: Strengthen host operations

- Add recurring availability, calendar import/export, and seasonal bulk rules.
- Add messaging end-to-end coverage, attachment policy, and closed-conversation rules.
- Improve reports with conversion, response time, occupancy, dispute, and revenue separation.
- Formalise support-role capabilities and queues.

### Phase 3: Growth with control

- Add real social account connections and delivery tracking instead of local publish-state only.
- Complete referral anti-abuse, withdrawal/payout policy, and reversal handling before cash-out.
- Improve AI grounding, generated-content labelling, cost visibility, and entitlement accounting.

### Phase 4: Marketplace payment expansion, only if strategically chosen

- Design guest-payment collection, escrow/settlement, refunds, chargebacks, host payouts, reconciliation, tax/invoice treatment, and regulatory responsibilities as a dedicated programme.
- Do not bolt guest funds onto the host-subscription payment model.

## 17. Release acceptance criteria

A production release is acceptable only when:

- All baseline lint, type, unit, UI, contract, e2e, and build gates pass.
- The deployed live-smoke journey passes against the correct Encore environment.
- Required secrets and provider modes are confirmed without exposing values.
- Guest, host, and admin can complete the targeted release journey on desktop and mobile.
- Core rejection paths—unauthorised actor, wrong owner, invalid state, unavailable dates, inaccessible evidence, duplicate provider event, and provider failure—behave safely.
- Database migrations are additive/reversible enough for the release plan and have been tested against representative data.
- Observability can distinguish application, provider, configuration, and permission failures.
- Legal/policy content is consistent with any changed payment, cancellation, refund, KYC, or data behavior.
- Rollback or mitigation ownership is explicit for frontend, Encore backend, migrations, and provider configuration.

## 18. Open product decisions

1. Will Ideal Stay remain enquiry-and-proof-led for guest stay payments, or become merchant/marketplace of record?
2. What exact service levels apply to host response, guest payment, KYC review, disputes, and refunds?
3. What privileges distinguish support from admin, and which actions require dual control?
4. What is the authoritative currency/unit representation for every money-bearing entity?
5. What retention/deletion schedule applies to KYC, payment proof, messages, audit logs, and deactivated users?
6. Does “managed hosting” include operational access to host listings/messages, and how is that consented to and audited?
7. What moderation model and appeal path apply to listings, reviews, accounts, and KYC?
8. Which social channels are commercially important enough to justify real integrations?
9. Which metrics determine product-market fit: confirmed stays, host revenue, active listings, renewal, or a weighted combination?
10. Which legal entity, agreements, and payment licences govern future guest-fund handling?

## 19. Definition of done for future features

A feature is done only when it includes:

- A named user and problem.
- Authoritative backend state and permission rules.
- UI states for loading, empty, success, validation, permission failure, dependency failure, and retry.
- Audit and notification effects where the action changes money, trust, access, or operational ownership.
- Metrics and logs that reveal adoption and failure.
- Tests for the happy path and principal rejection/failure paths at the narrowest effective layers.
- Updated workflow matrix, API/domain documentation, legal copy where relevant, and live-smoke coverage when deployment behavior matters.

---

**Authorship:** Klaasvaakie  
**Signature:** ( |╲ )
