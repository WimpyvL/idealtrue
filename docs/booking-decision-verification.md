# Booking approval and rejection verification

Candidate code: 85ceb2d9abf51bd4768974f84fc195a7e6b43c36 on Klaasvaakie/billing-safety-20260905.

## Changes

- Corrected the calendar advisory lock that failed when Encore attempted to decode PostgreSQL void. Cloud tests reproduced this failure before the correction.
- Host status decisions serialize by listing and lock the current inquiry row. Concurrent approval/rejection cannot overwrite each other, and competing overlapping approvals are rejected.
- Inquiry state, payment initiation and audit entries commit in one booking database transaction. A failed calendar reservation rolls those changes back.
- Approval reserves dates before exposing payment access. New approvals require the actual availability ledger rather than silently falling back to legacy date merging.
- Repeated identical decisions return current state without resetting expiry, changing rejection notes or adding audit entries.
- Rejection validates its reason and no longer unnecessarily loads host payment settings.
- Shared state writers compare the previous inquiry and payment states to prevent stale updates from overwriting decisions. Decision notifications publish after commit.

## Verification

- Encore Cloud staging release 219t7dcb0mgd0vq9i9gg succeeded on 2026-09-06 with tests enabled and no infrastructure changes.
- https://app.encore.dev/ideal-stay-online-gh5i/envs/staging/deploys/219t7dcb0mgd0vq9i9gg
- 14 Cloud database regressions passed: 8 payment tests and 6 booking decision tests. Booking tests cover approval/calendar hold/payment/audits, rejection notes, invalid reasons, competing decisions, overlapping approvals and final-reservation rollback. Only the request identity is stubbed for booking tests; databases and calendar logic are real.
- Lint and backend type checks passed. The full unit suite retained only its 3 previously known documentation/mock-coverage failures; 260 tests passed.
- Read-only staging GET /billing/plans returned HTTP 200 with 3 plans after deployment. No persistent test bookings or real payments were created.

## Boundaries

Production and main remain unchanged. This work was prepared and committed in the isolated current-main worktree; the original checkout and its unrelated edits were preserved.

Booking and catalog remain separate databases. A catalog hold can survive a failure after reservation but before booking commit; that conservative stale hold needs reconciliation. This change does not claim distributed transaction atomicity, durable notification delivery, or full payment-confirmation/expiry correctness. Historical partially approved records were not modified.
