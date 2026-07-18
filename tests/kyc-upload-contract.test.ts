// ( |╲ ) Author: Klaasvaakie
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const opsApiSource = readFileSync(path.join(process.cwd(), 'encore', 'ops', 'api.ts'), 'utf8');

test('KYC submission validates signed-upload ownership and object existence before persistence', () => {
  assert.match(opsApiSource, /assertKycUploadBelongsToUser/);
  assert.match(opsApiSource, /objectKey\.startsWith\(`\$\{userId\}\/`\)/);
  assert.match(opsApiSource, /kycDocumentsBucket\.attrs\(objectKey\)/);
  assert.match(opsApiSource, /await Promise\.all\(\[\s*assertKycUploadBelongsToUser\(auth\.userID, idImageKey\),\s*assertKycUploadBelongsToUser\(auth\.userID, selfieImageKey\)/s);
});
