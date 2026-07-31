const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const ctx = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  platform: "node",
  format: "cjs",
  sourcemap: true,
  target: "node18",
};

if (watch) {
  esbuild.context(ctx).then((c) => c.watch());
} else {
  esbuild.build(ctx).catch(() => process.exit(1));
}
