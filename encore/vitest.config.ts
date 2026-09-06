import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["billing/*.test.ts", "booking/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
  },
});
