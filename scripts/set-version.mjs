import fs from "node:fs";
import path from "node:path";

const raw = process.argv[2];
if (!raw) {
  console.error("Usage: node scripts/set-version.mjs <v1.2.3|1.2.3>");
  process.exit(1);
}

const version = String(raw).replace(/^v/i, "");
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: ${raw}`);
  process.exit(1);
}

const root = process.cwd();

function writeJson(filePath, mutate) {
  const abs = path.join(root, filePath);
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  mutate(data);
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`);
}

const packageFiles = [
  "package.json",
  "desktop/package.json",
  "webview/package.json",
  "packages/editor-ui/package.json",
  "packages/wisdom-core/package.json",
];

for (const file of packageFiles) {
  writeJson(file, (pkg) => {
    pkg.version = version;
  });
  console.log(`ok ${file} -> ${version}`);
}

writeJson("desktop/src-tauri/tauri.conf.json", (cfg) => {
  cfg.version = version;
});
console.log(`ok desktop/src-tauri/tauri.conf.json -> ${version}`);

const cargoPath = path.join(root, "desktop/src-tauri/Cargo.toml");
const cargo = fs.readFileSync(cargoPath, "utf8");
const cargoMatch = cargo.match(/^version\s*=\s*"([^"]+)"/m);
if (!cargoMatch) {
  console.error("Failed to find [package] version in desktop/src-tauri/Cargo.toml");
  process.exit(1);
}
if (cargoMatch[1] === version) {
  console.log(`ok desktop/src-tauri/Cargo.toml (already ${version})`);
} else {
  const nextCargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  fs.writeFileSync(cargoPath, nextCargo);
  console.log(`ok desktop/src-tauri/Cargo.toml -> ${version}`);
}

console.log(`Version set to ${version}`);
