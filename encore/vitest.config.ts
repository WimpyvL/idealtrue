import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["billing/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
  },
});
