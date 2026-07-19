# Ideal Stay Release Risk Register

Author signature: (|/) Klaasvaakie

This register turns the current fragile zones into explicit release rules. Use it before changing billing, booking, catalog, deployment configuration, frontend API contracts, social publishing language, or operations workflows.

## Purpose

The goal is not to freeze the codebase. The goal is to make risky areas visible, test-backed, and hard to accidentally weaken.

A fragile zone is considered reduced only when the owning workflow has:

- a named source owner
- a focused test or source-pattern guard
- a release or live-smoke check when production configuration matters
- an explicit follow-up path when the full product capability is not yet implemented

## High Risk

| Risk | Owner files | Current mitigation | Required release rule |
| --- | --- | --- | --- |
| Dense backend domain files | `encore/billing/api.ts`, `encore/booking/api.ts`, `encore/catalog/api.ts` | Existing helpers already cover some slices: billing webhook classification, payment return URLs, pricing, content entitlements, booking workflow helpers, catalog availability helpers, quota and host-plan helpers. | Do not add broad new workflow logic directly to these files without first looking for a helper extraction. Changes must include focused contract tests for the touched workflow slice. |
| Production environment drift | `.env.example`, `lib/server/session-cookie.js`, `api/encore-proxy.js`, `server.ts`, `.github/workflows/staging-smoke.yml` | `ENCORE_API_URL` fails closed in production-like environments; staging backend is blocked unless explicitly allowed; staging smoke validates required secrets. | Production-sensitive releases must verify `ENCORE_API_URL`, Yoco mode/secrets, `YOCO_WEBHOOK_SECRET`, Resend email settings, Google OAuth client id, AI provider keys, Vercel host, and Encore environment alignment without exposing secret values. |
| Mocked Playwright false confidence | `tests/e2e/**`, `scripts/live-smoke.mjs`, `.github/workflows/staging-smoke.yml` | Playwright tests mock `/api/encore/**`; the scheduled/manual staging smoke job runs against deployed frontend and Encore. | Never use mocked e2e alone as production readiness evidence. Release notes must distinguish `npm run test:e2e` from `npm run smoke:live` or `Staging Smoke / staging smoke`. |

## Medium Risk

| Risk | Owner files | Current mitigation | Required release rule |
| --- | --- | --- | --- |
| Manual frontend Encore clients | `src/lib/*-client.ts`, `src/lib/domain-mappers.ts`, `src/lib/encore-client.ts` | Zod runtime validation and focused contract tests protect many response shapes. | Any backend response-shape or enum change must update the matching frontend parser/mapper and client contract test in the same PR. Generated Encore clients remain the target replacement when they can cover runtime validation. |
| Workflow coverage gaps | `docs/workflow-validation-matrix.md`, `tests/fixtures/workflows.ts`, `tests/workflow-coverage.test.ts` | The workflow matrix names current coverage and next coverage for every workflow. | Do not mark messaging, reviews, referrals, admin destructive actions, or platform settings complete until backend permission/state tests and visible UI/e2e coverage exist for happy and rejection paths. |
| Social publishing overstatement | `src/pages/SocialDashboard.tsx`, `src/lib/billing-client.ts`, `encore/billing/api.ts`, social docs/tests | Current product creates drafts, image helpers, scheduling/reminder state, and manual publication tracking. | UI copy and docs must not imply that Ideal Stay buys ads or publishes to social networks until OAuth/channel integrations, delivery IDs, retry handling, and provider failure reporting exist. |
| Dispute handling depth | `encore/booking/api.ts`, `src/lib/platform-client.ts`, host/guest/admin booking surfaces | Current disputes are durable ledger events with typed resolution. | Do not call the dispute workflow complete until assignees, priority, SLA handling, internal notes, evidence timeline, refund/outcome tracking, and escalation are implemented and tested. |

## Low And Maintenance Risk

| Risk | Owner files | Current mitigation | Required release rule |
| --- | --- | --- | --- |
| Long historical notes | `sani.md`, `docs/developer-handoff.md`, `docs/architecture-release-map.md` | `sani.md` remains useful history; newer docs are the entry points. | Link new developers to `docs/developer-handoff.md`, `docs/architecture-release-map.md`, and this register before `sani.md`. Keep `sani.md` as historical context, not the release source of truth. |
| Non-portable docs links | `README.md`, docs index sections | README links now use repository-relative paths. | Repository docs should not use local Windows absolute paths such as `/C:/Git%20Repos/IdealTrue/...`. |

## Refactor Rule For Large Backend Files

When touching `encore/billing/api.ts`, `encore/booking/api.ts`, or `encore/catalog/api.ts`:

1. Identify the single workflow slice being changed.
2. Prefer extracting pure helpers for mapping, transition checks, provider normalization, entitlement calculation, permission checks, or notification orchestration.
3. Add a focused unit or contract test for the helper or source contract before widening the change.
4. Keep database transaction boundaries visible near the mutation they protect.
5. Avoid moving unrelated workflow code in the same PR.

## Production Release Rule

A production-sensitive release must state which of these were run:

- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- `cd encore && npx tsc --noEmit`
- `npm run smoke:live` or scheduled/manual `Staging Smoke / staging smoke`

If live smoke was not run, the release note must say that production backend/provider health was not proven in that pass.
