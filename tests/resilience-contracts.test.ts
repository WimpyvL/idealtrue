import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Author: ( |╲ ) Klaasvaakie
test("listing media uses durable upload intents and an orphan reconciliation job", () => {
  const source = readFileSync(new URL("../encore/catalog/api.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../encore/catalog/migrations/9_media_upload_intents.up.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE listing_media_upload_intents/);
  assert.match(source, /listingMediaBucket\.attrs\(intent\.object_key\)/);
  assert.match(source, /attributes\.size !== intent\.expected_size/);
  assert.match(source, /reconcileAbandonedListingMediaUploads/);
  assert.match(source, /new CronJob\("reconcile-abandoned-listing-media"/);
});

test("availability ranges are database constrained and replacement is atomic", () => {
  const source = readFileSync(new URL("../encore/catalog/api.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../encore/catalog/migrations/10_availability_range_exclusion.up.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /availability_range DATERANGE/);
  assert.match(migration, /EXCLUDE USING GIST/);
  assert.match(migration, /availability_range WITH &&/);
  assert.match(source, /replaceAvailabilityBlocksTransactionally/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /await tx\.commit\(\)/);
  assert.match(source, /if \(!isAvailabilityLedgerSchemaError\(error\)\) \{\s*throw error;/);
});
