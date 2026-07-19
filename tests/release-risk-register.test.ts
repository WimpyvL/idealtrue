import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

function readRepoFile(...segments: string[]) {
  return readFileSync(join(repoRoot, ...segments), 'utf8');
}

test('release risk register covers every known fragile zone', () => {
  const docPath = join(repoRoot, 'docs', 'release-risk-register.md');
  assert.equal(existsSync(docPath), true, 'docs/release-risk-register.md is missing');

  const doc = readRepoFile('docs', 'release-risk-register.md');
  const requiredTerms = [
    'encore/billing/api.ts',
    'encore/booking/api.ts',
    'encore/catalog/api.ts',
    'ENCORE_API_URL',
    'YOCO_PAYMENT_MODE',
    'YOCO_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'AUTH_EMAIL_FROM',
    'GOOGLE_OAUTH_CLIENT_ID',
    'GEMINI_API_KEY',
    'DEEPSEEK_API_KEY',
    'Vercel',
    'Encore',
    'tests/e2e/**',
    '/api/encore/**',
    'npm run smoke:live',
    'manual frontend Encore clients',
    'generated Encore clients',
    'messaging',
    'reviews',
    'referrals',
    'admin destructive actions',
    'platform settings',
    'drafts',
    'manual publication tracking',
    'assignees',
    'SLA handling',
    'refund/outcome tracking',
  ];

  const missing = requiredTerms.filter((term) => !doc.includes(term));
  assert.deepEqual(missing, []);
});

test('architecture and handoff docs point developers to the risk register', () => {
  const architecture = readRepoFile('docs', 'architecture-release-map.md');
  const handoff = readRepoFile('docs', 'developer-handoff.md');
  const readme = readRepoFile('README.md');

  assert.match(architecture, /docs\/release-risk-register\.md/);
  assert.match(handoff, /docs\/release-risk-register\.md/);
  assert.match(readme, /docs\/release-risk-register\.md/);
});

test('README links are repository-relative instead of local machine paths', () => {
  const readme = readRepoFile('README.md');

  assert.equal(readme.includes('/C:/Git%20Repos/IdealTrue/'), false);
  assert.match(readme, /\[`LICENSE`\]\(LICENSE\)/);
  assert.match(readme, /\[`encore`\]\(encore\)/);
});

test('staging smoke workflow preserves the live environment gate separate from mocked e2e', () => {
  const workflow = readRepoFile('.github', 'workflows', 'staging-smoke.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /Run mocked end-to-end tests/);
  assert.match(workflow, /Validate staging smoke environment/);
  assert.match(workflow, /npm run check:staging-smoke-env/);
  assert.match(workflow, /Run live staging smoke/);
  assert.match(workflow, /npm run smoke:live/);
  assert.match(workflow, /if: github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
});

test('release docs keep mocked e2e and live smoke responsibilities separate', () => {
  const architecture = readRepoFile('docs', 'architecture-release-map.md');
  const readme = readRepoFile('README.md');
  const handoff = readRepoFile('docs', 'developer-handoff.md');

  for (const doc of [architecture, readme, handoff]) {
    assert.match(doc, /mock/i);
    assert.match(doc, /live smoke/i);
    assert.match(doc, /production/i);
  }
});
