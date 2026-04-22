import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAccountStatusBlockMessage,
  normalizeAccountStatusReason,
  shouldPauseListingsForAccountStatus,
} from '../encore/identity/account-status.ts';

test('buildAccountStatusBlockMessage includes the explicit suspension reason when present', () => {
  assert.equal(
    buildAccountStatusBlockMessage('suspended', 'Outstanding compliance review.'),
    'This account is suspended. Outstanding compliance review.',
  );
});

test('buildAccountStatusBlockMessage falls back to support guidance when no reason exists', () => {
  assert.equal(
    buildAccountStatusBlockMessage('deactivated', null),
    'This account is deactivated. Contact support if you think this is a mistake.',
  );
});

test('normalizeAccountStatusReason clears reasons for active accounts and trims inactive ones', () => {
  assert.equal(normalizeAccountStatusReason('active', 'Whatever'), null);
  assert.equal(normalizeAccountStatusReason('suspended', '  Abuse report under review.  '), 'Abuse report under review.');
});

test('shouldPauseListingsForAccountStatus only pauses listings for restricted accounts', () => {
  assert.equal(shouldPauseListingsForAccountStatus('active'), false);
  assert.equal(shouldPauseListingsForAccountStatus('suspended'), true);
  assert.equal(shouldPauseListingsForAccountStatus('deactivated'), true);
});
