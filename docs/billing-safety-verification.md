# Billing safety remediation — first batch

Candidate starts from GitHub main f02b0c3, preserving 60 commits absent from the original local checkout. The original checkout and unrelated uncommitted edits remain intact.

## Changes

- Browser return hints no longer authorize payment settlement, including the unauthenticated return endpoint.
- Provider-confirmed test payments record paid status without granting live subscriptions, credits, managed hosting, card setup or referral rewards. Missing/unknown legacy mode fails closed. New checkout mode is explicit and captured before inserting the intent.
- All four reconciliation/webhook lock callbacks use their own transaction; the shared global transaction is removed.
- Unprocessed duplicate webhooks are republished, inserts tolerate duplicate delivery, and a five-minute recovery job retries durable unprocessed events.
- Pending reconciliation claims a rotating batch before provider calls, including order-only intents, so unresolved old payments do not permanently starve later ones.
- Provider lookups use the payment's stored mode, and test-payment UI copy does not claim live entitlement activation.
- Duplicate upstream migration numbers preventing Encore Cloud tests were moved to unused versions: booking 5 payment-dispute guards becomes 8; referrals 3 reward-integrity becomes 4. SQL contents are unchanged. Existing numbered migrations remain intact.
- Two upstream lint issues were corrected without changing messaging behavior.
- Cloud testing exposed and reproduced two additional runtime defects: advisory locks returned an unsupported PostgreSQL void column; serialized webhook JSON was bound as a JSON string. Lock execution now discards the return value, new webhook writes cast through text, and unprocessed legacy encoded payloads are decoded during recovery.

## Verification

- Original checkout: 238 unit tests, 57 UI tests, lint, backend types and build passed.
- Current-main candidate: lint and backend types passed; 54 focused payment/migration tests, 58 UI tests and the production build passed.
- Current-main full unit suite: 260 passed, 3 pre-existing documentation/coverage failures (release risk registry, mocked/live handoff wording, workflow mock coverage assertions). These assertions were not weakened.
- Backend tests use real Encore SQL infrastructure and mock only the external payment provider. They cover forged return hints, provider-confirmed test isolation, live credit fulfilment, concurrent requests, webhook settlement, durable requeue, and batch fairness.
- Encore Cloud staging build and all 8 real-database backend regressions passed for commit 0fb8224ab5ca1528ae210453cea877ca2c16f4aa. Release 219a49cb0mgd0vq137sg completed successfully on 2026-09-05. https://app.encore.dev/ideal-stay-online-gh5i/envs/staging/deploys/219a49cb0mgd0vq137sg
- Live staging GET /billing/plans returned HTTP 200 with the expected three plans. This is a read-only reachability check, not a real-payment or complete workflow proof.
- After the runtime corrections: backend type checking and all 41 focused payment contracts passed. Frontend code is unchanged from the successful UI/build checks above.

## Release boundaries

The user explicitly approved publishing the candidate branch and Encore Cloud staging verification. Staging referral_rewards was inspected read-only and contained zero rows before applying its pending cleanup migration. Cloud regression tests used isolated databases. No production deploy or real payment was performed; main remains unchanged. Already-processed legacy webhook rows are not replayed automatically and require a separate evidence-based recovery review.

The remaining audit findings are not closed by this batch. In particular, cross-database entitlement atomicity, concurrent subscription purchases by the same host, booking transitions/availability, and session revocation still need dedicated changes.
