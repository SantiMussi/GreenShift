#!/usr/bin/env node
// Corre los tests del planificador (pytest) y el test de humo de la interfaz (vitest).
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const py = join(root, "backend", ".venv", isWin ? "Scripts/python.exe" : "bin/python");
const steps = [
  [py, ["-m", "pytest", "-q"], join(root, "backend")],
  [isWin ? "npm.cmd" : "npm", ["test"], join(root, "frontend")],
];
let failed = false;
for (const [cmd, args, cwd] of steps) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: isWin && cmd.endsWith(".cmd") });
  failed ||= r.status !== 0;
}
process.exit(failed ? 1 : 0);
