# Workflow Validation Matrix

This document is the source of truth for Ideal Stay workflow coverage. If a route, Encore endpoint, client mapper, UI state machine, or automated test changes a workflow listed here, update this matrix in the same change.

## Source Inputs

- Route map: `src/components/AppRoutes.tsx`
- Service split: `README.md`
- Backend endpoint surface: `encore/*/api.ts`
- Current automated coverage: `tests/**/*.test.ts`, `tests/ui/**/*.test.tsx`, `tests/e2e/**/*.spec.ts`, `scripts/live-smoke.mjs`

## Completion Gate

A workflow is not considered covered until it has:

- at least one explicit happy-path automated test
- at least one core rejection or failure-mode automated test
- documented role and permission rules
- documented async/background behavior, if any
- documented notification side effects, if any
- documented external dependency boundaries, if any

Layer ownership:

- pure business rules: unit tests
- frontend/backend contract mapping: client tests
- page behavior and state transitions: UI tests
- cross-role journeys: Playwright e2e
- cron, webhook, signed upload, and provider behavior: backend-focused tests

Reality check:

- current `tests/e2e/*.spec.ts` coverage mostly routes `/api/encore/**` through Playwright mocks and should be treated as UI-contract coverage unless a spec explicitly says it is live
- `scripts/live-smoke.mjs` is the live environment gate for preview and production hosts through the same-origin proxy

## Route And Service Map

| Workflow | Owner area | Frontend entry points | Backend service and endpoints | Expected outcome |
| --- | --- | --- | --- | --- |
| Auth and account lifecycle | Identity | `/signup`, `/account`, guarded `/guest`, host/admin route guards | `identity`: `signup`, `login`, `requestEmailVerification`, `verifyEmail`, `requestPasswordReset`, `resetPassword`, `getSession`, `upsertProfile`, `requestProfilePhotoUpload`, `uploadProfilePhoto`, `adminSetAccountStatus`, `adminDeleteUser`, `adminSetPassword` | Users can create, verify, access, update, switch roles, upload profile photos, reset passwords, and be restricted safely. |
| Listing discovery and booking request | Catalog, Booking | `/`, listing detail modal, `/guest` | `catalog`: `listListings`, `getListing`; `booking`: `createBooking`, `listMyBookings`; `reviews`: `listListingReviews` | Guests discover available listings and submit valid booking enquiries against available stay dates. |
| Booking, enquiry, and payment lifecycle | Booking, Catalog, Ops | `/guest`, `/host/enquiries`, `/host`, `/host/reports`, chat/payment proof dialogs | `booking`: `createBooking`, `listMyBookings`, `listAdminBookings`, `listInquiryLedger`, `getBookingOpsSummary`, `listPaymentDisputes`, `openPaymentDispute`, `resolvePaymentDispute`, `markInquiryViewed`, `updateBookingStatus`, `submitPaymentProof`, `confirmPayment`, `runInquiryExpiryCycle`; `catalog`: availability block helpers; `ops`: notifications | Enquiries move through pending, approved, declined, payment proof, confirmed, expired, disputed, and reviewable states with inventory holds released correctly. |
| Host availability management | Catalog | `/host/availability`, `/host/listings`, listing detail availability filtering | `catalog`: `updateListingAvailability`, `updateListingAvailabilityBlocks`, `getListingAvailabilitySummary`; `booking`: confirmed/approved holds | Hosts can block and unblock manual dates without overriding approved holds or confirmed stays. |
| Listing creation, editing, quota checks, media upload | Catalog, Billing, Ops | `/host/create-listing`, `/host/edit-listing/:id`, `/host/listings`, `/pricing` | `catalog`: `getMyListingQuota`, `saveListing`, `deleteListing`, `requestListingMediaUpload`, `uploadListingImage`, `uploadListingVideo`; `billing`: host plan/account endpoints; `ops`: admin moderation notifications | Hosts create and maintain listings within plan, KYC, greylist, quota, and media entitlement rules. |
| KYC submission and admin review | Ops, Identity | `/account`, `KYCModal`, `/host/create-listing`, `/admin` KYC section | `ops`: `requestKycUpload`, `submitKyc`, `getMyKycSubmission`, `getMyKycSubmissionHistory`, `listKycSubmissions`, `getKycSubmissionHistory`, `reviewKycSubmission`, `getKycSubmissionAssets`; `identity`: `setUserKycStatus` | Hosts submit identity evidence; admins approve or reject; host capabilities reflect the effective KYC state and both sides retain review history. |
| Subscription checkout, voucher redemption, card setup, greylisting, webhook completion | Billing, Catalog, Identity, Ops | `/pricing`, `/host`, `/admin` users/billing sections | `billing`: `listPlans`, `createBillingPayment`, `getBillingPaymentStatus`, `listMySubscriptions`, `getMyHostBillingAccount`, `redeemVoucher`, `listAdminHostBilling`, `adminSetHostGreylist`, `getCheckoutStatus`, `yocoWebhook`; `catalog`: greylist visibility restrictions | Host billing source and plan state determine listing entitlements, commercial access, reminders, and greylist locks. |
| Content Studio draft generation, scheduling, publish-state tracking, credit top-up | Billing, AI helpers | `/host/social` | `billing`: `getMyContentEntitlements`, `createBillingPayment`, `getBillingPaymentStatus`, `generateContentDraft`, `listMyContentDrafts`, `updateContentDraft`, `getCheckoutStatus`; local AI/provider helpers | Hosts generate, save, schedule, and mark social drafts while credits and included usage remain consistent. |
| Messaging and attachment upload | Messaging, Booking, Ops | `/host/inbox`, `/host/quick-replies`, `/guest`, booking chat dialog | `messaging`: `listMessages`, `sendMessage`, `requestAttachmentUpload`, `getMyQuickReplies`, `updateMyQuickReplies`; `booking`: booking access checks; `ops`: message notifications | Guests and hosts exchange booking-scoped messages, attachments, and host-owned quick reply templates only when they are parties to the booking. |
| Reviews | Reviews, Booking, Ops | `/guest`, listing detail reviews, `/admin` reviews section | `reviews`: `listListingReviews`, `createReview`, `listAllReviews`, `updateReviewStatus`, `deleteReview`; `booking`: review eligibility | Guests review completed stays; public listings show approved reviews; admins moderate review visibility and deletion. |
| Notifications | Ops | global notification provider, nav bell, `/admin` notifications section | `ops`: `listMyNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `dismissNotification`, `listAdminNotifications`, `createAdminNotification`, `deleteAdminNotification`; domain notification builders | Users receive actionable workflow notifications with persisted read/dismissed state. |
| Referrals and leaderboard | Referrals, Identity, Ops | `/referral`, `/host/referrals`, `/account`, `/admin` referrals section | `referrals`: `listMyReferralRewards`, `rewardReferral`, `listAdminReferralRewards`, `createAdminReferralReward`, `deleteAdminReferralReward`; `identity`: `listReferralLeaderboard` | Referral signups and manual rewards appear consistently to users and admins without corrupting reward state. |
| Admin moderation and platform settings | Ops, Identity, Catalog, Booking, Reviews, Referrals, Billing | `/admin` | `identity`: user admin endpoints; `catalog`: listing admin paths through clients; `booking`: `listAdminBookings`; `reviews`: moderation endpoints; `referrals`: admin reward endpoints; `billing`: admin host billing endpoints; `ops`: settings, audit, notifications, observability | Admins can moderate users, listings, enquiries, reviews, KYC, referrals, notifications, billing, and settings with destructive actions guarded. |
| Trip planner and AI-assisted planning | AI helpers, frontend planning | `/planner` | local AI endpoints through `api/ai/*`; provider helpers and rate limit rails | Guests receive bounded AI planning responses with validated inputs, provider fallback, and rate limiting. |
| Legal documentation and public policy pages | Frontend documentation | `/privacy`, `/terms-of-service`, `/host-agreement`, `/guest-agreement`, `/liability-waiver`, `/cancellation-policy` | none | Public legal and policy pages stay reachable from the app shell and footer without being mistaken for protected host routes. |

## Validation Matrix

| Workflow | Happy path | Key rejection and error paths | Role and permission rules | Async/background side effects | Notification side effects | External dependency boundaries | Current explicit coverage | Required next coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth and account lifecycle | Signup, verify email, signin, profile update, role switch, profile photo upload, password reset | Duplicate email, invalid credentials, expired/invalid verification token, expired/invalid reset token, suspended/deactivated account, profile photo upload failure | Anonymous users can signup/login/reset; authenticated users can update self; admins can restrict/delete/set password; host route requires host role; admin route requires admin | Email verification and reset mail delivery; account restrictions pause live host listings | Verification/reset emails; admin status notification when created from admin workflow | Resend/email provider; profile photo signed bucket upload; HttpOnly session cookie | `tests/ui/auth-context.test.tsx`, `tests/session-cookie.test.ts`, `tests/dev-login-env.test.ts`, `tests/account-status.test.ts`, `tests/api-clients.test.ts`, `tests/workflow-client-contracts.test.ts`, `tests/e2e/auth-account.spec.ts` | Backend auth token expiry/reuse tests; UI account profile/photo failure tests |
| Listing discovery and booking request | Guest filters listing dates, opens listing, submits booking request | Unavailable dates, invalid date range, unauthenticated booking, listing hidden/inactive/greylisted, host cannot book own listing | Public can read active listings; authenticated guests create bookings; greylisted hosts are hidden; backend owns final availability check | Booking creation creates pending enquiry and may create ledger/audit records | Host receives enquiry notification | Map/media image loading; review summary AI only when invoked | `tests/listing-availability-ui.test.ts`, `tests/catalog-availability.test.ts`, e2e smoke starts booking request | Playwright discovery with unavailable listing exclusion; backend createBooking rejection cases; UI unauthenticated booking path |
| Booking, enquiry, and payment lifecycle | Guest requests; host approves; guest submits payment proof; host confirms; guest or ops opens dispute when needed; host or ops resolves it; guest reviews; host reports summarize operational movement | Host declines with reason, invalid transition, guest direct completion, expired pending enquiry, expired approved hold, payment proof on wrong state, confirmation on wrong state, inaccessible stored proof asset, duplicate dispute open, dispute resolution without open case, availability conflict | Guest owns request/payment proof/dispute open/review; host owns approve/decline/confirm/dispute resolution for own listing; admin/support can inspect all bookings, read booking ops summaries, and resolve disputes | `inquiryExpiryCron` and `runInquiryExpiryCycle`; approved holds and confirmed stays update availability ledger; dispute resolution can push approved enquiries back to `FAILED` payment state; booking ops summary derives deadlines and latest workflow movement from backend state | Booking status, payment requested, payment proof submitted, confirmation, decline, expiry notifications | Off-platform bank transfer plus private bucket-backed payment proof evidence; future payment provider classification | Strong unit/UI/client/e2e coverage: `tests/booking-workflow.test.ts`, `tests/inquiry-state.test.ts`, `tests/ui/guest-dashboard.test.tsx`, `tests/ui/host-dashboard.test.tsx`, `tests/ui/host-enquiries.test.tsx`, `tests/booking-ops-summary-client-contract.test.ts`, `tests/payment-dispute-client-contract.test.ts`, `tests/platform-errors.test.ts`, `tests/booking-ops-derivation.test.ts`, client tests, `tests/e2e/happy-path.spec.ts`, `tests/e2e/booking-payment-review.spec.ts`, and contract coverage in `tests/payment-dispute-contract.test.ts`, `tests/booking-ops-summary-contract.test.ts`, and `tests/host-enquiries-payment-review-contract.test.ts` | Backend dispute permission/state-transition tests; Playwright dispute open/resolve flow; notification generation per transition |
| Host availability management | Host blocks/unblocks range; locked approved/confirmed dates remain protected | Unblock locked date, invalid interval, non-owner listing update, stale legacy blocked date fallback, backend summary missing | Host can mutate own listing availability; public/guest read availability; locked booking-derived dates are not manually mutable | Availability summary refresh; booking approval/confirmation writes booking-owned blocks | Usually none directly unless admin/user-facing changes added | None beyond backend DB and direct listing media unrelated | `tests/catalog-availability.test.ts`, `tests/host-availability.test.ts`, `tests/listing-availability-ui.test.ts` | Playwright host block/unblock with locked date behavior; backend permission tests; UI backend failure/fallback test |
| Listing creation, editing, quota checks, media upload | Verified host creates listing within plan, uploads allowed media, edits listing, admin approves/rejects if needed | KYC missing/rejected, quota exceeded, greylisted host, media too large, too many photos/video forbidden, direct upload CORS failure, non-owner edit/delete | Host owns own listings; admin moderates; standard host has limited listing/media entitlements; greylisted hosts locked | Signed upload generation; listing status may await moderation | Admin/listing moderation notifications | Listing image/video buckets; browser direct upload CORS | `tests/ui/create-listing.test.tsx`, `tests/catalog-billing-helpers.test.ts`, media/client tests in `tests/api-clients.test.ts` | Playwright create/edit listing with plan limits and media rules; backend signed upload permission tests; admin moderation e2e |
| KYC submission and admin review | Host submits ID/selfie; admin previews assets; admin approves/rejects; host capabilities refresh; audit-backed history is available to the host and ops | Missing docs, upload failure, preview unavailable, duplicate pending submission, rejection reason missing, non-admin review attempt | User submits own KYC; admin reviews all; verified KYC gates listing creation; audit history is limited to the owner plus admin/support | Secure asset preview URL generation; status sync between ops and identity; audit log writes on submission, resubmission, and review | Approval/rejection notifications | KYC docs bucket; secure asset preview URLs | Client coverage in `tests/api-clients.test.ts`; contract coverage in `tests/workflow-client-contracts.test.ts` and `tests/kyc-history-contract.test.ts`; Playwright host submission -> admin review/approval -> host verified state in `tests/e2e/kyc-admin-review.spec.ts` | Backend permission and duplicate submission tests; backend history response-shape tests; admin rejection e2e; UI preview failure test |
| Subscription checkout, voucher redemption, card save, greylisting, webhook completion | Host chooses plan, redeems voucher or starts checkout, saves card, checkout/webhook refreshes state, admin greylist toggles | Invalid voucher, reused voucher, provider checkout failure, missing card after grace period, greylisted host attempting listing/booking ops, failed/cancelled webhook | Host manages own billing; admin can inspect and greylist; greylisted host cannot mutate live host operations | Billing reminder cycle; greylist eligibility; webhook completion; checkout status polling | Billing reminder, greylist, successful checkout/credit notifications | Yoco checkout/webhooks; card tokenization; voucher seed inventory | `tests/host-billing-lifecycle.test.ts`, `tests/host-billing-ui.test.ts`, `tests/catalog-billing-helpers.test.ts`, `tests/api-clients.test.ts`, `tests/payment-yoco-contracts.test.ts`, `tests/e2e/host-billing.spec.ts` | Backend billing reminder cycle tests; greylisted host e2e operation lock |
| Content Studio draft generation, scheduling, publish-state tracking, credit top-up | Host generates draft, consumes included usage/credits, saves, schedules, marks published, tops up credits | No entitlement, insufficient credits, invalid listing/context, provider failure, invalid schedule date, publish-state regression | Host owns own content drafts; admin visibility only if added later | Credit checkout completion; scheduled publish tracking is stateful but not a real social post yet | Credit purchase/draft status notifications if enabled | AI providers; future social platform APIs; payment checkout for credits | `tests/social-template-engine.test.ts`, `tests/ai-client.test.ts`, `tests/text-generation.test.ts`, `tests/workflow-client-contracts.test.ts`, `tests/content-entitlements.test.ts`, `tests/ui/social-dashboard.test.tsx`, `tests/e2e/content-studio.spec.ts`, `tests/payment-yoco-contracts.test.ts` | Content credit webhook fulfilment test |
| Messaging and attachment upload | Guest/host open booking chat, send message, upload attachment; host edits reusable quick replies | Non-party access, missing booking, empty message, attachment upload failure, unsafe filename/content type, invalid quick reply copy, closed booking policy if enforced | Only booking guest and booking host can access booking messages; host owns quick reply settings | Attachment signed upload; message persistence; quick reply settings persistence | Message notification to counterparty | Chat attachments bucket; direct upload CORS | `tests/backend-notification-helpers.test.ts`, `tests/workflow-client-contracts.test.ts`; no explicit messaging UI/e2e coverage yet | Playwright host/guest messaging; backend party permission tests; attachment signed upload test |
| Reviews | Guest with completed stay submits review; public listing shows approved review; admin approves/rejects/deletes | Non-completed booking, duplicate review, non-guest review, invalid rating, rejected review hidden, destructive delete guarded | Guest reviews own completed booking; public reads approved listing reviews; admin moderates | Optional review summary generation if invoked | Review submitted/moderated notifications | AI review summary provider when used | `tests/api-clients.test.ts`, `tests/ai-client.test.ts`, `tests/workflow-client-contracts.test.ts`; no full review e2e workflow yet | Playwright completed stay -> review -> admin moderation; backend eligibility/duplicate tests; UI listing review visibility test |
| Notifications | Domain event creates notification; user reads/dismisses; admin creates/deletes broadcast/targeted notification | Read nonexistent notification, non-owner read/dismiss, admin send invalid target, delete nonexistent notification, poll failure | Users manage own notification read/dismiss state; admin manages admin notifications | Polling-backed delivery; read state persisted | This is the notification system | None external today beyond Encore proxy | `tests/ui/notification-context.test.tsx`, `tests/backend-notification-helpers.test.ts`, client tests | Backend notification generation tests per workflow; Playwright read/dismiss behavior; admin create/delete UI test |
| Referrals and leaderboard | Referral link/code signup creates reward; user sees reward; leaderboard reflects counts; admin creates/deletes manual reward | Invalid code, self-referral, duplicate reward, rejected reward state, delete nonexistent reward | Users read own rewards/leaderboard; admin manages rewards | Reward creation may occur during signup or admin action | Referral reward notification | None external today | `tests/api-clients.test.ts`, `tests/backend-notification-helpers.test.ts`, `tests/workflow-client-contracts.test.ts` | Playwright referral link signup and reward visibility; backend duplicate/self-referral tests; UI referral page tests |
| Admin moderation and platform settings | Admin reviews users/listings/KYC/reviews/referrals/notifications/settings and guarded destructive actions | Non-admin access, delete protected user with dependencies, listing rejection reason missing, settings validation, partial dashboard endpoint failure | `/admin` route and admin endpoints require admin; destructive actions require clear target and backend constraints | Audit log writes; observability reads; moderation side effects across services | Admin-created and moderation notifications | KYC evidence bucket previews; backend observability DB checks | `tests/ui/admin-dashboard-data.test.tsx`, admin/client tests, account status tests | Playwright admin moderation pack; backend destructive action constraints; platform settings validation tests; audit log tests |
| Trip planner and AI-assisted planning | Guest enters planning prompt; AI returns bounded travel guidance | Empty/oversized chat history, invalid review summary input, provider failure, rate limit exceeded | Public or authenticated access depending route policy; rate limit is actor/IP scoped | Rate limiter state; fallback provider attempts | None currently required | Gemini/DeepSeek providers; server AI endpoint proxy | `tests/ai-client.test.ts`, `tests/ai-rails.test.ts`, `tests/gemini-config.test.ts`, `tests/deepseek-config.test.ts`, `tests/text-generation.test.ts` | Playwright planner happy path with mocked AI; backend/provider failure fallback test at endpoint boundary; UI rate-limit/error state test |
| Legal documentation and public policy pages | Anonymous visitor opens each legal page from the public app shell | Unknown legal route redirects home; `/host-agreement` is not treated as `/host` dashboard route | Public read-only pages; no auth or admin role required | None | None | None | `tests/ui/app-routes.test.tsx` | Playwright footer legal navigation check |

## Deterministic Fixture Contract

Centralize reusable fixtures before adding broad workflow coverage. The fixture layer must be shared across unit, UI, and Playwright tests wherever practical.

Required fixture states:

- users: guest, host, admin, suspended user, deactivated user, greylisted host, verified host, unverified host, KYC-pending host, KYC-rejected host
- listings: active listing, pending listing, inactive listing, draft listing, greylisted-host listing, listing with manual blocks, listing with approved hold, listing with confirmed booked stay
- bookings: pending enquiry, approved awaiting payment, payment proof submitted, confirmed stay, declined with reason, expired pending, expired approved hold, completed reviewable stay
- subscriptions and billing: standard host, paid host, voucher host active, voucher host in reminder window, card-on-file host, greylisted overdue host, checkout pending, checkout paid, checkout failed
- KYC: no submission, pending submission with assets, approved submission, rejected submission with reason, asset preview failure
- notifications: unread, read, dismissed, admin-created targeted, admin-created broadcast, booking/payment/message/referral/review/billing variants
- referrals: pending, approved, rejected, manual admin reward, duplicate-code attempt

Fixture rules:

- Dates must be fixed ISO strings; never depend on wall-clock time without injecting `now`.
- IDs must be stable and semantic enough to read in failed assertions.
- Fixtures should expose builders for small overrides, not one-off copies in every test.
- Playwright route mocks should reuse the same canonical fixture objects as UI and unit tests.
- Provider responses must be deterministic fakes; workflow tests assert Ideal Stay state transitions, not provider behavior.

Suggested location:

- `tests/fixtures/workflows.ts` for shared domain fixtures
- `tests/e2e/fixtures/workflow-routes.ts` for Playwright route handlers built from those fixtures

## Priority Expansion Plan

Highest priority:

1. Auth and account lifecycle
2. Booking, enquiry, and payment lifecycle
3. KYC submission and admin review
4. Subscriptions, host billing, and greylisting
5. Admin moderation and platform settings

Next:

1. Content Studio
2. Messaging and attachment upload
3. Referrals and leaderboard
4. Reviews
5. Notifications
6. Trip planner and AI-assisted planning

Minimum Playwright pack:

- signup -> verify email -> signin
- reset password
- guest booking request -> host approve/decline -> guest payment proof -> host confirm -> review
- host manual availability block/unblock with locked-date behavior
- host create/edit listing with plan limits and media rules
- guest becomes host -> submits KYC -> admin approves/rejects
- host subscription checkout or voucher redemption -> post-checkout state refresh (`tests/e2e/host-billing.spec.ts` covers current pricing checkout return)
- content draft generation -> save -> schedule -> mark published (`tests/e2e/content-studio.spec.ts`)
- host/guest messaging with attachment upload
- referral link signup and reward visibility
- admin moderation of listings, users, reviews, notifications, settings, and destructive guards

Async and external-dependency workflows requiring backend-focused tests:

- booking expiry cycle
- host billing reminder cycle
- payment webhook outcomes
- signed upload flows
- AI endpoints and rate limiting

## CI Baseline

The repo verification baseline is:

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
cd encore && npx tsc --noEmit
```

The live environment gate is separate and should run against a deployed frontend host through the same-origin proxy:

```bash
IDEAL_STAY_RUN_LIVE_SMOKE=true npm run test
# or
npm run smoke:live
```

Do not mark a workflow as complete in this matrix unless its coverage row names the automated tests that prove both the happy path and the core failure mode.
