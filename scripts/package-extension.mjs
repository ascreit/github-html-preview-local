import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import packageJson from "../package.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = resolve(root, "release");
const zipPath = resolve(releaseDir, `github-html-preview-local-${packageJson.version}.zip`);

await mkdir(releaseDir, { recursive: true });
await rm(zipPath, { force: true });

await new Promise((resolvePromise, reject) => {
  const child = spawn("zip", ["-r", "-X", zipPath, ".", "-x", "*.DS_Store"], {
    cwd: resolve(root, "dist"),
    stdio: "inherit"
  });

  child.on("error", reject);
  child.on("close", (code) => {
    if (code === 0) {
      resolvePromise();
      return;
    }

    reject(new Error(`zip exited with code ${code}`));
  });
});

console.log(`Created ${zipPath}`);
