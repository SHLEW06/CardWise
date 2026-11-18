#!/usr/bin/env node
/* npm run dev:all — Vite + the bank connector side by side (v6 §24, Part K).
   The connector needs connector/.env (run `npm --prefix connector run keys`
   once) and the app needs VITE_CONNECTOR_URL / VITE_CONNECTOR_TOKEN in
   .env.local — see README "Bank connections". Ctrl-C stops both. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
if (!existsSync(resolve(ROOT, "connector/.env"))) {
  console.warn("[dev:all] connector/.env is missing — run `npm --prefix connector run keys` first. Starting Vite only.");
}
const procs = [
  ["app", spawn(npm, ["run", "dev"], { cwd: ROOT, stdio: ["inherit", "pipe", "pipe"] })],
  ...(existsSync(resolve(ROOT, "connector/.env")) ? [["connector", spawn(npm, ["start"], { cwd: resolve(ROOT, "connector"), stdio: ["ignore", "pipe", "pipe"] })]] : []),
];
for (const [name, p] of procs) {
  const tag = (line) => line && process.stdout.write(`[${name}] ${line}\n`);
  p.stdout.on("data", (b) => String(b).split("\n").forEach(tag));
  p.stderr.on("data", (b) => String(b).split("\n").forEach(tag));
  p.on("exit", (code) => { tag(`exited (${code})`); stop(); });
}
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const [, p] of procs) if (!p.killed) p.kill("SIGINT");
  setTimeout(() => process.exit(0), 300);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
