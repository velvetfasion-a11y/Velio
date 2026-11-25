import { cp, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const apiDir = join(root, "app", "api");
const stashParent = await mkdtemp(join(tmpdir(), "velio-api-"));
const stashDir = join(stashParent, "api");

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

let moved = false;
try {
  await rename(apiDir, stashDir);
  moved = true;
  await run("npx", ["next", "build"], {
    GITHUB_PAGES: "1",
    NEXT_PUBLIC_STATIC: "1",
  });
  const outDir = join(root, "out");
  await writeFile(join(outDir, ".nojekyll"), "");
  // Project pages serve repo root at /Velio/ — keep export paths with basePath /Velio
  console.log("build-gh-pages: static site ready in out/");
} finally {
  if (moved) {
    await rm(apiDir, { recursive: true, force: true }).catch(() => undefined);
    await rename(stashDir, apiDir);
  }
  await rm(stashParent, { recursive: true, force: true }).catch(() => undefined);
}
