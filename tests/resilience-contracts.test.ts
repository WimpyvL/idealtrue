import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Author: ( |╲ ) Klaasvaakie

test("listing media commit and orphan cleanup serialize against the same intent row", () => {
  const source = readFileSync(new URL("../encore/catalog/api.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../encore/catalog/migrations/9_media_upload_intents.up.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE listing_media_upload_intents/);
  assert.match(source, /commitListingMediaUpload/);
  assert.match(source, /reconcileAbandonedListingMediaUploads/);
  assert.match(source, /UPDATE listing_media_upload_intents/);
  assert.match(source, /RETURNING id/);
});

test("availability migration normalizes conflicting rows before enforcing constraints", () => {
  const migration = readFileSync(
    new URL("../encore/catalog/migrations/10_availability_range_exclusion.up.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS btree_gist/);
  assert.match(migration, /DELETE FROM listing_availability_blocks\s+WHERE starts_on >= ends_on/);
  assert.match(migration, /overlapping_rows AS/);
  assert.doesNotMatch(migration, /\boverlaps\s+AS\s*\(/i);
  assert.match(migration, /DELETE FROM listing_availability_blocks target\s+USING overlapping_rows/);
  assert.match(migration, /ADD CONSTRAINT listing_availability_blocks_no_overlap/);
  assert.match(migration, /ADD CONSTRAINT listing_availability_blocks_valid_range/);
});
