import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(root, "src", "extension");
const distDir = resolve(root, "dist");

await mkdir(distDir, { recursive: true });

await Promise.all([
  rm(resolve(distDir, "manifest.json"), { force: true }),
  rm(resolve(distDir, "popup.html"), { force: true }),
  rm(resolve(distDir, "preview.html"), { force: true }),
  rm(resolve(distDir, "styles"), { recursive: true, force: true })
]);

await cp(sourceDir, distDir, { recursive: true });
