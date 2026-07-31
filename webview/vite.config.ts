import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@wisdom/core": path.resolve(__dirname, "../packages/wisdom-core/src"),
      "@wisdom/editor-ui": path.resolve(__dirname, "../packages/editor-ui/src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist/webview"),
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
