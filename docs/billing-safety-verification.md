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

## Verification

- Original checkout: 238 unit tests, 57 UI tests, lint, backend types and build passed.
- Current-main candidate: lint and backend types passed; 54 focused payment/migration tests, 58 UI tests and the production build passed.
- Current-main full unit suite: 260 passed, 3 pre-existing documentation/coverage failures (release risk registry, mocked/live handoff wording, workflow mock coverage assertions). These assertions were not weakened.
- Backend tests use real Encore SQL infrastructure and mock only the external payment provider. They cover forged return hints, provider-confirmed test isolation, live credit fulfilment, concurrent requests, webhook settlement, durable requeue, and batch fairness.
- Windows Encore cannot bind its daemon socket. The Docker socket fallback was rejected by automatic approval review. Cloud build/test verification is pending; no claim of backend runtime completion is made yet.

## Release boundaries

No production deploy, production fixture, or real payment is authorized by this candidate. Persistent staging migrations must be checked against existing data before deployment because the previously blocked referral migration contains data cleanup statements. Cloud build tests use isolated databases.

The remaining audit findings are not closed by this batch. In particular, cross-database entitlement atomicity, concurrent subscription purchases by the same host, booking transitions/availability, and session revocation still need dedicated changes.
