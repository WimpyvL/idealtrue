import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const workflowPath = path.join(process.cwd(), ".github", "workflows", "staging-smoke.yml");

test("staging smoke workflow exists and keeps the required release gates", () => {
  assert.equal(existsSync(workflowPath), true, "staging smoke workflow is missing");

  const workflow = readFileSync(workflowPath, "utf8");

  for (const snippet of [
    'cron: "17 3 * * *"',
    'npm run check:staging-smoke-env',
    'npm run check:drift',
    'npm ci',
    'working-directory: encore',
    'npm run test:e2e',
    'npx tsc --noEmit',
    'npm run seed:demo',
    'npm run smoke:live',
    'actions/upload-artifact@v4',
  ]) {
    assert.match(workflow, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
