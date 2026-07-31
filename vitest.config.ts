import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@wisdom/core": path.resolve(__dirname, "packages/wisdom-core/src/index.ts"),
    },
  },
});
