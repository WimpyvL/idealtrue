# Ideal Stay Encore Backend

This is the proprietary Encore TypeScript backend for Ideal Stay.

Copyright (c) 2026 Klaasvaakie. All rights reserved.

Author signature: (|/) Klaasvaakie

No open-source license is granted. See the root [`LICENSE`](/C:/Git%20Repos/IdealTrue/LICENSE) file before using, copying, deploying, or sharing this code.

## Scope

The backend owns the durable platform state for:

- identity and auth session verification
- catalog and listing availability
- booking and enquiry workflows
- billing, payment intents, provider reconciliation, and host billing state
- messaging, referrals, reviews, operations, notifications, and analytics
- protected media, KYC documents, moderation evidence, and related buckets

## Local Development

Install dependencies:

```bash
npm install
```

Run the backend:

```bash
encore run
```

Typecheck:

```bash
npx tsc --noEmit
```

## Operational Notes

Do not commit provider secrets, webhook secrets, API keys, local credentials, or exported dashboard config.

Payment behavior must stay server-owned and auditable. Frontend purchase surfaces should enter through the standard billing payment contract, while provider status changes reconcile through backend-owned status reads and webhooks.
