import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePaymentMode } from '../encore/billing/payment-mode';

test('payment mode requires an explicit recognized value', () => {
  for (const value of [undefined, null, '', ' ', 'production', 'testing', 'liv', 'live,test']) {
    assert.throws(() => parsePaymentMode(value), /explicitly set/);
  }
  assert.equal(parsePaymentMode('live'), 'live');
  assert.equal(parsePaymentMode('test'), 'test');
  assert.equal(parsePaymentMode(' LIVE '), 'live');
});
