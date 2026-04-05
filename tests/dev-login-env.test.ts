import assert from 'node:assert/strict';
import test from 'node:test';

import { isDevLoginEnabled } from '../encore/identity/dev-login.ts';

test('dev login is disabled by default outside production', () => {
  assert.equal(isDevLoginEnabled({ NODE_ENV: 'development' }), false);
  assert.equal(isDevLoginEnabled({ NODE_ENV: 'test' }), false);
  assert.equal(isDevLoginEnabled({}), false);
});

test('dev login accepts only explicit truthy opt-in values outside production', () => {
  assert.equal(isDevLoginEnabled({ NODE_ENV: 'development', IDEAL_STAY_ENABLE_DEV_LOGIN: 'true' }), true);
  assert.equal(isDevLoginEnabled({ NODE_ENV: 'development', IDEAL_STAY_ENABLE_DEV_LOGIN: '1' }), true);
  assert.equal(isDevLoginEnabled({ NODE_ENV: 'development', IDEAL_STAY_ENABLE_DEV_LOGIN: 'yes' }), true);
  assert.equal(isDevLoginEnabled({ NODE_ENV: 'development', IDEAL_STAY_ENABLE_DEV_LOGIN: 'false' }), false);
});

test('dev login stays disabled in production even if explicitly requested', () => {
  assert.equal(isDevLoginEnabled({ NODE_ENV: 'production', IDEAL_STAY_ENABLE_DEV_LOGIN: 'true' }), false);
});
