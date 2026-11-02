#!/usr/bin/env node
// Levanta todo GreenShift con un solo comando (Windows, macOS y Linux):
//   npm run dev      → backend FastAPI (:8000) + frontend Next.js en modo desarrollo (:3000)
//   npm run demo     → igual, pero con el frontend compilado (recomendado para proyectar)
// La primera vez crea el entorno de Python e instala dependencias.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const frontend = join(root, "frontend");
const isWin = process.platform === "win32";
const args = new Set(process.argv.slice(2));
const prod = args.has("--prod");
const setupOnly = args.has("--setup-only");
const API_PORT = process.env.API_PORT ?? "8000";
const WEB_PORT = process.env.WEB_PORT ?? "3000";

const venvPython = join(backend, ".venv", isWin ? "Scripts/python.exe" : "bin/python");
const npm = isWin ? "npm.cmd" : "npm";

function run(cmd, argv, cwd) {
  const r = spawnSync(cmd, argv, { cwd, stdio: "inherit", shell: isWin && cmd.endsWith(".cmd") });
  if (r.status !== 0) {
    console.error(`\n✖ Falló: ${cmd} ${argv.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

function findPython() {
  for (const [cmd, extra] of [["python", []], ["python3", []], ["py", ["-3"]]]) {
    const r = spawnSync(cmd, [...extra, "--version"], { encoding: "utf8" });
    if (r.status === 0) return [cmd, extra];
  }
  console.error("✖ No se encontró Python 3.10+. Instalalo y volvé a correr el comando.");
  process.exit(1);
}

if (!existsSync(venvPython)) {
  console.log("▸ Creando entorno de Python (solo la primera vez)…");
  const [py, extra] = findPython();
  run(py, [...extra, "-m", "venv", ".venv"], backend);
  run(venvPython, ["-m", "pip", "install", "-q", "-r", "requirements-dev.txt"], backend);
}
if (!existsSync(join(frontend, "node_modules"))) {
  console.log("▸ Instalando dependencias del frontend (solo la primera vez)…");
  run(npm, ["install"], frontend);
}
run(venvPython, ["-m", "app.db"], backend); // siembra SQLite si hace falta
if (setupOnly) process.exit(0);

if (prod) {
  console.log("▸ Compilando el frontend…");
  run(npm, ["run", "build"], frontend);
}

const children = [];
function start(name, color, cmd, argv, cwd, env = {}) {
  const child = spawn(cmd, argv, { cwd, env: { ...process.env, ...env }, shell: isWin && cmd.endsWith(".cmd") });
  const tag = `\x1b[${color}m${name.padEnd(4)}\x1b[0m │ `;
  const pipe = (stream) =>
    stream.on("data", (buf) => {
      for (const line of buf.toString().split(/\r?\n/)) if (line.trim()) process.stdout.write(tag + line + "\n");
    });
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => {
    console.log(`${tag}terminó (código ${code})`);
    shutdown();
  });
  children.push(child);
}

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (isWin) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGTERM");
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start("api", "32", venvPython, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", API_PORT], backend);
start("web", "36", npm, ["run", prod ? "start" : "dev", "--", "-p", WEB_PORT], frontend, {
  NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
});
console.log(`\n  GreenShift listo en  →  http://localhost:${WEB_PORT}\n  API                  →  http://127.0.0.1:${API_PORT}/docs\n`);
