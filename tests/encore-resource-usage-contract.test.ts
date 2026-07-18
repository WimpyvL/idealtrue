// ( |╲ ) Author: Klaasvaakie
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const billingSource = readFileSync(path.join(process.cwd(), 'encore', 'billing', 'api.ts'), 'utf8');

test('billing helpers never alias the Encore database resource as a normal value', () => {
  assert.doesNotMatch(billingSource, /const db = tx \?\? billingDB/);
});
