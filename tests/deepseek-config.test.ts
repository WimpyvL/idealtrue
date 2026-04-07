import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_TEXT_MODEL,
  getDeepSeekConfig,
  hasDeepSeekConfig,
} from "../lib/server/deepseek-config.js";

test("getDeepSeekConfig defaults to the stable chat model and base URL", () => {
  const config = getDeepSeekConfig({ DEEPSEEK_API_KEY: "deepseek-test-key" });

  assert.equal(config.textModel, DEFAULT_DEEPSEEK_TEXT_MODEL);
  assert.equal(config.baseUrl, DEFAULT_DEEPSEEK_BASE_URL);
});

test("hasDeepSeekConfig only returns true when a fallback key is present", () => {
  assert.equal(hasDeepSeekConfig({}), false);
  assert.equal(hasDeepSeekConfig({ DEEPSEEK_API_KEY: "deepseek-test-key" }), true);
});
