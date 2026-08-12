const esbuild = require("esbuild");
const path = require("path");

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').Plugin} */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      for (const error of result.errors) {
        console.error(`✘ [ERROR] ${error.text}`);
        if (error.location) {
          console.error(
            `    ${error.location.file}:${error.location.line}:${error.location.column}:`
          );
        }
      }
      console.log("[watch] build finished");
    });
  },
};

/** @type {import('esbuild').BuildOptions} */
const ctx = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  platform: "node",
  format: "cjs",
  sourcemap: true,
  target: "node18",
  alias: {
    "@wisdom/core": path.resolve(__dirname, "packages/wisdom-core/src/index.ts"),
  },
  plugins: watch ? [esbuildProblemMatcherPlugin] : [],
};

async function main() {
  if (watch) {
    const context = await esbuild.context(ctx);
    await context.watch();
    console.log("[watch] watching extension…");
  } else {
    await esbuild.build(ctx);
  }
}

main().catch(() => process.exit(1));
